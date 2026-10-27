import type { CSSProperties } from "react";
import { classInfo } from "@/core/gamedata";
import type { CharacterView } from "@/core/views/characters";

/** The character's class text colour as `--class-text` (names on dark, DESIGN.md §3). */
export function classTextStyle(c: CharacterView): CSSProperties | undefined {
  const info = classInfo(c.classFile);
  return info === undefined ? undefined : ({ "--class-text": `var(${info.textToken})` } as CSSProperties);
}
