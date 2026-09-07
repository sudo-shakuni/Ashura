import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAONE",
  description: "RAONE — personal AI assistant orb interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
