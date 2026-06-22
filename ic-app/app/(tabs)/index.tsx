import { ScrollView, Text } from "react-native";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SectionTitle from "../../components/SectionTitle";
import theme from "../../theme";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useUser } from "../../contexts/UserContext";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";



export default function Home() {
  const { user, setUser } = useUser();
  const { schedule } = useUser();
  const router = useRouter();
  const {scheduleWithNames} = useUser();

  console.log(scheduleWithNames)

  useEffect(() => {
    async function checkLogin() {
      const savedEmail =
        await AsyncStorage.getItem("loggedInEmail");

      if (!savedEmail) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("attendeeProfile")
        .select("*")
        .eq("email", savedEmail)
        .single();

      if (error || !data) {
        router.replace("/login");
        return;
      }

      setUser(data);

      router.replace("/(tabs)");
    }

    checkLogin();
  }, [])
  const getCurrentDate = () => {
    return new Date();
  };
  const upcomingEvents = useMemo(() => {
    const now = new Date('2026-11-07T07:00:00')
    // const now = getCurrentDate();

    return scheduleWithNames
      .filter((event) => new Date(event.startTime) > now)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() -
          new Date(b.startTime).getTime()
      )
      .slice(0, 2);
  }, [schedule]);

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase
        .from("attendeeProfile")
        .select("email, firstName, lastName, linkedin, instagram, school, major, interests, profilePictureUrl")
        .eq("email", user?.email)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setUser({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        linkedin: data.linkedin,
        instagram: data.instagram,
        school: data.school,
        major: data.major, 
        interests: data.interests,
        profilePictureUrl: data.profilePictureUrl,
      });
    }

    loadUser();
  }, []);
  return (
    <ScrollView contentContainerStyle={{padding:24}}>

      <Text style={[theme.typography.biggestTitle, {color: theme.colors.primaryBlue, textAlign: "center", marginBottom: 16}]}>
        Welcome, {user?.firstName || ""}!
      </Text>

      <Text style = {[theme.typography.sectionTitle, {color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 16}]}>
        52nd International Conference
      </Text>

      <Text style = {[theme.typography.body, {color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 20}]}>
        We're excited to have you here! Use the navigation below to see your schedule, speakers, and more. 
      </Text>

      <Text style = {[theme.typography.title, {color: theme.colors.primaryBlue, textAlign: "center", marginBottom: 16}]}>
        Upcoming events
      </Text>

      {upcomingEvents.map((event, index) => (
        <Card
          key={event.id}
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
            {event.title}
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
            {formatTime(event.startTime)} ・ {event.location}
          </Text>
        </Card>
      ))}
      {upcomingEvents.length === 0 && (
        <Card marginBottom={16}>
          <Text style={theme.typography.body}>
            No upcoming events.
          </Text>
        </Card>
      )}
      <Text style = {[theme.typography.title, {color: theme.colors.primaryBlue, textAlign: "center", marginBottom: 8}]}>
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

      <Text style = {[theme.typography.body, {color: theme.colors.primaryDarkGray, textAlign: "center", marginTop: 20}]}>
        Questions about the app? Reach out to any BT staff member!
      </Text> 

    </ScrollView>
  );
}