import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { getDb } from "@/server/db";
import { getUpload } from "@/server/uploads";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { WorldMap } from "@/components/map/WorldMap";
import { RollCallPanel } from "@/components/rollcall/RollCallPanel";
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
 * (`friend`, `new`, `faction`, `level`) filter the markers too. Before the first upload it is the bare map; the
 * empty-site panel arrives with WEB-29.
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
        panel={call !== undefined && <RollCallPanel call={call} query={query} clearHref={clearHref(params)} />}
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
