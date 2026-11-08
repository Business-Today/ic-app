import { normalizeEmail } from "@/lib/attendance";
import { supabase } from "@/lib/supabase";

/**
 * When the conference is over and the app turns into the thank-you screen:
 * the end of the last session (Optional Open Networking, Sun Nov 8, 5:00 PM ET).
 * From then on only the thank-you screen, the attendee's connections and their
 * profiles can be opened.
 */
export const CONFERENCE_ENDS_AT = new Date("2026-11-08T22:00:00Z").getTime();

export function isConferenceOver(now = Date.now()) {
  return now >= CONFERENCE_ENDS_AT;
}

/** Routes still reachable once the conference is over. */
export const AFTER_CONFERENCE_ROUTES = new Set([
  "thankYou",
  "connections",
  "directoryProfile",
  "login",
]);

export const BT_LINKS = {
  linkedin: "https://www.linkedin.com/company/business-today_2",
  instagram: "https://www.instagram.com/businesstoday1968/",
  website: "https://www.businesstoday.org",
};

export type SignedInProfile = {
  email: string;
  firstName: string | null;
};

/**
 * The signed-in attendee's profile, looked up the same way the Home tab does:
 * by school email first, then by personal email.
 */
export async function fetchSignedInProfile(): Promise<SignedInProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = normalizeEmail(user.email);
  const lookUp = (column: "email" | "personalEmail") =>
    supabase
      .from("attendeeProfile")
      .select("email, firstName")
      .eq(column, email)
      .maybeSingle<SignedInProfile>();

  const byEmail = await lookUp("email");
  if (byEmail.data) return byEmail.data;

  const byPersonal = await lookUp("personalEmail");
  return byPersonal.data ?? null;
}

/** How many sessions this attendee was checked in to. */
export async function countSessionsAttended(email: string) {
  const { data, error } = await supabase.from("scheduleOptions").select("emails");
  if (error) return null;

  const me = normalizeEmail(email);
  return (data ?? []).filter((row) =>
    String(row.emails ?? "")
      .split(",")
      .some((entry) => normalizeEmail(entry) === me)
  ).length;
}
