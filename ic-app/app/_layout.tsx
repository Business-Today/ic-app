import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";
import Toast from "react-native-toast-message";

import HeaderBackButton from "../components/HeaderBackButton";
import { UserProvider } from "../contexts/UserContext";
import { supabase } from "../lib/supabase";

// The attendance screens draw their own back chevron and title, so the
// native (glass) header stays out of the way entirely.
const attendanceScreenOptions = {
  headerShown: false,
};

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();

  const [isLoading, setIsLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Could not restore Supabase session:", error);
      }

      if (!isMounted) return;

      setHasSession(!!session);
      setIsLoading(false);
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      setHasSession(!!session);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const rootSegment = segments[0];
    const isOnLoginScreen = rootSegment === "login";

    if (!hasSession && !isOnLoginScreen) {
      router.replace("/login");
      return;
    }

    if (hasSession && isOnLoginScreen) {
      router.replace("/(tabs)");
    }
  }, [hasSession, isLoading, router, segments]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTintColor: "#111827",
        contentStyle: { backgroundColor: "#FFFFFF" },
        // Any remaining native header uses the login flow's chevron.
        headerBackVisible: false,
        headerLeft: () => <HeaderBackButton />,
      }}
    >
      <Stack.Screen
        name="login"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false }}
      />

      <Stack.Screen name="attendance" options={attendanceScreenOptions} />

      <Stack.Screen name="attendanceRecords" options={attendanceScreenOptions} />

      <Stack.Screen name="attendeeAttendance" options={attendanceScreenOptions} />

      <Stack.Screen name="attendeeDetail" options={attendanceScreenOptions} />

      <Stack.Screen name="manualCheckIn" options={attendanceScreenOptions} />

      <Stack.Screen name="nfcCheckIn" options={attendanceScreenOptions} />

      <Stack.Screen name="assignNfcTag" options={attendanceScreenOptions} />

      <Stack.Screen
        name="modal"
        options={{
          presentation: "modal",
          title: "Modal",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <UserProvider>
      <AuthGate />
      <StatusBar style="dark" />
      <Toast />
    </UserProvider>
  );
}