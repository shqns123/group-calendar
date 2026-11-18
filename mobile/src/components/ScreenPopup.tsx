// Settings screens (내 정보, 멤버 관리, 그룹 설정, …) open as a centered popup over the settings tab
// instead of a pushed full screen. The popup fades itself in and out, so the motion is the same on
// the phone app and the web app (the web stack ignores the native `animation` option).
import { useNavigation } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { prefersReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { KeyboardAware } from "./KeyboardAware";
import { IconButton, T } from "./ui";

type Action = { type: string };
type Nav = {
  addListener: (event: "beforeRemove", cb: (e: { preventDefault: () => void; data: { action: Action } }) => void) => () => void;
  dispatch: (action: Action) => void;
};

const IN_MS = 200;
const OUT_MS = 160;

/**
 * Popup fade (settings screens, QR invite / join): fades in on mount, and fades out before any way
 * of leaving. Wrap the popup in `<Animated.View style={{ flex: 1, opacity: fade }}>` and close it
 * with `close`.
 */
export function usePopupFade(onClose: () => void) {
  // Minimal typing of the stack's beforeRemove event (typed routes don't expose it here).
  const navigation = useNavigation() as unknown as Nav;
  const [fade] = useState(() => new Animated.Value(prefersReducedMotion() ? 1 : 0));
  const leaving = useRef(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: IN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, [fade]);

  const fadeOut = useCallback(
    (then: () => void) => {
      if (prefersReducedMotion()) return then();
      Animated.timing(fade, { toValue: 0, duration: OUT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start(() => then());
    },
    [fade],
  );

  // 닫기, scrim, Esc: fade out first, then close. (On the web the close is a browser-history back,
  // which beforeRemove below can't hold, so the popup fades before asking for it.)
  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    fadeOut(onClose);
  }, [fadeOut, onClose]);

  // Any other way out (Android back, iOS swipe, a screen closing itself after saving): hold the
  // removal, fade out, then let it go ahead.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (leaving.current || prefersReducedMotion()) return;
        e.preventDefault();
        leaving.current = true;
        fadeOut(() => navigation.dispatch(e.data.action));
      }),
    [navigation, fadeOut],
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [close]);

  return { fade, close };
}

export function ScreenPopup({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { fade, close } = usePopupFade(onClose);

  return (
    <Animated.View style={{ flex: 1, opacity: fade }}>
      <KeyboardAware style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
          <Pressable accessible={false} onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
          <View
            role="dialog"
            aria-label={title}
            aria-modal
            accessibilityViewIsModal
            style={{ width: "100%", maxWidth: 520, height: "100%", maxHeight: 760, overflow: "hidden", borderRadius: radius.sheet, backgroundColor: c.bg }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 20, paddingRight: 10, paddingVertical: 8, backgroundColor: c.surface }}>
              <T variant="title2" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
                {title}
              </T>
              <IconButton icon="close" label="닫기" onPress={close} tone="plain" />
            </View>
            <View style={{ flex: 1 }}>{children}</View>
          </View>
        </View>
      </KeyboardAware>
    </Animated.View>
  );
}
