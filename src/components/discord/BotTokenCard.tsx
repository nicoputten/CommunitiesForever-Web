"use client";

import { useActionState, useId, useState } from "react";
import type { BotTokenState } from "@/app/(site)/discord/actions";
import styles from "./Discord.module.css";

/**
 * "Bot token" (not on the board, DESIGN.md §11; WEB-38's token): its status, Create (or Replace) and Revoke. A new token
 * is shown once with Copy and lives only in this form's state, never in the URL or the page cache. Revoke asks first.
 */
export function BotTokenCard({
  line,
  active,
  create,
  revoke,
}: {
  line: string;
  active: boolean;
  create: () => Promise<BotTokenState>;
  revoke: () => Promise<void>;
}) {
  const [state, submit, pending] = useActionState(create, {});
  const [copied, setCopied] = useState<string | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} className={styles.box}>
      <div className={styles.boxHead}>
        <h2 id={`${id}-title`} className={styles.boxTitle}>
          Bot token
        </h2>
        <span className={styles.small}>Admin only</span>
      </div>
      <p className={styles.body}>{line}</p>
      {state.token !== undefined && (
        <div className={styles.shown}>
          <label htmlFor={`${id}-token`} className={styles.small}>
            Copy it now: it won&apos;t be shown again. It goes into the bot&apos;s BOT_API_TOKEN.
          </label>
          <div className={styles.tokenRow}>
            <input
              id={`${id}-token`}
              className={styles.token}
              value={state.token}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                void navigator.clipboard?.writeText(state.token!).then(() => setCopied(state.token));
              }}
            >
              {copied === state.token ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      <div className={styles.buttons}>
        <form action={submit}>
          <button type="submit" className={active ? styles.secondary : styles.primary} disabled={pending}>
            {active ? "Replace token" : "Create token"}
          </button>
        </form>
        {active && !asking && (
          <button type="button" className={styles.ghost} onClick={() => setAsking(true)}>
            Revoke
          </button>
        )}
        {active && asking && (
          <form action={revoke} className={styles.confirm}>
            <span className={styles.small}>The bot stops at its next call.</span>
            <button type="submit" className={styles.danger}>
              Revoke token
            </button>
            <button type="button" className={styles.ghost} onClick={() => setAsking(false)}>
              Keep it
            </button>
          </form>
        )}
      </div>
      {active && <p className={styles.small}>Replacing makes a new token; the old one stops working at once.</p>}
    </section>
  );
}
