import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { WorldMap } from "@/components/map/WorldMap";
import { parseContinent, worldMap, type WorldMapView } from "@/core/views";

type SearchParams = Record<string, string | string[] | undefined>;

const EMPTY: WorldMapView = { places: [], occupied: {} };

/**
 * The home page: the living world map (WEB-25, boards `map` and `map-states`). The continent (`?continent=`) and the
 * selected character (`?character=`) come from the URL. Before the first upload it is the bare map; the empty-site
 * panel arrives with WEB-29.
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const data = getDataset();
  const view = data === undefined ? EMPTY : worldMap(data, nowSeconds());
  const character = typeof params.character === "string" ? params.character : undefined;
  return (
    <>
      <Atmosphere variant="map" />
      <h1 className="visually-hidden">Map</h1>
      <WorldMap view={view} continent={parseContinent(params.continent)} selected={character} />
    </>
  );
}
