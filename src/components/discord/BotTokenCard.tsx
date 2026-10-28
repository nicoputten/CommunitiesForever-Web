"use client";

import { useActionState, useId, useState } from "react";
import type { BotTokenState } from "@/app/(site)/discord/actions";
import styles from "./Discord.module.css";

/**
 * The bot token row of "The bot" (board `discord-page`, WEB-58; WEB-38's token): its status, Create (or Replace) and
 * Revoke. A new token is shown once with Copy and lives only in this form's state, never in the URL or the page cache.
 * Revoke asks first. Only the token's hash is stored, so the row shows no characters of it (Nico, 2026-10-29).
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
    <div className={styles.tokenBlock}>
      <div className={styles.tokenHead}>
        <span>
          <span className={styles.optionName}>{active ? "Bot token" : "No bot token yet"}</span>
          <span className={styles.optionText}>
            {active
              ? line
              : "The bot needs one secret to talk to the site. Create it, paste it in the bot's settings, and the bot comes online."}
          </span>
        </span>
        <div className={styles.tokenButtons}>
          <form action={submit}>
            <button type="submit" className={active ? styles.ghost : styles.primary} disabled={pending}>
              {active ? "Replace" : "Create bot token"}
            </button>
          </form>
          {active && !asking && (
            <button type="button" className={styles.danger} onClick={() => setAsking(true)}>
              Revoke
            </button>
          )}
        </div>
      </div>
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
      {state.token !== undefined && (
        <div className={styles.shown}>
          <label htmlFor={`${id}-token`} className={styles.label}>
            Your new bot token · shown once
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
              className={styles.secondary}
              onClick={() => {
                void navigator.clipboard?.writeText(state.token!).then(() => setCopied(state.token));
              }}
            >
              {copied === state.token ? "Copied" : "Copy token"}
            </button>
          </div>
          <p className={styles.small}>
            Copy it into the bot&apos;s settings (BOT_API_TOKEN) now. After you leave this page it isn&apos;t shown
            again; if you lose it, replace it. Replacing makes a new one and the old one stops at once.
          </p>
        </div>
      )}
    </div>
  );
}
