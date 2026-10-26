"use client";

import { useEffect } from "react";
import { pauseWhenHidden } from "./motion";

/** Once per page (root layout): pauses the ambient loops while the tab is hidden. Renders nothing. */
export function AmbientMotion() {
  useEffect(() => pauseWhenHidden(), []);
  return null;
}
