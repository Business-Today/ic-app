import { Image, Pressable, StyleSheet, View } from "react-native";

import { openProfileLink, type SocialNetwork } from "@/lib/network";

const LOGOS = {
  LinkedIn: require("@/assets/images/linkedin.png"),
  Instagram: require("@/assets/images/instagram.png"),
};

type Props = {
  linkedin?: string | null;
  instagram?: string | null;
};

/** Tappable LinkedIn / Instagram logos; renders nothing when neither is set. */
export default function SocialLinks({ linkedin, instagram }: Props) {
  const links = (
    [
      ["LinkedIn", linkedin?.trim()],
      ["Instagram", instagram?.trim()],
    ] as [SocialNetwork, string | undefined][]
  ).filter((link): link is [SocialNetwork, string] => Boolean(link[1]));

  if (links.length === 0) return null;

  return (
    <View style={styles.row}>
      {links.map(([network, username]) => (
        <Pressable
          key={network}
          onPress={() => void openProfileLink(username, network)}
          accessibilityRole="link"
          accessibilityLabel={`Open ${network}`}
          hitSlop={6}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Image source={LOGOS[network]} style={styles.logo} />
        </Pressable>
      ))}
    </View>
  );
}

const LOGO_SIZE = 32;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 14,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.7,
  },
});
