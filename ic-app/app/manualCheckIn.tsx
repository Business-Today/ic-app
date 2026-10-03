import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import Avatar from "@/components/Avatar";
import ListRow from "@/components/ListRow";
import PageHeader from "@/components/PageHeader";
import SearchField from "@/components/SearchField";
import SymbolIcon from "@/components/SymbolIcon";
import { useAttendeeSearch } from "@/hooks/useAttendeeSearch";
import {
  checkInAttendee,
  describeCheckIn,
  fetchCheckedInEmails,
  fullName,
  hapticFor,
  normalizeEmail,
  searchAttendees,
  type Attendee,
} from "@/lib/attendance";
import theme from "@/theme";

export default function ManualCheckIn() {
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

  const [query, setQuery] = useState("");
  const { results, searching } = useAttendeeSearch(query, searchAttendees);

  // Emails already on the session, so rows can show their state up front.
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!eventID) return;

    void fetchCheckedInEmails(eventID).then((emails) => {
      if (active) setCheckedIn(new Set(emails));
    });

    return () => {
      active = false;
    };
  }, [eventID]);

  async function checkIn(attendee: Attendee) {
    if (!eventID || pendingEmail) return;

    const email = normalizeEmail(attendee.email);
    setPendingEmail(email);

    const result = await checkInAttendee(eventID, email, { manual: true });
    const described = describeCheckIn(result);

    setPendingEmail(null);
    hapticFor(described.outcome);

    if (
      result.status === "checked_in" ||
      result.status === "already_checked_in"
    ) {
      setCheckedIn((previous) => new Set(previous).add(email));
    }

    Toast.show({
      type:
        described.outcome === "success"
          ? "success"
          : described.outcome === "duplicate"
            ? "info"
            : "error",
      text1: described.title,
      text2: described.detail,
      position: "bottom",
      visibilityTime: 1500,
    });
  }

  const rows = results ?? [];

  const header = (
    <>
      <PageHeader title="Manual Check-in" />

      <View style={styles.sessionCard}>
        <Text style={styles.sessionCaption}>Checking in to</Text>
        <Text style={styles.sessionTitle} numberOfLines={2}>
          {eventName}
        </Text>
        {eventSubtitle ? (
          <Text style={styles.sessionDetail} numberOfLines={1}>
            {eventSubtitle}
          </Text>
        ) : null}
      </View>

      <SearchField
        placeholder="Name or email"
        value={query}
        onChangeText={setQuery}
        autoFocus
      />
      <View style={styles.listSpacer} />
    </>
  );

  const empty = (
    <Text style={styles.emptyText}>
      {results === null
        ? ""
        : searching
          ? "Searching"
          : `No attendees match "${query.trim()}".`}
    </Text>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.email}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const name = fullName(item);
          const email = normalizeEmail(item.email);
          const done = checkedIn.has(email);
          const pending = pendingEmail === email;

          return (
            <ListRow
              first={index === 0}
              last={index === rows.length - 1}
              divider={index < rows.length - 1}
              leading={
                <Avatar firstName={item.firstName} lastName={item.lastName} />
              }
              title={name || item.email}
              subtitle={name ? item.email : undefined}
              trailing={
                done ? (
                  <View style={styles.doneState}>
                    <SymbolIcon
                      name="checkmark.circle.fill"
                      fallback="checkmark-circle"
                      size={20}
                      color={theme.colors.primaryBlue}
                    />
                    <Text style={styles.doneText}>Checked in</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => void checkIn(item)}
                    disabled={pendingEmail !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Check in ${name || item.email}`}
                    style={({ pressed }) => [
                      styles.checkInPill,
                      pressed && styles.pressed,
                    ]}
                  >
                    {pending ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primaryBlue}
                      />
                    ) : (
                      <Text style={styles.checkInText}>Check in</Text>
                    )}
                  </Pressable>
                )
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
  sessionCard: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  sessionCaption: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
    marginBottom: 4,
  },
  sessionTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  sessionDetail: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.labelSecondary,
    marginTop: 3,
  },
  listSpacer: {
    height: 20,
  },
  checkInPill: {
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.backgroundWhite,
  },
  checkInText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.primaryBlue,
  },
  doneState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  doneText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.7,
  },
});
