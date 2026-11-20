import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState, type ReactNode } from "react";
import { Animated, Linking, Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { HOSTED_WEB } from "@/lib/api";
import { todayKey } from "@/lib/date";
import { DUR, EASE_IN, EASE_OUT, timeTo } from "@/lib/motion";
import { APP_VERSION, RELEASE_NOTES, type ReleaseSection } from "@/lib/releaseNotes";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/tokens";
import { Icon } from "./Icon";
import { PrimaryButton, T } from "./ui";

/**
 * After sign-in, once per app launch:
 * 1. If the store has a newer version (checkStoreUpdate), an update popup (나중에 하기 / 지금 하기).
 * 2. Then this version's release notes (lib/releaseNotes), unless hidden for today or for good.
 */

// --- Tiny persistent store (SecureStore; memory on the web preview).
const mem = new Map<string, string>();
async function getPref(key: string) {
  if (HOSTED_WEB) return localStorage.getItem(key);
  if (Platform.OS === "web") return mem.get(key) ?? null;
  return SecureStore.getItemAsync(key).catch(() => null);
}
async function setPref(key: string, value: string) {
  if (Platform.OS === "web") {
    if (HOSTED_WEB) localStorage.setItem(key, value);
    else mem.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value).catch(() => undefined);
}
/** Per version: "forever", or "today:YYYY-MM-DD" (hidden for that day only). */
const noticeKey = (version: string) => `release-notes-${version.replace(/[^0-9a-zA-Z]/g, "_")}`;

type StoreUpdate = { latest: string; immediate: boolean };

/**
 * Newer version on Google Play? Asks Play's in-app updates API (expo-in-app-updates). Play answers
 * only for an app installed from Play; a sideloaded APK (or a build without the native module)
 * gets null, so no popup. `latest` is Play's versionCode (Play doesn't tell the version name).
 */
async function checkStoreUpdate(): Promise<StoreUpdate | null> {
  if (Platform.OS !== "android") return null;
  try {
    const { checkForUpdate } = await import("expo-in-app-updates");
    const info = await checkForUpdate();
    if (!info.updateAvailable) return null;
    return { latest: info.storeVersion ?? "", immediate: !!info.immediateAllowed };
  } catch {
    return null;
  }
}

/**
 * 지금 하기: Play's full-screen update (downloads, installs and restarts the app) when Play allows
 * it, else Play's background update, else the store page.
 */
async function startStoreUpdate(update: StoreUpdate | null) {
  try {
    const { startUpdate } = await import("expo-in-app-updates");
    if (await startUpdate(update?.immediate ? true : undefined)) return;
  } catch {
    // fall through to the store page
  }
  openStore();
}
const PACKAGE = "kr.groupcalendar.app";
const BUILD = Constants.expoConfig?.android?.versionCode;

// "나중에 하기" lasts for this app run.
let updateSnoozed = false;

export function WhatsNew({ enabled }: { enabled: boolean }) {
  const [step, setStep] = useState<"idle" | "update" | "notes" | "done">("idle");
  const [update, setUpdate] = useState<StoreUpdate | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      // 1. Newer version in the store? (Android only.)
      if (Platform.OS === "android" && !updateSnoozed) {
        const found = await checkStoreUpdate().catch(() => null);
        if (alive && found) {
          setUpdate(found);
          setStep("update");
          return;
        }
      }
      if (alive) setStep((await notesHidden()) ? "done" : "notes");
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  async function afterUpdate() {
    setStep((await notesHidden()) ? "done" : "notes");
  }

  if (!enabled) return null;
  return (
    <>
      <UpdatePopup
        visible={step === "update"}
        latest={update?.latest ?? ""}
        onLater={() => {
          updateSnoozed = true;
          void afterUpdate();
        }}
        onNow={() => {
          void startStoreUpdate(update);
          void afterUpdate();
        }}
      />
      <NotesPopup visible={step === "notes"} onClose={() => setStep("done")} />
    </>
  );
}

async function notesHidden() {
  if (!RELEASE_NOTES[APP_VERSION]) return true;
  const v = await getPref(noticeKey(APP_VERSION));
  return v === "forever" || v === `today:${todayKey()}`;
}

function openStore() {
  const market = `market://details?id=${PACKAGE}`;
  const web = `https://play.google.com/store/apps/details?id=${PACKAGE}`;
  void Linking.openURL(Platform.OS === "android" ? market : web).catch(() => Linking.openURL(web).catch(() => undefined));
}

// --- Popup shell: dim wash + centered card that fades and scales in (same as the app's dialogs).
function Popup({ visible, onDismiss, children }: { visible: boolean; onDismiss?: () => void; children: ReactNode }) {
  const { c, isDark } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const [v] = useState(() => new Animated.Value(0));
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    if (visible) timeTo(v, 1, DUR.open, EASE_OUT);
    else timeTo(v, 0, DUR.close, EASE_IN, true, () => setMounted(false));
  }, [visible, v]);
  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: v }}>
          <Pressable accessible={false} onPress={onDismiss} style={{ flex: 1, backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.32)" }} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={{
            opacity: v,
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
            backgroundColor: c.card,
            borderRadius: radius.sheet,
            overflow: "hidden",
            shadowColor: "#0F172A",
            shadowOpacity: isDark ? 0.5 : 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
            elevation: 12,
          }}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function UpdatePopup({ visible, latest, onLater, onNow }: { visible: boolean; latest: string; onLater: () => void; onNow: () => void }) {
  const { c } = useTheme();
  return (
    <Popup visible={visible} onDismiss={onLater}>
      <View style={{ padding: 24, paddingBottom: 16, gap: 8 }}>
        <T variant="headline" accessibilityRole="header" style={{ fontSize: 18 }}>
          새 버전이 나왔어요
        </T>
        <T variant="body" color={c.text2} style={{ fontSize: 15, lineHeight: 22 }}>
          원활한 사용을 위해 업데이트해 주세요.
        </T>
        <T variant="footnote" color={c.muted} style={{ fontWeight: "400" }}>
          {`현재 ${APP_VERSION}${BUILD ? ` (빌드 ${BUILD})` : ""}${latest ? ` → 새 빌드 ${latest}` : ""}`}
        </T>
      </View>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onLater}
          style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.control, backgroundColor: pressed ? c.fill : c.subtle, alignItems: "center", justifyContent: "center" })}
        >
          <T variant="headline" style={{ fontSize: 16 }}>
            나중에 하기
          </T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onNow}
          style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.control, backgroundColor: c.primary, opacity: pressed ? 0.85 : 1, alignItems: "center", justifyContent: "center" })}
        >
          <T variant="headline" color={c.onPrimary} style={{ fontSize: 16 }}>
            지금 하기
          </T>
        </Pressable>
      </View>
    </Popup>
  );
}

function NotesPopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const note = RELEASE_NOTES[APP_VERSION];
  const [hide, setHide] = useState<"none" | "today" | "forever">("none");
  if (!note) return null;

  function close() {
    if (hide === "forever") void setPref(noticeKey(APP_VERSION), "forever");
    else if (hide === "today") void setPref(noticeKey(APP_VERSION), `today:${todayKey()}`);
    onClose();
  }

  return (
    <Popup visible={visible} onDismiss={close}>
      <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerStyle={{ padding: 22, paddingBottom: 12, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <T variant="footnote" color={c.text2}>
            {note.date}
          </T>
          <T variant="title2" accessibilityRole="header" style={{ fontSize: 20, lineHeight: 27, fontWeight: "700" }}>
            {note.title}
          </T>
          <T variant="body" color={c.text2} style={{ fontSize: 14, lineHeight: 21 }}>
            {note.lead}
          </T>
        </View>
        {note.sections.map((s) => (
          <Section key={s.title} s={s} />
        ))}
      </ScrollView>

      {/* Small "don't show" options, then 닫기. */}
      <View style={{ borderTopWidth: 1, borderTopColor: c.outline, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
          <Check label="오늘 하루 보지 않기" on={hide === "today"} onPress={() => setHide(hide === "today" ? "none" : "today")} />
          <Check label="다시 보지 않기" on={hide === "forever"} onPress={() => setHide(hide === "forever" ? "none" : "forever")} />
        </View>
        <PrimaryButton label="닫기" onPress={close} />
      </View>
    </Popup>
  );
}

function Check({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          borderWidth: on ? 0 : 1.5,
          borderColor: c.strong,
          backgroundColor: on ? c.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {on ? <Icon name="check" size={13} color={c.onPrimary} /> : null}
      </View>
      <T variant="footnote" color={c.text2} style={{ fontSize: 13, fontWeight: "400" }}>
        {label}
      </T>
    </Pressable>
  );
}

function Section({ s }: { s: ReleaseSection }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.subtle, borderRadius: radius.control, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.primaryContainer, alignItems: "center", justifyContent: "center" }}>
          <Icon name={s.icon} size={16} color={c.onPrimaryContainer} />
        </View>
        <T variant="headline" accessibilityRole="header" style={{ fontSize: 15 }}>
          {s.title}
        </T>
      </View>
      {s.body ? (
        <T variant="body" style={{ fontSize: 14, lineHeight: 21 }}>
          {s.body}
        </T>
      ) : null}
      {s.examples ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} accessibilityLabel={`예: ${s.examples.join(", ")}`}>
          {s.examples.map((x) => (
            <View key={x} style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: c.card }}>
              <T variant="caption" color={c.text2} style={{ fontSize: 12, fontWeight: "500" }}>
                {x}
              </T>
            </View>
          ))}
        </View>
      ) : null}
      {s.steps?.map((x, i) => (
        <View key={x} style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.card, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
            <T variant="caption" style={{ fontWeight: "700", fontSize: 11 }}>
              {i + 1}
            </T>
          </View>
          <T variant="body" style={{ flex: 1, fontSize: 14, lineHeight: 21 }}>
            {x}
          </T>
        </View>
      ))}
      {s.note ? (
        <T variant="footnote" color={c.text2} style={{ fontSize: 12, lineHeight: 18, fontWeight: "400" }}>
          {s.note}
        </T>
      ) : null}
      {s.bullets?.map((x) => (
        <View key={x} style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.text2, marginTop: 9 }} />
          <T variant="body" style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>
            {x}
          </T>
        </View>
      ))}
    </View>
  );
}
