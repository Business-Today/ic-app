import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { ScrollView, Text } from "react-native";

import Button from "../../components/Button";
import Card from "../../components/Card";
import { useUser } from "../../contexts/UserContext";
import { supabase } from "../../lib/supabase";
import theme from "../../theme";

type ScheduleItem = {
  optionID: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  day: string;
  type: string;
  idSpeaker: string;
};

type Speaker = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  event: string;
  day: string;
};

type AttendeeSchedule = {
  groupNumber: number;
  offsite: number;
  exec1: number;
  exec2: number;
  exec3: number;
  exec4: number;
};

export default function Home() {
  const {
    user,
    setUser,
    scheduleWithNames,
    setSchedule,
    setSpeakersAll,
  } = useUser();

  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser?.email) {
        if (isMounted) {
          router.replace("/login");
        }

        return;
      }

      const normalizedEmail = authUser.email.trim().toLowerCase();

      const { data: attendee, error: profileError } = await supabase
        .from("attendeeProfile")
        .select(
          "email, firstName, lastName, linkedin, instagram, school, major, interests, profilePictureUrl"
        )
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileError || !attendee) {
        console.error("Could not load attendee profile:", profileError);

        await supabase.auth.signOut({ scope: "local" });

        if (isMounted) {
          router.replace("/login");
        }

        return;
      }

      if (isMounted) {
        setUser(attendee);
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [router, setUser]);

  useEffect(() => {
    if (!user?.email) {
      return;
    }

    let isMounted = true;

    async function loadPersonalSchedule() {
      const normalizedEmail = user.email.trim().toLowerCase();

      const { data: attendeeSchedule, error: attendeeError } = await supabase
        .from("attendeeProfile")
        .select("groupNumber, offsite, exec1, exec2, exec3, exec4")
        .eq("email", normalizedEmail)
        .maybeSingle<AttendeeSchedule>();

      if (attendeeError || !attendeeSchedule) {
        console.error(
          "Could not load attendee schedule choices:",
          attendeeError
        );

        if (isMounted) {
          setSchedule([]);
          setSpeakersAll([]);
        }

        return;
      }

      const { data: allScheduleRows, error: allScheduleError } = await supabase
        .from("scheduleOptions")
        .select("optionID")
        .eq("type", "all");

      if (allScheduleError) {
        console.error(
          "Could not load all-event schedule option IDs:",
          allScheduleError
        );

        return;
      }

      const scheduleIds = [
        `exec1_${attendeeSchedule.exec1}`,
        `exec2_${attendeeSchedule.exec2}`,
        `exec3_${attendeeSchedule.exec3}`,
        `exec4_${attendeeSchedule.exec4}`,
        `offsite_${attendeeSchedule.offsite}`,
        ...(allScheduleRows ?? []).map((item) => item.optionID),
      ];

      const uniqueScheduleIds = [...new Set(scheduleIds)];

      const { data: scheduleData, error: scheduleError } = await supabase
        .from("scheduleOptions")
        .select("*")
        .in("optionID", uniqueScheduleIds)
        .order("startTime", { ascending: true })
        .order("title", { ascending: true });

      if (scheduleError) {
        console.error("Could not load schedule:", scheduleError);
        return;
      }

      const rawSchedule = (scheduleData ?? []) as ScheduleItem[];

      const speakerIds = [
        ...new Set(
          rawSchedule.flatMap((event) =>
            (event.idSpeaker ?? "")
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          )
        ),
      ];

      let speakers: Speaker[] = [];

      if (speakerIds.length > 0) {
        const { data: speakerData, error: speakerError } = await supabase
          .from("speakerProfile")
          .select("id, firstName, lastName, title, company, event, day")
          .in("id", speakerIds);

        if (speakerError) {
          console.error("Could not load speakers:", speakerError);
          return;
        }

        speakers = (speakerData ?? []) as Speaker[];
      }

      if (!isMounted) {
        return;
      }

      setSchedule(rawSchedule);
      setSpeakersAll(speakers);
    }

    void loadPersonalSchedule();

    return () => {
      isMounted = false;
    };
  }, [
    user?.email,
    setSchedule,
    setSpeakersAll,
  ]);

  const upcomingEvents = useMemo(() => {
    if (!Array.isArray(scheduleWithNames)) {
      return [];
    }

    const now = new Date();

    return scheduleWithNames
      .filter(
        (event) =>
          event &&
          typeof event === "object" &&
          typeof event.startTime === "string"
      )
      .filter((event) => {
        const eventTime = new Date(event.startTime).getTime();

        return !Number.isNaN(eventTime) && eventTime > now.getTime();
      })
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() -
          new Date(b.startTime).getTime()
      )
      .slice(0, 2);
  }, [scheduleWithNames]);

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
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
        Welcome, {user?.firstName || ""}!
      </Text>

      <Text
        style={[
          theme.typography.sectionTitle,
          {
            color: theme.colors.primaryDarkGray,
            textAlign: "center",
            marginBottom: 16,
          },
        ]}
      >
        52nd International Conference
      </Text>

      <Text
        style={[
          theme.typography.body,
          {
            color: theme.colors.primaryDarkGray,
            textAlign: "center",
            marginBottom: 20,
          },
        ]}
      >
        We're excited to have you here! Use the navigation below to see your
        schedule, speakers, and more.
      </Text>

      <Text
        style={[
          theme.typography.title,
          {
            color: theme.colors.primaryBlue,
            textAlign: "center",
            marginBottom: 16,
          },
        ]}
      >
        Upcoming events
      </Text>

      {upcomingEvents.map((event, index) => (
        <Card
          key={event.optionID ?? `${event.title ?? "event"}-${index}`}
          marginBottom={index === upcomingEvents.length - 1 ? 16 : 8}
        >
          <Text
            style={[
              theme.typography.sectionTitle,
              {
                color: theme.colors.primaryDarkGray,
                marginBottom: 8,
              },
            ]}
          >
            {event.title ?? "Untitled event"}
          </Text>

          {event.idSpeaker ? (
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.colors.primaryDarkGray,
                  marginBottom: 4,
                },
              ]}
            >
              {event.idSpeaker}
            </Text>
          ) : null}

          <Text style={theme.typography.body}>
            {event.startTime ? formatTime(event.startTime) : "Time TBD"} ・{" "}
            {event.location ?? "Location TBD"}
          </Text>
        </Card>
      ))}

      {upcomingEvents.length === 0 && (
        <Card marginBottom={16}>
          <Text style={theme.typography.body}>No upcoming events.</Text>
        </Card>
      )}

      <Text
        style={[
          theme.typography.title,
          {
            color: theme.colors.primaryBlue,
            textAlign: "center",
            marginBottom: 8,
          },
        ]}
      >
        Quick Access
      </Text>

      <Button
        title="Scan QR Code"
        variant="secondary"
        onPress={() => router.push("/qr")}
      />

      <Button
        title="Speakers"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: "/schedule",
            params: { mode: "speakers" },
          })
        }
      />

      <Button
        title="Edit Profile"
        variant="secondary"
        onPress={() => router.push("/profile")}
      />

      <Text
        style={[
          theme.typography.body,
          {
            color: theme.colors.primaryDarkGray,
            textAlign: "center",
            marginTop: 20,
          },
        ]}
      >
        Questions about the app? Reach out to any BT staff member!
      </Text>
    </ScrollView>
  );
}