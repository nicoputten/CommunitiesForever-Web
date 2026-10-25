import { auth, signOut } from "@/server/auth";

// Placeholder until the screens (WEB-17..29) exist.
export default async function Home() {
  const session = await auth();
  return (
    <main>
      <h1>CommunitiesForever</h1>
      <p>Nothing here yet.</p>
      {session?.user?.name && <p>Signed in as {session.user.name}.</p>}
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
