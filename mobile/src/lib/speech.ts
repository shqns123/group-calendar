import { requireOptionalNativeModule } from "expo";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Platform } from "react-native";

/**
 * Speech-to-text with the phone's own recognizer (Android: Google speech services, iOS: Apple
 * Speech), Korean. Audio stays on the phone's speech service; nothing goes to our server.
 *
 * expo-speech-recognition throws on import in a build that doesn't include it (an older dev
 * client), so it's loaded only when its native side is there.
 */
type SpeechModule = typeof import("expo-speech-recognition");

const S: SpeechModule | null =
  Platform.OS !== "web" && requireOptionalNativeModule("ExpoSpeechRecognition")
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("expo-speech-recognition") as SpeechModule)
    : null;

/** True when this build can listen (the mic button is hidden otherwise). */
export const speechSupported = S != null;

export type SpeechFailure = "permission" | "unavailable" | "no-speech" | "error";

/**
 * When to stop listening (the recognizer runs in continuous mode and we decide the end, so a
 * stumble or a short pause doesn't cut the sentence off):
 * - SILENCE_MS after the last heard word,
 * - FIRST_WORD_MS if nothing is heard at all,
 * - MAX_MS in any case.
 */
const SILENCE_MS = 2500;
const FIRST_WORD_MS = 7000;
const MAX_MS = 30000;

/**
 * `onText` gets the live transcript while the person speaks; `onDone` gets the final text (or
 * null) once listening stops, with the reason when nothing usable was heard.
 */
export function useSpeech(onText: (text: string) => void, onDone: (text: string | null, failure?: SpeechFailure) => void) {
  const [listening, setListening] = useState(false);
  const handlers = useRef({ onText, onDone });
  useLayoutEffect(() => {
    handlers.current = { onText, onDone };
  });
  const heard = useRef("");
  // Finished segments of a continuous session, and the one still being spoken.
  const done = useRef("");
  const failed = useRef<SpeechFailure | undefined>(undefined);
  const subs = useRef<{ remove: () => void }[]>([]);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cap = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** (Re)start the countdown to stopping: `ms` of quiet ends the session. */
  const waitQuiet = useCallback((ms: number) => {
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(() => S?.ExpoSpeechRecognitionModule.stop(), ms);
  }, []);

  /** Drop the listeners and timers of the current session. */
  const detach = useCallback(() => {
    subs.current.forEach((s) => s.remove());
    subs.current = [];
    if (quiet.current) clearTimeout(quiet.current);
    if (cap.current) clearTimeout(cap.current);
    quiet.current = null;
    cap.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!S) return;
    const M = S.ExpoSpeechRecognitionModule;
    if (!M.isRecognitionAvailable()) {
      handlers.current.onDone(null, "unavailable");
      return;
    }
    const perm = await M.requestPermissionsAsync().catch(() => null);
    if (!perm?.granted) {
      handlers.current.onDone(null, "permission");
      return;
    }
    heard.current = "";
    done.current = "";
    failed.current = undefined;
    detach();
    subs.current = [
      M.addListener("result", (e) => {
        const t = (e.results[0]?.transcript ?? "").trim();
        // Continuous mode sends one segment at a time: keep finished ones, show them + the current.
        const full = [done.current, t].filter(Boolean).join(" ");
        if (e.isFinal) done.current = full;
        heard.current = full;
        handlers.current.onText(full);
        if (full) waitQuiet(SILENCE_MS);
      }),
      M.addListener("error", (e) => {
        if (e.error === "aborted") return;
        failed.current = e.error === "no-speech" || e.error === "speech-timeout" ? "no-speech" : "error";
      }),
      M.addListener("nomatch", () => {
        failed.current = "no-speech";
      }),
      M.addListener("end", () => {
        detach();
        setListening(false);
        const text = heard.current.trim();
        handlers.current.onDone(text || null, text ? undefined : (failed.current ?? "no-speech"));
      }),
    ];
    setListening(true);
    M.start({
      lang: "ko-KR",
      interimResults: true,
      // Keep listening through pauses (Android 13+, iOS); the timers above decide the end.
      continuous: true,
      addsPunctuation: false,
      // Older Android (no continuous mode): ask the recognizer itself to allow longer pauses.
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_MS,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_MS,
      },
    });
    waitQuiet(FIRST_WORD_MS);
    cap.current = setTimeout(() => S?.ExpoSpeechRecognitionModule.stop(), MAX_MS);
  }, [detach, waitQuiet]);

  /** Stop listening and keep what was heard (it arrives through `onDone`). */
  const stop = useCallback(() => {
    S?.ExpoSpeechRecognitionModule.stop();
  }, []);

  // Leaving the screen mid-sentence: drop the session quietly.
  useEffect(
    () => () => {
      if (subs.current.length) {
        detach();
        S?.ExpoSpeechRecognitionModule.abort();
      }
    },
    [detach],
  );

  return { listening, start, stop };
}
