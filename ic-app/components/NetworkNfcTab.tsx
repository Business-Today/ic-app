import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import NfcTapView from "@/components/NfcTapView";
import OutcomeIcon from "@/components/OutcomeIcon";
import SymbolIcon from "@/components/SymbolIcon";
import { useScanner } from "@/contexts/ScannerContext";
import { useUser } from "@/contexts/UserContext";
import { useTagReader } from "@/hooks/use-tag-reader";
import {
  fullName,
  hapticFor,
  normalizeEmail,
  type CheckInOutcome,
} from "@/lib/attendance";
import { addToNetwork } from "@/lib/network";
import { openNfcSettings } from "@/lib/nfc";
import { findAttendeeByTag } from "@/lib/nfcTags";

type Props = {
  /** Called after someone new joins the network. */
  onAdded: () => void;
};

type Tap = {
  outcome: CheckInOutcome;
  title: string;
  detail: string;
};

const ALERT_MESSAGE =
  "Hold another attendee's tag to the phone to add them to your network";

async function describeTap(
  tagId: string,
  myEmail: string | undefined
): Promise<Tap> {
  const { attendee, error } = await findAttendeeByTag(tagId);

  if (error) {
    return { outcome: "failed", title: "Lookup failed", detail: error };
  }

  if (!attendee) {
    return {
      outcome: "rejected",
      title: "Unassigned tag",
      detail: "This tag is not linked to anyone yet",
    };
  }

  const title = fullName(attendee) || attendee.email;

  if (!myEmail) {
    return { outcome: "failed", title, detail: "User email not found" };
  }

  if (normalizeEmail(attendee.email) === normalizeEmail(myEmail)) {
    return { outcome: "rejected", title, detail: "This is your own tag" };
  }

  const result = await addToNetwork(myEmail, attendee.email, { mutual: true });

  switch (result) {
    case "added":
      return { outcome: "success", title, detail: "Added to your network" };
    case "already_added":
      return { outcome: "duplicate", title, detail: "Already in your network" };
    case "error":
    default:
      return { outcome: "failed", title, detail: "Could not add this person" };
  }
}

/**
 * The scanner's NFC tab on the Network screen. Tapping another attendee's tag
 * adds them straight away. The reader runs while this tab is showing.
 */
export default function NetworkNfcTab({ onAdded }: Props) {
  const { user } = useUser();
  const { isOpen } = useScanner();
  const [lastTap, setLastTap] = useState<Tap | null>(null);

  const myEmail = user?.email;
  const onAddedRef = useRef(onAdded);

  useEffect(() => {
    onAddedRef.current = onAdded;
  });

  const handleTag = useCallback(
    async (tagId: string): Promise<string> => {
      const tap = await describeTap(tagId, myEmail);

      setLastTap(tap);
      hapticFor(tap.outcome);

      if (tap.outcome === "success") {
        onAddedRef.current();
      }

      const icon =
        tap.outcome === "failed"
          ? "❌"
          : tap.outcome === "rejected"
            ? "⚠️"
            : "✅";

      return [
        `${icon} ${tap.title.toUpperCase()}`,
        tap.detail,
        "",
        "Remove tag. Tap the next one.",
      ].join("\n");
    },
    [myEmail]
  );

  const { state, start, stop } = useTagReader({
    alertMessage: ALERT_MESSAGE,
    onTag: handleTag,
  });

  useEffect(() => {
    if (!isOpen) return;

    void start();

    return stop;
  }, [isOpen, start, stop]);

  return (
    <NfcTapView
      state={state}
      purpose="network"
      footer={
        <View style={styles.feedback}>
          {lastTap ? (
            <OutcomeIcon outcome={lastTap.outcome} size={26} />
          ) : (
            <SymbolIcon
              name="wave.3.right"
              fallback="radio-outline"
              size={26}
              color="rgba(255,255,255,0.7)"
            />
          )}
          <View style={styles.feedbackText}>
            <Text style={styles.feedbackTitle} numberOfLines={1}>
              {lastTap?.title ?? "Ready to tap"}
            </Text>
            <Text style={styles.feedbackDetail} numberOfLines={2}>
              {lastTap?.detail ?? "Hold another attendee's tag to the phone."}
            </Text>
          </View>
        </View>
      }
      onStart={() => void start()}
      onStop={stop}
      onOpenSettings={() => void openNfcSettings()}
    />
  );
}

const styles = StyleSheet.create({
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  feedbackText: {
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: "#FFFFFF",
  },
  feedbackDetail: {
    fontSize: 15,
    lineHeight: 20,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
});
