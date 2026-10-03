import { StyleSheet, Text, View } from "react-native";

import HeaderBackButton from "@/components/HeaderBackButton";
import theme from "@/theme";

type Props = {
  title: string;
  subtitle?: string;
  /**
   * Use for data-driven titles (a session name, a person's name) that can run
   * long. Fixed screen names keep the large size used by the tab pages.
   */
  compact?: boolean;
};

/**
 * Title block for pushed screens. Matches the page titles on the tab screens
 * so the attendance flow reads as part of the same app.
 */
export default function PageHeader({ title, subtitle, compact }: Props) {
  return (
    <View style={styles.block}>
      <HeaderBackButton />
      <Text style={[styles.title, compact && styles.titleCompact]}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 20,
  },
  title: {
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: theme.colors.textPrimary,
  },
  titleCompact: {
    fontSize: 24,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.labelSecondary,
    marginTop: 6,
  },
});
