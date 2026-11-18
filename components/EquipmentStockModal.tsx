"use client";

import { X } from "lucide-react";
import EquipmentStatusIcon from "./EquipmentStatusIcon";
import type { EquipmentStock } from "./equipmentStock";

const CATEGORY_TONES = [
  { label: "#4F46E5", bg: "#EEF2FF", fg: "#4338CA", border: "#C7D2FE" },
  { label: "#0F766E", bg: "#ECFEFF", fg: "#0F766E", border: "#99F6E4" },
  { label: "#BE185D", bg: "#FDF2F8", fg: "#BE185D", border: "#FBCFE8" },
  { label: "#15803D", bg: "#F0FDF4", fg: "#15803D", border: "#BBF7D0" },
  { label: "#7C3AED", bg: "#F5F3FF", fg: "#6D28D9", border: "#DDD6FE" },
] as const;

type Props = {
  stock: EquipmentStock;
  title?: string;
  subtitle?: string;
  onClose: () => void;
};

export default function EquipmentStockModal({
  stock,
  title = "장비 현황",
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
                  background: "#EEF2FF",
                  color: "#4338CA",
                  flexShrink: 0,
                }}
              >
                <EquipmentStatusIcon size={20} />
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

        <div style={{ padding: "18px 20px", display: "grid", gap: 14, maxHeight: "min(70vh, 560px)", overflowY: "auto" }}>
          {stock.categories.map((category, index) => {
            const tone = CATEGORY_TONES[index % CATEGORY_TONES.length];
            return (
              <div key={category.id}>
                <p
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: tone.label,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {category.name}
                  <span style={{ marginLeft: 6, fontWeight: 600, color: "var(--text-tertiary)" }}>
                    {category.quantityRemaining ?? category.remaining.length}/{category.total}
                  </span>
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {category.quantityRemaining !== undefined ? (
                    <span style={{ fontSize: "0.74rem", color: tone.fg, fontWeight: 600 }}>{category.quantityRemaining}개 남음</span>
                  ) : category.remaining.length > 0 ? (
                    category.remaining.map((item) => (
                      <span
                        key={item}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 999,
                          padding: "5px 10px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          background: tone.bg,
                          color: tone.fg,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: "0.74rem", color: "var(--text-tertiary)" }}>
                      {category.total > 0 ? "남은 장비 없음" : "등록된 장비 없음"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}


        </div>
      </div>
    </div>
  );
}
