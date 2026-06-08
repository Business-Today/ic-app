import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { UserProvider } from "../contexts/UserContext";
import Toast from "react-native-toast-message";

export default function RootLayout() {
  return (
    <UserProvider>
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
          name="modal"
          options={{
            presentation: "modal",
            title: "Modal",
          }}
        />
      </Stack>

      <StatusBar style="dark" />
      <Toast />
    </UserProvider>
  );
}