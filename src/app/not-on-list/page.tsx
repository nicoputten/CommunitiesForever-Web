import { signOut } from "@/server/auth";

// Placeholder for a refused sign-in or a blocked BattleTag (WEB-06); the designed screen is WEB-17.

export default function NotOnList() {
  return (
    <main>
      <h1>You&apos;re not on the list</h1>
      <p>
        This site is for one in-game community. Members are added when someone in the community uploads their addon
        data; others need an invite from the admin.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button type="submit">Sign in with another account</button>
      </form>
    </main>
  );
}
