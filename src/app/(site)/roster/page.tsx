import type { Metadata } from "next";
import { nowSeconds } from "@/app/clock";
import { getDataset } from "@/app/dataset";
import { getViewer } from "@/app/viewer";
import {
  isFiltered,
  joinNames,
  parseRosterQuery,
  professionOptions,
  recordCharacters,
  roster,
  rosterFilter,
  rosterSearch,
  type SearchParams,
} from "@/core/views";
import { FriendPanel } from "@/components/roster/FriendPanel";
import { LevelSpread } from "@/components/roster/LevelSpread";
import { QuickAnswers } from "@/components/roster/QuickAnswers";
import { RosterToolbar } from "@/components/roster/RosterToolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import { SegmentedNav } from "@/components/ui/SegmentedNav";
import styles from "./roster.module.css";

export const metadata: Metadata = { title: "Roster" };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The roster as cards grouped by friend (WEB-21, board `roster-cards`). Search, filters and sort come from the URL. */
export default async function RosterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = parseRosterQuery(await searchParams);
  const data = getDataset();
  const now = nowSeconds();

  if (data === undefined || recordCharacters(data, now).length === 0) {
    const viewer = await getViewer();
    return (
      <div className={styles.page}>
        <PageTitle>Roster</PageTitle>
        {viewer?.mayUpload ? (
          <EmptyState title="The roster is still empty" action={{ href: "/upload", label: "Upload the first file" }}>
            Upload the addon&apos;s file after your next play session. Everyone&apos;s characters appear here, on the
            map and in professions.
          </EmptyState>
        ) : (
          <EmptyState title="The roster is still empty">
            Nobody has uploaded data yet. Check back after the next session.
          </EmptyState>
        )}
      </div>
    );
  }

  const r = roster(data, now, { filter: rosterFilter(query), sort: query.sort });
  const filtered = isFiltered(query);
  const noAddon = r.noAddon.map((p) => p.displayName);
  const sub = [
    plural(r.counts.people, "friend"),
    plural(r.counts.characters, "character"),
    noAddon.length === 0 ? undefined : `${joinNames(noAddon)} ${noAddon.length === 1 ? "has" : "have"} no addon yet`,
  ]
    .filter((p) => p !== undefined)
    .join(" · ");
  const search = rosterSearch(query);

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

      <LevelSpread spread={r.spread} />
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
