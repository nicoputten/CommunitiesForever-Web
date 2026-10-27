/** Only paths on this site, so the sign-in can't be turned into a redirect elsewhere. */
export function localPath(value: string | string[] | undefined): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
