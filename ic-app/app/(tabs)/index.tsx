import ConferenceMap from "@/components/ConferenceMap";
import SegmentedTabs from "@/components/SegmentedTabs";
import SymbolIcon from "@/components/SymbolIcon";
import {
  type EmergencyContact
} from "@/constants/emergencyContacts";
import { findMapRoom, type MapRoom } from "@/constants/mapRooms";
import { useUser } from "@/contexts/UserContext";
import { fullName } from "@/lib/attendance";
import { supabase } from "@/lib/supabase";
import theme from "@/theme";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

type ScheduleItem = {
  optionID: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  day: string;
  type: string;
  idSpeaker: string;
  speakers?: Speaker[];
  notScheduled?: boolean;
};

type Speaker = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  company: string | null;
  bio: string | null;
  event: string | null;
  day: string | null;
};

type AttendeeSchedule = {
  groupNumber: number;
  offsite: number | null;
  exec1: number | null;
  exec2: number | null;
  exec3: number | null;
  exec4: number | null;
};

type ScheduleOption = Pick<
  ScheduleItem,
  "optionID" | "title" | "startTime" | "endTime" | "day" | "type"
>;

type HomeTab = "schedule" | "map" | "emergency";

const HOME_TABS: { key: HomeTab; label: string }[] = [
  { key: "schedule", label: "Schedule" },
  { key: "map", label: "Map" },
  { key: "emergency", label: "Emergency" },
];

const DAY_KEYS = ["day1", "day2", "day3"] as const;

// Day of the month in November -> schedule day shown by default.
const CONFERENCE_DATE_TO_DAY: Record<number, (typeof DAY_KEYS)[number]> = {
  6: "day1",
  7: "day2",
  8: "day3",
};

// Time blocks attendees are assigned into: `exec1_2` is for whoever has exec1 = 2.
const ASSIGNED_BLOCKS = ["exec1", "exec2", "exec3", "exec4", "offsite"] as const;

// Stands in for a block the attendee has no session in. Blocks can mix session
// types, so it borrows the title and time of the most common option.
function notScheduledPlaceholder(
  block: (typeof ASSIGNED_BLOCKS)[number],
  options: ScheduleOption[]
): ScheduleItem {
  const titleCounts = new Map<string, number>();

  options.forEach((option) => {
    titleCounts.set(option.title, (titleCounts.get(option.title) ?? 0) + 1);
  });

  const mostCommon = options.reduce((best, option) =>
    titleCounts.get(option.title)! > titleCounts.get(best.title)! ? option : best
  );

  return {
    ...mostCommon,
    optionID: `${block}_not_scheduled`,
    location: "",
    idSpeaker: "",
    notScheduled: true,
  };
}

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

  const [activeTab, setActiveTab] = useState<HomeTab>("schedule");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [focusedRoom, setFocusedRoom] = useState<MapRoom | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const [groupContacts, setGroupContacts] = useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const parsedGroupNumber = Number(user?.groupNumber);

  const groupNumber =
    Number.isInteger(parsedGroupNumber) &&
    parsedGroupNumber >= 1 &&
    parsedGroupNumber <= 12
      ? parsedGroupNumber
      : null;

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

      const { data: optionRows, error: optionsError } = await supabase
        .from("scheduleOptions")
        .select("optionID, title, startTime, endTime, day, type")
        .order("optionID", { ascending: true });

      if (optionsError) {
        console.error("Could not load schedule options:", optionsError);

        return;
      }

      const allOptions = (optionRows ?? []) as ScheduleOption[];

      const scheduleIds = [
        `exec1_${attendeeSchedule.exec1}`,
        `exec2_${attendeeSchedule.exec2}`,
        `exec3_${attendeeSchedule.exec3}`,
        `exec4_${attendeeSchedule.exec4}`,
        `offsite_${attendeeSchedule.offsite}`,
        ...allOptions
          .filter((item) => item.type === "all")
          .map((item) => item.optionID),
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

      const placeholders = ASSIGNED_BLOCKS.flatMap((block) => {
        const options = allOptions.filter((option) =>
          option.optionID.startsWith(`${block}_`)
        );
        const assignedId = `${block}_${attendeeSchedule[block]}`;

        return options.length === 0 ||
          options.some((option) => option.optionID === assignedId)
          ? []
          : [notScheduledPlaceholder(block, options)];
      });

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
          .select("id, firstName, lastName, title, company, bio, event, day")
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

      setSchedule([...rawSchedule, ...placeholders]);
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

  // Conference days are Nov 6 (Fri), Nov 7 (Sat), Nov 8 (Sun).
  const todayKey = useMemo(() => {
    const today = new Date();
    if (today.getMonth() !== 10) return undefined;

    return CONFERENCE_DATE_TO_DAY[today.getDate()];
  }, []);

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

      return (
        !event.notScheduled &&
        isSameDate(start, now) &&
        end.getTime() > now.getTime()
      );
    });

    return current?.optionID ?? null;
  }, [eventsForDay]);

  function changeTab(tab: HomeTab) {
    if (tab === activeTab) {
      return;
    }

    setFocusedRoom(null);
    setActiveTab(tab);
  }

  function showRoomOnMap(room: MapRoom) {
    setFocusedRoom(room);
    setActiveTab("map");
  }

  // The schedule can be scrolled well past where the map will sit.
  useEffect(() => {
    if (focusedRoom) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [focusedRoom]);

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

  useEffect(() => {
    let active = true;

    setGroupContacts([]);
    setContactsError(null);

    if (!userEmail || groupNumber === null) {
      setContactsLoading(false);
      return;
    }

    setContactsLoading(true);

    async function loadGroupContacts() {
      try {
        const { data, error } = await supabase
          .from("smallGroups")
          .select("groupNumber, log, log_num, sr, sr_num")
          .eq("groupNumber", groupNumber)
          .maybeSingle();

        if (error) throw error;

        if (!active) return;

        if (!data) {
          setGroupContacts([]);
          return;
        }

        const contacts: EmergencyContact[] = [];

        if (data.log || data.log_num) {
          contacts.push({
            id: `group-${groupNumber}-log`,
            name: data.log?.trim() || "LOG Staffer",
            subtitle: `Logistics · Group ${groupNumber}`,
            phone: String(data.log_num ?? "").trim(),
          });
        }

        if (data.sr || data.sr_num) {
          contacts.push({
            id: `group-${groupNumber}-sr`,
            name: data.sr?.trim() || "SR Staffer",
            subtitle: `Student Relations · Group ${groupNumber}`,
            phone: String(data.sr_num ?? "").trim(),
          });
        }

        setGroupContacts(contacts);
      } catch (error) {
        if (!active) return;

        console.error("Could not load small group contacts:", error);

        setContactsError(
          "Your group contacts could not be loaded. Please try again."
        );
      } finally {
        if (active) {
          setContactsLoading(false);
        }
      }
    }

    void loadGroupContacts();

    return () => {
      active = false;
    };
  }, [userEmail, groupNumber]);

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
            const hasSpeakers = Boolean(event.speakers?.length);
            const mapRoom = findMapRoom(event.location);
            const notScheduled = Boolean(event.notScheduled);

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
                        notScheduled && styles.textNotScheduled,
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
                        notScheduled && styles.textNotScheduled,
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
                      {notScheduled
                        ? "You are not scheduled for this time"
                        : event.location || "Location TBD"}
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

                {expanded && (hasSpeakers || mapRoom) ? (
                  <View style={styles.sessionSpeakers}>
                    {event.speakers?.map((speaker) => {
                      const hasBio = Boolean(speaker.bio?.trim());

                      return (
                        <Pressable
                          key={speaker.id}
                          disabled={!hasBio}
                          onPress={() =>
                            router.push({
                              pathname: "/speakerDetail",
                              params: { id: speaker.id },
                            })
                          }
                          accessibilityRole={hasBio ? "button" : undefined}
                          accessibilityLabel={
                            hasBio ? `View bio for ${fullName(speaker)}` : undefined
                          }
                          style={({ pressed }) => [
                            styles.speakerRow,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.speakerText}>
                            <Text
                              style={[
                                styles.speakerName,
                                highlighted && styles.textOnBlue,
                              ]}
                            >
                              {fullName(speaker)}
                            </Text>
                            {speaker.company ? (
                              <Text
                                style={[
                                  styles.speakerCompany,
                                  highlighted && styles.textOnBlueMuted,
                                ]}
                              >
                                {speaker.company}
                              </Text>
                            ) : null}
                          </View>
                          {hasBio ? (
                            <SymbolIcon
                              name="chevron.right"
                              fallback="chevron-forward"
                              size={13}
                              weight="semibold"
                              color={
                                highlighted
                                  ? "rgba(255,255,255,0.8)"
                                  : theme.colors.labelTertiary
                              }
                            />
                          ) : null}
                        </Pressable>
                      );
                    })}

                    {mapRoom ? (
                      <Pressable
                        onPress={() => showRoomOnMap(mapRoom)}
                        accessibilityRole="button"
                        accessibilityLabel={`Show ${event.location} on map`}
                        style={({ pressed }) => [
                          styles.showOnMapRow,
                          pressed && styles.pressed,
                        ]}
                      >
                        <SymbolIcon
                          name="map"
                          fallback="map-outline"
                          size={18}
                          color={
                            highlighted ? "#FFFFFF" : theme.colors.primaryBlue
                          }
                        />
                        <Text
                          style={[
                            styles.showOnMapText,
                            highlighted && styles.textOnBlue,
                          ]}
                        >
                          Show on map
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
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
        <ConferenceMap focusRoom={focusedRoom} />
      </>
    );
  }

  function renderContactCard(contact: EmergencyContact) {
    return (
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
          <Text style={styles.contactName}>
            {contact.name}
          </Text>

          {contact.subtitle ? (
            <Text style={styles.contactSubtitle}>
              {contact.subtitle}
            </Text>
          ) : null}

          {contact.phone ? (
            <Text style={styles.contactSubtitle}>
              {contact.phone}
            </Text>
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
    );
  }

  function renderEmergency() {
    return (
      <View>
        <Text style={styles.sectionTitle}>
          {groupNumber !== null
            ? `Group ${groupNumber} Contacts`
            : "Your Group Contacts"}
        </Text>

        {groupNumber === null ? (
          <Text style={styles.emptyText}>
            You have not been assigned a small group yet.
          </Text>
        ) : contactsLoading ? (
          <Text style={styles.emptyText}>
            Loading your group contacts…
          </Text>
        ) : contactsError ? (
          <Text style={styles.emptyText}>
            {contactsError}
          </Text>
        ) : groupContacts.length === 0 ? (
          <Text style={styles.emptyText}>
            No contacts have been added for your group yet.
          </Text>
        ) : (
          <View style={styles.contactList}>
            {groupContacts.map(renderContactCard)}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Home</Text>

        <SegmentedTabs
          tabs={HOME_TABS}
          value={activeTab}
          onChange={changeTab}
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
    marginTop: 8,
    marginLeft: 95,
  },
  speakerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  speakerText: {
    flex: 1,
    paddingRight: 12,
  },
  speakerName: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
  },
  speakerCompany: {
    fontSize: 14,
    color: theme.colors.labelSecondary,
    marginTop: 2,
  },
  showOnMapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  showOnMapText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.primaryBlue,
  },
  textOnBlue: {
    color: "#FFFFFF",
  },
  textOnBlueMuted: {
    color: "rgba(255,255,255,0.8)",
  },
  textNotScheduled: {
    color: theme.colors.labelSecondary,
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
  emergencySection: {
    marginTop: 28,
  },
});
