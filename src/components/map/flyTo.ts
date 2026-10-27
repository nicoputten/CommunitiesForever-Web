// Fly the map to a character (WEB-26, DESIGN.md §6) from anywhere on the map page: the roll call (WEB-27) and the
// phone sheet (WEB-28) are not inside MapStage, so they ask through a window event instead of a shared context.

export const FLY_EVENT = "cf-map-fly";

/** Selects the character and flies the map to it (600 ms pan + zoom to 4×; a jump without motion). */
export function flyToCharacter(guid: string) {
  window.dispatchEvent(new CustomEvent<string>(FLY_EVENT, { detail: guid }));
}
