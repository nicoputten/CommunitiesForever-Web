import type { Metadata } from "next";
import { Placeholder } from "../placeholder";

export const metadata: Metadata = { title: "Professions" };

// Placeholder until professions (WEB-24).
export default function ProfessionsPage() {
  return <Placeholder title="Professions" story="WEB-24" />;
}
