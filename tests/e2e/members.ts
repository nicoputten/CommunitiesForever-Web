// The members the upload page's tests sign in as, one per project (WEB-19). WEB-85: a member needs a character in the
// community, so each has one: the e2e seed puts it on the admin's roster, the admin's file names it, and every file of
// theirs keeps it.
export const E2E_MEMBERS: Record<string, { battleTag: string; guid: string }> = {
  desktop: { battleTag: "Desktop#4101", guid: "Player-1-0000E401" },
  phone: { battleTag: "Phone#4102", guid: "Player-1-0000E402" },
};
