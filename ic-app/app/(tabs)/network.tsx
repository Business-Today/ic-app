import { useCameraPermissions } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInRight,
  FadeOut,
  FadeOutRight,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/components/Avatar";
import ListRow from "@/components/ListRow";
import NfcTapView, { type TapCopy } from "@/components/NfcTapView";
import OutcomeIcon from "@/components/OutcomeIcon";
import ScannerLayer, { type ScanMode } from "@/components/ScannerLayer";
import SearchField from "@/components/SearchField";
import SegmentedTabs from "@/components/SegmentedTabs";
import SymbolIcon from "@/components/SymbolIcon";
import { useUser } from "@/contexts/UserContext";
import { useTagReader, type TapResult } from "@/hooks/use-nfc-reader";
import {
  fullName,
  normalizeEmail,
} from "@/lib/attendance";
import {
  addToNetwork,
  fetchDirectory,
  fetchNetworkEmails,
  profileImageUrl,
  type DirectoryAttendee,
} from "@/lib/network";
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
  unavailableBody:
    "This phone cannot read badges. Scan their QR code or use the Directory instead.",
};

const BADGE_RING_SIZE = 180;

const SEARCH_TIMING = {
  duration: 280,
  easing: Easing.bezier(0.2, 0, 0, 1),
};
const ROW_FADE_TIMING = { duration: 220, easing: Easing.out(Easing.quad) };

// The search field's height, and the title and tabs' until they're measured.
const SEARCH_HEADER_HEIGHT = 44;
const TITLE_HEADER_HEIGHT = 94;

/** Rows share one opacity, so a new list fades in as a whole. */
function FadingRow({
  opacity,
  children,
}: {
  opacity: SharedValue<number>;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

type NetworkTab = "network" | "directory";

const NETWORK_TABS: { key: NetworkTab; label: string }[] = [
  { key: "network", label: "My Network" },
  { key: "directory", label: "Directory" },
];

/**
 * Connects two attendees both ways from a tapped badge. There is no prompt:
 * the iOS sheet blocks touches, and holding up a badge already says who.
 */
async function connectFromBadge(
  myEmail: string,
  attendee: TaggedAttendee
): Promise<TapResult> {
  const name = fullName(attendee) || attendee.email;

  if (normalizeEmail(attendee.email) === normalizeEmail(myEmail)) {
    return {
      outcome: "rejected",
      title: "That's your badge",
      detail: "Tap another attendee's badge instead.",
    };
  }

  const result = await addToNetwork(myEmail, attendee.email, { mutual: true });

  if (result === "error") {
    return {
      outcome: "failed",
      title: "Could not add",
      detail: `${name} was not added. Try again.`,
    };
  }

  if (result === "already_added") {
    return {
      outcome: "duplicate",
      title: "Already connected",
      detail: `${name} is already in your network.`,
    };
  }

  return { outcome: "success", title: "Added to your network", detail: name };
}

export default function Network() {
  const router = useRouter();
  const { user } = useUser();
  const canTapBadges = Platform.OS === "ios";

  const [activeTab, setActiveTab] = useState<NetworkTab>("network");

  // --- Connections list ---------------------------------------------------
  const [networkEmails, setNetworkEmails] = useState<Set<string>>(new Set());
  const [networkProfiles, setNetworkProfiles] = useState<DirectoryAttendee[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const userEmail = user?.email;

  // Bumped after adding someone so the list re-fetches.
  const [refreshKey, setRefreshKey] = useState(0);

  // Also re-fetches when the scanner closes, since someone may have scanned
  // this attendee's code while it was showing, and on focus, since the profile
  // sheet can add someone while it covers this screen.
  const [scannerOpen, setScannerOpen] = useState(false);

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
            "email, firstName, lastName, school, major, interests, bio, linkedin, instagram, profilePictureUrl"
          )
          .in("email", emails)
          .order("lastName", { ascending: true })
          .order("firstName", { ascending: true });

        if (!isActive) return;

        if (profileError) {
          console.error("Could not load network profiles:", profileError);
          setLoading(false);
          return;
        }

        setNetworkProfiles((profiles ?? []) as DirectoryAttendee[]);
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
  const [searching, setSearching] = useState(false);
  const listRef = useRef<FlatList<DirectoryAttendee>>(null);

  // 0 = title and tabs, 1 = search field.
  const searchProgress = useSharedValue(0);
  const titleHeaderHeight = useSharedValue(TITLE_HEADER_HEIGHT);
  const rowOpacity = useSharedValue(1);

  function openSearch() {
    setSearching(true);
    searchProgress.value = withTiming(1, SEARCH_TIMING);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  function closeSearch() {
    Keyboard.dismiss();
    setQuery("");
    setSearching(false);
    searchProgress.value = withTiming(0, SEARCH_TIMING);
  }

  function fadeInRows() {
    rowOpacity.value = 0;
    rowOpacity.value = withTiming(1, ROW_FADE_TIMING);
  }

  function changeTab(tab: NetworkTab) {
    if (tab === activeTab) return;

    fadeInRows();
    setActiveTab(tab);
  }

  function handleTitleHeaderLayout(event: LayoutChangeEvent) {
    titleHeaderHeight.value = event.nativeEvent.layout.height;
  }

  const headerBodyStyle = useAnimatedStyle(() => ({
    height: interpolate(
      searchProgress.value,
      [0, 1],
      [titleHeaderHeight.value, SEARCH_HEADER_HEIGHT]
    ),
  }));

  const titleHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      searchProgress.value,
      [0, 0.6],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const scanPillStyle = useAnimatedStyle(() => ({
    opacity: 1 - searchProgress.value,
  }));

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
        (!term ||
          fullName(attendee).toLowerCase().includes(term) ||
          attendee.school?.toLowerCase().includes(term))
    );
  }, [directory, query, userEmail]);

  // Fade rows in when the list they're waiting on finishes its first load.
  const listLoaded = activeTab === "directory" ? directory !== null : !loading;

  useEffect(() => {
    if (!listLoaded) return;

    rowOpacity.value = 0;
    rowOpacity.value = withTiming(1, ROW_FADE_TIMING);
  }, [listLoaded, rowOpacity]);

  // --- QR scanner ---------------------------------------------------------
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

    if (!user?.email) {
      Alert.alert("Error", "User email not found.", [
        { text: "OK", onPress: resetScanner },
      ]);
      return;
    }

    const myEmail = user.email;

    if (email === normalizeEmail(myEmail)) {
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
              resetScanner();
              return;
            }

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
    // NFC and My Code work without the camera, so a refusal doesn't block
    // opening. The Scan tab explains how to allow it.
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
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

      const result = await connectFromBadge(user.email, attendee);

      if (result.outcome === "success") setRefreshKey((key) => key + 1);

      return result;
    },
  });

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
  const myName = fullName(user ?? {});

  const myCode = user?.email
    ? {
        value: user.email,
        name: myName || undefined,
        subtitle:
          user.groupNumber != null ? `Group ${user.groupNumber}` : undefined,
      }
    : undefined;

  const isDirectory = activeTab === "directory";
  const rows = isDirectory ? directoryRows : networkProfiles;

  function openProfile(person: DirectoryAttendee) {
    const email = normalizeEmail(person.email);
    const showSocials = !isDirectory;

    router.push({
      pathname: "/directoryProfile",
      params: {
        email,
        firstName: person.firstName ?? "",
        lastName: person.lastName ?? "",
        school: person.school ?? "",
        major: person.major ?? "",
        interests: person.interests ?? "",
        bio: person.bio ?? "",
        profilePictureUrl: person.profilePictureUrl ?? "",
        linkedin: person.linkedin ?? "",
        instagram: person.instagram ?? "",
        showSocials: showSocials ? "true" : "false",
      },
    });
  }

  function renderNetworkEmpty() {
    if (loading && userEmail) {
      return <Text style={styles.emptyText}>Loading your network...</Text>;
    }

    return (
      <Text style={styles.emptyText}>
        No connections yet.{" "}
        {canTapBadges
          ? "Tap a badge or scan a QR code"
          : "Scan a QR code"}{" "}
        to connect with someone.
      </Text>
    );
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
    <ScannerLayer
      open={scannerOpen}
      onClose={closeLayer}
      hint="Point your camera at another attendee's code."
      onBarcodeScanned={(event) => void handleBarcodeScanned(event)}
      nfc={
        canTapBadges ? (
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
        ) : undefined
      }
      myCode={myCode}
      mode={layerMode}
      onModeChange={changeLayerMode}
    >
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(item) => item.email}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.header}>
              <Animated.View style={[styles.headerBody, headerBodyStyle]}>
                <Animated.View
                  onLayout={handleTitleHeaderLayout}
                  accessibilityElementsHidden={searching}
                  style={[
                    styles.headerLayer,
                    titleHeaderStyle,
                    searching && styles.inert,
                  ]}
                >
                  <View style={styles.titleRow}>
                    <Text style={styles.pageTitle}>Network</Text>

                    {isDirectory ? (
                      <Animated.View
                        entering={FadeIn.duration(180)}
                        exiting={FadeOut.duration(120)}
                      >
                        <Pressable
                          onPress={openSearch}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="Search the directory"
                          style={({ pressed }) => pressed && styles.pressed}
                        >
                          <SymbolIcon
                            name="magnifyingglass"
                            fallback="search"
                            size={26}
                            weight="medium"
                            color={theme.colors.primaryBlue}
                          />
                        </Pressable>
                      </Animated.View>
                    ) : null}
                  </View>

                  <SegmentedTabs
                    tabs={NETWORK_TABS}
                    value={activeTab}
                    onChange={changeTab}
                  />
                </Animated.View>

                {searching ? (
                  <Animated.View
                    entering={FadeInRight.duration(280).easing(
                      SEARCH_TIMING.easing
                    )}
                    exiting={FadeOutRight.duration(180)}
                    style={[styles.headerLayer, styles.searchHeader]}
                  >
                    <View style={styles.searchField}>
                      <SearchField
                        pill
                        placeholder="Search by name or school"
                        value={query}
                        onChangeText={setQuery}
                        autoFocus
                      />
                    </View>

                    <Pressable
                      onPress={closeSearch}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Close search"
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <SymbolIcon
                        name="xmark"
                        fallback="close"
                        size={22}
                        weight="medium"
                        color={theme.colors.primaryBlue}
                      />
                    </Pressable>
                  </Animated.View>
                ) : null}
              </Animated.View>
            </View>
          }
          ListEmptyComponent={
            <FadingRow opacity={rowOpacity}>
              {isDirectory ? renderDirectoryEmpty() : renderNetworkEmpty()}
            </FadingRow>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FadingRow opacity={rowOpacity}>
              <ListRow
                plain
                leading={
                  <Avatar
                    firstName={item.firstName}
                    lastName={item.lastName}
                    imageUrl={profileImageUrl(item.profilePictureUrl)}
                  />
                }
                title={fullName(item) || "Attendee"}
                subtitle={[item.school?.trim(), item.major?.trim()]
                  .filter(Boolean)
                  .join(" · ")}
                subtitleLines={1}
                onPress={() => openProfile(item)}
              />
            </FadingRow>
          )}
        />

        <Animated.View
          accessibilityElementsHidden={searching}
          style={[
            styles.scanPillPosition,
            scanPillStyle,
            searching && styles.inert,
          ]}
        >
          <Pressable
            onPress={() => void openScanner()}
            accessibilityRole="button"
            accessibilityLabel={
              canTapBadges ? "Scan, tap or show my code" : "Scan or show my code"
            }
            style={({ pressed }) => [
              styles.scanPill,
              pressed && styles.pressed,
            ]}
          >
            <SymbolIcon
              name="qrcode.viewfinder"
              fallback="scan-outline"
              size={20}
              weight="semibold"
              color="#FFFFFF"
            />
            <Text style={styles.scanPillText}>Scan</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </ScannerLayer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  header: {
    paddingTop: 40,
    marginBottom: 16,
  },
  // Edge to edge, so the clip doesn't cut off the tabs' horizontal scroll.
  headerBody: {
    marginHorizontal: -20,
    overflow: "hidden",
  },
  headerLayer: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
  },
  inert: {
    pointerEvents: "none",
  },
  // Tall enough for the search button, so the tabs don't shift when it appears.
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: theme.colors.textPrimary,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchField: {
    flex: 1,
  },
  // The bottom padding lets the last row scroll clear of the scan pill.
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  // The screen's bottom edge sits right above the tab bar. This clears the
  // 24pt fade the bar draws over the screen.
  scanPillPosition: {
    position: "absolute",
    bottom: Platform.OS === "android" ? 68 : 28,
    alignSelf: "center",
  },
  scanPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.primaryBlue,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  scanPillText: {
    color: "#FFFFFF",
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
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.7,
  },
});
