import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "@/styles/fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "CommunitiesForever",
  description: "Where everyone is, who plays what, and who can craft what.",
};

// The app shell lives in (site)/layout.tsx, so pages outside that group (sign-in) render without it.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
