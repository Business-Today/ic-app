import theme from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { type RefObject, useEffect, useRef, useState } from "react";
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

type Step = "welcome" | "email" | "personalEmail" | "code";

const CODE_LENGTH = 6;

// How long the code step waits before offering the personal email instead.
const PERSONAL_EMAIL_FALLBACK_MS = 30_000;

export default function Login() {
  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [usingPersonalEmail, setUsingPersonalEmail] = useState(false);
  const [showPersonalEmailOption, setShowPersonalEmailOption] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const personalEmailInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);

  const router = useRouter();
  const { setUser } = useUser();

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPersonalEmail = personalEmail.trim().toLowerCase();
  const codeEmail = usingPersonalEmail
    ? normalizedPersonalEmail
    : normalizedEmail;

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
      if (step === "personalEmail") personalEmailInputRef.current?.focus();
      if (step === "code") otpInputRef.current?.focus();
    }, 250);

    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    // School inboxes sometimes hold the code back, so after a while offer to
    // send it to the personal email on the attendee's profile instead.
    if (step !== "code" || usingPersonalEmail || showPersonalEmailOption) {
      return;
    }

    const timer = setTimeout(
      () => setShowPersonalEmailOption(true),
      PERSONAL_EMAIL_FALLBACK_MS
    );

    return () => clearTimeout(timer);
  }, [step, usingPersonalEmail, showPersonalEmailOption]);

  const requestCode = async (address: string) => {
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
    });

    if (otpError) {
      console.error("Could not send OTP:", otpError);

      Alert.alert(
        "Could not send code",
        otpError.message || "Please try again in a moment."
      );

      return false;
    }

    return true;
  };

  const sendLoginCode = async (isResend = false) => {
    if (!normalizedEmail) {
      Alert.alert(
        "Missing email",
        "Enter your school email, as submitted in the RSVP Form."
      );
      return;
    }

    setLoading(true);

    try {
      // Asks the database "is this email registered?" without being able to
      // read attendee profiles before sign-in. Falls back to the old lookup
      // while the database function isn't deployed yet.
      let isRegistered: boolean;
      const { data: registered, error: checkError } = await supabase.rpc(
        "is_registered_attendee",
        { p_email: normalizedEmail }
      );

      if (checkError?.code === "PGRST202") {
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

        isRegistered = !!registeredAttendee;
      } else if (checkError) {
        console.error("Could not check registration:", checkError);

        Alert.alert(
          "Could not verify registration",
          "Please check your connection and try again."
        );

        return;
      } else {
        isRegistered = registered === true;
      }

      if (!isRegistered) {
        Alert.alert(
          "Email not registered",
          "This email is not registered for the event. Please contact an organizer."
        );

        return;
      }

      if (!(await requestCode(normalizedEmail))) return;

      setUsingPersonalEmail(false);
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

  const sendPersonalEmailCode = async (isResend = false) => {
    if (!normalizedPersonalEmail) {
      Alert.alert(
        "Missing email",
        "Enter the personal email connected to your account."
      );
      return;
    }

    setLoading(true);

    try {
      // Only send the code if this personal email is on the same profile as
      // the school email entered earlier.
      const { data: matches, error: checkError } = await supabase.rpc(
        "is_registered_personal_email",
        { p_email: normalizedEmail, p_personal_email: normalizedPersonalEmail }
      );

      if (checkError) {
        console.error("Could not check personal email:", checkError);

        Alert.alert(
          "Could not verify email",
          "Please check your connection and try again."
        );

        return;
      }

      if (matches !== true) {
        Alert.alert(
          "Email not on file",
          `This personal email isn't connected to ${normalizedEmail}. Please contact an organizer.`
        );

        return;
      }

      if (!(await requestCode(normalizedPersonalEmail))) return;

      setUsingPersonalEmail(true);
      setOtp("");
      setStep("code");

      if (isResend) {
        Alert.alert(
          "Code sent",
          `We sent a new code to ${normalizedPersonalEmail}.`
        );
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
          email: codeEmail,
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
        .eq(
          usingPersonalEmail ? "personalEmail" : "email",
          authData.user.email?.trim().toLowerCase()
        )
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
    setUsingPersonalEmail(false);
    setShowPersonalEmailOption(false);
    setStep("email");
  };

  const goToPersonalEmail = () => {
    setOtp("");
    setUsingPersonalEmail(false);
    setStep("personalEmail");
  };

  const resendCode = () =>
    usingPersonalEmail ? sendPersonalEmailCode(true) : sendLoginCode(true);

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
            <Text style={styles.primaryButtonText}>Sign In</Text>
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
          <EmailForm
            title="Email"
            description="Please enter the school email you submitted to your RSVP form."
            inputRef={emailInputRef}
            value={email}
            onChangeText={setEmail}
            canSubmit={!!normalizedEmail}
            onSubmit={() => sendLoginCode()}
            onBack={() => setStep("welcome")}
            loading={loading}
            keyboardVisible={keyboardVisible}
          />
        ) : step === "personalEmail" ? (
          <EmailForm
            title="Personal Email"
            description="Enter the personal email connected to your account and we'll send the code there instead."
            inputRef={personalEmailInputRef}
            value={personalEmail}
            onChangeText={setPersonalEmail}
            canSubmit={!!normalizedPersonalEmail}
            onSubmit={() => sendPersonalEmailCode()}
            onBack={() => setStep("code")}
            loading={loading}
            keyboardVisible={keyboardVisible}
          />
        ) : (
          <View style={styles.formContent}>
            <View>
              <Pressable
                onPress={usingPersonalEmail ? goToPersonalEmail : goToEmail}
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
                <Text style={styles.descriptionEmphasis}>{codeEmail}</Text>
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
                      style={[styles.codeBox, isActive && styles.codeBoxActive]}
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
                  onPress={resendCode}
                  hitSlop={12}
                  style={styles.resendButton}
                >
                  <Text style={styles.resendText}>Resend Code</Text>
                </Pressable>
              )}

              {showPersonalEmailOption && !usingPersonalEmail && (
                <Pressable
                  onPress={goToPersonalEmail}
                  hitSlop={12}
                  disabled={loading}
                >
                  <Text style={styles.personalEmailText}>
                    Didn&apos;t get a code? Use your personal email
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmailForm({
  title,
  description,
  inputRef,
  value,
  onChangeText,
  canSubmit,
  onSubmit,
  onBack,
  loading,
  keyboardVisible,
}: {
  title: string;
  description: string;
  inputRef: RefObject<TextInput | null>;
  value: string;
  onChangeText: (value: string) => void;
  canSubmit: boolean;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  keyboardVisible: boolean;
}) {
  return (
    <View style={styles.formContent}>
      <View>
        <Pressable
          onPress={onBack}
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

        <Text style={styles.title}>{title}</Text>

        <Text style={styles.description}>{description}</Text>
      </View>

      <View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder="Email Address"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          returnKeyType="send"
          editable={!loading}
          onSubmitEditing={onSubmit}
          style={styles.underlineInput}
        />

        {!keyboardVisible && (
          <Pressable
            onPress={onSubmit}
            disabled={loading || !canSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.continueButton,
              (loading || !canSubmit) && styles.primaryButtonDisabled,
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

  personalEmailText: {
    color: theme.colors.primaryBlue,
    fontSize: 15,
    fontWeight: "600",
  },
});
