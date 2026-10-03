import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import theme from "@/theme";

type Props = {
  children: string;
  /** Small text or control aligned to the right edge of the label. */
  trailing?: ReactNode;
  /** The first label on a screen sits directly under the page title. */
  first?: boolean;
};

/**
 * Title-case group heading above each section of a screen.
 */
export default function SectionLabel({ children, trailing, first }: Props) {
  return (
    <View style={[styles.row, first && styles.first]}>
      <Text style={styles.label}>{children}</Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 28,
  },
  first: {
    marginTop: 0,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.labelSecondary,
  },
});
