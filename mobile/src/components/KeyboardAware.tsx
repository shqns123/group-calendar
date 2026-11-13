import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Screen wrapper that keeps inputs above the on-screen keyboard.
 *
 * Android draws edge-to-edge, so the window no longer shrinks when the keyboard opens and
 * KeyboardAvoidingView (which we only enabled on iOS) did nothing — the keyboard covered the
 * fields. Here the screen gets bottom padding as tall as the keyboard, so centered content
 * re-centers above it and scroll views shrink to the space that's left (Android keeps the focused
 * field in view when its scroll view shrinks). iOS keeps the stock KeyboardAvoidingView.
 */
export function KeyboardAware({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView behavior="padding" style={style}>
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <AndroidKeyboardPad style={style}>{children}</AndroidKeyboardPad>;
}

function AndroidKeyboardPad({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const ease = () => {
      if (!prefersReducedMotion()) LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity));
    };
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      ease();
      setKb(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      ease();
      setKb(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // RN reports the keyboard height above the navigation bar; the screen reaches under that bar too.
  const pad = kb > 0 ? kb + insets.bottom : 0;
  return <View style={[{ flex: 1 }, style, { paddingBottom: pad }]}>{children}</View>;
}
