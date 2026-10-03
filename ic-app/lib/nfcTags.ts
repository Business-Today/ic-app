import type { Attendee } from "@/lib/attendance";
import { supabase } from "@/lib/supabase";

/**
 * Tag UIDs live in attendeeProfile.nfcTagId. One tag maps to at most one
 * attendee, enforced by a unique index on that column.
 */

export type TaggedAttendee = Attendee & { nfcTagId: string | null };

const MISSING_COLUMN_CODE = "42703";

export function describeTagError(
  error: { code?: string; message?: string } | null
): string {
  if (error?.code === MISSING_COLUMN_CODE) {
    return "The database has no nfcTagId column yet. Run the NFC migration in Supabase.";
  }

  return error?.message || "Something went wrong";
}

export async function findAttendeeByTag(
  tagId: string
): Promise<{ attendee: TaggedAttendee | null; error: string | null }> {
  const { data, error } = await supabase
    .from("attendeeProfile")
    .select("email, firstName, lastName, nfcTagId")
    .eq("nfcTagId", tagId)
    .maybeSingle<TaggedAttendee>();

  if (error) {
    console.error("Could not look up NFC tag:", error);
    return { attendee: null, error: describeTagError(error) };
  }

  return { attendee: data ?? null, error: null };
}

export async function searchAttendeesWithTags(
  query: string
): Promise<{ attendees: TaggedAttendee[]; error: string | null }> {
  // Commas and parentheses have meaning inside PostgREST filters.
  const term = query.replace(/[,()]/g, " ").trim();

  if (!term) return { attendees: [], error: null };

  const { data, error } = await supabase
    .from("attendeeProfile")
    .select("email, firstName, lastName, nfcTagId")
    .or(
      `firstName.ilike.*${term}*,lastName.ilike.*${term}*,email.ilike.*${term}*`
    )
    .order("lastName", { ascending: true })
    .order("firstName", { ascending: true })
    .limit(30);

  if (error) {
    console.error("Could not search attendees:", error);
    return { attendees: [], error: describeTagError(error) };
  }

  return { attendees: (data ?? []) as TaggedAttendee[], error: null };
}

export async function fetchAttendeeWithTag(
  email: string
): Promise<TaggedAttendee | null> {
  const { data, error } = await supabase
    .from("attendeeProfile")
    .select("email, firstName, lastName, nfcTagId")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle<TaggedAttendee>();

  if (error) {
    console.error("Could not load attendee tag:", error);
    return null;
  }

  return data ?? null;
}

/**
 * Points `tagId` at `email`. If another attendee currently holds that tag it
 * is removed from them first, so the unique index is never violated.
 */
export async function assignTagToAttendee(
  tagId: string,
  email: string
): Promise<{ error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  const { error: clearError } = await supabase
    .from("attendeeProfile")
    .update({ nfcTagId: null })
    .eq("nfcTagId", tagId)
    .neq("email", normalizedEmail);

  if (clearError) {
    console.error("Could not clear previous tag owner:", clearError);
    return { error: describeTagError(clearError) };
  }

  const { error: assignError } = await supabase
    .from("attendeeProfile")
    .update({ nfcTagId: tagId })
    .eq("email", normalizedEmail);

  if (assignError) {
    console.error("Could not assign tag:", assignError);
    return { error: describeTagError(assignError) };
  }

  return { error: null };
}

export async function unassignTagFromAttendee(
  email: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("attendeeProfile")
    .update({ nfcTagId: null })
    .eq("email", email.trim().toLowerCase());

  if (error) {
    console.error("Could not remove tag:", error);
    return { error: describeTagError(error) };
  }

  return { error: null };
}
