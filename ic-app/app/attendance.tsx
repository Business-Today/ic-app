import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import DayTabs from "@/components/DayTabs";
import ListRow, { ListGroup } from "@/components/ListRow";
import OutcomeIcon from "@/components/OutcomeIcon";
import PageHeader from "@/components/PageHeader";
import SectionLabel from "@/components/SectionLabel";
import SymbolIcon from "@/components/SymbolIcon";
import TimeBlock from "@/components/TimeBlock";
import {
  DAY_KEYS,
  buildSpeakerMap,
  checkInAttendee,
  dayLabelsFor,
  describeCheckIn,
  fetchCheckedInEmails,
  fetchSessions,
  fetchSpeakers,
  formatTimeRange,
  hapticFor,
  normalizeEmail,
  sessionDetailLine,
  sessionSubtitle,
  sessionsInProgress,
  todayDayKey,
  type CheckInOutcome,
  type DayKey,
  type Session,
  type Speaker,
} from "@/lib/attendance";
import theme from "@/theme";

const HELP_CONTACT = { name: "Miyu", phone: "412-277-1460" };

// A code still in front of the camera is read many times a second. Ignore
// repeats of the same code for this long so one person gets one result.
const REPEAT_WINDOW_MS = 4000;
// Pause after any result so the next person has time to step up.
const SCAN_COOLDOWN_MS = 1500;

type ScanFeedback = {
  outcome: CheckInOutcome | null;
  title: string;
  detail: string;
};

const IDLE_FEEDBACK: ScanFeedback = {
  outcome: null,
  title: "Ready to scan",
  detail: "Point the camera at an attendee's QR code.",
};

export default function Attendance() {
  const router = useRouter();

  // --- Sessions -----------------------------------------------------------
  const [sessions, setSessions] = useState<Session[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedInCount, setCheckedInCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const [sessionRows, speakerRows] = await Promise.all([
        fetchSessions(),
        fetchSpeakers(),
      ]);

      if (!active) return;

      setSessions(sessionRows);
      setSpeakers(speakerRows);
      setLoaded(true);

      // Pre-select the session happening right now, but only when it is
      // unambiguous: parallel seminars leave the choice to the staff member.
      const live = sessionsInProgress(sessionRows);

      if (live.length === 1) {
        setSelectedId(live[0].optionID);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const speakerMap = useMemo(() => buildSpeakerMap(speakers), [speakers]);
  const dayLabels = useMemo(() => dayLabelsFor(sessions), [sessions]);
  const todayKey = useMemo(() => todayDayKey(sessions), [sessions]);

  const selectedSession =
    sessions.find((session) => session.optionID === selectedId) ?? null;

  // Re-count whenever the screen is focused: records and manual check-in
  // both change the number while this screen is behind them.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!selectedId) {
        setCheckedInCount(null);
        return;
      }

      void fetchCheckedInEmails(selectedId).then((emails) => {
        if (active) setCheckedInCount(emails.length);
      });

      return () => {
        active = false;
      };
    }, [selectedId])
  );

  const sessionParams = selectedSession
    ? {
        eventID: selectedSession.optionID,
        eventName: selectedSession.title,
        eventSubtitle: sessionSubtitle(selectedSession, dayLabels, speakerMap),
      }
    : null;

  // --- Session picker -----------------------------------------------------
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDay, setPickerDay] = useState<DayKey>("day1");

  function openPicker() {
    const initialDay =
      (DAY_KEYS.find((key) => key === selectedSession?.day) ?? todayKey) ||
      "day1";

    setPickerDay(initialDay);
    setPickerOpen(true);
  }

  const pickerSessions = useMemo(
    () => sessions.filter((session) => session.day === pickerDay),
    [sessions, pickerDay]
  );

  // --- QR scanner ---------------------------------------------------------
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [feedback, setFeedback] = useState<ScanFeedback>(IDLE_FEEDBACK);
  const isScanning = useRef(false);
  const lastScan = useRef<{ email: string; at: number } | null>(null);

  async function openScanner() {
    if (!selectedSession) return;

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();

      if (!result.granted) {
        Alert.alert(
          "Camera access needed",
          "Allow camera access in Settings to scan QR codes."
        );
        return;
      }
    }

    isScanning.current = false;
    lastScan.current = null;
    setFeedback(IDLE_FEEDBACK);
    setScannerOpen(true);
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (!selectedId || isScanning.current) return;

    const email = normalizeEmail(data);
    const at = Date.now();
    const last = lastScan.current;

    if (last && last.email === email && at - last.at < REPEAT_WINDOW_MS) {
      return;
    }

    isScanning.current = true;
    lastScan.current = { email, at };

    try {
      const result = await checkInAttendee(selectedId, email, {
        manual: false,
      });
      const described = describeCheckIn(result);

      setFeedback(described);
      hapticFor(described.outcome);

      if (result.status === "checked_in") {
        setCheckedInCount((count) => (count ?? 0) + 1);
      }
    } finally {
      setTimeout(() => {
        isScanning.current = false;
      }, SCAN_COOLDOWN_MS);
    }
  }

  // --- Views --------------------------------------------------------------
  const selectedDetail = selectedSession
    ? sessionDetailLine(selectedSession, speakerMap)
    : "";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Attendance" />

        <SectionLabel first>Session</SectionLabel>
        <Pressable
          onPress={openPicker}
          disabled={!loaded}
          accessibilityRole="button"
          accessibilityLabel="Choose a session"
          style={({ pressed }) => [
            styles.sessionCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.sessionText}>
            {selectedSession ? (
              <>
                <Text style={styles.sessionCaption}>
                  {dayLabels[selectedSession.day as DayKey]} ·{" "}
                  {formatTimeRange(
                    selectedSession.startTime,
                    selectedSession.endTime
                  )}
                </Text>
                <Text style={styles.sessionTitle} numberOfLines={2}>
                  {selectedSession.title}
                </Text>
                {selectedDetail ? (
                  <Text style={styles.sessionDetail} numberOfLines={1}>
                    {selectedDetail}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.sessionTitle}>
                  {loaded ? "Choose a session" : "Loading sessions"}
                </Text>
                <Text style={styles.sessionDetail}>
                  Pick the session you are checking people into.
                </Text>
              </>
            )}
          </View>
          <SymbolIcon
            name="chevron.up.chevron.down"
            fallback="chevron-expand-outline"
            size={16}
            weight="semibold"
            color={theme.colors.labelTertiary}
          />
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              if (!sessionParams) return;
              router.push({ pathname: "/nfcCheckIn", params: sessionParams });
            }}
            disabled={!selectedSession}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              !selectedSession && styles.buttonDisabled,
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
            <Text style={styles.primaryButtonText}>Tap NFC Tags</Text>
          </Pressable>

          <Pressable
            onPress={() => void openScanner()}
            disabled={!selectedSession}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondaryButton,
              !selectedSession && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <SymbolIcon
              name="qrcode.viewfinder"
              fallback="qr-code-outline"
              size={20}
              weight="semibold"
              color={theme.colors.primaryBlue}
            />
            <Text style={styles.secondaryButtonText}>Scan QR Codes</Text>
          </Pressable>
        </View>

        <SectionLabel>This Session</SectionLabel>
        <ListGroup>
          <ListRow
            title="Checked in"
            subtitle="Everyone recorded so far, most recent first"
            disabled={!selectedSession}
            divider
            trailing={
              <View style={styles.rowTrailing}>
                <Text style={styles.rowValue}>
                  {checkedInCount === null ? "" : checkedInCount}
                </Text>
                <SymbolIcon
                  name="chevron.right"
                  fallback="chevron-forward"
                  size={14}
                  weight="semibold"
                  color={theme.colors.labelTertiary}
                />
              </View>
            }
            onPress={() => {
              if (!sessionParams) return;
              router.push({
                pathname: "/attendanceRecords",
                params: sessionParams,
              });
            }}
          />
          <ListRow
            title="Check in manually"
            subtitle="Find someone by name when a tag or code fails"
            disabled={!selectedSession}
            onPress={() => {
              if (!sessionParams) return;
              router.push({ pathname: "/manualCheckIn", params: sessionParams });
            }}
          />
        </ListGroup>

        <SectionLabel>Attendees</SectionLabel>
        <ListGroup>
          <ListRow
            title="Look up an attendee"
            subtitle="Every session someone has checked into"
            divider
            onPress={() => router.push("/attendeeAttendance")}
          />
          <ListRow
            title="NFC tags"
            subtitle="Link a tag to each attendee"
            onPress={() => router.push("/assignNfcTag")}
          />
        </ListGroup>

        <Pressable
          onPress={() => void Linking.openURL(`tel:${HELP_CONTACT.phone}`)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${HELP_CONTACT.name}`}
          hitSlop={8}
          style={({ pressed }) => [styles.help, pressed && styles.pressed]}
        >
          <Text style={styles.helpText}>
            Urgent issue?{" "}
            <Text style={styles.helpLink}>Call {HELP_CONTACT.name}</Text>
          </Text>
        </Pressable>
      </ScrollView>

      {/* Session picker */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Choose a Session</Text>
              <Pressable
                onPress={() => setPickerOpen(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [
                  styles.sheetClose,
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
            <View style={styles.sheetTabs}>
              <DayTabs
                days={DAY_KEYS.map((key) => ({ key, label: dayLabels[key] }))}
                value={pickerDay}
                onChange={setPickerDay}
              />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            {pickerSessions.length === 0 ? (
              <Text style={styles.emptyText}>No sessions this day.</Text>
            ) : (
              <ListGroup>
                {pickerSessions.map((session, index) => {
                  const selected = session.optionID === selectedId;

                  return (
                    <ListRow
                      key={session.optionID}
                      title={session.title}
                      titleLines={2}
                      subtitle={sessionDetailLine(session, speakerMap)}
                      leading={
                        <TimeBlock
                          startTime={session.startTime}
                          endTime={session.endTime}
                        />
                      }
                      trailing={
                        selected ? (
                          <SymbolIcon
                            name="checkmark.circle.fill"
                            fallback="checkmark-circle"
                            size={22}
                            color={theme.colors.primaryBlue}
                          />
                        ) : null
                      }
                      divider={index < pickerSessions.length - 1}
                      onPress={() => {
                        setSelectedId(session.optionID);
                        setPickerOpen(false);
                      }}
                    />
                  );
                })}
              </ListGroup>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* QR scanner */}
      <Modal
        visible={scannerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Scan QR Codes</Text>
              <Pressable
                onPress={() => setScannerOpen(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close scanner"
                style={({ pressed }) => [
                  styles.sheetClose,
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
            <Text style={styles.sheetHint} numberOfLines={1}>
              {selectedSession?.title}
            </Text>
          </View>

          <View style={styles.cameraWrapper}>
            {scannerOpen && cameraPermission?.granted ? (
              <CameraView
                style={styles.flex}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={(event) => void handleBarcodeScanned(event)}
              />
            ) : null}
          </View>

          <View style={styles.feedback}>
            {feedback.outcome ? (
              <OutcomeIcon outcome={feedback.outcome} size={26} />
            ) : (
              <SymbolIcon
                name="qrcode.viewfinder"
                fallback="qr-code-outline"
                size={26}
                color={theme.colors.labelSecondary}
              />
            )}
            <View style={styles.feedbackText}>
              <Text style={styles.feedbackTitle} numberOfLines={1}>
                {feedback.title}
              </Text>
              <Text style={styles.feedbackDetail} numberOfLines={2}>
                {feedback.detail}
              </Text>
            </View>
            <View style={styles.feedbackCount}>
              <Text style={styles.feedbackCountValue}>
                {checkedInCount ?? 0}
              </Text>
              <Text style={styles.feedbackCountLabel}>checked in</Text>
            </View>
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
    paddingTop: 8,
    paddingBottom: 48,
  },
  // Session card
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  sessionText: {
    flex: 1,
  },
  sessionCaption: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
    marginBottom: 4,
  },
  sessionTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  sessionDetail: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.labelSecondary,
    marginTop: 3,
  },
  // Actions
  actions: {
    marginTop: 16,
    gap: 10,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primaryBlue,
    borderRadius: 16,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 16,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: theme.colors.primaryBlue,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  // Grouped rows
  rowTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowValue: {
    fontSize: 17,
    color: theme.colors.labelSecondary,
  },
  // Help
  help: {
    alignItems: "center",
    paddingVertical: 32,
  },
  helpText: {
    fontSize: 15,
    color: theme.colors.labelSecondary,
  },
  helpLink: {
    color: theme.colors.primaryBlue,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  // Sheets
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.fillTertiary,
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.fillSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHint: {
    fontSize: 15,
    color: theme.colors.labelSecondary,
    marginTop: 6,
  },
  sheetTabs: {
    marginTop: 16,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  cameraWrapper: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 40,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: theme.colors.fillSecondary,
  },
  feedbackText: {
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  feedbackDetail: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.labelSecondary,
    marginTop: 2,
  },
  feedbackCount: {
    alignItems: "flex-end",
  },
  feedbackCountValue: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
  },
  feedbackCountLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
