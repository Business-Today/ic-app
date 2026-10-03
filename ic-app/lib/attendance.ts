import { supabase } from "@/lib/supabase";

export type AttendeeName = {
  email: string;
  firstName: string;
  lastName: string;
};

export type CheckInResult =
  | { status: "checked_in"; attendee: AttendeeName }
  | { status: "already_checked_in"; attendee: AttendeeName }
  | { status: "not_registered_for_seminar"; attendee: AttendeeName }
  | { status: "no_profile" }
  | { status: "error"; message: string };

type CheckInOptions = {
  /** True when a staff member picked the attendee from a list by hand. */
  manual: boolean;
};

function splitEmails(value: unknown): string[] {
  return typeof value === "string"
    ? value
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean)
    : [];
}

/**
 * Records attendance for one attendee at one event. This is the single code
 * path used by NFC check-in and manual check-in so the rules (seminar
 * registration check, duplicate check, history row) stay identical.
 */
export async function checkInAttendee(
  eventID: string,
  rawEmail: string,
  options: CheckInOptions
): Promise<CheckInResult> {
  const email = rawEmail.trim().toLowerCase();

  const { data: event, error: eventError } = await supabase
    .from("scheduleOptions")
    .select("emails, type")
    .eq("optionID", eventID)
    .single();

  if (eventError || !event) {
    console.error("Could not load event:", eventError);
    return { status: "error", message: "Could not load this event" };
  }

  const { data: attendee, error: attendeeError } = await supabase
    .from("attendeeProfile")
    .select("email, firstName, lastName")
    .eq("email", email)
    .maybeSingle<AttendeeName>();

  if (attendeeError) {
    console.error("Could not load attendee:", attendeeError);
    return { status: "error", message: "Could not load attendee profile" };
  }

  if (!attendee) {
    return { status: "no_profile" };
  }

  if (event.type === "seminar") {
    // Seminar option IDs look like "exec1_3": column "exec1" must equal "3"
    // on the attendee's profile for them to be registered.
    const [column, expected] = eventID.split("_");

    if (column && expected !== undefined) {
      const { data: registration, error: registrationError } = await supabase
        .from("attendeeProfile")
        .select(column)
        .eq("email", email)
        .maybeSingle<Record<string, unknown>>();

      if (registrationError) {
        console.error("Could not check seminar registration:", registrationError);
        return { status: "error", message: "Could not check seminar registration" };
      }

      if (String(registration?.[column] ?? "") !== expected) {
        return { status: "not_registered_for_seminar", attendee };
      }
    }
  }

  const currentEmails = splitEmails(event.emails);
  const alreadyIn = currentEmails.some(
    (existing) => existing.toLowerCase() === email
  );

  if (alreadyIn) {
    return { status: "already_checked_in", attendee };
  }

  const updatedEmails = [...currentEmails, attendee.email].join(",");

  const { error: updateError } = await supabase
    .from("scheduleOptions")
    .update({ emails: updatedEmails })
    .eq("optionID", eventID);

  if (updateError) {
    console.error("Could not update attendance:", updateError);
    return { status: "error", message: "Could not save check-in" };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    console.error("Could not get the signed-in user:", userError);
    return { status: "checked_in", attendee };
  }

  const { error: historyError } = await supabase.from("attendanceHistory").insert({
    eventID,
    scannedByEmail: user.email.trim().toLowerCase(),
    attendeeEmail: email,
    action: "check_in",
    manual: options.manual,
  });

  if (historyError) {
    console.error("Could not save attendance history:", historyError);
  }

  return { status: "checked_in", attendee };
}
