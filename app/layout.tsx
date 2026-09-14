import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASHURA - Next-Gen AI Desktop Assistant",
  description: "ASHURA — Autonomous AI Desktop Assistant with 3D Chibi Avatar, Live Web Search, and Situational Intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
