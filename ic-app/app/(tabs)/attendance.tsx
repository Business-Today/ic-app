import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import RNPickerSelect from "react-native-picker-select";
import Toast from "react-native-toast-message";
import Button from "../../components/Button";
import theme from "../../theme";

type Schedule = {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  type?: string;
  idSpeaker: string;
  day: string;
  optionID: string;
  numberAttendees?: number;
};

type Speaker = {
  id: string;
  firstName: string;
  lastName: string;
};

export default function Attendance() {
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date().getDate(); // day of the month: 1–31

    // Replace these dates with the real dates of your 3-day event
    if (today === 6) return "day1";
    if (today === 7) return "day2";
    if (today === 8) return "day3";

    return "day1"; // fallback before/after the event
  });
  const [scheduleAll, setScheduleAll] = useState<Schedule[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [speakersAll, setSpeakersAll] = useState<Speaker[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function loadCount() {
      if (!selectedEvent) {
        setAttendeeCount(0);
        return;
      }

      const { data, error } = await supabase
        .from("scheduleOptions")
        .select("numberAttendees")
        .eq("optionID", selectedEvent)
        .single();

      if (error || !data) {
        setAttendeeCount(0);
        return;
      }

      setAttendeeCount(data.numberAttendees ?? 0);
    }

    loadCount();
  }, [selectedEvent]);

  useEffect(() => {
    async function loadScheduleAll() {
      const { data, error } = await supabase
        .from("scheduleOptions")
        .select("*")
        .order("startTime", { ascending: true })
        .order("title", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      setScheduleAll(data);
    }

    loadScheduleAll();
  }, []);

  useEffect(() => {
    async function loadSpeakers() {
      const { data, error } = await supabase.from("speakerProfile").select("*");

      if (error) {
        console.error(error);
        return;
      }

      setSpeakersAll(data);
    }
    loadSpeakers();
  }, []);

  const speakerMap = new Map(speakersAll.map((speaker) => [speaker.id, speaker]));

  const selectedEventObj = scheduleAll.find((event) => event.optionID === selectedEvent);
  const eventName = selectedEventObj ? selectedEventObj.title : "";
  const selectedSpeaker = selectedEventObj ? speakerMap.get(selectedEventObj.idSpeaker) : undefined;
  const eventSpeaker = [selectedSpeaker?.firstName, selectedSpeaker?.lastName]
    .filter((name) => name && name !== "undefined" && name !== "null")
    .join(" ");

  const eventMap = scheduleAll.reduce(
    (acc, event) => {
      const speakerData = speakerMap.get(event.idSpeaker);

      const speaker = [speakerData?.firstName, speakerData?.lastName]
        .filter((name) => name && name !== "undefined" && name !== "null")
        .join(" ");
      acc[event.optionID] = {
        eventID: event.optionID,
        eventName: event.title,
        speaker,
      };
      return acc;
    },
    {} as Record<string, { eventID: string; eventName: string; speaker: string }>
  );

  const requireEvent = () => {
    if (selectedEvent) return true;

    Toast.show({
      type: "error",
      text1: "Select an event first",
      position: "bottom",
      visibilityTime: 2000,
    });
    return false;
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 16,
        paddingVertical: 24,
      }}
    >
      <Text
        style={[
          theme.typography.biggestTitle,
          {
            color: theme.colors.primaryBlue,
            textAlign: "center",
            marginBottom: 16,
          },
        ]}
      >
        Attendance
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
      <RNPickerSelect
        placeholder={{
          label: "Select an event...",
          value: null,
        }}
        value={selectedEvent}
        onValueChange={setSelectedEvent}
        items={scheduleAll
          .filter((event) => event.day === selectedDay)
          .map((event) => {
            const speaker = speakerMap.get(event.idSpeaker);
            const isSpeakerEvent =
              event.title.startsWith("Executive") || event.title.startsWith("Keynote");

            const label =
              isSpeakerEvent && speaker?.firstName && speaker?.lastName
                ? `${event.title}, ${speaker.firstName} ${speaker.lastName}`
                : event.title;

            return {
              label,
              value: event.optionID,
            };
          })}
        useNativeAndroidPickerStyle={false}
        style={{
          inputIOS: {
            fontSize: 16,
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 4,
            color: theme.colors.primaryDarkGray,
            paddingRight: 30, // leaves room for a dropdown icon if needed
            width: "100%",
            marginTop: 16,
            marginBottom: 16,
          },
          inputAndroid: {
            fontSize: 16,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 4,
            color: theme.colors.primaryDarkGray,
            paddingRight: 30,
            width: "100%",
            marginTop: 16,
            marginBottom: 16,
          },
          inputIOSContainer: {
            zIndex: 100,
          },
          inputAndroidContainer: {
            width: "100%",
          },
        }}
      />

      {selectedEvent ? (
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 4 },
          ]}
        >
          Checked in so far: {attendeeCount}
        </Text>
      ) : null}

      <Button
        title="Tap NFC tags to check in"
        onPress={() => {
          if (!requireEvent()) return;
          router.push({
            pathname: "/nfcCheckIn",
            params: { eventID: selectedEvent, eventName, eventSpeaker },
          });
        }}
      />
      <Button
        title="See attendance records for this event"
        variant="secondary"
        onPress={() => {
          if (!requireEvent()) return;
          router.push({
            pathname: "/attendanceRecords",
            params: { eventID: selectedEvent, eventName, eventSpeaker },
          });
        }}
      />
      <Button
        title="Search attendee check-ins"
        variant="secondary"
        onPress={() => {
          router.push({
            pathname: "/attendeeAttendance",
            params: { schedule: JSON.stringify(eventMap) },
          });
        }}
      />
      <Button
        title="Check in attendee manually"
        variant="secondary"
        onPress={() => {
          if (!requireEvent()) return;
          router.push({
            pathname: "/manualCheckIn",
            params: { schedule: JSON.stringify(eventMap), eventID: selectedEvent },
          });
        }}
      />

      <Text
        style={[
          theme.typography.sectionTitle,
          { color: theme.colors.primaryDarkBlue, textAlign: "center", marginTop: 24, marginBottom: 4 },
        ]}
      >
        NFC tags
      </Text>
      <View style={{ marginBottom: 16 }}>
        <Button
          title="Assign NFC tags to attendees"
          variant="secondary"
          onPress={() => router.push("/assignNfcTag")}
        />
      </View>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 20 },
        ]}
      >
        If any urgent issues, contact Miyu at 412-277-1460.
      </Text>
    </ScrollView>
  );
}
