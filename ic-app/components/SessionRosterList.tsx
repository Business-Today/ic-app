import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import Avatar from "@/components/Avatar";
import ListRow from "@/components/ListRow";
import SearchField from "@/components/SearchField";
import SegmentedTabs from "@/components/SegmentedTabs";
import {
  fetchSessionRoster,
  fullName,
  hapticFor,
  removeCheckIn,
  type Attendee,
  type SessionRoster,
} from "@/lib/attendance";
import theme from "@/theme";

type RosterTab = "checkedIn" | "notCheckedIn";

type Props = {
  eventID: string;
  /** Rendered above the search field and tabs. */
  header: ReactNode;
  /** Adds a Remove button that undoes a check-in. */
  canRemove?: boolean;
  searchable?: boolean;
  centeredTabs?: boolean;
};

/**
 * Searchable list of who has and hasn't checked in to a session. It is the
 * root of its screen because iOS form sheets need a directly parented
 * ScrollView.
 */
export default function SessionRosterList({
  eventID,
  header,
  canRemove = false,
  searchable = true,
  centeredTabs = false,
}: Props) {
  // null while the first load is in flight.
  const [roster, setRoster] = useState<SessionRoster | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<RosterTab>("checkedIn");
  const [query, setQuery] = useState("");

  const showRoster = useCallback((next: SessionRoster | null) => {
    // A failed refresh keeps the last list on screen, with a note above it.
    if (next) setRoster(next);
    setFailed(!next);
  }, []);

  useEffect(() => {
    let active = true;

    void fetchSessionRoster(eventID).then((next) => {
      if (active) showRoster(next);
    });

    return () => {
      active = false;
    };
  }, [eventID, showRoster]);

  async function refresh() {
    setRefreshing(true);
    showRoster(await fetchSessionRoster(eventID));
    setRefreshing(false);
  }

  const attendees = roster?.[tab];

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

    showRoster(await fetchSessionRoster(eventID));
    hapticFor("success");
    Toast.show({
      type: "success",
      text1: `${fullName(attendee) || attendee.email} removed`,
      position: "bottom",
      visibilityTime: 1500,
    });
  }

  function emptyMessage() {
    if (!roster) return "";
    if (attendees?.length) return "No attendees match your search.";
    if (tab === "checkedIn") return "No one has checked in yet.";

    return roster.checkedIn.length > 0
      ? "Everyone expected has checked in."
      : "No one is assigned to this session in Supabase.";
  }

  const listHeader = (
    <>
      {header}
      {searchable ? (
        <SearchField
          placeholder="Search attendees"
          value={query}
          onChangeText={setQuery}
        />
      ) : null}
      <View style={styles.tabs}>
        <SegmentedTabs
          centered={centeredTabs}
          tabs={[
            {
              key: "checkedIn",
              label: roster
                ? `Checked In (${roster.checkedIn.length})`
                : "Checked In",
            },
            {
              key: "notCheckedIn",
              label: roster
                ? `Not Checked In (${roster.notCheckedIn.length})`
                : "Not Checked In",
            },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {failed ? (
        <Text style={styles.failedText}>
          Could not load attendance. Pull down to try again.
        </Text>
      ) : null}
    </>
  );

  return (
    <FlatList
      style={styles.list}
      data={filtered}
      keyExtractor={(item) => item.email}
      contentContainerStyle={styles.content}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage()}</Text>}
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
              canRemove && tab === "checkedIn" ? (
                <Pressable
                  onPress={() => confirmRemove(item)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${name || item.email}`}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : undefined
            }
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
  tabs: {
    marginTop: 16,
    marginBottom: 16,
  },
  failedText: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.destructive,
    marginBottom: 16,
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
