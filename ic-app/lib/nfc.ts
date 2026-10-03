import { Platform } from "react-native";

/**
 * Thin wrapper around react-native-nfc-manager.
 *
 * The native module only exists in a development/production build that was
 * made after the config plugin was added to app.json. It is NOT in Expo Go.
 * To keep the rest of the app usable in Expo Go we require the library lazily
 * and treat a failed require as "NFC unavailable".
 */

type NfcModule = typeof import("react-native-nfc-manager");

let cachedModule: NfcModule | null | undefined;

function loadNfc(): NfcModule | null {
  if (cachedModule !== undefined) return cachedModule;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require("react-native-nfc-manager") as NfcModule;
  } catch (error) {
    console.warn("react-native-nfc-manager is not available in this build:", error);
    cachedModule = null;
  }

  return cachedModule;
}

export type NfcStatus = "ready" | "unavailable" | "disabled";

/**
 * Tag UIDs come back as hex strings. Android gives uppercase hex, iOS gives
 * lowercase hex, and some readers insert colons. Normalise to uppercase hex
 * with no separators so the same tag always maps to the same database value.
 */
export function normalizeTagId(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[^0-9a-fA-F]/g, "").toUpperCase();

  return cleaned.length > 0 ? cleaned : null;
}

export function formatTagId(tagId: string): string {
  return tagId.match(/.{1,2}/g)?.join(":") ?? tagId;
}

let started = false;

export async function getNfcStatus(): Promise<NfcStatus> {
  const nfc = loadNfc();
  if (!nfc) return "unavailable";

  const NfcManager = nfc.default;

  try {
    const supported = await NfcManager.isSupported();
    if (!supported) return "unavailable";

    if (!started) {
      await NfcManager.start();
      started = true;
    }

    if (Platform.OS === "android") {
      const enabled = await NfcManager.isEnabled();
      if (!enabled) return "disabled";
    }

    return "ready";
  } catch (error) {
    console.warn("Could not initialise NFC:", error);
    return "unavailable";
  }
}

export async function openNfcSettings(): Promise<void> {
  const nfc = loadNfc();
  if (!nfc || Platform.OS !== "android") return;

  try {
    await nfc.default.goToNfcSetting();
  } catch (error) {
    console.warn("Could not open NFC settings:", error);
  }
}

export type TagListenerOptions = {
  /** Text shown in the iOS system NFC sheet while waiting for a tag. */
  alertMessage: string;
  /**
   * Called for every tag tapped. The returned string (if any) replaces the
   * iOS sheet text so staff get feedback without looking away from the sheet.
   */
  onTag: (tagId: string) => Promise<string | void> | string | void;
  /**
   * Called once when the session ends for a reason other than `stop()`:
   * the iOS 60 second timeout, the user dismissing the sheet, or an error.
   */
  onClosed?: (error?: unknown) => void;
};

type ListenerState = { active: boolean };

/**
 * Keeps reading tags until `stop()` is called (or, on iOS, until the system
 * session ends). Android uses reader mode which stays on indefinitely while
 * the screen is in the foreground.
 */
export function startTagListener(options: TagListenerOptions): () => void {
  const nfc = loadNfc();
  if (!nfc) {
    options.onClosed?.(new Error("NFC is not available in this build"));
    return () => {};
  }

  const state: ListenerState = { active: true };

  if (Platform.OS === "ios") {
    void runIosSession(nfc, options, state);
  } else {
    void runAndroidReaderMode(nfc, options, state);
  }

  return () => {
    if (!state.active) return;
    state.active = false;

    const NfcManager = nfc.default;

    if (Platform.OS === "ios") {
      // Resolves the pending requestTechnology/restart promise with a cancel
      // error, which ends the loop in runIosSession.
      void NfcManager.cancelTechnologyRequest();
    } else {
      NfcManager.setEventListener(nfc.NfcEvents.DiscoverTag, null);
      void NfcManager.unregisterTagEvent();
    }
  };
}

async function runIosSession(
  nfc: NfcModule,
  options: TagListenerOptions,
  state: ListenerState
) {
  const NfcManager = nfc.default;
  const { NfcTech, NfcEvents, NfcError } = nfc;

  // A tag reader session is used for all of these, which is what exposes the
  // hardware UID (`tag.id`) on iOS. Plain NDEF reader sessions do not.
  const techs = [
    NfcTech.MifareIOS,
    NfcTech.Iso15693IOS,
    NfcTech.IsoDep,
    NfcTech.Ndef,
  ];

  const finish = (error?: unknown) => {
    if (!state.active) return;
    state.active = false;
    options.onClosed?.(error);
  };

  NfcManager.setEventListener(NfcEvents.SessionClosed, (error?: unknown) => {
    finish(error ?? undefined);
  });

  try {
    await NfcManager.requestTechnology(techs, {
      alertMessage: options.alertMessage,
    });

    while (state.active) {
      const tag = await NfcManager.getTag();
      const tagId = normalizeTagId(tag?.id);

      if (tagId) {
        const message = await options.onTag(tagId);

        if (!state.active) break;

        if (message) {
          await NfcManager.setAlertMessageIOS(message).catch(() => {});
        }
      }

      if (!state.active) break;

      // Keep the same session open and wait for the next tag.
      await NfcManager.restartTechnologyRequestIOS();
    }
  } catch (error) {
    const userCancelled = error instanceof NfcError.UserCancel;
    finish(userCancelled ? undefined : error);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
    NfcManager.setEventListener(NfcEvents.SessionClosed, null);
  }
}

async function runAndroidReaderMode(
  nfc: NfcModule,
  options: TagListenerOptions,
  state: ListenerState
) {
  const NfcManager = nfc.default;
  const { NfcEvents, NfcAdapter } = nfc;

  NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: { id?: string }) => {
    if (!state.active) return;

    const tagId = normalizeTagId(tag?.id);
    if (tagId) {
      void options.onTag(tagId);
    }
  });

  try {
    await NfcManager.registerTagEvent({
      alertMessage: options.alertMessage,
      // Reader mode bypasses Android's system NDEF handling, so tapping a tag
      // never opens another app and non-NDEF (blank) tags are reported too.
      isReaderModeEnabled: true,
      readerModeFlags:
        NfcAdapter.FLAG_READER_NFC_A |
        NfcAdapter.FLAG_READER_NFC_B |
        NfcAdapter.FLAG_READER_NFC_F |
        NfcAdapter.FLAG_READER_NFC_V |
        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
    });
  } catch (error) {
    if (state.active) {
      state.active = false;
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      options.onClosed?.(error);
    }
  }
}

/**
 * Waits for a single tap and resolves with the tag UID. Resolves with null
 * when the user dismisses the sheet (iOS) or the caller cancels.
 */
export function readTagOnce(alertMessage: string): {
  promise: Promise<string | null>;
  cancel: () => void;
} {
  let settled = false;
  let stop: () => void = () => {};

  const promise = new Promise<string | null>((resolve, reject) => {
    stop = startTagListener({
      alertMessage,
      onTag: (tagId) => {
        if (settled) return;
        settled = true;
        resolve(tagId);
        stop();
        return "Tag read";
      },
      onClosed: (error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(null);
      },
    });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      stop();
    },
  };
}
