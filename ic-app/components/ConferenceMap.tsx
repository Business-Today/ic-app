import { useState } from "react";
import { StyleSheet, View } from "react-native";

import concourse from "@/assets/maps/concourse.svg";
import fourth from "@/assets/maps/fourth.svg";
import third from "@/assets/maps/third.svg";
import SegmentedTabs from "@/components/SegmentedTabs";
import ZoomableMap from "@/components/ZoomableMap";
import type { FloorKey, MapRect, MapRoom } from "@/constants/mapRooms";

// viewBox is set from here, overriding the svg's own, so a floor's drawing and
// the room highlights placed on it can't disagree.
const MAPS: {
  key: FloorKey;
  label: string;
  Component: typeof concourse;
  viewBox: MapRect;
}[] = [
  {
    key: "concourse",
    label: "Concourse",
    Component: concourse,
    viewBox: { x: 160, y: 150, width: 1400, height: 790 },
  },
  {
    key: "third",
    label: "Floor 3",
    Component: third,
    viewBox: { x: 35, y: 100, width: 1255, height: 550 },
  },
  {
    key: "fourth",
    label: "Floor 4",
    Component: fourth,
    viewBox: { x: 30, y: 125, width: 1430, height: 725 },
  },
];

const FLOOR_TABS = MAPS.map(({ key, label }) => ({ key, label }));

type ConferenceMapProps = {
  /** Room to open on, zoomed in and highlighted. */
  focusRoom?: MapRoom | null;
};

export default function ConferenceMap({ focusRoom }: ConferenceMapProps) {
  const [selectedKey, setSelectedKey] = useState<FloorKey>(
    focusRoom?.floor ?? "concourse"
  );

  const selectedMap =
    MAPS.find((map) => map.key === selectedKey) ?? MAPS[0];
  const MapComponent = selectedMap.Component;
  const { x, y, width, height } = selectedMap.viewBox;

  return (
    <View style={styles.container}>
      <ZoomableMap
        key={selectedMap.key}
        viewBox={selectedMap.viewBox}
        focus={focusRoom?.floor === selectedKey ? focusRoom.rect : null}
      >
        <MapComponent
          width="100%"
          height="100%"
          viewBox={`${x} ${y} ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          accessibilityLabel={`${selectedMap.label} map`}
        />
      </ZoomableMap>

      <SegmentedTabs
        tabs={FLOOR_TABS}
        value={selectedKey}
        onChange={setSelectedKey}
        centered
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
});
