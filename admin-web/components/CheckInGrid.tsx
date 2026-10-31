"use client";

import { useMemo, useState } from "react";

import {
  GRACE_MINUTES,
  attendeeName,
  describeStatus,
  etDay,
  etTime,
  normalizeEmail,
  sessionInfo,
  statusFor,
  todaysDay,
  type AttendanceAttendee,
  type SessionInfo,
  type Status,
} from "@/lib/attendance";
import { setCheckIn } from "@/lib/checkin";
import type { AttendanceData } from "@/lib/useAttendance";

const LEGEND: { status: Status; label: string }[] = [
  { status: "present", label: "Checked in" },
  { status: "absent", label: `Not checked in after ${GRACE_MINUTES} min` },
  { status: "pending", label: `Not yet (first ${GRACE_MINUTES} min)` },
  { status: "untracked", label: "Session not being tracked" },
  { status: "none", label: "Not on their schedule" },
];

export function Square({ status, label }: { status: Status; label: string }) {
  return <span className={`sq ${status}`} role="img" aria-label={label} title={label} />;
}

export function UpdatedLine({ data }: { data: AttendanceData }) {
  return (
    <span className="count">
      {data.loading && !data.updatedAt
        ? "Loading…"
        : `Updated ${etTime(data.updatedAt)} ET · refreshes every minute`}
    </span>
  );
}

/** Every attendee × every session of one day, green/red by check-in. */
export default function CheckInGrid({ data }: { data: AttendanceData }) {
  const { sessions, attendees, now } = data;
  const days = useMemo(
    () => [...new Set(sessions.map((s) => s.day).filter((d): d is string => !!d))].sort(),
    [sessions]
  );
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const day = chosenDay ?? todaysDay(sessions, now) ?? days[0] ?? null;
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function change(optionID: string, title: string, email: string, name: string, checkIn: boolean) {
    const question = checkIn
      ? `Check ${name} in to ${title}?`
      : `Remove ${name}'s check-in from ${title}?`;
    if (!window.confirm(question)) return;
    setBusy(`${optionID}|${email}`);
    setNotice(null);
    const result = await setCheckIn(optionID, email, checkIn);
    setBusy(null);
    if (!result.ok) {
      setNotice({ kind: "error", text: `Couldn't update ${name}: ${result.message}` });
      return;
    }
    data.setSessionEmails(optionID, result.emails);
    setNotice({
      kind: "ok",
      text: `${checkIn ? "Checked in" : "Removed check-in for"} ${name} · ${title}${
        result.historySaved ? "" : " (saved, but the history log entry failed)"
      }`,
    });
  }

  function toggle(attendee: AttendanceAttendee, info: SessionInfo, status: Status) {
    void change(
      info.session.optionID,
      info.session.title ?? info.session.optionID,
      attendee.email,
      attendeeName(attendee),
      status !== "present"
    );
  }

  // Sessions of the day that at least one attendee has on their schedule.
  const infos = useMemo<SessionInfo[]>(
    () =>
      sessions
        .filter((s) => s.day === day)
        .map((s) => sessionInfo(s, attendees, now))
        .filter((info) => info.expected.length > 0),
    [sessions, attendees, now, day]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return attendees
      .map((attendee) => {
        const statuses = infos.map((info) => statusFor(attendee, info));
        return { attendee, statuses, missing: statuses.filter((s) => s === "absent").length };
      })
      .filter(
        ({ attendee }) =>
          !term ||
          [attendee.firstName, attendee.lastName, attendee.email]
            .filter(Boolean)
            .some((f) => f!.toLowerCase().includes(term))
      )
      .filter((row) => !onlyMissing || row.missing > 0);
  }, [attendees, infos, search, onlyMissing]);

  const byEmail = useMemo(
    () => new Map(attendees.map((a) => [normalizeEmail(a.email), a])),
    [attendees]
  );
  const stray = useMemo(
    () =>
      sessions
        .filter((s) => s.day === day)
        .flatMap((s) => {
          const info = sessionInfo(s, attendees, now);
          return [...info.checkedIn]
            .filter((email) => {
              const attendee = byEmail.get(email);
              return !attendee || statusFor(attendee, info) === "none";
            })
            .map((email) => ({ info, email, attendee: byEmail.get(email) ?? null }));
        }),
    [sessions, attendees, now, day, byEmail]
  );

  const dayLabel = (d: string) => {
    const first = sessions.find((s) => s.day === d && s.startTime);
    return `${d.replace(/^day/, "Day ")}${first ? ` · ${etDay(first.startTime)}` : ""}`;
  };

  return (
    <section className="panel">
      <div className="toolbar">
        <label className="search">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            name="checkin-search"
            aria-label="Search attendees"
            placeholder="Search attendees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            name="only-missing"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          Only people missing a check-in
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

      <div className="att-bar">
        <div className="subtabs" role="tablist" aria-label="Day">
          {days.map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={d === day}
              className={d === day ? "chip active" : "chip"}
              onClick={() => setChosenDay(d)}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
        <ul className="legend">
          {LEGEND.map(({ status, label }) => (
            <li key={status}>
              <span className={`sq ${status}`} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {data.error && <p className="att-error">{data.error}</p>}
      {notice && (
        <p className={notice.kind === "ok" ? "att-notice" : "att-error"} role={notice.kind === "ok" ? "status" : "alert"}>
          {notice.text}
          <button className="btn ghost small" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </p>
      )}
      <p className="description">
        Click a square to check someone in or remove a check-in. Changes save right away and are
        logged in the attendance history.
      </p>

      <div className="table-wrap">
        <table className="att-grid">
          <thead>
            <tr>
              <th className="att-name">Attendee</th>
              {infos.map((info) => {
                const present = info.expected.filter((a) =>
                  info.checkedIn.has(normalizeEmail(a.email))
                ).length;
                return (
                  <th
                    key={info.session.optionID}
                    className="att-session"
                    title={`${info.session.title ?? info.session.optionID} · ${etTime(info.session.startTime)}–${etTime(info.session.endTime)} ET · ${info.session.optionID}`}
                  >
                    <span className="att-time">{etTime(info.session.startTime)}</span>
                    <span className="att-title">{info.session.title ?? info.session.optionID}</span>
                    <span className={info.tracked ? "att-tally" : "att-tally untracked"}>
                      {present}/{info.expected.length}
                    </span>
                  </th>
                );
              })}
              <th className="att-missing">Missed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ attendee, statuses, missing }) => (
              <tr key={attendee.email}>
                <td className="att-name">
                  <span className="att-person">{attendeeName(attendee)}</span>
                  <span className="att-email">{attendee.email}</span>
                </td>
                {statuses.map((status, i) => {
                  const info = infos[i];
                  const label = `${attendeeName(attendee)} · ${info.session.title ?? info.session.optionID}: ${describeStatus(status, info)}`;
                  const cellBusy = busy === `${info.session.optionID}|${attendee.email}`;
                  return (
                    <td key={info.session.optionID} className="att-cell">
                      {status === "none" ? (
                        <Square status={status} label={label} />
                      ) : (
                        <button
                          type="button"
                          className={cellBusy ? "sq-button busy" : "sq-button"}
                          disabled={busy !== null}
                          aria-label={`${label}. Click to ${status === "present" ? "remove the check-in" : "check in"}.`}
                          title={`${label} · click to ${status === "present" ? "remove" : "check in"}`}
                          onClick={() => toggle(attendee, info, status)}
                        >
                          <span className={`sq ${status}`} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className={missing ? "att-missing has" : "att-missing"}>{missing || ""}</td>
              </tr>
            ))}
            {!data.loading && rows.length === 0 && (
              <tr>
                <td className="empty" colSpan={infos.length + 2}>
                  {onlyMissing ? "Nobody is missing a check-in for this day." : "No attendees match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {stray.length > 0 && (
        <div className="stray">
          <h3>Other check-ins this day</h3>
          <p className="muted">
            People checked in to a session that isn&apos;t on their schedule, or emails that
            aren&apos;t in the attendee list (often test scans). A session with any check-in counts
            toward absences, so remove test scans before the conference.
          </p>
          <ul>
            {stray.map(({ info, email, attendee }) => (
              <li key={`${info.session.optionID}|${email}`}>
                <span>
                  <strong>{attendee ? attendeeName(attendee) : email}</strong>
                  <span className="muted">
                    {" "}
                    · {info.session.title ?? info.session.optionID} · {etTime(info.session.startTime)} ·{" "}
                    {attendee ? "not on their schedule" : "not an attendee"}
                  </span>
                </span>
                <button
                  className="btn small danger"
                  disabled={busy !== null}
                  onClick={() =>
                    void change(
                      info.session.optionID,
                      info.session.title ?? info.session.optionID,
                      email,
                      attendee ? attendeeName(attendee) : email,
                      false
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
