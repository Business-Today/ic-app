import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ConferenceMap from "@/components/ConferenceMap";
import SegmentedTabs from "@/components/SegmentedTabs";
import SymbolIcon from "@/components/SymbolIcon";
import { emergencyContacts } from "@/constants/emergencyContacts";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import theme from "@/theme";

type ScheduleItem = {
  optionID: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  day: string;
  type: string;
  idSpeaker: string;
};

type Speaker = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  event: string;
  day: string;
};

type AttendeeSchedule = {
  groupNumber: number;
  offsite: number;
  exec1: number;
  exec2: number;
  exec3: number;
  exec4: number;
};

type HomeTab = "schedule" | "map" | "emergency";

const HOME_TABS: { key: HomeTab; label: string }[] = [
  { key: "schedule", label: "Schedule" },
  { key: "map", label: "Map" },
  { key: "emergency", label: "Emergency" },
];

const DAY_KEYS = ["day1", "day2", "day3"] as const;

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function splitTime(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return { time: "TBD", period: "" };
  }

  const formatted = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const [time, period = ""] = formatted.split(" ");

  return { time, period: period.toLowerCase() };
}

export default function Home() {
  const { user, setUser, scheduleWithNames, setSchedule, setSpeakersAll } =
    useUser();

  const router = useRouter();

  const canTakeAttendance = !!user?.email?.endsWith("@princeton.edu");

  const [activeTab, setActiveTab] = useState<HomeTab>("schedule");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser?.email) {
        if (isMounted) {
          router.replace("/login");
        }

        return;
      }

      const normalizedEmail = authUser.email.trim().toLowerCase();

      const { data: attendee, error: profileError } = await supabase
        .from("attendeeProfile")
        .select(
          "email, firstName, lastName, linkedin, instagram, school, major, interests, profilePictureUrl, groupNumber"
        )
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileError || !attendee) {
        console.error("Could not load attendee profile:", profileError);

        await supabase.auth.signOut({ scope: "local" });

        if (isMounted) {
          router.replace("/login");
        }

        return;
      }

      if (isMounted) {
        setUser(attendee);
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [router, setUser]);

  const userEmail = user?.email;

  useEffect(() => {
    if (!userEmail) {
      return;
    }

    let isMounted = true;

    async function loadPersonalSchedule() {
      const normalizedEmail = userEmail!.trim().toLowerCase();

      const { data: attendeeSchedule, error: attendeeError } = await supabase
        .from("attendeeProfile")
        .select("groupNumber, offsite, exec1, exec2, exec3, exec4")
        .eq("email", normalizedEmail)
        .maybeSingle<AttendeeSchedule>();

      if (attendeeError || !attendeeSchedule) {
        console.error(
          "Could not load attendee schedule choices:",
          attendeeError
        );

        if (isMounted) {
          setSchedule([]);
          setSpeakersAll([]);
        }

        return;
      }

      const { data: allScheduleRows, error: allScheduleError } = await supabase
        .from("scheduleOptions")
        .select("optionID")
        .eq("type", "all");

      if (allScheduleError) {
        console.error(
          "Could not load all-event schedule option IDs:",
          allScheduleError
        );

        return;
      }

      const scheduleIds = [
        `exec1_${attendeeSchedule.exec1}`,
        `exec2_${attendeeSchedule.exec2}`,
        `exec3_${attendeeSchedule.exec3}`,
        `exec4_${attendeeSchedule.exec4}`,
        `offsite_${attendeeSchedule.offsite}`,
        ...(allScheduleRows ?? []).map((item) => item.optionID),
      ];

      const uniqueScheduleIds = [...new Set(scheduleIds)];

      const { data: scheduleData, error: scheduleError } = await supabase
        .from("scheduleOptions")
        .select("*")
        .in("optionID", uniqueScheduleIds)
        .order("startTime", { ascending: true })
        .order("title", { ascending: true });

      if (scheduleError) {
        console.error("Could not load schedule:", scheduleError);
        return;
      }

      const rawSchedule = (scheduleData ?? []) as ScheduleItem[];

      const speakerIds = [
        ...new Set(
          rawSchedule.flatMap((event) =>
            (event.idSpeaker ?? "")
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          )
        ),
      ];

      let speakers: Speaker[] = [];

      if (speakerIds.length > 0) {
        const { data: speakerData, error: speakerError } = await supabase
          .from("speakerProfile")
          .select("id, firstName, lastName, title, company, event, day")
          .in("id", speakerIds);

        if (speakerError) {
          console.error("Could not load speakers:", speakerError);
          return;
        }

        speakers = (speakerData ?? []) as Speaker[];
      }

      if (!isMounted) {
        return;
      }

      setSchedule(rawSchedule);
      setSpeakersAll(speakers);
    }

    void loadPersonalSchedule();

    return () => {
      isMounted = false;
    };
  }, [userEmail, setSchedule, setSpeakersAll]);

  const schedule = useMemo(
    () =>
      (Array.isArray(scheduleWithNames) ? scheduleWithNames : []).filter(
        (event) => event && typeof event.startTime === "string"
      ) as ScheduleItem[],
    [scheduleWithNames]
  );

  // Weekday label for each day key, derived from the earliest event that day.
  const dayLabels = useMemo(() => {
    const labels: Record<string, string> = {};

    DAY_KEYS.forEach((dayKey, index) => {
      const firstEvent = schedule
        .filter((event) => event.day === dayKey)
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )[0];

      const date = firstEvent ? new Date(firstEvent.startTime) : null;

      labels[dayKey] =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString("en-US", { weekday: "long" })
          : `Day ${index + 1}`;
    });

    return labels;
  }, [schedule]);

  // Day key whose events fall on today's date, if the conference is underway.
  const todayKey = useMemo(() => {
    const today = new Date();

    return DAY_KEYS.find((dayKey) =>
      schedule.some(
        (event) =>
          event.day === dayKey && isSameDate(new Date(event.startTime), today)
      )
    );
  }, [schedule]);

  // null means "no manual choice yet": default to today, else the first day.
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const selectedDay = chosenDay ?? todayKey ?? DAY_KEYS[0];

  const eventsForDay = useMemo(
    () =>
      schedule
        .filter((event) => event.day === selectedDay)
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        ),
    [schedule, selectedDay]
  );

  // Highlight the current or next session, but only on the day it happens.
  const highlightedEventId = useMemo(() => {
    const now = new Date();

    const current = eventsForDay.find((event) => {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);

      return isSameDate(start, now) && end.getTime() > now.getTime();
    });

    return current?.optionID ?? null;
  }, [eventsForDay]);

  async function callContact(name: string, phone: string) {
    if (!phone) {
      Alert.alert(
        "Number not available",
        `A phone number for ${name} has not been added yet.`
      );
      return;
    }

    const url = `tel:${phone}`;
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert("Could not place call", `Dial ${phone} manually.`);
      return;
    }

    await Linking.openURL(url);
  }

  function renderSchedule() {
    return (
      <>
        <Text style={styles.sectionTitle}>Your Schedule</Text>

        <View style={styles.dayRow}>
          {DAY_KEYS.map((dayKey) => {
            const selected = dayKey === selectedDay;

            return (
              <Pressable
                key={dayKey}
                onPress={() => setChosenDay(dayKey)}
                hitSlop={8}
                style={styles.dayButton}
              >
                <Text
                  style={[styles.dayLabel, selected && styles.dayLabelSelected]}
                >
                  {dayLabels[dayKey]}
                </Text>
                <View
                  style={[
                    styles.dayUnderline,
                    selected && styles.dayUnderlineSelected,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        {eventsForDay.length === 0 ? (
          <Text style={styles.emptyText}>No sessions scheduled this day.</Text>
        ) : (
          eventsForDay.map((event) => {
            const highlighted = event.optionID === highlightedEventId;
            const expanded = event.optionID === expandedEventId;
            const start = splitTime(event.startTime);
            const end = splitTime(event.endTime);

            return (
              <Pressable
                key={event.optionID}
                onPress={() =>
                  setExpandedEventId(expanded ? null : event.optionID)
                }
                style={({ pressed }) => [
                  styles.sessionCard,
                  highlighted && styles.sessionCardHighlighted,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.sessionRow}>
                  <View style={styles.timeBlock}>
                    <Text
                      style={[
                        styles.timeText,
                        highlighted && styles.textOnBlue,
                      ]}
                    >
                      {start.time}
                      <Text style={styles.timePeriod}> {start.period}</Text>
                    </Text>
                    <Text
                      style={[
                        styles.timeText,
                        styles.timeTextEnd,
                        highlighted && styles.textOnBlueMuted,
                      ]}
                    >
                      {end.time}
                      <Text style={styles.timePeriod}> {end.period}</Text>
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.timeDivider,
                      highlighted && styles.timeDividerHighlighted,
                    ]}
                  />

                  <View style={styles.sessionText}>
                    <Text
                      style={[
                        styles.sessionTitle,
                        highlighted && styles.textOnBlue,
                      ]}
                      numberOfLines={expanded ? undefined : 1}
                    >
                      {event.title ?? "Untitled session"}
                    </Text>
                    <Text
                      style={[
                        styles.sessionLocation,
                        highlighted && styles.textOnBlueMuted,
                      ]}
                      numberOfLines={expanded ? undefined : 1}
                    >
                      {event.location || "Location TBD"}
                    </Text>
                  </View>

                  <SymbolIcon
                    name={expanded ? "chevron.down" : "chevron.right"}
                    fallback={expanded ? "chevron-down" : "chevron-forward"}
                    size={16}
                    weight="semibold"
                    color={
                      highlighted
                        ? "rgba(255,255,255,0.8)"
                        : theme.colors.labelTertiary
                    }
                  />
                </View>

                {expanded && event.idSpeaker ? (
                  <Text
                    style={[
                      styles.sessionSpeakers,
                      highlighted && styles.textOnBlueMuted,
                    ]}
                  >
                    {event.idSpeaker}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </>
    );
  }

  function renderMap() {
    return (
      <>
        <Text style={styles.sectionTitle}>Conference Map</Text>
        <ConferenceMap />
      </>
    );
  }

  function renderEmergency() {
    return (
      <View style={styles.contactList}>
        {emergencyContacts.map((contact) => (
          <Pressable
            key={contact.id}
            onPress={() => void callContact(contact.name, contact.phone)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${contact.name}`}
            style={({ pressed }) => [
              styles.contactCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.contactText}>
              <Text style={styles.contactName}>{contact.name}</Text>
              {contact.subtitle ? (
                <Text style={styles.contactSubtitle}>{contact.subtitle}</Text>
              ) : null}
            </View>
            <View style={styles.callBadge}>
              <SymbolIcon
                name="phone.fill"
                fallback="call"
                size={18}
                color={theme.colors.primaryBlue}
              />
            </View>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Home</Text>

        <SegmentedTabs
          tabs={HOME_TABS}
          value={activeTab}
          onChange={setActiveTab}
          trailing={
            canTakeAttendance ? (
              <Pressable
                onPress={() => router.push("/attendance")}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.attendanceButton,
                  pressed && styles.pressed,
                ]}
              >
                <SymbolIcon
                  name="qrcode.viewfinder"
                  fallback="qr-code-outline"
                  size={16}
                  weight="semibold"
                  color={theme.colors.primaryBlue}
                />
                <Text style={styles.attendanceButtonText}>Attendance</Text>
              </Pressable>
            ) : null
          }
        />

        <View style={styles.tabContent}>
          {activeTab === "schedule" && renderSchedule()}
          {activeTab === "map" && renderMap()}
          {activeTab === "emergency" && renderEmergency()}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  attendanceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.fillSecondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  attendanceButtonText: {
    color: theme.colors.primaryBlue,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  tabContent: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  dayRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 20,
  },
  dayButton: {
    paddingVertical: 4,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
  },
  dayLabelSelected: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  dayUnderline: {
    height: 2,
    marginTop: 6,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  dayUnderlineSelected: {
    backgroundColor: theme.colors.textPrimary,
  },
  emptyText: {
    fontSize: 17,
    color: theme.colors.labelSecondary,
  },
  sessionCard: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  sessionCardHighlighted: {
    backgroundColor: theme.colors.primaryBlue,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeBlock: {
    width: 78,
    gap: 3,
  },
  timeText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
  },
  timeTextEnd: {
    color: theme.colors.labelSecondary,
    fontWeight: "500",
  },
  timePeriod: {
    fontSize: 11,
    fontWeight: "500",
  },
  timeDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: theme.colors.fillTertiary,
    marginRight: 16,
  },
  timeDividerHighlighted: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  sessionText: {
    flex: 1,
    paddingRight: 12,
  },
  sessionTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  sessionLocation: {
    fontSize: 14,
    color: theme.colors.labelSecondary,
    marginTop: 3,
  },
  sessionSpeakers: {
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.labelSecondary,
    marginTop: 12,
    marginLeft: 95,
  },
  textOnBlue: {
    color: "#FFFFFF",
  },
  textOnBlueMuted: {
    color: "rgba(255,255,255,0.8)",
  },
  contactList: {
    gap: 12,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  contactText: {
    flex: 1,
    paddingRight: 12,
  },
  contactName: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  contactSubtitle: {
    fontSize: 14,
    color: theme.colors.labelSecondary,
    marginTop: 3,
  },
  callBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
