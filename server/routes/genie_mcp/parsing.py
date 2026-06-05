"""
Artifact parsing + state normalisation for both managed Genie MCP shapes.

Two response shapes are normalised into ONE state dict so the route never needs
to branch on server shape:

  - per-space  : structured JSON (content.textAttachments / queryAttachments with
                 a full statement_response).
  - multi-space: rendered markdown (```sql fence + GFM table + deep link), with
                 Genie's embedded-query HTML-comment markers stripped from prose.

Pure functions, no I/O — unit-testable in isolation.
"""

import re
from typing import Any, Optional

_NUMERIC_TYPES = {
    "DOUBLE", "DECIMAL", "FLOAT", "REAL", "INT", "INTEGER", "BIGINT",
    "LONG", "SHORT", "TINYINT", "SMALLINT", "NUMERIC",
}

# ─── Markdown artifact parsing (multi-space shape) ─────────────────────────────

_SQL_FENCE_RE = re.compile(r"```sql\s*([\s\S]*?)```", re.IGNORECASE)
_GENERIC_FENCE_RE = re.compile(r"```\s*([\s\S]*?)```")
_EXPLORE_LINK_RE = re.compile(r"\[Explore in Databricks\]\((https?://[^)]+)\)", re.IGNORECASE)
_GENIE_LINK_RE = re.compile(r"\((https?://[^)]*/(?:genie|chat|sql|explore)[^)]*)\)", re.IGNORECASE)
_TABLE_SEP_RE = re.compile(r"^\s*\|?[\s:|-]+\|?\s*$")
_NUMERIC_STRIP_RE = re.compile(r"[$,%\s]")

# Genie's genie_ask markdown wraps embedded result tables in HTML-comment markers
# like `<!-- begin-embedded:query_48e0a3 -->` ... `<!-- end-embedded:... -->`. We
# render the table separately (structured), so strip these blocks from the prose.
_EMBEDDED_BLOCK_RE = re.compile(
    r"<!--\s*begin-embedded:[\s\S]*?end-embedded:[^>]*?-->", re.IGNORECASE
)
_EMBEDDED_MARKER_RE = re.compile(r"<!--\s*(?:begin|end)-embedded:[^>]*?-->", re.IGNORECASE)
_QUERY_RESULT_LINK_RE = re.compile(r"\[Query Result\]\([^)]*\)", re.IGNORECASE)
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


def clean_answer_markdown(markdown: str) -> str:
    """Strip Genie's embedded-query markers/tables and link noise from the prose."""
    if not markdown:
        return markdown
    md = _EMBEDDED_BLOCK_RE.sub("", markdown)
    md = _EMBEDDED_MARKER_RE.sub("", md)
    md = _QUERY_RESULT_LINK_RE.sub("", md)
    md = _MULTI_NEWLINE_RE.sub("\n\n", md)
    return md.strip()


def extract_sql(markdown: str) -> Optional[str]:
    if not markdown:
        return None
    m = _SQL_FENCE_RE.search(markdown)
    if m and m.group(1).strip():
        return m.group(1).strip()
    g = _GENERIC_FENCE_RE.search(markdown)
    if g and re.search(r"\bselect\b", g.group(1), re.IGNORECASE):
        return g.group(1).strip()
    return None


def extract_deep_link(markdown: str) -> Optional[str]:
    if not markdown:
        return None
    m = _EXPLORE_LINK_RE.search(markdown)
    if m:
        return m.group(1)
    m = _GENIE_LINK_RE.search(markdown)
    return m.group(1) if m else None


def _is_number(value: Any) -> bool:
    try:
        float(_NUMERIC_STRIP_RE.sub("", str(value)))
        return True
    except (ValueError, TypeError):
        return False


def format_number(raw: Any) -> str:
    """Render Genie's stringified numbers without scientific notation."""
    try:
        f = float(str(raw))
    except (ValueError, TypeError):
        return "" if raw is None else str(raw)
    if f == int(f) and abs(f) < 1e15:
        return f"{int(f):,}"
    return f"{f:,.2f}"


def extract_table(markdown: str) -> Optional[dict]:
    if not markdown:
        return None
    lines = markdown.split("\n")
    for i in range(len(lines) - 1):
        header = lines[i]
        sep = lines[i + 1]
        if "|" not in header:
            continue
        if not _TABLE_SEP_RE.match(sep) or "-" not in sep:
            continue

        def parse_row(line: str) -> list[str]:
            s = line.strip()
            if s.startswith("|"):
                s = s[1:]
            if s.endswith("|"):
                s = s[:-1]
            return [c.strip() for c in s.split("|")]

        header_cells = parse_row(header)
        if len(header_cells) < 1:
            continue
        rows: list[list[str]] = []
        j = i + 2
        while j < len(lines):
            line = lines[j]
            if "|" not in line or line.strip() == "":
                break
            cells = parse_row(line)
            while len(cells) < len(header_cells):
                cells.append("")
            rows.append(cells[: len(header_cells)])
            j += 1
        if not rows:
            continue
        columns = []
        numeric_flags: list[bool] = []
        for col_idx, name in enumerate(header_cells):
            values = [r[col_idx] for r in rows if r[col_idx] not in ("", None)]
            all_numeric = len(values) > 0 and all(_is_number(v) for v in values)
            numeric_flags.append(all_numeric)
            columns.append({"name": name, "type": "number" if all_numeric else "string"})

        # Format numeric cells (Genie often returns scientific notation / long floats).
        fmt_rows: list[list[str]] = []
        for r in rows:
            cells = []
            for idx, v in enumerate(r):
                if idx < len(numeric_flags) and numeric_flags[idx] and _is_number(v):
                    cells.append(format_number(_NUMERIC_STRIP_RE.sub("", v)))
                else:
                    cells.append(v)
            fmt_rows.append(cells)
        return {"columns": columns, "rows": fmt_rows, "rowCount": len(fmt_rows)}
    return None


# ─── Structured result parsing (per-space shape) ───────────────────────────────

def table_from_statement(stmt: Optional[dict]) -> Optional[dict]:
    """Build {columns, rows} from a Genie statement_response payload."""
    if not isinstance(stmt, dict):
        return None
    manifest = stmt.get("manifest") or {}
    schema = manifest.get("schema") or {}
    raw_cols = schema.get("columns") or []
    if not raw_cols:
        return None

    columns = []
    numeric_flags = []
    for c in raw_cols:
        meta = c.get("metadata") or {}
        type_name = (c.get("type_name") or c.get("type_text") or "").upper()
        is_num = type_name in _NUMERIC_TYPES
        numeric_flags.append(is_num)
        columns.append({
            "name": meta.get("display_name") or c.get("name") or "",
            "type": "number" if is_num else "string",
        })

    result = stmt.get("result") or {}
    data_array = result.get("data_array") or []
    rows: list[list[str]] = []
    for row in data_array:
        if isinstance(row, dict) and "values" in row:
            cells = []
            for idx, v in enumerate(row["values"]):
                val: Any
                if isinstance(v, dict):
                    val = v.get("string_value")
                    if val is None and v:
                        val = next(iter(v.values()))
                else:
                    val = v
                if val is not None and idx < len(numeric_flags) and numeric_flags[idx]:
                    val = format_number(val)
                cells.append("" if val is None else str(val))
            rows.append(cells)
        elif isinstance(row, list):
            rows.append([("" if v is None else str(v)) for v in row])

    if not rows:
        return None
    return {"columns": columns, "rows": rows, "rowCount": len(rows)}


def normalize_state(structured: dict, raw_text: str) -> dict:
    """Normalise either managed-server shape into a single state dict.

    Returns: conversation_id, message_id, status, text (markdown answer),
    sql_blocks [{sql, description}], tables [{columns, rows}], deep_link,
    progress_steps [str].
    """
    structured = structured or {}
    conversation_id = structured.get("conversationId") or structured.get("conversation_id")
    message_id = (
        structured.get("messageId")
        or structured.get("message_id")
        or structured.get("response_id")
    )
    status = (structured.get("status") or "").strip()

    text = ""
    sql_blocks: list[dict] = []
    tables: list[dict] = []
    deep_link = structured.get("deep_link")
    progress_steps = structured.get("progress_steps") or []

    content = structured.get("content")
    if isinstance(content, dict):
        # ── per-space structured shape ──
        text = "\n\n".join(t for t in (content.get("textAttachments") or []) if t)
        for qa in content.get("queryAttachments") or []:
            sql = qa.get("query")
            if sql:
                sql_blocks.append({"sql": sql, "description": qa.get("description") or "Generated by Genie"})
            table = table_from_statement(qa.get("statement_response"))
            if table:
                tables.append(table)
    else:
        # ── multi-space markdown shape (or opaque) ──
        markdown = structured.get("final_answer") or raw_text or ""
        # Parse artifacts from the RAW markdown, but display a cleaned answer
        # (embedded-query markers + raw table stripped out).
        sql = extract_sql(markdown)
        if sql:
            sql_blocks.append({"sql": sql, "description": "Generated by Genie"})
        table = extract_table(markdown)
        if table:
            tables.append(table)
        if not deep_link:
            deep_link = extract_deep_link(markdown)
        text = clean_answer_markdown(markdown)

    return {
        "conversation_id": conversation_id,
        "message_id": message_id,
        "status": status,
        "text": text,
        "sql_blocks": sql_blocks,
        "tables": tables,
        "deep_link": deep_link,
        "progress_steps": [s for s in progress_steps if s],
    }
