import { useCameraPermissions } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import ListRow from "@/components/ListRow";
import NetworkNfcTab from "@/components/NetworkNfcTab";
import SearchField from "@/components/SearchField";
import SegmentedTabs from "@/components/SegmentedTabs";
import SymbolIcon from "@/components/SymbolIcon";
import { useScanner } from "@/contexts/ScannerContext";
import { useUser } from "@/contexts/UserContext";
import {
  fullName,
  hapticFor,
  normalizeEmail,
  type Attendee,
} from "@/lib/attendance";
import {
  addToNetwork,
  fetchDirectory,
  fetchNetworkEmails,
  openProfileLink,
  type DirectoryAttendee,
} from "@/lib/network";
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

type NetworkTab = "network" | "directory";

const NETWORK_TABS: { key: NetworkTab; label: string }[] = [
  { key: "network", label: "My Network" },
  { key: "directory", label: "Directory" },
];

function getProfileImageUrl(profilePictureUrl: string | null) {
  return supabase.storage
    .from("profilePictures")
    .getPublicUrl(profilePictureUrl ?? "anonymous.jpg").data.publicUrl;
}

export default function Network() {
  const router = useRouter();
  const { user } = useUser();
  const scanner = useScanner();

  const [activeTab, setActiveTab] = useState<NetworkTab>("network");

  // --- Connections list ---------------------------------------------------
  const [networkEmails, setNetworkEmails] = useState<Set<string>>(new Set());
  const [networkProfiles, setNetworkProfiles] = useState<NetworkProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const userEmail = user?.email;

  // Bumped after adding someone so the list re-fetches.
  const [refreshKey, setRefreshKey] = useState(0);

  // Also re-fetches when the scanner closes, since someone may have scanned
  // this attendee's code while it was showing, and on focus, since the profile
  // sheet can add someone while it covers this screen.
  const scannerOpen = scanner.isOpen;

  useFocusEffect(
    useCallback(() => {
      if (!userEmail) {
        return;
      }

      let isActive = true;

      async function loadNetwork(email: string) {
        const { emails, error: networkError } = await fetchNetworkEmails(email);

        if (!isActive) return;

        if (networkError) {
          setLoading(false);
          return;
        }

        setNetworkEmails(new Set(emails));

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

      void loadNetwork(userEmail);

      return () => {
        isActive = false;
      };
      // refreshKey and scannerOpen are triggers, not values read here.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userEmail, refreshKey, scannerOpen])
  );

  // --- Directory ----------------------------------------------------------
  const [directory, setDirectory] = useState<DirectoryAttendee[] | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Fetched each time the tab opens, which also retries after a failure.
  useEffect(() => {
    if (activeTab !== "directory") return;

    let isActive = true;

    void fetchDirectory().then(({ attendees, error }) => {
      if (!isActive) return;

      setDirectoryError(error);
      if (!error) setDirectory(attendees);
    });

    return () => {
      isActive = false;
    };
  }, [activeTab]);

  const directoryRows = useMemo(() => {
    const me = normalizeEmail(userEmail ?? "");
    const term = query.trim().toLowerCase();

    return (directory ?? []).filter(
      (attendee) =>
        normalizeEmail(attendee.email) !== me &&
        (!term || fullName(attendee).toLowerCase().includes(term))
    );
  }, [directory, query, userEmail]);

  // Only adds to this attendee's own list; the other person isn't there to
  // agree, unlike a QR or NFC exchange.
  async function addFromDirectory(attendee: Attendee) {
    if (!userEmail || pendingEmail) return;

    const email = normalizeEmail(attendee.email);
    setPendingEmail(email);

    const result = await addToNetwork(userEmail, email, { mutual: false });

    setPendingEmail(null);

    if (result === "error") {
      hapticFor("failed");
      Alert.alert("Error", "Failed to add profile to network.");
      return;
    }

    hapticFor("success");
    setNetworkEmails((previous) => new Set(previous).add(email));
    setRefreshKey((key) => key + 1);
  }

  // --- QR scanner ---------------------------------------------------------
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const isScanning = useRef(false);

  function resetScanner() {
    isScanning.current = false;
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isScanning.current) return;
    isScanning.current = true;

    const email = normalizeEmail(data);

    const { data: attendee, error } = await supabase
      .from("attendeeProfile")
      .select("firstName, lastName, email")
      .eq("email", email)
      .maybeSingle();

    if (error || !attendee) {
      Alert.alert("QR Code Error", "No profile found for this QR code.", [
        { text: "OK", onPress: resetScanner },
      ]);
      return;
    }

    if (!user?.email) {
      Alert.alert("Error", "User email not found.", [
        { text: "OK", onPress: resetScanner },
      ]);
      return;
    }

    const myEmail = user.email;

    if (email === normalizeEmail(myEmail)) {
      Alert.alert("That's You", "This is your own QR code.", [
        { text: "OK", onPress: resetScanner },
      ]);
      return;
    }

    if (networkEmails.has(email)) {
      // They may have been added from the Directory, which is one-way, so the
      // in-person exchange still completes their side.
      await addToNetwork(myEmail, email, { mutual: true });

      Alert.alert(
        "Already Connected",
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
            const result = await addToNetwork(myEmail, email, { mutual: true });

            if (result === "error") {
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
    // NFC and My Code work without the camera, so a refusal doesn't block
    // opening. The Scan tab explains how to allow it.
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }

    resetScanner();
    scanner.open({
      hint: "Point your camera at another attendee's code.",
      // Go through the ref so the scanner always calls the latest handler.
      onBarcodeScanned: (event) => void handleScanRef.current(event),
      nfc: <NetworkNfcTab onAdded={() => setRefreshKey((key) => key + 1)} />,
    });
  }

  // The scanner keeps the handler it was opened with; this ref lets that
  // handler see current state without reopening.
  const handleScanRef = useRef(handleBarcodeScanned);

  useEffect(() => {
    handleScanRef.current = handleBarcodeScanned;
  });

  // --- Views --------------------------------------------------------------
  function renderNetwork() {
    if (loading && userEmail) {
      return <Text style={styles.emptyText}>Loading your network...</Text>;
    }

    if (networkProfiles.length === 0) {
      return (
        <Text style={styles.emptyText}>
          No connections yet. Exchange codes with someone, or add people from
          the Directory.
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

  function renderDirectoryEmpty() {
    if (directory === null) {
      return (
        <Text style={styles.emptyText}>
          {directoryError
            ? `${directoryError}. Please check your connection and try again.`
            : "Loading the directory..."}
        </Text>
      );
    }

    return (
      <Text style={styles.emptyText}>
        {query.trim()
          ? `No attendees match "${query.trim()}".`
          : "No attendees yet."}
      </Text>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Network</Text>

          <Pressable
            onPress={() => void openScanner()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Scan, tap or show my code"
            style={({ pressed }) => [
              styles.scanButton,
              pressed && styles.pressed,
            ]}
          >
            <SymbolIcon
              name="qrcode.viewfinder"
              fallback="scan-outline"
              size={22}
              weight="semibold"
              color={theme.colors.primaryBlue}
            />
          </Pressable>
        </View>

        <SegmentedTabs
          tabs={NETWORK_TABS}
          value={activeTab}
          onChange={setActiveTab}
        />
      </View>

      {activeTab === "network" ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {renderNetwork()}
        </ScrollView>
      ) : (
        <>
          <View style={styles.search}>
            <SearchField
              placeholder="Search by name"
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <FlatList
            data={directoryRows}
            keyExtractor={(item) => item.email}
            contentContainerStyle={styles.directoryContent}
            ListEmptyComponent={renderDirectoryEmpty()}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const name = fullName(item) || item.email;
              const email = normalizeEmail(item.email);
              const pending = pendingEmail === email;

              return (
                <ListRow
                  first={index === 0}
                  last={index === directoryRows.length - 1}
                  divider={index < directoryRows.length - 1}
                  leading={
                    <Avatar
                      firstName={item.firstName}
                      lastName={item.lastName}
                    />
                  }
                  title={name}
                  onPress={() =>
                    router.push({
                      pathname: "/directoryProfile",
                      params: {
                        email,
                        firstName: item.firstName ?? "",
                        lastName: item.lastName ?? "",
                        school: item.school ?? "",
                        major: item.major ?? "",
                        linkedin: item.linkedin ?? "",
                        instagram: item.instagram ?? "",
                        inNetwork: String(networkEmails.has(email)),
                      },
                    })
                  }
                  trailing={
                    networkEmails.has(email) ? (
                      <View style={styles.addedState}>
                        <SymbolIcon
                          name="checkmark.circle.fill"
                          fallback="checkmark-circle"
                          size={20}
                          color={theme.colors.primaryBlue}
                        />
                        <Text style={styles.addedText}>Added</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => void addFromDirectory(item)}
                        disabled={pendingEmail !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${name} to your network`}
                        style={({ pressed }) => [
                          styles.addPill,
                          pressed && styles.pressed,
                        ]}
                      >
                        {pending ? (
                          <ActivityIndicator
                            size="small"
                            color={theme.colors.primaryBlue}
                          />
                        ) : (
                          <Text style={styles.addText}>Add</Text>
                        )}
                      </Pressable>
                    )
                  }
                />
              );
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: theme.colors.textPrimary,
  },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.fillSecondary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
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
  // Directory view
  search: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  directoryContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  addPill: {
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.backgroundWhite,
  },
  addText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.primaryBlue,
  },
  addedState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addedText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
