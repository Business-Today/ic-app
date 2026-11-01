import { useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import PageHeader from "@/components/PageHeader";
import SessionRosterList from "@/components/SessionRosterList";
import theme from "@/theme";

export default function AttendanceRecords() {
  const params = useLocalSearchParams<{
    eventID?: string;
    eventName?: string;
    eventSubtitle?: string;
  }>();

  const eventID = typeof params.eventID === "string" ? params.eventID : "";
  const eventName =
    typeof params.eventName === "string" && params.eventName
      ? params.eventName
      : "Session";
  const eventSubtitle =
    typeof params.eventSubtitle === "string" ? params.eventSubtitle : "";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <SessionRosterList
        eventID={eventID}
        canRemove
        header={
          <PageHeader compact title={eventName} subtitle={eventSubtitle} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
});
