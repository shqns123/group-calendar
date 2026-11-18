// Group equipment categories (장비 분류): user-defined lists of named items.
// Stored as JSON on Group.equipmentCategories. Groups saved before categories existed
// keep their items in trackerOptions / laptopOptions, read here as two categories.
// Events still store picks by item name ("T-01, N-02, Target x1"); a name listed in two
// categories counts as one item. 타겟 stays a separate quantity (Group.targetCount).

export type EquipmentCategory = { id: string; name: string; items: string[]; quantity?: number; aliases?: string[] };

export type EquipmentCategorySource = {
  equipmentCategories?: string | null;
  trackerOptions?: string | null;
  laptopOptions?: string | null;
  targetCount?: number;
};

export const MAX_EQUIPMENT_CATEGORIES = 20;
export const MAX_EQUIPMENT_ITEMS = 100;
export const MAX_CATEGORY_NAME = 20;
export const MAX_ITEM_NAME = 30;

const TARGET_TOKEN = /^Target x\d+$/i;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export function splitEquipmentList(raw?: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function newEquipmentCategoryId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** The two categories every group had before they became editable. */
export function legacyEquipmentCategories(source: EquipmentCategorySource): EquipmentCategory[] {
  return [
    { id: "tracker", name: "트래커", items: splitEquipmentList(source.trackerOptions) },
    { id: "laptop", name: "노트북", items: splitEquipmentList(source.laptopOptions) },
  ];
}

/**
 * Cleans a category list: trims names, splits items on commas/newlines (events use commas),
 * drops empty items, repeats within a category and the reserved "Target xN" token.
 * Names repeated across categories are kept: old groups have them, and dropping them would lose data.
 * Throws an Error with a Korean message when a category name is empty or repeated.
 */
export function sanitizeEquipmentCategories(input: unknown): EquipmentCategory[] {
  if (!Array.isArray(input)) throw new Error("장비 분류 형식이 올바르지 않아요.");
  if (input.length > MAX_EQUIPMENT_CATEGORIES) {
    throw new Error(`장비 분류는 ${MAX_EQUIPMENT_CATEGORIES}개까지 만들 수 있어요.`);
  }

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: EquipmentCategory[] = [];

  for (const raw of input) {
    const value = (raw ?? {}) as { id?: unknown; name?: unknown; items?: unknown; quantity?: unknown; aliases?: unknown };
    const name = String(value.name ?? "").trim().slice(0, MAX_CATEGORY_NAME);
    if (!name) throw new Error("장비 분류 이름을 입력해 주세요.");
    if (/[\n,]/.test(name)) throw new Error("장비 분류 이름에는 쉼표나 줄바꿈을 사용할 수 없어요.");
    if (seenNames.has(name)) throw new Error(`'${name}' 분류가 이미 있어요.`);
    seenNames.add(name);

    let id = typeof value.id === "string" && ID_PATTERN.test(value.id) ? value.id : "";
    if (!id || id === "orphan" || seenIds.has(id)) id = newEquipmentCategoryId();
    while (seenIds.has(id)) id = newEquipmentCategoryId();
    seenIds.add(id);

    const rawItems = Array.isArray(value.items) ? value.items : [];
    const items: string[] = [];
    const seenItems = new Set<string>();
    for (const item of rawItems.flatMap((entry) => splitEquipmentList(String(entry ?? "")))) {
      const label = item.slice(0, MAX_ITEM_NAME);
      if (TARGET_TOKEN.test(label) || seenItems.has(label)) continue;
      if (items.length >= MAX_EQUIPMENT_ITEMS) break;
      seenItems.add(label);
      items.push(label);
    }

    const quantity = value.quantity === undefined ? undefined : Math.max(0, Math.min(100, Math.floor(Number(value.quantity) || 0)));
    const aliases = Array.isArray(value.aliases) ? value.aliases.filter((alias): alias is string => typeof alias === "string" && !!alias.trim() && !/[\n,]/.test(alias)).map((alias) => alias.trim().slice(0, MAX_CATEGORY_NAME)) : [];
    result.push(quantity === undefined ? { id, name, items } : { id, name, items: [], quantity, ...(aliases.length ? { aliases: [...new Set(aliases)] } : {}) });
  }

  const quantityNames = new Map<string, string>();
  for (const category of result) {
    if (category.quantity === undefined) continue;
    for (const label of new Set([category.id === "target" ? "Target" : category.name, ...(category.aliases ?? [])])) {
      const owner = quantityNames.get(label);
      if (owner && owner !== category.id) throw new Error(`'${label}'은 다른 수량 분류에서 사용한 이름이에요.`);
      quantityNames.set(label, category.id);
    }
  }
  return result;
}

/** The group's categories: the saved list, or the old tracker/laptop lists. */
export function readEquipmentCategories(source: EquipmentCategorySource | null | undefined): EquipmentCategory[] {
  if (!source) return [];
  let categories: EquipmentCategory[];
  try {
    categories = source.equipmentCategories ? sanitizeEquipmentCategories(JSON.parse(source.equipmentCategories)) : legacyEquipmentCategories(source);
  } catch {
    categories = legacyEquipmentCategories(source);
  }
  // Existing groups retain their old target stock until the settings are saved.
  if ((source.targetCount ?? 2) > 0 && !categories.some((category) => category.id === "target")) {
    const name = categories.some((category) => category.name === "타겟") ? "기존 타겟" : "타겟";
    categories.push({ id: "target", name, items: [], quantity: source.targetCount ?? 2 });
  }
  return categories;
}

/**
 * Old app builds only read trackerOptions / laptopOptions. Keep them filled so every item
 * still counts there: the first category as 트래커, the rest as 노트북.
 */
export function legacyEquipmentMirror(categories: EquipmentCategory[]) {
  const [first, ...rest] = categories;
  const trackerOptions = first?.items.join(", ") ?? "";
  const laptopOptions = rest.flatMap((category) => category.items).join(", ");
  return { trackerOptions: trackerOptions || null, laptopOptions: laptopOptions || null };
}
