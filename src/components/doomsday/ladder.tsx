import Link from "next/link";
import type { CSSProperties } from "react";
import type { FeatIcon, FeatsView } from "@/core/views/doomsdayFeats";
import type { LadderTrackView, PvpView } from "@/core/views/doomsdayLadder";
import { ClassDisc } from "@/components/ui/ClassDisc";
import chip from "@/components/ui/FilterChip.module.css";
import { EmblemIcon, FishIcon, MountIcon, PotIcon, RankInsignia, SkullIcon, SwordIcon } from "@/components/ui/icons";
import base from "./Doomsday.module.css";
import styles from "./Ladder.module.css";

/** Friends the duel grid fits in its card; more scroll in their own box (WEB-65, bug 7). */
const DUEL_FIT = 8;

// The Doomsday page's Ladder, PvP and Feats pieces (WEB-60, boards doomsday-ladder and doomsday-feats). Server
// components: rows open with <details>, friends are picked with links.

/** One track's ladder: rows that open to the split per character; PvP Virgins under it, never ranked. */
export function LadderCard({
  view,
  note,
  phoneHidden = false,
}: {
  view: LadderTrackView;
  note?: string;
  /** On the phone only one track shows (WEB-61). */
  phoneHidden?: boolean;
}) {
  const id = `ladder-${view.track}`;
  return (
    <section className={phoneHidden ? `${base.card} ${styles.phoneHidden}` : base.card} aria-labelledby={id}>
      <div className={base.cardHead}>
        <h2 id={id} className={base.cardTitle}>
          <span className={view.track === "pve" ? base.pve : base.pvp}>{view.track === "pve" ? "PvE" : "PvP"}</span> ·{" "}
          {view.when}
        </h2>
        <span className={base.spacer} />
        {note !== undefined && <span className={base.meta}>{note}</span>}
      </div>
      {view.rows.length === 0 && view.virgins.length === 0 && <p className={base.note}>Nobody has points here yet.</p>}
      <div className={styles.ladder}>
        {view.rows.map((r) => (
          <details key={r.key} className={styles.row} data-you={r.you} open={r.you}>
            <summary className={styles.head}>
              <span className={styles.place}>{r.place}</span>
              <span className={base.avatar} aria-hidden="true">
                {r.initials}
              </span>
              <span>
                {r.name} {r.you && <span className={base.meta}>(you)</span>}{" "}
                <span className={styles.caret} aria-hidden="true">
                  ▸
                </span>
              </span>
              <span className={`${styles.points} ${view.track === "pve" ? base.pve : base.pvp}`}>{r.points}</span>
              <span className={styles.move} data-kind={r.movement?.kind}>
                {r.movement !== undefined && (
                  <>
                    <span aria-hidden="true">{r.movement.text}</span>
                    <span className="visually-hidden">{r.movement.label}</span>
                  </>
                )}
              </span>
            </summary>
            {r.characters.map((c) => (
              <div key={c.guid} className={styles.char}>
                <span />
                <span className={styles.charName}>
                  <ClassDisc
                    name={c.name}
                    {...(c.classFile === undefined ? {} : { classFile: c.classFile })}
                    size="xs"
                  />
                  {c.name}
                </span>
                <span className={styles.num}>{c.points}</span>
                <span />
              </div>
            ))}
            {r.href !== undefined && (
              <div className={styles.char}>
                <span />
                <Link href={r.href} className={styles.detailsLink}>
                  PvP details
                </Link>
              </div>
            )}
          </details>
        ))}
        {view.virgins.map((v) => (
          <div key={v.key} className={styles.virgin}>
            <span className={base.avatar} aria-hidden="true">
              {v.initials}
            </span>
            {v.name} <span className={`${base.pill} ${base.pillVirgin}`}>PvP Virgin</span>
            <span>not ranked: no kills on any character, ever</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Friend chips (links), the current one pressed. */
export function FriendChips({ label, friends }: { label: string; friends: PvpView["friends"] }) {
  return (
    <nav aria-label={label} className={styles.chips}>
      {friends.map((f) => (
        <Link key={f.key} href={f.href} className={chip.chip} aria-current={f.current ? "page" : undefined}>
          {f.name}
        </Link>
      ))}
    </nav>
  );
}

export function PvpDetails({ view }: { view: PvpView }) {
  if (view.empty !== undefined) return <p className={base.note}>{view.empty}</p>;
  return (
    <div className={styles.three}>
      <section className={base.card} aria-label="Kills and ranks">
        <span className={base.meta}>Kills this week</span>
        {view.kills !== undefined && (
          <div className={styles.kills}>
            {view.kills.approx ? "≈" : ""}
            {view.kills.total} <span className={styles.killsDetail}>· {view.kills.detail}</span>
          </div>
        )}
        {view.pvpVirgin && (
          <p className={base.note}>
            <span className={`${base.pill} ${base.pillVirgin}`}>PvP Virgin</span> not ranked: no kills on any character,
            ever
          </p>
        )}
        {view.ranks.map((r) => (
          <div key={r.guid} className={styles.rank}>
            {r.rank > 0 ? (
              <RankInsignia rank={r.rank} className={styles.insignia} />
            ) : (
              <span className={styles.insignia} />
            )}
            <div>
              <div className={styles.rankName}>{r.rankText}</div>
              <div className={base.meta}>
                {r.title !== "" && (
                  <>
                    {r.rank > 0 ? "a.k.a. " : ""}
                    <span className={styles.aka}>{r.title}</span> ·{" "}
                  </>
                )}
                {r.name}
              </div>
            </div>
          </div>
        ))}
        {view.byZone.length > 0 && (
          <>
            <span className={base.meta}>Kills by zone</span>
            {view.byZone.map((z) => (
              <div key={z.zone} className={styles.zone}>
                <span>{z.zone}</span>
                <span className={styles.track} aria-hidden="true">
                  <span style={{ width: `${z.percent}%` } as CSSProperties} />
                </span>
                <span className={styles.num}>{z.kills}</span>
              </div>
            ))}
          </>
        )}
      </section>

      <section className={base.card} aria-labelledby="pvp-duels">
        <div className={base.cardHead}>
          <span id="pvp-duels" className={base.meta}>
            Duels
          </span>
          <span className={base.spacer} />
          {view.duels !== undefined && (
            <span className={base.points}>
              <span className={base.pve}>{view.duels.won} won</span> <span className={base.sep}>·</span>{" "}
              <span className={base.pvp}>{view.duels.lost} lost</span>
            </span>
          )}
        </div>
        {view.duels !== undefined && view.duels.grid.names.length > 1 && (
          <div
            className={styles.tableWrap}
            tabIndex={view.duels.grid.names.length > DUEL_FIT ? 0 : undefined}
            role="region"
            aria-label="Duels between friends"
            data-many={view.duels.grid.names.length > DUEL_FIT || undefined}
            style={{ "--cols": view.duels.grid.names.length } as CSSProperties}
          >
            <table className={styles.duels}>
              <thead>
                <tr>
                  <th scope="col">row vs column</th>
                  {view.duels.grid.names.map((n) => (
                    <th key={n.key} scope="col">
                      {n.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.duels.grid.names.map((row, i) => (
                  <tr key={row.key}>
                    <th scope="row">{row.name}</th>
                    {view.duels!.grid.cells[i]!.map((c, j) =>
                      c !== undefined ? (
                        <td key={j} data-result={c.result}>
                          {c.text}
                        </td>
                      ) : (
                        <td key={j} data-empty={i === j ? "self" : "none"}>
                          <span aria-hidden="true">{i === j ? "—" : "·"}</span>
                          {i !== j && <span className="visually-hidden">no duels</span>}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {view.duels?.grid.readAcross !== undefined && view.duels.grid.names.length > 1 && (
          <p className={styles.readAcross}>{view.duels.grid.readAcross}</p>
        )}
        {view.duels?.elo !== undefined && (
          <div className={styles.elo}>
            <span className={base.meta}>Duel rating (Elo)</span>
            <span className={styles.eloRating}>{view.duels.elo.rating}</span>
            {view.duels.elo.change !== undefined && (
              <span className={styles.move} data-kind={view.duels.elo.change.kind}>
                {view.duels.elo.change.text}
              </span>
            )}
            <span className={base.spacer} />
            <span className={base.meta}>{view.duels.elo.place}</span>
          </div>
        )}
      </section>

      <section className={`${base.card} ${styles.dashed}`} aria-label="Battlegrounds">
        <span className={base.meta}>Battlegrounds</span>
        {view.battlegrounds.length === 0 && <p className={base.note}>No battlegrounds yet.</p>}
        {view.battlegrounds.map((b) => (
          <div key={b.name} className={styles.bg}>
            <span className={styles.bgName}>{b.name}</span>
            <span className={base.pve}>{b.won} W</span>
            <span className={base.pvp}>{b.lost} L</span>
            <span>{b.kills} kills</span>
          </div>
        ))}
        {view.firstWins !== undefined && <p className={base.note}>{view.firstWins}</p>}
      </section>
    </div>
  );
}

const GLYPHS: Record<Exclude<FeatIcon, "rank">, typeof SwordIcon> = {
  epic: SwordIcon,
  sword: SwordIcon,
  mount: MountIcon,
  fish: FishIcon,
  skull: SkullIcon,
  cook: PotIcon,
  star: EmblemIcon,
};

export function GroupFeats({ feats }: { feats: FeatsView["group"] }) {
  if (feats.length === 0) return <p className={base.note}>No feats yet. They appear as characters reach them.</p>;
  return (
    <>
      {feats.map((f) => {
        const Glyph = f.icon === "rank" ? undefined : GLYPHS[f.icon];
        return (
          <div key={f.key} className={styles.feat} data-testid="feat">
            <span className={styles.featIcon}>
              {Glyph === undefined ? (
                <RankInsignia rank={f.rank ?? 0} className={styles.insignia} />
              ) : (
                <Glyph className={styles.glyph} />
              )}
            </span>
            <div>
              <div className={styles.featTitle}>
                {f.title.before}
                {f.title.epic !== undefined && <span className={styles.epic}>{f.title.epic}</span>}
                {f.title.after}
              </div>
              <div className={styles.featMeta}>
                <ClassDisc
                  name={f.character.name}
                  {...(f.character.classFile === undefined ? {} : { classFile: f.character.classFile })}
                  size="xs"
                />
                <span>
                  {f.character.name} · {f.meta}
                </span>
              </div>
            </div>
            {f.firstInGroup ? <span className={`${base.pill} ${base.pillFirst}`}>First in the group</span> : <span />}
          </div>
        );
      })}
    </>
  );
}

export function OwnFeats({ view }: { view: FeatsView }) {
  return (
    <>
      <div className={styles.own}>
        {view.own.map((f) => (
          <div key={f.key} className={styles.ownFeat} data-done={f.done}>
            <span className={styles.ownTitle}>{f.title}</span>
            <span className={base.meta}>{f.meta}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function RankTitles({ ranks }: { ranks: FeatsView["ranks"] }) {
  return (
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="PvP ranks and our titles">
      <table className={styles.ranks}>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Horde</th>
            <th scope="col">Alliance</th>
            <th scope="col">Our title</th>
          </tr>
        </thead>
        <tbody>
          {ranks.map((r) => (
            <tr key={r.rank}>
              <td>{r.rank}</td>
              <td>{r.horde}</td>
              <td>{r.alliance}</td>
              <td>{r.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
