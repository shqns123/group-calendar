import { Alert, Platform } from "react-native";

// Confirm / notice popups. With <DialogHost/> mounted (root layout) they show as the app's own
// animated popup; before it mounts they fall back to the OS alert (web: window.confirm).
export type DialogRequest = {
  kind: "confirm" | "notice";
  title: string;
  message?: string;
  confirmLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
};

let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
let hostMounted = 0;

export function subscribeDialog(l: () => void) {
  listeners.add(l);
  hostMounted += 1;
  return () => {
    listeners.delete(l);
    hostMounted -= 1;
  };
}
export function currentDialog(): DialogRequest | null {
  return queue[0] ?? null;
}
export function closeDialog(r: DialogRequest, ok: boolean) {
  queue = queue.filter((x) => x !== r);
  listeners.forEach((l) => l());
  r.resolve(ok);
}
function open(r: Omit<DialogRequest, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { ...r, resolve }];
    listeners.forEach((l) => l());
  });
}

/** Confirm popup; resolves true when the user confirms. */
export function confirm(title: string, message: string, confirmLabel = "확인", destructive = false): Promise<boolean> {
  if (hostMounted > 0) return open({ kind: "confirm", title, message, confirmLabel, destructive });
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(`${title}\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "취소", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}

/** One-button message popup. */
export function notice(title: string, message?: string) {
  if (hostMounted > 0) {
    void open({ kind: "notice", title, message, confirmLabel: "확인", destructive: false });
    return;
  }
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
