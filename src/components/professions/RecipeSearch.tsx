"use client";

import MiniSearch from "minisearch";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SEARCH_FROM_LETTERS, searchGroups, type SearchEntry } from "@/core/views/recipes";
import { SearchIcon } from "@/components/ui/icons";
import { Crafter, ItemIcon, SourceText, bits } from "@/components/recipes/bits";
import { ItemTooltip } from "@/components/recipes/ItemTooltip";
import styles from "./RecipeSearch.module.css";

// "Who can craft…?" (WEB-92, handoff C3, board recipes-search): the live recipe search on the Professions page, in
// the place of WEB-24's placeholder. From 2 letters, typo-tolerant (MiniSearch over item and recipe names); "Can craft"
// (at most 6) and "Nobody yet" (at most 3), best quality first. ↑ ↓ move, Enter opens, Esc closes; a pick opens the
// profession page with that recipe's drawer. The recipes load on first use (/api/recipes/search).

let loaded: Promise<SearchEntry[]> | undefined;
function loadEntries(): Promise<SearchEntry[]> {
  loaded ??= fetch("/api/recipes/search")
    .then((r) => (r.ok ? (r.json() as Promise<SearchEntry[]>) : []))
    .catch(() => {
      loaded = undefined;
      return [];
    });
  return loaded;
}

const recipeHref = (e: SearchEntry) => `/professions/${encodeURIComponent(e.slug)}?recipe=${e.id}`;

export function RecipeSearch() {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const [entries, setEntries] = useState<SearchEntry[] | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const index = useMemo(() => {
    if (entries === undefined) return undefined;
    const m = new MiniSearch<SearchEntry>({
      fields: ["name", "recipeName"],
      storeFields: [],
      searchOptions: { prefix: true, fuzzy: 0.2, boost: { name: 2 }, combineWith: "AND" },
    });
    m.addAll(entries);
    return m;
  }, [entries]);
  const byId = useMemo(() => new Map((entries ?? []).map((e) => [e.id, e])), [entries]);

  const q = query.trim();
  const groups = useMemo(() => {
    if (index === undefined || q.length < SEARCH_FROM_LETTERS) return { canCraft: [], nobodyYet: [] };
    return searchGroups(index.search(q).flatMap((r) => byId.get(r.id as number) ?? []));
  }, [index, byId, q]);
  const results = [...groups.canCraft, ...groups.nobodyYet];
  const shown = open && results.length > 0;
  const current = results[Math.min(active, results.length - 1)];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const start = () => {
    if (entries === undefined) void loadEntries().then(setEntries);
  };
  const go = (e: SearchEntry) => {
    setOpen(false);
    router.push(recipeHref(e));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (results.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (Math.min(a, results.length - 1) + step + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (shown && current !== undefined) {
        e.preventDefault();
        go(current);
      }
    } else if (e.key === "Escape") {
      if (shown) {
        e.preventDefault();
        setOpen(false);
      } else if (query !== "") {
        setQuery("");
      }
    }
  };

  const option = (e: SearchEntry, i: number) => {
    const el = (
      <div
        key={e.id}
        id={`${id}-o${i}`}
        role="option"
        aria-selected={current?.id === e.id}
        className={styles.result}
        data-active={current?.id === e.id || undefined}
        onPointerMove={() => setActive(i)}
        onClick={() => go(e)}
      >
        <ItemIcon icon={e.icon} quality={e.quality} size="result" />
        <span className={styles.resultText}>
          {e.itemId === undefined ? (
            <span className={`${bits.itemName} ${styles.resultName}`} data-quality={e.quality}>
              {e.name}
            </span>
          ) : (
            <ItemTooltip itemId={e.itemId} hoverOnly>
              <span className={`${bits.itemName} ${styles.resultName}`} data-quality={e.quality}>
                {e.name}
              </span>
            </ItemTooltip>
          )}
          <span className={styles.resultMeta}>
            {e.crafters.length > 0 ? (
              <span className={bits.whos}>
                {e.crafters.map((c, j) => (
                  <Crafter key={j} {...c} plain />
                ))}
              </span>
            ) : (
              <SourceText source={e.source} />
            )}
          </span>
        </span>
        <span className={styles.resultSub}>
          {e.profession}
          {e.skill !== undefined && ` ${e.skill}`}
        </span>
      </div>
    );
    return el;
  };

  return (
    <div ref={root} className={styles.root}>
      <label className={styles.field} data-open={shown || undefined}>
        <SearchIcon className={styles.icon} />
        <span className="visually-hidden">Who can craft…</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={shown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown && current !== undefined ? `${id}-o${results.indexOf(current)}` : undefined}
          placeholder="Who can craft… e.g. Bolt of Silk Cloth"
          value={query}
          onFocus={() => {
            start();
            setOpen(true);
          }}
          onChange={(e) => {
            start();
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKey}
        />
        {q !== "" && (
          <span className={styles.esc} aria-hidden="true">
            Esc
          </span>
        )}
      </label>
      <div className={styles.popup} hidden={!shown}>
        <div id={listId} role="listbox" aria-label="Recipes">
          {groups.canCraft.length > 0 && (
            <div role="group" aria-labelledby={`${id}-can`}>
              <div id={`${id}-can`} className={styles.groupHead}>
                Can craft
              </div>
              {groups.canCraft.map((e, i) => option(e, i))}
            </div>
          )}
          {groups.nobodyYet.length > 0 && (
            <div role="group" aria-labelledby={`${id}-nobody`}>
              <div id={`${id}-nobody`} className={styles.groupHead}>
                Nobody yet
              </div>
              {groups.nobodyYet.map((e, i) => option(e, groups.canCraft.length + i))}
            </div>
          )}
        </div>
        {results[0] !== undefined && (
          <Link className={styles.all} href={`/professions/${encodeURIComponent(results[0].slug)}`}>
            All {results[0].profession} recipes ›
          </Link>
        )}
      </div>
    </div>
  );
}
