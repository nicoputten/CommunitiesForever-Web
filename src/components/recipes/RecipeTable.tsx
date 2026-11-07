"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import type { RecipeRow } from "@/core/views/recipes";
import { ItemIcon, KnownBy, SkillNumbers, SourceText, bits } from "./bits";
import { ItemTooltip } from "./ItemTooltip";
import styles from "./RecipeTable.module.css";

// The profession page's table (WEB-92, handoff C4, board recipes-page): grouped by item type, highest skill first;
// columns icon, recipe (name in quality colour), the four skill numbers, who knows it, where it's learned. TanStack
// Table holds the columns, TanStack Virtual renders only the rows in view (300 rows scroll smoothly). On a phone each
// row is two lines (board recipes-phone): the name, then the numbers and the crafters (or where it's learned).

type Item = { kind: "group"; name: string } | { kind: "row"; row: RecipeRow };

const subscribeNone = () => () => {};
/** False on the server and in the first render: the table shows skeleton rows until it can measure (RC06 Loading). */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNone,
    () => true,
    () => false,
  );
}

function RecipeName({ row, href, onOpen }: { row: RecipeRow; href: string; onOpen: (id: number) => void }) {
  const link = (
    <a
      href={href}
      className={`${bits.itemName} ${styles.name}`}
      data-quality={row.quality}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen(row.id);
      }}
    >
      {row.name}
    </a>
  );
  return row.itemId === undefined ? (
    link
  ) : (
    <ItemTooltip itemId={row.itemId} hoverOnly>
      {link}
    </ItemTooltip>
  );
}

function RowIcon({ row, href }: { row: RecipeRow; href: string }) {
  const icon = <ItemIcon icon={row.icon} quality={row.quality} size="row" />;
  if (row.itemId === undefined) return icon;
  return (
    <ItemTooltip itemId={row.itemId} recipeHref={href} label={`${row.name}, item details`}>
      <span className={styles.iconHover}>{icon}</span>
    </ItemTooltip>
  );
}

export function RecipeTable({
  rows,
  openId,
  hrefFor,
  onOpen,
}: {
  rows: RecipeRow[];
  openId: number | undefined;
  hrefFor: (id: number) => string;
  onOpen: (id: number) => void;
}) {
  const columns = useMemo<ColumnDef<RecipeRow>[]>(
    () => [
      {
        id: "icon",
        header: () => <span className="visually-hidden">Icon</span>,
        cell: ({ row }) => <RowIcon row={row.original} href={hrefFor(row.original.id)} />,
      },
      {
        id: "recipe",
        header: "Recipe",
        cell: ({ row }) => <RecipeName row={row.original} href={hrefFor(row.original.id)} onOpen={onOpen} />,
      },
      { id: "skill", header: "Skill", cell: ({ row }) => <SkillNumbers t={row.original.thresholds} /> },
      { id: "known", header: "Known by", cell: ({ row }) => <KnownBy knowers={row.original.knownBy} /> },
      { id: "source", header: "Learn from", cell: ({ row }) => <SourceText source={row.original.sources[0]} /> },
    ],
    [hrefFor, onOpen],
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's API returns new functions each render
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => String(r.id),
  });
  const tableRows = table.getRowModel().rows;

  const items = useMemo(() => {
    const out: Item[] = [];
    let group: string | undefined;
    for (const r of rows) {
      if (r.category !== group) {
        group = r.category;
        out.push({ kind: "group", name: group });
      }
      out.push({ kind: "row", row: r });
    }
    return out;
  }, [rows]);
  const byId = useMemo(() => new Map(tableRows.map((r) => [r.original.id, r])), [tableRows]);

  const list = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setMargin((list.current?.getBoundingClientRect().top ?? 0) + window.scrollY);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const mounted = useMounted();
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: (i) => (items[i]?.kind === "group" ? 44 : 46),
    overscan: 12,
    scrollMargin: margin,
    getItemKey: (i) => {
      const it = items[i]!;
      return it.kind === "group" ? `g:${it.name}` : it.row.id;
    },
  });

  const onRowClick = (e: MouseEvent, id: number) => {
    // A link, button or hint inside the row does its own thing.
    const hit = (e.target as HTMLElement).closest("a, button, [tabindex]");
    if (hit !== null && hit !== e.currentTarget && e.currentTarget.contains(hit)) return;
    onOpen(id);
  };

  const header = table.getHeaderGroups()[0]!;
  return (
    <div role="table" aria-label="Recipes" aria-rowcount={items.length + 1} className={styles.table}>
      <div role="rowgroup" className={styles.head}>
        <div role="row" className={styles.grid}>
          {header.headers.map((h) => (
            <span key={h.id} role="columnheader" className={styles.th} data-col={h.id}>
              {flexRender(h.column.columnDef.header, h.getContext())}
            </span>
          ))}
        </div>
      </div>
      <div role="rowgroup" ref={list} className={styles.body} aria-busy={!mounted || undefined}>
        {!mounted ? (
          Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`${styles.grid} ${styles.skeleton}`} aria-hidden="true">
              <span className={styles.skIcon} />
              <span className={styles.skLine} data-w="60" />
              <span className={styles.skLine} data-w="80" />
              <span className={styles.skLine} data-w="70" />
              <span className={styles.skLine} data-w="60" />
            </div>
          ))
        ) : (
          <div className={styles.space} style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((v) => {
              const it = items[v.index]!;
              const style = { transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)` };
              if (it.kind === "group") {
                return (
                  <div
                    key={v.key}
                    ref={virtualizer.measureElement}
                    data-index={v.index}
                    role="row"
                    aria-rowindex={v.index + 2}
                    className={styles.group}
                    style={style}
                  >
                    <span role="rowheader" aria-colspan={5}>
                      {it.name}
                    </span>
                  </div>
                );
              }
              const r = it.row;
              const tr = byId.get(r.id);
              return (
                <div
                  key={v.key}
                  ref={virtualizer.measureElement}
                  data-index={v.index}
                  role="row"
                  aria-rowindex={v.index + 2}
                  aria-current={r.id === openId || undefined}
                  className={`${styles.grid} ${styles.row}`}
                  data-open={r.id === openId || undefined}
                  data-missing={r.knownBy.length === 0 || undefined}
                  style={style}
                  onClick={(e) => onRowClick(e, r.id)}
                >
                  {tr?.getVisibleCells().map((cell) => (
                    <span key={cell.id} role="cell" className={styles.td} data-col={cell.column.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  ))}
                  {/* The phone's second line: the numbers, then the crafters or where it's learned. */}
                  <span role="cell" className={styles.phoneMeta}>
                    <SkillNumbers t={r.thresholds} />
                    {r.knownBy.length > 0 ? <KnownBy knowers={r.knownBy} /> : <SourceText source={r.sources[0]} />}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
