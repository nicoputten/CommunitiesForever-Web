"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { ClassDisc } from "@/components/ui/ClassDisc";
import type { PickerCharacter, PickerView } from "@/core/views/runs";
import type { ClassFile } from "@/core/gamedata/classes";
import styles from "./Picker.module.css";

// The character and role picker (WEB-49, board `runs-v2-picker`): every character of the friend with its fit tag (a
// listbox), the role (a radiogroup; roles the class can't play off with the reason, each with its state), and in
// answer mode the answer (a radiogroup). Used in the run page's answer popover or sheet, and inline as Lead as in Plan.

export type SlotRole = "tank" | "healer" | "damage";
export type PickAnswer = "in" | "maybe" | "cant";

export interface PickerValue {
  guid: string;
  role: SlotRole;
  answer: PickAnswer;
}

const ROLE_LABEL: Record<SlotRole, string> = { tank: "Tank", healer: "Healer", damage: "Damage" };
const ROLE_ORDER: SlotRole[] = ["healer", "damage", "tank"];
const ANSWERS: { value: PickAnswer; label: string }[] = [
  { value: "in", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "cant", label: "Can't" },
];

/** The starting value: the current answer, else the first character that fits (else the first) at its own role. */
export function initialPick(view: Pick<PickerView, "characters" | "current">): PickerValue | undefined {
  const current = view.current;
  const char =
    view.characters.find((c) => c.guid === current?.guid) ??
    view.characters.find((c) => c.fit.kind === "fits" || c.fit.kind === "over") ??
    view.characters[0];
  if (char === undefined) return undefined;
  const role = current !== undefined && char.roles.includes(current.role) ? current.role : char.defaultRole;
  const answer: PickAnswer =
    current === undefined || current.answer === "reserve" ? "in" : (current.answer as PickAnswer);
  return { guid: char.guid, role, answer: char.onlyMaybe && answer === "in" ? "maybe" : answer };
}

export function PickerFields({
  view,
  value,
  onChange,
  withAnswer,
}: {
  view: Pick<PickerView, "characters" | "roles">;
  value: PickerValue;
  onChange: (value: PickerValue) => void;
  /** Without: Lead as (Plan, the organiser's bar), I'm in. */
  withAnswer: boolean;
}) {
  const own = useId();
  const char = view.characters.find((c) => c.guid === value.guid) ?? view.characters[0]!;

  const pickCharacter = (c: PickerCharacter) => {
    const role = c.roles.includes(value.role) ? value.role : c.defaultRole;
    const answer = c.onlyMaybe && value.answer === "in" ? "maybe" : value.answer;
    onChange({ guid: c.guid, role, answer });
  };

  return (
    <div className={styles.fields}>
      <div className={styles.part}>
        <h3 id={`${own}-chars`} className={styles.step}>
          1 · Character
        </h3>
        <Listbox
          labelledBy={`${own}-chars`}
          items={view.characters}
          selected={char.guid}
          onPick={pickCharacter}
          render={(c) => (
            <>
              <ClassDisc name={c.name} classFile={c.classFile as ClassFile | undefined} size="sm" />
              <span className={styles.charText}>
                <span className={styles.charName} style={{ color: c.colorToken && `var(${c.colorToken})` }}>
                  {c.name}
                </span>
                <span className={styles.charLine}>{c.line}</span>
              </span>
              <span className={styles.fit} data-fit={c.fit.kind}>
                {c.fit.label}
              </span>
            </>
          )}
        />
        <p className={styles.hint}>
          All your characters are listed. The tag says how well each one fits; nothing is hidden.
        </p>
      </div>

      <div className={styles.part}>
        <h3 id={`${own}-role`} className={styles.step}>
          2 · Role
        </h3>
        <RadioRow
          labelledBy={`${own}-role`}
          items={ROLE_ORDER.map((role) => {
            const playable = char.roles.includes(role);
            const state = view.roles[role].state;
            return {
              value: role,
              label: ROLE_LABEL[role],
              detail: !playable
                ? char.notFor
                : [state, role === char.defaultRole ? "your talents" : undefined].filter(Boolean).join(" · ") ||
                  undefined,
              disabled: !playable,
            };
          })}
          selected={value.role}
          onPick={(role) => onChange({ ...value, role: role as SlotRole })}
        />
      </div>

      {withAnswer && (
        <div className={styles.part}>
          <h3 id={`${own}-answer`} className={styles.step}>
            3 · Answer
          </h3>
          <RadioRow
            labelledBy={`${own}-answer`}
            items={ANSWERS.map((a) => ({
              value: a.value,
              label: a.label,
              disabled: a.value === "in" && char.onlyMaybe,
              detail: a.value === "in" && char.onlyMaybe ? "too low" : undefined,
            }))}
            selected={value.answer}
            onPick={(answer) => onChange({ ...value, answer: answer as PickAnswer })}
          />
        </div>
      )}

      <div className={styles.summary} aria-live="polite">
        <p>
          {withAnswer ? summaryLead(value.answer, view.roles[value.role].full) : "You lead as"}{" "}
          <strong style={{ color: char.colorToken && `var(${char.colorToken})` }}>{char.name}</strong>
          {value.answer === "cant" && withAnswer ? "" : ` · ${ROLE_LABEL[value.role]}`}
        </p>
        {!withAnswer && char.onlyMaybe ? (
          <p className={styles.note}>Too low to lead this run: you&apos;re listed as organiser without a slot.</p>
        ) : (
          char.note !== undefined && <p className={styles.note}>{char.note}</p>
        )}
      </div>
    </div>
  );
}

function summaryLead(answer: PickAnswer, full: boolean): string {
  if (answer === "cant") return "You can't make it with";
  if (answer === "maybe") return "Maybe, as";
  return full ? "The role is full · you'd be reserve as" : "You join as";
}

/** A listbox of characters: arrows, Home and End move and pick (selection follows focus). */
function Listbox({
  labelledBy,
  items,
  selected,
  onPick,
  render,
}: {
  labelledBy: string;
  items: PickerCharacter[];
  selected: string;
  onPick: (c: PickerCharacter) => void;
  render: (c: PickerCharacter) => React.ReactNode;
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const at = Math.max(
    0,
    items.findIndex((c) => c.guid === selected),
  );
  const go = (i: number) => {
    const to = (i + items.length) % items.length;
    onPick(items[to]!);
    refs.current[to]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 };
    if (e.key in moves) {
      e.preventDefault();
      go(moves[e.key]!);
    }
  };
  return (
    <div role="listbox" aria-labelledby={labelledBy} className={styles.list} onKeyDown={onKey}>
      {items.map((c, i) => (
        <div
          key={c.guid}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="option"
          aria-selected={c.guid === selected}
          tabIndex={i === at ? 0 : -1}
          className={styles.character}
          onClick={() => onPick(c)}
        >
          {render(c)}
        </div>
      ))}
    </div>
  );
}

/** A radiogroup as segmented buttons: arrows move and pick, skipping disabled ones. */
function RadioRow({
  labelledBy,
  items,
  selected,
  onPick,
}: {
  labelledBy: string;
  items: { value: string; label: string; detail?: string; disabled: boolean }[];
  selected: string;
  onPick: (value: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = items.findIndex((i) => i.value === selected);
  const onKey = (e: KeyboardEvent) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    for (let k = 1; k <= items.length; k++) {
      const i = (at + step * k + items.length * k) % items.length;
      if (!items[i]!.disabled) {
        onPick(items[i]!.value);
        refs.current[i]?.focus();
        return;
      }
    }
  };
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={styles.segments} onKeyDown={onKey}>
      {items.map((item, i) => (
        <button
          key={item.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={item.value === selected}
          aria-disabled={item.disabled || undefined}
          tabIndex={item.value === selected || (at < 0 && i === 0) ? 0 : -1}
          className={styles.segment}
          onClick={() => !item.disabled && onPick(item.value)}
        >
          <span>{item.label}</span>
          {item.detail !== undefined && <span className={styles.segmentDetail}>{item.detail}</span>}
        </button>
      ))}
    </div>
  );
}
