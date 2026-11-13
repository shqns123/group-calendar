import { Keyboard, Pressable } from "react-native";

/**
 * Invisible full-cover layer while the quick-add card is in typing mode: a tap anywhere outside the
 * card only ends typing (keyboard down, card back to a pill) and doesn't reach what's underneath.
 */
export function DismissLayer({ zIndex }: { zIndex?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="입력 닫기"
      onPress={() => Keyboard.dismiss()}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex }}
    />
  );
}
