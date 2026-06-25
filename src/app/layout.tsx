import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hearth",
  description: "Self-hosted video conferencing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
