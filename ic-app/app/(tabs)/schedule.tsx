import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import Button from "../../components/Button";
import Card from "../../components/Card";
import { useUser } from "../../contexts/UserContext";
import { supabase } from "../../lib/supabase";
import theme from "../../theme";

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState(() => {
  const today = new Date().getDate(); // day of the month: 1–31

  // Replace these dates with the real dates of your 3-day event
  if (today === 6) return "day1";
  if (today === 7) return "day2";
  if (today === 8) return "day3";

  return "day1"; // fallback before/after the event
});
  const [mode, setMode] = useState<"schedule" | "speakers">("schedule");
  const { user } = useUser();
  const [personalSchedules, setSchedules] = useState<PersonalSchedule | null>(null);
  const {speakersAll, setSpeakersAll} = useUser();
  const [loading, setLoading] = useState(true);
  const { schedule, setSchedule } = useUser();
  const params = useLocalSearchParams();
  const [allScheduleIds, setAllScheduleIds] = useState<string[]>([]);
  const [allScheduleIdsLoaded, setAllScheduleIdsLoaded] = useState(false);



  useEffect(() => {
    if (params.mode === "speakers") {
      setMode("speakers");
    }
  }, [params.mode]);

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  type PersonalSchedule = {
    groupNumber: number;
    offsite: number;
    exec1: number;
    exec2: number;
    exec3: number;
    exec4: number;
  };

  type FullSchedule = {
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    type: string;
    idSpeaker: string;
    day: string;
    optionID: string;
  }

  type Speaker = {
    firstName: string;
    lastName: string;
    title: string;
    company: string;
    event: string;
    day: string;
    id: string;
  }


  useEffect(() => {
    if (!user?.email) return;

    async function loadSchedule() {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("attendeeProfile")
        .select("groupNumber, offsite, exec1, exec2, exec3, exec4")
        .eq("email", user.email)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setSchedules(data);
      setLoading(false);
    }

    loadSchedule();
  }, [user]);

  const seminar_ids = useMemo(() => {
    if (!personalSchedules) return [];

    return [
      `exec1_${personalSchedules.exec1}`,
      `exec2_${personalSchedules.exec2}`,
      `exec3_${personalSchedules.exec3}`,
      `exec4_${personalSchedules.exec4}`,
      `offsite_${personalSchedules.offsite}`,
    ];
  }, [personalSchedules]);


  useEffect(() => {
    async function loadAllScheduleOptionIds() {
      const { data, error } = await supabase
        .from("scheduleOptions")
        .select("optionID, type");

      if (error) {
        console.error(error);
        return;
      }

      const typeAllIds = (data ?? [])
        .filter((item: { type?: string }) => item.type === "all")
        .map((item: { optionID: string }) => item.optionID);

      setAllScheduleIds(typeAllIds);
      setAllScheduleIdsLoaded(true);
    }

    loadAllScheduleOptionIds();
  }, []);

  const schedule_ids = useMemo(() => {
    if (!personalSchedules) return allScheduleIds;

    return [
      `exec1_${personalSchedules.exec1}`,
      `exec2_${personalSchedules.exec2}`,
      `exec3_${personalSchedules.exec3}`,
      `exec4_${personalSchedules.exec4}`,
      `offsite_${personalSchedules.offsite}`,
      "all",
      ...allScheduleIds,
    ];
  }, [personalSchedules, allScheduleIds]);



  useEffect(() => {
    if (!allScheduleIdsLoaded || !personalSchedules) return;
    if (schedule_ids.length === 0) return;

    let isActive = true;

    async function loadScheduleAll() {
      const { data, error } = await supabase
        .from("scheduleOptions")
        .select("*")
        .in("optionID", schedule_ids);

      if (error) {
        console.error(error);
        return;
      }

      if (isActive) {
        setSchedule(data ?? []);
      }
    }

    loadScheduleAll();

    return () => {
      isActive = false;
    };
  }, [schedule_ids]);

  const speaker_ids = useMemo(() => {
    return Array.from(
      new Set(
        schedule.flatMap((event) =>
          (event?.idSpeaker ?? "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        )
      )
    );
  }, [schedule]);

  useEffect(() => {
    if (speaker_ids.length === 0) return;

    async function loadSpeakers() {
      const { data, error } = await supabase
        .from("speakerProfile")
        .select("*")
        .in("id", speaker_ids);

      if (error) {
        console.error(error);
        return;
      }
      setSpeakersAll(data ?? []);
    }

    loadSpeakers();
  }, [speaker_ids]);

const speakerMap = useMemo(
  () => new Map(speakersAll.map((speaker) => [speaker.id, speaker] as const)),
  [speakersAll]
);

const scheduleWithNames = useMemo(() => {
  return schedule.map((event) => {
    const speakerNames =
      event.type === "group"
        ? personalSchedules
          ? `Group ${personalSchedules.groupNumber}`
          : ""
        : (event.idSpeaker ?? "")
            .split(",")
            .map((id) => speakerMap.get(id.trim()))
            .filter((speaker): speaker is Speaker => Boolean(speaker))
            .map((speaker) => `${speaker.firstName} ${speaker.lastName}`)
            .join(", ");

    return { ...event, idSpeaker: speakerNames };
  });
}, [schedule, speakerMap, personalSchedules]);

const visibleSpeakers = useMemo(
  () => speakersAll.filter((speaker) => speaker.day === selectedDay),
  [speakersAll, selectedDay]
);

const sortedScheduleForSelectedDay = useMemo(() => {
  return scheduleWithNames
    .filter((event) => event.day === selectedDay)
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
}, [scheduleWithNames, selectedDay]);

return (
  <View style={{ flex: 1 }}>
    <View style={{ padding: 16, gap: 12 }}>
      <Text
        style={[
          theme.typography.biggestTitle,
          {
            color: theme.colors.primaryBlue,
            textAlign: "center",
          },
        ]}
      >
        {user?.firstName}'s Schedule
      </Text>

      {/* DAY BUTTONS */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["day1", "day2", "day3"].map((day) => (
          <View key={day} style={{ flex: 1 }}>
            <Button
              title={day.toUpperCase()}
              selected={selectedDay === day}
              onPress={() => setSelectedDay(day)}
            />
          </View>
        ))}
      </View>

      {/* MODE BUTTONS */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Speaker View"
            selected={mode === "speakers"}
            onPress={() => setMode("speakers")}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Button
            title="Schedule View"
            selected={mode === "schedule"}
            onPress={() => setMode("schedule")}
          />
        </View>
      </View>
    </View>

    {mode === "speakers" ? (
      <FlatList<Speaker>
        data={speakersAll.filter((item) => item.day === selectedDay)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Card>
            <Text
              style={[
                theme.typography.sectionTitle,
                { color: theme.colors.primaryBlue, marginBottom: 8 },
              ]}
            >
              {item.firstName} {item.lastName}
            </Text>

            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.primaryDarkGray, marginBottom: 8 },
              ]}
            >
              {item.title} · {item.company}
            </Text>

            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.primaryDarkGray },
              ]}
            >
              {item.event}
            </Text>
          </Card>
        )}
      />
    ) : (
      <FlatList<FullSchedule>
        data={sortedScheduleForSelectedDay}
        keyExtractor={(item) => item.optionID}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Card>
            <Text
              style={[
                theme.typography.sectionTitle,
                { color: theme.colors.primaryBlue, marginBottom: 8 },
              ]}
            >
              {item.title}
            </Text>

            {item.idSpeaker ? (
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.primaryDarkGray, marginBottom: 8 },
                ]}
              >
                {item.idSpeaker}
              </Text>
            ) : null}

            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.primaryDarkGray },
              ]}
            >
              {formatTime(item.startTime)} - {formatTime(item.endTime)} · {item.location}
            </Text>
          </Card>
        )}
      />
    )}
  </View>
);
}