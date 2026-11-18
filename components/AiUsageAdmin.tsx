"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";

type Series = { calls: number[]; cost: number[] };
type UsageUser = {
  id: string;
  name: string | null;
  email: string | null;
  isOperator: boolean;
  deleted: boolean;
  monthCalls: number;
  monthCost: number;
  totalCalls: number;
  totalCost: number;
  customLimit: number | null;
  limit: number;
};
type UsageData = {
  month: string;
  defaultLimit: number;
  days: string[];
  series: Series;
  perUser: Record<string, Series>;
  users: UsageUser[];
};

const RANGES = [7, 30, 90, 180];
// Validated pair (light surface): slot 1 blue = everyone, slot 2 orange = the picked user.
const ALL_COLOR = "#2a78d6";
const USER_COLOR = "#eb6834";

const nameOf = (u: UsageUser) => (u.deleted ? "삭제된 사용자" : u.name?.trim() || u.email?.split("@")[0] || "이름 없음");

function usd(v: number) {
  if (v === 0) return "$0";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 100) return `$${v.toFixed(2)}`;
  return `$${Math.round(v).toLocaleString()}`;
}
const calls = (v: number) => `${v.toLocaleString()}회`;
const shortDay = (k: string) => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`;

export default function AiUsageAdmin() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const load = useCallback(async (range: number) => {
    setError("");
    try {
      const res = await fetch(`/api/admin/ai-usage?days=${range}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `불러오지 못했어요 (${res.status})`);
      setData(json as UsageData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요");
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const users = useMemo(
    () => [...(data?.users ?? [])].sort((a, b) => b.monthCalls - a.monthCalls || b.totalCalls - a.totalCalls || nameOf(a).localeCompare(nameOf(b))),
    [data],
  );
  const pickedUser = users.find((u) => u.id === picked) ?? null;
  const monthCalls = users.reduce((s, u) => s + u.monthCalls, 0);
  const monthCost = users.reduce((s, u) => s + u.monthCost, 0);
  const atCap = users.filter((u) => !u.deleted && u.monthCalls >= u.limit).length;

  const chartSeries = (key: keyof Series) => {
    if (!data) return [];
    const list = [{ name: "전체", color: ALL_COLOR, values: data.series[key] }];
    if (pickedUser) {
      list.push({ name: nameOf(pickedUser), color: USER_COLOR, values: data.perUser[pickedUser.id]?.[key] ?? data.days.map(() => 0) });
    }
    return list;
  };

  const onLimitSaved = (id: string, customLimit: number | null, limit: number) =>
    setData((d) => (d ? { ...d, users: d.users.map((u) => (u.id === id ? { ...u, customLimit, limit } : u)) } : d));

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)", fontSize: "0.8rem", textDecoration: "none" }}>
            <ArrowLeft style={{ width: 14, height: 14 }} />
            캘린더로
          </Link>
          <h1 style={{ fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
            <Sparkles style={{ width: 16, height: 16, color: "var(--accent)" }} />
            AI 사용량
          </h1>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }} role="group" aria-label="기간">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                aria-pressed={days === r}
                style={{
                  padding: "5px 10px",
                  borderRadius: 7,
                  border: `1px solid ${days === r ? "var(--accent)" : "var(--border)"}`,
                  background: days === r ? "var(--accent-light)" : "var(--surface)",
                  color: days === r ? "var(--accent-hover)" : "var(--text-secondary)",
                  fontSize: "0.75rem",
                  fontWeight: days === r ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {r}일
              </button>
            ))}
          </div>
        </header>

        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0 }}>
          AI 빠른 추가가 OpenRouter를 부른 횟수와 비용이에요. 한도는 사용자별 <b>한 달(서울 기준 1일~말일)</b> 호출 수이고,
          한도에 닿으면 AI 없이 기본 해석으로 추가돼요.
        </p>

        {error && <Box><p style={{ color: "#b91c1c", fontSize: "0.82rem", margin: 0 }}>{error}</p></Box>}
        {!data && !error && <Box><p style={{ color: "var(--text-tertiary)", fontSize: "0.82rem", margin: 0 }}>불러오는 중이에요…</p></Box>}

        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              <Stat label={`${data.month} 호출`} value={calls(monthCalls)} />
              <Stat label={`${data.month} 비용`} value={usd(monthCost)} />
              <Stat label="기본 월 한도" value={calls(data.defaultLimit)} />
              <Stat label="한도에 닿은 사용자" value={`${atCap}명`} />
            </div>

            <Box>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>일별 추이</span>
                <select
                  value={picked ?? ""}
                  onChange={(e) => setPicked(e.target.value || null)}
                  aria-label="비교할 사용자"
                  style={{ marginLeft: "auto", padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", fontSize: "0.78rem", fontFamily: "inherit", color: "var(--text-primary)", maxWidth: "100%" }}
                >
                  <option value="">전체만 보기</option>
                  {users.filter((u) => u.totalCalls > 0 || !u.deleted).map((u) => (
                    <option key={u.id} value={u.id}>
                      {nameOf(u)}
                      {u.email ? ` (${u.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                <LineChart title="호출 수" days={data.days} series={chartSeries("calls")} format={calls} integer />
                <LineChart title="비용 (USD)" days={data.days} series={chartSeries("cost")} format={usd} />
              </div>
              <DailyTable days={data.days} all={data.series} user={pickedUser ? { name: nameOf(pickedUser), s: data.perUser[pickedUser.id] } : null} />
            </Box>

            <Box pad={0}>
              <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>사용자별</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>줄을 누르면 위 그래프에서 비교해요</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", minWidth: 720 }}>
                  <thead>
                    <tr style={{ color: "var(--text-tertiary)", textAlign: "left" }}>
                      <Th>사용자</Th>
                      <Th right>이번 달 호출</Th>
                      <Th right>이번 달 비용</Th>
                      <Th right>누적 호출</Th>
                      <Th right>누적 비용</Th>
                      <Th>월 한도</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <UserRow key={u.id} user={u} picked={u.id === picked} defaultLimit={data.defaultLimit} onPick={() => setPicked(u.id === picked ? null : u.id)} onSaved={onLimitSaved} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          </>
        )}
      </div>
    </main>
  );
}

function Box({ children, pad = 14 }: { children: React.ReactNode; pad?: number }) {
  return <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: pad }}>{children}</section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ padding: "8px 14px", fontWeight: 600, textAlign: right ? "right" : "left", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{children}</th>;
}

function UserRow({ user, picked, defaultLimit, onPick, onSaved }: {
  user: UsageUser;
  picked: boolean;
  defaultLimit: number;
  onPick: () => void;
  onSaved: (id: string, customLimit: number | null, limit: number) => void;
}) {
  const [draft, setDraft] = useState(String(user.limit));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [lastLimit, setLastLimit] = useState(user.limit);
  if (lastLimit !== user.limit) {
    setLastLimit(user.limit);
    setDraft(String(user.limit));
  }

  const save = async (value: number | null) => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/ai-usage/limits/${encodeURIComponent(user.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit: value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "저장하지 못했어요");
      onSaved(user.id, json.customLimit, json.limit);
      setMsg("저장했어요");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장하지 못했어요");
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    const n = Number(draft.trim());
    if (!draft.trim() || !Number.isInteger(n) || n < 0) {
      setMsg("0 이상의 정수로 적어 주세요");
      return;
    }
    void save(n);
  };

  const ratio = user.limit > 0 ? Math.min(1, user.monthCalls / user.limit) : 1;
  const full = user.monthCalls >= user.limit;
  const changed = draft.trim() !== String(user.limit);

  return (
    <tr
      onClick={onPick}
      style={{ cursor: "pointer", background: picked ? "rgba(235,104,52,0.08)" : undefined, borderBottom: "1px solid var(--border-subtle)" }}
    >
      <td style={{ padding: "9px 14px", minWidth: 180 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {picked && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: USER_COLOR, flexShrink: 0 }} />}
          <span style={{ fontWeight: 600, color: user.deleted ? "var(--text-tertiary)" : "var(--text-primary)" }}>{nameOf(user)}</span>
          {user.isOperator && <span style={{ fontSize: "0.65rem", color: "var(--accent-hover)", background: "var(--accent-light)", borderRadius: 4, padding: "1px 5px" }}>운영자</span>}
        </div>
        {user.email && <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{user.email}</div>}
      </td>
      <td style={{ padding: "9px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 600, color: full ? "#b91c1c" : "var(--text-primary)" }}>
          {user.monthCalls.toLocaleString()} / {user.limit.toLocaleString()}
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "var(--border)", marginTop: 4, marginLeft: "auto", width: 90, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${ratio * 100}%`, background: full ? "#dc2626" : "var(--accent)", borderRadius: 2 }} />
        </div>
      </td>
      <td style={{ padding: "9px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(user.monthCost)}</td>
      <td style={{ padding: "9px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{user.totalCalls.toLocaleString()}</td>
      <td style={{ padding: "9px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(user.totalCost)}</td>
      <td style={{ padding: "9px 14px", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
        {user.deleted ? (
          <span style={{ color: "var(--text-tertiary)" }}>-</span>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={`${nameOf(user)} 월 한도`}
              style={{ width: 72, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", fontSize: "0.78rem", fontFamily: "inherit", textAlign: "right" }}
            />
            <button
              type="submit"
              disabled={saving || !changed}
              style={{ padding: "4px 9px", borderRadius: 6, border: "none", background: changed ? "var(--accent)" : "var(--border)", color: changed ? "#fff" : "var(--text-tertiary)", fontSize: "0.72rem", fontWeight: 600, cursor: changed ? "pointer" : "default", fontFamily: "inherit" }}
            >
              저장
            </button>
            {user.customLimit !== null ? (
              <button
                type="button"
                onClick={() => void save(null)}
                disabled={saving}
                title={`기본값(${defaultLimit}회)으로`}
                aria-label={`기본값(${defaultLimit}회)으로 되돌리기`}
                style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)", fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                <RotateCcw style={{ width: 11, height: 11 }} />
                기본
              </button>
            ) : (
              <span style={{ fontSize: "0.68rem", color: "var(--text-tertiary)" }}>기본값</span>
            )}
            {msg && <span style={{ fontSize: "0.68rem", color: msg === "저장했어요" ? "#15803d" : "#b91c1c" }}>{msg}</span>}
          </form>
        )}
      </td>
    </tr>
  );
}

function DailyTable({ days, all, user }: { days: string[]; all: Series; user: { name: string; s: Series | undefined } | null }) {
  return (
    <details style={{ marginTop: 10 }}>
      <summary style={{ fontSize: "0.74rem", color: "var(--text-secondary)", cursor: "pointer" }}>표로 보기</summary>
      <div style={{ maxHeight: 260, overflow: "auto", marginTop: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ color: "var(--text-tertiary)" }}>
              <th style={{ textAlign: "left", padding: "4px 8px" }}>날짜</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>전체 호출</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>전체 비용</th>
              {user && <th style={{ textAlign: "right", padding: "4px 8px" }}>{user.name} 호출</th>}
              {user && <th style={{ textAlign: "right", padding: "4px 8px" }}>{user.name} 비용</th>}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "4px 8px" }}>{d}</td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>{all.calls[i]}</td>
                <td style={{ textAlign: "right", padding: "4px 8px" }}>{usd(all.cost[i])}</td>
                {user && <td style={{ textAlign: "right", padding: "4px 8px" }}>{user.s?.calls[i] ?? 0}</td>}
                {user && <td style={{ textAlign: "right", padding: "4px 8px" }}>{usd(user.s?.cost[i] ?? 0)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------- Line chart (plain SVG, one y-axis, crosshair + tooltip) ----------

type LineSeries = { name: string; color: string; values: number[] };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function LineChart({ title, days, series, format, integer }: {
  title: string;
  days: string[];
  series: LineSeries[];
  format: (v: number) => string;
  /** Counts: keep the middle tick a whole number. */
  integer?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 190;
  const pad = { l: 52, r: 14, t: 10, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const top = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const max = integer ? Math.max(2, Math.ceil(top / 2) * 2) : top;
  const n = days.length;
  const x = (i: number) => pad.l + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => pad.t + h - (v / max) * h;
  const ticks = [0, max / 2, max];
  const xLabels = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - pad.l) / w) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover) + 10, 0), width - 150);

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: "0.76rem", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
        {series.length > 1 &&
          series.map((s) => (
            <span key={s.name} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
              <span aria-hidden style={{ width: 12, height: 2, borderRadius: 1, background: s.color }} />
              {s.name}
            </span>
          ))}
      </figcaption>
      <div ref={box} style={{ position: "relative", width: "100%" }}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title} 일별 추이`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          style={{ display: "block", touchAction: "pan-y" }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="#E2E8F0" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="#94A3B8">
                {format(t)}
              </text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={10} fill="#94A3B8">
              {shortDay(days[i])}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="#94A3B8" strokeWidth={1} strokeDasharray="3 3" />}
          {series.map((s) => (
            <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null &&
            series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
            ))}
        </svg>
        {hover !== null && (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: tipLeft,
              pointerEvents: "none",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
              padding: "6px 8px",
              fontSize: "0.72rem",
              minWidth: 120,
            }}
          >
            <div style={{ color: "var(--text-tertiary)", marginBottom: 2 }}>{days[hover]}</div>
            {series.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: s.color }} />
                <span style={{ color: "var(--text-secondary)", flex: 1 }}>{s.name}</span>
                <span style={{ fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{format(s.values[hover] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
