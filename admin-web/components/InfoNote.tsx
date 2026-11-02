"use client";

import { useEffect, useRef, useState } from "react";

/** A small ⓘ at the right of a toolbar: hover shows the note, click pins it open. */
export default function InfoNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className={open ? "info-note open" : "info-note"}>
      <button
        type="button"
        className="info-button"
        aria-label="About this table"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      <span className="info-pop" role="note">
        {text}
      </span>
    </span>
  );
}
