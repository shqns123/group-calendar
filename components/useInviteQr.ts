"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Issued = { token: string; autoApprove: boolean; expiresAt: string };

export function useInviteQr(groupId: string | null) {
  const [qr, setQr] = useState<Issued | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(0);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const round = useRef(0);
  const current = useRef<{ groupId: string; token: string } | null>(null);

  const revoke = useCallback((value: { groupId: string; token: string }, beacon = false) => {
    const path = `/api/groups/${value.groupId}/qr-invite`;
    if (beacon && navigator.sendBeacon?.(path, new Blob([JSON.stringify({ action: "revoke", token: value.token })], { type: "application/json" }))) return;
    void fetch(path, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: value.token }), keepalive: true }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    if (!groupId || document.visibilityState === "hidden") return;
    const generation = ++round.current;
    if (current.current) { revoke(current.current); current.current = null; }
    setLoading(true);
    setQr(null);
    setScanned(false);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/qr-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "QR 코드를 만들지 못했어요.");
      if (round.current !== generation || document.hidden) { revoke({ groupId, token: data.token }); return; }
      current.current = { groupId, token: data.token };
      setQr(data);
      setLeft(Math.max(0, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));
    } catch (e) {
      if (round.current === generation) setError(e instanceof Error ? e.message : "네트워크를 확인해 주세요.");
    } finally { if (round.current === generation) setLoading(false); }
  }, [groupId, revoke]);

  useEffect(() => {
    void refresh();
    const hide = () => {
      if (document.visibilityState !== "hidden") return;
      ++round.current;
      if (current.current) { revoke(current.current, true); current.current = null; }
      setQr(null);
      setLoading(false);
      setError("초대 창이 숨겨져 QR을 폐기했어요. 새 QR을 만들어 주세요.");
    };
    const leave = () => {
      ++round.current;
      if (current.current) { revoke(current.current, true); current.current = null; }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      leave();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
    };
  }, [refresh, revoke]);

  useEffect(() => {
    if (!groupId || !qr) return;
    let live = true;
    let inFlight = false;
    const tick = setInterval(() => setLeft(Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - Date.now()) / 1000))), 1000);
    const poll = setInterval(async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const res = await fetch(`/api/groups/${groupId}/qr-invite`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: qr.token }) });
        const data = await res.json();
        if (!live) return;
        if (!res.ok || !data.live) {
          setScanned(!!data.scanned);
          setLeft(0);
          setQr(null);
          setError(data.scanned ? "" : "QR이 만료됐어요. 새 QR을 만들어 주세요.");
          clearInterval(poll);
        }
      } catch { /* The server expires the lease when heartbeats cannot reach it. */ }
      finally { inFlight = false; }
    }, 2000);
    return () => { live = false; clearInterval(tick); clearInterval(poll); };
  }, [groupId, qr]);

  return { qr: groupId ? qr : null, error, left, scanned, loading, refresh };
}
