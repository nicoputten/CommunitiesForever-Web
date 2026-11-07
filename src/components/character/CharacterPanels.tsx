import Link from "next/link";
import { timeAgo } from "@/core/views/age";
import type { CharacterPage } from "@/core/views/character";
import type { CharacterView, ProfessionView } from "@/core/views/characters";
import { professionSlug, ROLE_NAMES } from "@/core/views/rosterQuery";
import type { RecipeLine } from "@/core/views/recipes";
import { capitalize } from "@/core/views/text";
import { characterHref } from "@/components/roster/CharacterRow";
import { SkillBar } from "@/components/professions/SkillBar";
import { ClassDisc } from "@/components/ui/ClassDisc";
import { InfoTip } from "@/components/ui/InfoTip";
import { LocalTime } from "@/components/ui/LocalTime";
import { classColours } from "./classStyle";
import panel from "./Panel.module.css";
import styles from "./CharacterPanels.module.css";

/** At a glance (character board): item level, role, main tree, faction, ruleset; "—" for what the addon left out. */
export function AtAGlance({ character: c }: { character: CharacterView }) {
  const items: [string, React.ReactNode][] = [
    ["Item level", c.ilvl ?? "—"],
    ["Role", c.role === undefined ? "—" : ROLE_NAMES[c.role]],
    ["Main tree", c.mainTreeName ?? "—"],
    [
      "Faction",
      c.faction === undefined ? (
        "—"
      ) : (
        <span className={styles.faction} data-faction={c.faction.toLowerCase()}>
          {c.faction}
        </span>
      ),
    ],
    ["Ruleset", c.ruleset ?? "—"],
  ];
  return (
    <section className={panel.box} aria-labelledby="at-a-glance">
      <h2 id="at-a-glance" className={panel.title}>
        At a glance
      </h2>
      <dl className={styles.glance}>
        {items.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The professions panel (character board): skill bars on the 300 scale, secondary ones muted. Under each crafting
 * profession its recipe line (WEB-92, board recipes-character). */
export function ProfessionList({
  professions,
  guid,
  recipes = {},
}: {
  professions: ProfessionView[];
  guid?: string;
  recipes?: Record<string, RecipeLine>;
}) {
  const top = professions[0];
  return (
    <section className={panel.box} aria-labelledby="character-professions">
      <h2 id="character-professions" className={panel.title}>
        Professions
      </h2>
      {top === undefined ? (
        <p className={panel.empty}>No professions yet</p>
      ) : (
        <>
          <ul className={panel.rows}>
            {professions.map((p) => (
              <li key={p.skillLine} className={panel.row}>
                <span className={panel.label} data-tone={p.kind === "secondary" ? "muted" : undefined}>
                  {p.name}
                </span>
                <SkillBar rank={p.rank} max={p.max} best={p.kind !== "secondary"} />
                <span className={panel.value}>{p.max === undefined ? p.rank : `${p.rank} / ${p.max}`}</span>
                {recipes[p.skillLine] !== undefined && guid !== undefined && (
                  <RecipeSubLine line={recipes[p.skillLine]!} guid={guid} />
                )}
              </li>
            ))}
          </ul>
          <Link className={panel.link} href={`/professions#${professionSlug(top.skillLine)}`}>
            Compare with the group →
          </Link>
        </>
      )}
    </section>
  );
}

/** "86 recipes ›" to the profession page filtered to this character; "as of 21 Oct" when its scan is older than 7
 * days; "Recipes not scanned" with an ⓘ when it never was (board recipes-character). */
function RecipeSubLine({ line, guid }: { line: RecipeLine; guid: string }) {
  if (line.kind === "notScanned") {
    return (
      <span className={panel.recipes}>
        Recipes not scanned
        <InfoTip>{`Open ${line.name} in game once.`}</InfoTip>
      </span>
    );
  }
  return (
    <span className={panel.recipes}>
      <Link
        className={panel.recipeLink}
        href={`/professions/${encodeURIComponent(line.slug)}?char=${encodeURIComponent(guid)}`}
      >
        {line.count} {line.count === 1 ? "recipe" : "recipes"} ›
      </Link>
      {line.spec !== undefined && <span className={panel.spec}>{line.spec}</span>}
      {line.staleAt !== undefined && (
        <span>
          as of <LocalTime at={line.staleAt} day="date" />
        </span>
      )}
    </span>
  );
}

/** "24 Warrior · Tank · 3 days ago". */
function summary(c: CharacterView, now: number): string {
  return [
    [c.level, c.className].filter((p) => p !== undefined).join(" "),
    c.role === undefined ? undefined : ROLE_NAMES[c.role],
    c.lastPlayed === undefined ? undefined : capitalize(timeAgo(c.lastPlayed, now)),
  ]
    .filter((p) => p !== undefined && p !== "")
    .join(" · ");
}

/** "Nico's other characters" (character board); nothing when there are none. */
export function OtherCharacters({ page, now }: { page: CharacterPage; now: number }) {
  if (page.otherCharacters.length === 0) return null;
  const owner = page.person?.displayName;
  return (
    <section className={panel.box} aria-labelledby="other-characters">
      <h2 id="other-characters" className={panel.title}>
        {owner === undefined ? "Other characters" : `${owner}'s other characters`}
      </h2>
      <ul className={styles.others}>
        {page.otherCharacters.map((o) => (
          <li key={o.guid}>
            <Link href={characterHref(o.guid)} className={styles.other} style={classColours(o.classFile)}>
              <ClassDisc name={o.name} classFile={o.classFile} size="avatar" />
              <span className={styles.otherText}>
                <span className={styles.otherName}>{o.name}</span>
                <span className={styles.otherMeta}>{summary(o, now)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
