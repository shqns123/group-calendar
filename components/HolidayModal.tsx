"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, CalendarX2, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export type CustomHoliday = {
  id: string;
  date: string;
  name: string;
  type: "holiday" | "workday";
};

type Props = {
  onClose: () => void;
  onChanged: () => void;
};

export default function HolidayModal({ onClose, onChanged }: Props) {
  const [holidays, setHolidays] = useState<CustomHoliday[]>([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [name, setName] = useState("");
  const [type, setType] = useState<"holiday" | "workday">("holiday");
  const [adding, setAdding] = useState(false);

  const fetchHolidays = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/holidays");
    if (res.ok) setHolidays(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchHolidays(); }, []);

  const handleAdd = async () => {
    if (!date) return;
    const finalName = name.trim() || (type === "holiday" ? "회사 휴일" : "대체 근무일");
    setAdding(true);
    await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, name: finalName, type }),
    });
    setAdding(false);
    setName("");
    await fetchHolidays();
    onChanged();
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/admin/holidays", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchHolidays();
    onChanged();
  };

  const grouped = holidays.reduce<{ holiday: CustomHoliday[]; workday: CustomHoliday[] }>(
    (acc, h) => { acc[h.type as "holiday" | "workday"].push(h); return acc; },
    { holiday: [], workday: [] }
  );

  const formatDate = (d: string) => {
    try { return format(new Date(d + "T00:00:00"), "yyyy년 M월 d일 (E)", { locale: ko }); }
    catch { return d; }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="modal-scale-in"
        style={{
          background: "var(--surface)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 460,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>회사 휴일 설정</p>
            <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginTop: 2 }}>전체 그룹에 공통 적용됩니다</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-tertiary)", display: "flex" }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* 추가 폼 */}
          <div style={{ background: "var(--surface-raised)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 날짜 */}
            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginBottom: 6 }}>날짜</p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  padding: "7px 12px", borderRadius: 7,
                  border: "1px solid var(--border)",
                  background: "var(--surface)", color: "var(--text-primary)",
                  fontSize: "0.875rem", fontFamily: "inherit", outline: "none",
                }}
              />
            </div>

            {/* 구분 */}
            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginBottom: 6 }}>구분</p>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { value: "holiday", label: "회사 휴일", desc: "평일 → 휴일", icon: CalendarX2, color: "#EF4444", bg: "#FEF2F2", border: "#FECACA" },
                  { value: "workday", label: "대체 근무일", desc: "휴일 → 평일", icon: Briefcase, color: "var(--accent)", bg: "var(--accent-light)", border: "var(--accent-muted)" },
                ] as const).map(({ value, label, desc, icon: Icon, color, bg, border }) => (
                  <button
                    key={value}
                    onClick={() => setType(value)}
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: 8,
                      border: `1.5px solid ${type === value ? border : "var(--border)"}`,
                      background: type === value ? bg : "transparent",
                      cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Icon style={{ width: 13, height: 13, color: type === value ? color : "var(--text-tertiary)" }} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: type === value ? color : "var(--text-primary)" }}>{label}</span>
                    </div>
                    <p style={{ fontSize: "0.68rem", color: type === value ? color : "var(--text-tertiary)" }}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 이름 (선택) */}
            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", marginBottom: 6 }}>
                이름 <span style={{ opacity: 0.6 }}>(선택)</span>
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder={type === "holiday" ? "회사 휴일" : "대체 근무일"}
                maxLength={30}
                style={{
                  width: "100%", padding: "8px 12px",
                  border: "1px solid var(--border)", borderRadius: 8,
                  background: "var(--surface)", color: "var(--text-primary)",
                  fontSize: "0.875rem", fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={adding || !date}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 16px", borderRadius: 8, border: "none",
                background: "var(--accent)", color: "#fff",
                fontSize: "0.825rem", fontWeight: 600,
                cursor: (adding || !date) ? "not-allowed" : "pointer",
                opacity: (adding || !date) ? 0.5 : 1,
                fontFamily: "inherit",
              }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              {adding ? "변경 중..." : "변경"}
            </button>
          </div>

          {/* 목록 */}
          {loading ? (
            <p style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>불러오는 중...</p>
          ) : holidays.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-tertiary)" }}>
              <CalendarX2 style={{ width: 28, height: 28, opacity: 0.3, margin: "0 auto 8px" }} />
              <p style={{ fontSize: "0.825rem" }}>등록된 항목이 없습니다</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {grouped.holiday.length > 0 && (
                <div>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#EF4444", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                    <CalendarX2 style={{ width: 12, height: 12 }} /> 회사 휴일
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {grouped.holiday.map((h) => (
                      <HolidayRow key={h.id} holiday={h} label={formatDate(h.date)} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}
              {grouped.workday.length > 0 && (
                <div>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                    <Briefcase style={{ width: 12, height: 12 }} /> 대체 근무일
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {grouped.workday.map((h) => (
                      <HolidayRow key={h.id} holiday={h} label={formatDate(h.date)} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HolidayRow({ holiday, label, onDelete }: { holiday: CustomHoliday; label: string; onDelete: (id: string) => void }) {
  const isHoliday = holiday.type === "holiday";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 9,
      border: `1px solid ${isHoliday ? "#FECACA" : "var(--accent-muted)"}`,
      background: isHoliday ? "#FEF2F2" : "var(--accent-light)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "0.825rem", fontWeight: 600, color: isHoliday ? "#EF4444" : "var(--accent)" }}>
          {holiday.name}
        </p>
        <p style={{ fontSize: "0.7rem", color: isHoliday ? "#F87171" : "var(--accent)", marginTop: 1, opacity: 0.8 }}>
          {label}
        </p>
      </div>
      <button
        onClick={() => onDelete(holiday.id)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: isHoliday ? "#EF4444" : "var(--accent)", display: "flex", opacity: 0.7 }}
      >
        <Trash2 style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
