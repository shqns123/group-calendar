import { useRouter } from "expo-router";
import { type ReactNode } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { closeScreen } from "@/lib/nav";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { KeyboardAware } from "./KeyboardAware";
import { usePopupFade } from "./ScreenPopup";
import { IconButton, T } from "./ui";

export function QrPopup({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Fades in / out itself (Esc too), the same as the settings popups.
  const { fade, close } = usePopupFade(() => closeScreen(router, "/settings"));

  return (
    <Animated.View style={{ flex: 1, opacity: fade }}>
    <KeyboardAware style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
        <Pressable accessible={false} onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
        <View role="dialog" aria-label={title} aria-modal accessibilityViewIsModal style={{ width: "100%", maxWidth: 400, maxHeight: "100%", flexShrink: 1, overflow: "hidden", borderRadius: radius.sheet, backgroundColor: c.sheet }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 20, paddingRight: 10, paddingVertical: 8 }}>
            <T variant="title2" accessibilityRole="header" style={{ flex: 1 }}>{title}</T>
            <IconButton icon="close" label="닫기" onPress={close} tone="plain" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 16 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </KeyboardAware>
    </Animated.View>
  );
}
