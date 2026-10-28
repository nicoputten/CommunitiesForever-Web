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

/** The time chips (WEB-49, board `runs-v2-plan`); the board's evening time is the form's default. */
const TIMES: readonly string[] = ["19:00", "19:30", "20:00", "20:30", "21:00"];
const DEFAULT_TIME = "20:30";

const FITS_GROUP = "Fits your characters";
const ALL_GROUP = "All dungeons by level";

/** "2026-11-07" → "Sat 7 Nov", for a day picked beyond the chips. */
function chipDate(date: string): string {
  return new Date(`${date}T00:00:00Z`)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .replace(",", "");
}

/** Plan a run (boards `run-create`, `runs-v2-plan`) and Edit run: the form, its states and the Discord preview. */
export function PlanForm({ page, action, edit, postsTo }: PlanFormProps) {
  const [state, submit, pending] = useActionState(action, {});
  const [dungeonId, setDungeonId] = useState(edit?.dungeonId ?? page.dungeonId ?? "");
  // Lead as (WEB-49): the picker with character and role, no answer step.
  const leadsFor = (id: string) => page.leadPicker[id] ?? [];
  const firstLead = (id: string): PickerValue | undefined => initialPick({ characters: leadsFor(id) });
  const [lead, setLead] = useState<PickerValue | undefined>(() => firstLead(dungeonId));
  // 20:30 today, or tomorrow once that has passed.
  const evening = zonedToUtc(page.days[0]!.date, DEFAULT_TIME, page.timeZone);
  const firstDay = page.days[evening !== undefined && evening <= page.now ? 1 : 0]!.date;
  const [day, setDay] = useState(edit?.date ?? firstDay);
  const [time, setTime] = useState(edit?.time ?? DEFAULT_TIME);
  // "Other…" opens the time input; Edit opens on it for a time that isn't a chip.
  const [otherTime, setOtherTime] = useState(!TIMES.includes(edit?.time ?? DEFAULT_TIME));
  const [note, setNote] = useState(edit?.note ?? "");
  // "Now" when the page was rendered, for the time-passed state; the server checks again on submit.
  const now = page.now;

  const dungeon = page.dungeons.find((d) => d.id === dungeonId);
  const startsAt = zonedToUtc(day, time, page.timeZone);
  const passed = startsAt !== undefined && startsAt <= now;
  const leadChars = leadsFor(dungeonId);
  const noneFits = dungeon !== undefined && leadChars.every((c) => c.onlyMaybe);
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
  const range = dungeon === undefined ? undefined : `${dungeon.range.min}–${dungeon.range.max}`;
  // A day picked in the calendar beyond the seven chips gets a chip of its own.
  const days = page.days.some((d) => d.date === day) ? page.days : [...page.days, { date: day, label: chipDate(day) }];

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
            placeholder="Pick a dungeon"
            options={page.dungeons.map((d) => ({
              value: d.id,
              label: d.name,
              meta: `${d.range.min}–${d.range.max}${d.forever ? " · Forever" : ""}`,
              group: d.fitsYou ? FITS_GROUP : ALL_GROUP,
              ...(d.best === undefined ? {} : { hint: d.best.text }),
              ...(d.best?.tone === undefined ? {} : { hintTone: d.best.tone }),
              ...(d.wingOf === undefined ? {} : { family: d.wingOf }),
            }))}
            onChange={(id) => {
              setDungeonId(id);
              setLead(firstLead(id));
            }}
          />
          {dungeon !== undefined && <p className={styles.small}>{dungeon.fits}</p>}
        </div>

        {edit === undefined && dungeon !== undefined && (
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
          {/* One row that never wraps: the chips scroll sideways on a phone, the calendar stays at the end. */}
          <div className={styles.dayRow}>
            <div className={styles.chipScroll}>
              {days.map((d) => (
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
            </div>
            <DateField buttonOnly label="Another date" value={day} min={page.days[0]!.date} onChange={setDay} />
          </div>
        </fieldset>

        <fieldset className={styles.field}>
          <legend className={styles.label}>Time</legend>
          <div className={styles.chips}>
            {TIMES.map((t) => (
              <label key={t} className={styles.chip}>
                <input
                  type="radio"
                  name="timeChip"
                  checked={!otherTime && time === t}
                  onChange={() => {
                    setOtherTime(false);
                    setTime(t);
                  }}
                />
                {t}
              </label>
            ))}
            <label className={styles.chip}>
              <input type="radio" name="timeChip" checked={otherTime} onChange={() => setOtherTime(true)} />
              Other…
            </label>
          </div>
          {otherTime && <TimeField ariaLabel="Other time" required value={time} onChange={setTime} />}
          <input type="hidden" name="time" value={time} />
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
        </fieldset>

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
          <button type="submit" className={styles.primary} disabled={pending || passed || dungeon === undefined}>
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
          <b>{dungeon?.name ?? "Pick a dungeon"}</b>
          <span>
            {startsAt === undefined ? time : atTime(runWhen(startsAt, page.timeZone, now))}
            {range === undefined ? "" : ` · levels ${range}`}
          </span>
          {note.trim() !== "" && <span>“{note.trim()}”</span>}
          <span>{chosenLead === undefined ? "0 in · organiser without a slot" : "1 in · organiser takes a slot"}</span>
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
