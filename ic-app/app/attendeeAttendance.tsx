import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/components/Avatar";
import ListRow from "@/components/ListRow";
import PageHeader from "@/components/PageHeader";
import SearchField from "@/components/SearchField";
import { useAttendeeSearch } from "@/hooks/useAttendeeSearch";
import { fullName, searchAttendees } from "@/lib/attendance";
import theme from "@/theme";

export default function AttendeeLookup() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { results, searching } = useAttendeeSearch(query, searchAttendees);

  const rows = results ?? [];

  const header = (
    <>
      <PageHeader
        title="Look Up Attendee"
        subtitle="See every session someone has checked into."
      />
      <SearchField
        placeholder="Name or email"
        value={query}
        onChangeText={setQuery}
        autoFocus
      />
      <View style={styles.listSpacer} />
    </>
  );

  const empty = (
    <Text style={styles.emptyText}>
      {results === null
        ? ""
        : searching
          ? "Searching"
          : `No attendees match "${query.trim()}".`}
    </Text>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.email}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const name = fullName(item);

          return (
            <ListRow
              first={index === 0}
              last={index === rows.length - 1}
              divider={index < rows.length - 1}
              leading={
                <Avatar firstName={item.firstName} lastName={item.lastName} />
              }
              title={name || item.email}
              subtitle={name ? item.email : undefined}
              onPress={() =>
                router.push({
                  pathname: "/attendeeDetail",
                  params: {
                    email: item.email,
                    firstName: item.firstName,
                    lastName: item.lastName,
                  },
                })
              }
            />
          );
        }}
      />
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
  listSpacer: {
    height: 20,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingTop: 12,
    paddingHorizontal: 24,
  },
});
