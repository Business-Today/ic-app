import Button from "@/components/Button";
import Card from "@/components/Card";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useUser } from "../../contexts/UserContext";
import { supabase } from "../../lib/supabase";
import theme from "../../theme";

export default function Profile() {
  const [mode, setMode] = useState<"edit" | "view">("view");
  const { user, setUser } = useUser();
  const router = useRouter();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [school, setSchool] = useState(user?.school ?? "");
  const [major, setMajor] = useState(user?.major ?? "");
  const [interests, setInterests] = useState(user?.interests ?? "");
  const [linkedin, setLinkedin] = useState(user?.linkedin ?? "");
  const [instagram, setInstagram] = useState(user?.instagram ?? "");

  const [profileImage, setProfileImage] = useState<string | null>(
    user?.profilePictureUrl ?? null
  );

  // Changes after each successful upload, forcing Image to use a new URI.
  const [imageVersion, setImageVersion] = useState(() => Date.now());

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const profileImageUrl = useMemo(() => {
    const publicUrl = supabase.storage
      .from("profilePictures")
      .getPublicUrl(profileImage ?? "anonymous.jpg").data.publicUrl;

    return `${publicUrl}?v=${imageVersion}`;
  }, [profileImage, imageVersion]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await uploadImage(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Camera permission needed",
        "Please allow camera access to take a profile photo."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await uploadImage(result.assets[0].uri);
    }
  }

  async function uploadImage(uri: string) {
    if (!user?.email) {
      Alert.alert(
        "Not signed in",
        "Please sign in again before uploading a profile photo."
      );
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const filePath = `${user.email}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("profilePictures")
        .upload(filePath, blob, {
          upsert: true,
          contentType: "image/jpeg",
          cacheControl: "60",
        });

      if (uploadError) {
        console.error("Profile-image upload error:", uploadError);
        Alert.alert("Upload failed", uploadError.message);
        return;
      }

      const { error: updateError } = await supabase
        .from("attendeeProfile")
        .update({
          profilePictureUrl: filePath,
        })
        .eq("email", user.email);

      if (updateError) {
        console.error("Profile-image database update error:", updateError);
        Alert.alert(
          "Photo uploaded, but profile could not be updated.",
          updateError.message
        );
        return;
      }

      setProfileImage(filePath);
      setImageVersion(Date.now());

      setUser({
        ...user,
        profilePictureUrl: filePath,
      });

      Alert.alert("Profile photo updated");
    } catch (error) {
      console.error("Unexpected profile-image upload error:", error);
      Alert.alert("Upload failed", "Unable to upload the selected image.");
    } finally {
      setIsUploading(false);
    }
  }

  function choosePhoto() {
    if (isUploading) {
      return;
    }

    Alert.alert("Profile Photo", "Choose a source", [
      {
        text: "Take Photo",
        onPress: () => {
          void takePhoto();
        },
      },
      {
        text: "Choose From Library",
        onPress: () => {
          void pickImage();
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }

  async function saveProfile() {
    if (!user?.email || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("attendeeProfile")
        .update({
          firstName,
          lastName,
          school,
          major,
          interests,
          linkedin,
          instagram,
        })
        .eq("email", user.email);

      if (error) {
        console.error("Profile save error:", error);
        Alert.alert("Could not save profile", error.message);
        return;
      }

      setUser({
        ...user,
        firstName,
        lastName,
        school,
        major,
        interests,
        linkedin,
        instagram,
      });

      setMode("view");
      Alert.alert("Profile saved");
    } catch (error) {
      console.error("Unexpected profile-save error:", error);
      Alert.alert("Could not save profile", "Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function openProfileLink(url: string, label: string) {
    const normalizedUrl =
      url.startsWith("https://") || url.startsWith("http://")
        ? url
        : `https://${url}`;

    const supported = await Linking.canOpenURL(normalizedUrl);

    if (!supported) {
      Alert.alert("Invalid link", `This ${label} URL cannot be opened.`);
      return;
    }

    await Linking.openURL(normalizedUrl);
  }

  async function handleLogout() {
    await AsyncStorage.removeItem("loggedInEmail");
    setUser(null);
    router.replace("/login");
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={[
          theme.typography.biggestTitle,
          {
            color: theme.colors.primaryBlue,
            textAlign: "center",
          },
        ]}
      >
        {user?.firstName ?? "Your"}&apos;s Profile
      </Text>

      <Text
        style={[
          theme.typography.body,
          {
            color: theme.colors.primaryDarkGray,
            textAlign: "center",
            marginBottom: 16,
          },
        ]}
      >
        This profile will be shared with others when you exchange QR codes.
        Select the button below to edit it.
      </Text>

      <Button
        title={
          mode === "edit"
            ? isSaving
              ? "Saving..."
              : "Save"
            : "Edit Profile"
        }
        selected={mode === "edit"}
        variant="secondary"
        onPress={() => {
          if (mode === "edit") {
            void saveProfile();
          } else {
            setMode("edit");
          }
        }}
      />

      <Card>
        {mode === "edit" ? (
          <>
            <View style={styles.editPhotoSection}>
              <TouchableOpacity
                onPress={choosePhoto}
                disabled={isUploading}
                activeOpacity={0.75}
              >
                <Image
                  source={{ uri: profileImageUrl }}
                  style={[
                    styles.editProfileImage,
                    isUploading && styles.uploadingImage,
                  ]}
                />
              </TouchableOpacity>

              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: theme.colors.primaryDarkGray,
                    marginTop: 8,
                  },
                ]}
              >
                {isUploading ? "Uploading photo..." : "Tap photo to change"}
              </Text>
            </View>

            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              placeholderTextColor="#999"
              autoCapitalize="words"
              style={styles.input}
            />

            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              placeholderTextColor="#999"
              autoCapitalize="words"
              style={styles.input}
            />

            <TextInput
              value={school}
              onChangeText={setSchool}
              placeholder="School"
              placeholderTextColor="#999"
              autoCapitalize="words"
              style={styles.input}
            />

            <TextInput
              value={major}
              onChangeText={setMajor}
              placeholder="Major"
              placeholderTextColor="#999"
              autoCapitalize="words"
              style={styles.input}
            />

            <TextInput
              value={interests}
              onChangeText={setInterests}
              placeholder="Interests"
              placeholderTextColor="#999"
              multiline
              autoCapitalize="sentences"
              style={[styles.input, styles.multilineInput]}
            />

            <TextInput
              value={linkedin}
              onChangeText={setLinkedin}
              placeholder="LinkedIn URL"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
            />

            <TextInput
              value={instagram}
              onChangeText={setInstagram}
              placeholder="Instagram URL"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
            />
          </>
        ) : (
          <>
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
                  {firstName} {lastName}
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
                  {school || "School not added"}
                </Text>

                <Text
                  style={[
                    theme.typography.body,
                    {
                      color: theme.colors.primaryDarkGray,
                    },
                  ]}
                >
                  {major || "Major not added"}
                </Text>
              </View>

              <Image
                source={{ uri: profileImageUrl }}
                style={styles.viewProfileImage}
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
              Interests: {interests || "Not added yet"}
            </Text>

            <View style={styles.socialButtons}>
              <View style={styles.socialButton}>
                <Button
                  title={linkedin ? "LinkedIn" : "Add LinkedIn"}
                  onPress={() => {
                    if (linkedin) {
                      void openProfileLink(linkedin, "LinkedIn");
                    } else {
                      setMode("edit");
                    }
                  }}
                />
              </View>

              <View style={styles.socialButton}>
                <Button
                  title={instagram ? "Instagram" : "Add Instagram"}
                  onPress={() => {
                    if (instagram) {
                      void openProfileLink(instagram, "Instagram");
                    } else {
                      setMode("edit");
                    }
                  }}
                />
              </View>
            </View>
          </>
        )}
      </Card>

      <Button
        title="Sign Out"
        variant="secondary"
        onPress={() => {
          void handleLogout();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    padding: 16,
    gap: 12,
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
  viewProfileImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  editPhotoSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  editProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  uploadingImage: {
    opacity: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    color: theme.colors.primaryDarkGray,
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  socialButtons: {
    flexDirection: "row",
    gap: 10,
  },
  socialButton: {
    flex: 1,
  },
});