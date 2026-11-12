import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, DEMO, getToken, setToken, setUnauthorizedHandler } from "./api";
import type { Group, Me } from "./types";

type SignInResult = { sessionToken: string; cookieName: string; pending: boolean };

type Session = {
  ready: boolean;
  me: Me | null;
  /** Groups I belong to — the only ones the app switches between. */
  groups: Group[];
  /** Every group the API returned (operators see all of them); for admin screens. */
  allGroups: Group[];
  group: Group | null;
  selectGroup: (id: string) => void;
  defaultGroupId: string | null;
  setDefaultGroup: (id: string) => Promise<void>;
  reloadGroups: () => Promise<void>;
  signInGuest: (name: string, employeeId: string) => Promise<void>;
  signInGoogle: (idToken: string) => Promise<{ pending: boolean }>;
  signOut: () => Promise<void>;
};

// The group the app opens on. Kept on the device (SecureStore; memory on web preview).
const DEFAULT_GROUP_KEY = "default-group-id";
let memoryDefault: string | null = null;
async function readDefaultGroup() {
  if (Platform.OS === "web") return memoryDefault;
  return SecureStore.getItemAsync(DEFAULT_GROUP_KEY).catch(() => null);
}
async function writeDefaultGroup(id: string | null) {
  if (Platform.OS === "web") {
    memoryDefault = id;
    return;
  }
  if (id) await SecureStore.setItemAsync(DEFAULT_GROUP_KEY, id);
  else await SecureStore.deleteItemAsync(DEFAULT_GROUP_KEY);
}

/** Groups I actually belong to (leader, or an active member). Operators get every group from the API. */
function isMine(g: Group, userId: string) {
  return g.leaderId === userId || g.members.some((m) => m.userId === userId && (m.status === "ACTIVE" || m.status == null));
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);

  const clear = useCallback(async () => {
    await setToken(null);
    setMe(null);
    setGroups([]);
    setAllGroups([]);
    setGroupId(null);
  }, []);

  const load = useCallback(async () => {
    const { user } = await api<{ user: Me }>("/api/auth/me");
    setMe(user);
    if (user.status === "ACTIVE") {
      const all = await api<Group[]>("/api/groups");
      const list = all.filter((g) => isMine(g, user.id));
      const saved = await readDefaultGroup();
      const def = saved && list.some((g) => g.id === saved) ? saved : null;
      setAllGroups(all);
      setGroups(list);
      setDefaultGroupId(def);
      setGroupId((prev) => (prev && list.some((g) => g.id === prev) ? prev : def ?? list[0]?.id ?? null));
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clear();
    });
    (async () => {
      try {
        if (DEMO || (await getToken())) await load();
      } catch {
        await clear();
      } finally {
        setReady(true);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [clear, load]);

  const finish = useCallback(
    async (res: SignInResult) => {
      await setToken(res.sessionToken);
      await load();
      return { pending: res.pending };
    },
    [load],
  );

  const value = useMemo<Session>(
    () => ({
      ready,
      me,
      groups,
      allGroups,
      group: groups.find((g) => g.id === groupId) ?? null,
      selectGroup: setGroupId,
      defaultGroupId,
      setDefaultGroup: async (id) => {
        await writeDefaultGroup(id);
        setDefaultGroupId(id);
      },
      reloadGroups: load,
      signInGuest: async (name, employeeId) => {
        const res = await api<SignInResult>("/api/auth/app-native-signin", {
          method: "POST",
          body: { provider: "guest", name, employeeId },
        });
        await finish(res);
      },
      signInGoogle: async (idToken) => {
        const res = await api<SignInResult>("/api/auth/app-native-signin", {
          method: "POST",
          body: { provider: "google", idToken },
        });
        return finish(res);
      },
      signOut: clear,
    }),
    [ready, me, groups, allGroups, groupId, defaultGroupId, load, finish, clear],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

/** Display label for a member — same rule as the web (nickname → name → email id). */
export function memberLabel(m: Group["members"][number]) {
  return m.nickname?.trim() || m.user.name?.trim() || m.user.email?.split("@")[0] || "이름 없음";
}

export function rosterOf(group: Group | null) {
  if (!group) return [] as string[];
  return group.members
    .filter((m) => (m.status === "ACTIVE" || m.status == null) && m.role !== "OBSERVER")
    .map(memberLabel);
}

export function myLabel(group: Group | null, me: Me | null) {
  const mine = group?.members.find((m) => m.userId === me?.id);
  return mine ? memberLabel(mine) : me?.name ?? "";
}
