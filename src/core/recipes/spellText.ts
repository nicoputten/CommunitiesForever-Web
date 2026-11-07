// An item's Use, Equip and Chance on hit lines (WEB-90, WEB-95): the spell's description from the Forever client
// (Spell.Description_lang) with its tokens filled from the spell's own data, as the game's tooltip does. Pure.
//
// Tokens (the client's spell description variables; wowdev.wiki "Spell" / warcraft.wiki.gg "Spell description
// variables"), each optionally after another spell's ID (`$12345s1` reads spell 12345) and with an effect number 1-3
// where it has one:
// - `$s1` the effect's points; with a Variance (SpellEffect.Variance, the spread around the points) "min to max", as
//   the game shows a healing potion ("Restores 1050 to 1750 health." for points 1400, variance 0.5). `$m1` the
//   points, `$M1` the highest.
// - `$o1` the total over the duration: points × duration / period, the period being EffectAuraPeriod, else 5 sec
//   (food and drink have no period in the client: Wowhead Classic's tooltips show Cured Ham Steak's 232 points as
//   "1392 health over 30 sec" and Haunch of Meat's 58 as "243.6 health over 21 sec").
// - `$t1` the period in seconds, `$a1` the radius in yards (SpellRadius), `$q1` the effect's misc value, `$x1` its
//   chain targets.
// - `$d` the duration (SpellMisc.DurationIndex → SpellDuration), in the tooltip's words: "1 hour", "2 hrs", "10 min",
//   "15 sec" (Wowhead Classic: Elixir of Fortitude, Flask of the Titans, Bogling Root, Swiftness Potion).
// - `$h` proc chance, `$n` proc charges, `$u` stacks (SpellAuraOptions), `$i` most targets (SpellTargetRestrictions).
// - `${expression}` arithmetic over tokens, with `.N` decimals after it; `$/N;s1` and `$*N;s1` divide or multiply.
// - `$@spelldesc12345` another spell's description, `$@spellname12345` its name.
// - `$proccooldown` the proc's cooldown in seconds (SpellAuraOptions.ProcCategoryRecovery).
// - `$lsingular:plural;` by the number before it; `$gmale:female;` both ("his/her").
// - `$?cond[yes]?cond2[yes2][no]`: the first branch whose condition holds, else the last. A level condition
//   (`$PL<20`, `$PL>59`) is read for a character at the level cap (MAX_LEVEL); any other (a talent, aura or spell the
//   reader may have, `a12345`, `s12345`) as not held, `!` turning it round.
// Whatever is still a token after that (a variable such as `$ec1` or `$<name>`, a value the data doesn't hold) is
// dropped and the spacing around it tidied: the line stays (WEB-95), instead of losing the whole effect.
import { MAX_LEVEL } from "../gamedata/levels";
import { stripEscapes } from "../sanitize";

export interface SpellEffectInfo {
  points?: number;
  /** The spread around the points (0.5: from 75% to 125%). */
  variance?: number;
  /** Milliseconds between ticks. */
  period?: number;
  radius?: number;
  misc?: number;
  chainTargets?: number;
}

export interface SpellInfo {
  name?: string;
  description?: string;
  /** Effects by index (0-2). */
  effects: readonly (SpellEffectInfo | undefined)[];
  /** Milliseconds; undefined or not above 0: none. */
  duration?: number;
  procChance?: number;
  procCharges?: number;
  /** Milliseconds between procs. */
  procCooldown?: number;
  stacks?: number;
  maxTargets?: number;
}

export type SpellLookup = (id: number) => SpellInfo | undefined;

/** The default tick of an effect without a period (food, drink): see the header. */
const DEFAULT_PERIOD = 5000;
const MAX_DEPTH = 3;

/** A number as the tooltip shows it: whole, else one decimal. */
function num(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/** "1 hour", "2 hrs", "10 min", "15 sec", "1.5 sec" (the header's sources). */
export function durationText(ms: number | undefined): string | undefined {
  if (ms === undefined || !(ms > 0)) return undefined;
  if (ms % 3_600_000 === 0) return ms === 3_600_000 ? "1 hour" : `${ms / 3_600_000} hrs`;
  if (ms % 60_000 === 0) return `${ms / 60_000} min`;
  return `${num(ms / 1000)} sec`;
}

interface Ctx {
  self: SpellInfo;
  spells: SpellLookup;
  depth: number;
}

/** A token's raw value (signed), for arithmetic. */
function value(spell: SpellInfo, letter: string, index: number | undefined): number | undefined {
  const fx = spell.effects[(index ?? 1) - 1];
  switch (letter) {
    case "s":
    case "S":
    case "m":
      return fx?.points;
    case "M":
      return fx?.points === undefined ? undefined : fx.points * (1 + (fx.variance ?? 0) / 2);
    case "o":
    case "O": {
      if (fx?.points === undefined || spell.duration === undefined || !(spell.duration > 0)) return undefined;
      const period = fx.period !== undefined && fx.period > 0 ? fx.period : DEFAULT_PERIOD;
      return (fx.points * spell.duration) / period;
    }
    case "t":
    case "T":
      return fx?.period !== undefined && fx.period > 0 ? fx.period / 1000 : undefined;
    case "a":
    case "A":
      return fx?.radius !== undefined && fx.radius > 0 ? fx.radius : undefined;
    case "q":
    case "Q":
      return fx?.misc;
    case "x":
    case "X":
      return fx?.chainTargets !== undefined && fx.chainTargets > 0 ? fx.chainTargets : undefined;
    case "d":
    case "D":
      return spell.duration !== undefined && spell.duration > 0 ? spell.duration / 1000 : undefined;
    case "h":
    case "H":
      return spell.procChance === undefined ? undefined : Math.min(100, spell.procChance);
    case "n":
    case "N":
      return spell.procCharges !== undefined && spell.procCharges > 0 ? spell.procCharges : undefined;
    case "u":
    case "U":
      return spell.stacks !== undefined && spell.stacks > 0 ? spell.stacks : undefined;
    case "i":
    case "I":
      return spell.maxTargets !== undefined && spell.maxTargets > 0 ? spell.maxTargets : undefined;
    default:
      return undefined;
  }
}

/** A token as text: durations in words, `$s` with its range, numbers without a sign. */
function shown(spell: SpellInfo, letter: string, index: number | undefined): string | undefined {
  if (letter === "d" || letter === "D") return durationText(spell.duration);
  const fx = spell.effects[(index ?? 1) - 1];
  if ((letter === "s" || letter === "S") && fx?.points !== undefined && (fx.variance ?? 0) > 0) {
    const a = Math.abs(fx.points * (1 - fx.variance! / 2));
    const b = Math.abs(fx.points * (1 + fx.variance! / 2));
    return `${num(Math.min(a, b))} to ${num(Math.max(a, b))}`;
  }
  const v = value(spell, letter, index);
  return v === undefined ? undefined : num(Math.abs(v));
}

const TOKEN = /\$(\d*)([sSmMoOtTaAqQxXdDhHnNuUiI])([1-3])?/y;

function target(ctx: Ctx, id: string): SpellInfo | undefined {
  return id === "" ? ctx.self : ctx.spells(Number(id));
}

/** Arithmetic over numbers, + - * / and parentheses, max/min/floor/ceil/abs: never eval (rule 2's spirit). */
function evaluate(expr: string): number | undefined {
  const tokens = expr.match(/\d+(?:\.\d+)?|[a-z]+|[-+*/(),]/gi);
  if (tokens === null || tokens.join("") !== expr.replace(/\s+/g, "")) return undefined;
  let i = 0;
  const peek = () => tokens[i];
  const FUNCS: Record<string, (...a: number[]) => number> = {
    max: Math.max,
    min: Math.min,
    floor: Math.floor,
    ceil: Math.ceil,
    abs: Math.abs,
  };
  function primary(): number {
    const t = tokens![i++];
    if (t === undefined) throw new Error("end");
    if (t === "-") return -primary();
    if (t === "(") {
      const v = sum();
      if (tokens![i++] !== ")") throw new Error(")");
      return v;
    }
    const fn = FUNCS[t.toLowerCase()];
    if (fn !== undefined) {
      if (tokens![i++] !== "(") throw new Error("(");
      const args = [sum()];
      while (peek() === ",") {
        i++;
        args.push(sum());
      }
      if (tokens![i++] !== ")") throw new Error(")");
      return fn(...args);
    }
    const v = Number(t);
    if (Number.isNaN(v)) throw new Error(t);
    return v;
  }
  function product(): number {
    let v = primary();
    while (peek() === "*" || peek() === "/") v = tokens![i++] === "*" ? v * primary() : v / primary();
    return v;
  }
  function sum(): number {
    let v = product();
    while (peek() === "+" || peek() === "-") v = tokens![i++] === "+" ? v + product() : v - product();
    return v;
  }
  try {
    const v = sum();
    return i === tokens.length && Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** The text between a `[` at `open` and its `]`, nesting allowed; undefined when it never closes. */
function bracket(text: string, open: number): { inner: string; end: number } | undefined {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]" && --depth === 0) return { inner: text.slice(open + 1, i), end: i + 1 };
  }
  return undefined;
}

/** A `$?` condition: see the header. */
function holds(condition: string): boolean {
  const c = condition.trim();
  if (c.startsWith("!")) return !holds(c.slice(1));
  const level = /^\$PL(<=|>=|<|>|=)(\d+)$/i.exec(c);
  if (level === null) return false;
  const n = Number(level[2]);
  switch (level[1]) {
    case "<":
      return MAX_LEVEL < n;
    case "<=":
      return MAX_LEVEL <= n;
    case ">":
      return MAX_LEVEL > n;
    case ">=":
      return MAX_LEVEL >= n;
    default:
      return MAX_LEVEL === n;
  }
}

/** `$?cond[yes]?cond2[yes2][no]`, from after the `$?`: the branch it shows (see the header). */
function conditional(text: string, at: number): { out: string; end: number } {
  let i = at;
  let out: string | undefined;
  for (;;) {
    const open = text.indexOf("[", i);
    if (open === -1) return { out: out ?? "", end: text.length };
    const yes = bracket(text, open);
    if (yes === undefined) return { out: out ?? "", end: text.length };
    if (out === undefined && holds(text.slice(i, open))) out = yes.inner;
    i = yes.end;
    if (text[i] === "?") {
      i++;
      continue;
    }
    if (text[i] === "[") {
      const no = bracket(text, i);
      if (no !== undefined) {
        out ??= no.inner;
        i = no.end;
      }
    }
    return { out: out ?? "", end: i };
  }
}

function fill(text: string, ctx: Ctx): string {
  let out = "";
  let last: number | undefined;
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c !== "$") {
      out += c;
      if (/\d/.test(c)) last = Number((/[\d.]+$/.exec(out) ?? ["0"])[0]);
      i++;
      continue;
    }
    const rest = text.slice(i);
    // ${expression}.N
    if (rest.startsWith("${")) {
      const close = text.indexOf("}", i);
      if (close === -1) {
        i = text.length;
        continue;
      }
      const inner = text.slice(i + 2, close).replace(TOKEN_ALL, (whole, id: string, letter: string, index?: string) => {
        const spell = target(ctx, id);
        const v =
          spell === undefined ? undefined : value(spell, letter, index === undefined ? undefined : Number(index));
        return v === undefined ? "?" : `(${v})`;
      });
      const v = evaluate(inner.replace(/\$/g, ""));
      let end = close + 1;
      const decimals = /^\.(\d)/.exec(text.slice(end));
      if (decimals !== null) end += 2;
      if (v !== undefined) {
        const shownV = decimals !== null ? Math.abs(v).toFixed(Number(decimals[1])) : num(Math.abs(v));
        out += shownV;
        last = Number(shownV);
      }
      i = end;
      continue;
    }
    // $/N;s1 and $*N;s1
    const scaled = /^\$([/*])(\d+(?:\.\d+)?);(\d*)([a-zA-Z])([1-3])?/.exec(rest);
    if (scaled !== null) {
      const [whole, op, by, id, letter, index] = scaled;
      const spell = target(ctx, id!);
      const v =
        spell === undefined ? undefined : value(spell, letter!, index === undefined ? undefined : Number(index));
      if (v !== undefined) {
        const r = op === "/" ? v / Number(by) : v * Number(by);
        out += num(Math.abs(r));
        last = Math.abs(r);
      }
      i += whole.length;
      continue;
    }
    // $proccooldown
    if (rest.startsWith("$proccooldown")) {
      const ms = ctx.self.procCooldown;
      if (ms !== undefined && ms > 0) out += num(ms / 1000);
      i += "$proccooldown".length;
      continue;
    }
    // $@spelldesc12345, $@spellname12345
    const ref = /^\$@(spelldesc|spellname|spelltooltip|spellaura)(\d+)/.exec(rest);
    if (ref !== null) {
      const spell = ctx.spells(Number(ref[2]));
      if (spell !== undefined && ctx.depth < MAX_DEPTH) {
        if (ref[1] === "spellname") out += spell.name ?? "";
        else if (ref[1] === "spelldesc" || ref[1] === "spelltooltip") {
          out += fill(spell.description ?? "", { self: spell, spells: ctx.spells, depth: ctx.depth + 1 });
        }
      }
      i += ref[0].length;
      continue;
    }
    // $lsingular:plural; $gmale:female;
    const choice = /^\$([lLgG])([^:;$]*):([^;$]*);/.exec(rest);
    if (choice !== null) {
      const [whole, kind, a, b] = choice;
      out += kind === "l" || kind === "L" ? (last === 1 ? a : b) : `${a}/${b}`;
      i += whole.length;
      continue;
    }
    // $?condition[yes][no]
    if (rest.startsWith("$?")) {
      const { out: chosen, end } = conditional(text, i + 2);
      out += fill(chosen, ctx);
      i = end;
      continue;
    }
    TOKEN.lastIndex = i;
    const token = TOKEN.exec(text);
    if (token !== null) {
      const [whole, id, letter, index] = token;
      const spell = target(ctx, id!);
      const v =
        spell === undefined ? undefined : shown(spell, letter!, index === undefined ? undefined : Number(index));
      if (v !== undefined) {
        out += v;
        last = Number(/[\d.]+$/.exec(v)?.[0] ?? NaN);
      }
      i += whole.length;
      continue;
    }
    // Anything else: the token is dropped (a variable `$<name>`, `$ec1`, ...), its letters and number with it.
    const unknown = /^\$(?:<[^>]*>|[a-zA-Z@]*\d*[a-zA-Z]*\d*)/.exec(rest);
    i += Math.max(1, unknown?.[0].length ?? 1);
  }
  return out;
}

const TOKEN_ALL = /\$(\d*)([sSmMoOtTaAqQxXdDhHnNuUiI])([1-3])?(?![a-zA-Z(])/g;

/** Tidies what dropping a token left: doubled spaces, a space before punctuation. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([.,;:!%)])/g, "$1")
    .replace(/\( +/g, "(")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * A spell's description as its tooltip line: undefined without one. Plain text: the client's colour and other escape
 * sequences are removed (rule 2).
 */
export function spellText(spell: SpellInfo | undefined, spells: SpellLookup): string | undefined {
  const description = spell?.description;
  if (description === undefined || description === "") return undefined;
  const line = tidy(stripEscapes(fill(description, { self: spell!, spells, depth: 0 })));
  return line === "" ? undefined : line;
}
