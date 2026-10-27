"use client";

import { useState } from "react";
import { DeviceIcon } from "@/components/ui/icons";
import { LocalTime } from "@/components/ui/LocalTime";
import type { UploaderRow } from "@/core/views/uploader";
import styles from "./Uploader.module.css";

/** "Your uploaders" (uploader-page board): device, connected, last upload, "● active", Revoke (asks inline first). */
export function UploaderList({ rows, revoke }: { rows: UploaderRow[]; revoke: (form: FormData) => Promise<void> }) {
  if (rows.length === 0) {
    return <p className={styles.empty}>No uploaders yet. Download the app and click Connect.</p>;
  }
  return (
    <ul className={styles.list}>
      {rows.map((row) => (
        <Row key={row.id} row={row} revoke={revoke} />
      ))}
    </ul>
  );
}

function Row({ row, revoke }: { row: UploaderRow; revoke: (form: FormData) => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  return (
    <li className={styles.device} data-testid="uploader">
      <DeviceIcon className={row.active ? styles.deviceIcon : styles.deviceIconIdle} />
      <span className={styles.who}>
        <span className={styles.deviceName}>{row.name}</span>
        <span className={styles.meta}>
          Connected <LocalTime at={row.connectedAt} day="date" /> ·{" "}
          {row.lastUploadAt === undefined ? (
            "no uploads yet"
          ) : (
            <>
              last upload <LocalTime at={row.lastUploadAt} day="time" />
            </>
          )}
          {row.active && <span className={styles.active}> ● active</span>}
        </span>
      </span>
      {asking ? (
        <form action={revoke} className={styles.confirm}>
          <input type="hidden" name="id" value={row.id} />
          <span className={styles.meta}>Revoke {row.name}?</span>
          <button type="submit" className={styles.revoke}>
            Revoke
          </button>
          <button type="button" className={styles.cancel} onClick={() => setAsking(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className={styles.revoke} onClick={() => setAsking(true)}>
          Revoke<span className="visually-hidden"> {row.name}</span>
        </button>
      )}
    </li>
  );
}
