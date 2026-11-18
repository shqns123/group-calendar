"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  MAX_CATEGORY_NAME,
  MAX_EQUIPMENT_CATEGORIES,
  MAX_EQUIPMENT_ITEMS,
  MAX_ITEM_NAME,
  newEquipmentCategoryId,
  splitEquipmentList,
  type EquipmentCategory,
} from "@/lib/equipmentCategories";

type Props = {
  value: EquipmentCategory[];
  onChange: (next: EquipmentCategory[]) => void;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 9px",
  border: "1px solid var(--border)",
  borderRadius: 7,
  fontSize: "0.82rem",
  outline: "none",
  fontFamily: "inherit",
  color: "var(--text-primary)",
  background: "var(--surface)",
};

const iconButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  flexShrink: 0,
  border: "1px solid var(--border)",
  borderRadius: 7,
  background: "var(--surface)",
  cursor: "pointer",
  color: "var(--text-tertiary)",
};

/** Edits a group's equipment categories: add/rename/delete categories, add/delete items. */
export default function EquipmentCategoriesEditor({ value, onChange }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

  const update = (id: string, patch: Partial<EquipmentCategory>) => {
    onChange(value.map((category) => (category.id === id ? { ...category, ...patch } : category)));
  };

  const addItems = (category: EquipmentCategory) => {
    const draft = drafts[category.id] ?? "";
    const names = splitEquipmentList(draft).map((name) => name.slice(0, MAX_ITEM_NAME));
    if (names.length === 0) return;

    const taken = new Map<string, string>();
    for (const other of value) for (const item of other.items) taken.set(item, other.name);

    const added: string[] = [];
    const skipped: string[] = [];
    for (const name of names) {
      if (/^Target x\d+$/i.test(name) || taken.has(name) || added.includes(name)) {
        skipped.push(name);
        continue;
      }
      if (category.items.length + added.length >= MAX_EQUIPMENT_ITEMS) break;
      added.push(name);
    }

    if (added.length > 0) update(category.id, { items: [...category.items, ...added] });
    setDrafts((current) => ({ ...current, [category.id]: "" }));
    setMessages((current) => ({
      ...current,
      [category.id]:
        skipped.length > 0
          ? `${skipped.join(", ")}: 이미 있는 이름이라 빼고 추가했어요.`
          : "",
    }));
  };

  const addCategory = () => {
    if (value.length >= MAX_EQUIPMENT_CATEGORIES) return;
    const used = new Set(value.map((category) => category.name));
    let name = "새 분류";
    for (let n = 2; used.has(name); n += 1) name = `새 분류 ${n}`;
    onChange([...value, { id: newEquipmentCategoryId(), name, items: [] }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {value.length === 0 && (
        <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--text-tertiary)" }}>
          장비 분류가 없어요. 아래에서 분류를 추가해 주세요.
        </p>
      )}

      {value.map((category) => (
        <div
          key={category.id}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 9,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "var(--surface-raised)",
          }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="text"
              value={category.name}
              onChange={(e) => update(category.id, { name: e.target.value })}
              placeholder="분류 이름 (예: 트래커)"
              maxLength={MAX_CATEGORY_NAME}
              aria-label="장비 분류 이름"
              style={{ ...inputStyle, fontWeight: 600 }}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((other) => other.id !== category.id))}
              title="분류 삭제"
              aria-label={`${category.name || "이름 없는"} 분류 삭제`}
              style={{ ...iconButtonStyle, color: "#DC2626" }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select aria-label={`${category.name} 관리 방식`} value={category.quantity === undefined ? "items" : "quantity"} onChange={(e) => update(category.id, e.target.value === "quantity" ? { quantity: 0 } : { quantity: undefined })} style={{ ...inputStyle, width: "auto" }}>
              <option value="items">장비별 관리</option><option value="quantity">수량으로 관리</option>
            </select>
            {category.quantity !== undefined && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem", color: "var(--text-secondary)" }}>총 수량 <input aria-label={`${category.name} 총 수량`} type="number" min={0} max={100} value={category.quantity} onChange={(e) => update(category.id, { quantity: Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0))) })} style={{ ...inputStyle, width: 70, textAlign: "right" }} />개</label>}
          </div>
          {category.quantity === undefined && <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {category.items.length === 0 ? (
              <span style={{ fontSize: "0.74rem", color: "var(--text-tertiary)" }}>등록된 장비가 없어요.</span>
            ) : (
              category.items.map((item) => (
                <span
                  key={item}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                    borderRadius: 999,
                    padding: "3px 4px 3px 9px",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => update(category.id, { items: category.items.filter((other) => other !== item) })}
                    aria-label={`${item} 삭제`}
                    style={{ display: "flex", border: "none", background: "none", cursor: "pointer", padding: 2, color: "var(--text-tertiary)" }}
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </span>
              ))
            )}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={drafts[category.id] ?? ""}
              onChange={(e) => setDrafts((current) => ({ ...current, [category.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  addItems(category);
                }
              }}
              placeholder="장비 이름 (쉼표로 여러 개)"
              aria-label={`${category.name} 장비 추가`}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => addItems(category)}
              disabled={!(drafts[category.id] ?? "").trim()}
              style={{
                ...iconButtonStyle,
                width: "auto",
                padding: "0 10px",
                gap: 3,
                fontSize: "0.76rem",
                fontWeight: 600,
                color: "var(--accent)",
                fontFamily: "inherit",
                opacity: (drafts[category.id] ?? "").trim() ? 1 : 0.5,
              }}
            >
              <Plus style={{ width: 13, height: 13 }} />
              추가
            </button>
          </div>
          {messages[category.id] && (
            <p style={{ margin: 0, fontSize: "0.7rem", color: "#B45309" }}>{messages[category.id]}</p>
          )}
          </>}
        </div>
      ))}

      {value.length < MAX_EQUIPMENT_CATEGORIES && (
        <button
          type="button"
          onClick={addCategory}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "8px",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            background: "none",
            cursor: "pointer",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--accent)",
            fontFamily: "inherit",
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          분류 추가
        </button>
      )}
    </div>
  );
}
