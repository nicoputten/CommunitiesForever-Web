import Link from "next/link";
import { type CSSProperties, Fragment, type ReactNode } from "react";
import { ClassDisc } from "@/components/ui/ClassDisc";
import { EmblemIcon } from "@/components/ui/icons";
import { LocalTime } from "@/components/ui/LocalTime";
import { classInfo } from "@/core/gamedata/classes";
import type { ReportCharacter, SessionReport as Report } from "@/core/views/report";
import { MoreList, ReplayButton } from "./ReportControls";
import styles from "./SessionReport.module.css";

// The session report (board `upload-report`, WEB-20): what an upload changed. Motion as DESIGN.md §6: a staggered
// rise, bars that grow and the LEVEL UP shine, all in CSS; the delays are the board's, in steps of --dur-step.
// The hero's loops are this screen's accent (Nico, WEB-20): ambient, so they pause with the tab and stop without
// motion, and then everything rests on its last frame.

/** The board's delay of an element, in 50 ms steps. */
const at = (steps: number) => ({ "--d": steps }) as CSSProperties;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function Name({ c, className }: { c: ReportCharacter; className?: string }) {
  const info = classInfo(c.classFile);
  return (
    <span
      className={className ?? styles.who}
      style={info === undefined ? undefined : ({ color: `var(${info.textToken})` } as CSSProperties)}
    >
      {c.name}
    </span>
  );
}

/** "Lia Thornwhisper and Ves Doombringer", "A, B and C", each name in its class colour. */
function Names({ list }: { list: ReportCharacter[] }) {
  return list.map((c, i) => (
    <Fragment key={c.guid}>
      {i === 0 ? "" : i === list.length - 1 ? " and " : ", "}
      <Name c={c} />
    </Fragment>
  ));
}

function Bar({ from, to, gain, steps }: { from: number; to: number; gain: "plain" | "bright"; steps: number }) {
  // The new part covers the bar up to `to` and grows from `from` (transform only).
  const style = { ...at(steps), "--from": from, "--to": to, "--start": to > 0 ? from / to : 0 } as CSSProperties;
  return (
    <span className={styles.track} aria-hidden="true">
      <span className={styles.old} style={style} />
      <span className={styles.new} data-gain={gain} style={style} />
    </span>
  );
}

function Badge({ children, index }: { children: ReactNode; index: number }) {
  // Each badge shines a second later than the one above it, as on the board.
  return (
    <span className={styles.badge} style={{ "--shine-at": index } as CSSProperties}>
      {children}
    </span>
  );
}

function Section({
  title,
  steps,
  order,
  children,
}: {
  title: string;
  steps: number;
  /** Place in the single phone column. */
  order: number;
  children: ReactNode;
}) {
  const id = `report-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className={`${styles.box} ${styles.rise}`} style={{ ...at(steps), order }} aria-labelledby={id}>
      <h2 id={id} className={styles.boxTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export interface SessionReportProps {
  report: Report;
  /** "Upload another" shows only to someone who may upload. */
  mayUpload: boolean;
  /** Where "See them drop in on the map" leads: the map with this upload's sightings dropping in (WEB-26). */
  mapHref?: string;
}

export function SessionReport({ report: r, mayUpload, mapHref = "/" }: SessionReportProps) {
  const sub = r.first ? (
    <>
      First upload by {r.uploader} · {plural(r.characters, "character")} from {plural(r.friends, "friend")}
    </>
  ) : (
    <>
      Uploaded <LocalTime at={r.uploadedAt} phrase /> by {r.uploader}
      {r.friendsWithNewData > 0 && <> · new data from {plural(r.friendsWithNewData, "friend")}</>}
      {r.runAnswers > 0 && <> · {plural(r.runAnswers, "run answer")}</>}
    </>
  );

  const levelUps = r.levelUps.length > 0 && (
    <Section title="Level ups" steps={16} order={1}>
      <MoreList className={styles.rows}>
        {r.levelUps.map((l, i) => (
          <div key={l.guid} className={styles.row}>
            <ClassDisc name={l.ownName} classFile={l.classFile} size="report" />
            <div className={styles.cell}>
              <div className={styles.line}>
                <Name c={l} className={styles.name} />
                <Badge index={i}>{l.badge}</Badge>
              </div>
              <Bar from={l.fromShare} to={l.toShare} gain="bright" steps={20 + 3 * i} />
            </div>
            <span className={styles.big}>
              <span className={styles.was}>{l.from} →</span> {l.to}
            </span>
          </div>
        ))}
      </MoreList>
    </Section>
  );

  const faces = (r.newFaces.length > 0 || r.removed.length > 0) && (
    <Section
      title={r.newFaces.length === 0 ? "Left the roster" : r.newFaces.length === 1 ? "New face" : "New faces"}
      steps={20}
      order={3}
    >
      {r.newFaces.length > 0 && (
        <MoreList className={styles.rows}>
          {r.newFaces.map((f) => (
            <div key={f.guid} className={`${styles.row} ${styles.face}`}>
              <ClassDisc name={f.ownName} classFile={f.classFile} size="report" />
              <div className={styles.cell}>
                <Name c={f} className={styles.name} />
                <div className={styles.meta}>{f.line}</div>
              </div>
              {f.ownName !== undefined ? (
                <Link href={`/character/${encodeURIComponent(f.guid)}`} className={styles.link}>
                  Roster →<span className="visually-hidden">: {f.name}</span>
                </Link>
              ) : (
                <span />
              )}
            </div>
          ))}
        </MoreList>
      )}
      {r.removed.length > 0 && (
        <p className={styles.meta}>
          {r.newFaces.length > 0 && "No longer on the roster: "}
          {r.removed.join(", ")}
        </p>
      )}
    </Section>
  );

  const senders = r.senders.length > 0 && (
    <Section title="Who sent data" steps={23} order={5}>
      <ul className={styles.chips}>
        {r.senders.map((s) => (
          <li key={s.key} className={styles.chip} data-quiet={s.quiet || undefined}>
            {s.age !== undefined && <span className={styles.dot} data-age={s.age} aria-hidden="true" />}
            {s.text}
          </li>
        ))}
      </ul>
    </Section>
  );

  const skills = r.skillGains.length > 0 && (
    <Section title="Skill gains" steps={18} order={2}>
      <MoreList className={styles.rows}>
        {r.skillGains.map((g, i) => (
          <div key={`${g.guid}-${g.profession}`} className={styles.row}>
            <ClassDisc name={g.ownName} classFile={g.classFile} size="report" />
            <div className={styles.cell}>
              <div className={styles.line}>
                <span className={styles.skill}>
                  {g.profession} <span className={styles.dim}>· {g.name}</span>
                </span>
                {g.capReached && <Badge index={i}>CAP REACHED</Badge>}
              </div>
              <Bar from={g.fromShare} to={g.toShare} gain={g.capReached ? "bright" : "plain"} steps={22 + 3 * i} />
            </div>
            <span className={styles.big}>
              <span className={styles.was}>{g.from} →</span> {g.to}
            </span>
          </div>
        ))}
      </MoreList>
    </Section>
  );

  const gear = r.gear.length > 0 && (
    <Section title="Gear" steps={21} order={4}>
      <MoreList className={styles.gear}>
        {r.gear.map((g) => (
          <span key={g.guid}>
            <Name c={g} /> item level{" "}
            <b className={styles.strong}>
              {g.from} → {g.to}
            </b>
          </span>
        ))}
      </MoreList>
    </Section>
  );

  const sightings = r.sightings.length > 0 && (
    <Section title="New sightings" steps={24} order={6}>
      <MoreList className={styles.sightings}>
        {r.sightings.map((s) => (
          <span key={s.place}>
            <Names list={s.characters} /> · {s.place}
          </span>
        ))}
      </MoreList>
      <Link href={mapHref} className={styles.link}>
        See them drop in on the map →
      </Link>
    </Section>
  );

  return (
    <div className={styles.report} data-report="" data-ambient="">
      <section className={styles.hero} aria-labelledby="report-title">
        <span className={styles.rays} aria-hidden="true" />
        <span className={styles.halo} aria-hidden="true" />
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`${styles.ember} ${styles[`ember${n}`]}`} aria-hidden="true" />
        ))}
        <EmblemIcon className={`${styles.emblem} ${styles.pop}`} style={at(1)} strokeWidth={1.2} />
        <h1 id="report-title" className={`${styles.title} ${styles.rise}`} style={at(3)}>
          Session report
        </h1>
        <p className={`${styles.sub} ${styles.rise}`} style={at(5)}>
          {sub}
        </p>
      </section>

      <ul className={styles.counters} aria-label="Counts">
        {r.counters.map((c, i) => (
          <li
            key={c.label}
            className={`${styles.box} ${styles.counter} ${styles.pop}`}
            data-zero={c.value === 0 || undefined}
            style={at(7 + 2 * i)}
          >
            <span className={styles.count}>{c.value}</span> <span className={styles.countLabel}>{c.label}</span>
          </li>
        ))}
      </ul>

      <div className={styles.columns}>
        <div className={styles.column}>
          {levelUps}
          {faces}
          {senders}
        </div>
        <div className={styles.column}>
          {skills}
          {gear}
          {sightings}
        </div>
      </div>

      <div className={`${styles.actions} ${styles.rise}`} style={at(28)}>
        <Link href="/" className={`${styles.button} ${styles.primary}`}>
          Open the map
        </Link>
        <ReplayButton />
        {mayUpload && (
          <Link href="/upload" className={`${styles.button} ${styles.quiet}`}>
            Upload another
          </Link>
        )}
      </div>
    </div>
  );
}
