import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { initialsOf } from "@/lib/attendance";
import theme from "@/theme";

type Props = {
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  /**
   * Drawn over the initials, which still show if the photo can't load. A list
   * is tried in order, moving to the next URL whenever one fails.
   */
  imageUrl?: string | string[] | null;
};

/**
 * Initials in a soft brand-blue circle. One tint everywhere, so lists of
 * people read calmly instead of as a rainbow. A photo replaces the initials
 * once it loads; if it's missing or fails, the initials stay.
 */
export default function Avatar({
  firstName,
  lastName,
  size = 40,
  imageUrl,
}: Props) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  const candidates = Array.isArray(imageUrl)
    ? imageUrl
    : imageUrl
      ? [imageUrl]
      : [];
  const uri = candidates.find((url) => !failedUrls.includes(url));

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
        {initialsOf({ firstName, lastName })}
      </Text>
      {uri ? (
        <Image
          key={uri}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          onError={() => setFailedUrls((failed) => [...failed, uri])}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: theme.colors.primaryIceBlue,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: {
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.primaryDarkBlue,
  },
});
