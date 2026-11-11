import SegmentedControlBase from "@react-native-segmented-control/segmented-control";
import { type ComponentType, type ReactNode } from "react";
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

// The package ships class typings older than React 19; describe the props we use.
const SegmentedControl = SegmentedControlBase as unknown as ComponentType<{
  values: string[];
  selectedIndex: number;
  onChange: (e: { nativeEvent: { selectedSegmentIndex: number } }) => void;
  appearance?: "dark" | "light";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function T({ variant = "body", color, style, ...rest }: TextProps & { variant?: Role; color?: string }) {
  const { c } = useTheme();
  return <Text {...rest} style={[type[variant], { color: color ?? c.text }, style]} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.card, borderColor: c.outline, borderWidth: 1, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14 },
        style,
      ]}
    >
      {children}
    </View>
  );
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
        borderRadius: radius.control,
        backgroundColor: bg,
        borderWidth: tone === "card" ? 1 : 0,
        borderColor: c.outline,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
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
        minHeight: 52,
        borderRadius: radius.card,
        backgroundColor: c.primary,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 20,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={c.onPrimary} /> : icon ? <Icon name={icon} size={20} color={c.onPrimary} /> : null}
      <T variant="headline" color={c.onPrimary}>
        {label}
      </T>
    </Pressable>
  );
}

/** Selectable pill (people, attendance type, equipment). Selected state shows a check, not only color. */
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
    primary: { bg: c.primaryContainer, fg: c.onPrimaryContainer, border: c.primary },
    info: { bg: c.infoContainer, fg: c.onInfo, border: c.infoBorder },
    ink: { bg: c.text, fg: c.surface, border: c.text },
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
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderStyle: disabled ? "dashed" : "solid",
        borderColor: disabled ? c.strong : selected ? on.border : c.outline,
        backgroundColor: disabled ? c.subtle : selected ? on.bg : c.card,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {selected && !disabled ? <Icon name="check" size={16} color={on.fg} /> : null}
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

/** Read-only info pill (wash + ink). */
export function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
      <T variant="footnote" color={fg}>
        {label}
      </T>
    </View>
  );
}

/** Platform segmented control: UISegmentedControl on iOS, Material SegmentedButton on Android. */
export function Segmented({ values, index, onChange, label }: { values: string[]; index: number; onChange: (i: number) => void; label: string }) {
  const { c, isDark } = useTheme();
  if (Platform.OS === "ios") {
    return (
      <SegmentedControl
        accessibilityLabel={label}
        values={values}
        selectedIndex={index}
        onChange={(e) => onChange(e.nativeEvent.selectedSegmentIndex)}
        appearance={isDark ? "dark" : "light"}
        style={{ height: 36 }}
      />
    );
  }
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", borderWidth: 1, borderColor: c.strong, borderRadius: radius.pill, overflow: "hidden" }}>
      {values.map((v, i) => {
        const on = i === index;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityLabel={v}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(i)}
            style={{
              flex: 1,
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: on ? c.primaryContainer : "transparent",
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: c.strong,
            }}
          >
            {on ? <Icon name="check" size={18} color={c.onPrimaryContainer} /> : null}
            <T variant="subhead" style={{ fontWeight: "600" }} color={on ? c.onPrimaryContainer : c.text}>
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
    <View style={{ padding: 32, alignItems: "center", gap: 6 }}>
      <T variant="headline" color={c.text2}>
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
    <View accessibilityRole="alert" style={{ margin: 16, padding: 12, borderRadius: radius.control, backgroundColor: c.warnContainer, borderWidth: 1, borderColor: c.warnBorder, gap: 8 }}>
      <T variant="subhead" color={c.onWarn}>
        {message}
      </T>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: "center" }}>
          <T variant="headline" color={c.primaryText}>
            다시 시도
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}
