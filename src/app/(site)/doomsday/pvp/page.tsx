import type { Metadata } from "next";
import ladder from "@/components/doomsday/Ladder.module.css";
import { FriendChips, PvpDetails } from "@/components/doomsday/ladder";
import { HuntTrophies, HuntWeek } from "@/components/doomsday/hunt";
import huntStyles from "@/components/doomsday/Hunt.module.css";
import { DoomsdayFrame } from "@/components/doomsday/parts";
import { friendHunt, huntTrophies, huntWeek } from "@/core/views/doomsdayHunt";
import { pvpView } from "@/core/views/doomsdayLadder";
import { doomsdayContext } from "../data";
import { NoDoomsday } from "../NoData";

export const metadata: Metadata = { title: "Doomsday · PvP" };

/**
 * Doomsday, PvP (WEB-60, board doomsday-ladder "PvP details"): one friend's kills, ranks, duels and battlegrounds; the
 * friend's Hunt trophies and this week's hunters above them (WEB-110, board DS02HuntMore).
 */
export default async function DoomsdayPvpPage({ searchParams }: { searchParams: Promise<{ friend?: string }> }) {
  const ctx = await doomsdayContext();
  if (ctx === undefined) return <NoDoomsday />;
  const view = pvpView(ctx.snapshot, (await searchParams).friend, ctx.viewerKey);
  const picked = ctx.snapshot.friends.find((f) => f.friendKey === view.friends.find((x) => x.current)?.key);
  const hunt = friendHunt(ctx.hunt, picked?.friendKey);
  return (
    <DoomsdayFrame header={ctx.page.header} tab="pvp">
      <FriendChips label="Friend" friends={view.friends} />
      {picked !== undefined && hunt !== undefined && (
        <div className={huntStyles.pvp}>
          <HuntTrophies view={huntTrophies(ctx.snapshot, picked, hunt.trophies, ctx.timeZone)} />
          <HuntWeek view={huntWeek(ctx.snapshot, ctx.hunt)} />
        </div>
      )}
      <h2 className={ladder.section}>PvP details · {view.name}</h2>
      <PvpDetails view={view} />
    </DoomsdayFrame>
  );
}
