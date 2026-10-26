import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSiteInfo } from "@/app/site";
import { getViewer } from "@/app/viewer";
import { SignInScene, StateFoot, StatePanel, StateText, Tag } from "@/components/signin/SignIn";
import { GoOn } from "./GoOn";
import { localPath } from "../local-path";

// The "signing in" state (WEB-17, sign-in-states board): where Battle.net sends someone back after the guest list
// check let them in. It shows who came back for a moment, then goes on to the page asked for (?to=, a local path).

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return { title: `Signing in · ${getSiteInfo().name}` };
}

export default async function Welcome({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  await connection();
  const viewer = await getViewer();
  if (viewer === undefined) redirect("/signin");
  const to = localPath((await searchParams).to);
  return (
    <SignInScene>
      <StatePanel
        icon="busy"
        title="Checking the guest list…"
        role="status"
        actions={
          <StateFoot>{to === "/" ? "Then straight to the map" : "Then straight to the page you opened"}</StateFoot>
        }
      >
        <StateText>
          Back from Battle.net as <Tag>{viewer.battleTag}</Tag>
        </StateText>
      </StatePanel>
      <GoOn to={to} />
    </SignInScene>
  );
}
