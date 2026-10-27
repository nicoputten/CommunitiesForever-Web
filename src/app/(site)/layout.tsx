import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";
import { nowSeconds } from "@/app/clock";
import { getSiteInfo } from "@/app/site";
import { getViewer } from "@/app/viewer";
import { SiteShell } from "@/components/shell/SiteShell";

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
    >
      {children}
    </SiteShell>
  );
}
