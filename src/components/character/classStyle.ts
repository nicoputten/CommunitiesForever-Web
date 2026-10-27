import type { CSSProperties } from "react";
import { classInfo } from "@/core/gamedata";

/** The class fill and text colour as `--class` and `--class-text` (DESIGN.md §3); undefined without a known class. */
export function classColours(classFile: string | undefined): CSSProperties | undefined {
  const info = classInfo(classFile);
  if (info === undefined) return undefined;
  return { "--class": `var(${info.colorToken})`, "--class-text": `var(${info.textToken})` } as CSSProperties;
}
