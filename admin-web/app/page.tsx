"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import EditableTable from "@/components/EditableTable";
import { ALLOWED_DOMAIN, isAllowedDomain, supabase } from "@/lib/supabase";
import { ATTENDEE_SCHEDULES, SCHEDULE, SPEAKER_TABLES } from "@/lib/tables";

type Tab = "schedule" | "speakers" | "attendees";
type Access = "checking" | "editor" | "denied";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [access, setAccess] = useState<Access>("checking");
  const [tab, setTab] = useState<Tab>("schedule");
  const [speakerIndex, setSpeakerIndex] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

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
    await supabase.auth.signOut();
    setAccess("checking");
  }

  if (!ready) {
    return <main className="center muted">Loading…</main>;
  }

  if (!session) {
    return (
      <main className="center">
        <div className="card">
          <p className="eyebrow">Business Today · IC</p>
          <h1>Editor portal</h1>
          <p className="muted">
            Sign in with your @{ALLOWED_DOMAIN} Google account. Only approved
            editors can make changes.
          </p>
          <button className="btn primary wide" onClick={() => void signIn()}>
            Sign in with Google
          </button>
          {authError && <p className="message error">{authError}</p>}
        </div>
      </main>
    );
  }

  if (access !== "editor") {
    return (
      <main className="center">
        <div className="card">
          <p className="eyebrow">Business Today · IC</p>
          {access === "checking" ? (
            <p className="muted">Checking access…</p>
          ) : (
            <>
              <h1>Not approved yet</h1>
              <p className="muted">
                {isAllowedDomain(email)
                  ? `${email} isn't on the editor list. Ask an organizer to add you.`
                  : `${email} isn't a @${ALLOWED_DOMAIN} account. Sign in with your Princeton Google account.`}
              </p>
            </>
          )}
          <button className="btn wide" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">Business Today · IC</p>
          <h1>Editor portal</h1>
        </div>
        <div className="who">
          <span className="muted">{email}</span>
          <button className="btn" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {(
          [
            ["schedule", "Schedule"],
            ["speakers", "Speakers"],
            ["attendees", "Attendee schedules"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "tab active" : "tab"}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "schedule" && <EditableTable config={SCHEDULE} />}

      {tab === "speakers" && (
        <>
          <div className="subtabs">
            {SPEAKER_TABLES.map((entry, index) => (
              <button
                key={entry.config.table}
                className={speakerIndex === index ? "chip active" : "chip"}
                onClick={() => setSpeakerIndex(index)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <EditableTable
            key={SPEAKER_TABLES[speakerIndex].config.table}
            config={SPEAKER_TABLES[speakerIndex].config}
          />
        </>
      )}

      {tab === "attendees" && <EditableTable config={ATTENDEE_SCHEDULES} />}
    </div>
  );
}
