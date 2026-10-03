import { Pressable, StyleSheet, Text, View } from "react-native";

import theme from "@/theme";

export type SegmentedTab<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (key: T) => void;
};

/**
 * Pill-style tab switcher used under page titles
 * (e.g. Schedule | Map | Emergency on the Home screen).
 */
export default function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.row}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
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
