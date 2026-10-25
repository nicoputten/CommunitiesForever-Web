import type { Metadata } from "next";
import { Placeholder } from "../placeholder";

export const metadata: Metadata = { title: "Roster" };

// Placeholder until the roster (WEB-21).
export default function RosterPage() {
  return <Placeholder title="Roster" story="WEB-21" />;
}
