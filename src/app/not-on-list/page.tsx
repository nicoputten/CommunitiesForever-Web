import type { Metadata } from "next";
import { connection } from "next/server";
import { getSiteInfo } from "@/app/site";
import { SignInScene, StateButton, StatePanel, StateQuiet, StateText, Tag } from "@/components/signin/SignIn";
import { auth, signIn, signOut } from "@/server/auth";
import { adminName, forgetRefused, refusedBattleTag } from "@/server/refused";

// "Not on the list" (WEB-17, sign-in-states board): a refused sign-in lands here (src/server/auth.ts), and so does a
// session whose BattleTag left the list or was blocked (src/proxy.ts). A block reads the same as not being on the
// list. The BattleTag comes from the session, else from the refused sign-in's cookie (src/server/refused.ts).

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return { title: `Not on the list · ${getSiteInfo().name}` };
}

export default async function NotOnList() {
  await connection();
  const battleTag = (await auth())?.user?.name ?? (await refusedBattleTag());
  const site = getSiteInfo().name;
  const admin = adminName();

  const anotherAccount = async () => {
    "use server";
    await forgetRefused();
    await signOut({ redirect: false });
    // Battle.net remembers who signed in last; prompt=login asks it for the login form again.
    await signIn("battlenet", { redirectTo: "/signin/welcome" }, { prompt: "login" });
  };
  const leave = async () => {
    "use server";
    await forgetRefused();
    await signOut({ redirectTo: "/signin" });
  };

  return (
    <SignInScene>
      <StatePanel
        icon="refused"
        title="The gate stays closed"
        actions={
          <>
            <StateButton action={anotherAccount}>Use another Battle.net account</StateButton>
            <StateQuiet action={leave}>Sign out</StateQuiet>
          </>
        }
      >
        <StateText>
          {battleTag === undefined ? "This BattleTag" : <Tag>{battleTag}</Tag>} isn&apos;t on the {site} guest list.
        </StateText>
        <StateText small>
          {admin === undefined
            ? "Send the admin your BattleTag and they can add you."
            : `Send ${admin} your BattleTag and he can add you.`}{" "}
          Signed in with the wrong account?
        </StateText>
      </StatePanel>
    </SignInScene>
  );
}
