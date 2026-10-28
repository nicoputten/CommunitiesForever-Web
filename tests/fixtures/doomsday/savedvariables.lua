CommunitiesForeverDB = {
  ["global"] = {
    ["schemaVersion"] = 2,
    ["settings"] = { ["clubId"] = 7, ["clubName"] = "Example Friends" },
    ["self"] = {
      ["battleTag"] = "Ada#1001",
      ["version"] = 1793220000,
      ["chars"] = {
        ["Player-1-0000A001"] = {
          ["name"] = "Ada Example", ["classFile"] = "MAGE", ["level"] = 42, ["faction"] = "Horde",
          ["updatedAt"] = 1793220000, ["riding"] = 75,
          ["pvp"] = { ["hk"] = 1234, ["rank"] = 6, ["rankName"] = "Stone Guard", ["weekKills"] = 61,
                      ["weekHonor"] = 4200, ["deaths"] = 101, ["duelsWon"] = 12, ["duelsLost"] = 4 },
        },
      },
      ["feed"] = {
        [20754] = {
          ["Player-1-0000A001"] = {
            ["name"] = "Ada Example", ["classFile"] = "MAGE", ["at"] = 1793219000, ["levelFrom"] = 41, ["levelTo"] = 42,
            ["quests"] = { ["Hillsbrad Foothills"] = 4 },
            ["kills"] = { ["Hillsbrad Foothills"] = 3, ["Arathi Basin"] = 2 },
            ["deaths"] = {
              { ["t"] = 1793212000, ["zone"] = "Hillsbrad Foothills", ["cause"] = "player" },
              { ["t"] = 1793213000, ["zone"] = "Alterac Mountains", ["cause"] = "fall" },
            },
            ["duels"] = { { ["t"] = 1793214000, ["won"] = true, ["vs"] = "Bob Example" } },
            ["loot"] = { ["rare"] = 2, ["epic"] = {
              { ["id"] = 12345, ["name"] = "Example Blade", ["slot"] = "INVTYPE_2HWEAPON", ["level"] = 42 },
            } },
            ["notable"] = { [12360] = 1 },
            ["gold"] = { ["gained"] = 15000, ["spent"] = 4000 },
            ["sessions"] = { { ["from"] = 1793205000, ["to"] = 1793219000 } },
            ["groups"] = { ["Player-1-0000B001"] = true },
            ["pvpKills"] = {
              { ["t"] = 1793211000, ["zone"] = "Hillsbrad Foothills", ["name"] = "Foe Example", ["lvl"] = 44,
                ["myLvl"] = 41, ["class"] = "PALADIN", ["race"] = "Human", ["rank"] = 2, ["solo"] = true, ["bg"] = false },
              { ["t"] = 1793211500, ["zone"] = "Hillsbrad Foothills", ["lvl"] = -1, ["myLvl"] = 41, ["solo"] = false },
              { ["t"] = 1793215000, ["zone"] = "Arathi Basin", ["name"] = "Other Example", ["myLvl"] = 42, ["bg"] = true },
            },
          },
        },
      },
      ["goals"] = {
        ["days"] = {
          [20754] = { ["set"] = { "d.quests10", "d.level", "d.dungeon", "hunt", "p.loneWolf" },
                      ["swapped"] = {}, ["done"] = { ["d.quests10"] = 1793216000, ["d.level"] = 1793219000 },
                      ["at"] = 1793219000 },
        },
        ["weeks"] = {
          [2965] = { ["set"] = { "w.days3", "w.quests50", "w.cap", "b.kills50" }, ["done"] = {}, ["at"] = 1793219000 },
        },
        ["streak"] = 3, ["best"] = 7, ["pool"] = 1, ["reset"] = 68400,
      },
    },
    ["people"] = {
      ["Bob#2002"] = {
        ["version"] = 1793218000, ["receivedAt"] = 1793218100,
        ["chars"] = {
          ["Player-1-0000B001"] = { ["name"] = "Bob Example", ["classFile"] = "ROGUE", ["level"] = 60,
                                    ["updatedAt"] = 1793218000, ["riding"] = 150, ["pvp"] = { ["hk"] = 0, ["rank"] = 0 } },
        },
        ["feed"] = {
          [20754] = {
            ["Player-1-0000B001"] = {
              ["name"] = "Bob Example", ["classFile"] = "ROGUE", ["at"] = 1793218000,
              ["duels"] = { { ["t"] = 1793214000, ["won"] = false, ["vs"] = "Ada Example" } },
              ["deaths"] = { { ["t"] = 1793214500, ["cause"] = "campfire" } },
            },
          },
        },
        ["goals"] = {
          ["days"] = {
            [20754] = { ["set"] = { "d.quests10", "d.altLevel", "d.dungeon", "hunt", "p.loneWolf" },
                        ["swapped"] = { ["d.altLevel"] = "d.level" }, ["done"] = {}, ["at"] = 1793218000 },
          },
          ["weeks"] = {},
          ["streak"] = 0, ["best"] = 2, ["pool"] = 1, ["reset"] = 68400,
        },
      },
      ["Cid#3003"] = {
        ["version"] = 1793100000,
        ["chars"] = { ["Player-1-0000C001"] = { ["name"] = "Cid Example", ["classFile"] = "PRIEST", ["level"] = 30,
                                                ["updatedAt"] = 1793100000 } },
        ["feed"] = { [20754] = { ["Player-1-0000C001"] = { ["at"] = 1793100000, ["levelFrom"] = 29, ["levelTo"] = 30 } } },
      },
    },
  },
}
