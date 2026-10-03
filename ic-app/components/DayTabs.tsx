import { Pressable, StyleSheet, Text, View } from "react-native";

import theme from "@/theme";

type Props<T extends string> = {
  days: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
};

/**
 * Text-and-underline day switcher, the same control the Home schedule uses.
 */
export default function DayTabs<T extends string>({
  days,
  value,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const selected = day.key === value;

        return (
          <Pressable
            key={day.key}
            onPress={() => onChange(day.key)}
            hitSlop={8}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.button}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {day.label}
            </Text>
            <View
              style={[styles.underline, selected && styles.underlineSelected]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 24,
  },
  button: {
    paddingVertical: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
  },
  labelSelected: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  underline: {
    height: 2,
    marginTop: 6,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  underlineSelected: {
    backgroundColor: theme.colors.textPrimary,
  },
});
