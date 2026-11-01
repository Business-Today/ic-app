import { useEffect, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  LayoutAnimationConfig,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { TAB_IN, TAB_OUT, scanTextStyles } from "@/components/QrScanContent";
import SymbolIcon from "@/components/SymbolIcon";
import type { NfcReaderState } from "@/hooks/use-nfc-reader";

/** The wording that depends on what the tags are being read for. */
export type TapCopy = {
  idleTitle: string;
  idleBody: string;
  /** Shown while the reader is live. */
  holdTitle: string;
  /** Shown above the iOS sheet. */
  readingTitle: string;
  stoppedBody: string;
  unavailableBody: string;
};

const CHECK_IN_COPY: TapCopy = {
  idleTitle: "Tap Tags",
  idleBody: "Start reading to check people in.",
  holdTitle: "Hold a tag to the phone",
  readingTitle: "Reading Tags",
  stoppedBody: "Start again to keep checking people in.",
  unavailableBody:
    "This device or build cannot read tags. Use QR or manual check-in instead.",
};

type Props = {
  state: NfcReaderState;
  /** Defaults to the wording for checking people in. */
  copy?: TapCopy;
  /** One line under the status, e.g. the session being checked into. */
  hint?: string;
  /** Extra content (feedback, counts) shown under the hint. */
  footer?: ReactNode;
  /** How far the pulse reaches above the iOS sheet. */
  compactRingSize?: number;
  /** Draws the buttons as centred pills with more room above them. */
  pillButtons?: boolean;
  /** Extra button, left out while the iOS NFC sheet is blocking touches. */
  action?: ReactNode;
  onStart: () => void;
  onStop: () => void;
  onOpenSettings?: () => void;
};

const RING_SIZE = 250;
const ICON_DISC = 96;
const COMPACT_RING_SIZE = 128;
const COMPACT_ICON_DISC = 56;
const LIVE_FADE_MS = 200;

function describe(state: NfcReaderState, copy: TapCopy) {
  switch (state) {
    case "checking":
      return { title: "Preparing Tap", body: "One moment." };
    case "scanning":
      return {
        title: copy.holdTitle,
        body: "Against the back of the phone. Reading stays on while this is open.",
      };
    case "stopped":
      return { title: "Paused", body: copy.stoppedBody };
    case "disabled":
      return {
        title: "Tap is off",
        // The phone's own setting is called NFC, so this has to say so.
        body: "Turn NFC on in the phone settings, then start again.",
      };
    case "unavailable":
      return {
        title: "Tap not available",
        body: copy.unavailableBody,
      };
    case "idle":
    default:
      return { title: copy.idleTitle, body: copy.idleBody };
  }
}

/**
 * The NFC tab of the scanner: a pulsing ring while the reader is live, the
 * reader status, and start / stop controls. Sized like the QR brackets so
 * switching tabs keeps everything in place.
 *
 * While the iOS NFC sheet is up it covers the lower half of the screen and
 * blocks touches, so this shrinks to a compact status above it and drops the
 * controls. Closing the sheet brings the full view back. The two views swap
 * in place with the same fade as switching tabs, so nothing moves between them.
 */
export default function NfcTapView({
  state,
  copy = CHECK_IN_COPY,
  hint,
  footer,
  compactRingSize = COMPACT_RING_SIZE,
  pillButtons = false,
  action,
  onStart,
  onStop,
  onOpenSettings,
}: Props) {
  const scanning = state === "scanning";
  // "checking" lasts a moment, and counting it skips a flash of the full view.
  const compact = Platform.OS === "ios" && (scanning || state === "checking");

  const pulse = useSharedValue(0);
  // 0 = reader off, 1 = reader live.
  const live = useSharedValue(scanning ? 1 : 0);

  useEffect(() => {
    live.value = withTiming(scanning ? 1 : 0, { duration: LIVE_FADE_MS });

    if (scanning) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
      return;
    }

    // The rings hold where they are while `live` fades them out.
    cancelAnimation(pulse);
  }, [scanning, pulse, live]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.1, 1], [0, 0.6, 0]) * live.value,
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.45, 1]) }],
  }));

  const ringLateStyle = useAnimatedStyle(() => {
    const phase = (pulse.value + 0.5) % 1;
    return {
      opacity: interpolate(phase, [0, 0.1, 1], [0, 0.6, 0]) * live.value,
      transform: [{ scale: interpolate(phase, [0, 1], [0.45, 1]) }],
    };
  });

  const discLiveStyle = useAnimatedStyle(() => ({ opacity: live.value }));

  const status = describe(state, copy);
  const problem = state === "disabled" || state === "unavailable";

  const compactRing = {
    width: compactRingSize,
    height: compactRingSize,
    borderRadius: compactRingSize / 2,
    borderWidth: 2.5,
  };

  const beacon = (
    <>
      <Animated.View
        style={[styles.ring, compact && compactRing, ringStyle]}
      />
      <Animated.View
        style={[styles.ring, compact && compactRing, ringLateStyle]}
      />
      <View style={[styles.disc, compact && styles.discCompact]}>
        <SymbolIcon
          name="wave.3.right"
          fallback="radio-outline"
          size={compact ? 26 : 44}
          weight="medium"
          color="#FFFFFF"
        />
        <Animated.View style={[styles.discLive, discLiveStyle]}>
          <SymbolIcon
            name="wave.3.right"
            fallback="radio-outline"
            size={compact ? 26 : 44}
            weight="medium"
            color="#111111"
          />
        </Animated.View>
      </View>
    </>
  );

  return (
    // Fades are for moving between the two views, not for switching tabs.
    <LayoutAnimationConfig skipEntering skipExiting>
      {compact ? (
        <Animated.View
          key="compact"
          entering={TAB_IN}
          exiting={TAB_OUT}
          style={[styles.root, styles.rootCompact]}
        >
          <View
            style={[
              styles.ringsCompact,
              { width: compactRingSize, height: compactRingSize },
            ]}
          >
            {beacon}
          </View>

          <Text style={styles.title}>{copy.readingTitle}</Text>

          {hint ? (
            <Text
              style={[scanTextStyles.hint, styles.hintCompact]}
              numberOfLines={2}
            >
              {hint}
            </Text>
          ) : null}

          {footer ? (
            <View style={[scanTextStyles.footer, styles.footerCompact]}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      ) : (
        <Animated.View
          key="full"
          entering={TAB_IN}
          exiting={TAB_OUT}
          style={[styles.root, styles.rootFull]}
        >
          <View style={styles.rings}>
            {beacon}
            <Text
              style={[
                styles.title,
                styles.titleInRings,
                problem && styles.titleProblem,
              ]}
            >
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

          <View style={[styles.actions, pillButtons && styles.actionsPill]}>
            {action}

            {scanning ? (
              <Pressable
                onPress={onStop}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  pillButtons && styles.buttonPill,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.buttonText}>Stop Reading</Text>
              </Pressable>
            ) : state !== "checking" ? (
              <Pressable
                onPress={onStart}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  pillButtons && styles.buttonPill,
                  styles.buttonPrimary,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, styles.buttonPrimaryText]}>
                  Start Reading
                </Text>
              </Pressable>
            ) : null}

            {state === "disabled" &&
            Platform.OS === "android" &&
            onOpenSettings ? (
              <Pressable
                onPress={onOpenSettings}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  pillButtons && styles.buttonPill,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.buttonText}>Open Settings</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      )}
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  rootFull: {
    bottom: 12,
  },
  // Centred in the gap above the iOS NFC sheet. Changing this share of the tab
  // moves the whole compact view up or down.
  rootCompact: {
    height: "70%",
  },
  rings: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringsCompact: {
    marginBottom: 12,
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
  discCompact: {
    width: COMPACT_ICON_DISC,
    height: COMPACT_ICON_DISC,
    borderRadius: COMPACT_ICON_DISC / 2,
  },
  discLive: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: ICON_DISC / 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: "#FFFFFF",
    textAlign: "center",
  },
  titleInRings: {
    position: "absolute",
    bottom: 0,
  },
  titleProblem: {
    color: "#FF6B62",
  },
  hintCompact: {
    marginTop: 4,
  },
  footerCompact: {
    marginTop: 24,
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
  actionsPill: {
    alignItems: "center",
    marginTop: 32,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  buttonPill: {
    borderRadius: 999,
    paddingHorizontal: 36,
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
