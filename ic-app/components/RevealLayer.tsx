import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import SymbolIcon from "@/components/SymbolIcon";

/** Size of the area exposed above the lowered interface. */
export type RevealLayout = {
  /** Height of the exposed area, from the top of the screen. */
  height: number;
  /** Status bar / notch inset the content should clear. */
  topInset: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * The full-screen layer behind the interface. Mounted only while the
   * interface is lowered or on its way back up.
   */
  renderContent: (layout: RevealLayout) => ReactNode;
  /** The interface that slides down. */
  children: ReactNode;
};

// How much of the lowered interface stays visible, measured from the top of
// the sheet. The sheet's own safe-area padding sits inside this, so the title
// row of the page underneath remains in view.
const PEEK_BELOW_INSET = 84;
const SHEET_RADIUS = 32;
const SPRING = { damping: 24, stiffness: 240, mass: 1 };

/**
 * Pulls the wrapped interface down like a sheet to reveal a full-screen
 * layer underneath, leaving the sheet's top edge peeking at the bottom.
 * Swiping the sheet up, tapping it, or pressing the arrow puts it back.
 */
export default function RevealLayer({
  open,
  onClose,
  renderContent,
  children,
}: Props) {
  const insets = useSafeAreaInsets();

  // The layer stays mounted until the sheet has fully covered it again.
  const [visible, setVisible] = useState(open);
  const [height, setHeight] = useState(0);

  // Mount the layer the moment it is asked to open, before the first frame.
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setVisible(true);
  }

  // Distance the sheet travels, which is also the height of the exposed area.
  const travel = Math.max(height - insets.top - PEEK_BELOW_INSET, 1);

  // 0 = interface in place, 1 = fully lowered.
  const progress = useSharedValue(0);
  const dragStart = useSharedValue(0);
  // Carried from a dismissing swipe into the closing spring so the sheet
  // keeps the finger's momentum.
  const releaseVelocity = useSharedValue(0);

  function handleLayout(event: LayoutChangeEvent) {
    setHeight(event.nativeEvent.layout.height);
  }

  // --- Gestures -----------------------------------------------------------
  const pan = Gesture.Pan()
    .enabled(open)
    .activeOffsetY([-8, 8])
    .onStart(() => {
      dragStart.value = progress.value;
    })
    .onUpdate((event) => {
      const raw = dragStart.value + event.translationY / travel;
      // Resist pulling further down than fully open.
      progress.value = raw > 1 ? 1 + (raw - 1) * 0.12 : Math.max(raw, 0);
    })
    .onEnd((event) => {
      const flickUp = event.velocityY < -600;
      const flickDown = event.velocityY > 600;
      const dismiss = flickUp || (!flickDown && progress.value < 0.55);

      if (dismiss) {
        releaseVelocity.value = event.velocityY / travel;
        scheduleOnRN(onClose);
      } else {
        progress.value = withSpring(1, {
          ...SPRING,
          velocity: event.velocityY / travel,
        });
      }
    });

  const tap = Gesture.Tap()
    .enabled(open)
    .onEnd(() => {
      scheduleOnRN(onClose);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  useEffect(() => {
    if (open) {
      progress.value = withSpring(1, SPRING);
      return;
    }

    const velocity = releaseVelocity.value;
    releaseVelocity.value = 0;

    progress.value = withSpring(0, { ...SPRING, velocity }, (finished) => {
      if (finished) scheduleOnRN(setVisible, false);
    });
  }, [open, progress, releaseVelocity]);

  // --- Animated styles ----------------------------------------------------
  const sheetStyle = useAnimatedStyle(() => {
    const radius = interpolate(
      progress.value,
      [0, 0.15],
      [0, SHEET_RADIUS],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY: progress.value * travel }],
      borderTopLeftRadius: radius,
      borderTopRightRadius: radius,
    };
  }, [travel]);

  const grabberStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const layerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.root} onLayout={handleLayout}>
      {visible ? (
        <Animated.View style={[StyleSheet.absoluteFill, layerStyle]}>
          {renderContent({ height: travel, topInset: insets.top })}

          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.closeButton,
              { top: insets.top + 8 },
              pressed && styles.pressed,
            ]}
          >
            <SymbolIcon
              name="arrow.up"
              fallback="arrow-up"
              size={18}
              weight="bold"
              color="#FFFFFF"
            />
          </Pressable>
        </Animated.View>
      ) : null}

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View
            style={[styles.sheetContent, open && styles.sheetContentInert]}
          >
            {children}
          </View>
          <Animated.View style={[styles.grabber, grabberStyle]} />
        </Animated.View>
      </GestureDetector>

      {visible ? <StatusBar style="light" animated /> : null}
    </View>
  );
}

/** Shared look for the round controls drawn over a layer. */
export const layerControlStyles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonActive: {
    backgroundColor: "#FFFFFF",
  },
  pressed: {
    opacity: 0.7,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  closeButton: {
    ...layerControlStyles.button,
    position: "absolute",
    right: 20,
  },
  sheet: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  sheetContent: {
    flex: 1,
  },
  sheetContentInert: {
    pointerEvents: "none",
  },
  grabber: {
    position: "absolute",
    pointerEvents: "none",
    top: 8,
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D1D6",
  },
  pressed: {
    opacity: 0.7,
  },
});
