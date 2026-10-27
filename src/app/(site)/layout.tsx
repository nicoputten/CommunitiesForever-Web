import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";
import { nowSeconds } from "@/app/clock";
import { getSiteInfo } from "@/app/site";
import { getViewer } from "@/app/viewer";
import { SiteShell } from "@/components/shell/SiteShell";
import { TimeZoneSync } from "@/components/shell/TimeZoneSync";
import { getDb } from "@/server/db";
import { timeZoneFor } from "@/server/discord";
import { joinableUnanswered } from "@/core/views/runs";
import { runsInput } from "@/server/runsInput";
import { browserTimeZoneAction } from "./discord/actions";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { name } = getSiteInfo();
  return { title: { default: name, template: `%s · ${name}` } };
}

/** Every page with the app shell: rendered per request, since it shows the data's age and the signed-in user. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  await connection();
  const viewer = await getViewer();
  const site = getSiteInfo();
  return (
    <SiteShell
      siteName={site.name}
      lastUploadAt={site.lastUploadAt}
      now={nowSeconds()}
      viewer={viewer}
      signOut={signOut}
      {...(viewer === undefined
        ? {}
        : { runsBadge: joinableUnanswered(runsInput(getDb(), viewer.battleTag, nowSeconds())) })}
    >
      {/* WEB-39: the browser's time zone, once, until one is stored. */}
      {viewer !== undefined && timeZoneFor(getDb(), viewer.battleTag) === undefined && (
        <TimeZoneSync action={browserTimeZoneAction} />
      )}
      {children}
    </SiteShell>
  );
}
