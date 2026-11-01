// Session times are stored in UTC. Editors think in conference time, so the
// portal always shows and accepts America/New_York wall-clock time, no matter
// what time zone the editor's laptop is set to.
export const CONFERENCE_TZ = "America/New_York";

function easternParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CONFERENCE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC timestamp → "YYYY-MM-DDTHH:mm" in Eastern time (for datetime-local inputs). */
export function toEasternInput(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = easternParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** "YYYY-MM-DDTHH:mm" in Eastern time → UTC ISO string. */
export function fromEasternInput(raw: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Eastern's offset from UTC at that moment (handles daylight saving).
  const offsetAt = (ms: number) => {
    const p = easternParts(new Date(ms));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms;
  };
  let utc = wallAsUtc - offsetAt(wallAsUtc);
  utc = wallAsUtc - offsetAt(utc);
  return new Date(utc).toISOString();
}

const dateLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: CONFERENCE_TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("en-US", {
  timeZone: CONFERENCE_TZ,
  hour: "numeric",
  minute: "2-digit",
});

/** "Fri, Nov 6 · 9:00 AM" in Eastern time. */
export function formatEastern(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${dateLabel.format(d)} · ${timeLabel.format(d)}`;
}
