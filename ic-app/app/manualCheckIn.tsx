import Button from "@/components/Button";
import { checkInAttendee } from "@/lib/attendance";
import { supabase } from "@/lib/supabase";
import theme from "@/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";


type Attendee = {
  firstName: string;
  lastName: string;
  email: string;
};

type EventWithCheckIn = {
  eventID: string;
  eventName: string;
  email: string;
};

export default function SearchAttendee() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [checkIns, setCheckIns] = useState<EventWithCheckIn[]>([]);
  const params = useLocalSearchParams();
  const eventMapStr = params.schedule as string;
  const selectedEvent = params.eventID as string;
  const eventMap = eventMapStr ? JSON.parse(eventMapStr) : {};
  const speaker = eventMap[selectedEvent]?.speaker;

  

  async function searchAttendees() {
    if (!searchText) {
      setAttendees([]);
      return;
    }

    const { data, error } = await supabase
      .from("attendeeProfile")
      .select("firstName, lastName, email")
      .or(`firstName.ilike.*${searchText}*,lastName.ilike.*${searchText}*,email.ilike.*${searchText}*`);

    if (error) {
      console.log(error);
      return;
    }

    setAttendees(data || []);
  }

  async function checkIn(attendee: Attendee) {
    const result = await checkInAttendee(selectedEvent, attendee.email, { manual: true });

    switch (result.status) {
      case "checked_in":
        Toast.show({
          type: "success",
          text1: `${attendee.firstName} ${attendee.lastName} checked in`,
          position: "bottom",
          visibilityTime: 1000,
        });
        return;
      case "already_checked_in":
        Toast.show({
          type: "info",
          text1: `${attendee.firstName} ${attendee.lastName} is already checked in`,
          position: "bottom",
          visibilityTime: 1500,
        });
        return;
      case "not_registered_for_seminar":
        Toast.show({
          type: "error",
          text1: "Attendee not registered for this seminar",
          position: "bottom",
          visibilityTime: 2000,
        });
        return;
      case "no_profile":
        Toast.show({
          type: "error",
          text1: "No profile found for this attendee",
          position: "bottom",
          visibilityTime: 2000,
        });
        return;
      default:
        Toast.show({
          type: "error",
          text1: result.message || "Could not check in attendee",
          position: "bottom",
          visibilityTime: 2000,
        });
    }
  }

  return (
    <View style={{ flex: 1, padding: 24 }}>
      
        <Text style={[
            theme.typography.title,
            {
              color: theme.colors.primaryBlue,
              textAlign: "center",
              marginBottom: 16,
            },
          ]}>
            Check in attendee manually
        </Text>
        <Text
          style={[
            theme.typography.body,
            {
              color: theme.colors.primaryDarkGray,
              textAlign: "center",
              marginBottom: 16,
            },
          ]}
        >
          Checking in for: {eventMap[selectedEvent]?.eventName || selectedEvent}
  {speaker && speaker !== "undefined" && speaker !== "null" ? `, ${speaker}` : ""}
        </Text>

        <TextInput
        placeholder="Search by name or email..."
        value={searchText}
        onChangeText={(text) => setSearchText(text)}
        placeholderTextColor="#999"
        style={{
            backgroundColor: "#fff",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#ccc",
            marginBottom: 16,
            fontSize: 16,
        }}
        />

          <Button title="Search" variant="secondary" onPress={searchAttendees} />

          <FlatList
            data={attendees}
            keyExtractor={(item) => item.email}
            renderItem={({ item }) => (
              <Button
                title={`${item.firstName} ${item.lastName} (${item.email})`}
                variant="secondary"
                onPress={() => {
                  setSelectedAttendee(item);
                  checkIn(item);
                }}
              />
            )}
          />
    </View>
    )
}