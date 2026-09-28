import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";

import Button from "../../components/Button";
import Card from "../../components/Card";
import { useUser } from "../../contexts/UserContext";
import theme from "../../theme";

type ScheduleItem = {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  type?: string;
  idSpeaker: string;
  day: string;
  optionID: string;
  speakerNames?: string;
};

type Speaker = {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  event: string;
  day: string;
  id: string;
};

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date().getDate();

    if (today === 6) return "day1";
    if (today === 7) return "day2";
    if (today === 8) return "day3";

    return "day1";
  });

  const [mode, setMode] = useState<"schedule" | "speakers">("schedule");

  const { user, scheduleWithNames, speakersAll } = useUser();
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

  const visibleSpeakers = useMemo(() => {
    return (speakersAll as Speaker[]).filter(
      (speaker) => speaker.day === selectedDay
    );
  }, [speakersAll, selectedDay]);

  const sortedScheduleForSelectedDay = useMemo(() => {
    return (scheduleWithNames as ScheduleItem[])
      .filter((event) => event.day === selectedDay)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() -
          new Date(b.startTime).getTime()
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
          data={visibleSpeakers}
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
        <FlatList<ScheduleItem>
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
                {formatTime(item.startTime)} - {formatTime(item.endTime)} ·{" "}
                {item.location}
              </Text>
            </Card>
          )}
        />
      )}
    </View>
  );
}