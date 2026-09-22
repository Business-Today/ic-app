import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import Button from "../components/Button";
import Card from "../components/Card";
import { supabase } from "../lib/supabase";
import theme from "../theme";

 
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

    const listHeader = (
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

    <Text
      style={[
        theme.typography.title,
        {
          color: theme.colors.primaryDarkGray,
          textAlign: "center",
          marginBottom: 16,
        },
      ]}
    >
      {eventSpeaker}
    </Text>

    <Text 
      style={[
        theme.typography.sectionTitle,
        { color: theme.colors.primaryDarkBlue, marginBottom: 8 }
      ]}
    >
      Number of attendees checked in: {attendees.length}
    </Text>

    <TextInput
      placeholder="Search attendees..."
      value={searchText}
      onChangeText={setSearchText}
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
);

    const loadAttendees = useCallback(async () => {
      if (!eventID || typeof eventID !== "string") {
        setAttendees([]);
        return;
      }

      const { data: eventAttendance, error: attendanceError } = await supabase
        .from("scheduleOptions")
        .select("emails")
        .eq("optionID", eventID)
        .single();

      if (attendanceError) {
        console.error("Could not load attendance:", attendanceError);
        setAttendees([]);
        return;
      }

      const emails =
        typeof eventAttendance?.emails === "string"
          ? [
              ...new Set(
                eventAttendance.emails
                  .split(",")
                  .map((email: string) => email.trim().toLowerCase())
                  .filter(Boolean)
              ),
            ]
          : [];

      if (emails.length === 0) {
        setAttendees([]);
        return;
      }

      const { data: attendeeProfiles, error: profilesError } = await supabase
        .from("attendeeProfile")
        .select("firstName, lastName, email")
        .in("email", emails);

      if (profilesError) {
        console.error("Could not load attendee profiles:", profilesError);
        setAttendees([]);
        return;
      }

      setAttendees(attendeeProfiles ?? []);
    }, [eventID]);

    useEffect(() => {
      loadAttendees();
    }, [loadAttendees]);

    const uncheckAttendee = async (attendee: Attendee) => {
  if (!eventID || typeof eventID !== "string") {
    return;
  }

  const emailToRemove = attendee.email.trim().toLowerCase();

  const { data: eventAttendance, error: fetchError } = await supabase
    .from("scheduleOptions")
    .select("emails")
    .eq("optionID", eventID)
    .single();

  if (fetchError || !eventAttendance) {
    console.error("Could not load event attendance:", fetchError);

    Toast.show({
      type: "error",
      text1: "Could not remove check-in",
      position: "bottom",
      visibilityTime: 2000,
    });

    return;
  }

  const currentEmails =
    typeof eventAttendance.emails === "string"
      ? eventAttendance.emails
      : "";

  const updatedEmails = currentEmails
    .split(",")
    .map((email: string) => email.trim())
    .filter(
      (email: string) =>
        email.length > 0 && email.toLowerCase() !== emailToRemove
    )
    .join(",");

  const { error: updateError } = await supabase
    .from("scheduleOptions")
    .update({ emails: updatedEmails })
    .eq("optionID", eventID);

  if (updateError) {
    console.error("Could not update attendance:", updateError);

    Toast.show({
      type: "error",
      text1: "Could not remove check-in",
      position: "bottom",
      visibilityTime: 2000,
    });

    return;
  }

  Toast.show({
    type: "success",
    text1: `${attendee.firstName} ${attendee.lastName} was unchecked`,
    position: "bottom",
    visibilityTime: 2000,
  });

  await loadAttendees();
};

  return (
    <View style={{ flex: 1 }}>
    

    <FlatList
      data={filteredAttendees}
      keyExtractor={(item) => item.email}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={listHeader}
      renderItem={({ item }) => (
      <Card>
        <Text
          style={[
            theme.typography.sectionTitle,
            {
              color: theme.colors.primaryDarkBlue,
              marginBottom: 8,
            },
          ]}
        >
          {item.firstName} {item.lastName}
        </Text>

        <Text
          style={[
            theme.typography.body,
            {
              color: theme.colors.primaryDarkGray,
              marginBottom: 12,
            },
          ]}
        >
          {item.email}
        </Text>

        <Button
          title="Undo check-in"
          variant="secondary"
          onPress={() => {
            Alert.alert(
              "Undo check-in?",
              `Remove ${item.firstName} ${item.lastName} from this event's attendance records?`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => uncheckAttendee(item),
                },
              ]
            );
          }}
        />
      </Card>
    )}
    />
    </View>
  );
}
