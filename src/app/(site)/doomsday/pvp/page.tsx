import type { Metadata } from "next";
import ladder from "@/components/doomsday/Ladder.module.css";
import { FriendChips, PvpDetails } from "@/components/doomsday/ladder";
import { DoomsdayFrame } from "@/components/doomsday/parts";
import { pvpView } from "@/core/views/doomsdayLadder";
import { doomsdayContext } from "../data";
import { NoDoomsday } from "../NoData";

export const metadata: Metadata = { title: "Doomsday · PvP" };

/** Doomsday, PvP (WEB-60, board doomsday-ladder "PvP details"): one friend's kills, ranks, duels and battlegrounds. */
export default async function DoomsdayPvpPage({ searchParams }: { searchParams: Promise<{ friend?: string }> }) {
  const ctx = await doomsdayContext();
  if (ctx === undefined) return <NoDoomsday />;
  const view = pvpView(ctx.snapshot, (await searchParams).friend, ctx.viewerKey);
  return (
    <DoomsdayFrame header={ctx.page.header} tab="pvp">
      <FriendChips label="Friend" friends={view.friends} />
      <h2 className={ladder.section}>PvP details · {view.name}</h2>
      <PvpDetails view={view} />
    </DoomsdayFrame>
  );
}
