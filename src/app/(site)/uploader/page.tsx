import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowSeconds } from "@/app/clock";
import { getSiteInfo } from "@/app/site";
import { getViewer } from "@/app/viewer";
import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { PageTitle } from "@/components/ui/PageTitle";
import { PairingRequest } from "@/components/uploader/PairingRequest";
import { TokenByHand } from "@/components/uploader/TokenByHand";
import { UploaderList } from "@/components/uploader/UploaderList";
import { DownloadIcon } from "@/components/ui/icons";
import { OwnHistory } from "@/components/uploader/OwnHistory";
import {
  NOTICES,
  noticeOk,
  type Notice,
  OWN_MAX,
  OWN_PAGE,
  ownRow,
  parseNotice,
  parseOlder,
  uploaderRows,
} from "@/core/views/uploader";
import { aboutSize } from "@/core/releases";
import { getDb } from "@/server/db";
import { readCurrent } from "@/server/releases";
import { activeTokens, findPairing, limits, type PendingPairing } from "@/server/uploader";
import { listOwnUploads } from "@/server/uploads";
import { createTokenAction, decideAction, revokeAction } from "./actions";
import styles from "@/components/uploader/Uploader.module.css";

export const metadata: Metadata = { title: "Uploader" };

/**
 * The uploader page (board `uploader-page`, WEB-34): get the Windows app, approve a connection (`?code=`, from the
 * app), the viewer's uploaders and a token by hand. Admin, members and guests with "may upload" (404 for others).
 */
export default async function UploaderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer();
  if (!viewer?.mayUpload) notFound();
  const params = await searchParams;
  const now = nowSeconds();
  const db = getDb();

  let notice: Notice | undefined = parseNotice(params.notice);
  let pairing: PendingPairing | undefined;
  const code = typeof params.code === "string" ? params.code : undefined;
  if (code !== undefined && notice !== "too-many") {
    const key = viewer.battleTag.toLowerCase();
    if (limits.wrongCode.full(key, now)) notice = "too-many-tries";
    else {
      pairing = findPairing(db, code, now);
      if (pairing === undefined) {
        // Guessing codes by opening links counts like a wrong Allow.
        limits.wrongCode.hit(key, now);
        notice ??= "bad-code";
      }
    }
  } else if (code !== undefined) {
    pairing = findPairing(db, code, now);
  }
  const site = getSiteInfo().name;
  const release = await readCurrent();
  const rows = uploaderRows(activeTokens(db, viewer.battleTag), now);
  const older = parseOlder(params.older);
  const own = listOwnUploads(db, viewer.battleTag, older);
  let olderHref: string | undefined;
  if (own.more && older < OWN_MAX) {
    const next = new URLSearchParams({ older: String(older + OWN_PAGE) });
    if (typeof params.show === "string") next.set("show", params.show);
    olderHref = `/uploader?${next.toString()}`;
  }

  return (
    <div className={styles.page}>
      <Atmosphere variant="calm" />
      <div className={styles.head}>
        <PageTitle sub="A small Windows app that uploads your addon data after every session, so nobody has to remember.">
          Automatic uploader
        </PageTitle>
        {/* Not on the board (decided with Nico, DESIGN.md §11): the manual upload page stays reachable. */}
        <p className={styles.manual}>
          Rather upload a file yourself? <Link href="/upload">Upload manually</Link>
        </p>
      </div>

      {notice !== undefined && (
        <p role="status" className={noticeOk(notice) ? styles.noticeOk : styles.notice}>
          {NOTICES[notice]}
        </p>
      )}
      {pairing !== undefined && <PairingRequest pairing={pairing} site={site} action={decideAction} />}

      <div className={styles.columns}>
        <section aria-labelledby="uploader-get" className={styles.box}>
          <h2 id="uploader-get" className={styles.boxTitle}>
            Get the app
          </h2>
          {/* Before the first release (WEB-35) the button shows, disabled (decided with Nico). */}
          {release === undefined ? (
            <button type="button" className={styles.primary} disabled aria-describedby="uploader-version">
              <DownloadIcon className={styles.buttonIcon} />
              Download for Windows
            </button>
          ) : (
            <a href="/uploader/download" className={styles.primary} aria-describedby="uploader-version" download>
              <DownloadIcon className={styles.buttonIcon} />
              Download for Windows
            </a>
          )}
          <p id="uploader-version" className={styles.small}>
            {release === undefined
              ? "Not released yet · Windows 10 and 11"
              : `${release.version} · Windows 10 and 11 · ${aboutSize(release.size)}`}
          </p>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                1
              </span>
              <span>Install and open it. It finds World of Warcraft by itself.</span>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                2
              </span>
              <span>
                Click <span className={styles.em}>Connect</span>; this page asks you to allow it.
              </span>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                3
              </span>
              <span>Play as usual. After you log out, your data shows up here within seconds.</span>
            </li>
          </ol>
        </section>

        <section aria-labelledby="uploader-yours" className={styles.box}>
          <div className={styles.boxHead}>
            <h2 id="uploader-yours" className={styles.boxTitle}>
              Your uploaders
            </h2>
            <span className={styles.small}>Upload-only tokens</span>
          </div>
          <UploaderList rows={rows} revoke={revokeAction} />
          <TokenByHand action={createTokenAction} />
        </section>
      </div>

      <OwnHistory rows={own.uploads.map(ownRow)} devices={own.devices} olderHref={olderHref} />

      <p className={styles.note}>
        Revoking stops that uploader at its next attempt; the app then shows “Reconnect”. Uploads from an uploader count
        exactly like a manual upload: same session report, same history.
      </p>
    </div>
  );
}
