import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description: "Web-first personal finance tracker.",
  title: "Money Tracker"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
