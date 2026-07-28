import { View, Text, TextInput, FlatList } from "react-native";
import Button from "@/components/Button"
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Stack, useRouter } from "expo-router";
import theme from "@/theme";
import Card from "@/components/Card";
import { useLocalSearchParams } from "expo-router";
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
    const { data: eventAttendance, error } = await supabase
      .from("scheduleOptions")
      .select("optionID, emails")
      .eq("optionID", selectedEvent)
      .single();

    if (error) {
      console.log(error);
      return;
    }

    if (eventAttendance) {
      const emails = eventAttendance.emails?.split(",").map((e: string) => e.trim()) || [];
      if (!emails.includes(attendee.email)) {
        emails.push(attendee.email);
        await supabase
          .from("scheduleOptions")
          .update({ emails: emails.join(", ") })
          .eq("optionID", selectedEvent);
      }
    }
    Toast.show({
            type: "success",
            text1: `${attendee.firstName} ${attendee.lastName} checked in`,
            position: "bottom",
            visibilityTime: 1000,
            });
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
        <Text style={[
            theme.typography.body,
            {
              color: theme.colors.primaryDarkGray,
              textAlign: "center",
              marginBottom: 16,
            },
          ]}>
            Checking in for: {eventMap[selectedEvent]?.eventName || selectedEvent}, {eventMap[selectedEvent]?.speaker || ""}
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