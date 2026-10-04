"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { Column, TableConfig } from "@/lib/tables";

type Row = Record<string, unknown>;
type Drafts = Record<string, Row>;

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

function describeError(message: string) {
  if (/row-level security|permission denied|Only editors/i.test(message)) {
    return "You don't have permission to make this change.";
  }
  if (/duplicate key/i.test(message)) {
    return "That ID is already taken.";
  }
  return message;
}

// --- Component ---------------------------------------------------------------

export default function EditableTable({ config }: { config: TableConfig }) {
  const { table, key, columns } = config;
  const selectList = columns.map((c) => c.name).join(",");

  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [newRow, setNewRow] = useState<Row | null>(null);

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
      setMessage({ kind: "error", text: `Could not load: ${error.message}` });
    } else {
      setRows((data ?? []) as unknown as Row[]);
      setDrafts({});
    }
    setLoading(false);
  }, [table, selectList, config.orderBy]);

  useEffect(() => {
    setNewRow(null);
    setSearch("");
    setMessage(null);
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

  function setDraft(row: Row, column: Column, raw: string) {
    const id = String(row[key]);
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [column.name]: fromInputValue(column, raw) },
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

  async function saveRows(targets: Row[]) {
    setBusy(true);
    setMessage(null);
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
    if (failures.length) {
      setMessage({ kind: "error", text: failures.join("\n") });
    } else if (saved) {
      setMessage({
        kind: "ok",
        text: `Saved ${saved} row${saved === 1 ? "" : "s"}.`,
      });
    }
  }

  async function deleteRow(row: Row) {
    const label = String(row[key]);
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq(key, row[key] as string)
      .select(key);
    setBusy(false);
    if (error || !data || data.length === 0) {
      setMessage({
        kind: "error",
        text: describeError(error?.message ?? "Not deleted (no permission?)"),
      });
      return;
    }
    setRows((current) => current.filter((r) => r[key] !== row[key]));
    setMessage({ kind: "ok", text: `Deleted ${label}.` });
  }

  async function insertRow() {
    if (!newRow) return;
    if (!newRow[key]) {
      setMessage({ kind: "error", text: `${key} is required.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase
      .from(table)
      .insert(newRow)
      .select(selectList);
    setBusy(false);
    if (error || !data || data.length === 0) {
      setMessage({
        kind: "error",
        text: describeError(error?.message ?? "Not added (no permission?)"),
      });
      return;
    }
    setRows((current) => [...current, data[0] as unknown as Row]);
    setNewRow(null);
    setMessage({ kind: "ok", text: `Added ${String(newRow[key])}.` });
  }

  function renderInput(
    column: Column,
    value: unknown,
    onChange: (raw: string) => void,
    editable: boolean
  ) {
    const common = {
      value: toInputValue(column, value),
      disabled: !editable || busy,
      title: column.hint,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => onChange(e.target.value),
      "aria-label": column.label,
    };
    if (column.type === "longtext") return <textarea rows={2} {...common} />;
    return (
      <input
        type={
          column.type === "number"
            ? "number"
            : column.type === "datetime"
              ? "datetime-local"
              : "text"
        }
        {...common}
      />
    );
  }

  return (
    <section className="panel">
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="count">
          {loading ? "Loading…" : `${visibleRows.length} of ${rows.length}`}
        </span>
        <div className="spacer" />
        {config.allowInsert && !newRow && (
          <button className="btn" disabled={busy} onClick={() => setNewRow({})}>
            Add row
          </button>
        )}
        <button
          className="btn"
          disabled={busy || loading}
          onClick={() => void load()}
        >
          Reload
        </button>
        <button
          className="btn primary"
          disabled={busy || dirtyRows.length === 0}
          onClick={() => void saveRows(dirtyRows)}
        >
          Save all ({dirtyRows.length})
        </button>
      </div>

      {config.description && (
        <p className="description">{config.description}</p>
      )}

      {message && (
        <p className={`message ${message.kind}`} role="status">
          {message.text}
        </p>
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
                    {renderInput(
                      column,
                      newRow[column.name],
                      (raw) =>
                        setNewRow((current) => ({
                          ...current,
                          [column.name]: fromInputValue(column, raw),
                        })),
                      column.editable !== false
                    )}
                  </td>
                ))}
                <td className="actions">
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => void insertRow()}
                  >
                    Add
                  </button>
                  <button
                    className="btn"
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
                  {columns.map((column) => {
                    const editable =
                      column.editable !== false && column.name !== key;
                    const value =
                      column.name in draft
                        ? draft[column.name]
                        : row[column.name];
                    return (
                      <td key={column.name}>
                        {renderInput(
                          column,
                          value,
                          (raw) => setDraft(row, column, raw),
                          editable
                        )}
                      </td>
                    );
                  })}
                  <td className="actions">
                    {dirty && (
                      <>
                        <button
                          className="btn primary"
                          disabled={busy}
                          onClick={() => void saveRows([row])}
                        >
                          Save
                        </button>
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => revert(row)}
                        >
                          Undo
                        </button>
                      </>
                    )}
                    {config.allowDelete && !dirty && (
                      <button
                        className="btn danger"
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
          </tbody>
        </table>
      </div>
    </section>
  );
}
