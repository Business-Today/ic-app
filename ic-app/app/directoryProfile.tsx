import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import ListRow, { ListGroup } from "@/components/ListRow";
import SymbolIcon from "@/components/SymbolIcon";
import { useUser } from "@/contexts/UserContext";
import { fullName, hapticFor } from "@/lib/attendance";
import { addToNetwork, openProfileLink } from "@/lib/network";
import theme from "@/theme";

export default function DirectoryProfile() {
  const params = useLocalSearchParams<{
    email: string;
    firstName?: string;
    lastName?: string;
    school?: string;
    major?: string;
    linkedin?: string;
    instagram?: string;
    inNetwork?: string;
  }>();
  const { user } = useUser();

  const [added, setAdded] = useState(params.inNetwork === "true");
  const [pending, setPending] = useState(false);

  const name = fullName(params) || params.email;
  const school = params.school?.trim();
  const major = params.major?.trim();
  const links = [
    { label: "LinkedIn", value: params.linkedin?.trim() },
    { label: "Instagram", value: params.instagram?.trim() },
  ];

  // One-way, like the Directory's own Add button.
  async function add() {
    if (!user?.email || pending) return;

    setPending(true);

    const result = await addToNetwork(user.email, params.email, {
      mutual: false,
    });

    setPending(false);

    if (result === "error") {
      hapticFor("failed");
      Alert.alert("Error", "Failed to add profile to network.");
      return;
    }

    hapticFor("success");
    setAdded(true);
  }

  return (
    <>
      {/* The ScrollView must be the first root view: iOS form sheets only keep
          a directly parented ScrollView in place, and otherwise move it down
          by the sheet's on-screen offset. */}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Avatar
            firstName={params.firstName}
            lastName={params.lastName}
            size={72}
          />
          <Text style={styles.name}>{name}</Text>
          {school ? <Text style={styles.school}>{school}</Text> : null}
          {major ? <Text style={styles.major}>{major}</Text> : null}
        </View>

        <ListGroup>
          {links.map(({ label, value }, index) => (
            <ListRow
              key={label}
              title={label}
              subtitle={value || "Not added"}
              divider={index < links.length - 1}
              onPress={
                value ? () => void openProfileLink(value, label) : undefined
              }
            />
          ))}
        </ListGroup>

        {added ? (
          <View style={styles.added}>
            <SymbolIcon
              name="checkmark.circle.fill"
              fallback="checkmark-circle"
              size={20}
              color={theme.colors.primaryBlue}
            />
            <Text style={styles.addedText}>In your network</Text>
          </View>
        ) : (
          <Button
            title="Add to Network"
            selected
            disabled={pending}
            onPress={() => void add()}
          />
        )}
      </ScrollView>
      <View style={styles.pillBar} pointerEvents="none" collapsable={false}>
        <View style={styles.pill} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  pillBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    alignItems: "center",
    paddingTop: 8,
    backgroundColor: theme.colors.backgroundWhite,
  },
  pill: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.labelTertiary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  hero: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 24,
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
    marginTop: 16,
    textAlign: "center",
  },
  school: {
    fontSize: 16,
    color: theme.colors.labelSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  major: {
    fontSize: 16,
    color: theme.colors.labelSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  added: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 20,
  },
  addedText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
  },
});
