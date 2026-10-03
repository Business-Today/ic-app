import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import SymbolIcon from "@/components/SymbolIcon";
import theme from "@/theme";

type Props = {
  title: string;
  subtitle?: string;
  /** Rendered before the text: an avatar, a time block, an icon. */
  leading?: ReactNode;
  /** Rendered after the text. Defaults to a chevron when `onPress` is set. */
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Draw the hairline under this row (every row except the group's last). */
  divider?: boolean;
  /** Round the matching corners when the row is the first or last in a list. */
  first?: boolean;
  last?: boolean;
  titleLines?: number;
  accessibilityLabel?: string;
};

/**
 * One row of a grouped list, in the style of the Profile tab's rows.
 * Wrap rows in `ListGroup` for a static list, or pass `first`/`last`
 * when rendering inside a FlatList.
 */
export default function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  disabled,
  divider,
  first,
  last,
  titleLines = 1,
  accessibilityLabel,
}: Props) {
  const showChevron = trailing === undefined && onPress !== undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        first && styles.first,
        last && styles.last,
        divider && styles.divider,
        disabled && styles.disabled,
        pressed && onPress && styles.pressed,
      ]}
    >
      {leading}

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={titleLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {showChevron ? (
        <SymbolIcon
          name="chevron.right"
          fallback="chevron-forward"
          size={14}
          weight="semibold"
          color={theme.colors.labelTertiary}
        />
      ) : (
        trailing
      )}
    </Pressable>
  );
}

export function ListGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export const GROUP_RADIUS = 20;

const styles = StyleSheet.create({
  group: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: GROUP_RADIUS,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.fillSecondary,
  },
  first: {
    borderTopLeftRadius: GROUP_RADIUS,
    borderTopRightRadius: GROUP_RADIUS,
  },
  last: {
    borderBottomLeftRadius: GROUP_RADIUS,
    borderBottomRightRadius: GROUP_RADIUS,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.18)",
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.labelSecondary,
    marginTop: 2,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
