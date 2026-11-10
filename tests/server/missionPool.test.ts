import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { beforeRosters } from "./beforeRosters";
import { normalPlan } from "@/core/doomsday/missionPool";
import { dailyKind, dayStart, goal, pool, weekStart } from "@/core/doomsday/rules";
import { logParts } from "@/core/views/admin";
import { touchLastSeen } from "@/server/access";
import { appointAdmin, listLog, OwnerOnlyError } from "@/server/admins";
import { openDatabase, type Db } from "@/server/db";
import { doomsdayGoals } from "@/server/db/schema";
import {
  backToNormal,
  doomsdaySchedule,
  MissionLockedError,
  missionPool,
  pinMission,
  rerollDay,
  rerollMission,
  setMission,
} from "@/server/missionPool";
import { upload } from "@/server/uploads";

// WEB-78: the Mission pool on the server. Owner only, refused for a locked day or week, logged, and the plan stored
// so it never changes by itself. The realm zone is the default, Europe/Paris (CET in November), reset 19:00.

const OWNER = "Nico#1000";
const S = { offset: 3600, reset: 68400 };
const TODAY = 20766; // Mon 9 Nov
const NOW = dayStart(TODAY, S) + 3600;
const file = new TextEncoder().encode(
  `return { schemaVersion = 1, self = { battleTag = "${OWNER}", version = 1 }, settings = { clubId = 7 },
   people = { ["Ada#1001"] = { version = 1 }, ["Bob#2002"] = { version = 1 } } }`,
);

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cf-web-"));
  db = beforeRosters(openDatabase(path.join(dir, "test.sqlite")));
  expect(upload(db, file, OWNER, 1000, OWNER).status).toBe("ok");
  touchLastSeen(db, "Ada#1001", 1000);
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const logText = () =>
  listLog(db).map((e) => [e.by, ...logParts(e, (t) => t)].map((p) => (typeof p === "string" ? p : p.text)).join(""));

describe("owner only", () => {
  it("an admin or a friend can't change the pool or read the page", () => {
    appointAdmin(db, "Ada#1001", OWNER, NOW, OWNER);
    for (const by of ["Ada#1001", "Bob#2002"]) {
      expect(() => setMission(db, by, "d.quests10", { off: true }, NOW, OWNER)).toThrow(OwnerOnlyError);
      expect(() => pinMission(db, by, "day", TODAY + 3, 0, "d.quests20", NOW, OWNER)).toThrow(OwnerOnlyError);
      expect(() => rerollMission(db, by, "day", TODAY + 3, 0, NOW, OWNER)).toThrow(OwnerOnlyError);
      expect(() => rerollDay(db, by, "day", TODAY + 3, NOW, OWNER)).toThrow(OwnerOnlyError);
      expect(() => backToNormal(db, by, "day", TODAY + 3, NOW, OWNER)).toThrow(OwnerOnlyError);
      expect(() => missionPool(db, by, NOW, OWNER)).toThrow(OwnerOnlyError);
    }
    expect(new OwnerOnlyError().message).toMatch(/^Only the owner can do this/);
    // Pool version 6 (WEB-108): the site decides every day, so there is always a schedule, from yesterday to 16 ahead.
    const schedule = doomsdaySchedule(db, NOW)!;
    expect(Object.keys(schedule.days!).map(Number)).toEqual(Array.from({ length: 18 }, (_, i) => TODAY - 1 + i));
    expect(listLog(db)).toHaveLength(1); // only the appointment
  });
});

describe("the lock window", () => {
  it("refuses a change to today, tomorrow or a locked week, whatever the page shows", () => {
    for (const n of [TODAY - 1, TODAY, TODAY + 1, TODAY + 20])
      expect(() => pinMission(db, OWNER, "day", n, 0, "d.quests20", NOW, OWNER)).toThrow(MissionLockedError);
    expect(() => rerollDay(db, OWNER, "week", 2967, NOW, OWNER)).toThrow(MissionLockedError);
    // Next week locks 24 h before it starts (Sun 15 Nov 19:00).
    const nextWeek = dayStart(weekStart(2968), S);
    expect(() => rerollDay(db, OWNER, "week", 2968, nextWeek - 86400, OWNER, () => 0)).toThrow(MissionLockedError);
    rerollDay(db, OWNER, "week", 2968, nextWeek - 86400 - 60, OWNER, () => 0);
    expect(listLog(db)).toHaveLength(1);
  });

  it("freezes a day as it is when it locks: a later setting doesn't touch it", () => {
    const n = TODAY + 2;
    pinMission(db, OWNER, "day", n, 0, "d.secondary", NOW, OWNER);
    const later = NOW + 86400; // n is tomorrow now
    setMission(db, OWNER, "d.secondary", { off: true }, later, OWNER);
    expect(doomsdaySchedule(db, later)!.days![String(n)]!.daily![0]).toBe("d.secondary");
    // A free day doesn't have it any more.
    const free = doomsdaySchedule(db, later)!.days!;
    for (const [day, d] of Object.entries(free)) if (Number(day) > n) expect(d.daily).not.toContain("d.secondary");
  });
});

describe("steering and the schedule", () => {
  it("a pin goes into the schedule, every slot of the day; back to normal leaves { v }", () => {
    const n = TODAY + 3;
    const normal = normalPlan("day", n);
    // A daily of a theme the day doesn't have, and on neither day next to it.
    const near = [...normalPlan("day", n - 1), ...normal, ...normalPlan("day", n + 1)];
    const pin = pool("daily").find((id) => !near.includes(id) && !normal.some((x) => dailyKind(x) === dailyKind(id)))!;
    pinMission(db, OWNER, "day", n, 1, pin, NOW, OWNER);
    const day = doomsdaySchedule(db, NOW + 5)!.days![String(n)]!;
    expect(day).toMatchObject({ daily: [normal[0], pin, normal[2]], skirmish: normal[3], duel: normal[4], pool: 6 });
    expect(Object.keys(day.hunt!).sort()).toEqual(["Alliance", "Horde"]);
    expect(doomsdaySchedule(db, NOW + 5)!.v).toBe(NOW);
    backToNormal(db, OWNER, "day", n, NOW + 10, OWNER);
    const back = doomsdaySchedule(db, NOW + 20)!;
    expect(back.v).toBe(NOW + 10);
    expect(back.days![String(n)]!.daily).toEqual(normal.slice(0, 3));
    expect(logText()).toEqual([
      `${OWNER}set Thu 12 back to the normal draw`,
      `${OWNER}pinned ${goal(pin)!.text} on Thu 12`,
    ]);
  });

  it("a reroll is stored: the plan doesn't change by itself", () => {
    const n = TODAY + 4;
    rerollMission(db, OWNER, "day", n, 3, NOW, OWNER, () => 0.99);
    const first = doomsdaySchedule(db, NOW)!;
    const skirmish = first.days![String(n)]!.skirmish!;
    expect(skirmish).not.toBe(normalPlan("day", n)[3]);
    expect(doomsdaySchedule(db, NOW + 3600)).toEqual(first);
    expect(missionPool(db, OWNER, NOW, OWNER).overrides.day[n]).toEqual({ 3: { id: skirmish, kind: "reroll" } });
    expect(logText()).toEqual([`${OWNER}rerolled Skirmish on Fri 13`]);
  });

  it("settings: off and how often, logged with the mission's name; Often redraws the free days", () => {
    setMission(db, OWNER, "d.quests10", { off: true }, NOW, OWNER);
    setMission(db, OWNER, "d.skill5", { often: "often" }, NOW + 1, OWNER);
    setMission(db, OWNER, "d.skill5", { often: "often" }, NOW + 2, OWNER); // no change, no line
    const pool = missionPool(db, OWNER, NOW + 3, OWNER);
    expect(pool.settings).toEqual({
      "d.quests10": { off: true, often: "normal" },
      "d.skill5": { off: false, often: "often" },
    });
    const free = pool.plan.days.filter((d) => !d.locked);
    expect(free.every((d) => !d.plan.includes("d.quests10"))).toBe(true);
    for (const d of pool.plan.days.filter((x) => x.locked)) expect(d.plan).toEqual(d.normal);
    expect(logText()).toEqual([
      `${OWNER}set Earn 5 profession skill points to Often`,
      `${OWNER}switched off Finish 10 quests`,
    ]);
    expect(() => setMission(db, OWNER, "p.homeGuard", { off: true }, NOW, OWNER)).toThrow(/No such mission/);
  });

  it("a pin must fit its slot", () => {
    expect(() => pinMission(db, OWNER, "day", TODAY + 3, 3, "d.quests20", NOW, OWNER)).toThrow(/doesn't fit/);
    expect(() => pinMission(db, OWNER, "week", 2969, 0, "b.kills50", NOW, OWNER)).toThrow(/doesn't fit/);
    expect(goal("b.kills50")!.slot).toBe("bounty");
  });
});

describe("the page's data", () => {
  it("stats from the goal records, and who saw the normal draw on a changed day", () => {
    const n = TODAY + 2;
    pinMission(db, OWNER, "day", n, 0, "d.secondary", NOW, OWNER);
    const planned = doomsdaySchedule(db, NOW)!.days![String(n)]!;
    const normal = normalPlan("day", n);
    const record = (owner: string, set: string[]) =>
      db
        .insert(doomsdayGoals)
        .values({ owner, period: "day", n, at: NOW, sourceUpload: 1, data: { set, swapped: {}, done: {} } })
        .run();
    record("Bob#2002", [...normal]);
    record("Ada#1001", [...planned.daily!, planned.skirmish!]);
    const later = dayStart(n, S) + 60;
    const pool = missionPool(db, OWNER, later, OWNER);
    expect(pool.sawNormal).toEqual([{ period: "day", n, owners: ["Bob#2002"] }]);
    expect(pool.stats.get("d.secondary")).toMatchObject({ cameUp: 1, had: 1, done: 0, last: n });
    expect(pool.plan.days.find((d) => d.n === n)).toMatchObject({ locked: true, changed: true });
  });
});
