"use client";

import { X } from "lucide-react";
import PersonnelAvailabilityIcon from "./PersonnelAvailabilityIcon";
import type { PersonnelAvailability } from "./personnelAvailability";

type Props = {
  availability: PersonnelAvailability;
  title?: string;
  subtitle?: string;
  onClose: () => void;
};

export default function PersonnelAvailabilityModal({
  availability,
  title = "인원 현황",
  subtitle,
  onClose,
}: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.48)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 90,
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-scale-in"
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 18,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 28px 80px rgba(15,23,42,0.24)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#EFF6FF",
                  color: "#2563EB",
                  flexShrink: 0,
                }}
              >
                <PersonnelAvailabilityIcon size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "0.98rem",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {title}
                </p>
                {subtitle ? (
                  <p
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              display: "flex",
              padding: 6,
              borderRadius: 8,
              flexShrink: 0,
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            <div style={{ borderRadius: 14, padding: "12px 10px", background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: "0.68rem", color: "var(--text-tertiary)" }}>전체</p>
              <p style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", marginTop: 6 }}>{availability.totalMembers}명</p>
            </div>
            <div style={{ borderRadius: 14, padding: "12px 10px", background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <p style={{ fontSize: "0.68rem", color: "#B91C1C" }}>등록</p>
              <p style={{ fontSize: "1rem", fontWeight: 800, color: "#991B1B", marginTop: 6 }}>{availability.assignedMembers.length}명</p>
            </div>
            <div style={{ borderRadius: 14, padding: "12px 10px", background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
              <p style={{ fontSize: "0.68rem", color: "#2563EB" }}>남음</p>
              <p style={{ fontSize: "1rem", fontWeight: 800, color: "#1D4ED8", marginTop: 6 }}>{availability.remainingMembers.length}명</p>
            </div>
          </div>

          <div>
            <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              일정 등록 인원
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {availability.assignedMembers.length > 0 ? (
                availability.assignedMembers.map((name) => (
                  <span
                    key={name}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      background: "#FEF2F2",
                      color: "#B91C1C",
                      border: "1px solid #FECACA",
                    }}
                  >
                    {name}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: "0.74rem", color: "var(--text-tertiary)" }}>일정 등록 인원 없음</span>
              )}
            </div>
          </div>

          <div>
            <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              현재 남아있는 인원
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {availability.remainingMembers.length > 0 ? (
                availability.remainingMembers.map((name) => (
                  <span
                    key={name}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      background: "#EFF6FF",
                      color: "#2563EB",
                      border: "1px solid #BFDBFE",
                    }}
                  >
                    {name}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: "0.74rem", color: "var(--text-tertiary)" }}>남아있는 인원 없음</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
