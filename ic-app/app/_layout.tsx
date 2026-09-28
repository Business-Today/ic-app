import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";
import Toast from "react-native-toast-message";

import { UserProvider } from "../contexts/UserContext";
import { supabase } from "../lib/supabase";

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
    const isInTabs = rootSegment === "(tabs)";

    if (!hasSession && !isOnLoginScreen) {
      router.replace("/login");
      return;
    }

    if (hasSession && !isInTabs) {
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

      <Stack.Screen
        name="attendeeAttendance"
        options={{
          title: "",
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="attendanceRecords"
        options={{
          title: "",
          headerBackTitle: "Back",
        }}
      />

      <Stack.Screen
        name="manualCheckIn"
        options={{
          title: "",
          headerBackTitle: "Back",
        }}
      />

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