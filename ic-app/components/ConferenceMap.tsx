import { StyleSheet, Text, View } from "react-native";

import theme from "@/theme";

/**
 * Placeholder for the interactive conference map.
 * Swap the inner content for a react-native-svg map once the asset exists.
 */
export default function ConferenceMap() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Interactive map coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 360,
    borderRadius: 12,
    backgroundColor: theme.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
});
