import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import Avatar from "@/components/Avatar";
import ListRow, { ListGroup } from "@/components/ListRow";
import { fullName } from "@/lib/attendance";
import { openProfileLink, profileImageUrl } from "@/lib/network";
import theme from "@/theme";

export default function DirectoryProfile() {
  const params = useLocalSearchParams<{
    email: string;
    firstName?: string;
    lastName?: string;
    school?: string;
    major?: string;
    interests?: string;
    profilePictureUrl?: string;
    connected?: string;
    linkedin?: string;
    instagram?: string;
  }>();

  const name = fullName(params) || params.email;
  const subtitle = [params.school?.trim(), params.major?.trim()]
    .filter(Boolean)
    .join(" · ");
  const interests = params.interests?.trim();
  // Only connections see these, and the Directory passes nothing for others.
  const links =
    params.connected === "true"
      ? [
          { label: "LinkedIn", value: params.linkedin?.trim() },
          { label: "Instagram", value: params.instagram?.trim() },
        ]
      : [];

  return (
    <>
      {/* Keep the ScrollView as the first root view for the iOS form sheet. */}
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
            imageUrl={profileImageUrl(params.profilePictureUrl)}
          />
          <Text style={styles.name}>{name}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <ListGroup>
          <ListRow
            title="Interests"
            subtitle={interests || "Not added"}
            subtitleLines={0}
            divider={links.length > 0}
          />
          {links.map(({ label, value }, index) => (
            <ListRow
              key={label}
              title={label}
              subtitle={value || "Not added"}
              subtitleLines={1}
              divider={index < links.length - 1}
              onPress={
                value ? () => void openProfileLink(value, label) : undefined
              }
            />
          ))}
        </ListGroup>
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
  subtitle: {
    fontSize: 16,
    color: theme.colors.labelSecondary,
    marginTop: 4,
    textAlign: "center",
  },
});
