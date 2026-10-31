"use client";

import { useMemo, useState } from "react";

import { Square, UpdatedLine } from "@/components/CheckInGrid";
import {
  ABSENCE_ALERT,
  ABSENCE_WARN,
  GRACE_MINUTES,
  attendeeName,
  describeStatus,
  etDay,
  etTime,
  sessionInfo,
  statusFor,
  type SessionInfo,
} from "@/lib/attendance";
import type { AttendanceData } from "@/lib/useAttendance";

/**
 * Absences across the whole conference. Only sessions that count are
 * included: past the 15-minute mark and with at least one check-in. A late
 * check-in turns that session green, so the absence drops off on its own.
 */
export default function AbsenceList({ data }: { data: AttendanceData }) {
  const { sessions, attendees, now } = data;
  const [search, setSearch] = useState("");
  const [onlyAbsent, setOnlyAbsent] = useState(false);

  const counted = useMemo<SessionInfo[]>(
    () =>
      sessions
        .map((s) => sessionInfo(s, attendees, now))
        .filter((info) => info.pastCutoff && info.tracked && info.expected.length > 0),
    [sessions, attendees, now]
  );

  const all = useMemo(
    () =>
      attendees
        .map((attendee) => {
          const timeline = counted
            .map((info) => ({ info, status: statusFor(attendee, info) }))
            .filter(({ status }) => status === "present" || status === "absent");
          const missed = timeline.filter((t) => t.status === "absent");
          return { attendee, timeline, missed, attended: timeline.length - missed.length };
        })
        .sort(
          (a, b) =>
            b.missed.length - a.missed.length ||
            (a.attendee.lastName ?? "").localeCompare(b.attendee.lastName ?? "") ||
            (a.attendee.firstName ?? "").localeCompare(b.attendee.firstName ?? "")
        ),
    [attendees, counted]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter(
        ({ attendee }) =>
          !term ||
          [attendee.firstName, attendee.lastName, attendee.email]
            .filter(Boolean)
            .some((f) => f!.toLowerCase().includes(term))
      )
      .filter((row) => !onlyAbsent || row.missed.length > 0);
  }, [all, search, onlyAbsent]);

  const alerts = all.filter((r) => r.missed.length >= ABSENCE_ALERT).length;
  const warnings = all.filter(
    (r) => r.missed.length >= ABSENCE_WARN && r.missed.length < ABSENCE_ALERT
  ).length;

  return (
    <>
      <dl className="att-stats">
        <div className={alerts ? "alert" : undefined}>
          <dt>{ABSENCE_ALERT}+ absences</dt>
          <dd>{alerts}</dd>
        </div>
        <div className={warnings ? "warn" : undefined}>
          <dt>{ABSENCE_WARN} absences</dt>
          <dd>{warnings}</dd>
        </div>
        <div>
          <dt>Sessions counted so far</dt>
          <dd>{counted.length}</dd>
        </div>
      </dl>

      <section className="panel">
        <div className="toolbar">
          <label className="search">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              name="absence-search"
              aria-label="Search attendees"
              placeholder="Search attendees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              name="only-absent"
              checked={onlyAbsent}
              onChange={(e) => setOnlyAbsent(e.target.checked)}
            />
            Only people with absences
          </label>
          <span className="count">
            {rows.length} of {attendees.length}
          </span>
          <div className="spacer" />
          <UpdatedLine data={data} />
          <button className="btn" disabled={data.loading} onClick={data.refresh}>
            Refresh
          </button>
        </div>

        <p className="description">
          A session counts once it&apos;s {GRACE_MINUTES} minutes past its start and staff have
          checked at least one person in. Checking in late removes the absence.
        </p>

        {data.error && <p className="att-error">{data.error}</p>}

        <div className="table-wrap">
          <table className="att-absences">
            <thead>
              <tr>
                <th>Attendee</th>
                <th className="num">Absences</th>
                <th className="num">Attended</th>
                <th>Timeline</th>
                <th>Missed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ attendee, timeline, missed, attended }) => {
                const level =
                  missed.length >= ABSENCE_ALERT
                    ? "alert"
                    : missed.length >= ABSENCE_WARN
                      ? "warn"
                      : undefined;
                return (
                  <tr key={attendee.email} className={level}>
                    <td className="att-name">
                      <span className="att-person">{attendeeName(attendee)}</span>
                      <span className="att-email">{attendee.email}</span>
                    </td>
                    <td className="num">
                      <span className={`att-badge ${level ?? (missed.length ? "some" : "none")}`}>
                        {missed.length}
                      </span>
                    </td>
                    <td className="num muted">{attended}</td>
                    <td>
                      <span className="att-timeline">
                        {timeline.length === 0 && <span className="muted">—</span>}
                        {timeline.map(({ info, status }) => (
                          <Square
                            key={info.session.optionID}
                            status={status}
                            label={`${etDay(info.session.startTime)} ${etTime(info.session.startTime)} · ${info.session.title ?? info.session.optionID}: ${describeStatus(status, info)}`}
                          />
                        ))}
                      </span>
                    </td>
                    <td className="att-missed-list">
                      {missed.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        missed.map(({ info }) => (
                          <span key={info.session.optionID} className="att-missed-item">
                            {info.session.title ?? info.session.optionID}
                            <span className="muted">
                              {" "}
                              · {etDay(info.session.startTime)} {etTime(info.session.startTime)}
                            </span>
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.loading && rows.length === 0 && (
                <tr>
                  <td className="empty" colSpan={5}>
                    {onlyAbsent ? "No absences so far." : "No attendees match."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
