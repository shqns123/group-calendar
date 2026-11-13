import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorBanner, PrimaryButton, T } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { getGoogleIdToken, googleAvailable } from "@/lib/google";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/tokens";
import { KeyboardAware } from "@/components/KeyboardAware";

export default function LoginScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { signInGuest, signInGoogle } = useSession();
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [busy, setBusy] = useState<"guest" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guest() {
    if (!name.trim() || !employeeId.trim()) {
      setError("이름과 사번을 입력해 주세요.");
      return;
    }
    setBusy("guest");
    setError(null);
    try {
      await signInGuest(name.trim(), employeeId.trim());
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
      const token = await getGoogleIdToken();
      if (token) await signInGoogle(token);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const field = { ...type.body, color: c.text, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.control, backgroundColor: c.subtle } as const;

  return (
    <KeyboardAware style={{ flex: 1, backgroundColor: c.surface }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: insets.top + 24, gap: 24 }}>
        <View style={{ gap: 8 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.text, alignItems: "center", justifyContent: "center" }}>
            <T variant="title2" color={c.surface}>
              31
            </T>
          </View>
          <T variant="title1" accessibilityRole="header">
            그룹 캘린더
          </T>
          <T variant="subhead" color={c.text2}>
            웹과 같은 계정으로 로그인하면 일정이 그대로 이어져요.
          </T>
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        {googleAvailable ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={google}
              disabled={busy != null}
              style={({ pressed }) => ({ minHeight: 56, borderRadius: radius.control, backgroundColor: pressed ? c.fill : c.subtle, alignItems: "center", justifyContent: "center" })}
            >
              <T variant="headline">{busy === "google" ? "Google 로그인 중…" : "Google 계정으로 계속"}</T>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.outline }} />
              <T variant="footnote" color={c.muted}>
                또는
              </T>
              <View style={{ flex: 1, height: 1, backgroundColor: c.outline }} />
            </View>
          </>
        ) : null}

        <View style={{ gap: 10 }}>
          <T variant="footnote" color={c.text2}>
            이름과 사번으로 로그인
          </T>
          <TextInput accessibilityLabel="이름" value={name} onChangeText={setName} placeholder="이름" placeholderTextColor={c.muted} autoComplete="name" textContentType="name" returnKeyType="next" style={field} />
          <TextInput accessibilityLabel="사번" value={employeeId} onChangeText={setEmployeeId} placeholder="사번" placeholderTextColor={c.muted} autoCapitalize="none" returnKeyType="go" onSubmitEditing={guest} style={field} />
          <PrimaryButton label="로그인" onPress={guest} busy={busy === "guest"} disabled={busy === "google"} />
          <T variant="footnote" color={c.muted} style={{ fontWeight: "400" }}>
            이름+사번 로그인은 웹에서 승인된 계정만 쓸 수 있어요.
          </T>
        </View>
      </ScrollView>
    </KeyboardAware>
  );
}
