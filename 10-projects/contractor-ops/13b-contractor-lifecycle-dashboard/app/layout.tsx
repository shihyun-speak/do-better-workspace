import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Global Contractor Dashboard",
  description: "Live mirror of the Contractor Tracker sheet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
