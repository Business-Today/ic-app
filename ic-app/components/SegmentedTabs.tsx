import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

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
}: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.row}
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.pill,
              selected && styles.pillSelected,
              pressed && styles.pillPressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {tab.label}
            </Text>
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
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.fillSecondary,
  },
  pillSelected: {
    backgroundColor: theme.colors.primaryBlue,
  },
  pillPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
  },
  labelSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
