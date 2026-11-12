import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { T } from "./ui";

/** White section on the canvas; rows inside are separated by inset dividers. */
export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const { c } = useTheme();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <T variant="footnote" color={c.text2} accessibilityRole="header" style={{ marginLeft: 4 }}>
          {title}
        </T>
      ) : null}
      <View style={{ backgroundColor: c.card, borderRadius: radius.card, overflow: "hidden" }}>
        {items.map((child, i) => (
          <Fragment key={child.key ?? i}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: c.outline, marginLeft: 20 }} /> : null}
            {child}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <T variant="footnote" color={c.muted} style={{ marginHorizontal: 4, fontWeight: "400" }}>
          {footer}
        </T>
      ) : null}
    </View>
  );
}

export function Row({
  icon,
  label,
  value,
  onPress,
  trailing,
  chevron,
  destructive,
  accessibilityLabel,
  compact,
}: {
  icon?: IconName;
  label: string;
  value?: string | null;
  onPress?: () => void;
  trailing?: ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
  /** Smaller text (15 / 12) — the settings list per the design canvas. */
  compact?: boolean;
}) {
  const { c } = useTheme();
  const body = (pressed: boolean) => (
    <View
      style={{
        minHeight: 60,
        paddingHorizontal: 20,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: pressed ? c.subtle : "transparent",
      }}
    >
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: destructive ? c.dangerContainer : c.subtle, alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={20} color={destructive ? c.danger : c.text2} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T variant={compact ? "subhead" : "body"} style={{ fontWeight: "500" }} color={destructive ? c.danger : c.text}>
          {label}
        </T>
        {value ? (
          <T variant={compact ? "caption" : "footnote"} color={c.text2} style={{ fontWeight: "400" }}>
            {value}
          </T>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="forward" size={18} color={c.tertiary} /> : null}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? [label, value].filter(Boolean).join(", ")} onPress={onPress}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/** Grey-filled input with the label above (DESIGN.md › Inputs). */
export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T variant="footnote" color={c.text2}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...input}
        style={[
          type.body,
          {
            color: c.text,
            minHeight: 52,
            paddingHorizontal: 16,
            paddingVertical: input.multiline ? 14 : 0,
            borderRadius: radius.control,
            backgroundColor: c.subtle,
            textAlignVertical: input.multiline ? "top" : "center",
          },
          input.style,
        ]}
      />
      {hint ? (
        <T variant="footnote" color={c.muted} style={{ fontWeight: "400" }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

/** Small inline pill button used inside rows (승인, 거절 …). */
export function MiniButton({ label, onPress, tone = "primary", disabled }: { label: string; onPress: () => void; tone?: "primary" | "neutral" | "danger"; disabled?: boolean }) {
  const { c } = useTheme();
  const bg = tone === "primary" ? c.primaryContainer : tone === "danger" ? "transparent" : c.subtle;
  const fg = tone === "primary" ? c.onPrimaryContainer : tone === "danger" ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 40,
        minWidth: 56,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: pressed ? c.fill : bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <T variant="subhead" style={{ fontWeight: "600" }} color={fg}>
        {label}
      </T>
    </Pressable>
  );
}
