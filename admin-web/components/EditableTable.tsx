"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { supabase } from "@/lib/supabase";
import type { Column, TableConfig } from "@/lib/tables";

type Row = Record<string, unknown>;
type Drafts = Record<string, Row>;
type Toast = { id: number; kind: "ok" | "error"; text: string };

// --- Value conversion --------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** timestamptz → value for <input type="datetime-local"> in the editor's zone. */
function toLocalInput(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function toInputValue(column: Column, value: unknown) {
  if (value === null || value === undefined) return "";
  if (column.type === "datetime") return toLocalInput(value);
  return String(value);
}

/** Input string → database value. Empty means null. */
function fromInputValue(column: Column, raw: string): unknown {
  if (raw.trim() === "") return null;
  if (column.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (column.type === "datetime") return new Date(raw).toISOString();
  return raw;
}

function sameValue(column: Column, a: unknown, b: unknown) {
  return toInputValue(column, a) === toInputValue(column, b);
}

const dateLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** How a stored value reads in the table. Null means empty. */
function displayValue(column: Column, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (column.type === "datetime") {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return `${dateLabel.format(d)} · ${timeLabel.format(d)}`;
  }
  return String(value);
}

function inputType(column: Column) {
  if (column.type === "number") return "number";
  if (column.type === "datetime") return "datetime-local";
  return "text";
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function describeError(message: string) {
  if (/row-level security|permission denied|Only editors/i.test(message)) {
    return "You don't have permission to make this change.";
  }
  if (/duplicate key/i.test(message)) {
    return "That ID is already taken.";
  }
  return message;
}

// --- Cells -------------------------------------------------------------------

function LongTextDialog({
  label,
  value,
  onChange,
  onDone,
  onCancel,
}: {
  label: string;
  value: string;
  onChange: (raw: string) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Clicking the backdrop keeps the text: losing a half-written bio to a
  // stray click is worse than an extra Undo.
  return (
    <div className="backdrop" onMouseDown={onDone}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>{label}</h2>
        <textarea
          autoFocus
          rows={12}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onDone();
          }}
        />
        <div className="dialog-actions">
          <span className="muted">⌘ Enter to finish · Esc to cancel</span>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Reads as text; turns into an input (or a dialog for long text) on click. */
function Cell({
  column,
  value,
  original,
  editable,
  isKey,
  disabled,
  onChange,
}: {
  column: Column;
  value: unknown;
  original: unknown;
  editable: boolean;
  isKey: boolean;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "expand">("view");
  const before = useRef<unknown>(value);
  const button = useRef<HTMLButtonElement>(null);

  const text = displayValue(column, value);
  const shown = (
    <span className={text === null ? "placeholder" : "text"}>{text ?? "—"}</span>
  );

  if (!editable) {
    return (
      <td
        className={isKey ? "cell readonly key" : "cell readonly"}
        title={column.hint}
      >
        {shown}
      </td>
    );
  }

  const changed = !sameValue(column, value, original);
  const className = [
    "cell",
    column.type === "longtext" && "long",
    changed && "changed",
  ]
    .filter(Boolean)
    .join(" ");

  function open() {
    before.current = value;
    setMode(column.type === "longtext" ? "expand" : "edit");
  }

  /** Closes the editor and hands keyboard focus back to the cell. Not used on
   * plain blur, so clicking or tabbing to another cell keeps its focus. */
  function close() {
    setMode("view");
    window.setTimeout(() => button.current?.focus());
  }

  function cancel() {
    onChange(before.current);
    close();
  }

  return (
    <td
      className={className}
      title={
        changed
          ? `Was: ${displayValue(column, original) ?? "empty"}`
          : column.hint
      }
    >
      {mode === "edit" ? (
        <input
          autoFocus
          name={column.name}
          aria-label={column.label}
          type={inputType(column)}
          value={toInputValue(column, value)}
          onChange={(e) => onChange(fromInputValue(column, e.target.value))}
          onBlur={() => setMode("view")}
          onKeyDown={(e) => {
            if (e.key === "Enter") close();
            else if (e.key === "Escape") cancel();
          }}
        />
      ) : (
        <button
          ref={button}
          type="button"
          className="cell-view"
          disabled={disabled}
          aria-label={`${column.label}: ${text ?? "empty"}${
            changed ? " (edited)" : ""
          }`}
          onClick={open}
        >
          {shown}
        </button>
      )}
      {mode === "expand" &&
        createPortal(
          <LongTextDialog
            label={column.label}
            value={toInputValue(column, value)}
            onChange={(raw) => onChange(fromInputValue(column, raw))}
            onDone={close}
            onCancel={cancel}
          />,
          document.body
        )}
    </td>
  );
}

// --- Component ---------------------------------------------------------------

export default function EditableTable({
  config,
  onDirtyChange,
}: {
  config: TableConfig;
  /** Reports how many rows have unsaved changes. */
  onDirtyChange?: (table: string, rows: number) => void;
}) {
  const { table, key, columns } = config;
  const selectList = columns.map((c) => c.name).join(",");

  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [newRow, setNewRow] = useState<Row | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToast = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  /** Successes fade on their own; errors stay until dismissed. */
  const notify = useCallback(
    (kind: Toast["kind"], text: string) => {
      const id = ++nextToast.current;
      setToasts((current) => [...current.slice(-2), { id, kind, text }]);
      if (kind === "ok") window.setTimeout(() => dismiss(id), 3500);
    },
    [dismiss]
  );

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(table).select(selectList);
    for (const order of config.orderBy) {
      query = query.order(order.column, {
        ascending: order.ascending ?? true,
        nullsFirst: false,
      });
    }
    const { data, error } = await query;
    if (error) {
      notify("error", `Could not load: ${error.message}`);
    } else {
      setRows((data ?? []) as unknown as Row[]);
      setDrafts({});
    }
    setLoading(false);
  }, [table, selectList, config.orderBy, notify]);

  useEffect(() => {
    setNewRow(null);
    setSearch("");
    setToasts([]);
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      config.searchColumns.some((name) =>
        String(row[name] ?? "")
          .toLowerCase()
          .includes(term)
      )
    );
  }, [rows, search, config.searchColumns]);

  /** Only the columns that actually changed, so concurrent edits survive. */
  function changesFor(row: Row): Row {
    const draft = drafts[String(row[key])];
    if (!draft) return {};
    const changes: Row = {};
    for (const column of columns) {
      if (
        column.name in draft &&
        !sameValue(column, draft[column.name], row[column.name])
      ) {
        changes[column.name] = draft[column.name];
      }
    }
    return changes;
  }

  const dirtyRows = rows.filter((row) => Object.keys(changesFor(row)).length > 0);
  const changedCells = dirtyRows.reduce(
    (sum, row) => sum + Object.keys(changesFor(row)).length,
    0
  );

  useEffect(() => {
    onDirtyChange?.(table, dirtyRows.length);
  }, [onDirtyChange, table, dirtyRows.length]);

  useEffect(() => {
    if (dirtyRows.length === 0) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyRows.length]);

  function setDraft(row: Row, column: Column, value: unknown) {
    const id = String(row[key]);
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [column.name]: value },
    }));
  }

  function revert(row: Row) {
    const id = String(row[key]);
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function reload() {
    if (
      dirtyRows.length > 0 &&
      !window.confirm("Reload and discard your unsaved changes?")
    ) {
      return;
    }
    void load();
  }

  async function saveRows(targets: Row[]) {
    setBusy(true);
    let saved = 0;
    const failures: string[] = [];

    for (const row of targets) {
      const changes = changesFor(row);
      if (Object.keys(changes).length === 0) continue;

      // .select() makes an RLS-blocked update visible (it returns 0 rows).
      const { data, error } = await supabase
        .from(table)
        .update(changes)
        .eq(key, row[key] as string)
        .select(selectList);

      if (error || !data || data.length === 0) {
        failures.push(
          `${String(row[key])}: ${describeError(
            error?.message ?? "Not saved (no permission?)"
          )}`
        );
        continue;
      }

      const updated = data[0] as unknown as Row;
      setRows((current) =>
        current.map((r) => (r[key] === row[key] ? updated : r))
      );
      revert(row);
      saved++;
    }

    setBusy(false);
    if (saved) notify("ok", `Saved ${plural(saved, "row")}.`);
    if (failures.length) notify("error", failures.join("\n"));
  }

  async function deleteRow(row: Row) {
    const label = String(row[key]);
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    setBusy(true);
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq(key, row[key] as string)
      .select(key);
    setBusy(false);
    if (error || !data || data.length === 0) {
      notify(
        "error",
        describeError(error?.message ?? "Not deleted (no permission?)")
      );
      return;
    }
    setRows((current) => current.filter((r) => r[key] !== row[key]));
    notify("ok", `Deleted ${label}.`);
  }

  async function insertRow() {
    if (!newRow) return;
    if (!newRow[key]) {
      notify("error", `${key} is required.`);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from(table)
      .insert(newRow)
      .select(selectList);
    setBusy(false);
    if (error || !data || data.length === 0) {
      notify(
        "error",
        describeError(error?.message ?? "Not added (no permission?)")
      );
      return;
    }
    setRows((current) => [...current, data[0] as unknown as Row]);
    setNewRow(null);
    notify("ok", `Added ${String(newRow[key])}.`);
  }

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
            name="search"
            aria-label="Search rows"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="count">
          {loading ? "Loading…" : `${visibleRows.length} of ${rows.length}`}
        </span>
        <div className="spacer" />
        {config.allowInsert && !newRow && (
          <button className="btn" disabled={busy} onClick={() => setNewRow({})}>
            + Add row
          </button>
        )}
        <button className="btn" disabled={busy || loading} onClick={reload}>
          Reload
        </button>
      </div>

      {config.description && (
        <p className="description">{config.description}</p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.name}
                  style={{ minWidth: column.width }}
                  title={column.hint}
                >
                  {column.label}
                  {column.hint && <span className="hint-dot">?</span>}
                </th>
              ))}
              <th className="actions-col" />
            </tr>
          </thead>
          <tbody>
            {newRow && (
              <tr className="new-row">
                {columns.map((column) => (
                  <td key={column.name}>
                    {column.type === "longtext" ? (
                      <textarea
                        rows={2}
                        name={column.name}
                        aria-label={column.label}
                        disabled={busy}
                        value={toInputValue(column, newRow[column.name])}
                        onChange={(e) =>
                          setNewRow((current) => ({
                            ...current,
                            [column.name]: fromInputValue(column, e.target.value),
                          }))
                        }
                      />
                    ) : (
                      <input
                        name={column.name}
                        aria-label={column.label}
                        type={inputType(column)}
                        disabled={busy || column.editable === false}
                        value={toInputValue(column, newRow[column.name])}
                        onChange={(e) =>
                          setNewRow((current) => ({
                            ...current,
                            [column.name]: fromInputValue(column, e.target.value),
                          }))
                        }
                      />
                    )}
                  </td>
                ))}
                <td className="actions">
                  <button
                    className="btn primary small"
                    disabled={busy}
                    onClick={() => void insertRow()}
                  >
                    Add
                  </button>
                  <button
                    className="btn small"
                    disabled={busy}
                    onClick={() => setNewRow(null)}
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            )}

            {visibleRows.map((row) => {
              const id = String(row[key]);
              const draft = drafts[id] ?? {};
              const dirty = Object.keys(changesFor(row)).length > 0;
              return (
                <tr key={id} className={dirty ? "dirty" : undefined}>
                  {columns.map((column) => (
                    <Cell
                      key={column.name}
                      column={column}
                      value={
                        column.name in draft
                          ? draft[column.name]
                          : row[column.name]
                      }
                      original={row[column.name]}
                      editable={column.editable !== false && column.name !== key}
                      isKey={column.name === key}
                      disabled={busy}
                      onChange={(value) => setDraft(row, column, value)}
                    />
                  ))}
                  <td className="actions">
                    {dirty && (
                      <>
                        <button
                          className="btn primary small"
                          disabled={busy}
                          onClick={() => void saveRows([row])}
                        >
                          Save
                        </button>
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() => revert(row)}
                        >
                          Undo
                        </button>
                      </>
                    )}
                    {config.allowDelete && !dirty && (
                      <button
                        className="btn small danger"
                        disabled={busy}
                        onClick={() => void deleteRow(row)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {!loading && visibleRows.length === 0 && (
              <tr>
                <td className="empty" colSpan={columns.length + 1}>
                  {search.trim()
                    ? `Nothing matches “${search.trim()}”.`
                    : "No rows yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dirtyRows.length > 0 && (
        <div className="savebar" role="region" aria-label="Unsaved changes">
          <div className="savebar-inner">
            <span className="savebar-mark" aria-hidden="true" />
            <span className="savebar-text" aria-live="polite">
              <strong>{plural(changedCells, "unsaved change")}</strong>
              <span className="savebar-sub">
                {" "}
                in {plural(dirtyRows.length, "row")}
              </span>
            </span>
            <button
              className="btn ghost"
              disabled={busy}
              onClick={() => setDrafts({})}
            >
              Discard
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void saveRows(dirtyRows)}
            >
              {busy ? "Saving…" : "Save all"}
            </button>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast ${toast.kind}`}
              role={toast.kind === "error" ? "alert" : "status"}
            >
              <svg
                className="toast-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                {toast.kind === "ok" ? (
                  <path
                    d="m3.5 8.5 3 3 6-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M8 4.5v4.25M8 11.25v.25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <span className="toast-text">{toast.text}</span>
              <button
                className="toast-close"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="m2.5 2.5 7 7m0-7-7 7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
