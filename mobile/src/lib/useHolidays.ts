import { api } from "./api";
import type { CustomHoliday } from "./types";
import { useData } from "./useData";

/** Company holidays/workdays (readable by every signed-in user). */
export function useHolidays() {
  const { data } = useData("holidays", () => api<CustomHoliday[]>("/api/admin/holidays"));
  return data ?? [];
}
