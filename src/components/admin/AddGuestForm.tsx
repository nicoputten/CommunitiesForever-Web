"use client";

import { useActionState, useId, useState } from "react";
import type { AddGuestState } from "@/app/(site)/admin/actions";
import { FilterChip } from "@/components/ui/FilterChip";
import styles from "./Admin.module.css";

export interface AddGuestFormProps {
  action: (prev: AddGuestState, form: FormData) => Promise<AddGuestState>;
}

/** Adds a guest by BattleTag (WEB-18): the roster search field's look, a "May upload" chip and the gold button. */
export function AddGuestForm({ action }: AddGuestFormProps) {
  const [state, submit, pending] = useActionState(action, {});
  const [mayUpload, setMayUpload] = useState(false);
  const id = useId();
  return (
    <form action={submit} className={styles.add} aria-describedby={`${id}-msg`}>
      <label htmlFor={`${id}-tag`} className={styles.label}>
        BattleTag
      </label>
      <div className={styles.addRow}>
        <span className={styles.field}>
          {/* key: a new field after each added guest, so it clears without an effect. */}
          <input
            key={state.added}
            id={`${id}-tag`}
            name="battleTag"
            className={styles.input}
            placeholder="Name#1234"
            autoComplete="off"
            spellCheck={false}
            required
            aria-invalid={state.error !== undefined || undefined}
          />
        </span>
        <input type="hidden" name="mayUpload" value={mayUpload ? "on" : ""} />
        <FilterChip pressed={mayUpload} onClick={() => setMayUpload((m) => !m)}>
          May upload
        </FilterChip>
        <button type="submit" className={styles.primary} disabled={pending}>
          Add guest
        </button>
      </div>
      <p id={`${id}-msg`} className={state.error !== undefined ? styles.error : styles.added} role="status">
        {state.error ?? (state.added !== undefined ? `${state.added} is on the guest list.` : "")}
      </p>
    </form>
  );
}
