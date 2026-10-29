import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { classInfo, MAX_LEVEL } from "@/core/gamedata";
import { dataAge, timeAgo } from "@/core/views/age";
import type { CharacterView, PersonView } from "@/core/views/characters";
import { defaultSortDir, type RosterFriend, type RosterSort } from "@/core/views/roster";
import { ROLE_NAMES, rosterSearch, TABLE_SORTS, type RosterQuery } from "@/core/views/rosterQuery";
import { capitalize, talentsText } from "@/core/views/text";
import { ClassDisc } from "@/components/ui/ClassDisc";
import { DataAgeBadge, dataAgeProps } from "@/components/ui/DataAgeBadge";
import { characterHref } from "./CharacterRow";
import styles from "./RosterTable.module.css";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The table's page; the column headers link to it with another sort. */
export const TABLE_PATH = "/roster/table";

export interface RosterTableProps {
  query: RosterQuery;
  /** Every shown character, sorted (not grouped). */
  characters: readonly CharacterView[];
  /** The friends with their shown characters (grouped by friend). */
  friends: readonly RosterFriend[];
  /** Everyone, by person key: old data and "via" on the Player cell. */
  people: ReadonlyMap<string, PersonView>;
  /** The signed-in viewer's person key: their rows get the gold tint (board: Ves Doombringer). */
  ownKey?: string;
  now: number;
}

/**
 * The roster as a compact sortable table (WEB-22, board `roster-table`). The column headers are links to the same
 * view with another sort, so sorting works without script and Back undoes it; a second click reverses the order.
 */
export function RosterTable({ query, characters, friends, people, ownKey, now }: RosterTableProps) {
  const columns = TABLE_SORTS.filter((s) => !(query.group && s.value === "player"));
  const row = (c: CharacterView) => (
    <Row
      key={c.guid}
      character={c}
      person={c.owner === undefined ? undefined : people.get(c.owner)}
      own={ownKey !== undefined && c.owner === ownKey}
      player={!query.group}
      now={now}
    />
  );
  return (
    <div className={styles.frame}>
      <table className={styles.table}>
        <caption className="visually-hidden">
          Characters{query.group ? ", grouped by friend" : ""}, sorted by {sortName(query.sort)}
        </caption>
        <thead>
          <tr>
            {columns.map((s) => (
              <Header key={s.value} sort={s.value} label={s.label} query={query} />
            ))}
          </tr>
        </thead>
        {query.group ? (
          friends.map((f) => (
            <tbody key={f.person.key} className={styles.group}>
              <tr>
                <th scope="rowgroup" colSpan={columns.length} className={styles.friend}>
                  <span className={styles.friendName}>{f.person.displayName}</span>
                  <span className={styles.friendTag}>{countText(f)}</span>
                  <DataAgeBadge {...dataAgeProps(f.person)} now={now} />
                </th>
              </tr>
              {f.characters.map(row)}
            </tbody>
          ))
        ) : (
          <tbody>{characters.map(row)}</tbody>
        )}
      </table>
    </div>
  );
}

function countText(f: RosterFriend): string {
  return f.characters.length < f.total
    ? `${f.characters.length} of ${plural(f.total, "character")}`
    : plural(f.total, "character");
}

/** "sorted by level" in the page's sub line and the caption. */
export function sortName(sort: RosterSort): string {
  if (sort === "ilvl") return "item level";
  if (sort === "name") return "character";
  return (TABLE_SORTS.find((s) => s.value === sort)?.label ?? sort).toLowerCase();
}

function Header({ sort, label, query }: { sort: RosterSort; label: string; query: RosterQuery }) {
  const current = query.sort === sort;
  const dir = current ? (query.dir === "asc" ? "desc" : "asc") : defaultSortDir(sort);
  return (
    <th
      scope="col"
      className={styles.th}
      aria-sort={current ? (query.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={`${TABLE_PATH}${rosterSearch({ ...query, sort, dir })}`}
        scroll={false}
        className={styles.sort}
        data-current={current || undefined}
      >
        {label}
        {current && <span aria-hidden="true">{query.dir === "asc" ? " ↑" : " ↓"}</span>}
      </Link>
    </th>
  );
}

function Dash() {
  return <span className={styles.none}>—</span>;
}

interface RowProps {
  character: CharacterView;
  person?: PersonView;
  own: boolean;
  /** The Player column is shown (not while grouped by friend). */
  player: boolean;
  now: number;
}

function Row({ character: c, person, own, player, now }: RowProps) {
  const info = classInfo(c.classFile);
  const style =
    info === undefined
      ? undefined
      : ({ "--class": `var(${info.colorToken})`, "--class-text": `var(${info.textToken})` } as CSSProperties);
  const old = person?.old === true;
  const talents = talentsText(c.mainTreeName, c.talents);
  const level = c.level === undefined ? 0 : Math.min(c.level, MAX_LEVEL) / MAX_LEVEL;
  let note: ReactNode = null;
  if (old) note = <span className={styles.old}> · {person?.daysOld ?? 7} d old</span>;
  else if (person?.via !== undefined) note = <span className={styles.via}> · via {person.via.name}</span>;
  return (
    <tr className={styles.row} style={style} data-own={own || undefined} data-old={old || undefined}>
      <td>
        <span className={styles.character}>
          <ClassDisc
            name={c.name}
            classFile={c.classFile}
            level={c.level}
            size="xs"
            live={c.lastPlayed !== undefined && dataAge(c.lastPlayed, now) === "live"}
          />
          <Link href={characterHref(c.guid)} className={styles.name}>
            {c.name}
          </Link>
        </span>
      </td>
      {player && (
        <td>
          {c.ownerName ?? <Dash />}
          {note}
        </td>
      )}
      <td>
        {c.level ?? <Dash />}
        <span
          aria-hidden="true"
          className={styles.bar}
          data-max={c.level === MAX_LEVEL || undefined}
          style={{ "--level": level } as CSSProperties}
        />
      </td>
      <td>{[c.raceName, c.className].filter((p) => p !== undefined).join(" ") || <Dash />}</td>
      <td>{c.role === undefined ? <Dash /> : ROLE_NAMES[c.role]}</td>
      <td>{talents ?? <Dash />}</td>
      <td>{c.ilvl ?? <Dash />}</td>
      <td className={styles.wrap}>
        {c.professions.length === 0 ? (
          <Dash />
        ) : (
          <span className={styles.professions}>
            {c.professions.map((p) => (
              <span key={p.skillLine} className={styles.profession}>
                {p.name} {p.rank}
              </span>
            ))}
          </span>
        )}
      </td>
      <td>{c.lastPlayed === undefined ? <Dash /> : capitalize(timeAgo(c.lastPlayed, now))}</td>
      <td className={styles.wrap}>{c.sighting?.zoneText ?? <span className={styles.none}>Location unknown</span>}</td>
    </tr>
  );
}
