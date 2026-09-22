import Button from "@/components/Button";
import Card from "@/components/Card";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  View
} from "react-native";
import theme from "../../theme";

type NetworkProfile = {
  email: string;
  firstName: string;
  lastName: string;
  school: string;
  major: string;
  interests: string;
  linkedin: string;
  instagram: string;
  profilePictureUrl: string | null;
};

export default function Networking() {
  const router = useRouter();
  const { user } = useUser();

  const [networkProfiles, setNetworkProfiles] = useState<NetworkProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      setNetworkProfiles([]);
      setLoading(false);
      return;
    }

    let isActive = true;

    async function loadNetwork() {
      setLoading(true);

      const { data: me, error: networkError } = await supabase
        .from("attendeeProfile")
        .select("network")
        .eq("email", user.email)
        .single();

      if (networkError) {
        console.error("Could not load network:", networkError);

        if (isActive) {
          setLoading(false);
        }

        return;
      }

      const emails = (me?.network ?? "")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);

      if (emails.length === 0) {
        if (isActive) {
          setNetworkProfiles([]);
          setLoading(false);
        }

        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("attendeeProfile")
        .select(
          `
            email,
            firstName,
            lastName,
            school,
            major,
            interests,
            linkedin,
            instagram,
            profilePictureUrl
          `
        )
        .in("email", emails);

      if (profileError) {
        console.error("Could not load network profiles:", profileError);

        if (isActive) {
          setLoading(false);
        }

        return;
      }

      if (isActive) {
        setNetworkProfiles((profiles ?? []) as NetworkProfile[]);
        setLoading(false);
      }
    }

    void loadNetwork();

    return () => {
      isActive = false;
    };
  }, [user?.email]);

  function getProfileImageUrl(profilePictureUrl: string | null) {
    return supabase.storage
      .from("profilePictures")
      .getPublicUrl(profilePictureUrl ?? "anonymous.jpg").data.publicUrl;
  }

  async function openProfileLink(url: string, label: string) {
    const normalizedUrl =
      url.startsWith("https://") || url.startsWith("http://")
        ? url
        : `https://${url}`;

    const canOpen = await Linking.canOpenURL(normalizedUrl);

    if (!canOpen) {
      Alert.alert("Invalid link", `This ${label} link cannot be opened.`);
      return;
    }

    await Linking.openURL(normalizedUrl);
  }

  return (
    <FlatList<NetworkProfile>
      data={networkProfiles}
      keyExtractor={(item) => item.email}
      contentContainerStyle={[
        styles.content,
        networkProfiles.length === 0 && styles.emptyContent,
      ]}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text
            style={[
              theme.typography.biggestTitle,
              {
                color: theme.colors.primaryBlue,
                textAlign: "center",
                marginBottom: 8,
              },
            ]}
          >
            Network
          </Text>

          <Text
            style={[
              theme.typography.body,
              {
                color: theme.colors.primaryDarkGray,
                textAlign: "center",
              },
            ]}
          >
            People whose QR codes you have exchanged will appear here.
          </Text>
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <Text
            style={[
              theme.typography.body,
              {
                color: theme.colors.primaryDarkGray,
                textAlign: "center",
              },
            ]}
          >
            Loading your network...
          </Text>
        ) : (
          <Text
            style={[
              theme.typography.body,
              {
                color: theme.colors.primaryDarkGray,
                textAlign: "center",
              },
            ]}
          >
            No connections yet. Exchange QR codes to add people to your network.
          </Text>
        )
      }
      renderItem={({ item }) => {
        const profileImageUrl = getProfileImageUrl(item.profilePictureUrl);

        return (
          <Card>
            <View style={styles.profileHeader}>
              <View style={styles.profileText}>
                <Text
                  style={[
                    theme.typography.title,
                    {
                      color: theme.colors.primaryBlue,
                      marginBottom: 8,
                    },
                  ]}
                >
                  {item.firstName} {item.lastName}
                </Text>

                <Text
                  style={[
                    theme.typography.sectionTitle,
                    {
                      color: theme.colors.primaryDarkGray,
                      marginBottom: 6,
                    },
                  ]}
                >
                  {item.school || "School not added"}
                </Text>

                <Text
                  style={[
                    theme.typography.body,
                    {
                      color: theme.colors.primaryDarkGray,
                    },
                  ]}
                >
                  {item.major || "Major not added"}
                </Text>
              </View>

              <Image
                source={{ uri: profileImageUrl }}
                style={styles.profileImage}
              />
            </View>

            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.colors.primaryDarkGray,
                  marginBottom: 12,
                },
              ]}
            >
              Interests: {item.interests || "Not added yet"}
            </Text>

            <View style={styles.socialButtons}>
              <View style={styles.socialButton}>
                <Button
                  title={item.linkedin ? "LinkedIn" : "No LinkedIn"}
                  variant="secondary"
                  onPress={() => {
                    if (item.linkedin) {
                      void openProfileLink(item.linkedin, "LinkedIn");
                    } else {
                      Alert.alert(
                        "LinkedIn unavailable",
                        `${item.firstName} has not added a LinkedIn link.`
                      );
                    }
                  }}
                />
              </View>

              <View style={styles.socialButton}>
                <Button
                  title={item.instagram ? "Instagram" : "No Instagram"}
                  variant="secondary"
                  onPress={() => {
                    if (item.instagram) {
                      void openProfileLink(item.instagram, "Instagram");
                    } else {
                      Alert.alert(
                        "Instagram unavailable",
                        `${item.firstName} has not added an Instagram link.`
                      );
                    }
                  }}
                />
              </View>
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
  },
  header: {
    marginBottom: 4,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  profileText: {
    flex: 1,
    paddingRight: 14,
  },
  profileImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#E5E7EB",
  },
  socialButtons: {
    flexDirection: "row",
    gap: 10,
  },
  socialButton: {
    flex: 1,
  },
});