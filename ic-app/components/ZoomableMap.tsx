import { useState, type ReactNode } from "react";
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
} from "react-native-reanimated";

import theme from "@/theme";

type ZoomableMapProps = {
  children: ReactNode;
};

const MAX_SCALE = 5;

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

export default function ZoomableMap({
  children,
}: ZoomableMapProps) {
  const [width, setWidth] = useState(0);
  const height = 420;

  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

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

      scale.value = nextScale;

      const maxX = (width * (nextScale - 1)) / 2;
      const maxY = (height * (nextScale - 1)) / 2;

      translateX.value = clamp(translateX.value, -maxX, maxX);
      translateY.value = clamp(translateY.value, -maxY, maxY);
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

      translateX.value = clamp(
        startX.value + event.translationX,
        -maxX,
        maxX
      );

      translateY.value = clamp(
        startY.value + event.translationY,
        -maxY,
        maxY
      );
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  function reset() {
    scale.value = 1;
    startScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    startX.value = 0;
    startY.value = 0;
  }

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          onLayout={(event) => {
            setWidth(event.nativeEvent.layout.width);
          }}
          style={[styles.viewport, { height }]}
        >
          <Animated.View
            style={[styles.mapContent, animatedStyle]}
          >
            {children}
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
          style={({ pressed }) => [
            styles.resetButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: theme.colors.gray100,
  },
  mapContent: {
    width: "100%",
    height: "100%",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    gap: 12,
  },
  hint: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resetText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.primaryBlue,
  },
  pressed: {
    opacity: 0.6,
  },
});