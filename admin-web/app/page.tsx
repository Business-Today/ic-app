"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import EditableTable from "@/components/EditableTable";
import { ALLOWED_DOMAIN, isAllowedDomain, supabase } from "@/lib/supabase";
import { ATTENDEE_SCHEDULES, SCHEDULE, SPEAKER_TABLES } from "@/lib/tables";

type Tab = "schedule" | "speakers" | "attendees";
type Access = "checking" | "editor" | "denied";

const TABS: { value: Tab; label: string; blurb: string }[] = [
  {
    value: "schedule",
    label: "Schedule",
    blurb: "Sessions, times and rooms as they appear in the app.",
  },
  {
    value: "speakers",
    label: "Speakers",
    blurb: "Speaker profiles for each part of the conference.",
  },
  {
    value: "attendees",
    label: "Attendee schedules",
    blurb: "Which group, offsite and exec sessions each attendee is in.",
  },
];

/** Front-page layout shared by the sign-in and not-approved screens. */
function Gate({ children }: { children: React.ReactNode }) {
  return (
    <main className="gate">
      <div className="gate-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="gate-logo"
          src="/businesstoday_logo.png"
          alt="Business Today"
        />
        <h1 className="nameplate">IC Editor</h1>
        <p className="folio">
          <span>International Conference</span>
          <span>Princeton University</span>
        </p>
        <div className="gate-body">{children}</div>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [access, setAccess] = useState<Access>("checking");
  const [tab, setTab] = useState<Tab>("schedule");
  const [speakerIndex, setSpeakerIndex] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  // Unsaved row counts per table. Every table stays mounted, so switching
  // tabs keeps drafts; these drive the dots on the tabs.
  const [dirty, setDirty] = useState<Record<string, number>>({});

  const markDirty = useCallback((table: string, rows: number) => {
    setDirty((current) =>
      current[table] === rows ? current : { ...current, [table]: rows }
    );
  }, []);

  useEffect(() => {
    // A failed OAuth round trip comes back as ?error_description=… (and in
    // the hash). Surface it instead of silently showing the sign-in card.
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const oauthError =
      params.get("error_description") ?? hash.get("error_description");
    if (oauthError) {
      setAuthError(`Sign-in failed: ${oauthError}`);
      window.history.replaceState(null, "", window.location.pathname);
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const email = session?.user.email ?? null;

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setAccess("checking");

    // The page only decides what to show; the database enforces the same
    // rule on every write.
    if (!isAllowedDomain(email)) {
      setAccess("denied");
      return;
    }
    void supabase.rpc("is_editor").then(({ data, error }) => {
      if (cancelled) return;
      setAccess(!error && data === true ? "editor" : "denied");
    });
    return () => {
      cancelled = true;
    };
  }, [session, email]);

  async function signIn() {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        // Only a hint to Google's account picker; not a security boundary.
        queryParams: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
      },
    });
    if (error) setAuthError(error.message);
  }

  async function signOut() {
    const unsaved = Object.values(dirty).some((rows) => rows > 0);
    if (unsaved && !window.confirm("Sign out and discard unsaved changes?")) {
      return;
    }
    await supabase.auth.signOut();
    setAccess("checking");
    setDirty({});
  }

  if (!ready) {
    return (
      <main className="gate">
        <div className="spinner" aria-label="Loading" />
      </main>
    );
  }

  if (!session) {
    return (
      <Gate>
        <p>
          Edit the schedule, speakers and attendee sessions shown in the
          conference app. Sign in with your @{ALLOWED_DOMAIN} Google account;
          only approved editors can make changes.
        </p>
        <button className="btn google" onClick={() => void signIn()}>
          <GoogleMark />
          Sign in with Google
        </button>
        {authError && <p className="gate-error">{authError}</p>}
      </Gate>
    );
  }

  if (access !== "editor") {
    return (
      <Gate>
        {access === "checking" ? (
          <p>Checking your access…</p>
        ) : (
          <>
            <h2>Not approved yet</h2>
            <p>
              {isAllowedDomain(email)
                ? `${email} isn't on the editor list. Ask an organizer to add you.`
                : `${email} isn't a @${ALLOWED_DOMAIN} account. Sign in with your Princeton Google account.`}
            </p>
          </>
        )}
        <button className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </Gate>
    );
  }

  const tabDirty: Record<Tab, number> = {
    schedule: dirty[SCHEDULE.table] ?? 0,
    speakers: SPEAKER_TABLES.reduce(
      (sum, entry) => sum + (dirty[entry.config.table] ?? 0),
      0
    ),
    attendees: dirty[ATTENDEE_SCHEDULES.table] ?? 0,
  };
  const current = TABS.find((entry) => entry.value === tab)!;

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="masthead-top">
            <div className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/businesstoday_logo.png" alt="Business Today" />
              <span className="brand-rule" aria-hidden="true" />
              <h1 className="brand-product">IC Editor</h1>
            </div>
            <div className="who">
              <span className="who-email">{email}</span>
              <button className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>

          <nav className="tabs" role="tablist">
            {TABS.map(({ value, label }) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "tab active" : "tab"}
                onClick={() => setTab(value)}
              >
                {label}
                {tabDirty[value] > 0 && (
                  <span className="dot" title="Unsaved changes">
                    <span className="sr-only">(unsaved changes)</span>
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="app">
        <p className="page-blurb">{current.blurb}</p>

        <div hidden={tab !== "schedule"}>
          <EditableTable config={SCHEDULE} onDirtyChange={markDirty} />
        </div>

        <div hidden={tab !== "speakers"}>
          <div className="subtabs">
            {SPEAKER_TABLES.map((entry, index) => (
              <button
                key={entry.config.table}
                aria-pressed={speakerIndex === index}
                className={speakerIndex === index ? "chip active" : "chip"}
                onClick={() => setSpeakerIndex(index)}
              >
                {entry.label}
                {(dirty[entry.config.table] ?? 0) > 0 && (
                  <span className="dot" title="Unsaved changes">
                    <span className="sr-only">(unsaved changes)</span>
                  </span>
                )}
              </button>
            ))}
          </div>
          {SPEAKER_TABLES.map((entry, index) => (
            <div key={entry.config.table} hidden={speakerIndex !== index}>
              <EditableTable config={entry.config} onDirtyChange={markDirty} />
            </div>
          ))}
        </div>

        <div hidden={tab !== "attendees"}>
          <EditableTable
            config={ATTENDEE_SCHEDULES}
            onDirtyChange={markDirty}
          />
        </div>
      </main>
    </>
  );
}
