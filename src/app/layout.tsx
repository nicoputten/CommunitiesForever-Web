import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AmbientMotion } from "@/components/atmosphere/AmbientMotion";
import { MOTION_SCRIPT } from "@/components/atmosphere/motion";
import { fontVariables } from "@/styles/fonts";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "CommunitiesForever",
  description: "Where everyone is, who plays what, and who can craft what.",
};

// The app shell lives in (site)/layout.tsx, so pages outside that group (sign-in) render without it.
// suppressHydrationWarning: MOTION_SCRIPT may set data-motion on <html> before React hydrates.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* The stored Motion setting, applied before first paint (WEB-16). A constant script, no data in it. */}
        <script dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
      </head>
      <body>
        <AmbientMotion />
        {children}
      </body>
    </html>
  );
}
