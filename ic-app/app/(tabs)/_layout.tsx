import { Tabs } from "expo-router";
import { Platform } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import SymbolIcon from "@/components/SymbolIcon";
import { useUser } from "@/contexts/UserContext";
import theme from "@/theme";

const ICON_SIZE = 30;
const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 84 : 64;
const TOP_FADE_HEIGHT = 24;
const BACKGROUND_HEIGHT = TAB_BAR_HEIGHT + TOP_FADE_HEIGHT;

/**
 * The bar's whole background, drawn as one shape so the fade and the fill can't
 * separate: transparent at the top, reaching solid white where the bar starts.
 */
function TabBarBackground() {
  return (
    <Svg
      width="100%"
      height={BACKGROUND_HEIGHT}
      style={{ position: "absolute", top: -TOP_FADE_HEIGHT }}
    >
      <Defs>
        <LinearGradient id="tabBarBackground" x1="0" y1="0" x2="0" y2="1">
          <Stop
            offset={0}
            stopColor={theme.colors.backgroundWhite}
            stopOpacity={0}
          />
          <Stop
            offset={TOP_FADE_HEIGHT / BACKGROUND_HEIGHT}
            stopColor={theme.colors.backgroundWhite}
            stopOpacity={1}
          />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#tabBarBackground)" />
    </Svg>
  );
}

export default function TabLayout() {
  const { user } = useUser();
  const canTakeAttendance = !!user?.email?.endsWith("@princeton.edu");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.textPrimary,
        tabBarInactiveTintColor: "#9A9AA0",
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          // Pull the icons toward the center of the bar.
          paddingHorizontal: canTakeAttendance ? 40 : 64,
          height: TAB_BAR_HEIGHT,
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
  );
}
