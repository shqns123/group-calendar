import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActionSheetProvider } from "@/components/ActionSheet";
import { DialogHost } from "@/components/DialogHost";
import { PaneFrame } from "@/components/PaneFrame";
import { useSplit, WideModeProvider } from "@/lib/wide";
import { SessionProvider, useSession } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

// Management screens are pushed onto the stack with a native header.
const PUSHED = [
  { name: "profile", title: "내 정보" },
  { name: "join", title: "그룹 가입" },
  { name: "manage/members", title: "멤버 관리" },
  { name: "manage/invite", title: "초대" },
  { name: "manage/group", title: "그룹 설정" },
  { name: "manage/notify", title: "알림 보내기" },
  { name: "admin/approvals", title: "가입 승인" },
  { name: "admin/users", title: "사용자 관리" },
  { name: "admin/holidays", title: "휴일 설정" },
  { name: "admin/new-group", title: "새 그룹" },
] as const;

function RootStack() {
  const { ready, me } = useSession();
  const { c, isDark } = useTheme();
  const split = useSplit();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const active = me?.status === "ACTIVE";
  const pending = me != null && me.status !== "ACTIVE";
  // Split screen: these screens open over the calendar but only in the right pane (PaneFrame), so
  // they're transparent modals there — the calendar underneath stays on screen — and draw their
  // own header. Otherwise: native header / full-screen modal as on a phone.
  const pushed = split
    ? { headerShown: false, presentation: "transparentModal" as const, animation: "slide_from_right" as const, contentStyle: { backgroundColor: "transparent" } }
    : {
        headerShown: true,
        headerTransparent: false,
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.primaryText,
        headerTitleStyle: { color: c.text },
        headerShadowVisible: false,
        headerBackTitle: "뒤로",
        contentStyle: { backgroundColor: c.bg },
      };
  const form = split
    ? { presentation: "transparentModal" as const, animation: "slide_from_bottom" as const, contentStyle: { backgroundColor: "transparent" } }
    : { presentation: "modal" as const, contentStyle: { backgroundColor: c.bg } };

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}
        screenLayout={({ route, navigation, children }) => {
          const name = route.name;
          if (name === "day/[date]") return <PaneFrame transparent>{children}</PaneFrame>;
          if (name === "event/edit" || name === "memo/edit") return <PaneFrame>{children}</PaneFrame>;
          const p = PUSHED.find((s) => s.name === name);
          if (p)
            return (
              <PaneFrame title={p.title} onBack={() => navigation.goBack()}>
                {children}
              </PaneFrame>
            );
          return <>{children}</>;
        }}
      >
        <Stack.Protected guard={active}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="day/[date]"
            options={{
              // Centered popup over the calendar (the screen draws its own scrim + card).
              presentation: "transparentModal",
              // The popup animates itself (grows out of the tapped cell).
              animation: "none",
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen name="event/edit" options={form} />
          <Stack.Screen name="memo/edit" options={form} />
          {PUSHED.map((s) => (
            <Stack.Screen key={s.name} name={s.name} options={{ ...pushed, title: s.title }} />
          ))}
        </Stack.Protected>
        <Stack.Protected guard={pending}>
          <Stack.Screen name="pending" />
        </Stack.Protected>
        <Stack.Protected guard={me == null}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          {/* 분할 / 전체화면 mode: the tabs layout and every popup (they stay in the right pane). */}
          <WideModeProvider>
            <ActionSheetProvider>
              <RootStack />
              {/* Confirm / notice popups (lib/confirm) render here, above every screen. */}
              <DialogHost />
            </ActionSheetProvider>
          </WideModeProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
