# Item import fixtures (WEB-90)

Invented data in the formats the item import reads (`src/core/recipes/build.ts`, `scripts/import-items.ts`): never
real game data and nothing copied from cmangos. Names, IDs and numbers are made up for the tests
(`tests/unit/recipesBuild.test.ts`); only the column names and the skill line IDs are the real ones.

- `forever/*.csv`: DB2 tables as wago.tools exports them (CSV, first line the header), only the columns the import
  reads.
- `era/*.csv`: the Classic Era client's SkillLineAbility and its learn-spell effects (SpellEffect, Effect 36).
- `cmangos.sql`: a MySQL dump in cmangos classic-db's layout (`CREATE TABLE`, then `INSERT INTO ... VALUES`), only the
  tables and columns the import reads.
