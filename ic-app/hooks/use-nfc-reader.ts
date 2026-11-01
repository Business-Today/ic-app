import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  checkInAttendee,
  describeCheckIn,
  hapticFor,
  type CheckInOutcome,
} from "@/lib/attendance";
import {
  formatTagId,
  getNfcStatus,
  startTagListener,
  type NfcStatus,
} from "@/lib/nfc";
import { findAttendeeByTag } from "@/lib/nfcTags";

export type NfcReaderState =
  | "idle"
  | "checking"
  | "scanning"
  | "stopped"
  | NfcStatus;

export type NfcTap = {
  tagId: string;
  outcome: CheckInOutcome;
  title: string;
  detail: string;
};

type Options = {
  eventID: string;
  eventName: string;
  /** Called once per new check-in so the caller can bump its count. */
  onCheckedIn?: () => void;
};

// iOS re-reads a tag that is still resting on the phone after polling
// restarts. Treat the same tag inside this window as one tap.
const REPEAT_WINDOW_MS = 3000;

/**
 * Reads attendee tags and checks each one into the given session. The
 * reader is stopped whenever the hosting screen loses focus or unmounts, so
 * the radio is never left on behind another screen.
 */
export function useNfcReader({ eventID, eventName, onCheckedIn }: Options) {
  const [state, setState] = useState<NfcReaderState>("idle");
  const [lastTap, setLastTap] = useState<NfcTap | null>(null);
  const [lastUnknownTag, setLastUnknownTag] = useState<string | null>(null);

  const stopListenerRef = useRef<() => void>(() => {});
  const lastReadRef = useRef<{ tagId: string; at: number } | null>(null);
  const busyRef = useRef(false);
  const onCheckedInRef = useRef(onCheckedIn);

  useEffect(() => {
    onCheckedInRef.current = onCheckedIn;
  });

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
          setLastTap({ tagId, title: "Lookup failed", detail: error, outcome: "failed" });
          hapticFor("failed");
          return "Lookup failed";
        }

        if (!attendee) {
          setLastUnknownTag(tagId);
          setLastTap({
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
          onCheckedInRef.current?.();
        }

        setLastTap({ tagId, ...described });
        hapticFor(described.outcome);

        const icon =
          described.outcome === "failed"
            ? "❌"
            : described.outcome === "rejected"
              ? "⚠️"
              : "✅";

        return [
          `${icon} ${described.title.toUpperCase()}`,
          described.detail,
          "",
          "Remove tag. Tap the next one.",
        ].join("\n");
      } finally {
        busyRef.current = false;
      }
    },
    [eventID]
  );

  const stop = useCallback(() => {
    stopListenerRef.current();
    stopListenerRef.current = () => {};
    setState((current) => (current === "scanning" ? "stopped" : current));
  }, []);

  const start = useCallback(async () => {
    stopListenerRef.current();
    stopListenerRef.current = () => {};
    setState("checking");

    const status = await getNfcStatus();

    if (status !== "ready") {
      setState(status);
      return;
    }

    setState("scanning");

    stopListenerRef.current = startTagListener({
      alertMessage: `Hold an attendee's tag to the phone to check in to ${eventName}`,
      feedbackDurationMs: 1500,
      onTag: handleTag,
      onClosed: (error) => {
        if (error) {
          console.log("NFC session closed with error:", error);
        }
        setState("stopped");
      },
    });
  }, [eventName, handleTag]);

  /** Clears the last result so a fresh session starts clean. */
  const reset = useCallback(() => {
    lastReadRef.current = null;
    setLastTap(null);
    setLastUnknownTag(null);
    setState("idle");
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        stop();
      };
    }, [stop])
  );

  useEffect(() => () => stopListenerRef.current(), []);

  return { state, lastTap, lastUnknownTag, start, stop, reset };
}
