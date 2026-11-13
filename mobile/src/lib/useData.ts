import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { errorMessage } from "./api";
import { refreshWidgets } from "./widgetSync";

// A tiny invalidation bus: any write bumps the version and every mounted
// useData() refetches. Screens also refetch on focus and when the app returns
// to the foreground, so web edits show up without a manual refresh.
let version = 0;
const listeners = new Set<() => void>();

export function invalidate() {
  version += 1;
  listeners.forEach((l) => l());
  // Saved something → the home-screen widgets redraw too.
  refreshWidgets();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Last value per key, shared by every useData: a screen (or a calendar page) that asks for a key
// someone already loaded shows it at once and refreshes in the background — no empty flash.
const cache = new Map<string, unknown>();

export function useData<T>(key: string | null, fetcher: () => Promise<T>) {
  const v = useSyncExternalStore(subscribe, () => version, () => version);
  const [data, setData] = useState<{ key: string; value: T } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  const reqId = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // All state updates happen after the await, never synchronously in an effect.
  const fetchNow = useCallback(async () => {
    if (!key) return;
    const id = ++reqId.current;
    try {
      const value = await fetcherRef.current();
      cache.set(key, value);
      if (id === reqId.current) {
        setData({ key, value });
        setError(null);
      }
    } catch (e) {
      if (id === reqId.current) setError({ key, message: errorMessage(e) });
    }
  }, [key]);

  useEffect(() => {
    void fetchNow();
  }, [fetchNow, v]);

  useFocusEffect(
    useCallback(() => {
      void fetchNow();
    }, [fetchNow]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void fetchNow();
    });
    return () => sub.remove();
  }, [fetchNow]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNow();
    setRefreshing(false);
  }, [fetchNow]);

  // This key's data; else what any useData last loaded for it; else the previous key's data while
  // the next one loads (no flash).
  const fresh = data?.key === key;
  const current = fresh ? data!.value : key != null && cache.has(key) ? (cache.get(key) as T) : (data?.value ?? null);
  const err = error?.key === key ? error.message : null;
  return { data: current, fresh, error: err, loading: key != null && !fresh && err == null && current == null, refreshing, refresh };
}
