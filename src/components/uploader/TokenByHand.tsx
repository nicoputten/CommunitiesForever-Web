"use client";

import { useActionState, useId, useState } from "react";
import type { TokenState } from "@/app/(site)/uploader/actions";
import styles from "./Uploader.module.css";

/**
 * "Create a token by hand" (uploader-page board): a name, then the token once with a Copy button. The token lives
 * only in this form's state: never in the URL or the page cache.
 */
export function TokenByHand({ action }: { action: (prev: TokenState, form: FormData) => Promise<TokenState> }) {
  const [state, submit, pending] = useActionState(action, {});
  const [copied, setCopied] = useState<string | undefined>(undefined);
  const id = useId();
  return (
    <details className={styles.byHand}>
      <summary className={styles.summary}>Create a token by hand</summary>
      <p className={styles.body}>
        For scripts or when the browser step doesn&apos;t work. The token is shown once; paste it in the app under
        “Paste an upload token instead”.
      </p>
      <form action={submit} className={styles.tokenForm}>
        <label htmlFor={`${id}-name`} className={styles.label}>
          Name
        </label>
        <div className={styles.row}>
          <span className={styles.field}>
            <input
              key={state.token}
              id={`${id}-name`}
              name="name"
              className={styles.input}
              placeholder="Gaming PC"
              autoComplete="off"
              required
              maxLength={64}
              aria-invalid={state.error !== undefined || undefined}
              aria-describedby={`${id}-msg`}
            />
          </span>
          <button type="submit" className={styles.primary} disabled={pending}>
            Create token
          </button>
        </div>
        <p id={`${id}-msg`} className={styles.error} role="status">
          {state.error ?? ""}
        </p>
      </form>
      {state.token !== undefined && (
        <div className={styles.shown}>
          <label htmlFor={`${id}-token`} className={styles.label}>
            Token for {state.name}. Copy it now: it won&apos;t be shown again.
          </label>
          <div className={styles.row}>
            <span className={styles.field}>
              <input
                id={`${id}-token`}
                className={styles.token}
                value={state.token}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
            </span>
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
    </details>
  );
}
