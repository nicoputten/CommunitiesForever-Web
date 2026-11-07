import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { PlusIcon } from "@/components/ui/icons";
import { BossesLoot } from "@/components/dungeon/BossesLoot";
import { BossJump } from "@/components/dungeon/BossJump";
import { EntranceMap } from "@/components/dungeon/EntranceMap";
import { QuestsBox } from "@/components/dungeon/QuestsBox";
import styles from "@/components/dungeon/Dungeon.module.css";
import { ItemsProvider } from "@/components/recipes/itemsContext";
import runs from "@/components/runs/Runs.module.css";
import { runDungeon } from "@/core/runs";
import { dungeonPage, dungeonPageId, type FitCharacter } from "@/core/views/dungeon";
import { bossesLoot } from "@/core/views/dungeonLoot";
import { dungeonLootData, resetAfter } from "@/server/bossProgress";
import { getDb } from "@/server/db";
import { runsInput } from "@/server/runsInput";

const color = (token: string | undefined) =>
  token === undefined ? undefined : ({ color: `var(${token})` } as CSSProperties);

/**
 * A dungeon's page (WEB-42, board `dungeon-page`): the hero over the map around its entrance, with Scarlet
 * Monastery's wings and Plan a run; who fits per role and who has its quests (WEB-76); the runs planned here and in the
 * other wings; the runs that ran here. The layout above answers 404 for a raid or an unknown id and sends `/dungeons/sm` to its first wing.
 * WEB-102 (board DL04): Bosses & loot between Who fits and Quests, the Bosses jump list on top of the side column;
 * WEB-97: boss progress on Planned here, "Last cleared" under Ran here.
 */
export default async function DungeonPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const asked = dungeonPageId((await params).id);
  if (viewer === undefined || asked === undefined) notFound();
  const db = getDb();
  const dungeon = runDungeon(asked.id);
  if (dungeon === undefined) notFound();
  const input = runsInput(db, viewer.battleTag, nowSeconds());
  const data = dungeonLootData(db, dungeon);
  const page = dungeonPage(input, asked.id, {
    bosses: data.bosses,
    kills: data.kills,
    resetAfter: (at) => resetAfter(db, at),
  });
  if (page === undefined) notFound();
  const loot = bossesLoot({
    bosses: data.bosses,
    characters: input.characters,
    viewer: viewer.battleTag,
    known: data.known,
    professions: data.professions,
  });
  const hasBosses = loot.bosses.length > 0;

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={runs.crumbs}>
        {page.crumbs.map((c, i) => (
          <span key={c.label}>
            {i > 0 && " › "}
            {c.href === undefined ? c.label : <Link href={c.href}>{c.label}</Link>}
          </span>
        ))}
      </nav>

      <section className={styles.hero} aria-labelledby="dungeon-title">
        {page.entrance !== undefined && <EntranceMap {...page.entrance} />}
        <div className={styles.veil} />
        <div className={styles.heroBody}>
          <div className={styles.heroText}>
            {page.eyebrow !== "" && <p className={styles.eyebrow}>{page.eyebrow}</p>}
            <h1 id="dungeon-title" className={styles.title}>
              {page.title}
            </h1>
            <p className={styles.levels}>{page.levels}</p>
            {page.wings !== undefined && (
              <nav aria-label={`${page.crumbs[page.crumbs.length - 2]?.label ?? "Dungeon"} wings`}>
                <ul className={styles.wings}>
                  {page.wings.map((w) => (
                    <li key={w.href}>
                      <Link href={w.href} className={styles.wing} aria-current={w.current ? "page" : undefined}>
                        {w.label}
                        {w.planned > 0 && (
                          <span className={styles.count} aria-label={`${w.planned} planned`}>
                            {w.planned}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
          <Link href={page.planHref} className={runs.primary}>
            <PlusIcon className={styles.plus} />
            Plan a run
          </Link>
        </div>
      </section>

      <div className={styles.columns}>
        <div className={styles.main}>
          <section className={runs.box} aria-labelledby="who-fits">
            <div className={styles.fitsHead}>
              <h2 id="who-fits" className={runs.boxTitle}>
                Who fits
              </h2>
            </div>
            {page.noCharacters ? (
              <p className={runs.body}>No characters yet. Who fits shows once friends have uploaded.</p>
            ) : (
              <div className={styles.roles}>
                {page.whoFits.map((r) => (
                  <div key={r.role}>
                    <h3 className={styles.roleTitle} id={`role-${r.role}`}>
                      {r.title}
                    </h3>
                    {r.characters.length === 0 ? (
                      <p className={styles.nobody}>
                        Nobody in range.
                        {r.short !== undefined && (
                          <>
                            <br />
                            <Name c={r.short} /> {r.short.level} is {r.short.levels} level
                            {r.short.levels === 1 ? "" : "s"} short.
                          </>
                        )}
                      </p>
                    ) : (
                      <ul className={styles.role} aria-labelledby={`role-${r.role}`}>
                        {r.characters.map((c) => (
                          <li key={c.guid} className={styles.fit}>
                            <Name c={c} /> {c.level}
                            {c.over !== undefined && <span className={styles.dim}> · {c.over}</span>}
                            {c.friend !== undefined && <span className={styles.dim}> · {c.friend}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          {hasBosses && (
            <ItemsProvider items={data.items}>
              <BossesLoot loot={loot} />
            </ItemsProvider>
          )}
          <QuestsBox quests={page.quests} />
        </div>

        <div className={styles.aside} data-sticky={hasBosses || undefined}>
          {hasBosses && <BossJump bosses={loot.bosses.map((b) => ({ n: b.n, name: b.name, anchor: b.anchor }))} />}
          <section className={runs.box} aria-labelledby="planned-here">
            <h2 id="planned-here" className={runs.boxTitle}>
              Planned here
            </h2>
            {page.planned.length === 0 ? (
              <p className={runs.body}>
                Nothing planned here yet.{" "}
                <Link href={page.planHref} className={runs.inlineLink}>
                  Plan a run
                </Link>
              </p>
            ) : (
              <ul className={styles.planned}>
                {page.planned.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className={styles.plannedRun}>
                      <span className={styles.plannedWhen}>
                        <span>{r.day}</span>
                        <b>{r.time}</b>
                      </span>
                      <span className={styles.plannedText}>
                        <p>
                          {r.by}
                          {r.lead !== undefined && (
                            <>
                              {" · "}
                              <span style={color(r.lead.colorToken)}>{r.lead.name}</span>
                            </>
                          )}
                        </p>
                        <p className={runs.small}>{r.summary}</p>
                      </span>
                      <span className={runs.slots} aria-hidden="true">
                        {r.slots.map((s, i) => (
                          <i key={i} data-filled={s.filled || undefined} />
                        ))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {page.otherWings.length > 0 && (
              <div>
                <h3 className={styles.roleTitle} id="other-wings">
                  Other wings
                </h3>
                <ul className={styles.links} aria-labelledby="other-wings">
                  {page.otherWings.map((o) => (
                    <li key={o.href}>
                      <Link href={o.href}>{o.text}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className={runs.box} aria-labelledby="ran-here">
            <h2 id="ran-here" className={runs.boxTitle}>
              Ran here
            </h2>
            {page.lastCleared !== undefined ? (
              <>
                <p className={styles.cleared}>Last cleared {page.lastCleared.day}</p>
                <p className={styles.clearedBy}>
                  {page.lastCleared.group.map((c, i) => (
                    <span key={c.guid}>
                      {i > 0 && " · "}
                      <span style={color(c.colorToken)}>{c.name}</span>
                    </span>
                  ))}
                </p>
              </>
            ) : page.ran.length === 0 ? (
              <p className={runs.body}>Not yet.</p>
            ) : (
              <ul className={styles.planned}>
                {page.ran.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className={styles.plannedRun}>
                      <span className={styles.plannedText}>
                        <p>
                          {r.day} · {r.by}
                        </p>
                        <p className={runs.small}>{r.result}</p>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** A character in its class colour (board: names are text, not links; 44 px rows would not fit the board's list). */
function Name({ c }: { c: FitCharacter }) {
  return <span style={color(c.colorToken)}>{c.name}</span>;
}
