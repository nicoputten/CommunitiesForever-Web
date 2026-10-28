"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/(site)/runs/actions";
import { DateField } from "@/components/ui/DateField";
import { Dropdown } from "@/components/ui/Dropdown";
import { TimeField } from "@/components/ui/TimeField";
import { PickerFields, initialPick, type PickerValue } from "./Picker";
import { localTime, runWhen, zonedToUtc } from "@/core/runTime";
import type { PlanPage } from "@/core/views/runs";
import { joinNames } from "@/core/views/text";
import styles from "./Runs.module.css";

export interface PlanFormProps {
  page: PlanPage;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  /** Edit run (WEB-40): day, time and note only, with these values. */
  edit?: { dungeonId: string; date: string; time: string; note: string; lead?: string; cancelHref: string };
  /** Where the Discord preview posts. */
  postsTo: string;
}

/** Plan has no slots yet: the roles show no counts, only "your talents" and what the class can't play. */
const NO_COUNTS = {
  tank: { state: "", full: false },
  healer: { state: "", full: false },
  damage: { state: "", full: false },
};

/** The board's evening time, the form's default. */
const DEFAULT_TIME = "20:30";

/** Plan a run (board `run-create`) and Edit run: the form, its states and the Discord preview. */
export function PlanForm({ page, action, edit, postsTo }: PlanFormProps) {
  const [state, submit, pending] = useActionState(action, {});
  const [dungeonId, setDungeonId] = useState(edit?.dungeonId ?? page.dungeonId);
  // Lead as (WEB-49): the picker with character and role, no answer step.
  const leadsFor = (id: string) => page.leadPicker[id] ?? [];
  const firstLead = (id: string): PickerValue | undefined => initialPick({ characters: leadsFor(id) });
  const [lead, setLead] = useState<PickerValue | undefined>(() => firstLead(dungeonId));
  // 20:30 today, or tomorrow once that has passed.
  const evening = zonedToUtc(page.days[0]!.date, DEFAULT_TIME, page.timeZone);
  const firstDay = page.days[evening !== undefined && evening <= page.now ? 1 : 0]!.date;
  const [day, setDay] = useState(
    edit === undefined ? firstDay : page.days.some((d) => d.date === edit.date) ? edit.date : "other",
  );
  const [otherDay, setOtherDay] = useState(edit?.date ?? firstDay);
  const [time, setTime] = useState(edit?.time ?? DEFAULT_TIME);
  const [note, setNote] = useState(edit?.note ?? "");
  // "Now" when the page was rendered, for the time-passed state; the server checks again on submit.
  const now = page.now;

  const dungeon = page.dungeons.find((d) => d.id === dungeonId) ?? page.dungeons[0]!;
  const date = day === "other" ? otherDay : day;
  const startsAt = zonedToUtc(date, time, page.timeZone);
  const passed = startsAt !== undefined && startsAt <= now;
  const leadChars = leadsFor(dungeonId);
  const noneFits = leadChars.every((c) => c.onlyMaybe);
  const chosen = leadChars.find((c) => c.guid === lead?.guid);
  // A character too low to lead leaves the organiser without a slot (the server refuses it as lead).
  const chosenLead = chosen !== undefined && !chosen.onlyMaybe ? chosen : undefined;
  const zones = new Map<string, string[]>();
  if (startsAt !== undefined) {
    for (const z of page.otherZones) {
      const t = localTime(startsAt, z.timeZone);
      zones.set(t, [...(zones.get(t) ?? []), z.name]);
    }
  }
  const range = `${dungeon.range.min}–${dungeon.range.max}`;

  return (
    <div className={styles.columns}>
      <form action={submit} className={`${styles.box} ${styles.form}`}>
        <div className={styles.field}>
          <label htmlFor="dungeon" className={styles.label}>
            Dungeon
          </label>
          <Dropdown
            id="dungeon"
            name="dungeon"
            value={dungeonId}
            disabled={edit !== undefined}
            options={page.dungeons.map((d) => ({ value: d.id, label: d.name, meta: `${d.range.min}–${d.range.max}` }))}
            onChange={(id) => {
              setDungeonId(id);
              setLead(firstLead(id));
            }}
          />
          <p className={styles.small}>{dungeon.fits}</p>
        </div>

        {edit === undefined && (
          <fieldset className={styles.field}>
            <legend className={styles.label}>Lead as</legend>
            {lead !== undefined && leadChars.length > 0 && (
              <PickerFields
                view={{ characters: leadChars, roles: NO_COUNTS }}
                value={lead}
                onChange={setLead}
                withAnswer={false}
              />
            )}
            <input type="hidden" name="lead" value={chosenLead?.guid ?? ""} />
            <input type="hidden" name="leadRole" value={chosenLead === undefined ? "" : (lead?.role ?? "")} />
            {noneFits && (
              <p className={styles.warn}>
                None of your characters fit {dungeon.name} ({range}). You can still plan it; you&apos;re listed as
                organiser without a slot.
              </p>
            )}
          </fieldset>
        )}

        <fieldset className={styles.field}>
          <legend className={styles.label}>Day</legend>
          <div className={styles.chips}>
            {page.days.map((d) => (
              <label key={d.date} className={styles.chip}>
                <input
                  type="radio"
                  name="day"
                  value={d.date}
                  checked={day === d.date}
                  onChange={() => setDay(d.date)}
                />
                {d.label}
              </label>
            ))}
            <label className={styles.chip}>
              <input type="radio" name="day" value="other" checked={day === "other"} onChange={() => setDay("other")} />
              Other date…
            </label>
          </div>
          {day === "other" && (
            <DateField
              name="otherDay"
              label="Other date"
              value={otherDay}
              min={page.days[0]!.date}
              onChange={setOtherDay}
            />
          )}
        </fieldset>

        <div className={styles.field}>
          <label htmlFor="time" className={styles.label}>
            Time
          </label>
          <TimeField id="time" name="time" required value={time} onChange={setTime} />
          <p className={styles.small}>
            Your time zone: {page.timeZone.replace(/_/g, " ")}.{" "}
            <Link href="/discord" className={styles.inlineLink}>
              Change
            </Link>
            {zones.size > 0 &&
              ` · Everyone sees it in their own time: ${[...zones]
                .map(([t, names]) => `${joinNames(names)} ${names.length === 1 ? "sees" : "see"} ${t}`)
                .join(", ")}.`}
          </p>
          {passed && startsAt !== undefined && (
            <p className={styles.warn} role="alert">
              Time already passed. {runWhen(startsAt, page.timeZone, now)} is in the past. Pick a later time, or use Ask
              now in the game to go right away.
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="note" className={styles.label}>
            Note (optional)
          </label>
          <textarea
            id="note"
            name="note"
            maxLength={200}
            className={styles.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {state.error !== undefined && (
          <p className={styles.warn} role="alert">
            {state.error}
          </p>
        )}
        <div className={styles.buttons}>
          <button type="submit" className={styles.primary} disabled={pending || passed}>
            {edit === undefined ? "Plan run" : "Save changes"}
          </button>
          <Link href={edit?.cancelHref ?? "/runs"} className={styles.ghost}>
            Cancel
          </Link>
        </div>
      </form>

      <section className={styles.box} aria-labelledby="preview">
        <h2 id="preview" className={styles.boxTitle}>
          Preview in Discord
        </h2>
        <p className={styles.small}>{postsTo}</p>
        <div className={styles.preview}>
          <span>
            {page.organiser.name}
            {chosenLead === undefined
              ? ""
              : ` on ${chosenLead.name}${chosenLead.level === undefined ? "" : ` ${chosenLead.level}`}`}
          </span>
          <b>{dungeon.name}</b>
          <span>
            {startsAt === undefined ? time : atTime(runWhen(startsAt, page.timeZone, now))} · levels {range}
          </span>
          {note.trim() !== "" && <span>“{note.trim()}”</span>}
          <span>
            {chosenLead === undefined ? "0 in · organiser without a slot" : "1 in · organiser fills their slot"}
          </span>
          <div className={styles.previewButtons} aria-hidden="true">
            <span>I&apos;m in</span>
            <span>Maybe</span>
            <span>Can&apos;t</span>
          </div>
        </div>
        <p className={styles.small}>Coming from a dungeon page or a roster band, the dungeon is already filled in.</p>
      </section>
    </div>
  );
}

/** "Today 20:30" → "Today at 20:30". */
function atTime(when: string): string {
  const at = when.lastIndexOf(" ");
  return `${when.slice(0, at)} at ${when.slice(at + 1)}`;
}
