import { requireOptionalNativeModule } from "expo";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File } from "expo-file-system";
import { Image, type ImageRef } from "expo-image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

import type { RevealLayout } from "@/components/RevealLayer";
import { layerControlStyles } from "@/components/RevealLayer";
import SymbolIcon from "@/components/SymbolIcon";

export type ScanEvent = { data: string };

/** The code to show under "My Code". */
export type MyCode = {
  value: string;
  name?: string;
  subtitle?: string;
};

export type ScanMode = "scan" | "nfc" | "code";

type Props = {
  layout: RevealLayout;
  /** False pauses scanning (for example while the sheet is closing). */
  active: boolean;
  /** Omit to pause scanning while keeping the camera on. */
  onBarcodeScanned?: (event: ScanEvent) => void;
  /** Label centred between the brackets. */
  title?: string;
  /** One line under the brackets, e.g. the session being scanned for. */
  hint?: string;
  /** Extra content (feedback, counts) shown under the hint while scanning. */
  footer?: ReactNode;
  /** When given, an NFC tab shows this over the blurred camera. */
  nfc?: ReactNode;
  /** When given, a My Code tab shows this code over the blurred camera. */
  myCode?: MyCode;
  /** Control the selected tab from outside; defaults to internal state. */
  mode?: ScanMode;
  onModeChange?: (mode: ScanMode) => void;
};

const BRACKET_SIZE = 250;
const BRACKET_STROKE = 7;
const BRACKET_RADIUS = 30;
const BRACKET_ARM = 60;

const QR_LOGO = require("../assets/images/bt_mark.png");

// iOS blurs the live preview directly. Android cannot sample a camera view, and
// an older dev build has no native blur at all, so both of those use the colour
// frames below. Loading lazily keeps a missing module off the screen.
const LiveBlurView: typeof import("expo-blur").BlurView | null =
  Platform.OS === "ios" && requireOptionalNativeModule("ExpoBlur")
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("expo-blur").BlurView
    : null;

// The camera frame is shrunk to this many pixels and stretched across the
// screen, which leaves only soft regions of colour and no recognisable detail.
const BACKDROP_PIXELS = 16;
// Pause between frames. The crossfade fills the gap so the colours keep drifting.
const BACKDROP_INTERVAL_MS = 300;
const BACKDROP_RETRY_MS = 2000;
const BACKDROP_FADE_MS = 600;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Removes a captured frame so the loop does not fill the cache. */
function deleteFrame(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // The system clears the cache directory eventually.
  }
}

/** Reads one frame and shrinks it. Resolves to null if the frame is not read. */
async function captureBackdrop(
  camera: CameraView | null
): Promise<ImageRef | null> {
  try {
    const photo = await camera?.takePictureAsync({
      quality: 0.1,
      skipProcessing: true,
      shutterSound: false,
    });

    if (!photo?.uri) return null;

    try {
      return await Image.loadAsync(
        { uri: photo.uri },
        { maxWidth: BACKDROP_PIXELS, maxHeight: BACKDROP_PIXELS }
      );
    } finally {
      deleteFrame(photo.uri);
    }
  } catch {
    // The dark gradient underneath is a complete background on its own.
    return null;
  }
}

/**
 * Camera preview with white scanning brackets and a torch toggle. Optional
 * NFC and My Code tabs sit on a heavily blurred version of the live camera.
 */
export default function QrScanContent({
  layout,
  active,
  onBarcodeScanned,
  title = "Scan a QR Code",
  hint,
  footer,
  nfc,
  myCode,
  mode: controlledMode,
  onModeChange,
}: Props) {
  const [permission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [internalMode, setInternalMode] = useState<ScanMode>("scan");

  const mode = controlledMode ?? internalMode;
  const scanning = mode === "scan";

  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [backdrop, setBackdrop] = useState<ImageRef | null>(null);

  // Keep the colours following the camera while a tab hides the preview.
  // Each frame finishes before the next starts, so captures never overlap.
  const followCamera = !LiveBlurView && active && !scanning && cameraReady;

  useEffect(() => {
    if (!followCamera) return;

    let running = true;

    async function follow() {
      while (running) {
        const image = await captureBackdrop(cameraRef.current);

        if (!running) return;
        if (image) setBackdrop(image);

        await wait(image ? BACKDROP_INTERVAL_MS : BACKDROP_RETRY_MS);
      }
    }

    void follow();

    return () => {
      running = false;
    };
  }, [followCamera]);

  function selectMode(next: ScanMode) {
    if (next !== "scan") setTorch(false);
    setInternalMode(next);
    onModeChange?.(next);
  }

  const tabs: { key: ScanMode; label: string }[] = [
    { key: "scan", label: "Scan" },
    ...(nfc ? [{ key: "nfc" as const, label: "NFC" }] : []),
    ...(myCode ? [{ key: "code" as const, label: "My Code" }] : []),
  ];

  return (
    <>
      {permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={active && scanning ? onBarcodeScanned : undefined}
        />
      ) : null}

      {scanning ? null : <ColorBackdrop image={backdrop} />}

      <View
        style={[
          styles.region,
          { height: layout.height, paddingTop: layout.topInset + 8 },
        ]}
      >
        <View style={styles.controls}>
          {scanning ? (
            <Pressable
              onPress={() => setTorch((on) => !on)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
              style={({ pressed }) => [
                layerControlStyles.button,
                torch && layerControlStyles.buttonActive,
                pressed && layerControlStyles.pressed,
              ]}
            >
              <SymbolIcon
                name={torch ? "flashlight.on.fill" : "flashlight.off.fill"}
                fallback={torch ? "flashlight" : "flashlight-outline"}
                size={18}
                weight="semibold"
                color={torch ? "#111111" : "#FFFFFF"}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.body}>
          {mode === "scan" ? (
            <>
              {permission?.granted ? null : (
                <Text style={styles.noCameraText}>
                  Allow camera access in Settings to scan QR codes.
                </Text>
              )}

              <View style={styles.brackets}>
                <Brackets />
                <Text style={styles.title}>{title}</Text>
              </View>

              {hint ? (
                <Text style={styles.hint} numberOfLines={2}>
                  {hint}
                </Text>
              ) : null}

              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </>
          ) : mode === "nfc" ? (
            nfc
          ) : myCode ? (
            <>
              {myCode.name ? (
                <Text style={styles.codeName}>{myCode.name}</Text>
              ) : null}
              {myCode.subtitle ? (
                <Text style={styles.codeSubtitle}>{myCode.subtitle}</Text>
              ) : null}

              <View style={styles.codeCard}>
                <QRCode
                  value={myCode.value}
                  size={220}
                  logo={QR_LOGO}
                  logoSize={56}
                  logoMargin={4}
                  logoBorderRadius={8}
                  logoBackgroundColor="#FFFFFF"
                />
              </View>

              <Text style={styles.hint}>
                Let someone scan this to check you in or add you to their
                network.
              </Text>
            </>
          ) : null}
        </View>

        {tabs.length > 1 ? (
          <View style={styles.switch} accessibilityRole="tablist">
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => selectMode(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === tab.key }}
                style={[
                  styles.segment,
                  mode === tab.key && styles.segmentSelected,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    mode === tab.key && styles.segmentTextSelected,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </>
  );
}

/**
 * Opaque background that follows the camera: a live blur where available,
 * otherwise colour frames. In the frame version a dark gradient covers
 * the live preview, the shrunken frame fades in over it, and a dark wash keeps
 * the content readable.
 */
function ColorBackdrop({ image }: { image: ImageRef | null }) {
  if (LiveBlurView) {
    return (
      <LiveBlurView
        intensity={100}
        tint="systemThickMaterialDark"
        style={StyleSheet.absoluteFill}
      >
        <View style={styles.liveDim} />
      </LiveBlurView>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="backdrop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3A3C40" />
            <Stop offset="1" stopColor="#1C1C1E" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#backdrop)" />
      </Svg>

      {image ? (
        <Image
          source={image}
          contentFit="cover"
          transition={BACKDROP_FADE_MS}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={styles.dim} />
    </View>
  );
}

/** Four rounded corner brackets with round line caps. */
function Brackets() {
  const s = BRACKET_SIZE;
  const p = BRACKET_STROKE / 2;
  const r = BRACKET_RADIUS;
  const a = BRACKET_ARM;

  const d = [
    `M ${p + a} ${p} H ${p + r} A ${r} ${r} 0 0 0 ${p} ${p + r} V ${p + a}`,
    `M ${s - p - a} ${p} H ${s - p - r} A ${r} ${r} 0 0 1 ${s - p} ${p + r} V ${p + a}`,
    `M ${s - p} ${s - p - a} V ${s - p - r} A ${r} ${r} 0 0 1 ${s - p - r} ${s - p} H ${s - p - a}`,
    `M ${p} ${s - p - a} V ${s - p - r} A ${r} ${r} 0 0 0 ${p + r} ${s - p} H ${p + a}`,
  ].join(" ");

  return (
    <Svg width={s} height={s} style={styles.bracketsSvg}>
      <Path
        d={d}
        stroke="#FFFFFF"
        strokeWidth={BRACKET_STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Text styles shared with the views slotted into the tabs. */
export const scanTextStyles = StyleSheet.create({
  hint: {
    fontSize: 17,
    lineHeight: 23,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: 36,
    paddingHorizontal: 24,
  },
  footer: {
    alignSelf: "stretch",
    marginTop: 24,
  },
});

const styles = StyleSheet.create({
  region: {
    paddingHorizontal: 20,
  },
  dim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(20,20,22,0.6)",
  },
  liveDim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(20,20,22,0.45)",
  },
  controls: {
    height: 40,
    // The close arrow sits on the right, drawn by the layer.
    paddingRight: 48,
    flexDirection: "row",
    alignItems: "center",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 12,
  },
  noCameraText: {
    fontSize: 15,
    lineHeight: 21,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  brackets: {
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  bracketsSvg: {
    pointerEvents: "none",
  },
  title: {
    position: "absolute",
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: "#FFFFFF",
    textAlign: "center",
  },
  hint: scanTextStyles.hint,
  footer: scanTextStyles.footer,
  // My Code
  codeName: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: "#FFFFFF",
  },
  codeSubtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  codeCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  // Tab switch
  switch: {
    alignSelf: "center",
    flexDirection: "row",
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 24,
  },
  segment: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  segmentSelected: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  segmentText: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: "rgba(255,255,255,0.55)",
  },
  segmentTextSelected: {
    color: "#FFFFFF",
  },
});
