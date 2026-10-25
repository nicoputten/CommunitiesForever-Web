import { signIn } from "@/server/auth";

// Placeholder sign-in (WEB-06); the designed screen is WEB-17.

/** Only paths on this site, so the sign-in can't be turned into a redirect elsewhere. */
function localPath(value: string | string[] | undefined): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const params = await searchParams;
  const redirectTo = localPath(params.callbackUrl);
  const failed = params.error !== undefined;
  return (
    <main>
      <h1>CommunitiesForever</h1>
      <p>Sign in with your Battle.net account to see where everyone is.</p>
      {failed && <p role="alert">Signing in didn&apos;t work. Try again.</p>}
      <form
        action={async () => {
          "use server";
          await signIn("battlenet", { redirectTo });
        }}
      >
        <button type="submit">Sign in with Battle.net</button>
      </form>
    </main>
  );
}
