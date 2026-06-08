import { View, Text, TextInput, Alert, Image, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useUser } from "../contexts/UserContext";
import Button from "../components/Button";
import theme from "@/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const router = useRouter();
  const { setUser } = useUser();

  async function handleLogin() {
    const { data, error } = await supabase
      .from("attendeeProfile")
      .select("*")
      .eq("email", email.trim())
      .single();

    if (error || !data) {
      Alert.alert("User not found");
      return;
    }

    setUser(data);

    await AsyncStorage.setItem(
      "loggedInEmail",
      data.email
    );

    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView 
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    style={{ flex: 1 }}
  >
    <ScrollView style={{ flex: 1 }}
      contentContainerStyle={{
        padding: 16,
        marginTop: 100,
        justifyContent: "center",
        gap: 12,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
        <Image
      source={require("../assets/images/ic-logo.jpg")}
      style={{
        width: 120,
        height: 160,
        alignSelf: "center",
        marginBottom: 20,
      }}
    />
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
        Welcome to the IC App!
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Enter School Email"
        placeholderTextColor="#999"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          padding: 12,
          marginBottom: 16,
        }}
      />

      <Button
        title="Continue"
        onPress={handleLogin}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}