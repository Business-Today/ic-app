import Button from "@/components/Button";
import Card from "@/components/Card";
import { checkInAttendee, type CheckInResult } from "@/lib/attendance";
import {
  formatTagId,
  getNfcStatus,
  openNfcSettings,
  startTagListener,
  type NfcStatus,
} from "@/lib/nfc";
import { findAttendeeByTag } from "@/lib/nfcTags";
import theme from "@/theme";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Platform, Text, View } from "react-native";
import Toast from "react-native-toast-message";

type ScanOutcome = "success" | "info" | "error";

type ScanEntry = {
  key: string;
  tagId: string;
  title: string;
  detail: string;
  outcome: ScanOutcome;
  time: string;
};

type SessionState = "checking" | "scanning" | "stopped" | NfcStatus;

// Ignore the same tag if it is read again within this window. iOS re-reads a
// tag that is still resting on the phone after polling restarts.
const REPEAT_WINDOW_MS = 3000;

const OUTCOME_COLORS: Record<ScanOutcome, string> = {
  success: "#15803D",
  info: theme.colors.primaryDarkBlue,
  error: "#B91C1C",
};

function now() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function describeResult(result: CheckInResult): {
  title: string;
  detail: string;
  outcome: ScanOutcome;
} {
  switch (result.status) {
    case "checked_in":
      return {
        title: `${result.attendee.firstName} ${result.attendee.lastName}`,
        detail: "Checked in",
        outcome: "success",
      };
    case "already_checked_in":
      return {
        title: `${result.attendee.firstName} ${result.attendee.lastName}`,
        detail: "Already checked in",
        outcome: "info",
      };
    case "not_registered_for_seminar":
      return {
        title: `${result.attendee.firstName} ${result.attendee.lastName}`,
        detail: "Not registered for this seminar",
        outcome: "error",
      };
    case "no_profile":
      return {
        title: "Profile not found",
        detail: "Tag points to an email with no attendee profile",
        outcome: "error",
      };
    case "error":
    default:
      return {
        title: "Check-in failed",
        detail: result.status === "error" ? result.message : "Unknown error",
        outcome: "error",
      };
  }
}

export default function NfcCheckIn() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    eventID?: string;
    eventName?: string;
    eventSpeaker?: string;
  }>();

  const eventID = typeof params.eventID === "string" ? params.eventID : "";
  const eventName = typeof params.eventName === "string" ? params.eventName : eventID;
  const eventSpeaker =
    typeof params.eventSpeaker === "string" &&
    params.eventSpeaker !== "undefined" &&
    params.eventSpeaker !== "null"
      ? params.eventSpeaker
      : "";

  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [lastUnknownTag, setLastUnknownTag] = useState<string | null>(null);

  const stopListenerRef = useRef<() => void>(() => {});
  const lastReadRef = useRef<{ tagId: string; at: number } | null>(null);
  const busyRef = useRef(false);

  const pushEntry = useCallback((entry: Omit<ScanEntry, "key" | "time">) => {
    setEntries((previous) =>
      [
        { ...entry, key: `${Date.now()}-${Math.random()}`, time: now() },
        ...previous,
      ].slice(0, 50)
    );
  }, []);

  const feedback = useCallback((outcome: ScanOutcome) => {
    const type =
      outcome === "success"
        ? Haptics.NotificationFeedbackType.Success
        : outcome === "info"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error;

    void Haptics.notificationAsync(type).catch(() => {});
  }, []);

  const handleTag = useCallback(
    async (tagId: string): Promise<string> => {
      const last = lastReadRef.current;
      const timestamp = Date.now();

      if (last && last.tagId === tagId && timestamp - last.at < REPEAT_WINDOW_MS) {
        return "Hold the next tag to the phone";
      }

      lastReadRef.current = { tagId, at: timestamp };

      if (busyRef.current) {
        return "Still saving the previous tap";
      }

      busyRef.current = true;

      try {
        const { attendee, error } = await findAttendeeByTag(tagId);

        if (error) {
          pushEntry({ tagId, title: "Lookup failed", detail: error, outcome: "error" });
          feedback("error");
          return "Lookup failed";
        }

        if (!attendee) {
          setLastUnknownTag(tagId);
          pushEntry({
            tagId,
            title: "Unassigned tag",
            detail: `Tag ${formatTagId(tagId)} is not linked to anyone yet`,
            outcome: "error",
          });
          feedback("error");
          return "Unassigned tag. Hold the next tag to the phone";
        }

        const result = await checkInAttendee(eventID, attendee.email, {
          manual: false,
        });
        const described = describeResult(result);

        if (result.status === "checked_in") {
          setCheckedInCount((count) => count + 1);
        }

        pushEntry({ tagId, ...described });
        feedback(described.outcome);

        Toast.show({
          type: described.outcome === "error" ? "error" : described.outcome,
          text1: `${described.title}: ${described.detail}`,
          position: "bottom",
          visibilityTime: 1200,
        });

        return `${described.title}: ${described.detail}. Hold the next tag to the phone`;
      } finally {
        busyRef.current = false;
      }
    },
    [eventID, feedback, pushEntry]
  );

  const stopSession = useCallback(() => {
    stopListenerRef.current();
    stopListenerRef.current = () => {};
  }, []);

  const startSession = useCallback(async () => {
    stopSession();
    setSessionState("checking");

    const status = await getNfcStatus();

    if (status !== "ready") {
      setSessionState(status);
      return;
    }

    setSessionState("scanning");

    stopListenerRef.current = startTagListener({
      alertMessage: `Hold an attendee's tag to the phone to check in to ${eventName}`,
      onTag: handleTag,
      onClosed: (error) => {
        if (error) {
          console.warn("NFC session closed with error:", error);
        }
        setSessionState("stopped");
      },
    });
  }, [eventName, handleTag, stopSession]);

  // Start when the screen is focused, stop when it loses focus or unmounts,
  // so the NFC radio is never left on behind another screen.
  useFocusEffect(
    useCallback(() => {
      if (eventID) {
        void startSession();
      }

      return () => {
        stopSession();
      };
    }, [eventID, startSession, stopSession])
  );

  useEffect(() => () => stopSession(), [stopSession]);

  const statusCard = (() => {
    switch (sessionState) {
      case "checking":
        return { title: "Preparing NFC…", body: "One moment.", color: theme.colors.primaryDarkGray };
      case "scanning":
        return {
          title: Platform.OS === "ios" ? "Ready: follow the NFC sheet" : "Ready: tap a tag",
          body:
            Platform.OS === "ios"
              ? "Hold each attendee's tag near the top of the phone. The sheet stays open for about a minute, then you can start it again."
              : "Hold each attendee's tag to the back of the phone. Scanning stays on while this screen is open.",
          color: "#15803D",
        };
      case "stopped":
        return {
          title: "Scanning paused",
          body: "The NFC session ended. Start it again to keep checking people in.",
          color: theme.colors.primaryDarkBlue,
        };
      case "disabled":
        return {
          title: "NFC is turned off",
          body: "Turn NFC on in the phone settings, then start scanning again.",
          color: "#B91C1C",
        };
      case "unavailable":
      default:
        return {
          title: "NFC not available",
          body: "This device or build does not support NFC. Use manual check-in instead. If you are in Expo Go, install the latest development build.",
          color: "#B91C1C",
        };
    }
  })();

  if (!eventID) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <Text
          style={[
            theme.typography.title,
            { color: theme.colors.primaryBlue, textAlign: "center", marginBottom: 16 },
          ]}
        >
          No event selected
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.primaryDarkGray, textAlign: "center" },
          ]}
        >
          Go back and pick an event before tapping tags.
        </Text>
        <Button title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  const header = (
    <>
      <Text
        style={[
          theme.typography.title,
          { color: theme.colors.primaryBlue, textAlign: "center", marginBottom: 4 },
        ]}
      >
        NFC check-in
      </Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 16 },
        ]}
      >
        {eventName}
        {eventSpeaker ? `, ${eventSpeaker}` : ""}
      </Text>

      <Card>
        <Text
          style={[theme.typography.sectionTitle, { color: statusCard.color, marginBottom: 6 }]}
        >
          {statusCard.title}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray }]}>
          {statusCard.body}
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.primaryDarkBlue, marginTop: 12, fontWeight: "600" },
          ]}
        >
          Checked in this session: {checkedInCount}
        </Text>
      </Card>

      {sessionState !== "scanning" && sessionState !== "checking" && (
        <Button title="Start scanning" onPress={() => void startSession()} />
      )}
      {sessionState === "disabled" && (
        <Button title="Open NFC settings" variant="secondary" onPress={() => void openNfcSettings()} />
      )}
      {sessionState === "scanning" && (
        <Button title="Stop scanning" variant="secondary" onPress={() => { stopSession(); setSessionState("stopped"); }} />
      )}

      {lastUnknownTag && (
        <Button
          title={`Assign tag ${formatTagId(lastUnknownTag)} to an attendee`}
          variant="secondary"
          onPress={() => {
            stopSession();
            setSessionState("stopped");
            router.push({ pathname: "/assignNfcTag", params: { tagId: lastUnknownTag } });
          }}
        />
      )}

      <Text
        style={[
          theme.typography.sectionTitle,
          { color: theme.colors.primaryDarkBlue, marginTop: 20, marginBottom: 8 },
        ]}
      >
        Recent taps
      </Text>
      {entries.length === 0 && (
        <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray }]}>
          Nothing scanned yet.
        </Text>
      )}
    </>
  );

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.key}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <Card marginBottom={8}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text
              style={[
                theme.typography.sectionTitle,
                { color: OUTCOME_COLORS[item.outcome], flex: 1, marginRight: 8 },
              ]}
            >
              {item.title}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.primaryDarkGray }]}>
              {item.time}
            </Text>
          </View>
          <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray }]}>
            {item.detail}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.primaryDarkGray, marginTop: 4 }]}>
            Tag {formatTagId(item.tagId)}
          </Text>
        </Card>
      )}
    />
  );
}
