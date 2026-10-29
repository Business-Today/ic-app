import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import concourse from "@/assets/maps/concourse.svg";
import fourth from "@/assets/maps/fourth.svg";
import third from "@/assets/maps/third.svg";
import ZoomableMap from "@/components/ZoomableMap";
import theme from "@/theme";

const MAPS = [
  { id: "concourse", label: "Concourse", Component: concourse },
  { id: "fourth", label: "Floor 4", Component: fourth },
  { id: "third", label: "Floor 3", Component: third },
] as const;

export default function ConferenceMap() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedMap = MAPS[selectedIndex];
  const MapComponent = selectedMap.Component;

  return (
    <View style={styles.container}>
      <View style={styles.selector}>
        {MAPS.map((map, index) => {
          const selected = index === selectedIndex;

          return (
            <Pressable
              key={map.id}
              onPress={() => setSelectedIndex(index)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.selectorButton,
                selected && styles.selectorButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.selectorText,
                  selected && styles.selectorTextSelected,
                ]}
              >
                {map.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ZoomableMap key={selectedMap.id}>
        <MapComponent
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          accessibilityLabel={selectedMap.label}
        />
      </ZoomableMap>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
  selector: {
    flexDirection: "row",
    backgroundColor: theme.colors.gray100,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  selectorButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorButtonSelected: {
    backgroundColor: theme.colors.primaryBlue,
  },
  selectorText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  selectorTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  mapFrame: {
    width: "100%",
    height: 420,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: theme.colors.gray100,
  },
  pressed: {
    opacity: 0.7,
  },
});