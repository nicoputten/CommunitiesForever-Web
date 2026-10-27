import type { PendingPairing } from "@/server/uploader";
import styles from "./Uploader.module.css";

/**
 * "Connect an uploader?" (uploader-page board): the device and the code the app shows, Allow / Deny. A plain form, so
 * it works without JavaScript; the action checks the caller again.
 */
export function PairingRequest({
  pairing,
  site,
  action,
}: {
  pairing: PendingPairing;
  site: string;
  action: (form: FormData) => Promise<void>;
}) {
  return (
    <section aria-labelledby="uploader-pair" className={styles.pair}>
      <div className={styles.pairText}>
        <h2 id="uploader-pair" className={styles.pairTitle}>
          Connect an uploader?
        </h2>
        <p className={styles.body}>
          A {site} Uploader on <span className={styles.em}>{pairing.deviceName}</span> asks to upload data for you. It
          can only upload; it can&apos;t read the site or change settings. Only allow it if this code matches the app:
        </p>
      </div>
      <p className={styles.code} data-testid="pairing-code">
        {pairing.userCode}
      </p>
      <form action={action} className={styles.pairButtons}>
        <input type="hidden" name="code" value={pairing.userCode} />
        <button type="submit" name="decision" value="allow" className={styles.primary}>
          Allow
        </button>
        <button type="submit" name="decision" value="deny" className={styles.ghost}>
          Deny
        </button>
      </form>
    </section>
  );
}
