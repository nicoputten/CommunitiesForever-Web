import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { getFirstUpload } from "@/app/first-upload";
import { adminBattleTag, listGuests } from "@/server/access";
import { getDb } from "@/server/db";
import { getUpload } from "@/server/uploads";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { EmptyMap } from "@/components/map/EmptyMap";
import { WorldMap } from "@/components/map/WorldMap";
import { RollCallPanel } from "@/components/rollcall/RollCallPanel";
import { sameBattleTag } from "@/core/access";
import {
  ROLL_CALL_PARAMS,
  isRollCallFiltered,
  parseContinent,
  parseRollCallQuery,
  rollCall,
  rollCallFilter,
  worldMap,
  type WorldMapView,
} from "@/core/views";

type SearchParams = Record<string, string | string[] | undefined>;

const EMPTY: WorldMapView = { places: [], occupied: {} };

/**
 * The home page: the living world map (WEB-25, boards `map` and `map-states`). The continent (`?continent=`) and the
 * selected character (`?character=`) come from the URL; `?drop=<upload id>` (the session report's link, WEB-26) drops
 * that upload's new sightings in. The roll call (WEB-27) sits over the map's right side; its filters
 * (`friend`, `new`, `faction`, `level`) filter the markers too. Before the first upload the map is bare under the
 * empty-site card and the guest list (WEB-29). Below 1024 px the roll call is a bottom sheet over a full-screen map
 * and a tapped character opens in it (WEB-28).
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const data = getDataset();
  const now = nowSeconds();
  const query = parseRollCallQuery(params);
  const call = data === undefined ? undefined : rollCall(data, now, rollCallFilter(query));
  const only =
    call !== undefined && isRollCallFiltered(query)
      ? new Set([...call.live, ...call.earlier].map((r) => r.character.guid))
      : undefined;
  const view = data === undefined ? EMPTY : worldMap(data, now, only);
  const character = typeof params.character === "string" ? params.character : undefined;
  const drop = dropped(params.drop);
  return (
    <>
      <Atmosphere variant="map" />
      <h1 className="visually-hidden">Map</h1>
      <WorldMap
        view={view}
        continent={parseContinent(params.continent)}
        selected={character}
        drop={drop}
        panel={
          call === undefined ? (
            <EmptyMap {...await getFirstUpload()} guestList={guestList()} />
          ) : (
            <RollCallPanel call={call} query={query} clearHref={clearHref(params)} />
          )
        }
        sheet={
          call === undefined ? undefined : (
            <RollCallPanel call={call} query={query} clearHref={clearHref(params)} variant="sheet" />
          )
        }
      />
    </>
  );
}

/** The map's URL without the roll call's filters. */
function clearHref(params: SearchParams): string {
  const keep = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && !(ROLL_CALL_PARAMS as readonly string[]).includes(key) && key !== "drop")
      keep.set(key, value);
  }
  const s = keep.toString();
  return s === "" ? "/" : `/?${s}`;
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
