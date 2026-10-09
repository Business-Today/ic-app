export type ColumnType = "text" | "longtext" | "number" | "datetime";

export type Column = {
  name: string;
  label: string;
  type: ColumnType;
  /** Defaults to true. The key column is only editable on new rows. */
  editable?: boolean;
  hint?: string;
  width?: number;
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
  { name: "day", label: "Day", type: "text", width: 80 },
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
      type: "text",
      width: 90,
      hint: "all, seminar, …",
    },
    { name: "day", label: "Day", type: "text", width: 80 },
    { name: "startTime", label: "Start", type: "datetime", width: 190 },
    { name: "endTime", label: "End", type: "datetime", width: 190 },
    { name: "location", label: "Location", type: "text", width: 160 },
    {
      name: "idSpeaker",
      label: "Speaker IDs",
      type: "text",
      width: 120,
      hint: "Comma-separated speaker IDs",
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
    },
    {
      name: "exec1",
      label: "Exec 1",
      type: "number",
      width: 80,
      hint: "Matches exec1_<n>",
    },
    { name: "exec2", label: "Exec 2", type: "number", width: 80 },
    { name: "exec3", label: "Exec 3", type: "number", width: 80 },
    { name: "exec4", label: "Exec 4", type: "number", width: 80 },
  ],
  orderBy: [{ column: "lastName" }, { column: "firstName" }],
  allowInsert: false,
  allowDelete: false,
  searchColumns: ["email", "firstName", "lastName"],
  description:
    "Each number picks the session with option ID <column>_<number>. Profiles themselves are managed elsewhere.",
};
