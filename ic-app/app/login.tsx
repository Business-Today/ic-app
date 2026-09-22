import theme from "@/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Button from "../components/Button";
import { useUser } from "../contexts/UserContext";
import { supabase } from "../lib/supabase";

const PRINCETON_EMAIL_DOMAIN = "@princeton.edu";
const PRINCETON_PASSWORD = "Princeton123";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const router = useRouter();
  const { setUser } = useUser();

  async function loginWithEmail(emailToLogin: string) {
    const { data, error } = await supabase
      .from("attendeeProfile")
      .select("*")
      .eq("email", emailToLogin)
      .single();

    if (error || !data) {
      Alert.alert("User not found");
      return;
    }

    setUser(data);

    await AsyncStorage.setItem("loggedInEmail", data.email);

    router.replace("/(tabs)");
  }

  async function handleLogin() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      Alert.alert("Please enter your email");
      return;
    }

    if (trimmedEmail.toLowerCase().endsWith(PRINCETON_EMAIL_DOMAIN)) {
      setPendingEmail(trimmedEmail);
      setPassword("");
      setIsPasswordModalVisible(true);
      return;
    }

    await loginWithEmail(trimmedEmail);
  }

  function handlePasswordSubmit() {
    if (password === PRINCETON_PASSWORD) {
      setIsPasswordModalVisible(false);
      setPassword("");
      void loginWithEmail(pendingEmail);
      return;
    }

    setIsPasswordModalVisible(false);
    setPassword("");
    Alert.alert("Incorrect password", "Please try again and return to the login screen.");
  }

  return (
    <>
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

          <Button title="Continue" onPress={handleLogin} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={isPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsPasswordModalVisible(false);
          setPassword("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Princeton login</Text>
            <Text style={styles.modalSubtitle}>Enter the password for {pendingEmail}</Text>

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
              style={styles.passwordInput}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setIsPasswordModalVisible(false);
                  setPassword("");
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <Button title="Submit" onPress={handlePasswordSubmit} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.primaryBlue,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#333333",
    marginBottom: 16,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: theme.colors.primaryBlue,
    fontWeight: "600",
  },
});