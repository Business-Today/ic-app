import { requireOptionalNativeModule } from "expo";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import type { RevealLayout } from "@/components/RevealLayer";
import { layerControlStyles } from "@/components/RevealLayer";
import SymbolIcon from "@/components/SymbolIcon";
import { QR_LOGO_SVG } from "@/constants/qrLogo";

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
  /** When given, a Tap tab shows this over the blurred camera. */
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
const CODE_CARD_PADDING = 20;
// My Code's card fills the same square the brackets frame.
const CODE_SIZE = BRACKET_SIZE - CODE_CARD_PADDING * 2;

const BACKDROP_TIMING = { duration: 300, easing: Easing.inOut(Easing.cubic) };
const SWITCH_TRANSITION = {
  transitionDuration: 250,
  transitionTimingFunction: "ease-in-out",
} as const;
// The old tab leaves before the new one arrives, so their text never overlaps.
export const TAB_OUT = FadeOut.duration(120);
export const TAB_IN = FadeIn.delay(80).duration(200);

// iOS blurs the live video natively. Android, and a dev build without the
// module, use a grey gradient. Loading lazily keeps a missing module off the
// screen, since rendering one throws.
const LiveBlurView: typeof import("expo-blur").BlurView | null =
  Platform.OS === "ios" && requireOptionalNativeModule("ExpoBlur")
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("expo-blur").BlurView
    : null;
const AnimatedBlurView = LiveBlurView
  ? Animated.createAnimatedComponent(LiveBlurView)
  : null;

/**
 * Camera preview with white scanning brackets and a torch toggle. Optional
 * NFC and My Code tabs sit on a heavily blurred version of the live camera.
 * The camera stays on across tabs, so switching only blurs it and crossfades
 * what is drawn on top.
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
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [internalMode, setInternalMode] = useState<ScanMode>("scan");

  const mode = controlledMode ?? internalMode;
  const scanning = mode === "scan";

  // 0 = clear camera, 1 = fully behind the backdrop.
  const backdrop = useSharedValue(scanning ? 0 : 1);

  useEffect(() => {
    backdrop.value = withTiming(scanning ? 0 : 1, BACKDROP_TIMING);
  }, [scanning, backdrop]);

  function selectMode(next: ScanMode) {
    if (next !== "scan") setTorch(false);
    // Opening on the NFC tab skips the ask that the Scan button makes.
    if (next === "scan" && !permission?.granted && permission?.canAskAgain) {
      void requestPermission();
    }
    setInternalMode(next);
    onModeChange?.(next);
  }

  const tabs: { key: ScanMode; label: string }[] = [
    { key: "scan", label: "Scan" },
    ...(nfc ? [{ key: "nfc" as const, label: "Tap" }] : []),
    ...(myCode ? [{ key: "code" as const, label: "My Code" }] : []),
  ];

  return (
    <>
      {/* Shows until the camera's first frame, and when it isn't allowed. */}
      <View style={[StyleSheet.absoluteFill, styles.cameraBase]} />

      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          // Always attached: removing it reconfigures the running camera, which
          // shows as a glitch when the blur clears. Off-tab reads are ignored.
          onBarcodeScanned={(event) => {
            if (active && scanning) onBarcodeScanned?.(event);
          }}
        />
      ) : null}

      <TabBackdrop progress={backdrop} />

      {/* Fades are for moving between tabs, not for opening the layer. */}
      <LayoutAnimationConfig skipEntering skipExiting>
        <View
          style={[
            styles.region,
            { height: layout.height, paddingTop: layout.topInset + 8 },
          ]}
        >
          <View style={styles.controls}>
            {scanning ? (
              <Animated.View entering={TAB_IN} exiting={TAB_OUT}>
                <Pressable
                  onPress={() => setTorch((on) => !on)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    torch ? "Turn torch off" : "Turn torch on"
                  }
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
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.body}>
            <Animated.View
              key={mode}
              entering={TAB_IN}
              exiting={TAB_OUT}
              style={StyleSheet.absoluteFill}
            >
              {mode === "scan" ? (
                <FocalLayout
                  above={
                    permission?.granted ? null : (
                      <Text style={styles.noCameraText}>
                        Allow camera access in Settings to scan QR codes.
                      </Text>
                    )
                  }
                  focal={
                    <View style={styles.brackets}>
                      <Brackets />
                      <Text style={styles.title}>{title}</Text>
                    </View>
                  }
                >
                  {hint ? (
                    <Text style={styles.hint} numberOfLines={2}>
                      {hint}
                    </Text>
                  ) : null}

                  {footer ? <View style={styles.footer}>{footer}</View> : null}
                </FocalLayout>
              ) : mode === "nfc" ? (
                nfc
              ) : myCode ? (
                <FocalLayout
                  above={
                    <>
                      {myCode.name ? (
                        <Text style={styles.codeName}>{myCode.name}</Text>
                      ) : null}
                      {myCode.subtitle ? (
                        <Text style={styles.codeSubtitle}>
                          {myCode.subtitle}
                        </Text>
                      ) : null}
                    </>
                  }
                  focal={
                    <View style={styles.codeCard}>
                      <QRCode
                        value={myCode.value}
                        size={CODE_SIZE}
                        // The logo hides modules; lower levels can't always recover them.
                        ecl="H"
                        logoSVG={QR_LOGO_SVG}
                        logoSize={Math.round(CODE_SIZE / 4)}
                        logoMargin={4}
                        logoBorderRadius={8}
                        logoBackgroundColor="#FFFFFF"
                      />
                    </View>
                  }
                >
                  <Text style={styles.hint}>
                    Let someone scan this to check you in or add you to their
                    network.
                  </Text>
                </FocalLayout>
              ) : null}
            </Animated.View>
          </View>

          {tabs.length > 1 ? (
            <ModeSwitch tabs={tabs} value={mode} onChange={selectMode} />
          ) : null}
        </View>
      </LayoutAnimationConfig>
    </>
  );
}

/**
 * Holds the square at the centre of a tab at one height whatever surrounds it,
 * so the brackets and the code card swap in place. The space splits unevenly
 * because more goes under the square than over it.
 */
function FocalLayout({
  above,
  focal,
  children,
}: {
  above: ReactNode;
  focal: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.focalLayout}>
      <View style={styles.focalAbove}>{above}</View>
      {focal}
      <View style={styles.focalBelow}>{children}</View>
    </View>
  );
}

/** Pill switch whose highlight slides to the selected tab. */
function ModeSwitch({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: ScanMode; label: string }[];
  value: ScanMode;
  onChange: (mode: ScanMode) => void;
}) {
  const [segments, setSegments] = useState<
    Partial<Record<ScanMode, { x: number; width: number }>>
  >({});

  const selected = segments[value];

  return (
    <View style={styles.switch} accessibilityRole="tablist">
      {/* Mounts on first measure, already in place, so it only slides later. */}
      {selected ? (
        <Animated.View
          style={[
            styles.switchHighlight,
            {
              width: selected.width,
              transform: [{ translateX: selected.x }],
              transitionProperty: ["width", "transform"],
              ...SWITCH_TRANSITION,
            },
          ]}
        />
      ) : null}

      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onChange(tab.key)}
          onLayout={({ nativeEvent: { layout } }) => {
            const { x, width } = layout;
            setSegments((current) => ({ ...current, [tab.key]: { x, width } }));
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tab.key }}
          style={styles.segment}
        >
          <Animated.Text
            style={[
              styles.segmentText,
              {
                opacity: value === tab.key ? 1 : 0.55,
                transitionProperty: "opacity",
                ...SWITCH_TRANSITION,
              },
            ]}
          >
            {tab.label}
          </Animated.Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Background of the tabs that hide the scanner's clear camera view. */
function TabBackdrop({ progress }: { progress: SharedValue<number> }) {
  const blurProps = useAnimatedProps(() => ({
    // The native view treats anything lower as 1, which is too faint to see.
    intensity: interpolate(progress.value, [0, 1], [1, 100]),
  }));
  const gradientStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (AnimatedBlurView) {
    return (
      <AnimatedBlurView
        animatedProps={blurProps}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, gradientStyle]}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="backdrop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3A3C40" />
            <Stop offset="1" stopColor="#1C1C1E" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#backdrop)" />
      </Svg>
    </Animated.View>
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
  cameraBase: {
    backgroundColor: "#000000",
  },
  region: {
    paddingHorizontal: 20,
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
  },
  focalLayout: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 12,
  },
  focalAbove: {
    flex: 2,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 24,
  },
  focalBelow: {
    flex: 5,
    alignSelf: "stretch",
    alignItems: "center",
  },
  noCameraText: {
    fontSize: 15,
    lineHeight: 21,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    paddingHorizontal: 24,
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
    padding: CODE_CARD_PADDING,
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
  switchHighlight: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  segment: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  segmentText: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: "#FFFFFF",
  },
});
