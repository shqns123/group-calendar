import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ActionSheetIOS, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { T } from "./ui";

export type SheetOption = { label: string; destructive?: boolean; selected?: boolean; onPress: () => void };
type Sheet = { title: string; message?: string; options: SheetOption[] };

const Ctx = createContext<(sheet: Sheet) => void>(() => {});

/**
 * Lists of actions: the system action sheet on iOS, a bottom sheet elsewhere
 * (Android's Alert caps out at three buttons, so menus and group lists need this).
 */
export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const show = useCallback((s: Sheet) => {
    if (s.options.length === 0) return;
    if (Platform.OS === "ios") {
      const destructive = s.options.findIndex((o) => o.destructive);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: s.title,
          message: s.message,
          options: [...s.options.map((o) => (o.selected ? `${o.label} ✓` : o.label)), "취소"],
          cancelButtonIndex: s.options.length,
          destructiveButtonIndex: destructive >= 0 ? destructive : undefined,
        },
        (i) => {
          if (i < s.options.length) s.options[i].onPress();
        },
      );
      return;
    }
    setSheet(s);
  }, []);

  const close = () => setSheet(null);
  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal visible={sheet != null} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={close} style={{ flex: 1, backgroundColor: c.scrim }} />
        <View style={{ backgroundColor: c.sheet, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: 8, paddingBottom: insets.bottom + 8, maxHeight: "70%" }}>
          <View style={{ alignItems: "center", paddingVertical: 6 }}>
            <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: c.handle }} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 2 }}>
            <T variant="headline" accessibilityRole="header">
              {sheet?.title}
            </T>
            {sheet?.message ? (
              <T variant="footnote" color={c.text2} style={{ fontWeight: "400" }}>
                {sheet.message}
              </T>
            ) : null}
          </View>
          <ScrollView>
            {sheet?.options.map((o) => (
              <Pressable
                key={o.label}
                accessibilityRole="button"
                accessibilityState={{ selected: !!o.selected }}
                onPress={() => {
                  close();
                  o.onPress();
                }}
                style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 20, justifyContent: "center", backgroundColor: pressed ? c.subtle : "transparent" })}
              >
                <T variant="body" color={o.destructive ? c.danger : o.selected ? c.primaryText : c.text} style={{ fontWeight: o.selected ? "600" : "400" }}>
                  {o.selected ? `${o.label}  ✓` : o.label}
                </T>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={close} style={{ minHeight: 52, marginHorizontal: 16, marginTop: 4, borderRadius: radius.card, backgroundColor: c.card, borderWidth: 1, borderColor: c.outline, alignItems: "center", justifyContent: "center" }}>
            <T variant="headline">취소</T>
          </Pressable>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

export function useActionSheet() {
  return useContext(Ctx);
}
