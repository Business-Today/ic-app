import { Alert, Linking } from "react-native";

import { normalizeEmail, parseEmails, type Attendee } from "@/lib/attendance";
import { supabase } from "@/lib/supabase";

/**
 * Each attendee's connections are stored as a comma-separated list of emails
 * in attendeeProfile.network.
 */

export type AddToNetworkResult = "added" | "already_added" | "error";

export type DirectoryAttendee = Attendee & {
  school: string | null;
  major: string | null;
  interests: string | null;
  bio: string | null;
  linkedin: string | null;
  instagram: string | null;
  profilePictureUrl: string | null;
};

export function profileImageUrl(path: string | null | undefined) {
  if (!path) return null;

  return supabase.storage.from("profilePictures").getPublicUrl(path).data
    .publicUrl;
}

export type SocialNetwork = "LinkedIn" | "Instagram";

const SOCIAL_URL_PATTERNS: Record<SocialNetwork, RegExp> = {
  LinkedIn: /linkedin\.com\/in\/([^/?#\s]+)/i,
  Instagram: /instagram\.com\/([^/?#\s]+)/i,
};

/**
 * Profiles store just the username. Accepts a bare handle, "@handle" or a
 * pasted profile URL and returns the username part.
 */
export function socialUsername(raw: string, network: SocialNetwork) {
  const trimmed = raw.trim();
  const fromUrl = trimmed.match(SOCIAL_URL_PATTERNS[network])?.[1];

  return (fromUrl ?? trimmed).replace(/^@+/, "").replace(/[\s/]+/g, "");
}

export function socialUrl(username: string, network: SocialNetwork) {
  return network === "LinkedIn"
    ? `https://www.linkedin.com/in/${username}/`
    : `https://www.instagram.com/${username}/`;
}

export async function openProfileLink(rawUrl: string, label: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    Alert.alert("Invalid link", `This ${label} link cannot be opened.`);
    return;
  }

  const url =
    label === "LinkedIn" || label === "Instagram"
      ? socialUrl(socialUsername(trimmed, label), label)
      : trimmed;

  let normalizedUrl: string;
  try {
    const parsedUrl = new URL(
      url.startsWith("https://") || url.startsWith("http://")
        ? url
        : `https://${url}`
    );

    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      !/^[a-z0-9.-]+$/i.test(parsedUrl.hostname)
    ) {
      throw new Error("Profile link hostname is not a valid ASCII hostname.");
    }

    // Pass the parsed URL so Unicode hostnames are converted to their ASCII
    // representation before Android's intent resolver sees them.
    normalizedUrl = parsedUrl.toString();
  } catch (error) {
    console.error(`Could not parse ${label} link:`, error);
    Alert.alert("Invalid link", `This ${label} link cannot be opened.`);
    return;
  }

  let canOpen: boolean;
  try {
    canOpen = await Linking.canOpenURL(normalizedUrl);
  } catch (error) {
    console.error(`Could not check ${label} link:`, error);
    Alert.alert("Invalid link", `This ${label} link cannot be opened.`);
    return;
  }

  if (!canOpen) {
    Alert.alert("Invalid link", `This ${label} link cannot be opened.`);
    return;
  }

  try {
    await Linking.openURL(normalizedUrl);
  } catch (error) {
    console.error(`Could not open ${label} link:`, error);
    Alert.alert("Invalid link", `This ${label} link cannot be opened.`);
  }
}

export async function fetchNetworkEmails(
  rawEmail: string
): Promise<{ emails: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from("attendeeProfile")
    .select("network")
    .eq("email", normalizeEmail(rawEmail))
    .single();

  if (error) {
    console.error("Could not load network:", error);
    return { emails: [], error: "Could not load your network" };
  }

  return { emails: parseEmails(data?.network), error: null };
}

/** Everyone at the conference, by last name. */
export async function fetchDirectory(): Promise<{
  attendees: DirectoryAttendee[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("attendeeProfile")
    .select(
      "firstName, lastName, email, school, major, interests, bio, linkedin, instagram, profilePictureUrl"
    )
    .order("lastName", { ascending: true })
    .order("firstName", { ascending: true });

  if (error) {
    console.error("Could not load directory:", error);
    return { attendees: [], error: "Could not load the directory" };
  }

  return { attendees: (data ?? []) as DirectoryAttendee[], error: null };
}

async function appendToNetwork(
  owner: string,
  added: string
): Promise<AddToNetworkResult> {
  const { emails, error } = await fetchNetworkEmails(owner);

  if (error) return "error";
  if (emails.includes(added)) return "already_added";

  const { error: updateError } = await supabase
    .from("attendeeProfile")
    .update({ network: [...emails, added].join(",") })
    .eq("email", owner);

  if (updateError) {
    console.error("Could not update network:", updateError);
    return "error";
  }

  return "added";
}

/**
 * Adds `rawOther` to the signed-in attendee's network. `mutual` also adds them
 * to the other person's network, for in-person exchanges (QR and NFC). The
 * result describes the signed-in attendee's own list.
 */
export async function addToNetwork(
  rawMine: string,
  rawOther: string,
  { mutual }: { mutual: boolean }
): Promise<AddToNetworkResult> {
  const mine = normalizeEmail(rawMine);
  const other = normalizeEmail(rawOther);

  const result = await appendToNetwork(mine, other);

  if (result !== "error" && mutual) {
    await appendToNetwork(other, mine);
  }

  return result;
}
