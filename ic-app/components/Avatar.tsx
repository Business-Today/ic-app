import { StyleSheet, Text, View } from "react-native";

import { initialsOf } from "@/lib/attendance";
import theme from "@/theme";

type Props = {
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
};

/**
 * Initials in a soft brand-blue circle. One tint everywhere, so lists of
 * people read calmly instead of as a rainbow.
 */
export default function Avatar({ firstName, lastName, size = 40 }: Props) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
        {initialsOf({ firstName, lastName })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: theme.colors.primaryIceBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.primaryDarkBlue,
  },
});
