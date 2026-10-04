import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "IC Editor",
  description: "Edit the Business Today IC schedule, speakers, and attendee schedules.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
