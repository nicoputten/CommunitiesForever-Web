import { describe, expect, it } from "vitest";
import { MONTH_SHORT, ordinal, WEEKDAY_SHORT } from "@/core/names";

// WEB-63: the one copy of the weekday and month names and ordinals.
describe("names", () => {
  it("counts weekdays from Sunday, as Date.getUTCDay does", () => {
    expect(WEEKDAY_SHORT[new Date(Date.UTC(2026, 9, 29)).getUTCDay()]).toBe("Thu");
    expect(MONTH_SHORT[9]).toBe("Oct");
  });

  it("writes ordinals, the teens with th", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111, 112, 113, 121].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "101st",
      "111th",
      "112th",
      "113th",
      "121st",
    ]);
  });
});
