import { Tabs } from "expo-router";
import { Platform } from "react-native";

import SymbolIcon from "@/components/SymbolIcon";
import { ScannerProvider } from "@/contexts/ScannerContext";
import { useUser } from "@/contexts/UserContext";
import theme from "@/theme";

const ICON_SIZE = 30;

export default function TabLayout() {
  const { user } = useUser();
  const canTakeAttendance = !!user?.email?.endsWith("@princeton.edu");

  return (
    <ScannerProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: theme.colors.textPrimary,
          tabBarInactiveTintColor: "#9A9AA0",
          tabBarStyle: {
            backgroundColor: theme.colors.backgroundWhite,
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            // Pull the icons toward the center of the bar.
            paddingHorizontal: canTakeAttendance ? 40 : 64,
            height: Platform.OS === "ios" ? 84 : 64,
            paddingTop: 10,
          },
          tabBarItemStyle: {
            paddingVertical: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <SymbolIcon
                name={focused ? "house.fill" : "house"}
                fallback={focused ? "home" : "home-outline"}
                size={ICON_SIZE}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="network"
          options={{
            title: "Network",
            tabBarIcon: ({ color, focused }) => (
              <SymbolIcon
                name={focused ? "person.2.fill" : "person.2"}
                fallback={focused ? "people" : "people-outline"}
                size={ICON_SIZE}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="attendance"
          options={{
            title: "Attendance",
            // Hidden from the bar for attendees; only staff take attendance.
            href: canTakeAttendance ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <SymbolIcon
                name={focused ? "checkmark.circle.fill" : "checkmark.circle"}
                fallback={
                  focused ? "checkmark-circle" : "checkmark-circle-outline"
                }
                size={ICON_SIZE}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <SymbolIcon
                name={
                  focused ? "person.crop.circle.fill" : "person.crop.circle"
                }
                fallback={focused ? "person-circle" : "person-circle-outline"}
                size={ICON_SIZE}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </ScannerProvider>
  );
}
