import { useCallback, useEffect, useRef, useState } from "react";

import { getNfcStatus, startTagListener, type NfcStatus } from "@/lib/nfc";

export type NfcReaderState =
  | "idle"
  | "checking"
  | "scanning"
  | "stopped"
  | NfcStatus;

type Options = {
  alertMessage: string;
  /** Handles one tap. The returned text replaces the text on the iOS NFC sheet. */
  onTag: (tagId: string) => Promise<string>;
};

// iOS re-reads a tag that is still resting on the phone after polling
// restarts. Treat the same tag inside this window as one tap.
const REPEAT_WINDOW_MS = 3000;

/**
 * Keeps an NFC reader running and hands each new tap to `onTag`, one at a
 * time. The reader is stopped when the hosting component unmounts, so the
 * radio is never left on behind another screen.
 */
export function useTagReader({ alertMessage, onTag }: Options) {
  const [state, setState] = useState<NfcReaderState>("idle");

  const stopListenerRef = useRef<() => void>(() => {});
  const lastReadRef = useRef<{ tagId: string; at: number } | null>(null);
  const busyRef = useRef(false);
  // Bumped by start and stop, so a start still waiting on the NFC status can
  // tell it has been cancelled.
  const startIdRef = useRef(0);
  const onTagRef = useRef(onTag);

  useEffect(() => {
    onTagRef.current = onTag;
  });

  const handleTag = useCallback(async (tagId: string): Promise<string> => {
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
      return await onTagRef.current(tagId);
    } finally {
      busyRef.current = false;
    }
  }, []);

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

  /** Forgets the last tap so a fresh session starts clean. */
  const reset = useCallback(() => {
    lastReadRef.current = null;
    setState("idle");
  }, []);

  useEffect(
    () => () => {
      startIdRef.current += 1;
      stopListenerRef.current();
    },
    []
  );

  return { state, start, stop, reset };
}
