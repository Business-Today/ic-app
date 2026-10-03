import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import theme from "@/theme";

/**
 * The back control for pushed screens: the same bare blue chevron the login
 * flow draws inline above its title. Screens render it themselves instead of
 * using the native header, which keeps the iOS 26 glass bar out of the app.
 */
export default function HeaderBackButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={32} color={theme.colors.primaryBlue} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    // Optically align the chevron's stroke with the 20pt page gutter.
    marginLeft: -8,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.6,
  },
});
