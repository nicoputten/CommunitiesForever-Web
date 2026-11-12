"use client";

import { useId, useOptimistic, useRef, useState, useTransition } from "react";
import { FilterChip } from "@/components/ui/FilterChip";
import { InfoTip } from "@/components/ui/InfoTip";
import type { Often } from "@/core/doomsday/missionPool";
import { matches, type FilterChipView, type PoolFilter, type PoolRow, type ThemeCard } from "@/core/views/missionPool";
import styles from "./MissionPool.module.css";

type Action = (form: FormData) => Promise<void>;

/** Rows in view before the open list scrolls (board `mission-pool-v2-overview`). */
const SHOWN = 7;

const OFTEN: readonly { value: Often; label: string }[] = [
  { value: "rare", label: "Rare" },
  { value: "normal", label: "Normal" },
  { value: "often", label: "Often" },
];

/**
 * On or off, the Discord page's switch. Switching off asks first (board `mission-pool-states`); switching on doesn't.
 * Forms, so it works before hydration; the switch shows the new state at once.
 */
function OffSwitch({ row, offFrom, action }: { row: PoolRow; offFrom: string; action: Action }) {
  const [on, setOn] = useOptimistic(!row.off);
  const [, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const submit = (form: FormData) =>
    start(async () => {
      setOn(form.get("off") !== "true");
      await action(form);
    });
  const fields = (off: boolean) => (
    <>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="off" value={String(off)} />
    </>
  );
  return (
    <>
      <form
        action={submit}
        onSubmit={(e) => {
          if (!on) return;
          e.preventDefault();
          dialog.current?.showModal();
        }}
      >
        {fields(on)}
        <button type="submit" role="switch" aria-checked={on} aria-label={row.text} className={styles.switchButton}>
          <span className={styles.switch} aria-hidden="true" />
        </button>
      </form>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-ask`}>
        <form action={submit} className={styles.dialogBody} onSubmit={() => dialog.current?.close()}>
          {fields(true)}
          <h3 id={`${id}-ask`} className={styles.boxTitle}>
            Switch off “{row.text}”?
          </h3>
          <p className={styles.dialogText}>{offFrom}</p>
          <div className={styles.buttons}>
            <button type="button" className={styles.button} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Switch off
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Rare · Normal · Often: one form per choice. */
function OftenChoice({ row, action }: { row: PoolRow; action: Action }) {
  const [shown, setShown] = useOptimistic(row.often);
  const [, start] = useTransition();
  return (
    <div role="group" aria-label={`How often: ${row.text}`} className={styles.seg}>
      {OFTEN.map((o) => (
        <form
          key={o.value}
          action={(form) =>
            start(async () => {
              setShown(o.value);
              await action(form);
            })
          }
          className={styles.contents}
        >
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="often" value={o.value} />
          <button type="submit" aria-pressed={shown === o.value}>
            {o.label}
          </button>
        </form>
      ))}
    </div>
  );
}

/** CF-121: a site-only mission counts only for friends on the addon release that tracks it. */
function SiteOnlyTip({ row }: { row: PoolRow }) {
  return row.siteOnly === true ? <InfoTip>Counts once friends have the next addon release.</InfoTip> : null;
}

function Tag({ row }: { row: PoolRow }) {
  return row.tag === undefined ? null : (
    <span className={styles.tag6} data-tag={row.tag}>
      {row.tag}
    </span>
  );
}

interface Section {
  key: string;
  title: string;
  rows: PoolRow[];
}

/** One list: a desktop row per mission (Mission, Short, Pts, History, How often, the switch), or two phone lines. */
function Rows({
  sections,
  offFrom,
  setOff,
  setOften,
}: {
  sections: Section[];
  offFrom: string;
  setOff: Action;
  setOften: Action;
}) {
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Mission</th>
            <th scope="col">Short</th>
            <th scope="col" className={styles.num}>
              Pts
            </th>
            <th scope="col">History</th>
            <th scope="col">How often</th>
            <th scope="col">
              <span className="visually-hidden">On</span>
            </th>
          </tr>
        </thead>
        {sections.map((s) => (
          <tbody key={s.key}>
            {sections.length > 1 && (
              <tr className={styles.group}>
                <th scope="colgroup" colSpan={6}>
                  {s.title}
                </th>
              </tr>
            )}
            {s.rows.map((r) => (
              <tr key={r.id} data-off={r.off || undefined}>
                <td className={styles.name}>
                  {r.text}
                  <Tag row={r} />
                </td>
                <td className={styles.short}>{r.short}</td>
                <td className={styles.num}>{r.points}</td>
                <td className={styles.dim}>{r.history}</td>
                <td>
                  <OftenChoice row={r} action={setOften} />
                </td>
                <td className={styles.end}>
                  <div className={styles.lineEnd}>
                    <SiteOnlyTip row={r} />
                    <OffSwitch row={r} offFrom={offFrom} action={setOff} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <div className={styles.lines}>
        {sections.map((s) => (
          <div key={s.key} className={styles.lineBlock}>
            {sections.length > 1 && <h4 className={styles.lineGroup}>{s.title}</h4>}
            {s.rows.map((r) => (
              <div key={r.id} className={styles.line} data-off={r.off || undefined}>
                <div className={styles.lineHead}>
                  <span>
                    {r.text}
                    <Tag row={r} />
                  </span>
                  <div className={styles.lineEnd}>
                    <SiteOnlyTip row={r} />
                    <OffSwitch row={r} offFrom={offFrom} action={setOff} />
                  </div>
                </div>
                <div className={styles.lineStats}>{r.line}</div>
                <OftenChoice row={r} action={setOften} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * The pool as themes (board `mission-pool-v2-overview`): search and filters, nine cards with their history, the open
 * card's missions below (one at a time). A search or a filter lists the matches of every card instead.
 */
export function PoolControls({
  cards,
  filters,
  offFrom,
  setOff,
  setOften,
}: {
  cards: ThemeCard[];
  filters: FilterChipView[];
  offFrom: string;
  setOff: Action;
  setOften: Action;
}) {
  const [open, setOpen] = useState(cards[0]?.key);
  const [filter, setFilter] = useState<PoolFilter>("all");
  const [query, setQuery] = useState("");
  const listId = useId();
  const q = query.trim().toLowerCase();
  const searching = filter !== "all" || q !== "";
  const hit = (r: PoolRow) =>
    matches(r, filter) && (q === "" || r.text.toLowerCase().includes(q) || r.short.toLowerCase().includes(q));
  const sections: Section[] = searching
    ? cards
        .map((c) => ({ key: c.key, rows: c.rows.filter(hit), name: c.name }))
        .filter((s) => s.rows.length > 0)
        .map((s) => ({ key: s.key, title: `${s.name} · ${s.rows.length}`, rows: s.rows }))
    : cards.filter((c) => c.key === open).map((c) => ({ key: c.key, title: `${c.name} · ${c.count}`, rows: c.rows }));
  const total = sections.reduce((a, s) => a + s.rows.length, 0);
  // A search or filter: "Never came up · 131" (the chip's label), "All · 4" for a search alone.
  const chip = filters.find((f) => f.filter === filter)?.label ?? "All";
  const title = searching ? `${chip} · ${total}` : (sections[0]?.title ?? "");
  return (
    <>
      <div className={styles.filters}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search missions"
          aria-label="Search missions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filters.map((f) => (
          <FilterChip key={f.filter} pressed={filter === f.filter} onClick={() => setFilter(f.filter)}>
            {f.label} <b className={styles.chipCount}>{f.count}</b>
          </FilterChip>
        ))}
      </div>
      <ul className={styles.cards}>
        {cards.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              className={styles.card}
              aria-expanded={!searching && open === c.key}
              aria-controls={listId}
              data-testid="theme-card"
              onClick={() => {
                setOpen(c.key);
                setFilter("all");
                setQuery("");
              }}
            >
              <span className={styles.cardHead}>
                <span className={styles.cardName}>{c.name}</span>
                <em className={styles.cardTag} data-kind={c.kind}>
                  {c.tag}
                </em>
                <span className={styles.cardCount}>{c.count}</span>
              </span>
              <span className={styles.cardLine}>
                {c.history}
                {c.fresh !== undefined && (
                  <>
                    {" · "}
                    <span className={styles.cardNew}>{c.fresh}</span>
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div id={listId} className={styles.open} data-testid="theme-list">
        <div className={styles.head}>
          <h3 className={styles.subTitle}>{title}</h3>
          {total > SHOWN && (
            <span className={styles.aside}>
              {SHOWN} of {total} shown · scroll
            </span>
          )}
        </div>
        <div
          className={styles.scroll}
          tabIndex={total > SHOWN ? 0 : undefined}
          aria-label={title || undefined}
          role={total > SHOWN ? "region" : undefined}
        >
          <Rows sections={sections} offFrom={offFrom} setOff={setOff} setOften={setOften} />
        </div>
      </div>
    </>
  );
}
