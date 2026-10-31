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
  type SessionInfo,
  type Status,
} from "@/lib/attendance";
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
                {statuses.map((status, i) => (
                  <td key={infos[i].session.optionID} className="att-cell">
                    <Square
                      status={status}
                      label={`${attendeeName(attendee)} · ${infos[i].session.title ?? infos[i].session.optionID}: ${describeStatus(status, infos[i])}`}
                    />
                  </td>
                ))}
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
    </section>
  );
}
