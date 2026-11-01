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
import { findAttendeeByTag, type TaggedAttendee } from "@/lib/nfcTags";

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

export type TapResult = Omit<NfcTap, "tagId">;

type TagReaderOptions = {
  /** Shown on the iOS NFC sheet when it opens. */
  alertMessage: string;
  /** What the person reading calls the thing being tapped. */
  noun?: string;
  /** Replaces the detail line for a tag that is linked to nobody. */
  unknownDetail?: string;
  /** Runs for each tag linked to an attendee. */
  onAttendee: (attendee: TaggedAttendee) => Promise<TapResult>;
};

type CheckInOptions = {
  eventID: string;
  eventName: string;
  /** Called once per new check-in so the caller can bump its count. */
  onCheckedIn?: () => void;
};

// iOS re-reads a tag that is still resting on the phone after polling
// restarts. Treat the same tag inside this window as one tap.
const REPEAT_WINDOW_MS = 3000;

/**
 * Reads tags, finds who each one belongs to and hands them to `onAttendee`.
 * The reader is stopped whenever the hosting screen loses focus or unmounts,
 * so the radio is never left on behind another screen.
 */
export function useTagReader({
  alertMessage,
  noun = "tag",
  unknownDetail,
  onAttendee,
}: TagReaderOptions) {
  const [state, setState] = useState<NfcReaderState>("idle");
  const [lastTap, setLastTap] = useState<NfcTap | null>(null);
  const [lastUnknownTag, setLastUnknownTag] = useState<string | null>(null);

  const stopListenerRef = useRef<() => void>(() => {});
  const lastReadRef = useRef<{ tagId: string; at: number } | null>(null);
  const busyRef = useRef(false);
  // Bumped by start and stop, so a start still waiting on the NFC status can
  // tell it has been cancelled.
  const startIdRef = useRef(0);
  // An iOS session outlives renders, so it reads the latest handler from here.
  const onAttendeeRef = useRef(onAttendee);

  useEffect(() => {
    onAttendeeRef.current = onAttendee;
  });

  // Returned strings replace the text on the iOS NFC sheet, which is what
  // the person tapping is looking at.
  const handleTag = useCallback(
    async (tagId: string): Promise<string> => {
      const last = lastReadRef.current;
      const at = Date.now();

      if (last && last.tagId === tagId && at - last.at < REPEAT_WINDOW_MS) {
        return `Hold the next ${noun} to the phone`;
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
            title: `Unassigned ${noun}`,
            detail:
              unknownDetail ?? `${formatTagId(tagId)} is not linked to anyone yet`,
            outcome: "rejected",
          });
          hapticFor("rejected");
          return `Unassigned ${noun}. Hold the next ${noun} to the phone`;
        }

        const result = await onAttendeeRef.current(attendee);

        setLastTap({ tagId, ...result });
        hapticFor(result.outcome);

        const icon =
          result.outcome === "failed"
            ? "❌"
            : result.outcome === "rejected"
              ? "⚠️"
              : "✅";

        return [
          `${icon} ${result.title.toUpperCase()}`,
          result.detail,
          "",
          `Remove ${noun}. Tap the next one.`,
        ].join("\n");
      } finally {
        busyRef.current = false;
      }
    },
    [noun, unknownDetail]
  );

  const stop = useCallback(() => {
    startIdRef.current += 1;
    stopListenerRef.current();
    stopListenerRef.current = () => {};
    setState((current) =>
      current === "scanning" || current === "checking" ? "stopped" : current
    );
  }, []);

  const start = useCallback(async () => {
    stopListenerRef.current();
    stopListenerRef.current = () => {};

    startIdRef.current += 1;
    const startId = startIdRef.current;

    setState("checking");

    const status = await getNfcStatus();

    if (startId !== startIdRef.current) return;

    if (status !== "ready") {
      setState(status);
      return;
    }

    setState("scanning");

    stopListenerRef.current = startTagListener({
      alertMessage,
      feedbackDurationMs: 1500,
      onTag: handleTag,
      onClosed: (error) => {
        if (error) {
          console.log("NFC session closed with error:", error);
        }
        setState("stopped");
      },
    });
  }, [alertMessage, handleTag]);

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

  useEffect(
    () => () => {
      startIdRef.current += 1;
      stopListenerRef.current();
    },
    []
  );

  return { state, lastTap, lastUnknownTag, start, stop, reset };
}

/** Reads attendee tags and checks each one into the given session. */
export function useNfcReader({ eventID, eventName, onCheckedIn }: CheckInOptions) {
  return useTagReader({
    alertMessage: `Hold an attendee's tag to the phone to check in to ${eventName}`,
    onAttendee: async (attendee) => {
      const result = await checkInAttendee(eventID, attendee.email, {
        manual: false,
      });

      if (result.status === "checked_in") {
        onCheckedIn?.();
      }

      return describeCheckIn(result);
    },
  });
}
