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
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: 8,
        backgroundColor: c.surface,
        borderBottomWidth: 1,
        borderBottomColor: c.outline,
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
