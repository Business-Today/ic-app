import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/components/Avatar";
import HeaderBackButton from "@/components/HeaderBackButton";
import ListRow from "@/components/ListRow";
import { useUser } from "@/contexts/UserContext";
import { fullName, normalizeEmail } from "@/lib/attendance";
import { fetchSignedInProfile } from "@/lib/conference";
import {
  fetchNetworkEmails,
  profileImageUrl,
  type DirectoryAttendee,
} from "@/lib/network";
import { supabase } from "@/lib/supabase";
import theme from "@/theme";

/**
 * The attendee's connections after the conference, opened from the thank-you
 * screen. Read only: no scanning or directory, just the people they met and
 * their profiles.
 */
export default function Connections() {
  const router = useRouter();
  const { user } = useUser();

  const [people, setPeople] = useState<DirectoryAttendee[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        const email = user?.email ?? (await fetchSignedInProfile())?.email;
        if (!email) {
          if (isActive) setStatus("error");
          return;
        }

        const { emails, error } = await fetchNetworkEmails(email);
        if (!isActive) return;
        if (error) {
          setStatus("error");
          return;
        }
        if (emails.length === 0) {
          setPeople([]);
          setStatus("ready");
          return;
        }

        const { data, error: profileError } = await supabase
          .from("attendeeProfile")
          .select(
            "email, firstName, lastName, school, major, interests, bio, linkedin, instagram, profilePictureUrl"
          )
          .in("email", emails)
          .order("lastName", { ascending: true })
          .order("firstName", { ascending: true });
        if (!isActive) return;

        if (profileError) {
          console.error("Could not load connections:", profileError);
          setStatus("error");
          return;
        }

        setPeople((data ?? []) as DirectoryAttendee[]);
        setStatus("ready");
      }

      void load();
      return () => {
        isActive = false;
      };
    }, [user?.email])
  );

  function openProfile(person: DirectoryAttendee) {
    router.push({
      pathname: "/directoryProfile",
      params: {
        email: normalizeEmail(person.email),
        firstName: person.firstName ?? "",
        lastName: person.lastName ?? "",
        school: person.school ?? "",
        major: person.major ?? "",
        interests: person.interests ?? "",
        bio: person.bio ?? "",
        profilePictureUrl: person.profilePictureUrl ?? "",
        linkedin: person.linkedin ?? "",
        instagram: person.instagram ?? "",
        showSocials: "true",
      },
    });
  }

  const emptyText =
    status === "loading"
      ? "Loading your connections..."
      : status === "error"
        ? "Could not load your connections. Please check your connection and try again."
        : "You didn't add any connections at the conference.";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={people}
        keyExtractor={(item) => item.email}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <HeaderBackButton />
            <Text style={styles.title}>Your connections</Text>
            {people.length > 0 ? (
              <Text style={styles.count}>
                {people.length} {people.length === 1 ? "person" : "people"} you met
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
        renderItem={({ item }) => (
          <ListRow
            plain
            leading={
              <Avatar
                firstName={item.firstName}
                lastName={item.lastName}
                imageUrl={profileImageUrl(item.profilePictureUrl)}
              />
            }
            title={fullName(item) || "Attendee"}
            subtitle={[item.school?.trim(), item.major?.trim()]
              .filter(Boolean)
              .join(" · ")}
            subtitleLines={1}
            onPress={() => openProfile(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  header: {
    paddingTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: theme.colors.textPrimary,
  },
  count: {
    fontSize: 15,
    color: theme.colors.labelSecondary,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingTop: 32,
    paddingHorizontal: 24,
  },
});
