import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { errorMessage } from "./api";

// A tiny invalidation bus: any write bumps the version and every mounted
// useData() refetches. Screens also refetch on focus and when the app returns
// to the foreground, so web edits show up without a manual refresh.
let version = 0;
const listeners = new Set<() => void>();

export function invalidate() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

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

  // Keep showing the previous key's data while the next one loads (no flash).
  const current = data?.value ?? null;
  const fresh = data?.key === key;
  const err = error?.key === key ? error.message : null;
  return { data: current, fresh, error: err, loading: key != null && !fresh && err == null && current == null, refreshing, refresh };
}
