// CSV as wago.tools exports DB2 tables (WEB-90): RFC 4180 (comma, double quotes, "" for a quote inside quotes),
// first line the header. A download can be cut off mid-row (the server resets long exports), so the reader keeps
// only whole rows and says where the last one ended.

export interface Csv {
  header: string[];
  /** Whole rows only, as objects keyed by the header. */
  rows: Record<string, string>[];
  /** Characters read up to the end of the last whole row (the header counts). */
  consumed: number;
}

/**
 * Reads CSV text. A row is whole once its line break is read (outside quotes), or at the end of the text when
 * `final` is true (a complete file without a trailing line break).
 */
export function parseCsv(text: string, final = true): Csv {
  const lines: string[][] = [];
  let consumed = 0;
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        cell += ch;
      }
      i++;
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      row.push(cell);
      lines.push(row);
      row = [];
      cell = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
      consumed = i + 1;
    } else {
      cell += ch;
    }
    i++;
  }
  if (final && !quoted && (cell !== "" || row.length > 0)) {
    row.push(cell);
    lines.push(row);
    consumed = n;
  }
  const header = lines.shift() ?? [];
  const rows: Record<string, string>[] = [];
  for (const line of lines) {
    // A short row is a cut-off one (or garbage): never half-read.
    if (line.length !== header.length) continue;
    const r: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) r[header[c]!] = line[c]!;
    rows.push(r);
  }
  return { header, rows, consumed };
}

/** An integer cell; anything else is undefined. */
export function int(row: Record<string, string> | undefined, key: string): number | undefined {
  const v = row?.[key];
  if (v === undefined || !/^-?\d+$/.test(v)) return undefined;
  return Number(v);
}

/** A float cell (`EffectBasePointsF`); anything else is undefined. */
export function float(row: Record<string, string> | undefined, key: string): number | undefined {
  const v = row?.[key];
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
