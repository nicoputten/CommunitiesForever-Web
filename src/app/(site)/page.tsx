import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { Placeholder } from "./placeholder";

// Placeholder until the world map (WEB-25); the map page is alive (WEB-16).
export default function MapPage() {
  return (
    <>
      <Atmosphere variant="map" />
      <Placeholder title="Map" story="WEB-25" />
    </>
  );
}
