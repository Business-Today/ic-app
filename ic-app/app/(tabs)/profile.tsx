import SymbolIcon from "@/components/SymbolIcon";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      console.error("Sign-out error:", error);

      Alert.alert(
        "Could not sign out",
        "Please check your connection and try again."
      );

      return;
    }

    setUser(null);

    router.replace("/login");
  }

  function cancelEdit() {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setSchool(user?.school ?? "");
    setMajor(user?.major ?? "");
    setInterests(user?.interests ?? "");
    setLinkedin(user?.linkedin ?? "");
    setInstagram(user?.instagram ?? "");
    setMode("view");
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const subtitle = [school, major].filter(Boolean).join(" · ");

  type Row = {
    key: string;
    label: string;
    value: string;
    placeholder: string;
    symbol: Parameters<typeof SymbolIcon>[0]["name"];
    fallback: Parameters<typeof SymbolIcon>[0]["fallback"];
    tint: string;
    tintBackground: string;
    onPress: () => void;
  };

  const rows: Row[] = [
    {
      key: "interests",
      label: "Interests",
      value: interests,
      placeholder: "Add your interests",
      symbol: "sparkles",
      fallback: "sparkles-outline",
      tint: "#F5A623",
      tintBackground: "#FFF3DD",
      onPress: () => setMode("edit"),
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      value: linkedin,
      placeholder: "Add your LinkedIn",
      symbol: "link",
      fallback: "logo-linkedin",
      tint: "#0A66C2",
      tintBackground: "#E3EEFA",
      onPress: () => {
        if (linkedin) {
          void openProfileLink(linkedin, "LinkedIn");
        } else {
          setMode("edit");
        }
      },
    },
    {
      key: "instagram",
      label: "Instagram",
      value: instagram,
      placeholder: "Add your Instagram",
      symbol: "camera",
      fallback: "logo-instagram",
      tint: "#E1306C",
      tintBackground: "#FCE4EC",
      onPress: () => {
        if (instagram) {
          void openProfileLink(instagram, "Instagram");
        } else {
          setMode("edit");
        }
      },
    },
  ];

  function renderView() {
    return (
      <>
        <View style={styles.group}>
          {rows.map((row, index) => (
            <Pressable
              key={row.key}
              onPress={row.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                index < rows.length - 1 && styles.rowDivider,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[styles.iconTile, { backgroundColor: row.tintBackground }]}
              >
                <SymbolIcon
                  name={row.symbol}
                  fallback={row.fallback}
                  size={18}
                  weight="semibold"
                  color={row.tint}
                />
              </View>

              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text
                  style={[styles.rowValue, !row.value && styles.rowPlaceholder]}
                  numberOfLines={2}
                >
                  {row.value || row.placeholder}
                </Text>
              </View>

              <SymbolIcon
                name="chevron.right"
                fallback="chevron-forward"
                size={14}
                weight="semibold"
                color={theme.colors.labelTertiary}
              />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setMode("edit")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonText}>Edit Profile</Text>
        </Pressable>

        <Pressable
          onPress={() => void handleLogout()}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </>
    );
  }

  const fields: {
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    props?: React.ComponentProps<typeof TextInput>;
  }[] = [
    {
      key: "firstName",
      label: "First name",
      value: firstName,
      onChange: setFirstName,
      props: { autoCapitalize: "words" },
    },
    {
      key: "lastName",
      label: "Last name",
      value: lastName,
      onChange: setLastName,
      props: { autoCapitalize: "words" },
    },
    {
      key: "school",
      label: "School",
      value: school,
      onChange: setSchool,
      props: { autoCapitalize: "words" },
    },
    {
      key: "major",
      label: "Major",
      value: major,
      onChange: setMajor,
      props: { autoCapitalize: "words" },
    },
    {
      key: "interests",
      label: "Interests",
      value: interests,
      onChange: setInterests,
      props: { autoCapitalize: "sentences", multiline: true },
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      value: linkedin,
      onChange: setLinkedin,
      props: {
        autoCapitalize: "none",
        autoCorrect: false,
        keyboardType: "url",
        placeholder: "linkedin.com/in/you",
      },
    },
    {
      key: "instagram",
      label: "Instagram",
      value: instagram,
      onChange: setInstagram,
      props: {
        autoCapitalize: "none",
        autoCorrect: false,
        keyboardType: "url",
        placeholder: "instagram.com/you",
      },
    },
  ];

  function renderEdit() {
    return (
      <>
        <View style={styles.group}>
          {fields.map((field, index) => (
            <View
              key={field.key}
              style={[
                styles.fieldRow,
                index < fields.length - 1 && styles.rowDivider,
              ]}
            >
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                value={field.value}
                onChangeText={field.onChange}
                placeholderTextColor={theme.colors.labelTertiary}
                style={[
                  styles.fieldInput,
                  field.props?.multiline && styles.fieldInputMultiline,
                ]}
                {...field.props}
              />
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => void saveProfile()}
          disabled={isSaving}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isSaving) && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? "Saving..." : "Save"}
          </Text>
        </Pressable>

        <Pressable
          onPress={cancelEdit}
          disabled={isSaving}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Profile</Text>

        <View style={styles.hero}>
          <Pressable
            onPress={choosePhoto}
            disabled={isUploading}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={styles.avatarWrapper}
          >
            <Image
              source={{ uri: profileImageUrl }}
              style={[styles.avatar, isUploading && styles.avatarUploading]}
            />
            <View style={styles.avatarBadge}>
              <SymbolIcon
                name="camera.fill"
                fallback="camera"
                size={14}
                weight="semibold"
                color="#FFFFFF"
              />
            </View>
          </Pressable>

          <Text style={styles.name}>{fullName || "Your name"}</Text>
          <Text style={styles.subtitle}>
            {isUploading
              ? "Uploading photo..."
              : subtitle || "Add your school and major"}
          </Text>
        </View>

        {mode === "edit" ? renderEdit() : renderView()}
      </ScrollView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 108;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: theme.colors.textPrimary,
  },
  hero: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 28,
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginBottom: 16,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: theme.colors.fillSecondary,
  },
  avatarUploading: {
    opacity: 0.5,
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryBlue,
    borderWidth: 3,
    borderColor: theme.colors.backgroundWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.labelSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  group: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.18)",
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 20,
    color: theme.colors.labelSecondary,
    marginTop: 2,
  },
  rowPlaceholder: {
    color: theme.colors.labelTertiary,
  },
  fieldRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: theme.colors.labelSecondary,
    marginBottom: 4,
  },
  fieldInput: {
    fontSize: 17,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  fieldInputMultiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: theme.colors.primaryBlue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  secondaryButton: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: theme.colors.primaryBlue,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  signOut: {
    alignItems: "center",
    paddingVertical: 20,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#D0342C",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
