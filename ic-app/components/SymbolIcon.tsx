import { Ionicons } from "@expo/vector-icons";
import { SymbolView, type SymbolViewProps, type SymbolWeight } from "expo-symbols";
import type { ComponentProps } from "react";
import {
  Platform,
  type ColorValue,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

type Props = {
  /** SF Symbol name, used on iOS. */
  name: SymbolViewProps["name"];
  /** Ionicons name, used on Android and web. */
  fallback: ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color: ColorValue;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
};

/**
 * Renders an SF Symbol on iOS and the closest Ionicon elsewhere.
 */
export default function SymbolIcon({
  name,
  fallback,
  size = 24,
  color,
  weight = "regular",
  style,
}: Props) {
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={name}
        weight={weight}
        tintColor={color}
        resizeMode="scaleAspectFit"
        style={[{ width: size, height: size }, style]}
      />
    );
  }

  return (
    <Ionicons
      name={fallback}
      size={size}
      color={color}
      style={style as StyleProp<TextStyle>}
    />
  );
}
