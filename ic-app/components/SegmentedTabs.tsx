import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";

import theme from "@/theme";

export type SegmentedTab<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Optional extra content rendered after the pills, inside the same bar. */
  trailing?: ReactNode;
  /** Centre the pills when they fit; they still scroll when they don't. */
  centered?: boolean;
};

/**
 * Pill-style tab switcher used under page titles
 * (e.g. Schedule | Map | Emergency on the Home screen).
 */
export default function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  trailing,
  centered = false,
}: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={[styles.row, centered && styles.rowCentered]}
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => pressed && styles.pillPressed}
          >
            <Animated.View
              style={[styles.pill, selected && styles.pillSelected]}
            >
              <Animated.Text
                style={[styles.label, selected && styles.labelSelected]}
              >
                {tab.label}
              </Animated.Text>
            </Animated.View>
          </Pressable>
        );
      })}
      {trailing}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Let the bar scroll edge to edge while the page keeps its 20pt gutters.
  bleed: {
    marginHorizontal: -20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  rowCentered: {
    flexGrow: 1,
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.fillSecondary,
    transitionProperty: "backgroundColor",
    transitionDuration: 200,
  },
  pillSelected: {
    backgroundColor: theme.colors.primaryBlue,
  },
  pillPressed: {
    opacity: 0.7,
  },
  // One weight for both states, so pills don't change width as they fade.
  label: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
    transitionProperty: "color",
    transitionDuration: 200,
  },
  labelSelected: {
    color: "#FFFFFF",
  },
});
