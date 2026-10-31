"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SpeakerOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
};

/** Same format the app reads: comma-separated IDs, split on "," and trimmed. */
export function parseSpeakerIds(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
}

export function joinSpeakerIds(ids: string[]): string | null {
  return ids.length ? ids.join(",") : null;
}

export function speakerName(speaker: SpeakerOption) {
  return (
    [speaker.firstName, speaker.lastName].filter(Boolean).join(" ") ||
    "Name not set"
  );
}

/** "Blair Effron, Tony Yoseloff" for a stored idSpeaker value; unknown IDs show as-is. */
export function describeSpeakers(
  value: unknown,
  byId: Map<string, SpeakerOption>
): string | null {
  const ids = parseSpeakerIds(value);
  if (ids.length === 0) return null;
  return ids
    .map((id) => {
      const speaker = byId.get(id);
      return speaker ? speakerName(speaker) : `${id} (not found)`;
    })
    .join(", ");
}

/** Search-and-click replacement for typing speaker IDs by hand. */
export function SpeakerDialog({
  label,
  value,
  speakers,
  onChange,
  onDone,
  onCancel,
}: {
  label: string;
  value: unknown;
  speakers: SpeakerOption[];
  onChange: (value: string | null) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => parseSpeakerIds(value), [value]);
  const byId = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return speakers
      .filter((s) => !selected.includes(s.id))
      .filter(
        (s) =>
          !term ||
          [s.id, s.firstName, s.lastName, s.company]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(term))
      )
      .slice(0, 50);
  }, [speakers, selected, query]);

  function add(id: string) {
    onChange(joinSpeakerIds([...selected, id]));
    setQuery("");
    search.current?.focus();
  }

  function remove(id: string) {
    onChange(joinSpeakerIds(selected.filter((s) => s !== id)));
  }

  return (
    <div className="backdrop" onMouseDown={onDone}>
      <div
        className="dialog picker"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>{label}</h2>

        {selected.length === 0 ? (
          <p className="muted picker-empty">No speakers on this session.</p>
        ) : (
          <ul className="picker-selected">
            {selected.map((id) => {
              const speaker = byId.get(id);
              return (
                <li key={id} className={speaker ? "pill" : "pill missing"}>
                  <span>
                    {speaker ? speakerName(speaker) : `${id} (not found)`}
                    {speaker?.company && <span className="muted"> · {speaker.company}</span>}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${speaker ? speakerName(speaker) : id}`}
                    onClick={() => remove(id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <label className="search picker-search">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={search}
            autoFocus
            type="search"
            name="speaker-search"
            aria-label="Search speakers"
            placeholder="Search by name, company or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) add(matches[0].id);
            }}
          />
        </label>

        <ul className="picker-results" aria-label="Speakers">
          {matches.length === 0 && (
            <li className="muted picker-none">
              {query.trim() ? `No speaker matches “${query.trim()}”.` : "Every speaker is already added."}
            </li>
          )}
          {matches.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => add(s.id)}>
                <span>
                  <span className={s.firstName || s.lastName ? undefined : "muted"}>{speakerName(s)}</span>
                  {s.company && <span className="muted"> · {s.company}</span>}
                </span>
                <code>{s.id}</code>
              </button>
            </li>
          ))}
        </ul>

        <div className="dialog-actions">
          <span className="muted">Enter adds the top match · Esc to cancel</span>
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
