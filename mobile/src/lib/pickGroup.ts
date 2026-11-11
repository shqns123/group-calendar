import { ActionSheetIOS, Alert, Platform } from "react-native";
import type { Group } from "./types";

/** Native group chooser: action sheet on iOS, dialog on Android/web. */
export function pickGroup(groups: Group[], currentId: string | null, onSelect: (id: string) => void) {
  if (groups.length <= 1) return;
  const names = groups.map((g) => (g.id === currentId ? `${g.name} ✓` : g.name));
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: "그룹 전환", options: [...names, "취소"], cancelButtonIndex: names.length },
      (i) => {
        if (i < groups.length) onSelect(groups[i].id);
      },
    );
    return;
  }
  Alert.alert(
    "그룹 전환",
    undefined,
    [...groups.map((g, i) => ({ text: names[i], onPress: () => onSelect(g.id) })), { text: "취소", style: "cancel" as const }],
    { cancelable: true },
  );
}
