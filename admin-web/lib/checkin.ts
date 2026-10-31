import { normalizeEmail } from "@/lib/attendance";
import { supabase } from "@/lib/supabase";

/**
 * Adds or removes one check-in, the same way the app does (ic-app/lib/attendance.ts):
 * through set_session_check_in(), which locks the row so it can't clobber a
 * scan happening at the same moment, then an attendanceHistory row for the audit
 * trail. Returns the session's new `emails` value.
 */
export async function setCheckIn(
  optionID: string,
  rawEmail: string,
  checkedIn: boolean
): Promise<{ ok: true; emails: string; historySaved: boolean } | { ok: false; message: string }> {
  const email = normalizeEmail(rawEmail);
  const { data, error } = await supabase.rpc("set_session_check_in", {
    p_option_id: optionID,
    p_email: email,
    p_checked_in: checkedIn,
  });
  if (error) {
    return {
      ok: false,
      message: /permission|not allowed/i.test(error.message)
        ? "You don't have permission to change check-ins."
        : error.message,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error: historyError } = await supabase.from("attendanceHistory").insert({
    eventID: optionID,
    attendeeEmail: email,
    scannedByEmail: normalizeEmail(user?.email ?? ""),
    action: checkedIn ? "check_in" : "uncheck",
    manual: true,
  });

  return { ok: true, emails: typeof data === "string" ? data : "", historySaved: !historyError };
}
