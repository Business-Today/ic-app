import { supabase } from "@/lib/supabase";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import RNPickerSelect from "react-native-picker-select";
import Toast from "react-native-toast-message";
import Button from "../components/Button";
import theme from "../theme";


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
const [scheduleSem, setScheduleSem] = useState<Schedule[]>([]);
const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
const [cameraPermission, requestCameraPermission] = useCameraPermissions();
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
        const { data: me, error: fetchError } = await supabase
            .from("scheduleOptions")
            .select("emails, type")
            .eq("optionID", selectedEvent)
            .single();
        if (fetchError) {
            console.log(fetchError);
            return;
        }

        console.log("Event:", selectedEvent);

        if (me.type == "seminar"){
          const current_event = selectedEvent?.split("_")
          const { data: sem_number, error: num_error } = await supabase
          .from("attendeeProfile")
          .select(`${current_event[0]}`)
          .eq("email", data)
          .single();
          console.log(sem_number[current_event[0]]);
          console.log(current_event[1]);
          if (String(sem_number[current_event[0]]) !== current_event[1]){
            Toast.show({
              type: "error",
              text1: "Attendee not registered for this seminar",
              position: "bottom",
              visibilityTime: 2000,
            });
            return;
          }
        }
        
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
        const { error: updateError } = await supabase
          .from("scheduleOptions")
          .update({ emails: updatedEmails })
          .eq("optionID", selectedEvent);

        if (updateError) {
          console.error("Could not update attendance:", updateError);

          Toast.show({
            type: "error",
            text1: "Could not check in attendee",
            position: "bottom",
            visibilityTime: 2000,
          });

          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user?.email) {
          console.error("Could not get the signed-in user:", userError);

          Toast.show({
            type: "error",
            text1: "Check-in saved, but scanner identity was unavailable",
            position: "bottom",
            visibilityTime: 2500,
          });

          return;
        }

        const { error: historyError } = await supabase
          .from("attendanceHistory")
          .insert({
            eventID: selectedEvent,
            scannedByEmail: user.email.trim().toLowerCase(),
            attendeeEmail: data.trim().toLowerCase(),
            action: "check_in",
            manual: false,
          });

        if (historyError) {
          console.error("Could not save attendance history:", historyError);

          Toast.show({
            type: "error",
            text1: "Check-in saved, but activity history was not saved",
            position: "bottom",
            visibilityTime: 2500,
          });

          return;
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
        .select("*")
        .order("startTime", { ascending: true })
        .order("title", { ascending: true });
  
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
                event.title.startsWith("Keynote");

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
    <View style={{ marginBottom: 16 }}>
    <Button title="Check in attendee manually" variant="secondary" onPress={() => {
        router.push({
            pathname: "/manualCheckIn",
            params: { schedule: JSON.stringify(eventMap), eventID: selectedEvent },
        });
    }}
    />
    </View>
    <Text style = {[theme.typography.body, {color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 20}]}>
      If any urgent issues, contact Miyu at 412-277-1460.
      </Text>
    </View>

  );
}