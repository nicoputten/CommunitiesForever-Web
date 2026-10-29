import type { CharacterView, PersonView } from "@/core/views/characters";
import type { DoomsdayChip } from "@/core/views/doomsday";
import { RosterChip } from "@/components/doomsday/RosterChip";
import { DataAgeBadge, dataAgeProps } from "@/components/ui/DataAgeBadge";
import { CharacterRow } from "./CharacterRow";
import styles from "./FriendPanel.module.css";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export interface FriendPanelProps {
  person: PersonView;
  /** The characters shown (filtered); none for a friend without the addon. */
  characters: readonly CharacterView[];
  /** All their characters, before the filter. */
  total: number;
  now: number;
  /** This week's Doomsday points and streak (WEB-61); none without Doomsday at all. */
  doomsday?: DoomsdayChip;
}

/** A friend and their characters (roster-cards board); a friend without the addon gets the no-addon box. */
export function FriendPanel({ person, characters, total, now, doomsday }: FriendPanelProps) {
  const count = !person.hasAddon
    ? "in the group"
    : characters.length < total
      ? `${characters.length} of ${plural(total, "character")}`
      : plural(total, "character");
  // Display names only, BattleTags only on Admin (WEB-65).
  const tag = count;
  return (
    <section className={styles.panel} aria-label={person.displayName} data-addon={person.hasAddon || undefined}>
      <div className={styles.head}>
        <span aria-hidden="true" className={styles.avatar}>
          {Array.from(person.displayName)[0]?.toUpperCase()}
        </span>
        <div className={styles.who}>
          <h2 className={styles.name}>{person.displayName}</h2>
          <p className={styles.tag}>{tag}</p>
        </div>
        {doomsday !== undefined && <RosterChip chip={doomsday} />}
        <DataAgeBadge {...dataAgeProps(person)} now={now} />
      </div>
      {person.hasAddon ? (
        characters.map((c) => <CharacterRow key={c.guid} character={c} now={now} old={person.old} />)
      ) : (
        <p className={styles.noAddon}>
          We don&apos;t know {person.displayName}&apos;s characters yet.
          <br />
          Once {person.displayName} installs <span className={styles.addon}>CommunitiesForever</span>, their characters
          show up after the next upload.
        </p>
      )}
      {person.hasAddon && person.old && (
        <p className={styles.note}>
          {person.via !== undefined
            ? `${person.displayName}'s data reached us through ${person.via.name}'s addon.`
            : `${person.displayName}'s data is ${person.daysOld ?? 7} days old.`}{" "}
          It updates when someone who runs the addon sees {person.displayName} online.
        </p>
      )}
    </section>
  );
}
