import { Fragment, type CSSProperties } from "react";
import { classInfo, type ClassFile } from "@/core/gamedata";
import type { ItemQuality } from "@/core/gamedata/items";
import type { Difficulty, Thresholds } from "@/core/recipes/skill";
import type { Knower, SourceView } from "@/core/views/recipes";
import { FALLBACK_ICON } from "@/core/recipes/icons";
import { Hint } from "./Hint";
import styles from "./bits.module.css";

// Small pieces every recipe screen shares (WEB-92, boards recipes-page, recipes-drawer, recipes-search).

export type IconSize = "row" | "reagent" | "result" | "drawer";

/** The icon cache's URL for an icon name (WEB-90, /api/item-icons); the game's question mark without one. */
export function iconSrc(icon: string | undefined): string {
  return `/api/item-icons/${encodeURIComponent(icon ?? FALLBACK_ICON)}`;
}

/** An item icon, its border in the item's quality colour. Decorative: the name always goes with it. */
export function ItemIcon({ icon, quality, size = "row" }: { icon?: string; quality: ItemQuality; size?: IconSize }) {
  return (
    <span className={styles.icon} data-quality={quality} data-size={size === "row" ? undefined : size}>
      {/* eslint-disable-next-line @next/next/no-img-element -- our own icon cache, 56 px JPEGs scaled by CSS */}
      <img src={iconSrc(icon)} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

const DIFFICULTIES: Difficulty[] = ["orange", "yellow", "green", "grey"];
const NAMES: Record<Difficulty, string> = { orange: "Orange", yellow: "Yellow", green: "Green", grey: "Grey" };

/** What crafting a recipe of that colour gives (the game's trade skill colours). */
export const DIFFICULTY_MEANING: Record<Difficulty, string> = {
  orange: "Orange: always a skill point",
  yellow: "Yellow: usually a skill point",
  green: "Green: rarely a skill point",
  grey: "Grey: no skill point",
};

/** "300 · 315 · 322 · 330" in the four colours; the hint names them. */
export function SkillNumbers({ t }: { t: Thresholds | undefined }) {
  if (t === undefined) return <span className={styles.nobody}>—</span>;
  const text = DIFFICULTIES.map((d) => `${NAMES[d]} from ${t[d]}`).join(" · ");
  return (
    <Hint text={`Skill: ${text}`}>
      <span className={styles.skill}>
        {DIFFICULTIES.map((d, i) => (
          <Fragment key={d}>
            {i > 0 && <span className={styles.sep}>·</span>}
            <span data-d={d}>{t[d]}</span>
          </Fragment>
        ))}
      </span>
    </Hint>
  );
}

export function classTextVar(classFile: ClassFile | undefined): CSSProperties | undefined {
  const info = classInfo(classFile);
  return info === undefined ? undefined : ({ "--class-text": `var(${info.textToken})` } as CSSProperties);
}

/** A crafter's name in class colour with the recipe's colour for them as a dot (and its meaning as a hint). */
export function Crafter({
  name,
  classFile,
  difficulty,
  plain = false,
}: Pick<Knower, "name" | "classFile" | "difficulty"> & {
  /** No hint (inside a search result, which is one option): the colour is read out instead. */
  plain?: boolean;
}) {
  return (
    <span className={styles.who} style={classTextVar(classFile)}>
      {name}
      {difficulty !== undefined && plain && (
        <>
          <span className={styles.dot} data-d={difficulty} aria-hidden="true" />
          <span className="visually-hidden"> ({difficulty})</span>
        </>
      )}
      {difficulty !== undefined && !plain && (
        <Hint text={DIFFICULTY_MEANING[difficulty]}>
          <span className={styles.dot} data-d={difficulty} />
        </Hint>
      )}
    </span>
  );
}

export function KnownBy({ knowers }: { knowers: Pick<Knower, "guid" | "name" | "classFile" | "difficulty">[] }) {
  if (knowers.length === 0) return <span className={styles.nobody}>Nobody yet</span>;
  return (
    <span className={styles.whos}>
      {knowers.map((k) => (
        <Crafter key={k.guid} {...k} />
      ))}
    </span>
  );
}

/** "Drop · Blackrock Spire" (the detail dim), "Trainer"; "—" when where it's learned is unknown. */
export function SourceText({ source }: { source: SourceView | undefined }) {
  if (source === undefined) return <span className={styles.nobody}>—</span>;
  return (
    <span className={styles.source}>
      {source.label}
      {source.detail !== undefined && <em> · {source.detail}</em>}
    </span>
  );
}

export { styles as bits };
