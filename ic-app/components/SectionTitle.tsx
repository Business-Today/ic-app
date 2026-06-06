import { Text, StyleSheet } from "react-native";

export default function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.text}>{title}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 10,
    color: "#111827",
  },
});