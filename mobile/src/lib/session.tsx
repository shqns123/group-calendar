import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, DEMO, getToken, setToken, setUnauthorizedHandler } from "./api";
import type { Group, Me } from "./types";

type SignInResult = { sessionToken: string; cookieName: string; pending: boolean };

type Session = {
  ready: boolean;
  me: Me | null;
  groups: Group[];
  group: Group | null;
  selectGroup: (id: string) => void;
  reloadGroups: () => Promise<void>;
  signInGuest: (name: string, employeeId: string) => Promise<void>;
  signInGoogle: (idToken: string) => Promise<{ pending: boolean }>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);

  const clear = useCallback(async () => {
    await setToken(null);
    setMe(null);
    setGroups([]);
    setGroupId(null);
  }, []);

  const load = useCallback(async () => {
    const { user } = await api<{ user: Me }>("/api/auth/me");
    setMe(user);
    if (user.status === "ACTIVE") {
      const list = await api<Group[]>("/api/groups");
      setGroups(list);
      setGroupId((prev) => (prev && list.some((g) => g.id === prev) ? prev : list[0]?.id ?? null));
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
      group: groups.find((g) => g.id === groupId) ?? null,
      selectGroup: setGroupId,
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
    [ready, me, groups, groupId, load, finish, clear],
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
