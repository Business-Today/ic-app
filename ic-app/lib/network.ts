import { normalizeEmail, parseEmails, type Attendee } from "@/lib/attendance";
import { supabase } from "@/lib/supabase";

/**
 * Each attendee's connections are stored as a comma-separated list of emails
 * in attendeeProfile.network.
 */

export type AddToNetworkResult = "added" | "already_added" | "error";

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
  attendees: Attendee[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("attendeeProfile")
    .select("firstName, lastName, email")
    .order("lastName", { ascending: true })
    .order("firstName", { ascending: true });

  if (error) {
    console.error("Could not load directory:", error);
    return { attendees: [], error: "Could not load the directory" };
  }

  return { attendees: (data ?? []) as Attendee[], error: null };
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
