import { StyleSheet, Text, View } from "react-native";

import { formatClockTime } from "@/lib/attendance";
import theme from "@/theme";

type Props = {
  startTime: string;
  endTime: string;
};

/**
 * Stacked start and end times with a vertical rule, lifted from the Home
 * schedule so session rows look identical across the app.
 */
export default function TimeBlock({ startTime, endTime }: Props) {
  const start = formatClockTime(startTime);
  const end = formatClockTime(endTime);

  return (
    <View style={styles.wrapper}>
      <View style={styles.times}>
        <Text style={styles.time}>
          {start.time}
          <Text style={styles.period}> {start.period}</Text>
        </Text>
        <Text style={[styles.time, styles.timeEnd]}>
          {end.time}
          <Text style={styles.period}> {end.period}</Text>
        </Text>
      </View>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignSelf: "stretch",
    alignItems: "center",
  },
  times: {
    width: 78,
    gap: 3,
  },
  time: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
  },
  timeEnd: {
    color: theme.colors.labelSecondary,
    fontWeight: "500",
  },
  period: {
    fontSize: 11,
    fontWeight: "500",
  },
  rule: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: theme.colors.fillTertiary,
  },
});
