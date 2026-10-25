import type { Viewer, ViewerRole } from "@/components/shell/viewer";

// STUB until WEB-06: the signed-in user and their role. WEB-06 replaces the body of getViewer() with the Auth.js
// session and the access rules; its callers (the shell, the admin guard of /dev/components) stay as they are.
// Until then the viewer comes from DEV_VIEWER ("BattleTag#1234:role", .env.example); unset means signed out.

const ROLES: readonly ViewerRole[] = ["admin", "member", "guest"];

export async function getViewer(): Promise<Viewer | undefined> {
  const raw = process.env.DEV_VIEWER;
  if (raw === undefined || raw === "") return undefined;
  const at = raw.lastIndexOf(":");
  const battleTag = raw.slice(0, at);
  const role = raw.slice(at + 1) as ViewerRole;
  if (at <= 0 || !ROLES.includes(role)) return undefined;
  return { battleTag, role, mayUpload: role !== "guest" };
}

/** The admin guard: true for the admin. WEB-06 replaces it with its server-side role check. */
export async function isAdmin(): Promise<boolean> {
  return (await getViewer())?.role === "admin";
}
