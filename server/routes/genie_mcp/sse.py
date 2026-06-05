"""Server-Sent Events framing, matching this repo's SSE convention.

Frames are ``data: {json}\\n\\n`` and the stream terminates with ``data: [DONE]``.
"""

import json


def sse(payload: dict | str) -> str:
    if isinstance(payload, str):
        return f"data: {payload}\n\n"
    return f"data: {json.dumps(payload)}\n\n"
