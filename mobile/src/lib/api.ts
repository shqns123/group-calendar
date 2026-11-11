import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { demoFetch } from "./demo";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const DEMO = process.env.EXPO_PUBLIC_DEMO === "1" || !API_URL;

const TOKEN_KEY = "session-token";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// SecureStore has no web implementation; web preview keeps the token in memory.
let memoryToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return memoryToken;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  if (Platform.OS === "web") {
    memoryToken = token;
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

type Options = { method?: string; body?: unknown; query?: Record<string, string | undefined | null> };

export async function api<T>(path: string, { method = "GET", body, query }: Options = {}): Promise<T> {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
        .join("&")
    : "";
  const url = `${path}${qs ? `?${qs}` : ""}`;

  if (DEMO) return demoFetch<T>(method, url, body);

  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${url}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : null),
        ...(token ? { Authorization: `Bearer ${token}` } : null),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "서버에 연결하지 못했어요. 네트워크를 확인해 주세요.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    const message = (data && typeof data.error === "string" && data.error) || `요청에 실패했어요 (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export function errorMessage(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "알 수 없는 오류가 발생했어요.";
}
