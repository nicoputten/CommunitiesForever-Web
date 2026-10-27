import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { getFirstUpload } from "@/app/first-upload";
import { adminBattleTag, listGuests } from "@/server/access";
import { getDb } from "@/server/db";
import { getUpload } from "@/server/uploads";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { EmptyMap } from "@/components/map/EmptyMap";
import { WorldMap } from "@/components/map/WorldMap";
import { sameBattleTag } from "@/core/access";
import { parseContinent, worldMap, type WorldMapView } from "@/core/views";

type SearchParams = Record<string, string | string[] | undefined>;

const EMPTY: WorldMapView = { places: [], occupied: {} };

/**
 * The home page: the living world map (WEB-25, boards `map` and `map-states`). The continent (`?continent=`) and the
 * selected character (`?character=`) come from the URL; `?drop=<upload id>` (the session report's link, WEB-26) drops
 * that upload's new sightings in. Before the first upload it is the bare map under the empty-site
 * card and the guest list (WEB-29).
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const data = getDataset();
  const view = data === undefined ? EMPTY : worldMap(data, nowSeconds());
  const character = typeof params.character === "string" ? params.character : undefined;
  const drop = dropped(params.drop);
  return (
    <>
      <Atmosphere variant="map" />
      <h1 className="visually-hidden">Map</h1>
      <WorldMap view={view} continent={parseContinent(params.continent)} selected={character} drop={drop}>
        {data === undefined && <EmptyMap {...await getFirstUpload()} guestList={guestList()} />}
      </WorldMap>
    </>
  );
}

/** The GUIDs an upload saw somewhere new, for `?drop=`; nothing for an unknown id. */
function dropped(param: unknown): string[] | undefined {
  const id = typeof param === "string" ? Number(param) : NaN;
  if (!Number.isSafeInteger(id) || id < 1) return undefined;
  return getUpload(getDb(), id)?.summary?.sightings.map((s) => s.guid);
}

/** Who may sign in before any upload: the admin, then the guests (members only come with uploads). */
function guestList(): string[] {
  const admin = adminBattleTag();
  const guests = listGuests(getDb())
    .map((g) => g.battleTag)
    .filter((tag) => !sameBattleTag(tag, admin));
  return admin === undefined ? guests : [admin, ...guests];
}
