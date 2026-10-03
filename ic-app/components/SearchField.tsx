import type { ComponentProps } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import SymbolIcon from "@/components/SymbolIcon";
import theme from "@/theme";

type Props = Omit<ComponentProps<typeof TextInput>, "style">;

/**
 * iOS-style search field: gray fill, leading magnifier, no border.
 */
export default function SearchField(props: Props) {
  return (
    <View style={styles.field}>
      <SymbolIcon
        name="magnifyingglass"
        fallback="search"
        size={17}
        weight="medium"
        color={theme.colors.labelSecondary}
      />
      <TextInput
        placeholderTextColor={theme.colors.labelTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        {...props}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.fillSecondary,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: theme.colors.textPrimary,
    padding: 0,
  },
});
