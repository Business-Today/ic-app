import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {
    Gesture,
    GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import Svg, {
    Defs,
    LinearGradient,
    Mask,
    Rect,
    Stop,
} from "react-native-svg";

import type { MapRect } from "@/constants/mapRooms";
import theme from "@/theme";

type ZoomableMapProps = {
  children: ReactNode;
  /** The svg's viewBox, which `focus` is measured against. */
  viewBox: MapRect;
  /** Part of the map to zoom to and highlight. */
  focus?: MapRect | null;
};

const MAX_SCALE = 5;
// Same frame for every floor so the controls below don't jump when switching.
const VIEWPORT_ASPECT_RATIO = 1.6;
const MAP_PADDING = 12;
// Vectors rasterize at layout size, so lay out larger and scale down to stay
// sharp when zoomed in.
const RENDER_SCALE = 3;
// How much of the viewport a focused room fills.
const FOCUS_FILL = 0.7;
const FOCUS_DURATION = 450;
// The highlight is a square of about the room's area, larger than the room
// because its outer edges fade away.
const HIGHLIGHT_SIZE = 1.25;
const HIGHLIGHT_OPACITY = 0.45;
const HIGHLIGHT_FADE_IN = 800;
const HIGHLIGHT_HOLD = 1500;
const HIGHLIGHT_FADE_OUT = 1000;

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

// Soft on all four sides: a horizontal fade masked by a vertical one.
function FocusHighlight() {
  const color = theme.colors.primaryDarkBlue;

  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="focusFadeX" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="0.3" stopColor={color} stopOpacity={HIGHLIGHT_OPACITY} />
          <Stop offset="0.7" stopColor={color} stopOpacity={HIGHLIGHT_OPACITY} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="focusFadeY" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" />
          <Stop offset="0.3" stopColor="#FFFFFF" />
          <Stop offset="0.7" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#000000" />
        </LinearGradient>
        <Mask
          id="focusFadeMask"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="100"
          height="100"
        >
          <Rect width="100" height="100" fill="url(#focusFadeY)" />
        </Mask>
      </Defs>
      <Rect
        width="100"
        height="100"
        fill="url(#focusFadeX)"
        mask="url(#focusFadeMask)"
      />
    </Svg>
  );
}

export default function ZoomableMap({
  children,
  viewBox,
  focus,
}: ZoomableMapProps) {
  const [width, setWidth] = useState(0);
  const height = width / VIEWPORT_ASPECT_RATIO;

  // `focus` at 1x zoom, with its centre measured from the viewport's centre.
  const focusBox = useMemo(() => {
    if (!focus || width === 0) {
      return null;
    }

    const fit = Math.min(
      (width - MAP_PADDING * 2) / viewBox.width,
      (height - MAP_PADDING * 2) / viewBox.height
    );

    return {
      centerX:
        (focus.x + focus.width / 2 - (viewBox.x + viewBox.width / 2)) * fit,
      centerY:
        (focus.y + focus.height / 2 - (viewBox.y + viewBox.height / 2)) * fit,
      width: focus.width * fit,
      height: focus.height * fit,
      highlightSide:
        Math.sqrt(focus.width * focus.height) * HIGHLIGHT_SIZE * fit,
    };
  }, [focus, viewBox, width, height]);

  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const highlightOpacity = useSharedValue(0);

  useEffect(() => {
    if (!focusBox) {
      return;
    }

    const nextScale = clamp(
      FOCUS_FILL *
        Math.min(width / focusBox.width, height / focusBox.height),
      1,
      MAX_SCALE
    );

    const maxX = (width * (nextScale - 1)) / 2;
    const maxY = (height * (nextScale - 1)) / 2;
    const timing = { duration: FOCUS_DURATION };

    scale.set(withTiming(nextScale, timing));
    translateX.set(
      withTiming(clamp(-focusBox.centerX * nextScale, -maxX, maxX), timing)
    );
    translateY.set(
      withTiming(clamp(-focusBox.centerY * nextScale, -maxY, maxY), timing)
    );
    highlightOpacity.set(
      withSequence(
        withTiming(1, { duration: HIGHLIGHT_FADE_IN }),
        withDelay(
          HIGHLIGHT_HOLD,
          withTiming(0, { duration: HIGHLIGHT_FADE_OUT })
        )
      )
    );
  }, [
    focusBox,
    width,
    height,
    scale,
    translateX,
    translateY,
    highlightOpacity,
  ]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      const nextScale = clamp(
        startScale.value * event.scale,
        1,
        MAX_SCALE
      );

      scale.set(nextScale);

      const maxX = (width * (nextScale - 1)) / 2;
      const maxY = (height * (nextScale - 1)) / 2;

      translateX.set(clamp(translateX.value, -maxX, maxX));
      translateY.set(clamp(translateY.value, -maxY, maxY));
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const maxX = (width * (scale.value - 1)) / 2;
      const maxY = (height * (scale.value - 1)) / 2;

      translateX.set(
        clamp(startX.value + event.translationX, -maxX, maxX)
      );

      translateY.set(
        clamp(startY.value + event.translationY, -maxY, maxY)
      );
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value / RENDER_SCALE },
    ],
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.value,
  }));

  function reset() {
    scale.set(1);
    startScale.value = 1;
    translateX.set(0);
    translateY.set(0);
    startX.value = 0;
    startY.value = 0;
  }

  return (
    <View style={styles.card}>
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          onLayout={(event) => {
            setWidth(event.nativeEvent.layout.width);
          }}
          style={styles.viewport}
        >
          <Animated.View style={[styles.mapContent, animatedStyle]}>
            {children}
            {focusBox ? (
              <Animated.View
                style={[
                  styles.focusHighlight,
                  {
                    left:
                      (width / 2 +
                        focusBox.centerX -
                        focusBox.highlightSide / 2) *
                      RENDER_SCALE,
                    top:
                      (height / 2 +
                        focusBox.centerY -
                        focusBox.highlightSide / 2) *
                      RENDER_SCALE,
                    width: focusBox.highlightSide * RENDER_SCALE,
                    height: focusBox.highlightSide * RENDER_SCALE,
                  },
                  highlightStyle,
                ]}
              >
                <FocusHighlight />
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.footer}>
        <Text style={styles.hint}>
          Pinch to zoom · Drag to move
        </Text>

        <Pressable
          onPress={reset}
          accessibilityRole="button"
          accessibilityLabel="Reset map zoom and position"
          hitSlop={10}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 16,
    overflow: "hidden",
  },
  viewport: {
    width: "100%",
    aspectRatio: VIEWPORT_ASPECT_RATIO,
    overflow: "hidden",
  },
  // RENDER_SCALE times the viewport, centred on it.
  mapContent: {
    position: "absolute",
    left: "-100%",
    top: "-100%",
    width: "300%",
    height: "300%",
    padding: MAP_PADDING * RENDER_SCALE,
  },
  focusHighlight: {
    position: "absolute",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.fillTertiary,
  },
  hint: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.labelSecondary,
  },
  resetText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.primaryBlue,
  },
  pressed: {
    opacity: 0.7,
  },
});
