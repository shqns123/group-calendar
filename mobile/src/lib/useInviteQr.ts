import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { api, errorMessage, HOSTED_WEB } from "./api";

type Issued = { token: string; autoApprove: boolean; expiresAt: string };

export function useInviteQr(groupId: string | null, allowed: boolean) {
  const [qr, setQr] = useState<Issued | null>(null);
  const [left, setLeft] = useState(0);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const current = useRef<{ groupId: string; token: string } | null>(null);
  const focused = useRef(false);

  const revoke = useCallback((value: { groupId: string; token: string }) => {
    const path = `/api/groups/${value.groupId}/qr-invite`;
    if (HOSTED_WEB && navigator.sendBeacon?.(path, new Blob([JSON.stringify({ action: "revoke", token: value.token })], { type: "application/json" }))) return;
    void api(path, { method: "DELETE", body: { token: value.token }, keepalive: true }).catch(() => null);
  }, []);

  const refresh = useCallback(async () => {
    if (!groupId || !allowed || !focused.current || (Platform.OS === "web" && document.visibilityState === "hidden")) return;
    const round = ++generation.current;
    if (current.current) { revoke(current.current); current.current = null; }
    setQr(null); setScanned(false); setLoading(true); setError(null);
    try {
      const result = await api<Issued>(`/api/groups/${groupId}/qr-invite`, { method: "POST" });
      if (generation.current !== round || !focused.current) { revoke({ groupId, token: result.token }); return; }
      current.current = { groupId, token: result.token };
      setQr(result);
      setLeft(Math.max(0, Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / 1000)));
    } catch (e) { if (generation.current === round) setError(errorMessage(e)); }
    finally { if (generation.current === round) setLoading(false); }
  }, [groupId, allowed, revoke]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    void refresh();
    const hide = () => {
      ++generation.current;
      if (current.current) { revoke(current.current); current.current = null; }
      setQr(null); setLoading(false);
      setError("초대 창이 숨겨져 QR을 폐기했어요. 새 QR을 만들어 주세요.");
    };
    const listener = AppState.addEventListener("change", (state) => { if (state !== "active") hide(); });
    const visibility = () => { if (document.visibilityState === "hidden") hide(); };
    if (Platform.OS === "web") {
      document.addEventListener("visibilitychange", visibility);
      window.addEventListener("pagehide", hide);
    }
    return () => {
      focused.current = false;
      ++generation.current;
      if (current.current) { revoke(current.current); current.current = null; }
      listener.remove();
      if (Platform.OS === "web") {
        document.removeEventListener("visibilitychange", visibility);
        window.removeEventListener("pagehide", hide);
      }
    };
  }, [refresh, revoke]));

  useEffect(() => {
    if (!groupId || !qr) return;
    let live = true;
    let inFlight = false;
    const tick = setInterval(() => setLeft(Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - Date.now()) / 1000))), 1000);
    const poll = setInterval(async () => {
      if (inFlight || !focused.current || (Platform.OS !== "web" && AppState.currentState !== "active")) return;
      if (Platform.OS === "web" && document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const result = await api<{ live: boolean; scanned: boolean }>(`/api/groups/${groupId}/qr-invite`, { method: "PATCH", body: { token: qr.token } });
        if (live && !result.live) {
          setQr(null); setLeft(0); setScanned(result.scanned);
          setError(result.scanned ? null : "QR이 만료됐어요. 새 QR을 만들어 주세요.");
          clearInterval(poll);
        }
      } catch { /* The server's lease fails closed during a lost connection. */ }
      finally { inFlight = false; }
    }, 2000);
    return () => { live = false; clearInterval(tick); clearInterval(poll); };
  }, [groupId, qr]);

  return { qr, left, scanned, error, loading, refresh };
}
