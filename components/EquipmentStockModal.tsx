"use client";

import { X } from "lucide-react";
import EquipmentStatusIcon from "./EquipmentStatusIcon";
import type { EquipmentStock } from "./equipmentStock";

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

        <div style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
          <div>
            <p
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#4F46E5",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              트래커
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {stock.trackerRemaining.length > 0 ? (
                stock.trackerRemaining.map((item) => (
                  <span
                    key={item}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      background: "#EEF2FF",
                      color: "#4338CA",
                      border: "1px solid #C7D2FE",
                    }}
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: "0.74rem", color: "var(--text-tertiary)" }}>
                  남은 장비 없음
                </span>
              )}
            </div>
          </div>

          <div>
            <p
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#0F766E",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              노트북
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {stock.laptopRemaining.length > 0 ? (
                stock.laptopRemaining.map((item) => (
                  <span
                    key={item}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      background: "#ECFEFF",
                      color: "#0F766E",
                      border: "1px solid #99F6E4",
                    }}
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: "0.74rem", color: "var(--text-tertiary)" }}>
                  남은 장비 없음
                </span>
              )}
            </div>
          </div>

          <div>
            <p
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#B45309",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              타겟
            </p>
            <p
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#92400E",
                marginTop: 8,
              }}
            >
              {stock.targetRemaining}개 남음
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
