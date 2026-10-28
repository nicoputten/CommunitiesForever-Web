import { EmptyState } from "@/components/ui/EmptyState";

/** An unknown dungeon id, or a raid (no runs are planned for raids, so they have no page; WEB-42). */
export default function DungeonNotFound() {
  return (
    <EmptyState title="Dungeon not found" as="h1" action={{ href: "/", label: "← Map" }}>
      There is no dungeon page with this link. Raids have none; dungeons open from their entrance on the map.
    </EmptyState>
  );
}
