import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/components/Avatar";
import HeaderBackButton from "@/components/HeaderBackButton";
import ListRow, { ListGroup } from "@/components/ListRow";
import SectionLabel from "@/components/SectionLabel";
import TimeBlock from "@/components/TimeBlock";
import {
  DAY_KEYS,
  buildSpeakerMap,
  dayLabelsFor,
  fetchSessions,
  fetchSpeakers,
  fullName,
  normalizeEmail,
  parseEmails,
  sessionDetailLine,
  type Session,
  type Speaker,
} from "@/lib/attendance";
import theme from "@/theme";

export default function AttendeeDetail() {
  const params = useLocalSearchParams<{
    email?: string;
    firstName?: string;
    lastName?: string;
  }>();

  const email = typeof params.email === "string" ? params.email : "";
  const person = {
    firstName: typeof params.firstName === "string" ? params.firstName : "",
    lastName: typeof params.lastName === "string" ? params.lastName : "",
  };

  const [sessions, setSessions] = useState<Session[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const [sessionRows, speakerRows] = await Promise.all([
        fetchSessions(),
        fetchSpeakers(),
      ]);

      if (!active) return;

      setSessions(sessionRows);
      setSpeakers(speakerRows);
      setLoaded(true);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const speakerMap = useMemo(() => buildSpeakerMap(speakers), [speakers]);
  const dayLabels = useMemo(() => dayLabelsFor(sessions), [sessions]);

  const checkedIn = useMemo(() => {
    const target = normalizeEmail(email);

    return sessions.filter((session) =>
      parseEmails(session.emails).includes(target),
    );
  }, [sessions, email]);

  const days = DAY_KEYS.map((key) => ({
    key,
    label: dayLabels[key],
    sessions: checkedIn.filter((session) => session.day === key),
  })).filter((day) => day.sessions.length > 0);

  const name = fullName(person) || email;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HeaderBackButton />

        <View style={styles.hero}>
          <Avatar
            firstName={person.firstName}
            lastName={person.lastName}
            size={72}
          />
          <Text style={styles.name}>{name}</Text>
          {fullName(person) ? <Text style={styles.email}>{email}</Text> : null}
        </View>

        {!loaded ? null : checkedIn.length === 0 ? (
          <Text style={styles.emptyText}>No check-ins yet.</Text>
        ) : (
          <>
            <Text style={styles.summary}>
              Checked into {checkedIn.length}{" "}
              {checkedIn.length === 1 ? "session" : "sessions"}
            </Text>

            {days.map((day) => (
              <View key={day.key}>
                <SectionLabel>{day.label}</SectionLabel>
                <ListGroup>
                  {day.sessions.map((session, index) => (
                    <ListRow
                      key={session.optionID}
                      title={session.title}
                      titleLines={2}
                      subtitle={sessionDetailLine(session, speakerMap)}
                      leading={
                        <TimeBlock
                          startTime={session.startTime}
                          endTime={session.endTime}
                        />
                      }
                      trailing={null}
                      divider={index < day.sessions.length - 1}
                    />
                  ))}
                </ListGroup>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
  hero: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
    marginTop: 16,
    textAlign: "center",
  },
  email: {
    fontSize: 16,
    color: theme.colors.labelSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  summary: {
    fontSize: 15,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingTop: 32,
    paddingHorizontal: 24,
  },
});
