import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { initialsOf } from "@/lib/attendance";
import theme from "@/theme";

type Props = {
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  imageUrl?: string | null;
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
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const photoLoaded = Boolean(imageUrl) && loadedUrl === imageUrl;

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {photoLoaded ? null : (
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
          {initialsOf({ firstName, lastName })}
        </Text>
      )}
      {imageUrl ? (
        <Image
          source={imageUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onLoad={() => setLoadedUrl(imageUrl)}
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
