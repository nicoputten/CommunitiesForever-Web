import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { nowSeconds } from "@/app/clock";
import { getViewer } from "@/app/viewer";
import { PlusIcon } from "@/components/ui/icons";
import { EntranceMap } from "@/components/dungeon/EntranceMap";
import styles from "@/components/dungeon/Dungeon.module.css";
import runs from "@/components/runs/Runs.module.css";
import { dungeonPage, dungeonPageId, type FitCharacter } from "@/core/views/dungeon";
import { getDb } from "@/server/db";
import { runsInput } from "@/server/runsInput";

const color = (token: string | undefined) =>
  token === undefined ? undefined : ({ color: `var(${token})` } as CSSProperties);

/**
 * A dungeon's page (WEB-42, board `dungeon-page`): the hero over the map around its entrance, with Scarlet
 * Monastery's wings and Plan a run; who fits per role; the runs planned here and in the other wings; the runs that ran
 * here. The layout above answers 404 for a raid or an unknown id and sends `/dungeons/sm` to its first wing.
 */
export default async function DungeonPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  const asked = dungeonPageId((await params).id);
  if (viewer === undefined || asked === undefined) notFound();
  const page = dungeonPage(runsInput(getDb(), viewer.battleTag, nowSeconds()), asked.id);
  if (page === undefined) notFound();

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
        <section className={runs.box} aria-labelledby="who-fits">
          <div className={styles.fitsHead}>
            <h2 id="who-fits" className={runs.boxTitle}>
              Who fits
            </h2>
            <span className={runs.small}>Roles from talents, or set by the player in the addon</span>
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

        <div className={styles.aside}>
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
            {page.ran.length === 0 ? (
              <p className={runs.body}>Not yet. Runs are marked done when an upload shows a run inside.</p>
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
