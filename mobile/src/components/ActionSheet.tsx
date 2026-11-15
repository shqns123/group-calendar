import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Animated, BackHandler, Modal, Pressable, ScrollView, View } from "react-native";
import { DUR, EASE_IN, EASE_OUT, timeTo } from "@/lib/motion";
import { usePaneLeft } from "@/lib/wide";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { T } from "./ui";

export type SheetOption = { label: string; destructive?: boolean; selected?: boolean; onPress: () => void };
type Sheet = { title: string; message?: string; options: SheetOption[] };

const Ctx = createContext<(sheet: Sheet) => void>(() => {});

/**
 * Lists of actions (group switch, default group, user actions …) as a centered popup with round
 * corners, the same look and motion as the confirm popups: fades in while scaling 0.95 → 1
 * (220ms) and leaves faster (180ms). The current choice is marked by its text alone (bold, brand
 * color), no check mark.
 */
export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  // Keep the last sheet on screen while it animates out.
  const [shown, setShown] = useState<Sheet | null>(null);
  if (sheet && sheet !== shown) setShown(sheet);
  const [v] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (sheet) timeTo(v, 1, DUR.open, EASE_OUT);
  }, [sheet, v]);

  const show = useCallback((s: Sheet) => {
    if (s.options.length === 0) return;
    setSheet(s);
  }, []);

  const close = useCallback(() => {
    const leaving = sheet;
    if (!leaving) return;
    timeTo(v, 0, DUR.close, EASE_IN);
    setSheet(null);
    // Unmount after the exit animation (on a timer, so an interrupted animation can't leave an
    // invisible popup catching touches).
    setTimeout(() => setShown((cur) => (cur === leaving ? null : cur)), DUR.close + 40);
  }, [sheet, v]);

  // Android back closes it.
  useEffect(() => {
    if (!sheet) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [sheet, close]);

  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {shown ? (
        <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
          <Popup sheet={shown} v={v} onClose={close} />
        </Modal>
      ) : null}
    </Ctx.Provider>
  );
}

function Popup({ sheet, v, onClose }: { sheet: Sheet; v: Animated.Value; onClose: () => void }) {
  const { c, isDark } = useTheme();
  // Split screen: the popup and its dim wash stay in the right pane; a tap on the calendar side closes.
  const left = usePaneLeft();
  return (
    <View style={{ flex: 1 }}>
      {left ? <Pressable accessible={false} onPress={onClose} style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: left }} /> : null}
      <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, left, justifyContent: "center", paddingHorizontal: 28 }}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: v }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            style={{ flex: 1, backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.32)" }}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={{
            maxHeight: "75%",
            opacity: v,
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
            backgroundColor: c.card,
            borderRadius: radius.sheet,
            paddingTop: 24,
            paddingBottom: 12,
            shadowColor: "#0F172A",
            shadowOpacity: isDark ? 0.5 : 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
            elevation: 12,
          }}
        >
          <View style={{ paddingHorizontal: 24, paddingBottom: 10, gap: 6 }}>
            <T variant="headline" accessibilityRole="header">
              {sheet.title}
            </T>
            {sheet.message ? (
              <T variant="subhead" color={c.text2}>
                {sheet.message}
              </T>
            ) : null}
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {sheet.options.map((o) => (
              <Pressable
                key={o.label}
                accessibilityRole="button"
                accessibilityState={{ selected: !!o.selected }}
                onPress={() => {
                  onClose();
                  o.onPress();
                }}
                style={({ pressed }) => ({
                  minHeight: 50,
                  paddingHorizontal: 12,
                  borderRadius: radius.control,
                  justifyContent: "center",
                  backgroundColor: pressed ? c.subtle : "transparent",
                })}
              >
                <T variant="body" color={o.destructive ? c.danger : o.selected ? c.primaryText : c.text} style={{ fontWeight: o.selected ? "700" : "400" }}>
                  {o.label}
                </T>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 12, paddingTop: 6 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="취소"
              onPress={onClose}
              style={({ pressed }) => ({ minHeight: 48, minWidth: 88, paddingHorizontal: 16, borderRadius: radius.control, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.subtle : "transparent" })}
            >
              <T variant="body" style={{ fontWeight: "600" }}>
                취소
              </T>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

export function useActionSheet() {
  return useContext(Ctx);
}
