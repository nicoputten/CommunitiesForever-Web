import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getSiteInfo } from "@/app/site";
import { getViewer } from "@/app/viewer";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { PageTitle } from "@/components/ui/PageTitle";
import { recapDates, recapDue } from "@/core/recap/when";
import type { RecapCard } from "@/core/recap/types";
import { getDb } from "@/server/db";
import { nextRecapAt, previewRecap, recapSchedule } from "@/server/recap";
import styles from "@/components/discord/Discord.module.css";

export const metadata: Metadata = { title: "Next recap" };

/**
 * The coming weekly recap as it stands now (WEB-41c, admin only; Nico 2026-10-27): the `bot-recap` board's example
 * embed in the site's style. Not stored: the real one is computed once at the recap moment.
 */
export default async function RecapPreviewPage() {
  if ((await getViewer())?.role !== "admin") notFound();
  const db = getDb();
  const now = nowSeconds();
  const site = getSiteInfo().name;
  const recap = previewRecap(db, now, site);
  const { timeZone } = recapSchedule(db);
  const numbers = [
    [recap.numbers.levels, "levels"],
    [recap.numbers.friendsPlayed, "friends played"],
    [recap.numbers.runs, "dungeon runs"],
    [recap.numbers.newCharacters, "new characters"],
  ] as const;

  return (
    <div className={styles.page}>
      <Atmosphere variant="calm" />
      <div className={styles.head}>
        <div className={styles.headText}>
          <PageTitle sub={`Due ${recapDue(timeZone, nextRecapAt(db, now))}. This is the recap as it stands now.`}>
            Next recap
          </PageTitle>
        </div>
        <Link href="/discord" className={styles.ghost}>
          Back to Discord
        </Link>
      </div>

      <article className={styles.recap} aria-labelledby="recap-headline">
        <header className={styles.recapHead}>
          <span className={styles.recapDates}>
            Week {recap.week} · {recapDates(timeZone, recap.start, recap.end)}
          </span>
          <h2 id="recap-headline" className={styles.recapHeadline}>
            {recap.headline.text}
          </h2>
        </header>
        <dl className={styles.recapNumbers}>
          {numbers.map(([n, label]) => (
            <div key={label} className={styles.recapNumber}>
              <dt>{label}</dt>
              <dd>{label === "levels" ? `+${n}` : n}</dd>
            </div>
          ))}
        </dl>
        {recap.award !== undefined && <Card card={recap.award} className={styles.recapAward} />}
        {recap.cards.length > 0 && (
          <div className={styles.recapCards}>
            {recap.cards.map((card) => (
              <Card key={card.id} card={card} className={styles.recapCard} />
            ))}
          </div>
        )}
        <section className={styles.recapChallenge} aria-label="This week's challenge">
          <span className={styles.recapKind}>This week&apos;s challenge</span>
          <span className={styles.recapTitle}>{recap.challenge.text}</span>
        </section>
        <p className={styles.small}>{recap.closing}</p>
      </article>
    </div>
  );
}

/** A card as text only (CLAUDE.md rule 2: names come from uploads). */
function Card({ card, className }: { card: RecapCard; className: string | undefined }) {
  return (
    <section className={className} aria-label={card.name}>
      <span className={styles.recapKind}>{card.name}</span>
      <span className={styles.recapTitle}>{card.title}</span>
      <span className={styles.recapText}>{card.text}</span>
    </section>
  );
}
