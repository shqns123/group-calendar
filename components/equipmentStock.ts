"use client";

import { readEquipmentCategories, type EquipmentCategorySource } from "@/lib/equipmentCategories";

export type EquipmentGroup = EquipmentCategorySource & {
  targetCount?: number;
};

export type EquipmentCategoryStock = {
  id: string;
  name: string;
  total: number;
  remaining: string[];
  quantityRemaining?: number;
};

export type EquipmentStock = {
  categories: EquipmentCategoryStock[];
  targetRemaining: number;
  targetTotal: number;
  hasConfiguredEquipment: boolean;
};

export function parseEquipmentAllocation(raw?: string | null) {
  if (!raw) {
    return { items: [] as string[], targetCount: 0 };
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .reduce(
      (acc, token) => {
        const targetMatch = /^Target x(\d+)$/i.exec(token);
        if (targetMatch) {
          acc.targetCount += Number(targetMatch[1]) || 0;
          return acc;
        }
        acc.items.push(token);
        return acc;
      },
      { items: [] as string[], targetCount: 0 }
    );
}

export function getEquipmentStock(
  group: EquipmentGroup | null,
  events: Array<{ equipment?: string | null }>
) {
  if (!group) return null;

  const categories = readEquipmentCategories(group);
  const used = new Set<string>();
  const quantities = new Map<string, number>();
  for (const event of events) {
    for (const token of (event.equipment ?? "").split(",").map((part) => part.trim()).filter(Boolean)) {
      const match = /^(.*) x(\d+)$/i.exec(token);
      if (match && categories.some((category) => category.quantity !== undefined && [category.id === "target" ? "Target" : category.name, ...(category.aliases ?? [])].includes(match[1]))) quantities.set(match[1], (quantities.get(match[1]) ?? 0) + Number(match[2]));
      else used.add(token);
    }
  }
  return {
    categories: categories.map((category) => ({
      id: category.id, name: category.name,
      total: category.quantity ?? category.items.length,
      remaining: category.items.filter((item) => !used.has(item)),
      quantityRemaining: category.quantity === undefined ? undefined : Math.max(0, category.quantity - [category.id === "target" ? "Target" : category.name, ...(category.aliases ?? [])].reduce((sum, name) => sum + (quantities.get(name) ?? 0), 0)),
    })),
    targetRemaining: 0, targetTotal: 0,
    hasConfiguredEquipment: categories.some((category) => (category.quantity ?? category.items.length) > 0),
  } satisfies EquipmentStock;
}
