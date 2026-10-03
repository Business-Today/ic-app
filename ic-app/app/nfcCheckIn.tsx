import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ListRow, { ListGroup } from "@/components/ListRow";
import OutcomeIcon from "@/components/OutcomeIcon";
import PageHeader from "@/components/PageHeader";
import SectionLabel from "@/components/SectionLabel";
import SymbolIcon from "@/components/SymbolIcon";
import {
  checkInAttendee,
  describeCheckIn,
  fetchCheckedInEmails,
  hapticFor,
  type CheckInOutcome,
} from "@/lib/attendance";
import {
  formatTagId,
  getNfcStatus,
  openNfcSettings,
  startTagListener,
  type NfcStatus,
} from "@/lib/nfc";
import { findAttendeeByTag } from "@/lib/nfcTags";
import theme from "@/theme";

type ReaderState = "checking" | "scanning" | "stopped" | NfcStatus;

type TapEntry = {
  key: string;
  tagId: string;
  title: string;
  detail: string;
  outcome: CheckInOutcome;
  time: string;
};

// iOS re-reads a tag that is still resting on the phone after polling
// restarts. Treat the same tag inside this window as one tap.
const REPEAT_WINDOW_MS = 3000;
const MAX_ENTRIES = 50;

function clockNow() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NfcCheckIn() {
  const router = useRouter();
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

  const [readerState, setReaderState] = useState<ReaderState>("checking");
  const [entries, setEntries] = useState<TapEntry[]>([]);
  const [checkedInCount, setCheckedInCount] = useState<number | null>(null);
  const [lastUnknownTag, setLastUnknownTag] = useState<string | null>(null);

  const stopListenerRef = useRef<() => void>(() => {});
  const lastReadRef = useRef<{ tagId: string; at: number } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;

    if (!eventID) return;

    void fetchCheckedInEmails(eventID).then((emails) => {
      if (active) setCheckedInCount(emails.length);
    });

    return () => {
      active = false;
    };
  }, [eventID]);

  const pushEntry = useCallback((entry: Omit<TapEntry, "key" | "time">) => {
    setEntries((previous) =>
      [
        { ...entry, key: `${Date.now()}-${Math.random()}`, time: clockNow() },
        ...previous,
      ].slice(0, MAX_ENTRIES)
    );
  }, []);

  // Returned strings replace the text on the iOS NFC sheet, which is what
  // the staff member is looking at while tapping.
  const handleTag = useCallback(
    async (tagId: string): Promise<string> => {
      const last = lastReadRef.current;
      const at = Date.now();

      if (last && last.tagId === tagId && at - last.at < REPEAT_WINDOW_MS) {
        return "Hold the next tag to the phone";
      }

      lastReadRef.current = { tagId, at };

      if (busyRef.current) {
        return "Still saving the previous tap";
      }

      busyRef.current = true;

      try {
        const { attendee, error } = await findAttendeeByTag(tagId);

        if (error) {
          pushEntry({ tagId, title: "Lookup failed", detail: error, outcome: "failed" });
          hapticFor("failed");
          return "Lookup failed";
        }

        if (!attendee) {
          setLastUnknownTag(tagId);
          pushEntry({
            tagId,
            title: "Unassigned tag",
            detail: `${formatTagId(tagId)} is not linked to anyone yet`,
            outcome: "rejected",
          });
          hapticFor("rejected");
          return "Unassigned tag. Hold the next tag to the phone";
        }

        const result = await checkInAttendee(eventID, attendee.email, {
          manual: false,
        });
        const described = describeCheckIn(result);

        if (result.status === "checked_in") {
          setCheckedInCount((count) => (count ?? 0) + 1);
        }

        pushEntry({ tagId, ...described });
        hapticFor(described.outcome);

        return `${described.title}: ${described.detail}. Hold the next tag to the phone`;
      } finally {
        busyRef.current = false;
      }
    },
    [eventID, pushEntry]
  );

  const stopReader = useCallback(() => {
    stopListenerRef.current();
    stopListenerRef.current = () => {};
  }, []);

  const startReader = useCallback(async () => {
    stopReader();
    setReaderState("checking");

    const status = await getNfcStatus();

    if (status !== "ready") {
      setReaderState(status);
      return;
    }

    setReaderState("scanning");

    stopListenerRef.current = startTagListener({
      alertMessage: `Hold an attendee's tag to the phone to check in to ${eventName}`,
      onTag: handleTag,
      onClosed: (error) => {
        if (error) {
          console.warn("NFC session closed with error:", error);
        }
        setReaderState("stopped");
      },
    });
  }, [eventName, handleTag, stopReader]);

  // Read while focused only, so the radio is never left on behind another
  // screen or after leaving.
  useFocusEffect(
    useCallback(() => {
      if (eventID) {
        void startReader();
      }

      return () => {
        stopReader();
      };
    }, [eventID, startReader, stopReader])
  );

  useEffect(() => () => stopReader(), [stopReader]);

  const status = (() => {
    switch (readerState) {
      case "checking":
        return {
          tone: "neutral" as const,
          title: "Preparing NFC",
          body: "One moment.",
        };
      case "scanning":
        return {
          tone: "active" as const,
          title:
            Platform.OS === "ios" ? "Ready. Follow the NFC sheet" : "Ready to tap",
          body:
            Platform.OS === "ios"
              ? "Hold each tag near the top of the phone. The sheet closes after about a minute; start again to continue."
              : "Hold each tag to the back of the phone. Reading stays on while this screen is open.",
        };
      case "stopped":
        return {
          tone: "neutral" as const,
          title: "Paused",
          body: "Start again to keep checking people in.",
        };
      case "disabled":
        return {
          tone: "problem" as const,
          title: "NFC is off",
          body: "Turn NFC on in the phone settings, then start again.",
        };
      case "unavailable":
      default:
        return {
          tone: "problem" as const,
          title: "NFC not available",
          body: "This device or build cannot read tags. Use QR or manual check-in instead.",
        };
    }
  })();

  const statusColor =
    status.tone === "active"
      ? theme.colors.primaryBlue
      : status.tone === "problem"
        ? theme.colors.destructive
        : theme.colors.labelSecondary;

  const header = (
    <>
      <PageHeader title="Tap NFC Tags" subtitle={eventName} />

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <SymbolIcon
            name="wave.3.right"
            fallback="radio-outline"
            size={28}
            weight="medium"
            color={statusColor}
          />
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>{status.title}</Text>
            <Text style={styles.statusBody}>{status.body}</Text>
          </View>
        </View>

        <View style={styles.statusDivider} />

        <View style={styles.countRow}>
          <Text style={styles.countLabel}>Checked in</Text>
          <Text style={styles.countValue}>{checkedInCount ?? ""}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {readerState === "scanning" ? (
          <Pressable
            onPress={() => {
              stopReader();
              setReaderState("stopped");
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Stop Reading</Text>
          </Pressable>
        ) : readerState !== "checking" ? (
          <Pressable
            onPress={() => void startReader()}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Start Reading</Text>
          </Pressable>
        ) : null}

        {readerState === "disabled" && Platform.OS === "android" ? (
          <Pressable
            onPress={() => void openNfcSettings()}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Open NFC Settings</Text>
          </Pressable>
        ) : null}
      </View>

      {lastUnknownTag ? (
        <View style={styles.unknownTag}>
          <ListGroup>
            <ListRow
              title="Unassigned tag"
              subtitle={`${formatTagId(lastUnknownTag)} · Link it to an attendee`}
              leading={
                <View style={styles.tagBadge}>
                  <SymbolIcon
                    name="tag"
                    fallback="pricetag-outline"
                    size={18}
                    weight="medium"
                    color={theme.colors.primaryBlue}
                  />
                </View>
              }
              onPress={() => {
                stopReader();
                setReaderState("stopped");
                router.push({
                  pathname: "/assignNfcTag",
                  params: { tagId: lastUnknownTag },
                });
              }}
            />
          </ListGroup>
        </View>
      ) : null}

      <SectionLabel>Recent Taps</SectionLabel>
    </>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nothing tapped yet.</Text>
        }
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <ListRow
            first={index === 0}
            last={index === entries.length - 1}
            divider={index < entries.length - 1}
            leading={<OutcomeIcon outcome={item.outcome} size={24} />}
            title={item.title}
            subtitle={item.detail}
            trailing={<Text style={styles.time}>{item.time}</Text>}
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
    paddingTop: 8,
    paddingBottom: 48,
  },
  statusCard: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  statusBody: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.labelSecondary,
    marginTop: 3,
  },
  statusDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(60,60,67,0.18)",
    marginVertical: 14,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countLabel: {
    fontSize: 15,
    color: theme.colors.labelSecondary,
  },
  countValue: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  actions: {
    marginTop: 12,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: theme.colors.primaryBlue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  secondaryButton: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: theme.colors.primaryBlue,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  unknownTag: {
    marginTop: 12,
  },
  tagBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  time: {
    fontSize: 13,
    color: theme.colors.labelTertiary,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    paddingTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
