import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Animated, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Collapse } from "@/components/Collapse";
import { Icon } from "@/components/Icon";
import { KeyboardAware } from "@/components/KeyboardAware";
import { ErrorBanner, PrimaryButton, T } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { getGoogleIdToken, googleAvailable } from "@/lib/google";
import { EASE_OUT, prefersReducedMotion } from "@/lib/motion";
import { devicePushToken } from "@/lib/push";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/tokens";

type Page = "login" | "signup" | "sent";

// Login and signup share one layout (canvas: Login / LoginSignup / LoginSent); only the words change.
const COPY = {
  login: {
    lead: "웹과 같은 계정으로 로그인하면 일정이 그대로 이어져요.",
    google: "Google 계정으로 로그인",
    googleBusy: "Google 로그인 중…",
    section: "이름과 사번으로 로그인",
    cta: "로그인",
    note: "승인된 계정만 로그인할 수 있어요.",
    switchQ: "계정이 없으신가요?",
    switchLabel: "회원가입",
  },
  signup: {
    lead: "가입하면 운영자가 승인한 뒤 바로 쓸 수 있어요.",
    google: "Google 계정으로 가입",
    googleBusy: "Google 가입 중…",
    section: "이름과 사번으로 가입",
    cta: "가입 요청",
    note: "사번은 한 사람에 하나만 등록돼요. 승인 전에는 로그인할 수 없어요.",
    switchQ: "이미 계정이 있으신가요?",
    switchLabel: "로그인",
  },
} as const;

export default function LoginScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { signInGuest, signInGoogle } = useSession();
  const [page, setPage] = useState<Page>("login");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [sent, setSent] = useState<{ name: string; employeeId: string } | null>(null);
  const [busy, setBusy] = useState<"guest" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<ComponentRef<typeof TextInput>>(null);
  const copy = COPY[page === "signup" ? "signup" : "login"];

  function go(next: Page) {
    setPage(next);
    setOpen(false);
    setError(null);
  }

  function toggle() {
    setOpen(!open);
  }

  async function submit() {
    const n = name.trim();
    const id = employeeId.trim();
    if (!n || !id) {
      setError("이름과 사번을 입력해 주세요.");
      return;
    }
    setBusy("guest");
    setError(null);
    try {
      if (page === "signup") {
        // Sent with the request so the "가입 승인" push reaches this phone once an operator approves.
        const pushToken = await devicePushToken();
        await api("/api/auth/register", { method: "POST", body: { name: n, employeeId: id, ...(pushToken ? { pushToken } : null) } });
        setSent({ name: n, employeeId: id });
        go("sent");
      } else {
        await signInGuest(n, id);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function google() {
    setBusy("google");
    setError(null);
    try {
      // Same call for both pages: a new Google account becomes a pending signup on the server,
      // and the app then shows the approval-waiting screen.
      const token = await getGoogleIdToken();
      if (token) await signInGoogle(token);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const field = { ...type.body, fontSize: 16, color: c.text, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.control, backgroundColor: c.surface } as const;
  const pad = { flexGrow: 1, justifyContent: "center" as const, paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 24 };

  if (page === "sent" && sent) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: c.surface }} contentContainerStyle={pad}>
        <View style={{ gap: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.okContainer, alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={28} color={c.onOk} />
          </View>
          <T variant="title1" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 33 }}>
            가입 요청을 보냈어요
          </T>
          <T variant="body" color={c.text2} style={{ fontSize: 15, lineHeight: 22 }}>
            운영자가 승인하면 이름과 사번으로 로그인할 수 있어요. 승인되면 알림으로 알려 드려요.
          </T>
        </View>
        <View style={{ borderRadius: radius.card, backgroundColor: c.subtle, paddingHorizontal: 18, paddingVertical: 4 }}>
          <InfoRow label="이름" value={sent.name} />
          <InfoRow label="사번" value={sent.employeeId} divider />
          <InfoRow label="상태" value="승인 대기" color={c.onWarn} divider />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => go("login")}
          style={({ pressed }) => ({ minHeight: 56, borderRadius: radius.control, backgroundColor: pressed ? c.fill : c.subtle, alignItems: "center", justifyContent: "center" })}
        >
          <T variant="headline" style={{ fontSize: 17 }}>
            로그인으로 돌아가기
          </T>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAware style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={pad}>
        <View style={{ gap: 8 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.text, alignItems: "center", justifyContent: "center" }}>
            <T variant="title2" color={c.surface} style={{ fontWeight: "700" }}>
              31
            </T>
          </View>
          <T variant="title1" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36 }}>
            그룹 캘린더
          </T>
          <T variant="body" color={c.text2} style={{ fontSize: 15, lineHeight: 22 }}>
            {copy.lead}
          </T>
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        {googleAvailable ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: busy === "google", disabled: busy != null }}
              onPress={google}
              disabled={busy != null}
              style={({ pressed }) => ({ minHeight: 56, borderRadius: radius.control, backgroundColor: pressed ? c.fill : c.subtle, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 })}
            >
              <GoogleLogo />
              <T variant="headline" style={{ fontSize: 17 }}>
                {busy === "google" ? copy.googleBusy : copy.google}
              </T>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <View style={{ flex: 1, height: 1, backgroundColor: c.outline }} />
              <T variant="footnote" color={c.muted} style={{ fontWeight: "600" }}>
                또는
              </T>
              <View style={{ flex: 1, height: 1, backgroundColor: c.outline }} />
            </View>
          </>
        ) : null}

        {/* 이름과 사번으로 …: closed by default; the header opens it. */}
        <View style={{ borderRadius: 16, backgroundColor: c.subtle, overflow: "hidden" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={toggle}
            style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 })}
          >
            {/* Spacer as wide as the chevron, so the label sits in the true center of the bar. */}
            <View style={{ width: 22 }} />
            <T variant="body" style={{ flex: 1, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
              {copy.section}
            </T>
            <Chevron open={open} />
          </Pressable>
          <Collapse open={open}>
            <View style={{ gap: 10, paddingHorizontal: 12, paddingBottom: 14 }}>
              <TextInput
                accessibilityLabel="이름"
                value={name}
                onChangeText={setName}
                placeholder="이름"
                placeholderTextColor={c.muted}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => idRef.current?.focus()}
                submitBehavior="submit"
                style={field}
              />
              <TextInput
                ref={idRef}
                accessibilityLabel="사번"
                value={employeeId}
                onChangeText={setEmployeeId}
                placeholder="사번"
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={submit}
                style={field}
              />
              <PrimaryButton label={copy.cta} onPress={submit} busy={busy === "guest"} disabled={busy === "google"} />
              <T variant="footnote" color={c.muted} style={{ marginHorizontal: 4, fontWeight: "400", lineHeight: 19 }}>
                {copy.note}
              </T>
            </View>
          </Collapse>
        </View>

        {/* Small switch link at the bottom right, like a website's "계정이 없으신가요? 회원가입". */}
        <View style={{ marginTop: -8, marginHorizontal: 4, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
          <T variant="footnote" color={c.muted}>
            {copy.switchQ}
          </T>
          <Pressable accessibilityRole="button" onPress={() => go(page === "signup" ? "login" : "signup")} hitSlop={8} style={{ minHeight: 32, justifyContent: "center", paddingHorizontal: 2 }}>
            <T variant="footnote" color={c.primaryText} style={{ fontWeight: "700", textDecorationLine: "underline" }}>
              {copy.switchLabel}
            </T>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAware>
  );
}

function Chevron({ open }: { open: boolean }) {
  const { c } = useTheme();
  const [turn] = useState(() => new Animated.Value(open ? 1 : 0));
  useEffect(() => {
    const a = Animated.timing(turn, { toValue: open ? 1 : 0, duration: prefersReducedMotion() ? 0 : 240, easing: EASE_OUT, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [open, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon name="down" size={22} color={c.text2} />
    </Animated.View>
  );
}

function InfoRow({ label, value, color, divider }: { label: string; value: string; color?: string; divider?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: divider ? 1 : 0, borderTopColor: c.outline }}>
      <T variant="body" color={c.text2} style={{ fontSize: 15 }}>
        {label}
      </T>
      <T variant="body" color={color} style={{ fontSize: 15, fontWeight: "600" }}>
        {value}
      </T>
    </View>
  );
}

/** Google "G" mark (brand colors, used as-is per Google's sign-in button guidelines). */
function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}
