import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowUp,
  ArrowRight,
  DollarSign,
  Leaf,
  Users,
  Plane,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import {
  fetchKpis,
  fetchKpiTrend,
  type KpiValues,
  type KpiResponse,
  type TrendPoint,
} from "@/config";
import { useUser } from "@/hooks/useUser";

// ─── KPI presentation config ──────────────────────────────────────────────────

type KpiKey = keyof KpiValues;

interface KpiMeta {
  key: KpiKey;
  label: string;
  icon: LucideIcon;
  accent: string; // icon chip gradient
  format: (n: number) => string;
  // Whether an increase is "good" (green), "bad" (rose), or neutral (slate).
  goodDirection: "up" | "down" | "neutral";
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const KPIS: KpiMeta[] = [
  {
    key: "spend",
    label: "Total Spend",
    icon: DollarSign,
    accent: "from-brand-primary to-brand-accent",
    format: (n) => currency.format(n),
    goodDirection: "neutral",
  },
  {
    key: "emissions",
    label: "CO₂ Emissions",
    icon: Leaf,
    accent: "from-emerald-500 to-teal-500",
    format: (n) => `${compact.format(n)} tCO₂e`,
    goodDirection: "down",
  },
  {
    key: "travelers",
    label: "Travelers",
    icon: Users,
    accent: "from-sky-500 to-cyan-500",
    format: (n) => compact.format(n),
    goodDirection: "neutral",
  },
  {
    key: "trips",
    label: "Trips",
    icon: Plane,
    accent: "from-fuchsia-500 to-pink-500",
    format: (n) => compact.format(n),
    goodDirection: "neutral",
  },
];

const SUGGESTIONS = [
  "Total spend by category this year",
  "Top 5 countries by CO₂ emissions",
  "How is spend trending vs last year?",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [input, setInput] = useState("");
  const [kpis, setKpis] = useState<KpiResponse | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchKpis().then((res) => {
      if (cancelled) return;
      setKpis(res);
      setKpiLoading(false);
    });
    fetchKpiTrend().then((res) => {
      if (cancelled) return;
      setTrend(res.ok && res.series ? res.series : []);
      setTrendLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    navigate(`/genie-mcp?q=${encodeURIComponent(text)}`);
  };

  const firstName = (user?.displayName || "").split(/\s+/)[0] || "there";
  const showKpis = kpiLoading || (kpis?.ok && kpis.current);

  return (
    <div className="flex-1 overflow-y-auto bg-linear-to-b from-slate-50 to-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 md:py-10">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-sidebar-from via-brand-sidebar-via to-brand-primary px-7 py-8 md:px-10 md:py-10 shadow-xl shadow-brand-primary-dark/20">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-brand-accent/20 blur-3xl" />
            <div className="absolute right-1/3 bottom-[-30%] h-56 w-56 rounded-full bg-brand-primary-light/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-brand-primary-light/80">
              <Sparkles size={14} />
              {user?.tenant || "APEX Travel Intelligence"}
            </div>
            <h1 className="mt-2 text-2xl md:text-[28px] font-bold tracking-tight text-white">
              {greeting()}, {firstName}.
            </h1>
            <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-brand-primary-light/80">
              Ask anything about your travel program, or jump into a dashboard. Grounded
              answers with live SQL — governed end to end.
            </p>

            {/* Ask APEX composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="group relative mt-6 flex items-center rounded-2xl border border-white/15 bg-white/95 px-4 py-2.5 shadow-2xl shadow-brand-primary-dark/30 transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-white/20"
            >
              <Sparkles className="mr-2.5 h-4 w-4 shrink-0 text-brand-accent" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask APEX about spend, emissions, bookings…"
                className="flex-1 bg-transparent py-1 text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-primary to-brand-accent text-white shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300"
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[12.5px] text-brand-primary-light backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── KPI strip ────────────────────────────────────────────────── */}
        {showKpis && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                This year at a glance
              </h2>
              <span className="text-[11px] text-slate-400">vs. prior year</span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {KPIS.map((meta) =>
                kpiLoading ? (
                  <KpiSkeleton key={meta.key} />
                ) : (
                  <KpiCard
                    key={meta.key}
                    meta={meta}
                    current={kpis?.current?.[meta.key] ?? null}
                    previous={kpis?.previous?.[meta.key] ?? null}
                  />
                )
              )}
            </div>
          </section>
        )}

        {/* ── Trends ───────────────────────────────────────────────────── */}
        {(trendLoading || (trend && trend.length > 0)) && (
          <section className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <TrendCard
              title="Spend trend"
              subtitle="Monthly gross spend"
              accent="var(--brand-accent)"
              points={trend}
              loading={trendLoading}
              variant="area"
              format={(n) => currency.format(n)}
              pick={(p) => p.spend}
            />
            <TrendCard
              title="Emissions trend"
              subtitle="Monthly CO₂ (tCO₂e)"
              accent="#10b981"
              points={trend}
              loading={trendLoading}
              variant="bar"
              format={(n) => `${compact.format(n)} t`}
              pick={(p) => p.emissions}
            />
          </section>
        )}

        {/* ── Quick access ─────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Jump back in
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <QuickCard
              icon={DollarSign}
              accent="from-brand-primary to-brand-accent"
              title="Spend"
              desc="Category, destination & year-over-year spend analysis."
              onClick={() => navigate("/spend-custom")}
            />
            <QuickCard
              icon={Leaf}
              accent="from-emerald-500 to-teal-500"
              title="Sustainability"
              desc="Emissions, carbon intensity & forecasting."
              onClick={() => navigate("/sustainability")}
            />
            <QuickCard
              icon={MessageCircle}
              accent="from-fuchsia-500 to-pink-500"
              title="Ask APEX"
              desc="Full conversational analytics with history."
              onClick={() => navigate("/genie-mcp")}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  meta,
  current,
  previous,
}: {
  meta: KpiMeta;
  current: number | null;
  previous: number | null;
}) {
  const Icon = meta.icon;
  const value = current != null ? meta.format(current) : "—";

  let deltaPct: number | null = null;
  if (current != null && previous != null && previous !== 0) {
    deltaPct = ((current - previous) / Math.abs(previous)) * 100;
  }

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br ${meta.accent} shadow-sm`}
        >
          <Icon size={17} className="text-white" />
        </div>
        <DeltaChip pct={deltaPct} goodDirection={meta.goodDirection} />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-0.5 text-[12.5px] font-medium text-slate-500">{meta.label}</div>
    </div>
  );
}

function DeltaChip({
  pct,
  goodDirection,
}: {
  pct: number | null;
  goodDirection: "up" | "down" | "neutral";
}) {
  if (pct == null || !isFinite(pct)) return null;
  const up = pct >= 0;
  const rounded = Math.abs(pct) < 0.1 ? "0" : Math.abs(pct).toFixed(0);

  let tone = "bg-slate-100 text-slate-600"; // neutral
  if (goodDirection !== "neutral") {
    const good = goodDirection === "up" ? up : !up;
    tone = good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600";
  }

  const Arrow = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      <Arrow size={12} />
      {rounded}%
    </span>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200" />
      <div className="mt-3 h-7 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-3.5 w-16 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

// ─── Trend card (inline SVG, no deps) ─────────────────────────────────────────

function monthLabel(m: string): string {
  // "2025-03" -> "Mar"
  const idx = Number(m.slice(5, 7)) - 1;
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return names[idx] ?? m;
}

function TrendCard({
  title,
  subtitle,
  accent,
  points,
  loading,
  variant,
  format,
  pick,
}: {
  title: string;
  subtitle: string;
  accent: string;
  points: TrendPoint[] | null;
  loading: boolean;
  variant: "area" | "bar";
  format: (n: number) => string;
  pick: (p: TrendPoint) => number | null;
}) {
  const data = (points ?? [])
    .map((p) => ({ label: monthLabel(p.month), value: pick(p) }))
    .filter((d) => d.value != null && isFinite(d.value as number)) as {
    label: string;
    value: number;
  }[];

  const latest = data.length ? data[data.length - 1].value : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[14px] font-semibold text-slate-900">{title}</div>
          <div className="text-[12px] text-slate-500">{subtitle}</div>
        </div>
        {latest != null && (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Latest</div>
            <div className="text-[15px] font-bold text-slate-800">{format(latest)}</div>
          </div>
        )}
      </div>

      <div className="mt-3 h-28">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />
        ) : data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-[12px] text-slate-400">
            Not enough data
          </div>
        ) : variant === "area" ? (
          <AreaChart data={data} accent={accent} />
        ) : (
          <BarChart data={data} accent={accent} />
        )}
      </div>

      {data.length >= 2 && (
        <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
          <span>{data[0].label}</span>
          <span>{data[data.length - 1].label}</span>
        </div>
      )}
    </div>
  );
}

const CHART_W = 320;
const CHART_H = 96;

function AreaChart({
  data,
  accent,
}: {
  data: { label: string; value: number }[];
  accent: string;
}) {
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * CHART_W;
  const y = (v: number) => CHART_H - ((v - min) / range) * (CHART_H - 8) - 4;

  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `0,${CHART_H} ${line} ${CHART_W},${CHART_H}`;
  const gid = `grad-${accent.replace("#", "")}`;

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline
        points={line}
        fill="none"
        stroke={accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={2} fill={accent} />
      ))}
    </svg>
  );
}

function BarChart({
  data,
  accent,
}: {
  data: { label: string; value: number }[];
  accent: string;
}) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const gap = 3;
  const bw = (CHART_W - gap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-full w-full">
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * (CHART_H - 6));
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={CHART_H - h}
            width={bw}
            height={h}
            rx={2}
            fill={accent}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

// ─── Quick-access card ────────────────────────────────────────────────────────

function QuickCard({
  icon: Icon,
  accent,
  title,
  desc,
  onClick,
}: {
  icon: LucideIcon;
  accent: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-primary-light hover:shadow-md"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${accent} shadow-sm`}
      >
        <Icon size={19} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-semibold text-slate-900">{title}</span>
          <ArrowRight
            size={14}
            className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-accent"
          />
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{desc}</p>
      </div>
    </button>
  );
}
