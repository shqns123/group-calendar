"use client";

export type EquipmentGroup = {
  trackerOptions?: string | null;
  laptopOptions?: string | null;
  targetCount?: number;
};

export type EquipmentStock = {
  trackerRemaining: string[];
  laptopRemaining: string[];
  targetRemaining: number;
  hasConfiguredEquipment: boolean;
};

export function parseEquipmentOptions(raw?: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

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

  const trackerOptions = parseEquipmentOptions(group.trackerOptions);
  const laptopOptions = parseEquipmentOptions(group.laptopOptions);
  const targetTotal = Math.max(0, group.targetCount ?? 2);
  const trackerUsed = new Set<string>();
  const laptopUsed = new Set<string>();
  let targetUsed = 0;

  for (const event of events) {
    const allocation = parseEquipmentAllocation(event.equipment);
    targetUsed += allocation.targetCount;

    for (const item of allocation.items) {
      if (trackerOptions.includes(item)) {
        trackerUsed.add(item);
      } else if (laptopOptions.includes(item)) {
        laptopUsed.add(item);
      }
    }
  }

  return {
    trackerRemaining: trackerOptions.filter((item) => !trackerUsed.has(item)),
    laptopRemaining: laptopOptions.filter((item) => !laptopUsed.has(item)),
    targetRemaining: Math.max(0, targetTotal - targetUsed),
    hasConfiguredEquipment:
      trackerOptions.length > 0 || laptopOptions.length > 0 || targetTotal > 0,
  } satisfies EquipmentStock;
}
