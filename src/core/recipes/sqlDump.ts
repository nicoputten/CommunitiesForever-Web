// A MySQL dump as cmangos classic-db ships it (WEB-90, `Full_DB/ClassicDB_*.sql`): `CREATE TABLE` blocks with one
// column per line, then `INSERT INTO \`table\` VALUES (...),(...);`. Read as data only: values are numbers, strings
// (single quotes, backslash escapes, '' for a quote) or NULL. Nothing in it is executed.

export type SqlValue = number | string | null;
export type SqlRow = Record<string, SqlValue>;

/** The column names of each `CREATE TABLE` in the dump, in order. */
export function readColumns(sql: string, tables: readonly string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const table of tables) {
    const start = sql.indexOf(`CREATE TABLE \`${table}\` (`);
    if (start < 0) continue;
    const end = sql.indexOf("\n)", start);
    const body = sql.slice(start, end < 0 ? undefined : end);
    const columns: string[] = [];
    for (const line of body.split("\n").slice(1)) {
      const m = /^\s*`([^`]+)`\s/.exec(line);
      if (m !== null) columns.push(m[1]!);
    }
    out[table] = columns;
  }
  return out;
}

/** Every row the dump inserts into `table`, keyed by the table's columns. */
export function readRows(sql: string, table: string, columns: readonly string[]): SqlRow[] {
  const rows: SqlRow[] = [];
  const marker = `INSERT INTO \`${table}\` VALUES `;
  let at = sql.indexOf(marker);
  while (at >= 0) {
    const end = readValues(sql, at + marker.length, (values) => {
      const row: SqlRow = {};
      for (let i = 0; i < columns.length; i++) row[columns[i]!] = values[i] ?? null;
      rows.push(row);
    });
    at = sql.indexOf(marker, end);
  }
  return rows;
}

/** Reads `(..),(..);` from `i`; calls `each` per tuple; returns where it stopped. */
function readValues(sql: string, i: number, each: (values: SqlValue[]) => void): number {
  const n = sql.length;
  while (i < n) {
    while (i < n && (sql[i] === "," || sql[i] === " " || sql[i] === "\n" || sql[i] === "\r")) i++;
    if (sql[i] !== "(") return i;
    i++;
    const values: SqlValue[] = [];
    for (;;) {
      while (sql[i] === " ") i++;
      const ch = sql[i];
      if (ch === "'") {
        let s = "";
        i++;
        while (i < n) {
          const c = sql[i]!;
          if (c === "\\") {
            const next = sql[i + 1] ?? "";
            s += next === "n" ? "\n" : next === "r" ? "\r" : next === "t" ? "\t" : next === "0" ? "" : next;
            i += 2;
          } else if (c === "'") {
            if (sql[i + 1] === "'") {
              s += "'";
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            s += c;
            i++;
          }
        }
        values.push(s);
      } else {
        let j = i;
        while (j < n && sql[j] !== "," && sql[j] !== ")") j++;
        const raw = sql.slice(i, j).trim();
        values.push(raw === "NULL" ? null : Number(raw));
        i = j;
      }
      if (sql[i] === ",") {
        i++;
        continue;
      }
      if (sql[i] === ")") {
        i++;
        break;
      }
      return i; // malformed: stop reading this statement
    }
    each(values);
    if (sql[i] === ";") return i + 1;
  }
  return i;
}

/** A number column (NULL or text: undefined). */
export function n(row: SqlRow | undefined, key: string): number | undefined {
  const v = row?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** A text column. */
export function s(row: SqlRow | undefined, key: string): string | undefined {
  const v = row?.[key];
  return typeof v === "string" ? v : undefined;
}
