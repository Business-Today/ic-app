import { View, StyleSheet } from "react-native";

type CardProps = {
  children: React.ReactNode;
  marginBottom?: number;
};

export default function Card({
  children,
  marginBottom = 16,
}: CardProps) {
  return (
    <View style={[styles.card, { marginBottom }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,

    // shadow (iOS)
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },

    // shadow (Android)
    elevation: 2,
  },
});