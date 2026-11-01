import { useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/Button";
import NfcTapView, { type TapCopy } from "@/components/NfcTapView";
import OutcomeIcon from "@/components/OutcomeIcon";
import ScannerLayer, { type ScanMode } from "@/components/ScannerLayer";
import SegmentedTabs from "@/components/SegmentedTabs";
import SymbolIcon from "@/components/SymbolIcon";
import { QR_LOGO_SVG } from "@/constants/qrLogo";
import { useUser } from "@/contexts/UserContext";
import { useTagReader, type TapResult } from "@/hooks/use-nfc-reader";
import { normalizeEmail, parseEmails } from "@/lib/attendance";
import { openNfcSettings } from "@/lib/nfc";
import type { TaggedAttendee } from "@/lib/nfcTags";
import { supabase } from "@/lib/supabase";
import theme from "@/theme";

// A code still in front of the camera is read many times a second. Ignore
// repeats of the same code for this long after its result is dismissed.
const REPEAT_WINDOW_MS = 4000;

const BADGE_TAP_COPY: TapCopy = {
  idleTitle: "Tap a Badge",
  idleBody: "Start reading to add people to your network.",
  holdTitle: "Hold a badge to the phone",
  readingTitle: "Reading Badges",
  stoppedBody: "Start again to keep adding people.",
  unavailableBody: "This phone cannot read badges. Scan their QR code instead.",
};

const BADGE_RING_SIZE = 180;

type NetworkProfile = {
  email: string;
  firstName: string;
  lastName: string;
  school: string;
  major: string;
  interests: string;
  linkedin: string;
  instagram: string;
  profilePictureUrl: string | null;
};

type NetworkTab = "qr" | "network";

const NETWORK_TABS: { key: NetworkTab; label: string }[] = [
  { key: "qr", label: "QR" },
  { key: "network", label: "Network" },
];

function getProfileImageUrl(profilePictureUrl: string | null) {
  return supabase.storage
    .from("profilePictures")
    .getPublicUrl(profilePictureUrl ?? "anonymous.jpg").data.publicUrl;
}

async function openProfileLink(url: string, label: string) {
  const normalizedUrl =
    url.startsWith("https://") || url.startsWith("http://")
      ? url
      : `https://${url}`;

  const canOpen = await Linking.canOpenURL(normalizedUrl);

  if (!canOpen) {
    Alert.alert("Invalid link", `This ${label} link cannot be opened.`);
    return;
  }

  await Linking.openURL(normalizedUrl);
}

type AddResult = "added" | "already" | "failed";

/** Adds one email to an attendee's network. */
async function addConnection(
  ownerEmail: string,
  connectionEmail: string
): Promise<AddResult> {
  const { data: owner, error: fetchError } = await supabase
    .from("attendeeProfile")
    .select("network")
    .eq("email", ownerEmail)
    .single();

  if (fetchError) {
    console.error("Could not load network:", fetchError);
    return "failed";
  }

  const connections = parseEmails(owner?.network);

  if (connections.includes(connectionEmail)) return "already";

  const { error: updateError } = await supabase
    .from("attendeeProfile")
    .update({ network: [...connections, connectionEmail].join(",") })
    .eq("email", ownerEmail);

  if (updateError) {
    console.error("Could not update network:", updateError);
    return "failed";
  }

  return "added";
}

/**
 * Connects two attendees both ways from a tapped badge. There is no prompt:
 * the iOS sheet blocks touches, and holding up a badge already says who.
 */
async function connectFromBadge(
  myEmail: string,
  attendee: TaggedAttendee
): Promise<TapResult> {
  const name = `${attendee.firstName} ${attendee.lastName}`;

  if (normalizeEmail(attendee.email) === myEmail) {
    return {
      outcome: "rejected",
      title: "That's your badge",
      detail: "Tap another attendee's badge instead.",
    };
  }

  const result = await addConnection(myEmail, attendee.email);

  if (result === "failed") {
    return {
      outcome: "failed",
      title: "Could not add",
      detail: `${name} was not added. Try again.`,
    };
  }

  if (result === "already") {
    return {
      outcome: "duplicate",
      title: "Already connected",
      detail: `${attendee.firstName} is already in your network.`,
    };
  }

  await addConnection(attendee.email, myEmail);

  return { outcome: "success", title: "Added to your network", detail: name };
}

export default function Network() {
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<NetworkTab>("qr");

  // --- Connections list ---------------------------------------------------
  const [networkProfiles, setNetworkProfiles] = useState<NetworkProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const userEmail = user?.email;

  // Bumped after a successful scan so the list re-fetches.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userEmail) {
      return;
    }

    let isActive = true;

    async function loadNetwork() {
      const { data: me, error: networkError } = await supabase
        .from("attendeeProfile")
        .select("network")
        .eq("email", userEmail)
        .single();

      if (!isActive) return;

      if (networkError) {
        console.error("Could not load network:", networkError);
        setLoading(false);
        return;
      }

      const emails = (me?.network ?? "")
        .split(",")
        .map((email: string) => email.trim())
        .filter(Boolean);

      if (emails.length === 0) {
        setNetworkProfiles([]);
        setLoading(false);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("attendeeProfile")
        .select(
          "email, firstName, lastName, school, major, interests, linkedin, instagram, profilePictureUrl"
        )
        .in("email", emails);

      if (!isActive) return;

      if (profileError) {
        console.error("Could not load network profiles:", profileError);
        setLoading(false);
        return;
      }

      setNetworkProfiles((profiles ?? []) as NetworkProfile[]);
      setLoading(false);
    }

    void loadNetwork();

    return () => {
      isActive = false;
    };
  }, [userEmail, refreshKey]);

  // --- QR scanner ---------------------------------------------------------
  const [scannerOpen, setScannerOpen] = useState(false);
  const [layerMode, setLayerMode] = useState<ScanMode>("scan");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const isScanning = useRef(false);
  const lastScan = useRef<{ email: string; at: number } | null>(null);

  function resetScanner() {
    if (lastScan.current) lastScan.current.at = Date.now();
    isScanning.current = false;
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isScanning.current) return;

    const email = normalizeEmail(data);
    const at = Date.now();
    const last = lastScan.current;

    if (last && last.email === email && at - last.at < REPEAT_WINDOW_MS) {
      return;
    }

    isScanning.current = true;
    lastScan.current = { email, at };

    if (user?.email && email === normalizeEmail(user.email)) {
      Alert.alert("That's your code", "Scan another attendee's code instead.", [
        { text: "OK", onPress: resetScanner },
      ]);
      return;
    }

    const { data: attendee, error } = await supabase
      .from("attendeeProfile")
      .select("firstName, lastName, email")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Could not look up attendee:", error);
      Alert.alert("Error", "Could not look up this QR code. Please try again.", [
        { text: "OK", onPress: resetScanner },
      ]);
      return;
    }

    if (!attendee) {
      Alert.alert("QR Code Error", "No profile found for this QR code.", [
        { text: "OK", onPress: resetScanner },
      ]);
      return;
    }

    if (networkProfiles.some((profile) => profile.email === attendee.email)) {
      Alert.alert(
        "Already connected",
        `${attendee.firstName} is already in your network.`,
        [{ text: "OK", onPress: resetScanner }]
      );
      return;
    }

    Alert.alert(
      "Profile Found",
      `Add ${attendee.firstName} ${attendee.lastName} to your network?`,
      [
        { text: "Cancel", style: "cancel", onPress: resetScanner },
        {
          text: "Add Profile",
          onPress: async () => {
            if (!user?.email) {
              Alert.alert("Error", "User email not found.");
              resetScanner();
              return;
            }

            const myEmail = normalizeEmail(user.email);
            const added = await addConnection(myEmail, attendee.email);

            if (added === "failed") {
              Alert.alert("Error", "Failed to add profile to network.");
              resetScanner();
              return;
            }

            // Add the current user to the scanned attendee's network too.
            await addConnection(attendee.email, myEmail);

            // Close first: the code is still in view and would prompt again.
            setScannerOpen(false);
            Alert.alert(
              "Success",
              `${attendee.firstName} added to your network!`
            );
            setRefreshKey((key) => key + 1);
            resetScanner();
          },
        },
      ],
      { cancelable: false }
    );
  };

  async function openScanner() {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();

      if (!result.granted) {
        Alert.alert(
          "Permission Denied",
          "You need to grant camera permission to scan QR codes."
        );
        return;
      }
    }

    lastScan.current = null;
    resetScanner();
    tap.stop();
    setLayerMode("scan");
    setScannerOpen(true);
  }

  // --- Badge tapping ------------------------------------------------------
  const tap = useTagReader({
    alertMessage: "Hold a friend's badge to the phone to add them to your network",
    noun: "badge",
    unknownDetail: "Ask a staff member to link this badge.",
    onAttendee: async (attendee) => {
      if (!user?.email) {
        return {
          outcome: "failed",
          title: "Could not add",
          detail: "User email not found.",
        };
      }

      const result = await connectFromBadge(
        normalizeEmail(user.email),
        attendee
      );

      if (result.outcome === "success") setRefreshKey((key) => key + 1);

      return result;
    },
  });

  function openTap() {
    tap.reset();
    setLayerMode("nfc");
    setScannerOpen(true);
    void tap.start();
  }

  // The reader only runs while the Tap tab is showing.
  function changeLayerMode(mode: ScanMode) {
    if (mode === layerMode) return;

    if (mode === "nfc") {
      tap.reset();
      void tap.start();
    } else {
      tap.stop();
    }

    setLayerMode(mode);
  }

  function closeLayer() {
    tap.stop();
    setScannerOpen(false);
  }

  // Tabs stay mounted, so leaving this one has to turn the camera off too.
  useFocusEffect(
    useCallback(() => {
      return () => setScannerOpen(false);
    }, [])
  );

  // --- Views --------------------------------------------------------------
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const myCode = user?.email
    ? {
        value: user.email,
        name: fullName || undefined,
        subtitle:
          user.groupNumber != null ? `Group ${user.groupNumber}` : undefined,
      }
    : undefined;

  function renderQr() {
    return (
      <View style={styles.qrSection}>
        <Text style={styles.qrName}>{fullName || "Your name"}</Text>
        {user?.groupNumber != null ? (
          <Text style={styles.qrGroup}>Group {user.groupNumber}</Text>
        ) : null}

        <View style={styles.qrCodeWrapper}>
          {user?.email ? (
            <QRCode
              value={user.email}
              size={240}
              // The logo hides modules; lower levels can't always recover them.
              ecl="H"
              logoSVG={QR_LOGO_SVG}
              logoSize={60}
              logoMargin={4}
              logoBorderRadius={8}
              logoBackgroundColor="#FFFFFF"
            />
          ) : null}
        </View>

        <Text style={styles.qrHint}>
          Show this code to check in. To add someone to your network, tap their
          badge or scan their code.
        </Text>

        <View style={styles.addActions}>
          <Pressable
            onPress={openTap}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.addButton,
              styles.tapButton,
              pressed && styles.pressed,
            ]}
          >
            <SymbolIcon
              name="wave.3.right"
              fallback="radio-outline"
              size={20}
              weight="semibold"
              color="#FFFFFF"
            />
            <Text style={styles.tapButtonText}>Tap a Badge</Text>
          </Pressable>

          <Pressable
            onPress={() => void openScanner()}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.addButton,
              styles.scanButton,
              pressed && styles.pressed,
            ]}
          >
            <SymbolIcon
              name="qrcode.viewfinder"
              fallback="scan-outline"
              size={20}
              weight="semibold"
              color={theme.colors.primaryBlue}
            />
            <Text style={styles.scanButtonText}>Scan a QR Code</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderNetwork() {
    if (loading && userEmail) {
      return <Text style={styles.emptyText}>Loading your network...</Text>;
    }

    if (networkProfiles.length === 0) {
      return (
        <Text style={styles.emptyText}>
          No connections yet. Tap a badge or scan a QR code to add people to
          your network.
        </Text>
      );
    }

    return networkProfiles.map((item) => (
      <View key={item.email} style={styles.connectionCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>
              {item.firstName} {item.lastName}
            </Text>
            <Text style={styles.profileSchool}>
              {item.school || "School not added"}
            </Text>
            <Text style={styles.profileMajor}>
              {item.major || "Major not added"}
            </Text>
          </View>

          <Image
            source={{ uri: getProfileImageUrl(item.profilePictureUrl) }}
            style={styles.profileImage}
          />
        </View>

        <Text style={styles.profileInterests}>
          Interests: {item.interests || "Not added yet"}
        </Text>

        <View style={styles.socialButtons}>
          <View style={styles.socialButton}>
            <Button
              title={item.linkedin ? "LinkedIn" : "No LinkedIn"}
              variant="secondary"
              onPress={() => {
                if (item.linkedin) {
                  void openProfileLink(item.linkedin, "LinkedIn");
                } else {
                  Alert.alert(
                    "LinkedIn unavailable",
                    `${item.firstName} has not added a LinkedIn link.`
                  );
                }
              }}
            />
          </View>

          <View style={styles.socialButton}>
            <Button
              title={item.instagram ? "Instagram" : "No Instagram"}
              variant="secondary"
              onPress={() => {
                if (item.instagram) {
                  void openProfileLink(item.instagram, "Instagram");
                } else {
                  Alert.alert(
                    "Instagram unavailable",
                    `${item.firstName} has not added an Instagram link.`
                  );
                }
              }}
            />
          </View>
        </View>
      </View>
    ));
  }

  return (
    <ScannerLayer
      open={scannerOpen}
      onClose={closeLayer}
      hint="Point your camera at another attendee's code."
      onBarcodeScanned={(event) => void handleBarcodeScanned(event)}
      nfc={
        <NfcTapView
          state={tap.state}
          copy={BADGE_TAP_COPY}
          compactRingSize={BADGE_RING_SIZE}
          pillButtons
          footer={
            tap.lastTap ? (
              <View style={styles.tapFeedback}>
                <OutcomeIcon outcome={tap.lastTap.outcome} size={26} />
                <View style={styles.tapFeedbackText}>
                  <Text style={styles.tapFeedbackTitle} numberOfLines={1}>
                    {tap.lastTap.title}
                  </Text>
                  <Text style={styles.tapFeedbackDetail} numberOfLines={2}>
                    {tap.lastTap.detail}
                  </Text>
                </View>
              </View>
            ) : null
          }
          onStart={() => void tap.start()}
          onStop={tap.stop}
          onOpenSettings={() => void openNfcSettings()}
        />
      }
      myCode={myCode}
      mode={layerMode}
      onModeChange={changeLayerMode}
    >
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Network</Text>

          <SegmentedTabs
            tabs={NETWORK_TABS}
            value={activeTab}
            onChange={setActiveTab}
          />

          <View style={styles.tabContent}>
            {activeTab === "qr" ? renderQr() : renderNetwork()}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScannerLayer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: theme.colors.textPrimary,
    marginBottom: 20,
  },
  tabContent: {
    marginTop: 32,
  },
  // QR view
  qrSection: {
    alignItems: "center",
    paddingTop: 16,
  },
  qrName: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
  },
  qrGroup: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
    marginTop: 4,
  },
  qrCodeWrapper: {
    marginTop: 32,
    marginBottom: 28,
    padding: 20,
    borderRadius: 24,
    backgroundColor: theme.colors.backgroundWhite,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  qrHint: {
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  addActions: {
    alignSelf: "stretch",
    gap: 10,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 999,
  },
  tapButton: {
    backgroundColor: theme.colors.primaryBlue,
  },
  tapButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  scanButton: {
    backgroundColor: theme.colors.fillSecondary,
  },
  scanButtonText: {
    color: theme.colors.primaryBlue,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  // Tap result, drawn over the camera
  tapFeedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  tapFeedbackText: {
    flex: 1,
  },
  tapFeedbackTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: "#FFFFFF",
  },
  tapFeedbackDetail: {
    fontSize: 15,
    lineHeight: 20,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  // Network view
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  connectionCard: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  profileText: {
    flex: 1,
    paddingRight: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  profileSchool: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  profileMajor: {
    fontSize: 15,
    color: theme.colors.labelSecondary,
  },
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.fillTertiary,
  },
  profileInterests: {
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.labelSecondary,
    marginBottom: 16,
  },
  socialButtons: {
    flexDirection: "row",
    gap: 10,
  },
  socialButton: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
