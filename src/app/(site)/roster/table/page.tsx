import type { Metadata } from "next";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { getViewer } from "@/app/viewer";
import { sameBattleTag } from "@/core/access";
import {
  isFiltered,
  parseRosterQuery,
  peopleViews,
  professionOptions,
  recordCharacters,
  roster,
  rosterFilter,
  rosterSearch,
  type SearchParams,
} from "@/core/views";
import { CharacterRow } from "@/components/roster/CharacterRow";
import { FriendPanel } from "@/components/roster/FriendPanel";
import { RosterTable, sortName, TABLE_PATH } from "@/components/roster/RosterTable";
import { RosterToolbar } from "@/components/roster/RosterToolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import { SegmentedNav } from "@/components/ui/SegmentedNav";
import { RosterEmpty } from "../empty";
import styles from "../roster.module.css";
import table from "./table.module.css";

export const metadata: Metadata = { title: "Roster" };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * The roster as a compact sortable table (WEB-22, board `roster-table`), with the cards' search and filters in the
 * URL. On a phone the table becomes the card list (flat in the table's order, or friend panels when grouped).
 */
export default async function RosterTablePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = parseRosterQuery(await searchParams);
  const data = getDataset();
  const now = nowSeconds();

  if (data === undefined || recordCharacters(data, now).length === 0) return <RosterEmpty />;

  const r = roster(data, now, { filter: rosterFilter(query), sort: query.sort, dir: query.dir });
  const people = new Map(peopleViews(data, now).map((p) => [p.key, p]));
  const viewer = await getViewer();
  const own = [...people.values()].find((p) => sameBattleTag(p.battleTag, viewer?.battleTag))?.key;
  const search = rosterSearch(query);
  const sub = `${plural(r.counts.characters, "character")} · sorted by ${sortName(query.sort)}`;
  const clear = rosterSearch({ ...query, search: "", classes: [], roles: [], level: undefined, profession: undefined });

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <PageTitle sub={sub}>Roster</PageTitle>
        <SegmentedNav
          label="View"
          options={[
            { href: `/roster${search}`, label: "Cards", current: false },
            { href: `${TABLE_PATH}${search}`, label: "Table", current: true },
          ]}
        />
      </div>

      <RosterToolbar
        query={query}
        professions={professionOptions(recordCharacters(data, now))}
        shown={isFiltered(query) ? { count: r.characters.length, of: r.counts.characters } : undefined}
        table
      />

      {r.characters.length === 0 ? (
        <EmptyState title="No characters match" action={{ href: `${TABLE_PATH}${clear}`, label: "Clear filters" }}>
          Try another search, or clear the filters.
        </EmptyState>
      ) : (
        <>
          <div className={table.wide}>
            <RosterTable
              query={query}
              characters={r.characters}
              friends={r.friends}
              people={people}
              ownKey={own}
              now={now}
            />
          </div>
          <div className={table.narrow}>
            {query.group ? (
              r.friends.map((f) => (
                <FriendPanel key={f.person.key} person={f.person} characters={f.characters} total={f.total} now={now} />
              ))
            ) : (
              <div className={table.list}>
                {r.characters.map((c) => (
                  <CharacterRow
                    key={c.guid}
                    character={c}
                    now={now}
                    old={c.owner !== undefined && people.get(c.owner)?.old === true}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
