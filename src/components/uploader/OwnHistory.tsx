"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSyncExternalStore, useTransition } from "react";
import { DeviceIcon, UploadIcon } from "@/components/ui/icons";
import { FilterChip } from "@/components/ui/FilterChip";
import { clockParts, DAY_GROUPS, type DayGroup, dayGroup } from "@/core/views/clock";
import {
  matchesOwnFilter,
  OWN_STATUS,
  type OwnFilter,
  ownFilterParam,
  type OwnRow,
  parseOwnFilter,
} from "@/core/views/uploader";
import styles from "./Uploader.module.css";

const subscribe = () => () => {};

/**
 * "Upload history" (uploader-page board): the viewer's own uploads, from the app and manual, by day (Today, This week,
 * Earlier in the viewer's time zone), filtered by device, manual or problems (`?show=`, so Back undoes it). Every row
 * opens its report.
 */
export function OwnHistory({ rows, devices, olderHref }: { rows: OwnRow[]; devices: string[]; olderHref?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  // The server doesn't know the viewer's zone: times and day headings fill in when the page hydrates.
  const now = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000),
    () => undefined,
  );
  const filter = parseOwnFilter(params.get("show"));
  const shown = rows.filter((r) => matchesOwnFilter(r, filter));

  const choose = (next: OwnFilter) => {
    const url = new URLSearchParams(params.toString());
    url.delete("code");
    url.delete("notice");
    const value = ownFilterParam(next);
    if (value === undefined) url.delete("show");
    else url.set("show", value);
    const search = url.toString();
    startTransition(() => router.push(`/uploader${search === "" ? "" : `?${search}`}`, { scroll: false }));
  };
  const chip = (label: string, next: OwnFilter) => (
    <FilterChip key={label} pressed={ownFilterParam(next) === ownFilterParam(filter)} onClick={() => choose(next)}>
      {label}
    </FilterChip>
  );

  const groups: [DayGroup | undefined, OwnRow[]][] = [];
  for (const row of shown) {
    const group = now === undefined ? undefined : dayGroup(row.uploadedAt, now);
    const last = groups.at(-1);
    if (last !== undefined && last[0] === group) last[1].push(row);
    else groups.push([group, [row]]);
  }

  return (
    <section aria-labelledby="uploader-history" className={`${styles.box} ${styles.ownHistory}`}>
      <div className={styles.historyHead}>
        <h2 id="uploader-history" className={styles.boxTitle}>
          Upload history
        </h2>
        <span className={styles.small}>Click an upload to see its session report</span>
        <div role="group" aria-label="Filter uploads" className={styles.chips}>
          {chip("All", { kind: "all" })}
          {devices.map((name) => chip(name, { kind: "device", name }))}
          {chip("Manual", { kind: "manual" })}
          {chip("Problems", { kind: "problems" })}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>{rows.length === 0 ? "You haven't uploaded anything yet." : "No uploads match."}</p>
      ) : (
        groups.map(([group, list], i) => (
          <div key={`${group ?? "all"}-${i}`} className={styles.dayGroup}>
            {group !== undefined && <h3 className={styles.dayHead}>{DAY_GROUPS[group]}</h3>}
            <ul className={styles.list}>
              {list.map((row) => (
                <li key={row.id}>
                  <Row row={row} now={now} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      {olderHref !== undefined && (
        <Link href={olderHref} scroll={false} className={styles.older}>
          Show older uploads
        </Link>
      )}
    </section>
  );
}

function Row({ row, now }: { row: OwnRow; now: number | undefined }) {
  const when = now === undefined ? undefined : clockParts(row.uploadedAt, now);
  return (
    <Link href={`/upload/${row.id}`} className={styles.hrow} data-testid="own-upload">
      <span className={styles.hwhen}>
        <time dateTime={new Date(row.uploadedAt * 1000).toISOString()}>{when?.time ?? ""}</time>
        <span className={styles.hdate}>{when?.date ?? ""}</span>
      </span>
      <span className={styles.hdevice}>
        {row.device !== undefined ? (
          <DeviceIcon className={styles.hicon} />
        ) : (
          <UploadIcon className={styles.hiconManual} />
        )}
        {row.device ?? "Manual upload"}
      </span>
      <span className={styles.pills}>
        {row.pills.map((p, i) => (
          <span key={p} className={i === 0 && row.status === "done" ? styles.pillGold : styles.pill}>
            {p}
          </span>
        ))}
      </span>
      <span
        className={styles[row.status === "done" ? "statusOk" : row.status === "rejected" ? "statusWarn" : "statusMute"]}
      >
        {OWN_STATUS[row.status]}
      </span>
      <span aria-hidden="true" className={styles.chevron}>
        ›
      </span>
    </Link>
  );
}
