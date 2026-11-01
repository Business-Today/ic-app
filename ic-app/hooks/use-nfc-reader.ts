import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTagReader } from "@/hooks/use-tag-reader";
import {
  checkInAttendee,
  describeCheckIn,
  hapticFor,
  type CheckInOutcome,
} from "@/lib/attendance";
import { formatTagId } from "@/lib/nfc";
import { findAttendeeByTag } from "@/lib/nfcTags";

export type { NfcReaderState } from "@/hooks/use-tag-reader";

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

/**
 * Reads attendee tags and checks each one into the given session. The
 * reader is stopped whenever the hosting screen loses focus or unmounts, so
 * the radio is never left on behind another screen.
 */
export function useNfcReader({ eventID, eventName, onCheckedIn }: Options) {
  const [lastTap, setLastTap] = useState<NfcTap | null>(null);
  const [lastUnknownTag, setLastUnknownTag] = useState<string | null>(null);

  const onCheckedInRef = useRef(onCheckedIn);

  useEffect(() => {
    onCheckedInRef.current = onCheckedIn;
  });

  // Returned strings replace the text on the iOS NFC sheet, which is what
  // the staff member is looking at while tapping.
  const handleTag = useCallback(
    async (tagId: string): Promise<string> => {
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
    },
    [eventID]
  );

  const {
    state,
    start,
    stop,
    reset: resetReader,
  } = useTagReader({
    alertMessage: `Hold an attendee's tag to the phone to check in to ${eventName}`,
    onTag: handleTag,
  });

  /** Clears the last result so a fresh session starts clean. */
  const reset = useCallback(() => {
    resetReader();
    setLastTap(null);
    setLastUnknownTag(null);
  }, [resetReader]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        stop();
      };
    }, [stop])
  );

  return { state, lastTap, lastUnknownTag, start, stop, reset };
}
