"use client";

import { useEffect, useMemo, useState } from "react";

import InfoNote from "@/components/InfoNote";
import SessionRoster from "@/components/SessionRoster";
import { parseSpeakerIds } from "@/components/SpeakerPicker";
import {
  GRACE_MINUTES,
  assignedSlot,
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
import { supabase } from "@/lib/supabase";
import type { AttendanceData } from "@/lib/useAttendance";

// Seminar blocks in conference order; each holds <slot>_1, <slot>_2, …
const BLOCKS = ["offsite", "exec1", "exec2", "exec3", "exec4"] as const;

/** "Executive Seminar 2" → "Exec Sem 2"; the block's name is its most common seminar title. */
function blockName(titles: (string | null)[], fallback: string) {
  const counts = new Map<string, number>();
  for (const t of titles) {
    if (t && /^Executive Seminar/i.test(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? top.replace(/^Executive Seminar/i, "Exec Sem") : fallback;
}

// Short labels keep the legend to the right of the pickers; hover for the full meaning.
const LEGEND: { status: Status; label: string; detail: string }[] = [
  { status: "present", label: "Checked in", detail: "Checked in (late check-ins count too)" },
  {
    status: "absent",
    label: `Missed (${GRACE_MINUTES}+ min)`,
    detail: `Not checked in ${GRACE_MINUTES} minutes after the session started`,
  },
  { status: "pending", label: "Not yet", detail: `Not checked in yet; still within the first ${GRACE_MINUTES} minutes` },
  { status: "untracked", label: "Not tracked", detail: "Nobody was checked in to this session, so it doesn't count" },
  { status: "none", label: "Not scheduled", detail: "Not on this attendee's schedule" },
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
export default function CheckInGrid({
  data,
  readOnly = false,
}: {
  data: AttendanceData;
  /** Viewers see the grid but can't check anyone in or out. */
  readOnly?: boolean;
}) {
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
  const [view, setView] = useState<"day" | "seminar">("day");
  const [chosenBlock, setChosenBlock] = useState<string | null>(null);
  const [chosenSession, setChosenSession] = useState<string | null>(null);
  const [speakerNames, setSpeakerNames] = useState<
    Map<string, { full: string; last: string }>
  >(new Map());

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("speakerProfile")
      .select("id, firstName, lastName")
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSpeakerNames(
          new Map(
            data.map((s) => {
              const full = [s.firstName, s.lastName].filter(Boolean).join(" ") || String(s.id);
              return [String(s.id), { full, last: s.lastName || full }];
            })
          )
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const speakersFor = (value: string | null | undefined, short = false) =>
    parseSpeakerIds(value)
      .map((id) => {
        const name = speakerNames.get(id);
        return name ? (short ? name.last : name.full) : id;
      })
      .join(", ") || null;

  const blocks = useMemo(
    () =>
      BLOCKS.map((slot, index) => {
        const items = sessions
          .filter((s) => assignedSlot(s.optionID)?.slot === slot)
          .sort((a, b) => assignedSlot(a.optionID)!.number - assignedSlot(b.optionID)!.number);
        const first = items[0];
        return {
          slot,
          name: blockName(
            items.map((s) => s.title),
            index === 0 ? "Offsite" : `Exec ${index}`
          ),
          // "Sat 10:15 AM": the weekday is enough to tell the blocks apart.
          when: first?.startTime
            ? `${etDay(first.startTime).split(",")[0]} ${etTime(first.startTime)}`
            : "",
          ends: first?.endTime ? new Date(first.endTime).getTime() : null,
          items,
        };
      }).filter((b) => b.items.length > 0),
    [sessions]
  );
  // Until one is picked, show the block that's on now or next.
  const block =
    blocks.find((b) => b.slot === chosenBlock) ??
    blocks.find((b) => b.ends !== null && b.ends > now) ??
    blocks[0] ??
    null;
  const selected =
    view !== "seminar" || !block
      ? null
      : block.items.find((s) => s.optionID === chosenSession) ?? block.items[0];
  const selectedInfo = useMemo(
    () => (selected ? sessionInfo(selected, attendees, now) : null),
    [selected, attendees, now]
  );

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
        {!selected && (
          <span className="count">
            {rows.length} of {attendees.length}
          </span>
        )}
        <div className="spacer" />
        <UpdatedLine data={data} />
        <button className="btn" disabled={data.loading} onClick={data.refresh}>
          Refresh
        </button>
        <InfoNote
          text={
            readOnly
              ? "View only. Ask an editor to fix a check-in."
              : "Click a square to check someone in or remove a check-in. Changes save right away and are logged in the attendance history."
          }
        />
      </div>

      <div className="att-bar">
        <div className="att-pickers">
          <div className="segmented" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={view === "day"}
              className={view === "day" ? "active" : undefined}
              onClick={() => setView("day")}
            >
              By day
            </button>
            <button
              type="button"
              aria-pressed={view === "seminar"}
              className={view === "seminar" ? "active" : undefined}
              onClick={() => setView("seminar")}
            >
              By seminar
            </button>
          </div>
          {view === "day" ? (
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
          ) : (
            <div className="subtabs" role="tablist" aria-label="Seminar block">
              {blocks.map((b) => (
                <button
                  key={b.slot}
                  role="tab"
                  aria-selected={b.slot === block?.slot}
                  className={b.slot === block?.slot ? "chip stacked active" : "chip stacked"}
                  title={b.when}
                  onClick={() => {
                    setChosenBlock(b.slot);
                    setChosenSession(null);
                  }}
                >
                  {b.name}
                  <span className="chip-sub">{b.when}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <ul className="legend">
          {LEGEND.map(({ status, label, detail }) => (
            <li key={status} title={detail}>
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

      {view === "seminar" && block && (
        <div className="seminar-picker" role="tablist" aria-label="Seminar">
          {block.items.map((s) => {
            const info = sessionInfo(s, attendees, now);
            const present = info.expected.filter((a) =>
              info.checkedIn.has(normalizeEmail(a.email))
            ).length;
            const number = assignedSlot(s.optionID)!.number;
            const kind =
              s.type === "workshop" ? "Workshop" : s.title === "Offsite Seminars" ? "Offsite" : null;
            const isActive = s.optionID === selected?.optionID;
            return (
              <button
                key={s.optionID}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={isActive ? "seminar-pill active" : "seminar-pill"}
                title={[s.optionID, speakersFor(s.idSpeaker), s.location].filter(Boolean).join(" · ")}
                onClick={() => setChosenSession(s.optionID)}
              >
                <span className="seminar-pill-top">
                  <strong>#{number}</strong>
                  {kind && <span className="seminar-kind">{kind}</span>}
                </span>
                <span className="seminar-pill-name">{speakersFor(s.idSpeaker, true) ?? "No speaker set"}</span>
                <span className="seminar-pill-count">
                  {info.expected.length ? `${present}/${info.expected.length} in` : "none assigned"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedInfo ? (
        <SessionRoster
          info={selectedInfo}
          attendees={attendees}
          speakers={speakersFor(selectedInfo.session.idSpeaker)}
          search={search}
          onlyMissing={onlyMissing}
          readOnly={readOnly}
          busy={busy}
          onToggle={toggle}
          onRemove={(email, name) =>
            void change(
              selectedInfo.session.optionID,
              selectedInfo.session.title ?? selectedInfo.session.optionID,
              email,
              name,
              false
            )
          }
        />
      ) : (
      <>
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
                      {status === "none" || readOnly ? (
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
                {!readOnly && <button
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
                </button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      </>
      )}
    </section>
  );
}
