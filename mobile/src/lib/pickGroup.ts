import type { SheetOption } from "@/components/ActionSheet";
import type { Group } from "./types";

/** Options for the group chooser sheet (works for any number of groups). */
export function groupOptions(groups: Group[], currentId: string | null, onSelect: (id: string) => void, defaultId?: string | null): SheetOption[] {
  return groups.map((g) => ({ label: g.id === defaultId ? `${g.name} · 기본` : g.name, selected: g.id === currentId, onPress: () => onSelect(g.id) }));
}
