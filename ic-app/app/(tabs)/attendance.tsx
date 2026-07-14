import { View, Text } from "react-native";
import theme from "../../theme";
import { useState, useEffect, useMemo, useRef } from "react";
import Button from "../../components/Button";
import { supabase } from "@/lib/supabase";
import RNPickerSelect from "react-native-picker-select";
import { CameraView, useCameraPermissions } from "expo-camera"; 
import Toast from "react-native-toast-message";
import { useNavigation, useRouter } from "expo-router";


export default function Attendance() {
const [selectedDay, setSelectedDay] = useState("day1");
const [scheduleAll, setScheduleAll] = useState<Schedule[]>([]);
const [scheduleSem, setScheduleSem] = useState<Schedule[]>([]);
const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
const [cameraPermission, requestCameraPermission] = useCameraPermissions();
const isScanning = useRef(false);
const [scannedEmail, setScannedEmail] = useState<string | null>(null);
const [scanned, setScanned] = useState(false);
const [processingScan, setProcessingScan] = useState(false);
const [showScanner, setShowScanner] = useState(false);
const [attendeeCount, setAttendeeCount] = useState(0);
const navigation = useNavigation();
const router = useRouter();




 type Schedule = {
    event: string;
    startTime: string;
    endTime: string;
    location: string;
    type: string;
    idSpeaker: string;
    day: string;
    id: string;
    firstName: string;
    lastName: string;
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    if (!selectedEvent) {
        Toast.show({
            type: "error",
            text1: "Event not selected",
            position: "bottom",
            visibilityTime: 2000,
        });
        setShowScanner(false);
    }
    try {
        if (isScanning.current) {
        return;
        }
        isScanning.current = true;
        setProcessingScan(true);
        setScannedEmail(data);
        const {data: attendee} = await supabase
        .from("attendeeProfile")
        .select("firstName, lastName")
        .eq("email", data)
        .single();
        if (!attendee) return;

        isScanning.current = false; 
        const { error: updateError } = await supabase
        .from("attendanceByAttendee")
        .update({ [selectedEvent]: "True" })
        .eq("email", data);

        if (updateError || !data) {
            console.log(updateError);
            setProcessingScan(false);
            return;
        }
        const { data: me, error: fetchError } = await supabase
            .from("attendanceByEvent")
            .select("emails")
            .eq("eventID", selectedEvent)
            .single();
        const currentEmails = typeof me?.emails === "string" ? me.emails : "";

        const updatedEmails =
        currentEmails.trim() === ""
            ? data
            : `${currentEmails},${data}`;
        const { error: newerror } = await supabase
                .from("attendanceByEvent")
                .update({ emails: updatedEmails })
                .eq("eventID", selectedEvent);

                if (newerror) {
                console.log(newerror);
                }
      

        Toast.show({
        type: "success",
        text1: `${attendee.firstName} ${attendee.lastName} checked in`,
        position: "bottom",
        visibilityTime: 1000,
        });
      } finally{
        setTimeout(() => {
          isScanning.current = false;
          setScanned(false);
        }, 500)
  }
}

  useEffect(() => {
    async function loadCount() {
      if (!selectedEvent) {
        setAttendeeCount(0);
        return;
      }

      const { data, error } = await supabase
        .from("attendanceByEvent")
        .select("numberAttendees")
        .eq("eventID", selectedEvent)
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
      async function loadScheduleAll(){
        const { data, error } = await supabase
        .from("speakerProfileAll")
        .select("*");
  
        if (error) {
          console.error(error);
          return;
        }
  
        setScheduleAll(data);
      }
  
      loadScheduleAll()
    }, []);
    useEffect(() => {
        async function loadScheduleSem(){
        const { data, error } = await supabase
        .from("speakerProfileSem")
        .select("*");
  
        if (error) {
          console.error(error);
          return;
        }
  
        setScheduleSem(data);
      }
  
      loadScheduleSem()
    }, []);

    const schedule = useMemo(() => {
        return [...scheduleSem, ...scheduleAll];
      }, [scheduleSem, scheduleAll]);
    const eventsForDay = useMemo(() => {
    return schedule.filter(
        (event) => event.day === selectedDay
    );
    }, [schedule, selectedDay]);

    const uniqueEventsForDay = eventsForDay.filter(
        (event, index, self) => {
            const isExecSem = 
            event.event.startsWith("Panel") || event.event.startsWith("Recruitment");
            if (isExecSem){
                return index === self.findIndex((e) => e.event === event.event);
            }
            return true;
        }
    )
    const selectedEventObj = uniqueEventsForDay.find((event) => event.id === selectedEvent);
    const eventName = selectedEventObj ? selectedEventObj.event : "";
    const eventSpeaker = selectedEventObj ? `${selectedEventObj.firstName} ${selectedEventObj.lastName}` : "";

    const eventMap = schedule.reduce((acc, event) => {
      acc[event.id] = {
        eventID: event.id,
        eventName: event.event,
        speaker: `${event.firstName} ${event.lastName}`,
      };
      return acc;
    }, {} as Record<string, { eventID: string; eventName: string; speaker: string }>);

    if (showScanner) {
    return (
        <View style={{ flex: 1 }}>
        <View style={{ position: "absolute", top: 40, left: 0, right: 0, zIndex: 999 }}>
        <Button title="Back" onPress={() => setShowScanner(false)} />
            </View>
        <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
    />
    </View>
  )};
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", marginBottom: 16, paddingHorizontal: 16}}>
      <Text
          style={[
            theme.typography.biggestTitle,
            {
              color: theme.colors.primaryBlue,
              textAlign: "center",
              marginBottom: 16,
            },
          ]}
        >Attendance</Text>
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
            items={uniqueEventsForDay.map((event) => ({
                label: event.event.startsWith("Panel") || event.event.startsWith("Recruitment") ? event.event
                :`${event.event}, ${event.firstName} ${event.lastName}`,
                value: event.id,
            }))}
            useNativeAndroidPickerStyle={false} 
            style={{
            inputIOS: {
            fontSize: 16,
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 4,
            color: theme.colors.primaryDarkGray,
            paddingRight: 30, // leaves room for a dropdown icon if needed
            width: '100%',
            marginTop: 16, 
            marginBottom: 16,
            },
            inputAndroid: {
            fontSize: 16,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 4,
            color: theme.colors.primaryDarkGray,
            paddingRight: 30, 
            width: '100%',
            marginTop: 16, 
            marginBottom: 16,
            },
            inputIOSContainer: {
            zIndex: 100, 
            },
            inputAndroidContainer: {
            width: '100%',
            }
            
        }}
            />

        <Button title="Open camera to scan QR code" variant="secondary"
            onPress={async () => {
            if (!cameraPermission?.granted) {
                const result = await requestCameraPermission();
                if (!result.granted) return;
            }
            setScanned(false);
            setShowScanner(true);
        }} />
        <Button title="See attendance records for this event" variant="secondary" onPress={() => {
        if (!selectedEvent) return;
        router.push({
        pathname: "/attendanceRecords",
        params: { eventID: selectedEvent, eventName: eventName, eventSpeaker: eventSpeaker },
        });
    }}
    />
    <Button title="Search attendee check-ins" variant="secondary" onPress={() => {
        router.push({
            pathname: "/attendeeAttendance",
            params: { schedule: JSON.stringify(eventMap) },
        })
    }}
    />
    </View>

  );
}