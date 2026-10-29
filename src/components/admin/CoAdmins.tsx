import type { ReactNode } from "react";
import type { Rank } from "@/core/views/admin";
import { CrownIcon } from "@/components/ui/icons";
import styles from "./CoAdmins.module.css";

// Co-admins (WEB-64, boards `admin-coadmins`, `admin-as-admin`): the rank badges, the "Owner & admins" and "Owner
// only" tags, and the bar that tells an admin who the owner is.

/** "Owner" (gold, with the crown) or "Admin" (gold outline) next to a name; nothing for everyone else. */
export function RankBadge({ rank }: { rank: Rank }) {
  if (rank === "owner") {
    return (
      <span className={styles.owner}>
        <CrownIcon className={styles.crown} />
        Owner
      </span>
    );
  }
  return rank === "admin" ? <span className={styles.admin}>Admin</span> : null;
}

export function GuestBadge() {
  return <span className={styles.guest}>Guest</span>;
}

/** "● online": seen on the site in the last 10 minutes. */
export function OnlineBadge() {
  return <span className={styles.online}>● online</span>;
}

/** The tag in a box's heading: "Owner & admins", or "Owner only" with the crown. */
export function WhoTag({ owner = false }: { owner?: boolean }) {
  return owner ? (
    <span className={styles.tag}>
      <CrownIcon className={styles.crownSmall} />
      Owner only
    </span>
  ) : (
    <span className={styles.tag}>Owner &amp; admins</span>
  );
}

/** For an admin, on the admin and Discord pages: some settings are the owner's. */
export function OwnerBar({ owner }: { owner: string | undefined }) {
  return (
    <p className={styles.bar} data-testid="owner-bar">
      <span className={styles.admin}>Admin</span>
      <span>
        You&apos;re an admin. Some settings are for the owner only.
        {owner !== undefined && <> Owner: {owner}</>}
      </span>
    </p>
  );
}

/** A refused action, back on the page (WEB-64): a stale button or an old link. */
export function RefusedLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className={styles.refused}>
      {children}
    </p>
  );
}
