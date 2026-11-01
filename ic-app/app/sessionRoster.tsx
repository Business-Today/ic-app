import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import SessionRosterList from "@/components/SessionRosterList";
import theme from "@/theme";

/** Read-only sheet opened from the scanner's checked-in count. */
export default function SessionRoster() {
  const params = useLocalSearchParams<{
    eventID?: string;
    eventName?: string;
  }>();

  const eventID = typeof params.eventID === "string" ? params.eventID : "";
  const eventName =
    typeof params.eventName === "string" && params.eventName
      ? params.eventName
      : "Session";

  return (
    <>
      <SessionRosterList
        eventID={eventID}
        searchable={false}
        centeredTabs
        header={
          <Text style={styles.title} numberOfLines={2}>
            {eventName}
          </Text>
        }
      />
      <View style={styles.pillBar} pointerEvents="none" collapsable={false}>
        <View style={styles.pill} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  pillBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    alignItems: "center",
    paddingTop: 8,
    backgroundColor: theme.colors.backgroundWhite,
  },
  pill: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.labelTertiary,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
    textAlign: "center",
    paddingTop: 24,
  },
});
