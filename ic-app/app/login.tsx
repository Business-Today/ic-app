import theme from "@/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput
} from "react-native";

import Button from "../components/Button";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { setUser } = useUser();

  const sendLoginCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert("Missing email", "Enter your school email.");
      return;
    }

    if (!normalizedEmail.endsWith("@princeton.edu")) {
      Alert.alert(
        "Use your school email",
        "Please use your @princeton.edu email address."
      );
      return;
    }

    setLoading(true);

    try {
      const { data: registeredAttendee, error: profileError } = await supabase
        .from("attendeeProfile")
        .select("email")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profileError) {
        console.error("Could not check registration:", profileError);

        Alert.alert(
          "Could not verify registration",
          "Please check your connection and try again."
        );

        return;
      }

      if (!registeredAttendee) {
        Alert.alert(
          "Email not registered",
          "This email is not registered for the event. Please contact an organizer."
        );

        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
      });

      if (otpError) {
        console.error("Could not send OTP:", otpError);

        Alert.alert(
          "Could not send code",
          otpError.message || "Please try again in a moment."
        );

        return;
      }

      setCodeSent(true);
      setOtp("");

      Alert.alert(
        "Code sent",
        `We sent a six-digit sign-in code to ${normalizedEmail}.`
      );
    } catch (error) {
      console.error("Unexpected OTP send error:", error);

      Alert.alert(
        "Could not send code",
        "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (normalizedOtp.length !== 6) {
      Alert.alert("Invalid code", "Enter the six-digit code from your email.");
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: normalizedOtp,
          type: "email",
        });

      if (authError || !authData.user) {
        console.error("OTP verification failed:", authError);

        Alert.alert(
          "Invalid or expired code",
          authError?.message ??
            "Request a new code and make sure you enter it exactly."
        );

        return;
      }

      const { data: attendee, error: profileError } = await supabase
        .from("attendeeProfile")
        .select("*")
        .eq("email", authData.user.email?.trim().toLowerCase())
        .single();

      if (profileError || !attendee) {
        console.error("Could not load attendee profile:", profileError);

        await supabase.auth.signOut();

        Alert.alert(
          "Profile not found",
          "Your login worked, but no matching attendee profile was found. Contact an administrator."
        );

        return;
      }

      setUser(attendee);

      router.replace("/(tabs)");
    } catch (error) {
      console.error("Unexpected OTP verification error:", error);

      Alert.alert(
        "Could not sign in",
        "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetLogin = () => {
    setCodeSent(false);
    setOtp("");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: "#FFFFFF" }}
        contentContainerStyle={{
          padding: 16,
          marginTop: 100,
          justifyContent: "center",
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

        {!codeSent ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter school email"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
              onSubmitEditing={sendLoginCode}
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 12,
                marginBottom: 16,

                fontSize: 16,
                letterSpacing: 0,
                fontFamily: Platform.select({
                  ios: "System",
                  android: "Roboto",
                }),
              }}
            />

            <Button
              title={loading ? "Sending code..." : "Send login code"}
              onPress={sendLoginCode}
              disabled={loading}
            />
          </>
        ) : (
          <>
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.colors.primaryDarkGray,
                  textAlign: "center",
                  marginBottom: 4,
                },
              ]}
            >
              Enter the six-digit code sent to {email.trim().toLowerCase()}.
            </Text>

            <TextInput
              value={otp}
              onChangeText={(value) =>
                setOtp(value.replace(/[^0-9]/g, "").slice(0, 6))
              }
              placeholder="123456"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
              autoFocus
              onSubmitEditing={verifyLoginCode}
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 10,
                padding: 12,
                textAlign: "center",
                fontSize: 22,
                letterSpacing: 8,
                marginBottom: 16,
              }}
            />

            <Button
              title={loading ? "Verifying..." : "Sign in"}
              onPress={verifyLoginCode}
              disabled={loading}
            />

            <Button
              title="Use a different email"
              variant="secondary"
              onPress={resetLogin}
              disabled={loading}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}