import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRUX — AI transparency pilot",
  description: "Open evidence and provenance for organisational AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
