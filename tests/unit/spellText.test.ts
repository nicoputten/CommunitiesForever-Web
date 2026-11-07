import { describe, expect, it } from "vitest";
import { durationText, type SpellInfo, spellText } from "@/core/recipes/spellText";

// WEB-95: Use, Equip and Chance on hit lines from a spell's description and data. The texts have the shape of the
// client's (the same tokens in the same places); the spell IDs and numbers are made up (rule 7).

const HOUR = 3_600_000;
const spell = (description: string, over: Partial<SpellInfo> = {}): SpellInfo => ({
  description,
  effects: [],
  ...over,
});
const none = () => undefined;

describe("spellText", () => {
  it("an elixir: points and duration", () => {
    const elixir = spell("Increases armor by $s1 for $d.", { effects: [{ points: 40 }], duration: HOUR });
    expect(spellText(elixir, none)).toBe("Increases armor by 40 for 1 hour.");
    expect(spellText({ ...elixir, description: "Increases run speed by $s1% for $d1." }, none)).toBe(
      "Increases run speed by 40% for 1 hour.",
    );
  });

  it("a healing potion: its spread as a range", () => {
    const potion = spell("Restores $s1 health.", { effects: [{ points: 1000, variance: 0.5 }] });
    expect(spellText(potion, none)).toBe("Restores 750 to 1250 health.");
    // $m and $M: the points and the highest.
    expect(spellText({ ...potion, description: "From $m1 up to $M1." }, none)).toBe("From 1000 up to 1250.");
  });

  it("food and a bandage: the total over the duration, 5 sec ticks without a period", () => {
    const food = spell("Restores $o1 health over $d.  Must remain seated while eating.", {
      effects: [{ points: 100 }],
      duration: 30_000,
    });
    expect(spellText(food, none)).toBe("Restores 600 health over 30 sec. Must remain seated while eating.");
    expect(spellText({ ...food, duration: 21_000 }, none)).toBe(
      "Restores 420 health over 21 sec. Must remain seated while eating.",
    );
    const bandage = spell("Heals $o1 damage over $d.", { effects: [{ points: 50, period: 1000 }], duration: 8000 });
    expect(spellText(bandage, none)).toBe("Heals 400 damage over 8 sec.");
    const regen = spell("Regenerate $s1 health every $t1 sec for $d.", {
      effects: [{ points: 6, period: 5000 }],
      duration: 2 * HOUR,
    });
    expect(spellText(regen, none)).toBe("Regenerate 6 health every 5 sec for 2 hrs.");
  });

  it("a weapon proc: chance, another spell's numbers and duration, the proc cooldown", () => {
    const debuff = spell("", { effects: [{ points: -12 }], duration: 10_000 });
    const proc = spell(
      "When struck in combat has a $h% chance to reduce the attacker's armor by $90001s1 for $90001d. This effect can only occur once every $proccooldown sec.",
      { procChance: 5, procCooldown: 20_000 },
    );
    expect(spellText(proc, (id) => (id === 90001 ? debuff : undefined))).toBe(
      "When struck in combat has a 5% chance to reduce the attacker's armor by 12 for 10 sec. This effect can only occur once every 20 sec.",
    );
  });

  it("expressions, scaled tokens, another spell's description, plurals and conditions", () => {
    const base = spell("Restores $o1 health over $d.", { effects: [{ points: 10 }], duration: 20_000 });
    const lookup = (id: number) => (id === 90002 ? base : undefined);
    const fed = spell("$@spelldesc90002 If you eat for 10 sec, gain ${$s1/5} Stamina and ${$m2/100}.1% speed.", {
      effects: [{ points: 30 }, { points: 150 }],
    });
    expect(spellText(fed, lookup)).toBe(
      "Restores 40 health over 20 sec. If you eat for 10 sec, gain 6 Stamina and 1.5% speed.",
    );
    expect(spellText(spell("Lasts $/60;s1 min.", { effects: [{ points: 1800 }] }), none)).toBe("Lasts 30 min.");
    expect(spellText(spell("Removes $m1 poison $leffect:effects;.", { effects: [{ points: 1 }] }), none)).toBe(
      "Removes 1 poison effect.",
    );
    expect(spellText(spell("Removes $m1 $lcurse:curses;.", { effects: [{ points: 2 }] }), none)).toBe(
      "Removes 2 curses.",
    );
    expect(spellText(spell("Gives $ghis:her; allies water."), none)).toBe("Gives his/her allies water.");
    // A level ladder is read at the level cap; a talent or aura as not held.
    expect(spellText(spell("Gain $?$PL<30[10]?$PL<60[20][30] armor."), none)).toBe("Gain 30 armor.");
    expect(spellText(spell("Gain $?$PL>59[30][10] armor$?a90003[ and more][]."), none)).toBe("Gain 30 armor.");
    expect(
      spellText(spell("Hits up to $i targets within $a1 yards.", { maxTargets: 5, effects: [{ radius: 8 }] }), none),
    ).toBe("Hits up to 5 targets within 8 yards.");
  });

  it("keeps the line when a token can't be filled: the token goes, the spacing is tidied", () => {
    expect(spellText(spell("Increases Stamina by $ec1. Lasts $d."), none)).toBe("Increases Stamina by. Lasts.");
    expect(spellText(spell("Grants $<bonus> armor to $s1 allies.", { effects: [{ points: 3 }] }), none)).toBe(
      "Grants armor to 3 allies.",
    );
    // A spell that isn't there: its tokens go.
    expect(spellText(spell("Deals $90009s1 damage."), none)).toBe("Deals damage.");
    expect(spellText(spell("|cnIQ1:Test|r line."), none)).toBe("Test line.");
    expect(spellText(spell(""), none)).toBeUndefined();
    expect(spellText(undefined, none)).toBeUndefined();
  });

  it("never runs into itself", () => {
    const loop: SpellInfo = spell("A $@spelldesc90004");
    expect(spellText(loop, () => loop)).toBe("A A A A");
  });
});

describe("durationText", () => {
  it("in the tooltip's words", () => {
    expect([HOUR, 2 * HOUR, 120_000, 600_000, 15_000, 1500, 90 * 60_000, 0, -1, undefined].map(durationText)).toEqual([
      "1 hour",
      "2 hrs",
      "2 min",
      "10 min",
      "15 sec",
      "1.5 sec",
      "90 min",
      undefined,
      undefined,
      undefined,
    ]);
  });
});
