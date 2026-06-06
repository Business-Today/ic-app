import { FlatList, Text } from "react-native";
import Card from "../../components/Card";
import theme from "../../theme";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";

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

export default function Networking() {
  const router = useRouter();
  return (
    <FlatList
      data={people}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <Text
          style={[
            theme.typography.biggestTitle,
            {
              color: theme.colors.primaryBlue,
              textAlign: "center",
              marginBottom: 16,
            },
          ]}
        >
          Network
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/profile/${item.id}`)}
        >
        <Card>
          <Text
            style={[
              theme.typography.sectionTitle,
              { color: theme.colors.primaryBlue, marginBottom: 8 },
            ]}
          >
            {item.firstName} {item.lastName}
          </Text>

          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.primaryDarkGray, marginBottom: 8 },
            ]}
          >
            {item.school}, {item.major}
          </Text>
        </Card>
        </Pressable>
      )}
    />
  );
}