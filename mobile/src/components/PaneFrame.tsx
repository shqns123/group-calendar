// Split screen (unfolded / large screen, 분할): a screen opened over the app — the day popup, the
// edit forms, the management screens — stays in the right pane, so the calendar on the left keeps
// showing. On a phone or in full screen it covers the whole screen as before.
import Feather from "@expo/vector-icons/Feather";
import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePaneLeft } from "@/lib/wide";
import { useTheme } from "@/theme/ThemeProvider";
import { T } from "./ui";

/**
 * `title` + `onBack`: draws the pushed screen's header inside the pane (the native header would
 * span the whole width). `transparent`: the screen paints its own backdrop (the day popup).
 */
export function PaneFrame({ children, title, onBack, transparent }: { children: ReactNode; title?: string; onBack?: () => void; transparent?: boolean }) {
  const left = usePaneLeft();
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  if (!left) return <>{children}</>;
  return (
    <View pointerEvents="box-none" style={{ flex: 1, flexDirection: "row" }}>
      {/* The calendar pane shows through here. */}
      <View pointerEvents="none" style={{ width: left }} />
      <View
        style={{
          flex: 1,
          overflow: "hidden",
          backgroundColor: transparent ? "transparent" : c.bg,
          borderLeftWidth: transparent ? 0 : 1,
          borderLeftColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
        }}
      >
        {title != null ? (
          <View style={{ paddingTop: insets.top, backgroundColor: c.surface, flexDirection: "row", alignItems: "center", minHeight: insets.top + 56, paddingRight: 16 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} hitSlop={4} style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}>
              <Feather name="arrow-left" size={22} color={c.primaryText} />
            </Pressable>
            <T variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </T>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </View>
  );
}
