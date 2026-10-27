import { CompassIcon } from "@/components/ui/icons";
import { FirstUploadState } from "@/components/ui/FirstUploadState";
import { battleTagName } from "@/core/access";
import styles from "./EmptyMap.module.css";

export interface EmptyMapProps {
  canUpload: boolean;
  adminName: string;
  /** Who may sign in, admin first: the roll call's guest list before any character is known. */
  guestList: readonly string[];
}

/**
 * The map before the first upload (empty-site board, WEB-29): a veil over the bare map, the centre card and, where
 * the roll call goes, the guest list. On a phone the list follows under the card.
 */
export function EmptyMap({ canUpload, adminName, guestList }: EmptyMapProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.centre}>
        <FirstUploadState
          title="The map is still empty"
          elsewhere="on the roster and in professions"
          canUpload={canUpload}
          adminName={adminName}
          icon={<CompassIcon />}
        />
      </div>
      <aside className={styles.rollCall} aria-labelledby="roll-call-title">
        <div className={styles.head}>
          <h2 id="roll-call-title" className={styles.title}>
            Roll call
          </h2>
          <span className={styles.meta}>0 located</span>
        </div>
        <p className={styles.lead}>On the guest list:</p>
        <ul className={styles.guests}>
          {guestList.map((tag) => (
            <li key={tag} className={styles.guest}>
              <span aria-hidden="true" className={styles.disc}>
                {battleTagName(tag).charAt(0).toUpperCase()}
              </span>
              {tag}
            </li>
          ))}
        </ul>
        <p className={styles.note}>Characters fill in here once the first file is uploaded.</p>
      </aside>
    </div>
  );
}
