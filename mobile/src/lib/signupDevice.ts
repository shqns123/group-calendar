import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "signup-installation-id";
let pending: Promise<string> | null = null;

/** Stable installation ID, retained on logout; the server also enforces a separate IP quota. */
export function signupDeviceId(): Promise<string> {
  if (!pending) pending = (async () => {
    const stored = Platform.OS === "web" ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (stored) return stored;
    // Public installation identifier, not an authentication credential.
    const id = Array.from({ length: 6 }, () => Math.random().toString(36).slice(2).padEnd(11, "0")).join("");
    if (Platform.OS === "web") localStorage.setItem(KEY, id);
    else await SecureStore.setItemAsync(KEY, id);
    return id;
  })().catch((error) => { pending = null; throw error; });
  return pending;
}
