import type { Metadata } from "next";
import { DoomsdayFrame } from "@/components/doomsday/parts";
import { TodayContent } from "@/components/doomsday/today";
import { doomsdayData } from "./data";
import { NoDoomsday } from "./NoData";

export const metadata: Metadata = { title: "Doomsday" };

/** Doomsday, Today (WEB-59, board doomsday-today): your goals, the Duel slot, Today so far and the board. */
export default async function DoomsdayTodayPage() {
  const page = await doomsdayData();
  if (page === undefined) return <NoDoomsday />;
  return (
    <DoomsdayFrame header={page.header} tab="today">
      <TodayContent page={page} />
    </DoomsdayFrame>
  );
}
