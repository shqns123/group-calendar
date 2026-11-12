import { type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { T } from "./ui";

/** Top-level tab screen header: large title + optional subtitle and trailing action. */
export function ScreenHeader({ title, subtitle, trailing }: { title: string; subtitle?: string; trailing?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 12,
        paddingBottom: 8,
        paddingLeft: 20,
        paddingRight: 12,
        backgroundColor: c.bg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="title1" accessibilityRole="header">
          {title}
        </T>
        {subtitle ? (
          <T variant="footnote" color={c.text2} style={{ fontWeight: "500" }}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
