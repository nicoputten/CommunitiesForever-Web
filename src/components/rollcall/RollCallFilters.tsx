"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LEVEL_RANGES, rollCallParams, type RollCallQuery } from "@/core/views";
import type { Faction } from "@/core/gamedata";
import { FilterMenu } from "@/components/roster/FilterMenu";
import { FilterChip } from "@/components/ui/FilterChip";
import styles from "./RollCallPanel.module.css";

const ANY = "any";

/**
 * The roll call's filters (map board): everyone or one friend, New, faction and level. Each one is a new history
 * entry (Back undoes it); the map's own `continent` and `character` stay.
 */
export function RollCallFilters({ query, people }: { query: RollCallQuery; people: { key: string; name: string }[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const go = (next: RollCallQuery) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(rollCallParams(next))) {
      if (value === undefined) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    startTransition(() => router.push(`${url.pathname}${url.search}`, { scroll: false }));
  };

  const withValue = <K extends keyof RollCallQuery>(key: K, value: RollCallQuery[K] | undefined): RollCallQuery => {
    const next = { ...query };
    if (value === undefined) delete next[key];
    else next[key] = value;
    return next;
  };

  const range = LEVEL_RANGES.find((r) => r.key === query.level);

  return (
    <>
      <div role="group" aria-label="Friend" className={styles.chips}>
        <FilterChip pressed={query.friend === undefined} onClick={() => go(withValue("friend", undefined))}>
          All
        </FilterChip>
        {people.map((p) => (
          <FilterChip key={p.key} pressed={query.friend === p.key} onClick={() => go(withValue("friend", p.key))}>
            {p.name}
          </FilterChip>
        ))}
      </div>
      <div className={styles.chips}>
        <FilterChip pressed={query.liveOnly} onClick={() => go({ ...query, liveOnly: !query.liveOnly })}>
          New
        </FilterChip>
        <FilterMenu
          name="Faction"
          kind="radio"
          label={query.faction ?? "Horde + Alliance"}
          active={query.faction !== undefined}
          items={[
            { key: ANY, label: "Horde + Alliance", checked: query.faction === undefined },
            { key: "Horde", label: "Horde", checked: query.faction === "Horde" },
            { key: "Alliance", label: "Alliance", checked: query.faction === "Alliance" },
          ]}
          onSelect={(key) => go(withValue("faction", key === ANY ? undefined : (key as Faction)))}
        />
        <FilterMenu
          name="Level"
          kind="radio"
          label={`Level ${range?.label ?? "1–60"}`}
          active={range !== undefined}
          items={[
            { key: ANY, label: "Any", checked: range === undefined },
            ...LEVEL_RANGES.map((r) => ({ key: r.key, label: r.label, checked: r.key === query.level })),
          ]}
          onSelect={(key) => go(withValue("level", key === ANY ? undefined : key))}
        />
      </div>
    </>
  );
}
