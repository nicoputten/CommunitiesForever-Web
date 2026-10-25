import { timeAgo } from "@/core/views/age";
import type { PersonView } from "@/core/views/characters";
import styles from "./DataAgeBadge.module.css";

export type DataAgeBadgeProps = Pick<PersonView, "hasAddon" | "dataAt" | "dataAge" | "old" | "daysOld" | "via"> & {
  /** Unix seconds. */
  now: number;
};

/** How old a friend's data is (roster-cards board): green when live, amber at 7 days, "via X" when relayed. */
export function DataAgeBadge({ hasAddon, dataAt, dataAge, old, daysOld, via, now }: DataAgeBadgeProps) {
  const tone = !hasAddon ? "neutral" : old ? "stale" : dataAge === "live" ? "fresh" : "neutral";
  let text: string;
  if (!hasAddon) text = "No addon";
  else if (dataAt === undefined) text = "No data";
  else if (old) text = `Data ${daysOld ?? 7} days old`;
  else text = `Data ${timeAgo(dataAt, now)}`;
  if (hasAddon && via !== undefined) text += ` · via ${via.name}`;
  return (
    <span className={styles.badge} data-tone={tone}>
      {text}
    </span>
  );
}
