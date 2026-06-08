import { View, FlatList, Text, TouchableOpacity,  } from "react-native";
import Card from "../../components/Card";
import theme from "../../theme";
import { useState, useMemo } from "react";
import Button from "../../components/Button";
import { useUser } from "../../contexts/UserContext";
import { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useLocalSearchParams } from "expo-router";

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState("day1");
  const [mode, setMode] = useState<"schedule" | "speakers">("schedule");
  const { user } = useUser();
  const [personalSchedules, setSchedules] = useState<PersonalSchedule | null>(null);
  const [speakersAll, setSpeakersAll] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [seminarSpeakers, setSeminarSpeakers] = useState<Speaker[]>([]);
  const { schedule, setSchedule } = useUser();
  const params = useLocalSearchParams();


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
    id: string;
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
    if (!user?.id) return;

    async function loadSchedule() {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("personalSchedule")
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
    if (seminar_ids.length === 0) return;
    async function loadSeminarSpeakers() {
      const { data, error } = await supabase
        .from("speakerProfileSem")
        .select('*')
        .in('id', seminar_ids);

        if (error) {
          console.error(error);
          return;
        }
        setSeminarSpeakers(data ?? []);
      }
        loadSeminarSpeakers();
    }, [seminar_ids]);


  const schedule_ids = useMemo(() => {
    if (!personalSchedules) return [];

    return [
      `exec1_${personalSchedules.exec1}`,
      `exec2_${personalSchedules.exec2}`,
      `exec3_${personalSchedules.exec3}`,
      `exec4_${personalSchedules.exec4}`,
      `offsite_${personalSchedules.offsite}`,
      "all",
    ];
  }, [personalSchedules]);

  useEffect(() => {
    if (schedule_ids.length === 0) return;

    async function loadScheduleAll() {
      const { data, error } = await supabase
        .from("scheduleOptions")
        .select("*")
        .in("optionID", schedule_ids);

      if (error) {
        console.error(error);
        return;
      }

      setSchedule(data ?? []);
    }

    loadScheduleAll();
  }, [schedule_ids]);



  useEffect(() => {
    async function loadSpeakersAll(){
      const { data, error } = await supabase
      .from("speakerProfileAll")
      .select("*");

      if (error) {
        console.error(error);
        return;
      }

      setSpeakersAll(data);
    }

    loadSpeakersAll()
  }, []);

  const speakers = useMemo(() => {
    return [...seminarSpeakers, ...speakersAll];
  }, [seminarSpeakers, speakersAll]);

  const speakerMap = new Map(
    speakers.map((speaker) => [speaker.id, speaker])
  );
  const scheduleWithNames = schedule.map((event) => {
    let speakerNames = (event?.idSpeaker ?? "")
      .split(",")
      .map((id) => speakerMap.get(id.trim()))
      .filter((s): s is Speaker => s !== undefined)
      .map((s) => `${s.firstName} ${s.lastName}`)
      .join(", ");
    
    if (event?.type === "group"){
      speakerNames = personalSchedules ? `Group ${personalSchedules.groupNumber}` : "";
    }

    return {
      ...event,
      idSpeaker: speakerNames,
    };
  });
return (
  <View style={{ flex: 1 }}>
    {/* HEADER */}
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

    {/* LISTS */}
    {mode === "speakers" ? (
      <FlatList<Speaker>
        data={speakers.filter((item) => item.day === selectedDay)}
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
        data={scheduleWithNames.filter(
          (item) => item.day === selectedDay
        )}
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