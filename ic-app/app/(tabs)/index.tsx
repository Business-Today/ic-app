import { ScrollView, Text } from "react-native";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SectionTitle from "../../components/SectionTitle";
import theme from "../../theme";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useUser } from "../../contexts/UserContext";

const mockUsers = [
  {
    email: "my9689@princeton.edu",
    name: "Miyu Yamane",
  },
  {
    email: "sk0546@princeton.edu",
    name: "Sophie Kim",
  },
  {
    email: "sc5819@princeton.edu",
    name: "Susan Chen",
  }
];


export default function Home() {
  const [currentEmail, setCurrentEmail] = useState(mockUsers[0].email);
  const { user, setUser } = useUser();

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase
        .from("attendeeProfile")
        .select("id, email, firstName, lastName, linkedin, instagram, school, major, interests, profilePictureUrl")
        .eq("email", currentEmail)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setUser({
        id: data.id,
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
  }, [currentEmail]);
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

      <Card>
        <Text style = {[theme.typography.sectionTitle, {color: theme.colors.primaryDarkGray, marginBottom: 8}]}>
          Keynote #1: Brian Zhou
        </Text>
        <Text style={theme.typography.body}>
          10:00 AM・Main Hall
        </Text>
      </Card>

      <Card marginBottom={16}>
        <Text style = {[theme.typography.sectionTitle, {color: theme.colors.primaryDarkGray, marginBottom: 8}]}>
          Executive Seminar #1: Allen Li
        </Text>
        <Text style={theme.typography.body}>
          11:00 AM・Conference Room A
        </Text>
      </Card>

      <Text style = {[theme.typography.title, {color: theme.colors.primaryBlue, textAlign: "center", marginBottom: 8}]}>
        Quick Access
      </Text>

      <Button title="Scan QR Code" variant="secondary"/>
      <Button title="Speakers" variant="secondary" />
      <Button title="My Network" variant="secondary" />

      <Text style = {[theme.typography.body, {color: theme.colors.primaryDarkGray, textAlign: "center", marginTop: 20}]}>
        Questions about the app? Reach out to any BT staff member!
      </Text> 

    </ScrollView>
  );
}