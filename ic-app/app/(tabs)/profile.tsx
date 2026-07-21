import { View, Text, Image, TextInput, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useUser } from "../../contexts/UserContext";
import theme from "../../theme";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { supabase } from "../../lib/supabase";
import { Linking, Alert } from "react-native";
import { useState, useMemo } from "react";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Profile() {
  const [mode, setMode] = useState<"edit" | "view">("view");
  const {user, setUser} = useUser();
  const [firstName, setFirstName] = useState(`${user?.firstName ?? ""}`);
  const [lastName, setLastName] = useState(`${user?.lastName ?? ""}`);
  const [school, setSchool] = useState(user?.school ?? "");
  const [major, setMajor] = useState(user?.major ?? "");
  const [interests, setInterests] = useState(user?.interests ?? "");
  const [linkedin, setLinkedin] = useState(user?.linkedin ?? "");
  const [instagram, setInstagram] = useState(user?.instagram ?? "");
  const router = useRouter();
  const [profileImage, setProfileImage] = useState(
    user?.profilePictureUrl ?? null
  );

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadImage(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const permission =
      await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadImage(result.assets[0].uri);
    }
  }
  async function uploadImage(uri: string) {
    if (!user?.id) return;

    const response = await fetch(uri);
    const blob = await response.blob();

    const filePath = `${user.id}.jpg`;

    const { error } = await supabase.storage
      .from("profilePictures")
      .upload(filePath, blob, {
        upsert: true,
        contentType: "image/jpeg",
      });

    if (error) {
      console.error(error);
      return;
    }

    await supabase
      .from("attendeeProfile")
      .update({
        profilePictureUrl: filePath,
      })
      .eq("id", user.id);

    setProfileImage(filePath);

    setUser({
      ...user,
      profilePictureUrl: filePath,
    });
  }

  function choosePhoto() {
    Alert.alert(
      "Profile Photo",
      "Choose a source",
      [
        {
          text: "Take Photo",
          onPress: takePhoto,
        },
        {
          text: "Choose From Library",
          onPress: pickImage,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }

  async function saveProfile() {
      if (!user?.id) return;

      const { error } = await supabase
        .from("attendeeProfile")
        .update({
          school,
          major,
          interests,
          linkedin,
          instagram,
        })
        .eq("id", user.id);

      if (error) {
        console.error(error);
        return;
      }

      setUser({
        ...user,
        school,
        major,
        interests,
        linkedin,
        instagram,
      });

    setMode("view");
  }

  async function handleLogout() {
    await AsyncStorage.removeItem("loggedInEmail");
    setUser(null);
    router.replace("/login");
  }
  
  return (

    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        padding: 16,
        gap: 12,
      }}
      automaticallyAdjustKeyboardInsets={true}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
    <Text style={[
          theme.typography.biggestTitle,
          {
            color: theme.colors.primaryBlue,
            textAlign: "center",
          },
        ]}>{user?.firstName}'s Profile</Text>
    <Text style={[ theme.typography.body, {color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 16}]}>
      This profile will be shared with others when you exchange QR codes. Click button below to edit. 
    </Text>
    <Button
      title={mode === "edit" ? "Save" : "Edit Profile"}
      selected={mode === "edit"}
      variant="secondary"
      onPress={() => {
        if (mode === "edit") {
          // Save profile here
          setMode("view"); // or whatever your non-edit mode is
          saveProfile();
        } else {
          setMode("edit");
        }
      }}
    />    
      <Card>

      {/* {mode === "edit" ? (
        <View style={{ alignItems: "center" }}>
        <TouchableOpacity onPress={choosePhoto}>
          <Image
            source={{
              uri: supabase.storage
                .from("profilePictures")
                .getPublicUrl(
                  profileImage ?? "anonymous.jpg"
                ).data.publicUrl,
            }}
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
            }}
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
        Tap photo to change
      </Text>
      </View>
      ) : (
        <Image
          source={{
            uri: supabase.storage
              .from("profilePictures")
              .getPublicUrl(
                profileImage ?? "anonymous.jpg"
              ).data.publicUrl,
          }}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
          }}
        />
      )} */}
      {mode === "edit" ? (
        <>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First Name"
          placeholderTextColor="#999"
          style={{
            borderWidth: 1,
            padding: 8,
            marginBottom: 8,
          }}
        />
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last Name"
          placeholderTextColor="#999"
          style={{
            borderWidth: 1,
            padding: 8,
            marginBottom: 8,
          }}
        />
      </>
      ) : (
        <Text style={[ theme.typography.title, {color: theme.colors.primaryBlue, marginBottom: 8}]}>
        {firstName} {lastName}
      </Text>
      )}
      {mode === "edit" ? (
          <>
            <TextInput
              value={school}
              onChangeText={setSchool}
              placeholder="School"
              placeholderTextColor="#999"
              style={{
                borderWidth: 1,
                padding: 8,
                marginBottom: 8,
              }}
            />

            <TextInput
              value={major}
              onChangeText={setMajor}
              placeholder="Major"
              placeholderTextColor="#999"
              style={{
                borderWidth: 1,
                padding: 8,
                marginBottom: 8,
              }}
            />
          </>
        ) : (
        <>
          <Text
            style={[
              theme.typography.sectionTitle,
              { color: theme.colors.primaryDarkGray, marginBottom: 6 },
            ]}
          >
            {school}
          </Text>
          <Text
            style={[theme.typography.body, {color: theme.colors.primaryDarkGray, marginBottom: 6}]}>
            {major}
          </Text>
        </>
        )}
      {mode === "edit" ? (
        <TextInput
          value={interests}
          onChangeText={setInterests}
          placeholder="Interests"
          placeholderTextColor="#999"
          multiline
          style={{
            borderWidth: 1,
            padding: 8,
            marginBottom: 8,
          }}
        />
      ) : (
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.primaryDarkGray },
          ]}
        >
          Interests: {interests}
        </Text>
      )}
      {mode === "edit" ? (
      <TextInput
        value={linkedin}
        onChangeText={setLinkedin}
        placeholder="LinkedIn URL"
        placeholderTextColor="#999"
        style={{
          borderWidth: 1,
          padding: 8,
          marginBottom: 8,
        }}
      />
    ) : (
      <Button
        title={linkedin ? "LinkedIn" : "Add LinkedIn"}
        onPress={() => {
          if (linkedin) {
            Linking.openURL(linkedin);
          }
          else{
            setMode("edit");
          }
        }}
      />
    )}

    {mode === "edit" ? (
      <TextInput
        value={instagram}
        onChangeText={setInstagram}
        placeholder="Instagram URL"
        placeholderTextColor="#999"
        style={{
          borderWidth: 1,
          padding: 8,
          marginBottom: 8,
        }}
      />
    ) : (
      <Button
        title={instagram ? "Instagram" : "Add Instagram"}
        onPress={() => {
          if (instagram) {
            Linking.openURL(instagram);
          }
          else{
            setMode("edit");
          }
        }}
      />
    )}
    </Card>
    <Button
      title="Sign Out"
      variant="secondary"
      onPress={handleLogout}
    />
    </ScrollView>
    
  );
}