"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { normalizeEmail } from "@/lib/attendance";
import { supabase } from "@/lib/supabase";

// Spreadsheet header → attendeeProfile column. Matching ignores case, spaces and _.
const COLUMNS = {
  groupNumber: { label: "Group", aliases: ["group", "groupnumber", "groupno"], prefix: null },
  offsite: { label: "Offsite", aliases: ["offsite"], prefix: "offsite" },
  exec1: { label: "Exec 1", aliases: ["exec1"], prefix: "exec1" },
  exec2: { label: "Exec 2", aliases: ["exec2"], prefix: "exec2" },
  exec3: { label: "Exec 3", aliases: ["exec3"], prefix: "exec3" },
  exec4: { label: "Exec 4", aliases: ["exec4"], prefix: "exec4" },
} as const;
type ScheduleColumn = keyof typeof COLUMNS;
const COLUMN_NAMES = Object.keys(COLUMNS) as ScheduleColumn[];

type Current = { email: string; firstName: string | null; lastName: string | null } & Record<
  ScheduleColumn,
  number | null
>;

type Change = { column: ScheduleColumn; from: number | null; to: number; warning: string | null };
type Planned =
  | { kind: "update"; line: number; email: string; name: string; changes: Change[] }
  | { kind: "same"; line: number; email: string; name: string }
  | { kind: "unknown"; line: number; email: string }
  | { kind: "invalid"; line: number; email: string; problems: string[] };

function headerKey(cell: string): ScheduleColumn | "email" | null {
  const h = cell.trim().toLowerCase().replace(/[\s_#.-]/g, "");
  if (["email", "emailaddress", "princetonemail"].includes(h)) return "email";
  return COLUMN_NAMES.find((c) => (COLUMNS[c].aliases as readonly string[]).includes(h)) ?? null;
}

function splitLine(line: string): string[] {
  // Google Sheets / Excel paste is tab-separated; fall back to commas for CSV.
  return line.includes("\t") ? line.split("\t") : line.split(",");
}

export function planPaste(
  text: string,
  current: Map<string, Current>,
  sessionIds: Set<string>
): { plan: Planned[]; error: string | null } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { plan: [], error: null };

  const header = splitLine(lines[0]).map(headerKey);
  if (!header.includes("email")) {
    return {
      plan: [],
      error: "The first row needs an “email” column header (plus any of: group, offsite, exec1–exec4).",
    };
  }
  if (!header.some((h) => h !== null && h !== "email")) {
    return { plan: [], error: "No group, offsite or exec1–exec4 columns found in the header row." };
  }
  const emailAt = header.indexOf("email");

  const plan: Planned[] = lines.slice(1).map((line, i) => {
    const cells = splitLine(line);
    const lineNo = i + 2;
    const email = normalizeEmail(cells[emailAt] ?? "");
    const existing = current.get(email);
    if (!existing) return { kind: "unknown", line: lineNo, email: email || "(blank email)" };

    const problems: string[] = [];
    const changes: Change[] = [];
    header.forEach((key, col) => {
      if (key === null || key === "email") return;
      const raw = (cells[col] ?? "").trim();
      if (raw === "") return; // blank = leave as is
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        problems.push(`${COLUMNS[key].label} "${raw}" isn't a whole number`);
        return;
      }
      if (existing[key] === n) return;
      const prefix = COLUMNS[key].prefix;
      changes.push({
        column: key,
        from: existing[key],
        to: n,
        warning: prefix && !sessionIds.has(`${prefix}_${n}`) ? `no session ${prefix}_${n}` : null,
      });
    });
    const name = [existing.firstName, existing.lastName].filter(Boolean).join(" ") || email;
    if (problems.length) return { kind: "invalid", line: lineNo, email, problems };
    if (changes.length === 0) return { kind: "same", line: lineNo, email, name };
    return { kind: "update", line: lineNo, email, name, changes };
  });

  return { plan, error: null };
}

/** Paste attendee schedule numbers from a spreadsheet, preview, then save. */
export default function BulkSchedulePaste({
  hasUnsavedEdits,
  onSaved,
}: {
  hasUnsavedEdits: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [current, setCurrent] = useState<Map<string, Current> | null>(null);
  const [sessionIds, setSessionIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ saved: number; failed: string[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      supabase.from("attendeeProfile").select(`email, firstName, lastName, ${COLUMN_NAMES.join(", ")}`),
      supabase.from("scheduleOptions").select("optionID"),
    ]).then(([a, s]) => {
      if (cancelled) return;
      const failed = a.error ?? s.error;
      setLoadError(failed ? `Could not load current schedules: ${failed.message}` : null);
      if (!a.error) {
        const rows = (a.data ?? []) as unknown as Current[];
        setCurrent(new Map(rows.map((r) => [normalizeEmail(r.email), r])));
      }
      if (!s.error) setSessionIds(new Set((s.data ?? []).map((r) => String(r.optionID))));
    });
    return () => {
      cancelled = true;
    };
  }, [open, result]);

  useEffect(() => {
    if (!open || saving) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving]);

  const { plan, error } = useMemo(
    () => (current ? planPaste(text, current, sessionIds) : { plan: [], error: null }),
    [text, current, sessionIds]
  );
  const updates = plan.filter((p): p is Extract<Planned, { kind: "update" }> => p.kind === "update");
  const unknown = plan.filter((p) => p.kind === "unknown");
  const invalid = plan.filter((p) => p.kind === "invalid");
  const same = plan.filter((p) => p.kind === "same").length;
  const warnings = updates.reduce((n, u) => n + u.changes.filter((c) => c.warning).length, 0);

  function start() {
    if (
      hasUnsavedEdits &&
      !window.confirm("The table below has unsaved edits. Importing reloads it and discards them. Continue?")
    ) {
      return;
    }
    setText("");
    setResult(null);
    setOpen(true);
  }

  async function apply() {
    setSaving({ done: 0, total: updates.length });
    let saved = 0;
    const failed: string[] = [];
    for (const [i, u] of updates.entries()) {
      const patch = Object.fromEntries(u.changes.map((c) => [c.column, c.to]));
      const { data, error: saveError } = await supabase
        .from("attendeeProfile")
        .update(patch)
        .eq("email", u.email)
        .select("email");
      if (saveError || !data || data.length === 0) {
        failed.push(`${u.name}: ${saveError?.message ?? "not saved (no permission?)"}`);
      } else {
        saved++;
      }
      setSaving({ done: i + 1, total: updates.length });
    }
    setSaving(null);
    setResult({ saved, failed });
    setText("");
    if (saved > 0) onSaved();
  }

  return (
    <>
      <button className="btn" onClick={start}>
        Paste from spreadsheet…
      </button>
      {open &&
        createPortal(
          <div className="backdrop" onMouseDown={() => !saving && setOpen(false)}>
            <div
              className="dialog bulk"
              role="dialog"
              aria-modal="true"
              aria-label="Paste attendee schedules"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2>Paste attendee schedules</h2>
              <p className="muted bulk-help">
                Copy rows from Google Sheets or Excel, including a header row with <code>email</code>{" "}
                and any of <code>group</code>, <code>offsite</code>, <code>exec1</code>–<code>exec4</code>.
                Blank cells are left as they are. Attendees are matched by email; nobody is added or
                removed.
              </p>

              {result ? (
                <div className="bulk-result">
                  <p>
                    <strong>
                      Saved {result.saved} attendee{result.saved === 1 ? "" : "s"}.
                    </strong>
                  </p>
                  {result.failed.length > 0 && (
                    <div className="bulk-failed" role="alert">
                      {result.failed.length} failed:
                      <ul>
                        {result.failed.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="dialog-actions">
                    <span className="muted" />
                    <button className="btn" onClick={() => setResult(null)}>
                      Paste more
                    </button>
                    <button className="btn primary" onClick={() => setOpen(false)}>
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    autoFocus
                    name="bulk-paste"
                    rows={8}
                    placeholder={"email\toffsite\texec1\texec2\texec3\texec4\nab1234@princeton.edu\t3\t2\t1\t4\t2"}
                    value={text}
                    disabled={saving !== null}
                    onChange={(e) => setText(e.target.value)}
                  />

                  {loadError && <p className="gate-error">{loadError}</p>}
                  {error && <p className="gate-error">{error}</p>}

                  {plan.length > 0 && (
                    <>
                      <p className="bulk-summary">
                        <strong>{updates.length}</strong> to update · {same} already match
                        {unknown.length > 0 && (
                          <>
                            {" "}
                            · <span className="bad">{unknown.length} unknown email{unknown.length === 1 ? "" : "s"}</span>
                          </>
                        )}
                        {invalid.length > 0 && (
                          <>
                            {" "}
                            · <span className="bad">{invalid.length} with bad values</span>
                          </>
                        )}
                        {warnings > 0 && (
                          <>
                            {" "}
                            ·{" "}
                            <span className="warnish">
                              {warnings} number{warnings === 1 ? "" : "s"} with no matching session
                            </span>
                          </>
                        )}
                      </p>
                      <div className="bulk-preview">
                        <table>
                          <tbody>
                            {[...invalid, ...unknown, ...updates].map((p) => (
                              <tr key={`${p.line}-${p.email}`} className={p.kind}>
                                <td className="muted">Row {p.line}</td>
                                <td>{p.kind === "update" ? p.name : p.email}</td>
                                <td>
                                  {p.kind === "unknown" && "Not in the attendee list: skipped"}
                                  {p.kind === "invalid" && `${p.problems.join("; ")}: skipped`}
                                  {p.kind === "update" &&
                                    p.changes.map((c) => (
                                      <span
                                        key={c.column}
                                        className={c.warning ? "bulk-change warn" : "bulk-change"}
                                        title={c.warning ?? undefined}
                                      >
                                        {COLUMNS[c.column].label} {c.from ?? "—"} → <strong>{c.to}</strong>
                                        {c.warning && " ⚠"}
                                      </span>
                                    ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <div className="dialog-actions">
                    <span className="muted">
                      {saving
                        ? `Saving ${saving.done} of ${saving.total}…`
                        : "⚠ = no session with that number exists yet"}
                    </span>
                    <button className="btn" disabled={saving !== null} onClick={() => setOpen(false)}>
                      Cancel
                    </button>
                    <button
                      className="btn primary"
                      disabled={saving !== null || updates.length === 0}
                      onClick={() => void apply()}
                    >
                      {saving ? "Saving…" : `Save ${updates.length} attendee${updates.length === 1 ? "" : "s"}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
