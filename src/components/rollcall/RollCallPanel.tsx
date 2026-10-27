import Link from "next/link";
import type { CSSProperties } from "react";
import { classInfo } from "@/core/gamedata/classes";
import type { CharacterView, PersonView, RollCall, RollCallQuery, RollCallRow } from "@/core/views";
import { EmptyState } from "@/components/ui/EmptyState";
import { PickRow } from "./PickRow";
import { RollCallFilters } from "./RollCallFilters";
import styles from "./RollCallPanel.module.css";

export interface RollCallPanelProps {
  call: RollCall;
  query: RollCallQuery;
  /** The map's URL without the roll call's filters ("Clear filters"). */
  clearHref: string;
}

const classStyle = (c: CharacterView) => {
  const info = c.classFile === undefined ? undefined : classInfo(c.classFile);
  return info === undefined
    ? undefined
    : ({ "--class": `var(${info.colorToken})`, "--class-text": `var(${info.textToken})` } as CSSProperties);
};

/** "The Deadmines, Westfall"; the addon's own text for a battleground or a place off the map. */
function place(row: RollCallRow): string {
  const s = row.sighting;
  if (s.dungeon !== undefined && s.zoneName !== undefined) return `${s.dungeon.name}, ${s.zoneName}`;
  return s.zoneName ?? s.zoneText;
}

/** "Femke", "Mira, via Bob"; an old friend's data in amber (DESIGN.md §4). */
function owner(person: PersonView | undefined, fallback: string | undefined) {
  if (person?.old === true)
    return { text: `${person.displayName}'s data is ${person.daysOld ?? 7} days old`, old: true };
  const name = person?.displayName ?? fallback;
  if (name === undefined) return undefined;
  return { text: person?.via === undefined ? name : `${name}, via ${person.via.name}`, old: false };
}

function Name({ c }: { c: CharacterView }) {
  return (
    <span className={styles.name}>
      {c.name ?? "Unknown character"}
      {c.level !== undefined && <span className={styles.level}> {c.level}</span>}
    </span>
  );
}

function Row({ row }: { row: RollCallRow }) {
  const { character: c } = row;
  const who = owner(row.person, c.ownerName);
  const body = (
    <>
      <span aria-hidden="true" className={styles.dot} data-age={row.sighting.age} />
      <span className={styles.text}>
        <Name c={c} />
        <span className={styles.sub} data-old={who?.old || undefined}>
          {place(row)}
          {who !== undefined && ` · ${who.text}`}
        </span>
      </span>
      <span className={styles.age}>{row.ago}</span>
    </>
  );
  return (
    <li style={classStyle(c)}>
      {row.onMap ? (
        <PickRow guid={c.guid} className={styles.row}>
          {body}
        </PickRow>
      ) : c.hasRecord ? (
        <Link href={`/character/${encodeURIComponent(c.guid)}`} className={styles.row}>
          {body}
        </Link>
      ) : (
        <div className={styles.row}>{body}</div>
      )}
    </li>
  );
}

function Group({ title, rows, earlier }: { title: string; rows: RollCallRow[]; earlier?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={title} className={styles.group}>
      <h3 className={styles.overline}>{title}</h3>
      <ul className={styles.rows} data-earlier={earlier || undefined}>
        {rows.map((r) => (
          <Row key={r.character.guid} row={r} />
        ))}
      </ul>
    </section>
  );
}

/** "Sanne", "Sanne and Pim", "Sanne, Pim and Joost". */
function names(people: PersonView[]): string {
  const n = people.map((p) => p.displayName);
  return n.length < 2 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n.at(-1)}`;
}

const LEGEND = [
  { age: "live", label: "New < 32 h" },
  { age: "recent", label: "Recent" },
  { age: "days", label: "Days" },
  { age: "week", label: "Week +" },
] as const;

/**
 * The roll call next to the map (WEB-27, map board): who was seen where, newest first, with filters that the map
 * follows too (in the URL). Picking a row flies the map to the character (flyTo.ts). Desktop only, from 1024 px;
 * the phone has its sheet (WEB-28). `data-map-panel`: the map centres in the part left of it (WEB-26).
 */
export function RollCallPanel({ call, query, clearHref }: RollCallPanelProps) {
  const nothing = call.total === 0;
  return (
    <aside aria-labelledby="roll-call-title" className={styles.panel} data-map-panel>
      <div className={styles.head}>
        <h2 id="roll-call-title" className={styles.title}>
          Roll call
        </h2>
        <span className={styles.count}>
          {call.located} of {call.total} located
        </span>
      </div>
      <RollCallFilters query={query} people={call.people.map((p) => ({ key: p.key, name: p.displayName }))} />
      <ul className={styles.legend} aria-label="Data age">
        {LEGEND.map((l) => (
          <li key={l.age}>
            <span aria-hidden="true" className={styles.dot} data-age={l.age} />
            {l.label}
          </li>
        ))}
      </ul>
      <div className={styles.divider} />
      <div className={styles.list}>
        {nothing ? (
          <EmptyState title="No characters match" action={{ href: clearHref, label: "Clear filters" }}>
            Try another friend, or clear the filters.
          </EmptyState>
        ) : (
          <>
            <Group title="New" rows={call.live} />
            <Group title="Earlier" rows={call.earlier} earlier />
          </>
        )}
      </div>
      {(call.unknown.length > 0 || call.noAddon.length > 0) && (
        <section aria-label="Unknown whereabouts" className={styles.tray}>
          {call.unknown.length > 0 && (
            <>
              <h3 className={styles.overline}>Unknown whereabouts</h3>
              <ul className={styles.rows}>
                {call.unknown.map(({ character: c, person }) => {
                  const body = (
                    <>
                      <span aria-hidden="true" className={styles.dot} data-age="unknown" />
                      <span className={styles.name}>{c.name ?? "Unknown character"}</span>
                      <span className={styles.meta}>
                        {[c.level, person?.displayName ?? c.ownerName, "never sighted"]
                          .filter((v) => v !== undefined)
                          .join(" · ")}
                      </span>
                    </>
                  );
                  return (
                    <li key={c.guid} style={classStyle(c)}>
                      {c.hasRecord ? (
                        <Link href={`/character/${encodeURIComponent(c.guid)}`} className={styles.unknown}>
                          {body}
                        </Link>
                      ) : (
                        <div className={styles.unknown}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {call.noAddon.length > 0 && (
            <p className={styles.noAddon}>
              {names(call.noAddon)} {call.noAddon.length === 1 ? "has" : "have"} no addon data yet.
            </p>
          )}
        </section>
      )}
    </aside>
  );
}
