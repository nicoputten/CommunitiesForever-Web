import type { MissionPoolInput } from "@/core/views/missionPool";
import type { MissionPoolPage } from "@/server/hunt";

/** The Mission pool page's view input (WEB-109) from WEB-108's `missionPoolPage`. */
export function poolInput(page: MissionPoolPage): MissionPoolInput {
  return {
    ...page.pool,
    data: {
      recipe: page.tiles,
      days: page.days,
      quarry: page.quarry,
      cards: page.cards,
      targets: page.targets,
      hunters: page.hunters,
    },
  };
}
