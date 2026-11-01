"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ATTENDEE_SELECT,
  SESSION_SELECT,
  sortAttendees,
  sortSessions,
  type AttendanceAttendee,
  type AttendanceSession,
} from "@/lib/attendance";
import { supabase } from "@/lib/supabase";

const REFRESH_MS = 60_000;
const CLOCK_MS = 30_000;

export type AttendanceData = {
  sessions: AttendanceSession[];
  attendees: AttendanceAttendee[];
  loading: boolean;
  error: string | null;
  /** When the data was last fetched. */
  updatedAt: number | null;
  /** Current time, ticking so squares turn red on their own. */
  now: number;
  refresh: () => void;
  /** Apply a check-in change locally right away (the next refresh confirms it). */
  setSessionEmails: (optionID: string, emails: string) => void;
};

/** Read-only: sessions + attendees, re-fetched every minute while `active`. */
export function useAttendance(active: boolean): AttendanceData {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [attendees, setAttendees] = useState<AttendanceAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function load() {
      const [s, a] = await Promise.all([
        supabase.from("scheduleOptions").select(SESSION_SELECT),
        supabase.from("attendeeProfile").select(ATTENDEE_SELECT),
      ]);
      if (cancelled) return;
      const failed = s.error ?? a.error;
      setError(failed ? `Could not load attendance: ${failed.message}` : null);
      if (!s.error) setSessions(((s.data ?? []) as AttendanceSession[]).sort(sortSessions));
      if (!a.error) setAttendees(((a.data ?? []) as unknown as AttendanceAttendee[]).sort(sortAttendees));
      setUpdatedAt(Date.now());
      setNow(Date.now());
      setLoading(false);
    }

    void load();
    const poll = window.setInterval(() => void load(), REFRESH_MS);
    const clock = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [active, reloadKey]);

  const setSessionEmails = useCallback((optionID: string, emails: string) => {
    setSessions((current) =>
      current.map((s) => (s.optionID === optionID ? { ...s, emails } : s))
    );
  }, []);

  return { sessions, attendees, loading, error, updatedAt, now, refresh, setSessionEmails };
}
