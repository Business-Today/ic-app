import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";
import Button from "../../components/Button";


const people = [
  {
    id: "1",
    firstName: "Sophie",
    lastName: "Kim",
    school: "Princeton University",
    major: "SPIA",
    linkedin: "https://www.linkedin.com/in/sk0546/",
    instagram: "https://www.instagram.com/sophiekimsy/",
  },
  {
    id: "2",
    firstName: "Susan",
    lastName: "Chen",
    school: "Princeton University",
    major: "Economics",
    linkedin: "https://www.linkedin.com/in/susan-chen-839054311/",
    instagram: "https://www.instagram.com/susannchnn/",
  },
];

export default function Profile() {
  const { id } = useLocalSearchParams();
  const person = people.find(
    (p) => p.id === id
    );
  return (
    <View style={{ padding: 16 }}>
      <Text>
        {person?.firstName} {person?.lastName}
        </Text>

        <Text>
        {person?.school}
        </Text>

        <Text>
        {person?.major}
        </Text>
        <Button
        title="LinkedIn"
        onPress={() =>
            Linking.openURL(person?.linkedin ?? "")
        }
        />
        <Button
        title="Instagram"
        onPress={() =>
            Linking.openURL(person?.instagram ?? "")
        }
        />
    </View>
  );
}