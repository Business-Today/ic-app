"use client";

import { useMemo } from "react";

import {
  assignedSlot,
  attendeeName,
  describeStatus,
  etDay,
  etTime,
  normalizeEmail,
  statusFor,
  type AttendanceAttendee,
  type SessionInfo,
  type Status,
} from "@/lib/attendance";

const SLOT_LABELS: Record<string, string> = {
  offsite: "Offsite",
  exec1: "Exec 1",
  exec2: "Exec 2",
  exec3: "Exec 3",
  exec4: "Exec 4",
};

/** One session's roster: everyone assigned to it, checked in or not. */
export default function SessionRoster({
  info,
  attendees,
  speakers,
  search,
  onlyMissing,
  readOnly,
  busy,
  onToggle,
  onRemove,
}: {
  info: SessionInfo;
  attendees: AttendanceAttendee[];
  /** Speaker names for this session, if any. */
  speakers: string | null;
  search: string;
  onlyMissing: boolean;
  readOnly: boolean;
  busy: string | null;
  onToggle: (attendee: AttendanceAttendee, info: SessionInfo, status: Status) => void;
  onRemove: (email: string, name: string) => void;
}) {
  const { session, expected, checkedIn } = info;
  const slot = assignedSlot(session.optionID);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expected
      .map((attendee) => ({ attendee, status: statusFor(attendee, info) }))
      .filter(
        ({ attendee }) =>
          !term ||
          [attendee.firstName, attendee.lastName, attendee.email]
            .filter(Boolean)
            .some((f) => f!.toLowerCase().includes(term))
      )
      .filter(({ status }) => !onlyMissing || status !== "present");
  }, [expected, info, search, onlyMissing]);

  const present = expected.filter((a) => checkedIn.has(normalizeEmail(a.email))).length;
  const expectedEmails = new Set(expected.map((a) => normalizeEmail(a.email)));
  const byEmail = new Map(attendees.map((a) => [normalizeEmail(a.email), a]));
  // Checked in here without being assigned: walk-ins, wrong room, test scans.
  const extras = [...checkedIn]
    .filter((email) => !expectedEmails.has(email))
    .map((email) => ({ email, attendee: byEmail.get(email) ?? null }));

  return (
    <div className="roster">
      <div className="roster-head">
        <div>
          <h3>
            {session.title ?? session.optionID}
            {slot && <span className="roster-number"> · #{slot.number}</span>}
          </h3>
          <p className="muted">
            {[
              session.optionID,
              session.startTime &&
                `${etDay(session.startTime)}, ${etTime(session.startTime)}–${etTime(session.endTime)} ET`,
              session.location,
              speakers,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <dl className="roster-tally">
          <div>
            <dt>Checked in</dt>
            <dd>
              {present}
              <span className="muted"> / {expected.length}</span>
            </dd>
          </div>
          <div>
            <dt>Not yet</dt>
            <dd className={expected.length - present > 0 && info.pastCutoff && info.tracked ? "bad" : undefined}>
              {expected.length - present}
            </dd>
          </div>
        </dl>
      </div>

      {expected.length === 0 ? (
        <p className="roster-empty">
          Nobody is assigned to {session.optionID} yet.
          {slot &&
            ` Fill in the ${SLOT_LABELS[slot.slot]} column on Attendee schedules (number ${slot.number}).`}
        </p>
      ) : (
        <ul className="roster-list">
          {rows.map(({ attendee, status }) => {
            const name = attendeeName(attendee);
            const label = `${name}: ${describeStatus(status, info)}`;
            const cellBusy = busy === `${session.optionID}|${attendee.email}`;
            return (
              <li key={attendee.email} className={`roster-row ${status}`}>
                {readOnly ? (
                  <span className={`sq ${status}`} role="img" aria-label={label} title={label} />
                ) : (
                  <button
                    type="button"
                    className={cellBusy ? "sq-button busy" : "sq-button"}
                    disabled={busy !== null}
                    aria-label={`${label}. Click to ${status === "present" ? "remove the check-in" : "check in"}.`}
                    title={`${label} · click to ${status === "present" ? "remove" : "check in"}`}
                    onClick={() => onToggle(attendee, info, status)}
                  >
                    <span className={`sq ${status}`} aria-hidden="true" />
                  </button>
                )}
                <span className="roster-person">
                  <span className="att-person">{name}</span>
                  <span className="att-email">{attendee.email}</span>
                </span>
                <span className="roster-status">{describeStatus(status, info)}</span>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="roster-row empty">
              {onlyMissing ? "Everyone assigned is checked in." : "No attendees match."}
            </li>
          )}
        </ul>
      )}

      {extras.length > 0 && (
        <div className="stray">
          <h3>Checked in but not assigned here</h3>
          <p className="muted">
            Walk-ins, people in the wrong room, or test scans. They don&apos;t count toward this
            session&apos;s total.
          </p>
          <ul>
            {extras.map(({ email, attendee }) => {
              const name = attendee ? attendeeName(attendee) : email;
              return (
                <li key={email}>
                  <span>
                    <strong>{name}</strong>
                    <span className="muted"> · {attendee ? email : "not an attendee"}</span>
                  </span>
                  {!readOnly && (
                    <button
                      className="btn small danger"
                      disabled={busy !== null}
                      onClick={() => onRemove(email, name)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
