import { View, Text, FlatList, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import theme from "../theme";
import Card from "../components/Card";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
 
type Attendee = {
    firstName: string;
    lastName: string;
    email: string;
}

export default function AttendanceRecords() {
  const params = useLocalSearchParams();
  const eventID = params.eventID;
  const eventName = String(params.eventName);
  const eventSpeaker = String(params.eventSpeaker);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [searchText, setSearchText] = useState("");

  const filteredAttendees = searchText
  ? attendees.filter((x) => {
      const fullName = `${x.firstName} ${x.lastName}`.toLowerCase();
      return fullName.includes(searchText.toLowerCase());
    })
  : attendees;



    useEffect(() => {
    async function fetchAttendees() {
        const { data: eventAttendance, error } = await supabase
        .from("attendanceByEvent")
        .select("emails")
        .eq("eventID", eventID)
        .single();

        if (error) return [];

        const emails = eventAttendance?.emails
        ? eventAttendance.emails.split(",").map((e: string) => e.trim())
        : [];

        if (emails.length === 0) return [];

        const { data: attendees, error: profilesError } = await supabase
        .from("attendeeProfile")
        .select("firstName, lastName, email")
        .in("email", emails);

        if (profilesError) return [];

        setAttendees(attendees || []);
    }

    fetchAttendees();
    }, [eventID]);

  return (
    <View style={{ flex: 1 }}>
    

    <FlatList
      data={filteredAttendees}
      keyExtractor={(item) => item.email}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={() => (
        <>
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
          Attendance: {eventName}
        </Text>
        <Text style={[theme.typography.title, {color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 16,},]}>
        {eventSpeaker}
        </Text>
        <TextInput
        placeholder="Search attendees..."
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
            marginHorizontal: 16,
            marginBottom: 16,
            fontSize: 16,
        }}
        />
        </>
  )}
      renderItem={({ item }) => (
        <Card>
          <Text style={[theme.typography.sectionTitle, { color: theme.colors.primaryDarkBlue, marginBottom: 8 }]}>
            {item.firstName} {item.lastName}
            </Text>
        </Card>
      )}
    />
    </View>
  );
}
