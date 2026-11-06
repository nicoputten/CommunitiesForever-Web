import { describe, expect, it } from "vitest";
import { parseCsv } from "@/core/recipes/csv";
import { readColumns, readRows } from "@/core/recipes/sqlDump";
import { difficulty, greenThreshold, thresholds } from "@/core/recipes/skill";

// WEB-90: the readers of the import's inputs, and the threshold maths.

describe("parseCsv", () => {
  it("reads quoted cells, doubled quotes and line breaks inside quotes", () => {
    const csv = parseCsv('ID,Name_lang\r\n1,"Bolt, ""Fine"""\r\n2,"Two\nlines"\r\n');
    expect(csv.header).toEqual(["ID", "Name_lang"]);
    expect(csv.rows).toEqual([
      { ID: "1", Name_lang: 'Bolt, "Fine"' },
      { ID: "2", Name_lang: "Two\nlines" },
    ]);
  });

  it("keeps only whole rows of a cut-off download and says where they end", () => {
    const text = 'ID,Name\n1,One\n2,"Tw';
    const csv = parseCsv(text, false);
    expect(csv.rows).toEqual([{ ID: "1", Name: "One" }]);
    expect(text.slice(0, csv.consumed)).toBe("ID,Name\n1,One\n");
    // A complete file without a trailing line break keeps its last row.
    expect(parseCsv("ID,Name\n1,One\n2,Two").rows).toHaveLength(2);
    // A short row is never half-read.
    expect(parseCsv("ID,Name\n1\n2,Two\n").rows).toEqual([{ ID: "2", Name: "Two" }]);
  });
});

describe("sql dump", () => {
  const sql = [
    "CREATE TABLE `t` (",
    "  `entry` int NOT NULL,",
    "  `name` varchar(10) NOT NULL DEFAULT '',",
    "  `chance` float,",
    "  PRIMARY KEY (`entry`)",
    ") ENGINE=MyISAM;",
    "INSERT INTO `t` VALUES (1,'It\\'s, (here)',0.5),(2,'a''b',NULL);",
    "INSERT INTO `other` VALUES (9,'no',1);",
    "INSERT INTO `t` VALUES (-3,'back\\\\slash',-1.5);",
  ].join("\n");

  it("reads the columns and every row of a table, as data", () => {
    const columns = readColumns(sql, ["t", "missing"]);
    expect(columns).toEqual({ t: ["entry", "name", "chance"] });
    expect(readRows(sql, "t", columns.t!)).toEqual([
      { entry: 1, name: "It's, (here)", chance: 0.5 },
      { entry: 2, name: "a'b", chance: null },
      { entry: -3, name: "back\\slash", chance: -1.5 },
    ]);
  });
});

describe("thresholds", () => {
  it("green is halfway between yellow and grey, rounded down", () => {
    expect(greenThreshold(35, 60)).toBe(47);
    expect(greenThreshold(310, 340)).toBe(325);
    expect(thresholds(1, 35, 60)).toEqual({ orange: 1, yellow: 35, green: 47, grey: 60 });
  });

  it("a character's colour for a recipe", () => {
    const t = thresholds(300, 310, 330);
    expect(difficulty(undefined, t)).toBeUndefined();
    expect(difficulty(299, t)).toBeUndefined();
    expect(difficulty(300, t)).toBe("orange");
    expect(difficulty(310, t)).toBe("yellow");
    expect(difficulty(320, t)).toBe("green");
    expect(difficulty(330, t)).toBe("grey");
  });
});
