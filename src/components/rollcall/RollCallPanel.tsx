import Link from "next/link";
import type { CSSProperties } from "react";
import { classInfo } from "@/core/gamedata/classes";
import { initials } from "@/core/views/text";
import type { CharacterView, PersonView, RollCall, RollCallQuery, RollCallRow } from "@/core/views";
import { ClassDisc } from "@/components/ui/ClassDisc";
import { EmptyState } from "@/components/ui/EmptyState";
import { PickRow } from "./PickRow";
import { RollCallFilters } from "./RollCallFilters";
import styles from "./RollCallPanel.module.css";

export interface RollCallPanelProps {
  call: RollCall;
  query: RollCallQuery;
  /** The map's URL without the roll call's filters ("Clear filters"). */
  clearHref: string;
  /** panel: next to the map from 1024 px (WEB-27); sheet: the phone's bottom sheet (WEB-28, phone boards): a peek row
   * of chips, discs with initials instead of dots, no legend. */
  variant?: "panel" | "sheet";
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
      <span aria-hidden="true" className={styles.dot} data-age={row.sighting.age}>
        <span className={styles.initials}>{initials(c.name)}</span>
      </span>
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
    <li style={classStyle(c)} data-class={c.classFile?.toLowerCase()}>
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

/** The peek's row of chips (phone-map board): the newest first, full names (DESIGN.md §11), a tap flies there. */
function Peek({ rows }: { rows: RollCallRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className={styles.peek} aria-label="Newest sightings" data-sheet-part="peek" data-sheet-row="">
      {rows.map((row) => {
        const c = row.character;
        const body = (
          <>
            <span aria-hidden="true" className={styles.peekDisc}>
              <ClassDisc name={c.name} classFile={c.classFile} size="sm" live={row.sighting.age === "live"} />
            </span>
            <span className={styles.peekText}>
              <span className={styles.peekName}>
                {c.name ?? "Unknown character"} · {row.ago}
              </span>
              <span className={styles.peekZone}>{place(row)}</span>
            </span>
          </>
        );
        return (
          <li key={c.guid} style={classStyle(c)} data-class={c.classFile?.toLowerCase()}>
            {row.onMap ? (
              <PickRow guid={c.guid} className={styles.peekChip}>
                {body}
              </PickRow>
            ) : (
              <div className={styles.peekChip}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The roll call (WEB-27, map board): who was seen where, newest first, with filters that the map follows too (in the
 * URL). Picking a row flies the map to the character (flyTo.ts). As a panel: desktop only, from 1024 px,
 * `data-map-panel` (the map centres in the part left of it, WEB-26). As a sheet: the phone's bottom sheet (WEB-28),
 * which shows the peek part or the list part by its snap point.
 */
export function RollCallPanel({ call, query, clearHref, variant = "panel" }: RollCallPanelProps) {
  const nothing = call.total === 0;
  const sheet = variant === "sheet";
  const titleId = sheet ? "roll-call-sheet-title" : "roll-call-title";
  const Root = sheet ? "section" : "aside";
  return (
    <Root
      aria-labelledby={titleId}
      className={sheet ? styles.sheet : styles.panel}
      data-map-panel={sheet ? undefined : ""}
    >
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          Roll call
        </h2>
        <span className={styles.count}>
          {call.located} of {call.total} located
        </span>
      </div>
      {sheet && <Peek rows={[...call.live, ...call.earlier]} />}
      <div
        className={styles.body}
        data-sheet-part={sheet ? "list" : undefined}
        data-sheet-scroll={sheet ? "" : undefined}
      >
        <div className={styles.filters}>
          <RollCallFilters query={query} people={call.people.map((p) => ({ key: p.key, name: p.displayName }))} />
          {!sheet && (
            <ul className={styles.legend} aria-label="Data age">
              {LEGEND.map((l) => (
                <li key={l.age}>
                  <span aria-hidden="true" className={styles.dot} data-age={l.age} />
                  {l.label}
                </li>
              ))}
            </ul>
          )}
        </div>
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
            {/* One row until opened (WEB-65): "4 not sighted yet ▸". */}
            {call.unknown.length > 0 && (
              <details className={styles.unsighted}>
                <summary className={styles.unsightedRow}>
                  {call.unknown.length} not sighted yet
                  <span aria-hidden="true" className={styles.chevron}>
                    ▸
                  </span>
                </summary>
                <ul className={styles.rows}>
                  {call.unknown.map(({ character: c, person }) => {
                    const body = (
                      <>
                        <span aria-hidden="true" className={styles.dot} data-age="unknown">
                          <span className={styles.initials}>{initials(c.name)}</span>
                        </span>
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
              </details>
            )}
            {call.noAddon.length > 0 && (
              <p className={styles.noAddon}>
                {names(call.noAddon)} {call.noAddon.length === 1 ? "has" : "have"} no addon data yet.
              </p>
            )}
          </section>
        )}
      </div>
    </Root>
  );
}
