import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSiteInfo } from "@/app/site";
import { SignInPanel, SignInScene, StateButton, StatePanel, StateText } from "@/components/signin/SignIn";
import { signIn } from "@/server/auth";
import { localPath } from "./local-path";

// Sign-in (WEB-17, sign-in board): the site name from the data, the Battle.net button over the drifting map. After
// Battle.net the welcome step (/signin/welcome) shows who came back, then goes on to the page asked for. Auth.js sends
// its errors here (?error=…): a refusal goes to "not on the list", anything else is "Couldn't reach Battle.net".

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return { title: `Sign in · ${getSiteInfo().name}` };
}

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  await connection();
  const params = await searchParams;
  if (params.error === "AccessDenied") redirect("/not-on-list");
  const to = localPath(params.callbackUrl);
  const start = async () => {
    "use server";
    await signIn("battlenet", { redirectTo: `/signin/welcome?to=${encodeURIComponent(to)}` });
  };
  return (
    <SignInScene>
      {params.error === undefined ? (
        <SignInPanel siteName={getSiteInfo().name} action={start} />
      ) : (
        <StatePanel
          icon="error"
          title="Couldn't reach Battle.net"
          role="alert"
          actions={
            <StateButton action={start} primary>
              Try again
            </StateButton>
          }
        >
          <StateText>Sign-in was interrupted or timed out. Nothing is wrong with your account.</StateText>
        </StatePanel>
      )}
    </SignInScene>
  );
}
