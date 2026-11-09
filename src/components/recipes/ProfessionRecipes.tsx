"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import MiniSearch from "minisearch";
import {
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { useId, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import {
  SKILL_RANGES,
  defaultTab,
  filterRows,
  tabCounts,
  type ProfessionRecipesView,
  type RecipeRow,
  type RecipeTab,
} from "@/core/views/recipes";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { InfoTip } from "@/components/ui/InfoTip";
import { LocalTime } from "@/components/ui/LocalTime";
import { SearchIcon } from "@/components/ui/icons";
import { RecipeDrawerBody, type DrawerNav } from "./RecipeDrawer";
import { RecipeTable } from "./RecipeTable";
import buttons from "./buttons.module.css";
import drawer from "./RecipeDrawer.module.css";
import styles from "./ProfessionRecipes.module.css";

// The profession page's recipes (WEB-92, handoff C4–C6, boards recipes-page, recipes-phone, recipes-states): tabs,
// filters and the open recipe all live in the URL (?char=&type=&skill=&tab=&q=&recipe=), so any view is a link. WEB-98:
// `back` holds the recipes a crafted reagent's link came from, for the drawer's Back arrow.

const TABS = ["all", "known", "missing"] as const;

export const recipeParams = {
  char: parseAsString,
  type: parseAsString,
  skill: parseAsString,
  tab: parseAsStringLiteral(TABS),
  q: parseAsString,
  recipe: parseAsInteger,
  back: parseAsArrayOf(parseAsInteger),
};

export const recipeHref = createSerializer(recipeParams);

const TAB_NAMES: Record<RecipeTab, string> = { all: "All", known: "Known", missing: "Nobody has" };
const ALL = "*";

const SHEET_QUERY = "(max-width: 1023px)";
const subscribeSheet = (onChange: () => void) => {
  const q = window.matchMedia(SHEET_QUERY);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
};
/** Below 1024 px the drawer is a sheet (board recipes-phone). */
function useSheet(): boolean {
  return useSyncExternalStore(
    subscribeSheet,
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false,
  );
}

export function ProfessionRecipes({
  view,
  title,
  count,
  crafters,
}: {
  view: ProfessionRecipesView;
  /** The name and its card badge. */
  title: ReactNode;
  /** "112 of 185 recipes known" and the crafter bars: left out while nothing was scanned (RC06). */
  count: ReactNode;
  crafters: ReactNode;
}) {
  const [params, setParams] = useQueryStates(recipeParams, { history: "replace", scroll: false });
  const char = view.crafters.some((c) => c.guid === params.char) ? (params.char ?? undefined) : undefined;
  const tab: RecipeTab = params.tab ?? defaultTab(char);
  const type = params.type !== null && view.types.includes(params.type) ? params.type : undefined;
  const skill =
    params.skill !== null && (SKILL_RANGES as readonly string[]).includes(params.skill) ? params.skill : undefined;
  const query = params.q ?? "";

  const search = useMemo(() => {
    const index = new MiniSearch<RecipeRow>({
      fields: ["name"],
      storeFields: [],
      searchOptions: { prefix: true, fuzzy: 0.25, combineWith: "AND" },
    });
    index.addAll(view.rows);
    return index;
  }, [view.rows]);
  const matches = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return undefined;
    return new Set(search.search(q).map((r) => r.id as number));
  }, [search, query]);

  const filter = { tab, char, type, skill, matches };
  const rows = useMemo(() => filterRows(view.rows, filter), [view.rows, tab, char, type, skill, matches]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = tabCounts(view, char);
  // A recipe of this profession, or (WEB-98) another profession's that a crafted reagent links to.
  const findRow = (id: number | null | undefined): (RecipeRow & { profession?: string }) | undefined =>
    id === null || id === undefined
      ? undefined
      : (view.rows.find((r) => r.id === id) ?? view.linked.find((r) => r.id === id));
  const open = findRow(params.recipe);
  const back = params.back ?? [];
  const backRow = findRow(back.at(-1));
  const crafter = view.crafters.find((c) => c.guid === char);
  const filtered = query.trim() !== "" || type !== undefined || skill !== undefined || char !== undefined;

  const hrefFor = (recipe: number) => recipeHref({ ...params, recipe });
  // A link to a recipe of a profession nobody scanned (WEB-104: a boss's recipe drop, the bot) opens it over all
  // recipes; closing it stays on them rather than going back to "No recipes scanned yet".
  const openRecipe = (recipe: number | null) =>
    void setParams(
      recipe === null && view.notScanned && params.tab === null
        ? { recipe, back: null, tab: "all" }
        : { recipe, back: null },
      { history: recipe === null ? "replace" : "push" },
    );
  // WEB-98: a crafted reagent's link swaps the drawer to its recipe; Back returns.
  const backFrom = open === undefined ? back : [...back, open.id];
  const nav: DrawerNav = {
    hrefFor: (recipe) => recipeHref({ ...params, recipe, back: backFrom }),
    open: (recipe) => void setParams({ recipe, back: backFrom }, { history: "push" }),
    ...(backRow !== undefined
      ? {
          back: {
            name: backRow.name,
            go: () =>
              void setParams(
                { recipe: backRow.id, back: back.length > 1 ? back.slice(0, -1) : null },
                { history: "replace" },
              ),
          },
        }
      : {}),
  };

  if (view.notScanned && params.tab === null && open === undefined) {
    const who = view.crafters[0]?.name;
    return (
      <>
        <div className={styles.titleRow}>{title}</div>
        <div className={styles.notScanned}>
          <p className={styles.stateTitle}>
            No recipes scanned yet
            {who !== undefined && <InfoTip>{`${who} opens ${view.name} in game once.`}</InfoTip>}
          </p>
          <p className={styles.stateMeta}>
            {view.total} {view.total === 1 ? "recipe" : "recipes"} to learn
          </p>
          <a
            className={buttons.secondary}
            href={recipeHref({ tab: "all" })}
            onClick={(e) => {
              e.preventDefault();
              void setParams({ tab: "all" });
            }}
          >
            See all recipes
          </a>
        </div>
      </>
    );
  }

  const charOptions: DropdownOption[] = [
    { value: ALL, label: "Everyone" },
    ...view.crafters.map((c) => ({ value: c.guid, label: c.name })),
  ];
  const typeOptions: DropdownOption[] = [
    { value: ALL, label: "Any type" },
    ...view.types.map((t) => ({ value: t, label: t })),
  ];
  const skillOptions: DropdownOption[] = [
    { value: ALL, label: "Skill 1–300" },
    ...SKILL_RANGES.map((r) => ({ value: r, label: `Skill ${r.replace("-", "–")}` })),
  ];

  const body = (
    <>
      {crafter?.stale && crafter.scannedAt !== undefined && (
        <p className={styles.stale}>
          as of <LocalTime at={crafter.scannedAt} day="date" />
        </p>
      )}
      {rows.length === 0 ? (
        <div className={styles.noResults}>
          <p className={styles.stateTitle}>
            {query.trim() === "" ? "No recipe matches" : `No recipe matches “${query.trim()}”`}
          </p>
          {filtered && (
            <button
              type="button"
              className={buttons.textLink}
              onClick={() => void setParams({ q: null, type: null, skill: null, char: null })}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <RecipeTable rows={rows} openId={open?.id} hrefFor={hrefFor} onOpen={openRecipe} />
      )}
    </>
  );

  return (
    <>
      <div className={styles.titleRow}>
        {title}
        {count}
      </div>
      {crafters}
      <Tabs.Root
        value={tab}
        onValueChange={(v) => void setParams({ tab: v === defaultTab(char) ? null : (v as RecipeTab) })}
        className={styles.root}
      >
        <div className={styles.controls}>
          <Tabs.List className={styles.tabs} aria-label="Recipes">
            {TABS.map((t) => (
              <Tabs.Trigger key={t} value={t} className={styles.tab}>
                {TAB_NAMES[t]} <b>{counts[t]}</b>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <span className={styles.spacer} />
          <label className={styles.search}>
            <SearchIcon className={styles.searchIcon} />
            <input
              type="search"
              value={query}
              placeholder={`Search ${view.name}`}
              aria-label={`Search ${view.name}`}
              onChange={(e) => void setParams({ q: e.target.value === "" ? null : e.target.value })}
            />
          </label>
          <div className={styles.filters}>
            <Dropdown
              options={charOptions}
              value={char ?? ALL}
              ariaLabel="Character"
              onChange={(v) => void setParams({ char: v === ALL ? null : v })}
              className={styles.filter}
            />
            <Dropdown
              options={typeOptions}
              value={type ?? ALL}
              ariaLabel="Type"
              onChange={(v) => void setParams({ type: v === ALL ? null : v })}
              className={styles.filter}
            />
            <Dropdown
              options={skillOptions}
              value={skill ?? ALL}
              ariaLabel="Skill"
              onChange={(v) => void setParams({ skill: v === ALL ? null : v })}
              className={styles.filter}
            />
          </div>
        </div>
        <div className={styles.layout} data-drawer={open === undefined ? undefined : ""}>
          {TABS.map((t) => (
            <Tabs.Content key={t} value={t} className={styles.content}>
              {t === tab && body}
            </Tabs.Content>
          ))}
          {open !== undefined && (
            <Drawer row={open} profession={open.profession ?? view.name} nav={nav} onClose={() => openRecipe(null)} />
          )}
        </div>
      </Tabs.Root>
    </>
  );
}

/** The open recipe: a non-modal panel on the right on desktop, a sheet below 1024 px (swipe down or ✕ closes). */
function Drawer({
  row,
  profession,
  nav,
  onClose,
}: {
  row: RecipeRow;
  profession: string;
  nav: DrawerNav;
  onClose: () => void;
}) {
  const sheet = useSheet();
  const titleId = useId();
  const [drag, setDrag] = useState<number | undefined>(undefined);
  const start = useRef(0);

  const close = (
    <Dialog.Close className={drawer.close} aria-label="Close">
      <span aria-hidden="true">✕</span>
    </Dialog.Close>
  );
  const body = <RecipeDrawerBody row={row} profession={profession} titleId={titleId} close={close} nav={nav} />;
  const onOpenChange = (o: boolean) => !o && onClose();

  if (sheet) {
    const onDown = (e: PointerEvent) => {
      start.current = e.clientY;
      setDrag(0);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => drag !== undefined && setDrag(Math.max(0, e.clientY - start.current));
    const onUp = () => {
      if ((drag ?? 0) > 100) onClose();
      setDrag(undefined);
    };
    return (
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className={drawer.scrim} />
          <Dialog.Content
            className={drawer.sheet}
            aria-labelledby={titleId}
            aria-describedby={undefined}
            data-dragging={drag === undefined ? undefined : ""}
            style={drag ? { transform: `translateY(${drag}px)` } : undefined}
          >
            <div
              className={drawer.sheetGrab}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(undefined)}
              aria-hidden="true"
            >
              <span />
            </div>
            <div className={drawer.sheetBody}>{body}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open modal={false} onOpenChange={onOpenChange}>
      <Dialog.Content
        className={drawer.panel}
        aria-labelledby={titleId}
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {body}
      </Dialog.Content>
    </Dialog.Root>
  );
}
