import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import Avatar from "@/components/Avatar";
import SectionLabel from "@/components/SectionLabel";
import { useUser } from "@/contexts/UserContext";
import { fullName } from "@/lib/attendance";
import theme from "@/theme";

export default function SpeakerDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { speakersAll } = useUser();

  const speaker = speakersAll.find((candidate) => candidate.id === id);
  const role = [speaker?.title, speaker?.company]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
  const bio = speaker?.bio?.trim();

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
        {speaker ? (
          <>
            <View style={styles.hero}>
              <Avatar
                firstName={speaker.firstName}
                lastName={speaker.lastName}
                size={72}
              />
              <Text style={styles.name}>{fullName(speaker)}</Text>
              {role ? <Text style={styles.role}>{role}</Text> : null}
            </View>

            <SectionLabel>About</SectionLabel>
            {bio ? (
              <Text style={styles.bio}>{bio}</Text>
            ) : (
              <Text style={styles.emptyText}>No bio available yet.</Text>
            )}
          </>
        ) : (
          <Text style={styles.emptyText}>Speaker not found.</Text>
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
    paddingBottom: 8,
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
    marginTop: 16,
    textAlign: "center",
  },
  role: {
    fontSize: 16,
    color: theme.colors.labelSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  bio: {
    fontSize: 17,
    lineHeight: 25,
    color: theme.colors.textPrimary,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
  },
});
