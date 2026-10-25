// Parser for the Lua value subset a SavedVariables file uses. It reads data only and never executes anything
// (CLAUDE.md rule 2): a chunk is a list of `Name = value` assignments, optionally ending in `return value`.
// Values: tables, strings, numbers, booleans, nil. Lua 5.1 lexical rules (the game's Lua).
//
// Tables come out as follows:
// - only positional items (`{ a, b }`), at least one: an array; a positional nil becomes null
// - any `[key] =` or `key =` entry, or empty (`{}`): an object. Number keys become their decimal string
//   (`[818]` -> "818"); positional items in such a mixed table get the keys "1", "2", ... by position.
//   An entry whose value is nil is left out, as in Lua. A repeated key: the later keyed entry wins, and keyed
//   entries win over positional ones (the game never writes either).
// Keys other than strings and numbers are rejected. Key order is JS object order (integer-like keys first,
// ascending), not file order; the game writes keys in hash order anyway. Objects are created so that a key such as "__proto__"
// is an ordinary own property.

export type LuaValue = string | number | boolean | null | LuaValue[] | LuaTable;
export interface LuaTable {
  [key: string]: LuaValue;
}

export interface LuaChunk {
  /** Top-level `Name = value` assignments; nil values are left out. */
  globals: LuaTable;
  /** The value of a final `return value` statement; absent when the chunk has none. */
  returned?: LuaValue;
}

export const LUA_LIMITS = {
  /** Characters (UTF-16 code units) in the whole text. */
  maxLength: 5 * 1024 * 1024,
  /** Nesting depth of tables; the outermost table is depth 1. */
  maxDepth: 32,
  /** Characters in one string after unescaping. */
  maxStringLength: 64 * 1024,
};

export class LuaParseError extends Error {
  constructor(
    readonly reason: string,
    /** 1-based; 0 when the error has no position (size limit). */
    readonly line: number,
    readonly column: number,
  ) {
    super(line > 0 ? `line ${line}, column ${column}: ${reason}` : reason);
    this.name = "LuaParseError";
  }
}

const KEYWORDS = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
]);

const SIMPLE_ESCAPES: Record<string, string> = {
  a: "\x07",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
  "\\": "\\",
  '"': '"',
  "'": "'",
};

function isDigit(c: string | undefined): boolean {
  return c !== undefined && c >= "0" && c <= "9";
}

function isNameStart(c: string | undefined): boolean {
  return c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_");
}

function isNameChar(c: string | undefined): boolean {
  return isNameStart(c) || isDigit(c);
}

function setKey(target: LuaTable, key: string, value: LuaValue): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

/** Parses a SavedVariables file. Throws LuaParseError with line and column on invalid input or a broken limit. */
export function parseLua(text: string): LuaChunk {
  if (text.length > LUA_LIMITS.maxLength) {
    throw new LuaParseError(`file is larger than ${LUA_LIMITS.maxLength} characters`, 0, 0);
  }
  return new Parser(text).chunk();
}

class Parser {
  private pos = 0;
  private depth = 0;

  constructor(private readonly src: string) {
    if (src.charCodeAt(0) === 0xfeff) this.pos = 1;
  }

  chunk(): LuaChunk {
    const result: LuaChunk = { globals: {} };
    for (;;) {
      this.skip();
      if (this.pos >= this.src.length) return result;
      const start = this.pos;
      const name = this.name();
      if (name === "return") {
        result.returned = this.value();
        this.skip();
        if (this.peek() === ";") this.pos++;
        this.skip();
        if (this.pos < this.src.length) this.fail("expected end of file after return", this.pos);
        return result;
      }
      if (KEYWORDS.has(name)) this.fail(`unexpected '${name}'`, start);
      this.skip();
      this.expect("=");
      const value = this.value();
      if (value === null) delete result.globals[name];
      else setKey(result.globals, name, value);
      this.skip();
      if (this.peek() === ";") this.pos++;
    }
  }

  private value(): LuaValue {
    this.skip();
    const start = this.pos;
    const c = this.peek();
    if (c === "{") return this.table();
    if (c === '"' || c === "'") return this.string();
    if (c === "-") {
      this.pos++;
      this.skip();
      if (!isDigit(this.peek()) && !(this.peek() === "." && isDigit(this.peek(1)))) {
        this.fail("expected a number after '-'", this.pos);
      }
      return -this.number();
    }
    if (isDigit(c) || (c === "." && isDigit(this.peek(1)))) return this.number();
    if (c === "[" && (this.peek(1) === "[" || this.peek(1) === "=")) this.fail("long strings are not supported", start);
    if (isNameStart(c)) {
      const word = this.name();
      if (word === "true") return true;
      if (word === "false") return false;
      if (word === "nil") return null;
      this.fail(`unexpected '${word}', expected a value`, start);
    }
    if (c === undefined) this.fail("unexpected end of file, expected a value", start);
    this.fail(`unexpected '${c}', expected a value`, start);
  }

  private table(): LuaValue[] | LuaTable {
    const open = this.pos;
    if (++this.depth > LUA_LIMITS.maxDepth) this.fail(`tables nested deeper than ${LUA_LIMITS.maxDepth}`, open);
    this.pos++;
    const positional: LuaValue[] = [];
    const keyed: [string, LuaValue][] = [];
    for (;;) {
      this.skip();
      const c = this.peek();
      if (c === "}") {
        this.pos++;
        break;
      }
      if (c === undefined) this.fail("unexpected end of file, table opened here is not closed", open);
      if (c === "[" && this.peek(1) !== "[" && this.peek(1) !== "=") {
        keyed.push([this.bracketKey(), this.afterEquals()]);
      } else if (isNameStart(c) && this.isBareKey()) {
        const start = this.pos;
        const name = this.name();
        if (KEYWORDS.has(name)) this.fail(`'${name}' cannot be a key without brackets`, start);
        keyed.push([name, this.afterEquals()]);
      } else {
        positional.push(this.value());
      }
      this.skip();
      const sep = this.peek();
      if (sep === "," || sep === ";") this.pos++;
      else if (sep !== "}") this.fail("expected ',' or '}'", this.pos);
    }
    this.depth--;

    if (keyed.length === 0 && positional.length > 0) return positional;
    const table: LuaTable = {};
    positional.forEach((v, i) => {
      if (v !== null) setKey(table, String(i + 1), v);
    });
    for (const [k, v] of keyed) {
      if (v === null) delete table[k];
      else setKey(table, k, v);
    }
    return table;
  }

  /** At a name: true when `name =` follows (a bare key), false for a value such as `true`. */
  private isBareKey(): boolean {
    let p = this.pos;
    while (isNameChar(this.src[p])) p++;
    while (p < this.src.length && /\s/.test(this.src[p] ?? "")) p++;
    return this.src[p] === "=" && this.src[p + 1] !== "=";
  }

  private bracketKey(): string {
    this.pos++;
    this.skip();
    const start = this.pos;
    const key = this.value();
    if (typeof key === "string") {
      // fall through
    } else if (typeof key === "number") {
      if (Number.isNaN(key)) this.fail("NaN cannot be a key", start);
    } else {
      this.fail("only string and number keys are supported", start);
    }
    this.skip();
    this.expect("]");
    return String(key);
  }

  private afterEquals(): LuaValue {
    this.skip();
    this.expect("=");
    return this.value();
  }

  private name(): string {
    const start = this.pos;
    if (!isNameStart(this.peek())) {
      const c = this.peek();
      this.fail(c === undefined ? "unexpected end of file" : `unexpected '${c}', expected a name`, start);
    }
    while (isNameChar(this.peek())) this.pos++;
    return this.src.slice(start, this.pos);
  }

  private number(): number {
    const start = this.pos;
    let n: number;
    if (this.peek() === "0" && (this.peek(1) === "x" || this.peek(1) === "X")) {
      this.pos += 2;
      const digits = this.pos;
      while (/[0-9a-fA-F]/.test(this.peek() ?? "")) this.pos++;
      if (this.pos === digits) this.fail("malformed number", start);
      n = parseInt(this.src.slice(digits, this.pos), 16);
    } else {
      while (isDigit(this.peek())) this.pos++;
      if (this.peek() === ".") {
        this.pos++;
        while (isDigit(this.peek())) this.pos++;
      }
      if (this.peek() === "e" || this.peek() === "E") {
        this.pos++;
        if (this.peek() === "+" || this.peek() === "-") this.pos++;
        if (!isDigit(this.peek())) this.fail("malformed number", start);
        while (isDigit(this.peek())) this.pos++;
      }
      n = Number(this.src.slice(start, this.pos));
    }
    if (isNameChar(this.peek()) || this.peek() === ".") this.fail("malformed number", start);
    return n;
  }

  private string(): string {
    const start = this.pos;
    const quote = this.src[this.pos++];
    let out = "";
    let bytes: number[] = [];
    // \ddd escapes are bytes; consecutive ones above 127 form UTF-8 sequences and are decoded together.
    const flush = () => {
      if (bytes.length > 0) {
        out += new TextDecoder().decode(new Uint8Array(bytes));
        bytes = [];
      }
    };
    for (;;) {
      const c = this.src[this.pos];
      if (c === undefined || c === "\n" || c === "\r") this.fail("unfinished string", start);
      if (c === quote) {
        this.pos++;
        break;
      }
      if (c !== "\\") {
        flush();
        out += c;
        this.pos++;
      } else {
        const escStart = this.pos;
        const e = this.src[++this.pos];
        if (isDigit(e)) {
          let digits = "";
          while (digits.length < 3 && isDigit(this.src[this.pos])) digits += this.src[this.pos++];
          const byte = Number(digits);
          if (byte > 255) this.fail("escape sequence too large", escStart);
          if (byte < 128) {
            flush();
            out += String.fromCharCode(byte);
          } else {
            bytes.push(byte);
          }
        } else if (e === "\n" || e === "\r") {
          // A backslash before a line break is a newline (Lua 5.1 %q writes newlines this way).
          flush();
          out += "\n";
          this.pos++;
          const next = this.src[this.pos];
          if ((next === "\n" || next === "\r") && next !== e) this.pos++;
        } else if (e !== undefined && e in SIMPLE_ESCAPES) {
          flush();
          out += SIMPLE_ESCAPES[e];
          this.pos++;
        } else {
          this.fail(e === undefined ? "unfinished string" : `invalid escape '\\${e}'`, escStart);
        }
      }
      if (out.length + bytes.length > LUA_LIMITS.maxStringLength) {
        this.fail(`string longer than ${LUA_LIMITS.maxStringLength} characters`, start);
      }
    }
    flush();
    if (out.length > LUA_LIMITS.maxStringLength) {
      this.fail(`string longer than ${LUA_LIMITS.maxStringLength} characters`, start);
    }
    return out;
  }

  /** Skips whitespace, `--` line comments and `--[[ ]]` / `--[==[ ]==]` block comments. */
  private skip(): void {
    for (;;) {
      const c = this.src[this.pos];
      if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v") {
        this.pos++;
      } else if (c === "-" && this.src[this.pos + 1] === "-") {
        const start = this.pos;
        this.pos += 2;
        const level = this.longBracketLevel();
        if (level >= 0) {
          const close = "]" + "=".repeat(level) + "]";
          const end = this.src.indexOf(close, this.pos);
          if (end < 0) this.fail("unfinished comment", start);
          this.pos = end + close.length;
        } else {
          while (this.pos < this.src.length && this.src[this.pos] !== "\n" && this.src[this.pos] !== "\r") {
            this.pos++;
          }
        }
      } else {
        return;
      }
    }
  }

  /** At `[`, `[=`, `[==`...: when a long bracket opens here, consumes it and returns its level, else -1. */
  private longBracketLevel(): number {
    if (this.src[this.pos] !== "[") return -1;
    let p = this.pos + 1;
    while (this.src[p] === "=") p++;
    if (this.src[p] !== "[") return -1;
    const level = p - this.pos - 1;
    this.pos = p + 1;
    return level;
  }

  private peek(offset = 0): string | undefined {
    return this.src[this.pos + offset];
  }

  private expect(c: string): void {
    if (this.peek() !== c) {
      const got = this.peek();
      this.fail(got === undefined ? `expected '${c}', got end of file` : `expected '${c}', got '${got}'`, this.pos);
    }
    this.pos++;
  }

  private fail(reason: string, offset: number): never {
    let line = 1;
    let lineStart = 0;
    for (let i = 0; i < offset && i < this.src.length; i++) {
      const c = this.src[i];
      if (c === "\n" || (c === "\r" && this.src[i + 1] !== "\n")) {
        line++;
        lineStart = i + 1;
      }
    }
    throw new LuaParseError(reason, line, offset - lineStart + 1);
  }
}
