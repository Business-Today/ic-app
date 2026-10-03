import Button from "@/components/Button";
import Card from "@/components/Card";
import { formatTagId, getNfcStatus, openNfcSettings, readTagOnce, type NfcStatus } from "@/lib/nfc";
import {
  assignTagToAttendee,
  findAttendeeByTag,
  searchAttendees,
  unassignTagFromAttendee,
  type TaggedAttendee,
} from "@/lib/nfcTags";
import theme from "@/theme";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Platform, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";

/**
 * Admin screen: link a physical NFC tag to an attendee.
 *
 * Two ways in:
 *  1. From the attendance tab with no tag: search for the attendee, select
 *     them, then tap the tag you are handing them.
 *  2. From the NFC check-in screen with a `tagId` param (an unassigned tag
 *     was tapped): search for the attendee and tap their name to link it.
 */
export default function AssignNfcTag() {
  const params = useLocalSearchParams<{ tagId?: string }>();
  const prefilledTagId =
    typeof params.tagId === "string" && params.tagId.length > 0 ? params.tagId : null;

  const [pendingTagId, setPendingTagId] = useState<string | null>(prefilledTagId);
  const [nfcStatus, setNfcStatus] = useState<NfcStatus | "checking">("checking");
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<TaggedAttendee[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TaggedAttendee | null>(null);
  const [waitingForTap, setWaitingForTap] = useState(false);
  const [saving, setSaving] = useState(false);

  const cancelReadRef = useRef<() => void>(() => {});

  useEffect(() => {
    let mounted = true;
    void getNfcStatus().then((status) => {
      if (mounted) setNfcStatus(status);
    });
    return () => {
      mounted = false;
      cancelReadRef.current();
    };
  }, []);

  const runSearch = useCallback(async () => {
    setSearching(true);
    const { attendees, error } = await searchAttendees(searchText);
    setSearching(false);

    if (error) {
      Alert.alert("Search failed", error);
      return;
    }

    setResults(attendees);
  }, [searchText]);

  const refreshSelected = useCallback(async (email: string) => {
    const { attendees } = await searchAttendees(email);
    const updated = attendees.find((attendee) => attendee.email === email) ?? null;
    setSelected(updated);
    setResults((previous) =>
      previous.map((attendee) => (attendee.email === email && updated ? updated : attendee))
    );
  }, []);

  const commitAssignment = useCallback(
    async (tagId: string, attendee: TaggedAttendee) => {
      setSaving(true);
      const { error } = await assignTagToAttendee(tagId, attendee.email);
      setSaving(false);

      if (error) {
        Alert.alert("Could not assign tag", error);
        return false;
      }

      Toast.show({
        type: "success",
        text1: `Tag linked to ${attendee.firstName} ${attendee.lastName}`,
        position: "bottom",
        visibilityTime: 1500,
      });

      setPendingTagId(null);
      await refreshSelected(attendee.email);
      return true;
    },
    [refreshSelected]
  );

  /**
   * Checks who (if anyone) already holds the tag and asks before moving it.
   */
  const assignWithConfirmation = useCallback(
    async (tagId: string, attendee: TaggedAttendee) => {
      const { attendee: currentOwner, error } = await findAttendeeByTag(tagId);

      if (error) {
        Alert.alert("Could not check tag", error);
        return;
      }

      const confirmAndAssign = (message: string) =>
        new Promise<void>((resolve) => {
          Alert.alert("Reassign tag?", message, [
            { text: "Cancel", style: "cancel", onPress: () => resolve() },
            {
              text: "Reassign",
              style: "destructive",
              onPress: async () => {
                await commitAssignment(tagId, attendee);
                resolve();
              },
            },
          ]);
        });

      if (currentOwner && currentOwner.email === attendee.email) {
        Toast.show({
          type: "info",
          text1: `${attendee.firstName} already has this tag`,
          position: "bottom",
          visibilityTime: 1500,
        });
        setPendingTagId(null);
        return;
      }

      if (currentOwner) {
        await confirmAndAssign(
          `Tag ${formatTagId(tagId)} currently belongs to ${currentOwner.firstName} ${currentOwner.lastName}. Move it to ${attendee.firstName} ${attendee.lastName}?`
        );
        return;
      }

      if (attendee.nfcTagId && attendee.nfcTagId !== tagId) {
        await confirmAndAssign(
          `${attendee.firstName} ${attendee.lastName} already has tag ${formatTagId(attendee.nfcTagId)}. Replace it with ${formatTagId(tagId)}?`
        );
        return;
      }

      await commitAssignment(tagId, attendee);
    },
    [commitAssignment]
  );

  const tapTagFor = useCallback(
    async (attendee: TaggedAttendee) => {
      if (nfcStatus !== "ready") {
        Alert.alert(
          "NFC not available",
          nfcStatus === "disabled"
            ? "Turn NFC on in the phone settings first."
            : "This device or build does not support NFC."
        );
        return;
      }

      setWaitingForTap(true);
      const reader = readTagOnce(
        `Hold the tag for ${attendee.firstName} ${attendee.lastName} to the phone`
      );
      cancelReadRef.current = reader.cancel;

      try {
        const tagId = await reader.promise;
        if (!tagId) return;
        await assignWithConfirmation(tagId, attendee);
      } catch (error) {
        console.warn("Tag read failed:", error);
        Alert.alert("Could not read tag", "Try holding the tag still against the phone.");
      } finally {
        cancelReadRef.current = () => {};
        setWaitingForTap(false);
      }
    },
    [assignWithConfirmation, nfcStatus]
  );

  const lookupTag = useCallback(async () => {
    if (nfcStatus !== "ready") return;

    setWaitingForTap(true);
    const reader = readTagOnce("Hold a tag to the phone to see who it belongs to");
    cancelReadRef.current = reader.cancel;

    try {
      const tagId = await reader.promise;
      if (!tagId) return;

      const { attendee, error } = await findAttendeeByTag(tagId);
      if (error) {
        Alert.alert("Lookup failed", error);
        return;
      }

      if (attendee) {
        Alert.alert(
          "Tag owner",
          `${formatTagId(tagId)} belongs to ${attendee.firstName} ${attendee.lastName} (${attendee.email}).`
        );
        setSelected(attendee);
      } else {
        Alert.alert(
          "Unassigned tag",
          `${formatTagId(tagId)} is not linked to anyone. Search for an attendee and tap their name to assign it.`
        );
        setPendingTagId(tagId);
        setSelected(null);
      }
    } catch (error) {
      console.warn("Tag read failed:", error);
      Alert.alert("Could not read tag", "Try holding the tag still against the phone.");
    } finally {
      cancelReadRef.current = () => {};
      setWaitingForTap(false);
    }
  }, [nfcStatus]);

  const removeTag = useCallback(
    (attendee: TaggedAttendee) => {
      Alert.alert(
        "Remove tag?",
        `${attendee.firstName} ${attendee.lastName} will no longer be able to check in with tag ${formatTagId(attendee.nfcTagId ?? "")}.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setSaving(true);
              const { error } = await unassignTagFromAttendee(attendee.email);
              setSaving(false);

              if (error) {
                Alert.alert("Could not remove tag", error);
                return;
              }

              Toast.show({
                type: "success",
                text1: "Tag removed",
                position: "bottom",
                visibilityTime: 1500,
              });
              await refreshSelected(attendee.email);
            },
          },
        ]
      );
    },
    [refreshSelected]
  );

  const busy = waitingForTap || saving;

  const nfcBanner = (() => {
    if (nfcStatus === "ready" || nfcStatus === "checking") return null;

    return (
      <Card>
        <Text style={[theme.typography.sectionTitle, { color: "#B91C1C", marginBottom: 6 }]}>
          {nfcStatus === "disabled" ? "NFC is turned off" : "NFC not available"}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray }]}>
          {nfcStatus === "disabled"
            ? "Turn NFC on in the phone settings to tap tags."
            : "This device or build does not support NFC. If you are in Expo Go, install the latest development build."}
        </Text>
        {nfcStatus === "disabled" && (
          <Button title="Open NFC settings" variant="secondary" onPress={() => void openNfcSettings()} />
        )}
      </Card>
    );
  })();

  const header = (
    <>
      <Text
        style={[
          theme.typography.title,
          { color: theme.colors.primaryBlue, textAlign: "center", marginBottom: 8 },
        ]}
      >
        Assign NFC tags
      </Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.primaryDarkGray, textAlign: "center", marginBottom: 16 },
        ]}
      >
        {pendingTagId
          ? `Tag ${formatTagId(pendingTagId)} is ready to assign. Search for the attendee and tap their name.`
          : "Search for an attendee, select them, then tap the tag you are giving them."}
      </Text>

      {nfcBanner}

      {pendingTagId && (
        <Button
          title="Forget this tag"
          variant="secondary"
          onPress={() => setPendingTagId(null)}
        />
      )}

      {selected && (
        <Card>
          <Text style={[theme.typography.sectionTitle, { color: theme.colors.primaryDarkBlue }]}>
            {selected.firstName} {selected.lastName}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray, marginBottom: 8 }]}>
            {selected.email}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray }]}>
            {selected.nfcTagId
              ? `Current tag: ${formatTagId(selected.nfcTagId)}`
              : "No tag assigned yet"}
          </Text>

          {pendingTagId ? (
            <Button
              title={`Assign tag ${formatTagId(pendingTagId)}`}
              disabled={busy}
              onPress={() => void assignWithConfirmation(pendingTagId, selected)}
            />
          ) : (
            <Button
              title={
                waitingForTap
                  ? Platform.OS === "ios"
                    ? "Waiting for tap…"
                    : "Hold the tag to the phone…"
                  : selected.nfcTagId
                    ? "Tap a different tag to replace"
                    : "Tap tag to assign"
              }
              disabled={busy}
              onPress={() => void tapTagFor(selected)}
            />
          )}

          {waitingForTap && Platform.OS === "android" && (
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => cancelReadRef.current()}
            />
          )}

          {selected.nfcTagId && !waitingForTap && (
            <Button
              title="Remove tag"
              variant="secondary"
              disabled={busy}
              onPress={() => removeTag(selected)}
            />
          )}
        </Card>
      )}

      <TextInput
        placeholder="Search by name or email..."
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={() => void runSearch()}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#999"
        style={{
          backgroundColor: "#fff",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#ccc",
          marginTop: 8,
          fontSize: 16,
        }}
      />
      <Button
        title={searching ? "Searching…" : "Search"}
        variant="secondary"
        disabled={searching}
        onPress={() => void runSearch()}
      />
      {!pendingTagId && (
        <Button
          title="Who owns this tag? (tap to look up)"
          variant="secondary"
          disabled={busy || nfcStatus !== "ready"}
          onPress={() => void lookupTag()}
        />
      )}
      <View style={{ height: 12 }} />
    </>
  );

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.email}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <Button
          title={`${item.firstName} ${item.lastName} (${item.email})${item.nfcTagId ? "  •  has tag" : ""}`}
          variant="secondary"
          selected={selected?.email === item.email}
          disabled={busy}
          onPress={() => {
            setSelected(item);
            if (pendingTagId) {
              void assignWithConfirmation(pendingTagId, item);
            }
          }}
        />
      )}
      ListEmptyComponent={
        searchText && !searching ? (
          <Text style={[theme.typography.body, { color: theme.colors.primaryDarkGray, textAlign: "center" }]}>
            Press Search to find attendees.
          </Text>
        ) : null
      }
    />
  );
}
