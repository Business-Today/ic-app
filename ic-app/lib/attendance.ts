import * as Haptics from "expo-haptics";

import { supabase } from "@/lib/supabase";

/**
 * Shared data access and formatting for the attendance screens.
 *
 * Check-ins are stored as a comma-separated list of attendee emails on each
 * `scheduleOptions` row, in the order they were recorded. Writes go through
 * the `set_session_check_in` database function (the table itself is
 * editor-only), which locks the row so concurrent scans can't race. Every write also
 * appends a row to `attendanceHistory` so staff actions can be audited.
 */

export const DAY_KEYS = ["day1", "day2", "day3"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export type Session = {
  optionID: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  day: string;
  type: string | null;
  idSpeaker: string | null;
  emails: string | null;
};

export type Speaker = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

export type Attendee = {
  firstName: string;
  lastName: string;
  email: string;
};

// --- Strings ---------------------------------------------------------------

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Unique, normalized emails from the raw comma-separated column value. */
export function parseEmails(raw: unknown): string[] {
  if (typeof raw !== "string") return [];

  return [...new Set(raw.split(",").map(normalizeEmail).filter(Boolean))];
}

export function fullName(person: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  return [person.firstName, person.lastName]
    .filter((part) => part && part !== "undefined" && part !== "null")
    .join(" ");
}

export function initialsOf(person: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  const initials = [person.firstName, person.lastName]
    .map((part) => (part ?? "").trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join("");

  return initials || "?";
}

// --- Dates -----------------------------------------------------------------

export function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatClockTime(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return { time: "TBD", period: "" };
  }

  const formatted = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const [time, period = ""] = formatted.split(" ");

  return { time, period: period.toLowerCase() };
}

/** "9:00 – 10:30 am", or "11:30 am – 1:00 pm" when the period changes. */
export function formatTimeRange(startTime: string, endTime: string) {
  const start = formatClockTime(startTime);
  const end = formatClockTime(endTime);

  if (start.period === end.period) {
    return `${start.time} – ${end.time} ${end.period}`.trim();
  }

  return `${start.time} ${start.period} – ${end.time} ${end.period}`.trim();
}

/** Weekday name for each day key, derived from that day's earliest session. */
export function dayLabelsFor(sessions: Session[]): Record<DayKey, string> {
  const labels = {} as Record<DayKey, string>;

  DAY_KEYS.forEach((dayKey, index) => {
    const first = sessions
      .filter((session) => session.day === dayKey)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )[0];

    const date = first ? new Date(first.startTime) : null;

    labels[dayKey] =
      date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString("en-US", { weekday: "long" })
        : `Day ${index + 1}`;
  });

  return labels;
}

/** The day key whose sessions fall on today's date, if the event is underway. */
export function todayDayKey(sessions: Session[]): DayKey | undefined {
  const today = new Date();

  return DAY_KEYS.find((dayKey) =>
    sessions.some(
      (session) =>
        session.day === dayKey &&
        isSameDate(new Date(session.startTime), today)
    )
  );
}

export function sessionsInProgress(sessions: Session[], now = new Date()) {
  const nowMs = now.getTime();

  return sessions.filter((session) => {
    const start = new Date(session.startTime).getTime();
    const end = new Date(session.endTime).getTime();

    return start <= nowMs && nowMs < end;
  });
}

// --- Speakers --------------------------------------------------------------

export function buildSpeakerMap(speakers: Speaker[]) {
  return new Map(speakers.map((speaker) => [speaker.id, speaker]));
}

export function speakerNamesFor(
  session: Pick<Session, "idSpeaker">,
  speakerMap: Map<string, Speaker>
) {
  return (session.idSpeaker ?? "")
    .split(",")
    .map((id) => speakerMap.get(id.trim()))
    .filter((speaker): speaker is Speaker => speaker !== undefined)
    .map(fullName)
    .filter(Boolean)
    .join(", ");
}

/** "Jane Doe · McCosh 50": whichever of speaker and location exist. */
export function sessionDetailLine(
  session: Session,
  speakerMap: Map<string, Speaker>
) {
  return [speakerNamesFor(session, speakerMap), session.location?.trim()]
    .filter(Boolean)
    .join(" · ");
}

/** "Tuesday · 9:00 – 10:30 am · McCosh 50" */
export function sessionSubtitle(
  session: Session,
  dayLabels: Record<string, string>,
  speakerMap: Map<string, Speaker>
) {
  return [
    dayLabels[session.day],
    formatTimeRange(session.startTime, session.endTime),
    sessionDetailLine(session, speakerMap),
  ]
    .filter(Boolean)
    .join(" · ");
}

// --- Reads -----------------------------------------------------------------

export async function fetchSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from("scheduleOptions")
    .select(
      "optionID, title, startTime, endTime, location, day, type, idSpeaker, emails"
    )
    .order("startTime", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    console.error("Could not load sessions:", error);
    return [];
  }

  return (data ?? []) as Session[];
}

export async function fetchSpeakers(): Promise<Speaker[]> {
  const { data, error } = await supabase
    .from("speakerProfile")
    .select("id, firstName, lastName");

  if (error) {
    console.error("Could not load speakers:", error);
    return [];
  }

  return (data ?? []) as Speaker[];
}

/** Checked-in emails for a session, in the order they were recorded. */
export async function fetchCheckedInEmails(eventID: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("scheduleOptions")
    .select("emails")
    .eq("optionID", eventID)
    .single();

  if (error) {
    console.error("Could not load check-ins:", error);
    return [];
  }

  return parseEmails(data?.emails);
}

export async function fetchAttendeesByEmail(
  emails: string[]
): Promise<Attendee[]> {
  if (emails.length === 0) return [];

  const { data, error } = await supabase
    .from("attendeeProfile")
    .select("firstName, lastName, email")
    .in("email", emails);

  if (error) {
    console.error("Could not load attendee profiles:", error);
    return [];
  }

  return (data ?? []) as Attendee[];
}

export async function searchAttendees(query: string): Promise<Attendee[]> {
  // Commas and parentheses have meaning inside PostgREST filters.
  const term = query.replace(/[,()]/g, " ").trim();

  if (!term) return [];

  const { data, error } = await supabase
    .from("attendeeProfile")
    .select("firstName, lastName, email")
    .or(
      `firstName.ilike.*${term}*,lastName.ilike.*${term}*,email.ilike.*${term}*`
    )
    .order("lastName", { ascending: true })
    .order("firstName", { ascending: true })
    .limit(30);

  if (error) {
    console.error("Could not search attendees:", error);
    return [];
  }

  return (data ?? []) as Attendee[];
}

// --- Writes ----------------------------------------------------------------

export type CheckInResult =
  | { status: "checked_in"; attendee: Attendee; historySaved: boolean }
  | { status: "already_checked_in"; attendee: Attendee }
  | { status: "not_registered"; attendee: Attendee }
  | { status: "not_found" }
  | { status: "error"; message: string };

async function recordHistory(
  eventID: string,
  attendeeEmail: string,
  action: "check_in" | "uncheck",
  manual: boolean
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    console.error("Could not get the signed-in user:", userError);
    return false;
  }

  const { error } = await supabase.from("attendanceHistory").insert({
    eventID,
    scannedByEmail: normalizeEmail(user.email),
    attendeeEmail,
    action,
    manual,
  });

  if (error) {
    console.error("Could not save attendance history:", error);
    return false;
  }

  return true;
}

/**
 * Records a check-in for one attendee. This is the single code path for QR,
 * NFC and manual check-ins so the rules stay identical: seminar registration
 * (an `exec1_2` style option ID must match the attendee's `exec1` column),
 * no duplicates, and an `attendanceHistory` row. `manual` is only recorded.
 */
export async function checkInAttendee(
  eventID: string,
  rawEmail: string,
  options: { manual: boolean }
): Promise<CheckInResult> {
  const email = normalizeEmail(rawEmail);

  if (!email) {
    return { status: "not_found" };
  }

  const { data: session, error: sessionError } = await supabase
    .from("scheduleOptions")
    .select("emails, type")
    .eq("optionID", eventID)
    .single();

  if (sessionError || !session) {
    console.error("Could not load session:", sessionError);
    return { status: "error", message: "Could not load this session" };
  }

  const { data: attendee, error: attendeeError } = await supabase
    .from("attendeeProfile")
    .select("firstName, lastName, email")
    .eq("email", email)
    .maybeSingle();

  if (attendeeError) {
    console.error("Could not load attendee:", attendeeError);
    return { status: "error", message: "Could not look up this attendee" };
  }

  if (!attendee) {
    return { status: "not_found" };
  }

  if (session.type === "seminar") {
    const [column, expected] = eventID.split("_");

    if (column && expected) {
      const { data: registration, error: registrationError } = await supabase
        .from("attendeeProfile")
        .select(column)
        .eq("email", email)
        .maybeSingle<Record<string, unknown>>();

      if (registrationError) {
        console.error("Could not verify registration:", registrationError);
        return { status: "error", message: "Could not verify registration" };
      }

      if (String(registration?.[column]) !== expected) {
        return { status: "not_registered", attendee };
      }
    }
  }

  const current = parseEmails(session.emails);

  if (current.includes(email)) {
    return { status: "already_checked_in", attendee };
  }

  const { error: updateError } = await supabase.rpc("set_session_check_in", {
    p_option_id: eventID,
    p_email: email,
    p_checked_in: true,
  });

  if (updateError) {
    console.error("Could not update attendance:", updateError);
    return { status: "error", message: "Could not save the check-in" };
  }

  const historySaved = await recordHistory(
    eventID,
    email,
    "check_in",
    options.manual
  );

  return { status: "checked_in", attendee, historySaved };
}

export async function removeCheckIn(
  eventID: string,
  rawEmail: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = normalizeEmail(rawEmail);

  const { error: updateError } = await supabase.rpc("set_session_check_in", {
    p_option_id: eventID,
    p_email: email,
    p_checked_in: false,
  });

  if (updateError) {
    console.error("Could not update attendance:", updateError);
    return { ok: false, message: "Could not remove the check-in" };
  }

  await recordHistory(eventID, email, "uncheck", false);

  return { ok: true };
}

// --- Presentation ----------------------------------------------------------

export type CheckInOutcome = "success" | "duplicate" | "rejected" | "failed";

/** One wording for every check-in path: QR, NFC and manual. */
export function describeCheckIn(result: CheckInResult): {
  outcome: CheckInOutcome;
  title: string;
  detail: string;
} {
  switch (result.status) {
    case "checked_in":
      return {
        outcome: "success",
        title: fullName(result.attendee) || result.attendee.email,
        detail: result.historySaved
          ? "Checked in"
          : "Checked in, but the activity log did not save",
      };
    case "already_checked_in":
      return {
        outcome: "duplicate",
        title: fullName(result.attendee) || result.attendee.email,
        detail: "Already checked in",
      };
    case "not_registered":
      return {
        outcome: "rejected",
        title: fullName(result.attendee) || result.attendee.email,
        detail: "Not registered for this seminar",
      };
    case "not_found":
      return {
        outcome: "rejected",
        title: "No profile found",
        detail: "This code does not match any attendee",
      };
    case "error":
    default:
      return {
        outcome: "failed",
        title: "Check-in failed",
        detail: result.status === "error" ? result.message : "Unknown error",
      };
  }
}

export function hapticFor(outcome: CheckInOutcome) {
  const type =
    outcome === "success"
      ? Haptics.NotificationFeedbackType.Success
      : outcome === "duplicate"
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error;

  void Haptics.notificationAsync(type).catch(() => {});
}
