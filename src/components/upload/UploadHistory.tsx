import Link from "next/link";
import { LocalTime } from "@/components/ui/LocalTime";
import type { HistoryLine } from "@/core/views/upload";
import styles from "./UploadHistory.module.css";

/** The upload history (upload board): everyone's uploads, newest first; each line opens its report. */
export function UploadHistory({ lines }: { lines: HistoryLine[] }) {
  return (
    <aside aria-labelledby="upload-history" className={styles.panel}>
      <h2 id="upload-history" className={styles.title}>
        History
      </h2>
      {lines.length === 0 ? (
        <p className={styles.empty}>No uploads yet.</p>
      ) : (
        <ul className={styles.list}>
          {lines.map((line) => (
            <li key={line.id}>
              <Link href={`/upload/${line.id}`} className={styles.row} data-testid="history-line">
                <span className={styles.when}>
                  <span className={styles.time}>
                    <LocalTime at={line.uploadedAt} capital />
                  </span>
                  <span className={styles.uploader}>{line.uploader}</span>
                </span>
                <span className={styles.text}>
                  {line.text}
                  {/* Sent by the uploader app (WEB-34; not on the upload board: DESIGN.md §11). */}
                  {line.via !== undefined && <span className={styles.via}>{line.via}</span>}
                </span>
                <span className={line.status === "done" ? styles.done : styles.rejected}>
                  {line.status === "done" ? "Done" : "Rejected"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {/* The board says "Only you can upload": members upload too now (deviation, DESIGN.md §11). */}
      <p className={styles.note}>
        Everyone in the community can upload their own file. Friends see the result on the map and roster.
      </p>
    </aside>
  );
}
