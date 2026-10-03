import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import Avatar from "@/components/Avatar";
import ListRow from "@/components/ListRow";
import PageHeader from "@/components/PageHeader";
import SearchField from "@/components/SearchField";
import SectionLabel from "@/components/SectionLabel";
import {
  fetchAttendeesByEmail,
  fetchCheckedInEmails,
  fullName,
  hapticFor,
  normalizeEmail,
  removeCheckIn,
  type Attendee,
} from "@/lib/attendance";
import theme from "@/theme";

export default function AttendanceRecords() {
  const params = useLocalSearchParams<{
    eventID?: string;
    eventName?: string;
    eventSubtitle?: string;
  }>();

  const eventID = typeof params.eventID === "string" ? params.eventID : "";
  const eventName =
    typeof params.eventName === "string" && params.eventName
      ? params.eventName
      : "Session";
  const eventSubtitle =
    typeof params.eventSubtitle === "string" ? params.eventSubtitle : "";

  // null while the first load is in flight.
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!eventID) return [];

    const emails = await fetchCheckedInEmails(eventID);
    const profiles = await fetchAttendeesByEmail(emails);
    const byEmail = new Map(
      profiles.map((profile) => [normalizeEmail(profile.email), profile])
    );

    // The stored list is chronological, so reversing it puts the latest
    // check-in on top: the one most likely to need undoing.
    return [...emails]
      .reverse()
      .map(
        (email) =>
          byEmail.get(email) ?? { firstName: "", lastName: "", email }
      );
  }, [eventID]);

  useEffect(() => {
    let active = true;

    void load().then((rows) => {
      if (active) setAttendees(rows);
    });

    return () => {
      active = false;
    };
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    setAttendees(await load());
    setRefreshing(false);
  }

  const filtered = useMemo(() => {
    if (!attendees) return [];

    const term = query.trim().toLowerCase();
    if (!term) return attendees;

    return attendees.filter((attendee) =>
      `${fullName(attendee)} ${attendee.email}`.toLowerCase().includes(term)
    );
  }, [attendees, query]);

  function confirmRemove(attendee: Attendee) {
    const name = fullName(attendee) || attendee.email;

    Alert.alert(
      "Undo check-in?",
      `${name} will be removed from this session's attendance.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void remove(attendee),
        },
      ]
    );
  }

  async function remove(attendee: Attendee) {
    const result = await removeCheckIn(eventID, attendee.email);

    if (!result.ok) {
      hapticFor("failed");
      Toast.show({
        type: "error",
        text1: result.message,
        position: "bottom",
        visibilityTime: 2000,
      });
      return;
    }

    const email = normalizeEmail(attendee.email);

    setAttendees((previous) =>
      (previous ?? []).filter(
        (entry) => normalizeEmail(entry.email) !== email
      )
    );
    hapticFor("success");
    Toast.show({
      type: "success",
      text1: `${fullName(attendee) || attendee.email} removed`,
      position: "bottom",
      visibilityTime: 1500,
    });
  }

  const header = (
    <>
      <PageHeader compact title={eventName} subtitle={eventSubtitle} />
      <SearchField
        placeholder="Search attendees"
        value={query}
        onChangeText={setQuery}
      />
      <SectionLabel>
        {attendees === null
          ? "Loading"
          : `${attendees.length} Checked In`}
      </SectionLabel>
    </>
  );

  const empty = (
    <Text style={styles.emptyText}>
      {attendees === null
        ? ""
        : attendees.length === 0
          ? "No one has checked in yet."
          : "No attendees match your search."}
    </Text>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.email}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />
        }
        renderItem={({ item, index }) => {
          const name = fullName(item);

          return (
            <ListRow
              first={index === 0}
              last={index === filtered.length - 1}
              divider={index < filtered.length - 1}
              leading={
                <Avatar firstName={item.firstName} lastName={item.lastName} />
              }
              title={name || item.email}
              subtitle={name ? item.email : undefined}
              trailing={
                <Pressable
                  onPress={() => confirmRemove(item)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${name || item.email}`}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              }
            />
          );
        }}
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
    paddingTop: 8,
    paddingBottom: 48,
  },
  removeText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.destructive,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.7,
  },
});
