import { describe, expect, it } from "vitest";
import { LUA_LIMITS, LuaParseError, parseLua, type LuaValue } from "@/core/lua";

function value(lua: string): LuaValue | undefined {
  return parseLua(`return ${lua}`).returned;
}

function parseError(text: string): LuaParseError {
  try {
    parseLua(text);
  } catch (e) {
    if (e instanceof LuaParseError) return e;
    throw e;
  }
  throw new Error("expected a LuaParseError");
}

describe("parseLua: chunks", () => {
  it("reads an assignment as the game writes it, with a leading blank line and CRLF", () => {
    const chunk = parseLua('\r\nCommunitiesForeverDB = {\r\n["global"] = {\r\n},\r\n}\r\n');
    expect(chunk).toEqual({ globals: { CommunitiesForeverDB: { global: {} } } });
    expect(chunk.returned).toBeUndefined();
  });

  it("reads several assignments, with and without semicolons", () => {
    expect(parseLua("A = 1; B = 'x'\nC = true").globals).toEqual({ A: 1, B: "x", C: true });
  });

  it("leaves out globals assigned nil and lets a later assignment win", () => {
    expect(parseLua("A = 1\nA = 2\nB = 3\nB = nil").globals).toEqual({ A: 2 });
  });

  it("reads a return statement after assignments", () => {
    expect(parseLua("A = 1\nreturn { 2 };")).toEqual({ globals: { A: 1 }, returned: [2] });
  });

  it("reads return nil as null", () => {
    expect(parseLua("return nil")).toEqual({ globals: {}, returned: null });
  });

  it("reads an empty file and a file with only comments", () => {
    expect(parseLua("")).toEqual({ globals: {} });
    expect(parseLua("-- nothing\n--[[ here ]]")).toEqual({ globals: {} });
  });

  it("skips a byte order mark", () => {
    expect(parseLua("﻿A = 1").globals).toEqual({ A: 1 });
  });
});

describe("parseLua: tables", () => {
  it("reads string keys, bare keys and number keys", () => {
    expect(value('{ ["a b"] = 1, c = 2, [818] = 3, [-1] = 4, [1.5] = 5 }')).toEqual({
      "a b": 1,
      c: 2,
      "818": 3,
      "-1": 4,
      "1.5": 5,
    });
  });

  it("reads positional items as an array", () => {
    expect(value('{ { ["name"] = "Affliction", ["points"] = 1 }, { name = "Demonology", points = 0 }, }')).toEqual([
      { name: "Affliction", points: 1 },
      { name: "Demonology", points: 0 },
    ]);
  });

  it("reads an empty table as an object", () => {
    expect(value("{}")).toEqual({});
    expect(value("{\r\n}")).toEqual({});
  });

  it("keeps explicit [1] keys as object keys", () => {
    expect(value('{ [1] = "a", [2] = "b" }')).toEqual({ "1": "a", "2": "b" });
  });

  it("gives positional items in a mixed table the keys 1, 2, ...", () => {
    expect(value('{ "a", x = 1, "b" }')).toEqual({ "1": "a", "2": "b", x: 1 });
  });

  it("keeps a positional nil as null in an array", () => {
    expect(value("{ 1, nil, 3 }")).toEqual([1, null, 3]);
  });

  it("leaves out keyed nil entries and positional nils in an object", () => {
    expect(value("{ a = nil, b = 1, nil }")).toEqual({ b: 1 });
  });

  it("lets a later key win, and keyed entries win over positional ones", () => {
    expect(value('{ a = 1, a = 2, ["a"] = 3 }')).toEqual({ a: 3 });
    expect(value('{ [1] = "keyed", "positional" }')).toEqual({ "1": "keyed" });
  });

  it("accepts ; as separator and a trailing separator", () => {
    expect(value("{ 1; 2, 3; }")).toEqual([1, 2, 3]);
  });

  it("stores __proto__ as an ordinary key", () => {
    const t = value('{ ["__proto__"] = { polluted = true }, ["constructor"] = 1 }') as Record<string, unknown>;
    expect(Object.keys(t)).toEqual(["__proto__", "constructor"]);
    expect(Object.getPrototypeOf(t)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("does not take a value name for a key", () => {
    expect(value("{ true, false, nil }")).toEqual([true, false, null]);
  });
});

describe("parseLua: strings", () => {
  it("reads both quote styles", () => {
    expect(value(`{ "double 'x'", 'single "x"' }`)).toEqual([`double 'x'`, `single "x"`]);
  });

  it("reads the simple escapes", () => {
    expect(value(String.raw`"\a\b\f\n\r\t\v\\\"\'"`)).toBe("\x07\b\f\n\r\t\v\\\"'");
  });

  it("reads decimal escapes", () => {
    expect(value(String.raw`"\0\65\066x\0491"`)).toBe("\0AB" + "x" + "11");
  });

  it("decodes decimal escapes above 127 as UTF-8", () => {
    expect(value(String.raw`"Caf\195\169 \226\128\148 ok"`)).toBe("Café — ok");
  });

  it("keeps raw UTF-8 text and WoW escape sequences as they are", () => {
    expect(value('"Mal\'Ganis |cffff0000red|r"')).toBe("Mal'Ganis |cffff0000red|r");
  });

  it("reads a backslash before a line break as a newline", () => {
    expect(value('"a\\\nb\\\r\nc"')).toBe("a\nb\nc");
  });

  it("rejects an escape above 255 and unknown escapes", () => {
    expect(parseError(String.raw`return "\256"`).reason).toBe("escape sequence too large");
    expect(parseError(String.raw`return "\q"`).reason).toBe("invalid escape '\\q'");
  });

  it("rejects a line break inside a string and an unfinished string", () => {
    expect(parseError('return "a\nb"').reason).toBe("unfinished string");
    expect(parseError('return "abc').reason).toBe("unfinished string");
  });

  it("rejects long strings", () => {
    expect(parseError("return [[x]]").reason).toBe("long strings are not supported");
  });
});

describe("parseLua: numbers, booleans, nil", () => {
  it.each([
    ["0", 0],
    ["42", 42],
    ["-7", -7],
    ["- 7", -7],
    ["509.1666259765625", 509.1666259765625],
    ["1083.333374023438", 1083.333374023438],
    [".5", 0.5],
    ["5.", 5],
    ["1e3", 1000],
    ["1.5E-2", 0.015],
    ["-2e+2", -200],
    ["0x1F", 31],
    ["-0xff", -255],
    ["1792614961", 1792614961],
  ])("reads %s", (lua, expected) => {
    expect(value(lua)).toBe(expected);
  });

  it.each(["1e", "0x", "12abc", "1.2.3", "-x", "--1"])("rejects %s", (lua) => {
    expect(() => parseLua(`return ${lua}`)).toThrow(LuaParseError);
  });

  it("reads booleans and nil", () => {
    expect(value("{ a = true, b = false }")).toEqual({ a: true, b: false });
    expect(value("nil")).toBeNull();
  });
});

describe("parseLua: comments", () => {
  it("skips line and block comments anywhere between tokens", () => {
    const lua = `-- header
A = { -- open
  [1] --[[ key ]] = --[==[ value ]] still ]==] "x", -- trailing
  b = 2 --[[ before close ]] }
-- end`;
    expect(parseLua(lua).globals).toEqual({ A: { "1": "x", b: 2 } });
  });

  it("does not treat -- inside a string as a comment", () => {
    expect(value('"a -- b"')).toBe("a -- b");
  });

  it("rejects an unfinished block comment", () => {
    expect(parseError("A = 1 --[[ open").reason).toBe("unfinished comment");
  });
});

describe("parseLua: errors carry line and column", () => {
  it.each([
    ["A = {\n  b = 1\n  c = 2\n}", "expected ',' or '}'", 3, 3],
    ["A = {\r\n  b = ,\r\n}", "unexpected ',', expected a value", 2, 7],
    ["A = {\r\n  b = 1,\r\n", "unexpected end of file, table opened here is not closed", 1, 5],
    ["A 1", "expected '=', got '1'", 1, 3],
    ["A = foo", "unexpected 'foo', expected a value", 1, 5],
    ["A.b = 1", "expected '=', got '.'", 1, 2],
    ["local A = 1", "unexpected 'local'", 1, 1],
    ["return 1\nA = 2", "expected end of file after return", 2, 1],
    ["A = { end = 1 }", "'end' cannot be a key without brackets", 1, 7],
    ["A = { [true] = 1 }", "only string and number keys are supported", 1, 8],
    ["A = { [{}] = 1 }", "only string and number keys are supported", 1, 8],
    ["A = { ['x' = 1 }", "expected ']', got '='", 1, 12],
    ["A =", "unexpected end of file, expected a value", 1, 4],
    ["A = function() end", "unexpected 'function', expected a value", 1, 5],
    ["os.exit()", "expected '=', got '.'", 1, 3],
  ])("%j", (text, reason, line, column) => {
    const e = parseError(text);
    expect(e).toMatchObject({ reason, line, column, name: "LuaParseError" });
    expect(e.message).toBe(`line ${line}, column ${column}: ${reason}`);
  });
});

describe("parseLua: limits", () => {
  it("rejects a file over the size limit", () => {
    const e = parseError(" ".repeat(LUA_LIMITS.maxLength + 1));
    expect(e).toMatchObject({ line: 0, column: 0 });
    expect(e.message).toBe(`file is larger than ${LUA_LIMITS.maxLength} characters`);
  });

  it("accepts a file at the size limit", () => {
    expect(parseLua("A = 1" + " ".repeat(LUA_LIMITS.maxLength - 5)).globals).toEqual({ A: 1 });
  });

  it("accepts tables at the depth limit and rejects one deeper", () => {
    const nested = (n: number) => "{".repeat(n) + "}".repeat(n);
    expect(() => parseLua(`return ${nested(LUA_LIMITS.maxDepth)}`)).not.toThrow();
    const e = parseError(`return ${nested(LUA_LIMITS.maxDepth + 1)}`);
    expect(e).toMatchObject({ reason: `tables nested deeper than ${LUA_LIMITS.maxDepth}`, line: 1 });
    expect(e.column).toBe(8 + LUA_LIMITS.maxDepth);
  });

  it("counts depth per path, not per table", () => {
    const wide = "{" + Array.from({ length: 100 }, () => "{{}}").join(",") + "}";
    expect(() => parseLua(`return ${wide}`)).not.toThrow();
  });

  it("accepts a string at the length limit and rejects a longer one", () => {
    expect(value(`"${"x".repeat(LUA_LIMITS.maxStringLength)}"`)).toHaveLength(LUA_LIMITS.maxStringLength);
    const e = parseError(`A = {\n  "${"x".repeat(LUA_LIMITS.maxStringLength + 1)}"}`);
    expect(e).toMatchObject({ reason: `string longer than ${LUA_LIMITS.maxStringLength} characters`, line: 2 });
    expect(e.column).toBe(3);
  });
});
