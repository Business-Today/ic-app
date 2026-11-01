import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import SymbolIcon from "@/components/SymbolIcon";

type Props = {
  /** Called once the cover has faded away. Must be stable between renders. */
  onDone: () => void;
};

const DISC_SIZE = 96;
const RING_SIZE = 250;
// How long the screen stays hidden, then how long it takes to reveal.
const HOLD_MS = 700;
const REVEAL_MS = 250;
const MORPH_DELAY_MS = 120;
const MORPH_TIMING = { duration: 420, easing: Easing.inOut(Easing.cubic) };

/**
 * Plays between the NFC and Scan tabs while the camera recovers from the iOS
 * NFC sheet. It is opaque from its first frame, because whatever is underneath
 * must not show, and then fades away to reveal the scanner.
 */
export default function ScanTransitionCover({ onDone }: Props) {
  const reveal = useSharedValue(0);
  const morph = useSharedValue(0);

  useEffect(() => {
    morph.value = withDelay(MORPH_DELAY_MS, withTiming(1, MORPH_TIMING));
    reveal.value = withDelay(
      HOLD_MS,
      withTiming(1, { duration: REVEAL_MS }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      })
    );
  }, [morph, reveal, onDone]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: 1 - reveal.value }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.2, 1], [0, 0.5, 0]),
    transform: [{ scale: interpolate(morph.value, [0, 1], [0.4, 1]) }],
  }));

  const nfcIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.5], [1, 0], "clamp"),
    transform: [{ scale: interpolate(morph.value, [0, 1], [1, 0.6]) }],
  }));

  const scanIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0.5, 1], [0, 1], "clamp"),
    transform: [{ scale: interpolate(morph.value, [0, 1], [0.6, 1]) }],
  }));

  return (
    <Animated.View style={[styles.cover, coverStyle]}>
      <Animated.View style={[styles.ring, ringStyle]} />

      <View style={styles.disc}>
        <Animated.View style={nfcIconStyle}>
          <SymbolIcon
            name="wave.3.right"
            fallback="radio-outline"
            size={44}
            weight="medium"
            color="#FFFFFF"
          />
        </Animated.View>
        <Animated.View style={[styles.scanIcon, scanIconStyle]}>
          <SymbolIcon
            name="qrcode.viewfinder"
            fallback="qr-code-outline"
            size={44}
            weight="medium"
            color="#FFFFFF"
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cover: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C1C1E",
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
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanIcon: {
    position: "absolute",
  },
});
