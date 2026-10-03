import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/Button";
import SegmentedTabs from "@/components/SegmentedTabs";
import SymbolIcon from "@/components/SymbolIcon";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import theme from "@/theme";

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

const QR_LOGO = require("../../assets/images/bt_mark.png");

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
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const isScanning = useRef(false);

  function resetScanner() {
    setScanned(false);
    isScanning.current = false;
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isScanning.current || scanned) return;
    isScanning.current = true;
    setScanned(true);

    const { data: attendee, error } = await supabase
      .from("attendeeProfile")
      .select("firstName, lastName, email")
      .eq("email", data)
      .single();

    if (error || !attendee) {
      Alert.alert("QR Code Error", "No profile found for this QR code.", [
        { text: "OK", onPress: resetScanner },
      ]);
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

            const { data: me, error: fetchError } = await supabase
              .from("attendeeProfile")
              .select("network")
              .eq("email", user.email)
              .single();

            if (fetchError) {
              console.log(fetchError);
              Alert.alert("Error", "Failed to fetch your network.");
              resetScanner();
              return;
            }

            const currentConnections =
              typeof me?.network === "string" ? me.network : "";

            const updatedConnections =
              currentConnections.trim() === ""
                ? attendee.email
                : `${currentConnections},${attendee.email}`;

            const { error: updateError } = await supabase
              .from("attendeeProfile")
              .update({ network: updatedConnections })
              .eq("email", user.email);

            // Add the current user to the scanned attendee's network too.
            const { data: theirs } = await supabase
              .from("attendeeProfile")
              .select("network")
              .eq("email", attendee.email)
              .single();

            const theirConnections =
              typeof theirs?.network === "string" ? theirs.network : "";

            const theirUpdatedConnections =
              theirConnections.trim() === ""
                ? user.email
                : `${theirConnections},${user.email}`;

            await supabase
              .from("attendeeProfile")
              .update({ network: theirUpdatedConnections })
              .eq("email", attendee.email);

            if (updateError) {
              console.log(updateError);
              Alert.alert("Error", "Failed to add profile to network.");
            } else {
              Alert.alert(
                "Success",
                `${attendee.firstName} added to your network!`
              );
              setRefreshKey((key) => key + 1);
            }

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

    resetScanner();
    setShowScanner(true);
  }

  // --- Views --------------------------------------------------------------
  function renderQr() {
    const fullName = [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ");

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
              logo={QR_LOGO}
              logoSize={60}
              logoMargin={4}
              logoBorderRadius={8}
              logoBackgroundColor="#FFFFFF"
            />
          ) : null}
        </View>

        <Text style={styles.qrHint}>
          Show this code to check in, or scan another attendee&apos;s code to
          add them to your network.
        </Text>

        <Pressable
          onPress={() => void openScanner()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
        >
          <SymbolIcon
            name="qrcode.viewfinder"
            fallback="scan-outline"
            size={20}
            weight="semibold"
            color="#FFFFFF"
          />
          <Text style={styles.scanButtonText}>Scan a QR code</Text>
        </Pressable>
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
          No connections yet. Exchange QR codes to add people to your network.
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

      <Modal
        visible={showScanner}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerSheet}>
          <View style={styles.scannerHeader}>
            <View style={styles.scannerGrabber} />
            <View style={styles.scannerHeaderRow}>
              <Text style={styles.scannerTitle}>Scan QR Code</Text>
              <Pressable
                onPress={() => setShowScanner(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close scanner"
                style={({ pressed }) => [
                  styles.scannerClose,
                  pressed && styles.pressed,
                ]}
              >
                <SymbolIcon
                  name="xmark"
                  fallback="close"
                  size={16}
                  weight="bold"
                  color={theme.colors.labelSecondary}
                />
              </Pressable>
            </View>
            <Text style={styles.scannerHint}>
              Point your camera at another attendee&apos;s code.
            </Text>
          </View>

          <View style={styles.scannerCameraWrapper}>
            {showScanner && cameraPermission?.granted ? (
              <CameraView
                style={styles.flex}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.primaryBlue,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 999,
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  scannerSheet: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  scannerHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  scannerGrabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.fillTertiary,
    marginBottom: 16,
  },
  scannerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scannerTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  scannerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.fillSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerHint: {
    fontSize: 15,
    color: theme.colors.labelSecondary,
    marginTop: 6,
  },
  scannerCameraWrapper: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#000",
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
