import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

function RootStack() {
  const { ready, me } = useSession();
  const { c, isDark } = useTheme();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const active = me?.status === "ACTIVE";
  const pending = me != null && me.status !== "ACTIVE";

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={active}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="day/[date]"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.62, 0.95],
              sheetInitialDetentIndex: 0,
              sheetGrabberVisible: true,
              sheetCornerRadius: 28,
              contentStyle: { backgroundColor: c.sheet },
            }}
          />
          <Stack.Screen name="event/edit" options={{ presentation: "modal", contentStyle: { backgroundColor: c.bg } }} />
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
          <RootStack />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
