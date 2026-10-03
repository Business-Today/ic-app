import theme from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUser } from "../contexts/UserContext";
import { supabase } from "../lib/supabase";

type Step = "welcome" | "email" | "code";

const CODE_LENGTH = 6;

export default function Login() {
  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);

  const router = useRouter();
  const { setUser } = useUser();

  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    // Give the screen a moment to render before pulling up the keyboard.
    const timer = setTimeout(() => {
      if (step === "email") emailInputRef.current?.focus();
      if (step === "code") otpInputRef.current?.focus();
    }, 250);

    return () => clearTimeout(timer);
  }, [step]);

  const sendLoginCode = async (isResend = false) => {
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

      setOtp("");
      setStep("code");

      if (isResend) {
        Alert.alert("Code sent", `We sent a new code to ${normalizedEmail}.`);
      }
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

  const verifyLoginCode = async (code: string) => {
    const normalizedOtp = code.trim();

    if (normalizedOtp.length !== CODE_LENGTH) {
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

        setOtp("");

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

  const handleOtpChange = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH);
    setOtp(digits);

    if (digits.length === CODE_LENGTH && !loading) {
      verifyLoginCode(digits);
    }
  };

  const goToEmail = () => {
    setOtp("");
    setStep("email");
  };

  if (step === "welcome") {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.welcomeLogoArea}>
          <Image
            source={require("../assets/images/businesstoday_logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.welcomeActions}>
          <Pressable
            onPress={goToEmail}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Sign Up</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        {step === "email" ? (
          <View style={styles.formContent}>
            <View>
              <Pressable
                onPress={() => setStep("welcome")}
                hitSlop={12}
                disabled={loading}
                style={styles.backButton}
              >
                <Ionicons
                  name="chevron-back"
                  size={32}
                  color={theme.colors.primaryBlue}
                />
              </Pressable>

              <Text style={styles.title}>Email</Text>

              <Text style={styles.description}>
                Please enter the email you used for your Business Today
                application.
              </Text>
            </View>

            <View>
              <TextInput
                ref={emailInputRef}
                value={email}
                onChangeText={setEmail}
                placeholder="Email Address"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="send"
                editable={!loading}
                onSubmitEditing={() => sendLoginCode()}
                style={styles.underlineInput}
              />

              {!keyboardVisible && (
                <Pressable
                  onPress={() => sendLoginCode()}
                  disabled={loading || !normalizedEmail}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.continueButton,
                    (loading || !normalizedEmail) &&
                      styles.primaryButtonDisabled,
                    pressed && styles.primaryButtonPressed,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.formContent}>
            <View>
              <Pressable
                onPress={goToEmail}
                hitSlop={12}
                disabled={loading}
                style={styles.backButton}
              >
                <Ionicons
                  name="chevron-back"
                  size={32}
                  color={theme.colors.primaryBlue}
                />
              </Pressable>

              <Text style={styles.title}>Verification Code</Text>

              <Text style={styles.description}>
                Please enter the verification code sent to{" "}
                <Text style={styles.descriptionEmphasis}>{normalizedEmail}</Text>
              </Text>
            </View>

            <View style={styles.codeSection}>
              <Pressable
                onPress={() => otpInputRef.current?.focus()}
                style={styles.codeBoxes}
              >
                {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                  const digit = otp[index] ?? "";
                  const isActive = index === otp.length;

                  return (
                    <View
                      key={index}
                      style={[
                        styles.codeBox,
                        isActive && styles.codeBoxActive,
                      ]}
                    >
                      <Text style={styles.codeDigit}>{digit}</Text>
                    </View>
                  );
                })}
              </Pressable>

              {/* Hidden input that actually receives the keyboard. */}
              <TextInput
                ref={otpInputRef}
                value={otp}
                onChangeText={handleOtpChange}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                editable={!loading}
                caretHidden
                style={styles.hiddenInput}
              />

              {loading ? (
                <ActivityIndicator
                  color={theme.colors.primaryBlue}
                  style={styles.resendButton}
                />
              ) : (
                <Pressable
                  onPress={() => sendLoginCode(true)}
                  hitSlop={12}
                  style={styles.resendButton}
                >
                  <Text style={styles.resendText}>Resend Code</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const LOGO_ASPECT_RATIO = 1500 / 206;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },

  // Welcome step
  welcomeLogoArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  logo: {
    width: 220,
    height: 220 / LOGO_ASPECT_RATIO,
  },

  welcomeActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  primaryButton: {
    backgroundColor: theme.colors.primaryBlue,
    borderRadius: 38,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonPressed: {
    opacity: 0.85,
  },

  primaryButtonDisabled: {
    opacity: 0.4,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  // Email + code steps
  formContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },

  backButton: {
    alignSelf: "flex-start",
    marginLeft: -8,
    marginBottom: 32,
  },

  title: {
    ...theme.typography.title,
    fontSize: 28,
    color: theme.colors.primaryBlue,
    marginBottom: 12,
  },

  description: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },

  descriptionEmphasis: {
    fontWeight: "700",
  },

  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.textPrimary,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },

  continueButton: {
    marginTop: 24,
  },

  codeSection: {
    alignItems: "center",
    gap: 20,
  },

  codeBoxes: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: 10,
  },

  codeBox: {
    flex: 1,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#D9D9D9",
    alignItems: "center",
    justifyContent: "center",
  },

  codeBoxActive: {
    borderWidth: 2,
    borderColor: theme.colors.primaryBlue,
  },

  codeDigit: {
    fontSize: 24,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },

  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },

  resendButton: {
    paddingVertical: 4,
  },

  resendText: {
    color: theme.colors.primaryDarkGray,
    fontSize: 15,
  },
});
