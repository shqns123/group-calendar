import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Switch,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { HIT, radius, type } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";

type Role = keyof typeof type;

export function T({ variant = "body", color, style, ...rest }: TextProps & { variant?: Role; color?: string }) {
  const { c } = useTheme();
  return <Text {...rest} style={[type[variant], { color: color ?? c.text }, style]} />;
}

/** White surface on the canvas — no border, no shadow (The Quiet Surface Rule). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.card, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: 20 }, style]}>{children}</View>;
}

export function IconButton({ icon, label, onPress, tone = "subtle" }: { icon: IconName; label: string; onPress?: () => void; tone?: "subtle" | "plain" | "card" }) {
  const { c } = useTheme();
  const bg = tone === "subtle" ? c.subtle : tone === "card" ? c.card : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={(HIT - 44) / 2}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        backgroundColor: pressed ? c.fill : bg,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Icon name={icon} size={22} color={c.text} />
    </Pressable>
  );
}

export function PrimaryButton({ label, icon, onPress, busy, disabled }: { label: string; icon?: IconName; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => ({
        minHeight: 56,
        borderRadius: radius.control,
        backgroundColor: c.primary,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 20,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {busy ? <ActivityIndicator color={c.onPrimary} /> : icon ? <Icon name={icon} size={20} color={c.onPrimary} /> : null}
      <T variant="headline" color={c.onPrimary}>
        {label}
      </T>
    </Pressable>
  );
}

/** Quiet grey-filled button for secondary actions. */
export function SecondaryButton({ label, icon, onPress, disabled, tone = "neutral" }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean; tone?: "neutral" | "danger" }) {
  const { c } = useTheme();
  const fg = tone === "danger" ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: radius.control,
        backgroundColor: pressed ? c.fill : c.subtle,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 20,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <T variant="headline" color={fg}>
        {label}
      </T>
    </Pressable>
  );
}

/** Selectable pill (people, attendance type, equipment). Selected = tinted fill + accent text; state is also announced to screen readers. */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
  note,
  tone = "primary",
  ...rest
}: { label: string; selected?: boolean; onPress?: () => void; disabled?: boolean; note?: string; tone?: "primary" | "info" | "ink" } & Omit<PressableProps, "children">) {
  const { c } = useTheme();
  const on = {
    primary: { bg: c.primaryContainer, fg: c.onPrimaryContainer },
    info: { bg: c.infoContainer, fg: c.onInfo },
    ink: { bg: c.text, fg: c.surface },
  }[tone];
  return (
    <Pressable
      {...rest}
      accessibilityRole={rest.accessibilityRole ?? "button"}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={note ? `${label}, ${note}` : label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: HIT,
        paddingHorizontal: 16,
        borderRadius: radius.pill,
        borderWidth: disabled ? 1 : 0,
        borderStyle: "dashed",
        borderColor: c.strong,
        backgroundColor: disabled ? "transparent" : selected ? on.bg : pressed ? c.fill : c.subtle,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      })}
    >
      <View style={{ alignItems: "center" }}>
        <T variant="subhead" style={{ fontWeight: "600" }} color={disabled ? c.muted : selected ? on.fg : c.text}>
          {label}
        </T>
        {note ? (
          <T variant="caption" color={c.muted}>
            {note}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Read-only status pill (wash + ink). */
export function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <T variant="footnote" color={fg}>
        {label}
      </T>
    </View>
  );
}

/** Choice between a few options, drawn as separate pill slots side by side. */
export function Segmented({ values, index, onChange, label }: { values: string[]; index: number; onChange: (i: number) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", gap: 8 }}>
      {values.map((v, i) => {
        const on = i === index;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityLabel={v}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(i)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 52,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: radius.control,
              backgroundColor: on ? c.primaryContainer : pressed ? c.fill : c.card,
            })}
          >
            <T variant="headline" color={on ? c.onPrimaryContainer : c.text2}>
              {v}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Platform switch with brand track color. */
export function Toggle({ value, onChange, tone = "primary", label }: { value: boolean; onChange: (v: boolean) => void; tone?: "primary" | "overtime"; label: string }) {
  const { c } = useTheme();
  const on = tone === "overtime" ? c.overtimeTrack : c.primary;
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ true: on, false: Platform.OS === "android" ? c.fill : c.switchOff }}
      thumbColor={Platform.OS === "android" ? (value ? "#FFFFFF" : c.strong) : undefined}
      ios_backgroundColor={c.switchOff}
    />
  );
}

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingVertical: 48, paddingHorizontal: 24, alignItems: "center", gap: 6 }}>
      <T variant="headline" color={c.text}>
        {title}
      </T>
      {body ? (
        <T variant="subhead" color={c.muted} style={{ textAlign: "center" }}>
          {body}
        </T>
      ) : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="alert" style={{ marginVertical: 8, padding: 16, borderRadius: radius.control, backgroundColor: c.dangerContainer, gap: 8 }}>
      <T variant="subhead" color={c.danger} style={{ fontWeight: "600" }}>
        {message}
      </T>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
          <T variant="headline" color={c.primaryText}>
            다시 시도
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}
