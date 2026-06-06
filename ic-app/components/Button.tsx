import { TouchableOpacity, Text, StyleSheet } from "react-native";
import theme from "@/theme";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary";
  selected?: boolean;
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  selected = false,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        variant === "secondary" && styles.secondary,
        selected ? styles.selectedButton : styles.unselectedButton,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "secondary" && styles.textSecondary,
          selected ? styles.selectedText : styles.unselectedText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.primaryBlue,
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },

  secondary: {
    backgroundColor: theme.colors.primaryIceBlue,
  },

  selectedButton:{
    backgroundColor: theme.colors.primaryBlue,
  },

  unselectedButton: {
    backgroundColor: theme.colors.primaryIceBlue,
  },

  selectedText: {
    color: "#FFFFFF",
  },

  unselectedText: {
    color: theme.colors.primaryDarkGray,
  },

  text: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "600",
  },

  textSecondary: {
    color: "#111827",
  },
});