// Who should be at which session, and whether they made it.
//
// Mirrors the app (ic-app/app/(tabs)/index.tsx): an attendee's schedule is
// every `type = "all"` session plus the sessions whose option ID matches
// their exec1–exec4 / offsite numbers (e.g. exec1 = 2 → "exec1_2").
// Check-ins are the comma-separated `emails` list on each scheduleOptions row.

export const CONFERENCE_TZ = "America/New_York";

/** How long after a session starts before a missing check-in counts. */
export const GRACE_MINUTES = 15;

export const ABSENCE_WARN = 2;
export const ABSENCE_ALERT = 3;

const ASSIGNMENT_COLUMNS = ["exec1", "exec2", "exec3", "exec4", "offsite"] as const;
type AssignmentColumn = (typeof ASSIGNMENT_COLUMNS)[number];

export type AttendanceSession = {
  optionID: string;
  title: string | null;
  day: string | null;
  type: string | null;
  startTime: string | null;
  endTime: string | null;
  emails: string | null;
};

export type AttendanceAttendee = {
  email: string;
  firstName: string | null;
  lastName: string | null;
} & Record<AssignmentColumn, number | null>;

export const SESSION_SELECT = "optionID, title, day, type, startTime, endTime, emails";
export const ATTENDEE_SELECT = `email, firstName, lastName, ${ASSIGNMENT_COLUMNS.join(", ")}`;

/**
 * present   — checked in (at any time, so a late check-in clears an absence)
 * absent    — not checked in, 15+ minutes after start, and staff are taking attendance
 * pending   — not checked in yet, still before the 15-minute mark
 * untracked — past the 15-minute mark but nobody has been checked in at all,
 *             so this session isn't being tracked (meals, transitions, …)
 * none      — not on this attendee's schedule
 */
export type Status = "present" | "absent" | "pending" | "untracked" | "none";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseEmails(raw: string | null): Set<string> {
  return new Set((raw ?? "").split(",").map(normalizeEmail).filter(Boolean));
}

export function attendeeName(a: AttendanceAttendee) {
  return [a.firstName, a.lastName].filter(Boolean).join(" ") || a.email;
}

export function isOnSchedule(attendee: AttendanceAttendee, session: AttendanceSession) {
  if (session.type === "all") return true;
  const match = /^(exec[1-4]|offsite)_(\d+)$/.exec(session.optionID);
  if (!match) return false;
  const value = attendee[match[1] as AssignmentColumn];
  return value !== null && value !== undefined && Number(value) === Number(match[2]);
}

/** The moment a missing check-in turns red. */
export function cutoffFor(session: AttendanceSession): number | null {
  if (!session.startTime) return null;
  const start = new Date(session.startTime).getTime();
  return Number.isNaN(start) ? null : start + GRACE_MINUTES * 60_000;
}

export type SessionInfo = {
  session: AttendanceSession;
  checkedIn: Set<string>;
  /** Attendees who have this session on their schedule. */
  expected: AttendanceAttendee[];
  /** Past the 15-minute mark. */
  pastCutoff: boolean;
  /** Staff have checked at least one person in, so attendance is being taken. */
  tracked: boolean;
  now: number;
};

export function sessionInfo(
  session: AttendanceSession,
  attendees: AttendanceAttendee[],
  now: number
): SessionInfo {
  const checkedIn = parseEmails(session.emails);
  const cutoff = cutoffFor(session);
  return {
    session,
    checkedIn,
    expected: attendees.filter((a) => isOnSchedule(a, session)),
    pastCutoff: cutoff !== null && now >= cutoff,
    tracked: checkedIn.size > 0,
    now,
  };
}

export function statusFor(attendee: AttendanceAttendee, info: SessionInfo): Status {
  if (!isOnSchedule(attendee, info.session)) return "none";
  if (info.checkedIn.has(normalizeEmail(attendee.email))) return "present";
  if (!info.pastCutoff) return "pending";
  return info.tracked ? "absent" : "untracked";
}

export function sortSessions(a: AttendanceSession, b: AttendanceSession) {
  return (
    (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
    (a.title ?? "").localeCompare(b.title ?? "")
  );
}

export function sortAttendees(a: AttendanceAttendee, b: AttendanceAttendee) {
  return (
    (a.lastName ?? "").localeCompare(b.lastName ?? "") ||
    (a.firstName ?? "").localeCompare(b.firstName ?? "") ||
    a.email.localeCompare(b.email)
  );
}

// --- Eastern-time labels -------------------------------------------------------

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CONFERENCE_TZ,
  hour: "numeric",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CONFERENCE_TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: CONFERENCE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function etTime(value: string | number | null) {
  if (value === null) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : timeFormat.format(d);
}

export function etDay(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : dayFormat.format(d);
}

/** The conference day (day1/day2/…) happening today in Eastern time, if any. */
export function todaysDay(sessions: AttendanceSession[], now: number): string | null {
  const today = dateKeyFormat.format(new Date(now));
  const match = sessions.find(
    (s) => s.day && s.startTime && dateKeyFormat.format(new Date(s.startTime)) === today
  );
  return match?.day ?? null;
}

export function describeStatus(status: Status, info: SessionInfo) {
  switch (status) {
    case "present":
      return "Checked in";
    case "absent":
      return `Not checked in (${GRACE_MINUTES}+ min after start)`;
    case "pending": {
      const start = info.session.startTime ? new Date(info.session.startTime).getTime() : null;
      return start !== null && info.now < start
        ? `Starts ${etTime(start)} ET`
        : `Not checked in yet; turns red at ${etTime(cutoffFor(info.session))} ET`;
    }
    case "untracked":
      return "No one has been checked in to this session, so it isn't counted";
    case "none":
      return "Not on their schedule";
  }
}
