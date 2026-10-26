import { EmptyState } from "@/components/ui/EmptyState";

/** An unknown GUID, or a character the addon never recorded (decided with Nico for WEB-23). */
export default function CharacterNotFound() {
  return (
    <EmptyState title="Character not found" as="h1" action={{ href: "/roster", label: "← Roster" }}>
      Nobody in the group has a character with this link. It may have been deleted in game, or the link is wrong.
    </EmptyState>
  );
}
