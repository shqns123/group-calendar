import { View } from "react-native";
import { PrimaryButton, T } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";

// The session token records the account status at sign-in, so after the
// operator approves the account the user signs in again to get a fresh token.
export default function PendingScreen() {
  const { c } = useTheme();
  const { signOut } = useSession();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, justifyContent: "center", padding: 24, gap: 16 }}>
      <T variant="title1" accessibilityRole="header">
        가입 승인 대기 중
      </T>
      <T variant="body" color={c.text2}>
        운영자가 승인하면 일정을 볼 수 있어요. 승인 알림을 받았다면 다시 로그인해 주세요.
      </T>
      <PrimaryButton label="다시 로그인" onPress={signOut} />
    </View>
  );
}
