import { FlatList, Text } from "react-native";
import Card from "../../components/Card";
import theme from "../../theme";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import Button from "@/components/Button";
import { Linking, Alert } from "react-native";



type NetworkProfile = {
  email: string;
  firstName: string;
  lastName: string;
  school: string;
  major: string;
  interests: string;
  linkedin: string;
  instagram: string;
};


export default function Networking() {
  const router = useRouter();
  const [networkProfiles, setNetworkProfiles] = useState<NetworkProfile[]>([]);
  const { user } = useUser();

    if (!user?.email) return;

    async function loadNetwork() {
      if (!user?.email) return;
      const { data: me, error } = await supabase
        .from("attendeeProfile")
        .select("network")
        .eq("email", user.email)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      const emails =
        (me?.network ?? "")
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean);

      if (emails.length === 0) {
        setNetworkProfiles([]);
        return;
      }

      const { data: profiles, error: profileError } =
        await supabase
          .from("attendeeProfile")
          .select("*")
          .in("email", emails);

      if (profileError) {
        console.error(profileError);
        return;
      }

      setNetworkProfiles(profiles ?? []);
    }

    loadNetwork();

  return (
    <FlatList
      data={networkProfiles}
      keyExtractor={(item) => item.email}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
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
          Network
        </Text>
      }
      renderItem={({ item }) => (
        <Card>
          <Text style={[theme.typography.title, { color: theme.colors.primaryBlue, marginBottom: 8 }]}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={[theme.typography.sectionTitle, { color: theme.colors.primaryDarkGray, marginBottom: 8 }]}>
            {item.school}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray, marginBottom: 8 }]}>
            {item.major}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray, marginBottom: 8 }]}>
            Interests: {item.interests}
          </Text>
          <Button
                  title={item.linkedin ? "LinkedIn" : "LinkedIn"}
                  onPress={() => {
                    if (item.linkedin) {
                      Linking.openURL(item.linkedin);
                    }
                  }}
                />
          <Button
                  title={item.instagram ? "Instagram" : "Instagram"}
                  onPress={() => {
                    if (item.instagram) {
                      Linking.openURL(item.instagram);
                    }
                  }}
                />
        </Card>
      )}
    />
  );
}