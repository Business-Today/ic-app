import { useEffect, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { scanTextStyles } from "@/components/QrScanContent";
import SymbolIcon from "@/components/SymbolIcon";
import type { NfcReaderState } from "@/hooks/use-nfc-reader";

type Props = {
  state: NfcReaderState;
  /** One line under the status, e.g. the session being checked into. */
  hint?: string;
  /** Extra content (feedback, counts) shown under the hint. */
  footer?: ReactNode;
  onStart: () => void;
  onStop: () => void;
  onOpenSettings?: () => void;
};

const RING_SIZE = 250;
const ICON_DISC = 96;

function describe(state: NfcReaderState) {
  switch (state) {
    case "checking":
      return { title: "Preparing NFC", body: "One moment." };
    case "scanning":
      return {
        title: "Hold a tag to the phone",
        body:
          Platform.OS === "ios"
            ? "Near the top of the phone. The system sheet closes after about a minute; start again to continue."
            : "Against the back of the phone. Reading stays on while this is open.",
      };
    case "stopped":
      return { title: "Paused", body: "Start again to keep checking people in." };
    case "disabled":
      return {
        title: "NFC is off",
        body: "Turn NFC on in the phone settings, then start again.",
      };
    case "unavailable":
      return {
        title: "NFC not available",
        body: "This device or build cannot read tags. Use QR or manual check-in instead.",
      };
    case "idle":
    default:
      return { title: "Tap NFC Tags", body: "Start reading to check people in." };
  }
}

/**
 * The NFC tab of the scanner: a pulsing ring while the reader is live, the
 * reader status, and start / stop controls. Sized like the QR brackets so
 * switching tabs keeps everything in place.
 */
export default function NfcTapView({
  state,
  hint,
  footer,
  onStart,
  onStop,
  onOpenSettings,
}: Props) {
  const pulse = useSharedValue(0);
  const scanning = state === "scanning";

  useEffect(() => {
    if (scanning) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
      return;
    }

    cancelAnimation(pulse);
    pulse.value = withTiming(0, { duration: 200 });
  }, [scanning, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.1, 1], [0, 0.6, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.45, 1]) }],
  }));

  const ringLateStyle = useAnimatedStyle(() => {
    const phase = (pulse.value + 0.5) % 1;
    return {
      opacity: interpolate(phase, [0, 0.1, 1], [0, 0.6, 0]),
      transform: [{ scale: interpolate(phase, [0, 1], [0.45, 1]) }],
    };
  });

  const status = describe(state);
  const problem = state === "disabled" || state === "unavailable";

  return (
    <>
      <View style={styles.rings}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.View style={[styles.ring, ringLateStyle]} />
        <View style={[styles.disc, scanning && styles.discActive]}>
          <SymbolIcon
            name="wave.3.right"
            fallback="radio-outline"
            size={44}
            weight="medium"
            color={scanning ? "#111111" : "#FFFFFF"}
          />
        </View>
        <Text style={[styles.title, problem && styles.titleProblem]}>
          {status.title}
        </Text>
      </View>

      <Text style={styles.statusBody}>{status.body}</Text>

      {hint ? (
        <Text style={scanTextStyles.hint} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}

      {footer ? <View style={scanTextStyles.footer}>{footer}</View> : null}

      <View style={styles.actions}>
        {scanning ? (
          <Pressable
            onPress={onStop}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Stop Reading</Text>
          </Pressable>
        ) : state !== "checking" ? (
          <Pressable
            onPress={onStart}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              styles.buttonPrimary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonText, styles.buttonPrimaryText]}>
              Start Reading
            </Text>
          </Pressable>
        ) : null}

        {state === "disabled" && Platform.OS === "android" && onOpenSettings ? (
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Open NFC Settings</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  rings: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  disc: {
    width: ICON_DISC,
    height: ICON_DISC,
    borderRadius: ICON_DISC / 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  discActive: {
    backgroundColor: "#FFFFFF",
  },
  title: {
    position: "absolute",
    bottom: 0,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: "#FFFFFF",
    textAlign: "center",
  },
  titleProblem: {
    color: "#FF6B62",
  },
  statusBody: {
    fontSize: 15,
    lineHeight: 21,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 24,
  },
  actions: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 16,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  buttonPrimary: {
    backgroundColor: "#FFFFFF",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  buttonPrimaryText: {
    color: "#111111",
  },
  pressed: {
    opacity: 0.7,
  },
});
