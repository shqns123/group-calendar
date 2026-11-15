import { Alert, Platform } from "react-native";

// Confirm / notice popups. With <DialogHost/> mounted (root layout) they show as the app's own
// animated popup; before it mounts they fall back to the OS alert (web: window.confirm).
/** A label → value line in a popup (e.g. the AI reading of a quick-add line). */
export type DialogRow = { label: string; value: string; warn?: boolean };
/** An extra button of a `choose()` popup; `strong` marks the main one. */
export type DialogChoice = { key: string; label: string; strong?: boolean };

export type DialogRequest = {
  kind: "confirm" | "notice" | "choice";
  title: string;
  message?: string;
  confirmLabel: string;
  destructive: boolean;
  rows?: DialogRow[];
  choices?: DialogChoice[];
  resolve: (ok: boolean) => void;
  /** choice popups: the picked key, or null for 취소 / back / tap outside. */
  pick?: (key: string | null) => void;
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
export function closeDialog(r: DialogRequest, ok: boolean, key: string | null = null) {
  queue = queue.filter((x) => x !== r);
  listeners.forEach((l) => l());
  r.resolve(ok);
  r.pick?.(ok ? key : null);
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

/**
 * Popup with label/value rows and several buttons (plus 취소). Resolves with the picked key, or
 * null when cancelled.
 */
export function choose(title: string, rows: DialogRow[], choices: DialogChoice[], message?: string): Promise<string | null> {
  if (hostMounted > 0) {
    return new Promise((pick) => {
      queue = [...queue, { kind: "choice", title, message, rows, choices, confirmLabel: "", destructive: false, resolve: () => {}, pick }];
      listeners.forEach((l) => l());
    });
  }
  const text = [message, ...rows.map((r) => `${r.label}: ${r.value}`)].filter(Boolean).join("\n");
  if (Platform.OS === "web") {
    const main = choices.find((x) => x.strong) ?? choices[0];
    return Promise.resolve(typeof window !== "undefined" && window.confirm(`${title}\n${text}`) ? main.key : null);
  }
  return new Promise((pick) => {
    Alert.alert(title, text, [
      { text: "취소", style: "cancel", onPress: () => pick(null) },
      ...choices.map((x) => ({ text: x.label, onPress: () => pick(x.key) })),
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
