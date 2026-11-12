import { Alert, Platform } from "react-native";

/** Native confirm dialog; resolves true when the user confirms. Web preview uses window.confirm. */
export function confirm(title: string, message: string, confirmLabel = "확인", destructive = false): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(`${title}\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "취소", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}

export function notice(title: string, message?: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
