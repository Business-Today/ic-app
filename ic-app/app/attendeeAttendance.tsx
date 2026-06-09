import { View, Text, TextInput, FlatList } from "react-native";
import Button from "@/components/Button"
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import theme from "@/theme";
import Card from "@/components/Card";
import { useLocalSearchParams } from "expo-router";

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

  async function fetchCheckIns(email: string) {
    const { data: eventAttendance, error } = await supabase
      .from("attendanceByEvent")
      .select("eventID, emails");

    if (error) {
      console.log(error);
      return;
    }

    const checkIns: EventWithCheckIn[] = [];

    for (const event of eventAttendance || []) {
      const emails = event.emails?.split(",").map((e: string) => e.trim()) || [];
      if (emails.includes(email)) {
        checkIns.push({
          eventID: event.eventID,
          eventName: event.eventID,
          email: email,
        });
      }
    }

    setCheckIns(checkIns);
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
            Track attendance by attendee
        </Text>
      {!selectedAttendee ? (
        <>
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
                  fetchCheckIns(item.email);
                }}
              />
            )}
          />
        </>
      ) : (
        <>

          <Text style={[
            theme.typography.sectionTitle,
            {
              color: theme.colors.primaryDarkGray,
              textAlign: "center",
              marginBottom: 16,
            },
          ]}>
            Attendee: {selectedAttendee.firstName} {selectedAttendee.lastName}
          </Text>

          <Text style={[
            theme.typography.body,
            {
              color: theme.colors.primaryDarkGray,
              textAlign: "center",
              marginBottom: 16,
            },
          ]}>Events checked in:</Text>

          {checkIns.length === 0 ? (
            <Text style={[
            theme.typography.body,
            {
              color: theme.colors.primaryDarkGray,
              textAlign: "center",
              marginBottom: 16,
            },
          ]}>No events yet</Text>
          ) : (
            <FlatList
              data={checkIns}
              keyExtractor={(item) => item.eventID}
              renderItem={({ item }) => (
                <Card>
                <Text style={[
                  theme.typography.body,
                  {
                    color: theme.colors.primaryDarkGray,
                    textAlign: "center",
                    marginBottom: 16,
                  },
                ]}>
                  {eventMap[item.eventID]?.eventName || item.eventID}, {eventMap[item.eventID]?.speaker || ""}
                </Text>

                </Card>
              )}
            />
          )}
          <Button
            title="Back to search"
            onPress={() => {
              setSelectedAttendee(null);
              setCheckIns([]);
              setSearchText("");
            }}
          />
        </>
      )}
    </View>
  );
}