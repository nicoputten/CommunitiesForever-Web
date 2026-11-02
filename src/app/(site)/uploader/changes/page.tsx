import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/app/viewer";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/ui/PageTitle";
import { type NoteItem, noteBlocks } from "@/core/releases";
import { readReleaseNotes } from "@/server/releases";
import styles from "@/components/uploader/Uploader.module.css";

export const metadata: Metadata = { title: "What's new" };

/**
 * The uploader's "What's new" (WEB-73, no board: built from the uploader page's boxes, DESIGN.md §11): a section per
 * version the update feed keeps, newest first, with its release notes as plain text. Each section's id is its version,
 * the anchor `GET updates/status` sends as `notesUrl`. Like the uploader page: admin, members and guests with "may
 * upload" (404 for others).
 */
export default async function UploaderChangesPage() {
  const viewer = await getViewer();
  if (!viewer?.mayUpload) notFound();
  const versions = await readReleaseNotes();

  return (
    <div className={styles.page}>
      <Atmosphere variant="calm" />
      <div className={styles.head}>
        <Link href="/uploader" className={styles.back}>
          ← Uploader
        </Link>
        <PageTitle sub="The automatic uploader, version by version.">What&apos;s new</PageTitle>
      </div>

      {versions.length === 0 ? (
        <EmptyState title="Nothing released yet">The first version shows up here when it&apos;s out.</EmptyState>
      ) : (
        versions.map((v, i) => (
          <section
            key={v.version}
            id={v.version}
            aria-labelledby={`notes-${v.version}`}
            className={`${styles.box} ${styles.release}`}
          >
            <div className={styles.boxHead}>
              <h2 id={`notes-${v.version}`} className={styles.boxTitle}>
                {v.version}
              </h2>
              {i === 0 && <span className={styles.small}>Newest</span>}
            </div>
            {v.lines.length === 0 ? (
              <p className={styles.small}>No notes for this version.</p>
            ) : (
              noteBlocks(v.lines).map((block, j) =>
                block.kind === "paragraph" ? (
                  <p key={j} className={styles.body}>
                    {block.text}
                  </p>
                ) : (
                  <Notes key={j} items={block.items} />
                ),
              )
            )}
          </section>
        ))
      )}
    </div>
  );
}

function Notes({ items }: { items: NoteItem[] }) {
  return (
    <ul className={styles.notes}>
      {items.map((item, i) => (
        <li key={i}>
          {item.text}
          {item.items.length > 0 && <Notes items={item.items} />}
        </li>
      ))}
    </ul>
  );
}
