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
const [scannedEmail, setScannedEmail] = useState<string | null>(null);
const [scanned, setScanned] = useState(false);
const [processingScan, setProcessingScan] = useState(false);
const [showScanner, setShowScanner] = useState(false);
const [attendeeCount, setAttendeeCount] = useState(0);
const navigation = useNavigation();
const router = useRouter();
const [customSchedule, setCustomSchedule] = useState<Schedule[]>([]);
const [speakersAll, setSpeakersAll] = useState<Speaker[]>([]);
const isScanning = useRef(false);
const lastScannedRef = useRef<{ email: string; time: number } | null>(null);

 type Schedule = {
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    type?: string;
    idSpeaker: string;
    day: string;
    optionID: string;
    firstName?: string;
    lastName?: string;
    emails?: string;
    numberAttendees?: number;
  }

  type Speaker = {
    id: string;
    firstName: string;
    lastName: string;
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    if (isScanning.current) return;
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
        const {data: attendee, error: attendeeError} = await supabase
        .from("attendeeProfile")
        .select("firstName, lastName")
        .eq("email", data)
        .single();
        if (!attendee) return;
        if (attendeeError) {
            console.log(attendeeError);
            return;
        }
        const { data: me, error: fetchError } = await supabase
            .from("scheduleOptions")
            .select("emails")
            .eq("optionID", selectedEvent)
            .single();
        if (fetchError) {
            console.log(fetchError);
            return;
        }
        const currentEmails = typeof me?.emails === "string" ? me.emails : "";
        const emailList = currentEmails
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);

        if (emailList.includes(data)) {
          return;
        }

        const updatedEmails =
        currentEmails.trim() === ""
            ? data
            : `${currentEmails},${data}`;
        const { error: newerror } = await supabase
                .from("scheduleOptions")
                .update({ emails: updatedEmails })
                .eq("optionID", selectedEvent);

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
        }, 2000)
  }
}

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
      async function loadScheduleAll(){
        const { data, error } = await supabase
        .from("scheduleOptions")
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
      async function loadSpeakers(){
        const { data, error } = await supabase
        .from("speakerProfile")
        .select("*");

        if (error) {
          console.error(error);
          return;
        }

        setSpeakersAll(data);
      }
      loadSpeakers();
    }, []);

    const speakerMap = new Map(
      speakersAll.map((speaker) => [speaker.id, speaker])
    )

  
    const selectedEventObj = scheduleAll.find((event) => event.optionID === selectedEvent);
    const eventName = selectedEventObj ? selectedEventObj.title : "";
    const eventSpeaker = selectedEventObj ? `${speakerMap.get(selectedEventObj.idSpeaker)?.firstName} ${speakerMap.get(selectedEventObj.idSpeaker)?.lastName}` : "";


    const eventMap = scheduleAll.reduce((acc, event) => {
      acc[event.optionID] = {
        eventID: event.optionID,
        eventName: event.title,
        speaker: `${speakerMap.get(event.idSpeaker)?.firstName} ${speakerMap.get(event.idSpeaker)?.lastName}`,
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
            items={scheduleAll
            .filter((event) => event.day === selectedDay) 
            .map((event) => {
              const speaker = speakerMap.get(event.idSpeaker);
              const isSpeakerEvent =
                event.title.startsWith("Executive") ||
                event.title.startsWith("Keynote");``

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
    <Button title="Check in attendee manually" variant="secondary" onPress={() => {
        router.push({
            pathname: "/manualCheckIn",
            params: { schedule: JSON.stringify(eventMap), eventID: selectedEvent },
        })
    }}
    />
    </View>

  );
}