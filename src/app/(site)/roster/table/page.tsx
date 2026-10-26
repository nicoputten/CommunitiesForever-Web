import type { Metadata } from "next";
import { Placeholder } from "../../placeholder";

export const metadata: Metadata = { title: "Roster" };

// Placeholder until the roster table (WEB-22); the cards' Table link keeps its query string for it.
export default function RosterTablePage() {
  return <Placeholder title="Roster" story="WEB-22" />;
}
