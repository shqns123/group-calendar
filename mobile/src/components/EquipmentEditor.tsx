// Group settings › 장비: add/rename/delete categories and the items inside each one.

import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { MiniButton } from "@/components/list";
import { SecondaryButton, T } from "@/components/ui";
import { confirm } from "@/lib/confirm";
import {
  MAX_CATEGORY_NAME,
  MAX_EQUIPMENT_CATEGORIES,
  MAX_EQUIPMENT_ITEMS,
  MAX_ITEM_NAME,
  newEquipmentCategoryId,
  splitEquipmentList,
  type EquipmentCategory,
} from "@/lib/equipment";
import { useTheme } from "@/theme/ThemeProvider";
import { HIT, radius, type } from "@/theme/tokens";

export function EquipmentEditor({ value, onChange }: { value: EquipmentCategory[]; onChange: (next: EquipmentCategory[]) => void }) {
  const { c } = useTheme();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

  const update = (id: string, patch: Partial<EquipmentCategory>) =>
    onChange(value.map((cat) => (cat.id === id ? { ...cat, ...patch } : cat)));

  function addItems(cat: EquipmentCategory) {
    const names = splitEquipmentList(drafts[cat.id]).map((n) => n.slice(0, MAX_ITEM_NAME));
    if (!names.length) return;
    const taken = new Set(value.flatMap((other) => other.items));
    const added: string[] = [];
    const skipped: string[] = [];
    for (const n of names) {
      if (/^Target x\d+$/i.test(n) || taken.has(n) || added.includes(n)) skipped.push(n);
      else if (cat.items.length + added.length < MAX_EQUIPMENT_ITEMS) added.push(n);
    }
    if (added.length) update(cat.id, { items: [...cat.items, ...added] });
    setDrafts((d) => ({ ...d, [cat.id]: "" }));
    setMessages((m) => ({ ...m, [cat.id]: skipped.length ? `${skipped.join(", ")}: 이미 있는 이름이라 빼고 추가했어요.` : "" }));
  }

  async function removeCategory(cat: EquipmentCategory) {
    if (cat.items.length) {
      const ok = await confirm("분류 삭제", `${cat.name ? `'${cat.name}' 분류` : "이 분류"}와 장비 ${cat.items.length}개를 지울까요? 저장을 눌러야 반영돼요.`, "삭제", true);
      if (!ok) return;
    }
    onChange(value.filter((other) => other.id !== cat.id));
  }

  function addCategory() {
    const used = new Set(value.map((cat) => cat.name));
    let name = "새 분류";
    for (let n = 2; used.has(name); n++) name = `새 분류 ${n}`;
    onChange([...value, { id: newEquipmentCategoryId(), name, items: [] }]);
  }

  const input = {
    ...type.body,
    color: c.text,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    backgroundColor: c.subtle,
  } as const;

  return (
    <View style={{ gap: 10 }}>
      <T variant="footnote" color={c.text2}>
        장비
      </T>
      {value.length === 0 ? (
        <T variant="subhead" color={c.muted}>
          장비 분류가 없어요. 아래에서 분류를 추가해 주세요.
        </T>
      ) : null}
      {value.map((cat) => (
        <View key={cat.id} style={{ backgroundColor: c.card, borderRadius: radius.card, padding: 12, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              accessibilityLabel="분류 이름"
              value={cat.name}
              onChangeText={(name) => update(cat.id, { name })}
              placeholder="분류 이름 (예: 트래커)"
              placeholderTextColor={c.muted}
              maxLength={MAX_CATEGORY_NAME}
              style={[input, { flex: 1, fontWeight: "600" }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${cat.name || "이름 없는"} 분류 삭제`}
              onPress={() => void removeCategory(cat)}
              style={({ pressed }) => ({ width: HIT, height: HIT, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.fill : "transparent" })}
            >
              <Icon name="trash" size={22} color={c.danger} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MiniButton label={cat.quantity === undefined ? "장비별 관리" : "수량으로 관리"} onPress={() => update(cat.id, { quantity: cat.quantity === undefined ? 0 : undefined })} />
            {cat.quantity !== undefined ? <TextInput accessibilityLabel={`${cat.name} 총 수량`} keyboardType="number-pad" value={String(cat.quantity)} onChangeText={(v) => update(cat.id, { quantity: Math.min(100, Number(v.replace(/[^0-9]/g, "")) || 0) })} style={[input, { width: 80, textAlign: "right" }]} /> : null}
            {cat.quantity !== undefined ? <T variant="subhead">개</T> : null}
          </View>
          {cat.quantity === undefined ? <>
          {cat.items.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {cat.items.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`${item} 삭제`}
                  onPress={() => update(cat.id, { items: cat.items.filter((other) => other !== item) })}
                  style={({ pressed }) => ({
                    minHeight: 36,
                    paddingLeft: 12,
                    paddingRight: 8,
                    borderRadius: radius.pill,
                    backgroundColor: pressed ? c.fill : c.subtle,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  })}
                >
                  <T variant="subhead" style={{ fontWeight: "600" }}>
                    {item}
                  </T>
                  <Icon name="close" size={16} color={c.muted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <T variant="subhead" color={c.muted}>
              등록된 장비가 없어요.
            </T>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              accessibilityLabel={`${cat.name} 장비 추가`}
              value={drafts[cat.id] ?? ""}
              onChangeText={(t) => setDrafts((d) => ({ ...d, [cat.id]: t }))}
              onSubmitEditing={() => addItems(cat)}
              submitBehavior="submit"
              returnKeyType="done"
              placeholder="장비 이름 (쉼표로 여러 개)"
              placeholderTextColor={c.muted}
              style={[input, { flex: 1 }]}
            />
            <MiniButton label="추가" disabled={!(drafts[cat.id] ?? "").trim()} onPress={() => addItems(cat)} />
          </View>
          {messages[cat.id] ? (
            <T variant="footnote" color={c.danger} style={{ fontWeight: "400" }}>
              {messages[cat.id]}
            </T>
          ) : null}
          </> : null}
        </View>
      ))}
      {value.length < MAX_EQUIPMENT_CATEGORIES ? <SecondaryButton label="분류 추가" icon="add" onPress={addCategory} /> : null}
    </View>
  );
}
