// Who is looking at the page, as the shell needs it. WEB-06 fills it from the session (src/app/viewer.ts).

/** The roles of docs/ARCHITECTURE.md "Access". */
export type ViewerRole = "admin" | "member" | "guest";

export interface Viewer {
  battleTag: string;
  role: ViewerRole;
  /** Admin, members, and guests with "may upload" ticked: shows the Upload link. */
  mayUpload: boolean;
  /** WEB-64: the owner (ADMIN_BATTLETAG); `role` "admin" covers the owner and the admins they appointed. */
  owner?: boolean;
}
