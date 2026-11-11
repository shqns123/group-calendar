import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, Pressable, View } from "react-native";
import { keyToIso, longLabel, shortLabel, toKey, addDays, type DateKey } from "@/lib/date";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { T } from "./ui";

/** Platform date picker: compact native picker (iOS), Material dialog (Android), stepper (web preview). */
export function DateField({ label, value, onChange, minimum }: { label: string; value: DateKey; onChange: (k: DateKey) => void; minimum?: DateKey }) {
  const { c, isDark } = useTheme();
  const date = new Date(keyToIso(value));
  const min = minimum ? new Date(keyToIso(minimum)) : undefined;

  const header = (
    <T variant="footnote" color={c.text2}>
      {label}
    </T>
  );

  if (Platform.OS === "ios") {
    return (
      <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 6, minHeight: 64 }}>
        {header}
        <DateTimePicker
          accessibilityLabel={`${label} 날짜, ${longLabel(value)}`}
          value={date}
          mode="date"
          display="compact"
          locale="ko-KR"
          minimumDate={min}
          themeVariant={isDark ? "dark" : "light"}
          accentColor={c.primary}
          onChange={(_, d) => d && onChange(toKey(d))}
          style={{ alignSelf: "flex-start", marginLeft: -8 }}
        />
      </View>
    );
  }

  if (Platform.OS === "android") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 날짜, ${longLabel(value)}, 바꾸기`}
        onPress={() =>
          DateTimePickerAndroid.open({ value: date, mode: "date", minimumDate: min, onChange: (_, d) => d && onChange(toKey(d)) })
        }
        style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 2, minHeight: 64 }}
      >
        {header}
        <T variant="headline">{shortLabel(value)}</T>
      </Pressable>
    );
  }

  // Web preview fallback.
  return (
    <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 2, minHeight: 64 }}>
      {header}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} 하루 전`} onPress={() => onChange(addDays(value, -1))} style={{ minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" }}>
          <Icon name="back" size={18} color={c.text2} />
        </Pressable>
        <T variant="headline">{shortLabel(value)}</T>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} 하루 뒤`} onPress={() => onChange(addDays(value, 1))} style={{ minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" }}>
          <Icon name="forward" size={18} color={c.text2} />
        </Pressable>
      </View>
    </View>
  );
}
