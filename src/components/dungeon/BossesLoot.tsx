"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import switches from "@/components/discord/Discord.module.css";
import { ItemIcon } from "@/components/recipes/bits";
import { ItemTooltip, useNoHover } from "@/components/recipes/ItemTooltip";
import tooltip from "@/components/recipes/ItemTooltip.module.css";
import runs from "@/components/runs/Runs.module.css";
import { Dropdown } from "@/components/ui/Dropdown";
import { InfoTip } from "@/components/ui/InfoTip";
import { usable } from "@/core/loot";
import { LOOT_SHOWN, type BossSection, type BossesLoot as Loot, type LootRow } from "@/core/views/dungeonLoot";
import styles from "./Dungeon.module.css";

// Bosses & loot (WEB-102, board DL04): every boss open, its loot in two columns (one on a phone), at most LOOT_SHOWN
// drops before "Show N more ▾". "Usable by [character ▾]" starts on your most recently played character and is
// remembered in this browser with the switch: off dims what the class can never use, on hides it (the count of
// "Show N more" follows the switch).

const STORAGE = "cf.usableBy";

const color = (token: string | undefined) =>
  token === undefined ? undefined : ({ color: `var(${token})` } as CSSProperties);

interface Saved {
  guid?: string;
  hide?: boolean;
}

const CHANGED = "cf-usable-by";
// Kept for this page when the browser's storage is off (private mode).
let memory = "{}";

function rawSaved(): string {
  try {
    return window.localStorage.getItem(STORAGE) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

function parseSaved(raw: string): Saved {
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return {};
    const s = v as Record<string, unknown>;
    return {
      ...(typeof s.guid === "string" ? { guid: s.guid } : {}),
      ...(typeof s.hide === "boolean" ? { hide: s.hide } : {}),
    };
  } catch {
    return {};
  }
}

function save(s: Saved): void {
  memory = JSON.stringify(s);
  try {
    window.localStorage.setItem(STORAGE, memory);
  } catch {
    // Private mode or storage off: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function RecipeFooter({ row }: { row: LootRow }) {
  const r = row.recipe!;
  return (
    <>
      <span className={tooltip.line} data-tone="green">
        Nobody knows it
      </span>
      {r.canLearn.length > 0 && (
        <span className={tooltip.line}>
          Can learn:{" "}
          {r.canLearn.map((l, i) => (
            <span key={l.guid}>
              {i > 0 && ", "}
              <span style={color(l.colorToken)}>{l.name}</span> · {l.skill}
            </span>
          ))}
        </span>
      )}
      {r.href !== undefined && (
        <span className={tooltip.line} data-tone="yellow">
          Click to open the recipe ›
        </span>
      )}
    </>
  );
}

function Row({ row, ok }: { row: LootRow; ok: boolean }) {
  const unknownRecipe = row.recipe !== undefined && !row.recipe.known;
  const footer = unknownRecipe ? <RecipeFooter row={row} /> : undefined;
  // On a phone the icon's sheet has "Open recipe" (a 44 px button); the name stays text.
  const noHover = useNoHover();
  const name =
    row.recipe?.href !== undefined && !noHover ? (
      <Link href={row.recipe.href} className={styles.lootName} data-quality={row.quality}>
        {row.name}
      </Link>
    ) : (
      <span className={styles.lootName} data-quality={row.quality}>
        {row.name}
      </span>
    );
  return (
    <li className={styles.lootRow} data-unusable={ok ? undefined : ""}>
      <ItemTooltip
        itemId={row.itemId}
        label={`${row.name}, item details`}
        footer={footer}
        {...(row.recipe?.href !== undefined ? { recipeHref: row.recipe.href } : {})}
      >
        <span className={styles.lootIcon}>
          <ItemIcon icon={row.icon} quality={row.quality} size="result" />
        </span>
      </ItemTooltip>
      <span className={styles.lootText}>
        <span className={styles.lootNameLine}>
          <ItemTooltip itemId={row.itemId} hoverOnly footer={footer}>
            {name}
          </ItemTooltip>
          {row.quest && (
            <span className={styles.tag} data-tag="quest">
              Quest
            </span>
          )}
          {unknownRecipe && (
            <span className={styles.tag} data-tag="unknown">
              Nobody knows it
            </span>
          )}
        </span>
        <span className={styles.lootType}>{row.type}</span>
      </span>
      <span className={styles.chance}>{row.chance}</span>
      {!ok && <span className="visually-hidden">, can&apos;t use</span>}
    </li>
  );
}

function Boss({ boss, classFile, hide }: { boss: BossSection; classFile: string | undefined; hide: boolean }) {
  const [open, setOpen] = useState(false);
  const rows = boss.rows.map((row) => ({ row, ok: usable(classFile, row.drop) })).filter((r) => !hide || r.ok);
  const shown = open ? rows : rows.slice(0, LOOT_SHOWN);
  const more = rows.length - shown.length;
  return (
    <section id={boss.anchor} className={styles.boss} aria-labelledby={`${boss.anchor}-name`}>
      <h3 id={`${boss.anchor}-name`} className={styles.bossName}>
        <span className={styles.bossN}>{boss.n}</span>
        {boss.name}
        {boss.optional && <span className={styles.optional}>optional</span>}
      </h3>
      {boss.rows.length === 0 ? (
        <p className={runs.small}>No loot known for this boss.</p>
      ) : rows.length === 0 ? (
        <p className={runs.small}>Nothing this character can use.</p>
      ) : (
        <ul className={styles.loot}>
          {shown.map(({ row, ok }) => (
            <Row key={row.itemId} row={row} ok={ok} />
          ))}
        </ul>
      )}
      {more > 0 && (
        <button type="button" className={styles.showMore} aria-expanded={false} onClick={() => setOpen(true)}>
          Show {more} more ▾
        </button>
      )}
    </section>
  );
}

export function BossesLoot({ loot }: { loot: Loot }) {
  const first = loot.characters[0]?.guid;
  const raw = useSyncExternalStore(subscribe, rawSaved, () => "{}");
  const pick = useMemo(() => parseSaved(raw), [raw]);
  const guid = loot.characters.some((c) => c.guid === pick.guid) ? pick.guid : first;
  const hide = pick.hide === true;
  const character = loot.characters.find((c) => c.guid === guid);
  const update = (next: Saved) => {
    save({ ...pick, ...next });
  };

  return (
    <section className={runs.box} aria-labelledby="bosses-loot">
      <div className={styles.lootHead}>
        <h2 id="bosses-loot" className={runs.boxTitle}>
          Bosses &amp; loot
        </h2>
        <div className={styles.lootControls}>
          <span className={styles.classic}>
            Classic data
            <InfoTip>Drops and chances come from Classic 1.12 and may differ on Forever.</InfoTip>
          </span>
          {character !== undefined && (
            <span className={styles.usableBy}>
              <button
                type="button"
                role="switch"
                aria-checked={hide}
                aria-label={`Hide what ${character.name} can't use`}
                className={switches.switchButton}
                onClick={() => update({ hide: !hide })}
              >
                <span className={switches.switch} aria-hidden="true" />
              </button>
              <span id="usable-by" aria-hidden="true">
                Usable by
              </span>
              <Dropdown
                options={loot.characters.map((c) => ({ value: c.guid, label: c.name }))}
                value={character.guid}
                onChange={(value) => update({ guid: value })}
                ariaLabel="Usable by"
                size="compact"
                className={styles.usableDropdown}
              />
            </span>
          )}
        </div>
      </div>
      {loot.bosses.map((b) => (
        <Boss key={b.id} boss={b} classFile={character?.classFile} hide={hide} />
      ))}
    </section>
  );
}
