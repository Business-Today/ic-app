import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";

import SymbolIcon from "@/components/SymbolIcon";
import { useUser } from "@/contexts/UserContext";
import {
  BT_LINKS,
  countSessionsAttended,
  fetchSignedInProfile,
} from "@/lib/conference";
import { fetchNetworkEmails } from "@/lib/network";
import theme from "@/theme";

const NAVY = "#2B5079";
const BLUE = "#3D89BC";
const LIGHT_BLUE = "#53B0D4";
const SERIF = Platform.select({ ios: "Georgia", default: "serif" });

/** The conference's "Thank you" mark: a navy seal between blue bars and arcs. */
function ThankYouEmblem() {
  return (
    <Svg width={260} height={170} viewBox="0 0 260 170">
      {/* Bars running out from behind the seal */}
      <Rect x={6} y={44} width={86} height={9} rx={4.5} fill={LIGHT_BLUE} />
      <Rect x={26} y={66} width={66} height={9} rx={4.5} fill={BLUE} />
      <Rect x={14} y={96} width={78} height={9} rx={4.5} fill={BLUE} />
      <Rect x={36} y={118} width={56} height={9} rx={4.5} fill={LIGHT_BLUE} />
      <Rect x={168} y={44} width={56} height={9} rx={4.5} fill={LIGHT_BLUE} />
      <Rect x={168} y={66} width={82} height={9} rx={4.5} fill={BLUE} />
      <Rect x={168} y={96} width={64} height={9} rx={4.5} fill={BLUE} />
      <Rect x={168} y={118} width={86} height={9} rx={4.5} fill={LIGHT_BLUE} />

      {/* Two arcs hugging the seal */}
      <Path
        d="M 72 70 A 60 60 0 0 1 145 27"
        stroke={LIGHT_BLUE}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 188 100 A 60 60 0 0 1 115 143"
        stroke={BLUE}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />

      <Circle cx={130} cy={85} r={50} fill={NAVY} />
      <SvgText
        x={130}
        y={80}
        fill="#FFFFFF"
        fontSize={24}
        fontFamily={SERIF}
        textAnchor="middle"
      >
        Thank
      </SvgText>
      <SvgText
        x={130}
        y={106}
        fill="#FFFFFF"
        fontSize={24}
        fontFamily={SERIF}
        fontStyle="italic"
        textAnchor="middle"
      >
        you
      </SvgText>
    </Svg>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? "–"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const LOGOS = {
  linkedin: require("@/assets/images/linkedin.png"),
  instagram: require("@/assets/images/instagram.png"),
};

export default function ThankYou() {
  const router = useRouter();
  const { user } = useUser();

  const [firstName, setFirstName] = useState(user?.firstName ?? null);
  const [sessions, setSessions] = useState<number | null>(null);
  const [connections, setConnections] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;

    async function load() {
      // The Home tab normally loads the profile; after the conference the app
      // opens straight here, so look it up if it isn't loaded yet.
      const profile = user?.email
        ? { email: user.email, firstName: user.firstName }
        : await fetchSignedInProfile();
      if (!isActive || !profile) return;

      setFirstName(profile.firstName);

      const [attended, network] = await Promise.all([
        countSessionsAttended(profile.email),
        fetchNetworkEmails(profile.email),
      ]);
      if (!isActive) return;

      setSessions(attended);
      setConnections(network.error ? null : network.emails.length);
    }

    void load();
    return () => {
      isActive = false;
    };
  }, [user?.email, user?.firstName]);

  const name = firstName?.trim();
  const singular = (count: number | null, word: string) =>
    count === 1 ? word : `${word}s`;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emblem}>
          <ThankYouEmblem />
        </View>

        <Text style={styles.headline}>
          Thank you{name ? `, ${name},` : ""} for attending
        </Text>
        <Text style={styles.subtitle}>
          the Business Today International Conference 2026
        </Text>

        <View style={styles.stats}>
          <Stat value={sessions} label={`${singular(sessions, "session")} attended`} />
          <Stat
            value={connections}
            label={`new ${singular(connections, "connection")}`}
          />
        </View>

        <Text style={styles.sectionLabel}>STAY IN TOUCH</Text>
        <View style={styles.links}>
          <Pressable
            onPress={() => void Linking.openURL(BT_LINKS.linkedin)}
            accessibilityRole="link"
            accessibilityLabel="Business Today on LinkedIn"
            hitSlop={6}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Image source={LOGOS.linkedin} style={styles.logo} />
          </Pressable>
          <Pressable
            onPress={() => void Linking.openURL(BT_LINKS.instagram)}
            accessibilityRole="link"
            accessibilityLabel="Business Today on Instagram"
            hitSlop={6}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Image source={LOGOS.instagram} style={styles.logo} />
          </Pressable>
          <Pressable
            onPress={() => void Linking.openURL(BT_LINKS.website)}
            accessibilityRole="link"
            accessibilityLabel="Business Today website"
            hitSlop={6}
            style={({ pressed }) => [styles.webLogo, pressed && styles.pressed]}
          >
            <SymbolIcon
              name="globe"
              fallback="globe-outline"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push("/connections")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>View your connections</Text>
        </Pressable>
        <Text style={styles.footnote}>See you next year</Text>
      </View>
    </SafeAreaView>
  );
}

const LOGO_SIZE = 40;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: "center",
  },
  emblem: {
    marginBottom: 28,
  },
  headline: {
    fontFamily: SERIF,
    fontSize: 28,
    lineHeight: 34,
    color: NAVY,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  stats: {
    flexDirection: "row",
    gap: 12,
    alignSelf: "stretch",
    marginTop: 28,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.fillSecondary,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: NAVY,
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.labelSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: theme.colors.labelSecondary,
    marginTop: 32,
  },
  links: {
    flexDirection: "row",
    gap: 20,
    marginTop: 14,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 10,
  },
  webLogo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryBlue,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    alignItems: "center",
  },
  button: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: NAVY,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  footnote: {
    fontSize: 14,
    color: theme.colors.labelSecondary,
    marginTop: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
