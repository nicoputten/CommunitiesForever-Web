import { timeAgo } from "@/core/views/age";
import type { PersonView } from "@/core/views/characters";
import styles from "./DataAgeBadge.module.css";

export type DataAgeBadgeProps = Pick<PersonView, "hasAddon" | "dataAt" | "dataAge" | "old" | "daysOld" | "via"> & {
  /** Unix seconds. */
  now: number;
  /** "· own addon" when the data came from the friend's own addon (character board). */
  showOwn?: boolean;
};

export type DataAgeTone = "fresh" | "stale" | "neutral";

/** Green when live, amber at 7 days, neutral otherwise or without the addon. */
export function dataAgeTone({ hasAddon, dataAge, old }: Pick<DataAgeBadgeProps, "hasAddon" | "dataAge" | "old">) {
  const tone: DataAgeTone = !hasAddon ? "neutral" : old ? "stale" : dataAge === "live" ? "fresh" : "neutral";
  return tone;
}

/** "Data 2 h ago · via Bob", "Data 9 days old", "No addon". */
export function dataAgeText({ hasAddon, dataAt, old, daysOld, via, now, showOwn = false }: DataAgeBadgeProps) {
  let text: string;
  if (!hasAddon) text = "No addon";
  else if (dataAt === undefined) text = "No data";
  else if (old) text = `Data ${daysOld ?? 7} days old`;
  else text = `Data ${timeAgo(dataAt, now)}`;
  if (hasAddon && via !== undefined) text += ` · via ${via.name}`;
  else if (hasAddon && showOwn) text += " · own addon";
  return text;
}

/** How old a friend's data is (roster-cards board): green when live, amber at 7 days, "via X" when relayed. */
export function DataAgeBadge(props: DataAgeBadgeProps) {
  return (
    <span className={styles.badge} data-tone={dataAgeTone(props)}>
      {dataAgeText(props)}
    </span>
  );
}
