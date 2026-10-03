import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import Avatar from "@/components/Avatar";
import ListRow, { ListGroup } from "@/components/ListRow";
import PageHeader from "@/components/PageHeader";
import SearchField from "@/components/SearchField";
import SectionLabel from "@/components/SectionLabel";
import SymbolIcon from "@/components/SymbolIcon";
import { useAttendeeSearch } from "@/hooks/useAttendeeSearch";
import { fullName, hapticFor } from "@/lib/attendance";
import {
  formatTagId,
  getNfcStatus,
  openNfcSettings,
  readTagOnce,
  type NfcStatus,
} from "@/lib/nfc";
import {
  assignTagToAttendee,
  fetchAttendeeWithTag,
  findAttendeeByTag,
  searchAttendeesWithTags,
  unassignTagFromAttendee,
  type TaggedAttendee,
} from "@/lib/nfcTags";
import theme from "@/theme";

async function searchTagged(term: string) {
  const { attendees, error } = await searchAttendeesWithTags(term);

  if (error) {
    Alert.alert("Search failed", error);
  }

  return attendees;
}

/**
 * Link a physical NFC tag to an attendee.
 *
 * Two ways in: from the Attendance hub with no tag (pick the attendee, then
 * tap the tag you are handing them), or from the NFC reader with a `tagId`
 * param after an unassigned tag was tapped (pick who it belongs to).
 */
export default function AssignNfcTag() {
  const params = useLocalSearchParams<{ tagId?: string }>();
  const prefilledTagId =
    typeof params.tagId === "string" && params.tagId ? params.tagId : null;

  const [pendingTagId, setPendingTagId] = useState<string | null>(prefilledTagId);
  const [nfcStatus, setNfcStatus] = useState<NfcStatus | "checking">("checking");
  const [query, setQuery] = useState("");
  const { results, searching, updateResults } = useAttendeeSearch(
    query,
    searchTagged
  );
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

  const refreshSelected = useCallback(
    async (email: string) => {
      const updated = await fetchAttendeeWithTag(email);

      setSelected(updated);
      updateResults((rows) =>
        rows.map((attendee) =>
          attendee.email === email && updated ? updated : attendee
        )
      );
    },
    [updateResults]
  );

  const commitAssignment = useCallback(
    async (tagId: string, attendee: TaggedAttendee) => {
      setSaving(true);
      const { error } = await assignTagToAttendee(tagId, attendee.email);
      setSaving(false);

      if (error) {
        hapticFor("failed");
        Alert.alert("Could not link tag", error);
        return;
      }

      hapticFor("success");
      Toast.show({
        type: "success",
        text1: `Tag linked to ${fullName(attendee)}`,
        position: "bottom",
        visibilityTime: 1500,
      });

      setPendingTagId(null);
      await refreshSelected(attendee.email);
    },
    [refreshSelected]
  );

  /** Checks who already holds the tag and asks before moving it. */
  const assignWithConfirmation = useCallback(
    async (tagId: string, attendee: TaggedAttendee) => {
      const { attendee: currentOwner, error } = await findAttendeeByTag(tagId);

      if (error) {
        Alert.alert("Could not check tag", error);
        return;
      }

      if (currentOwner && currentOwner.email === attendee.email) {
        Toast.show({
          type: "info",
          text1: `${fullName(attendee)} already has this tag`,
          position: "bottom",
          visibilityTime: 1500,
        });
        setPendingTagId(null);
        return;
      }

      const confirm = (message: string) =>
        Alert.alert("Move this tag?", message, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Move",
            style: "destructive",
            onPress: () => void commitAssignment(tagId, attendee),
          },
        ]);

      if (currentOwner) {
        confirm(
          `${formatTagId(tagId)} belongs to ${fullName(currentOwner)}. Move it to ${fullName(attendee)}?`
        );
        return;
      }

      if (attendee.nfcTagId && attendee.nfcTagId !== tagId) {
        confirm(
          `${fullName(attendee)} already has ${formatTagId(attendee.nfcTagId)}. Replace it with ${formatTagId(tagId)}?`
        );
        return;
      }

      await commitAssignment(tagId, attendee);
    },
    [commitAssignment]
  );

  function requireNfc() {
    if (nfcStatus === "ready") return true;

    Alert.alert(
      "NFC not available",
      nfcStatus === "disabled"
        ? "Turn NFC on in the phone settings first."
        : "This device or build cannot read tags."
    );
    return false;
  }

  async function readTag(prompt: string): Promise<string | null> {
    setWaitingForTap(true);
    const reader = readTagOnce(prompt);
    cancelReadRef.current = reader.cancel;

    try {
      return await reader.promise;
    } catch (error) {
      console.warn("Tag read failed:", error);
      Alert.alert("Could not read tag", "Hold the tag still against the phone and try again.");
      return null;
    } finally {
      cancelReadRef.current = () => {};
      setWaitingForTap(false);
    }
  }

  async function tapTagFor(attendee: TaggedAttendee) {
    if (!requireNfc()) return;

    const tagId = await readTag(
      `Hold the tag for ${fullName(attendee)} to the phone`
    );

    if (tagId) {
      await assignWithConfirmation(tagId, attendee);
    }
  }

  async function identifyTag() {
    if (!requireNfc()) return;

    const tagId = await readTag("Hold a tag to the phone to see who holds it");
    if (!tagId) return;

    const { attendee, error } = await findAttendeeByTag(tagId);

    if (error) {
      Alert.alert("Lookup failed", error);
      return;
    }

    if (attendee) {
      setSelected(attendee);
      setPendingTagId(null);
      Toast.show({
        type: "info",
        text1: `${formatTagId(tagId)} belongs to ${fullName(attendee)}`,
        position: "bottom",
        visibilityTime: 2000,
      });
      return;
    }

    setSelected(null);
    setPendingTagId(tagId);
  }

  function removeTag(attendee: TaggedAttendee) {
    Alert.alert(
      "Remove tag?",
      `${fullName(attendee)} will no longer be able to check in with ${formatTagId(attendee.nfcTagId ?? "")}.`,
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
  }

  const busy = waitingForTap || saving;
  const rows = results ?? [];

  const header = (
    <>
      <PageHeader
        title="NFC Tags"
        subtitle="Link a tag to each attendee so they can check in with a tap."
      />

      {nfcStatus === "unavailable" || nfcStatus === "disabled" ? (
        <View style={styles.notice}>
          <SymbolIcon
            name="exclamationmark.circle.fill"
            fallback="alert-circle"
            size={22}
            color={theme.colors.destructive}
          />
          <View style={styles.noticeText}>
            <Text style={styles.noticeTitle}>
              {nfcStatus === "disabled" ? "NFC is off" : "NFC not available"}
            </Text>
            <Text style={styles.noticeBody}>
              {nfcStatus === "disabled"
                ? "Turn NFC on in the phone settings to tap tags."
                : "This device or build cannot read tags. Tag records can still be viewed and removed."}
            </Text>
          </View>
          {nfcStatus === "disabled" && Platform.OS === "android" ? (
            <Pressable
              onPress={() => void openNfcSettings()}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.noticeAction}>Settings</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {pendingTagId ? (
        <View style={styles.block}>
          <ListGroup>
            <ListRow
              title={`Tag ${formatTagId(pendingTagId)}`}
              subtitle="Choose the attendee below to link it"
              leading={
                <View style={styles.tagBadge}>
                  <SymbolIcon
                    name="tag"
                    fallback="pricetag-outline"
                    size={18}
                    weight="medium"
                    color={theme.colors.primaryBlue}
                  />
                </View>
              }
              trailing={
                <Pressable
                  onPress={() => setPendingTagId(null)}
                  hitSlop={10}
                  accessibilityRole="button"
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.forgetText}>Forget</Text>
                </Pressable>
              }
            />
          </ListGroup>
        </View>
      ) : null}

      {selected ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedRow}>
            <Avatar
              firstName={selected.firstName}
              lastName={selected.lastName}
              size={48}
            />
            <View style={styles.selectedText}>
              <Text style={styles.selectedName} numberOfLines={1}>
                {fullName(selected) || selected.email}
              </Text>
              <Text style={styles.selectedEmail} numberOfLines={1}>
                {selected.email}
              </Text>
            </View>
          </View>

          <View style={styles.selectedDivider} />

          <View style={styles.tagRow}>
            <Text style={styles.tagLabel}>Tag</Text>
            <Text
              style={[
                styles.tagValue,
                !selected.nfcTagId && styles.tagValueEmpty,
              ]}
            >
              {selected.nfcTagId ? formatTagId(selected.nfcTagId) : "None yet"}
            </Text>
          </View>

          <View style={styles.selectedActions}>
            {pendingTagId ? (
              <Pressable
                onPress={() => void assignWithConfirmation(pendingTagId, selected)}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  busy && styles.buttonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  Link {formatTagId(pendingTagId)}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void tapTagFor(selected)}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  busy && styles.buttonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {waitingForTap
                    ? "Waiting for a tap"
                    : selected.nfcTagId
                      ? "Tap a Different Tag"
                      : "Tap Tag to Link"}
                </Text>
              </Pressable>
            )}

            {waitingForTap && Platform.OS === "android" ? (
              <Pressable
                onPress={() => cancelReadRef.current()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            ) : null}

            {selected.nfcTagId && !waitingForTap ? (
              <Pressable
                onPress={() => removeTag(selected)}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.destructiveButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.destructiveText}>Remove Tag</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {!pendingTagId ? (
        <View style={styles.block}>
          <ListGroup>
            <ListRow
              title="Identify a tag"
              subtitle="Tap any tag to see who holds it"
              disabled={busy || nfcStatus !== "ready"}
              leading={
                <View style={styles.tagBadge}>
                  <SymbolIcon
                    name="tag"
                    fallback="pricetag-outline"
                    size={18}
                    weight="medium"
                    color={theme.colors.primaryBlue}
                  />
                </View>
              }
              onPress={() => void identifyTag()}
            />
          </ListGroup>
        </View>
      ) : null}

      <SectionLabel>Attendees</SectionLabel>
      <SearchField
        placeholder="Name or email"
        value={query}
        onChangeText={setQuery}
        autoFocus={!!prefilledTagId}
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
              disabled={busy}
              leading={
                <Avatar firstName={item.firstName} lastName={item.lastName} />
              }
              title={name || item.email}
              subtitle={name ? item.email : undefined}
              trailing={
                <View style={styles.rowTrailing}>
                  {item.nfcTagId ? (
                    <SymbolIcon
                      name="tag.fill"
                      fallback="pricetag"
                      size={14}
                      color={theme.colors.labelSecondary}
                    />
                  ) : null}
                  <SymbolIcon
                    name="chevron.right"
                    fallback="chevron-forward"
                    size={14}
                    weight="semibold"
                    color={theme.colors.labelTertiary}
                  />
                </View>
              }
              onPress={() => {
                setSelected(item);

                if (pendingTagId) {
                  void assignWithConfirmation(pendingTagId, item);
                }
              }}
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
  block: {
    marginBottom: 12,
  },
  listSpacer: {
    height: 20,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  noticeText: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: theme.colors.textPrimary,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.labelSecondary,
    marginTop: 2,
  },
  noticeAction: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.primaryBlue,
  },
  tagBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  forgetText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.labelSecondary,
  },
  selectedCard: {
    backgroundColor: theme.colors.fillSecondary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 12,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  selectedText: {
    flex: 1,
  },
  selectedName: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: theme.colors.textPrimary,
  },
  selectedEmail: {
    fontSize: 15,
    color: theme.colors.labelSecondary,
    marginTop: 2,
  },
  selectedDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(60,60,67,0.18)",
    marginVertical: 14,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tagLabel: {
    fontSize: 15,
    color: theme.colors.labelSecondary,
  },
  tagValue: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: theme.colors.textPrimary,
  },
  tagValueEmpty: {
    fontWeight: "400",
    color: theme.colors.labelTertiary,
  },
  selectedActions: {
    marginTop: 16,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: theme.colors.primaryBlue,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  secondaryButton: {
    backgroundColor: theme.colors.backgroundWhite,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: theme.colors.primaryBlue,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  destructiveButton: {
    alignItems: "center",
    paddingVertical: 6,
  },
  destructiveText: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.destructive,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  rowTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.labelSecondary,
    textAlign: "center",
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.7,
  },
});
