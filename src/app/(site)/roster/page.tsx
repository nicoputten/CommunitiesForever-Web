import type { Metadata } from "next";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { getViewer } from "@/app/viewer";
import { sameBattleTag } from "@/core/access";
import {
  DEFAULT_SORT,
  defaultSortDir,
  isFiltered,
  joinNames,
  parseRosterQuery,
  peopleViews,
  professionOptions,
  recordCharacters,
  roster,
  rosterFilter,
  rosterSearch,
  ROSTER_SORTS,
  type SearchParams,
} from "@/core/views";
import { FriendPanel } from "@/components/roster/FriendPanel";
import { LevelSpread } from "@/components/roster/LevelSpread";
import { NextRun } from "@/components/roster/NextRun";
import { QuickAnswers } from "@/components/roster/QuickAnswers";
import { RosterToolbar } from "@/components/roster/RosterToolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import { SegmentedNav } from "@/components/ui/SegmentedNav";
import { rosterRuns } from "@/core/views/runs";
import { getDb } from "@/server/db";
import { runsInput } from "@/server/runsInput";
import { RosterEmpty } from "./empty";
import styles from "./roster.module.css";

export const metadata: Metadata = { title: "Roster" };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The roster as cards grouped by friend (WEB-21, board `roster-cards`). Search, filters and sort come from the URL. */
export default async function RosterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const asked = parseRosterQuery(await searchParams);
  // The table's column sorts (talents, last seen in, …) don't apply to the cards: they show their default sort.
  const query = ROSTER_SORTS.some((s) => s.value === asked.sort)
    ? asked
    : { ...asked, sort: DEFAULT_SORT, dir: defaultSortDir(DEFAULT_SORT) };
  const data = getDataset();
  const now = nowSeconds();

  if (data === undefined || recordCharacters(data, now).length === 0) return <RosterEmpty />;

  const r = roster(data, now, { filter: rosterFilter(query), sort: query.sort, dir: query.dir });
  const viewer = await getViewer();
  // Runs on the roster (WEB-45): the Next run card and each band's planned runs.
  const runs = viewer === undefined ? undefined : rosterRuns(runsInput(getDb(), viewer.battleTag, now));
  const own = peopleViews(data, now).find((p) => sameBattleTag(p.battleTag, viewer?.battleTag))?.key;
  const filtered = isFiltered(query);
  const noAddon = r.noAddon.map((p) => p.displayName);
  const sub = [
    plural(r.counts.people, "friend"),
    plural(r.counts.characters, "character"),
    noAddon.length === 0 ? undefined : `${joinNames(noAddon)} ${noAddon.length === 1 ? "has" : "have"} no addon yet`,
  ]
    .filter((p) => p !== undefined)
    .join(" · ");
  const search = rosterSearch(asked);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <PageTitle sub={sub}>Roster</PageTitle>
        <SegmentedNav
          label="View"
          options={[
            { href: `/roster${search}`, label: "Cards", current: true },
            { href: `/roster/table${search}`, label: "Table", current: false },
          ]}
        />
      </div>

      <RosterToolbar
        query={query}
        professions={professionOptions(recordCharacters(data, now))}
        shown={filtered ? { count: r.characters.length, of: r.counts.characters } : undefined}
      />

      {runs?.next !== undefined && <NextRun run={runs.next} />}

      <LevelSpread spread={r.spread} own={own} {...(runs === undefined ? {} : { runs: runs.byDungeon })} />
      <QuickAnswers answers={r.quickAnswers} />

      {r.characters.length === 0 ? (
        <EmptyState title="No characters match" action={{ href: "/roster", label: "Clear filters" }}>
          Try another search, or clear the filters.
        </EmptyState>
      ) : (
        <div className={styles.friends}>
          {r.friends.map((f) => (
            <FriendPanel key={f.person.key} person={f.person} characters={f.characters} total={f.total} now={now} />
          ))}
          {!filtered &&
            r.noAddon.map((p) => <FriendPanel key={p.key} person={p} characters={[]} total={0} now={now} />)}
        </div>
      )}
    </div>
  );
}
