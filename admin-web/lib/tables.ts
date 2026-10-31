/**
 * "speakers": comma-separated speakerProfile IDs, edited with a search picker.
 * "select": one of `options` (the app matches these values exactly).
 * "datetime": always shown and entered in Eastern time.
 */
export type ColumnType = "text" | "longtext" | "number" | "datetime" | "speakers" | "select";

export type Column = {
  name: string;
  label: string;
  type: ColumnType;
  /** Defaults to true. The key column is only editable on new rows. */
  editable?: boolean;
  hint?: string;
  width?: number;
  /** For "select" columns. Existing values outside the list still show, flagged. */
  options?: { value: string; label: string }[];
  /** Number columns that pick a session: warn unless `<prefix>_<value>` exists. */
  sessionPrefix?: string;
};

export type TableConfig = {
  table: string;
  key: string;
  columns: Column[];
  orderBy: { column: string; ascending?: boolean }[];
  allowInsert: boolean;
  allowDelete: boolean;
  searchColumns: string[];
  description?: string;
};

const DAY_OPTIONS = [
  { value: "day1", label: "day1" },
  { value: "day2", label: "day2" },
  { value: "day3", label: "day3" },
];

const speakerColumns: Column[] = [
  {
    name: "id",
    label: "ID",
    type: "text",
    width: 90,
    hint: "Referenced from a session's Speaker IDs",
  },
  { name: "firstName", label: "First name", type: "text", width: 130 },
  { name: "lastName", label: "Last name", type: "text", width: 130 },
  { name: "company", label: "Company", type: "text", width: 160 },
  { name: "title", label: "Title", type: "text", width: 180 },
  { name: "day", label: "Day", type: "select", width: 90, options: DAY_OPTIONS },
  { name: "event", label: "Event", type: "text", width: 160 },
  { name: "linkedin", label: "LinkedIn", type: "text", width: 200 },
  { name: "bio", label: "Bio", type: "longtext", width: 320 },
];

function speakerTable(table: string, description: string): TableConfig {
  return {
    table,
    key: "id",
    columns: speakerColumns,
    orderBy: [{ column: "lastName" }, { column: "firstName" }],
    allowInsert: true,
    allowDelete: true,
    searchColumns: ["id", "firstName", "lastName", "company"],
    description,
  };
}

export const SCHEDULE: TableConfig = {
  table: "scheduleOptions",
  key: "optionID",
  // `emails` (check-ins) is deliberately absent: attendance is managed in the
  // app, and saves only send changed columns so check-ins are never touched.
  columns: [
    {
      name: "optionID",
      label: "Option ID",
      type: "text",
      width: 110,
      hint: "e.g. exec1_2: attendees whose Exec 1 is 2 see it. type 'all' rows show for everyone",
    },
    { name: "title", label: "Title", type: "text", width: 240 },
    {
      name: "type",
      label: "Type",
      type: "select",
      width: 120,
      hint: "all: on everyone's schedule. seminar/workshop: only attendees whose exec/offsite number matches the option ID (the app also checks registration for seminar)",
      options: [
        { value: "all", label: "all" },
        { value: "seminar", label: "seminar" },
        { value: "workshop", label: "workshop" },
        { value: "group", label: "group" },
      ],
    },
    { name: "day", label: "Day", type: "select", width: 90, options: DAY_OPTIONS },
    { name: "startTime", label: "Start (ET)", type: "datetime", width: 190 },
    { name: "endTime", label: "End (ET)", type: "datetime", width: 190 },
    { name: "location", label: "Location", type: "text", width: 160 },
    {
      name: "idSpeaker",
      label: "Speakers",
      type: "speakers",
      width: 200,
      hint: "Pick from the speaker list (saved as comma-separated speaker IDs)",
    },
    { name: "eventNumber", label: "Event #", type: "number", width: 80 },
    {
      name: "numberAttendees",
      label: "# Attendees",
      type: "number",
      width: 100,
    },
  ],
  orderBy: [{ column: "startTime" }, { column: "title" }],
  allowInsert: true,
  allowDelete: true,
  searchColumns: ["optionID", "title", "location", "day", "type"],
};

export const SPEAKER_TABLES: { label: string; config: TableConfig }[] = [
  {
    label: "Speakers (shown in app)",
    config: speakerTable(
      "speakerProfile",
      "The app looks speakers up here by the IDs listed on each session."
    ),
  },
  {
    label: "speakerProfileAll",
    config: speakerTable(
      "speakerProfileAll",
      "Not currently read by the app."
    ),
  },
  {
    label: "speakerProfileSem",
    config: speakerTable(
      "speakerProfileSem",
      "Not currently read by the app."
    ),
  },
];

export const ATTENDEE_SCHEDULES: TableConfig = {
  table: "attendeeProfile",
  key: "email",
  columns: [
    { name: "email", label: "Email", type: "text", width: 220 },
    {
      name: "firstName",
      label: "First name",
      type: "text",
      editable: false,
      width: 120,
    },
    {
      name: "lastName",
      label: "Last name",
      type: "text",
      editable: false,
      width: 120,
    },
    { name: "groupNumber", label: "Group", type: "number", width: 80 },
    {
      name: "offsite",
      label: "Offsite",
      type: "number",
      width: 80,
      hint: "Matches offsite_<n>",
      sessionPrefix: "offsite",
    },
    {
      name: "exec1",
      label: "Exec 1",
      type: "number",
      width: 80,
      hint: "Matches exec1_<n>",
      sessionPrefix: "exec1",
    },
    { name: "exec2", label: "Exec 2", type: "number", width: 80, sessionPrefix: "exec2" },
    { name: "exec3", label: "Exec 3", type: "number", width: 80, sessionPrefix: "exec3" },
    { name: "exec4", label: "Exec 4", type: "number", width: 80, sessionPrefix: "exec4" },
  ],
  orderBy: [{ column: "lastName" }, { column: "firstName" }],
  allowInsert: false,
  allowDelete: false,
  searchColumns: ["email", "firstName", "lastName"],
  description:
    "Each number picks the session with option ID <column>_<number>. Profiles themselves are managed elsewhere.",
};
