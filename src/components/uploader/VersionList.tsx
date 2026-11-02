import { LocalTime } from "@/components/ui/LocalTime";
import { noteBlocks, type NoteItem, type VersionNotes } from "@/core/releases";
import styles from "./Changes.module.css";

function Items({ items }: { items: readonly NoteItem[] }) {
  return (
    <ul className={styles.items}>
      {items.map((item, i) => (
        <li key={i}>
          {item.text}
          {item.items.length > 0 && <Items items={item.items} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * The kept versions, newest first, one box each (board `uploader-changes`, WEB-73). A box's id is the plain version,
 * so the app's `notesUrl` (`/uploader/changes#0.3.1`) lands on it; the linked box glows and the glow fades (CSS
 * `:target`). Only the newest release has a date (`releasedAt`).
 */
export function VersionList({ versions, releasedAt }: { versions: readonly VersionNotes[]; releasedAt?: number }) {
  return versions.map((v, i) => {
    const blocks = noteBlocks(v.lines);
    return (
      <section key={v.version} id={v.version} aria-labelledby={`v-${v.version}`} className={styles.version}>
        <div className={styles.versionHead}>
          <h2 id={`v-${v.version}`} className={styles.versionTitle}>
            v{v.version}
          </h2>
          {i === 0 && releasedAt !== undefined && (
            <span className={styles.date}>
              <LocalTime at={releasedAt} day="calendar" />
            </span>
          )}
          {i === 0 && <span className={styles.latest}>Latest</span>}
          <a
            href={`#${v.version}`}
            className={styles.anchor}
            aria-label={`Link to v${v.version}`}
            title="Link to this version"
          >
            #
          </a>
        </div>
        {blocks.length === 0 ? (
          <p className={styles.none}>No notes for this version</p>
        ) : (
          blocks.map((b, j) =>
            b.kind === "paragraph" ? (
              <p key={j} className={styles.paragraph}>
                {b.text}
              </p>
            ) : (
              <Items key={j} items={b.items} />
            ),
          )
        )}
      </section>
    );
  });
}
