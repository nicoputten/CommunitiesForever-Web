import NextAuth from "next-auth";
import BattleNet from "next-auth/providers/battlenet";
import { maySignIn } from "@/core/access";
import { loadAccessList } from "./access";
import { getDb } from "./db";

// Auth.js with Battle.net, EU (WEB-06, docs/ARCHITECTURE.md "Access"). Battle.net gives the BattleTag and nothing
// else; who may sign in comes from the database (src/server/access.ts).
//
// Sessions are JWT cookies that hold only the BattleTag. The role is not in the cookie: src/proxy.ts and the route
// guards (src/server/session.ts) read it from the database on every request, so a block or a guest list removal
// takes effect at once without a session table.

/** Battle.net's EU OpenID issuer (https://eu.battle.net/oauth/.well-known/openid-configuration). */
export const BATTLENET_ISSUER = "https://eu.battle.net/oauth";

/** Days a session lasts without a visit. */
const SESSION_DAYS = 30;

/** The BattleTag claim: `battle_tag` in the ID token, `battletag` in the userinfo response. */
function battleTagOf(profile: Record<string, unknown> | undefined): string | undefined {
  const tag = profile?.battle_tag ?? profile?.battletag;
  return typeof tag === "string" && tag.trim() !== "" ? tag.trim() : undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    BattleNet({
      clientId: process.env.AUTH_BATTLENET_ID,
      clientSecret: process.env.AUTH_BATTLENET_SECRET,
      issuer: BATTLENET_ISSUER,
      // Only the BattleTag is needed; Battle.net knows no "profile" or "email" scope.
      authorization: { params: { scope: "openid" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: SESSION_DAYS * 24 * 60 * 60 },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    signIn({ profile }) {
      return maySignIn(battleTagOf(profile), loadAccessList(getDb())) ? true : "/not-on-list";
    },
    jwt({ token, profile }) {
      const tag = battleTagOf(profile);
      if (tag !== undefined) token.battleTag = tag;
      return token;
    },
    session({ session, token }) {
      if (typeof token.battleTag === "string") session.user = { ...session.user, name: token.battleTag };
      return session;
    },
  },
  // Behind the nginx reverse proxy (docs/ARCHITECTURE.md "Hosting"); AUTH_URL names the public origin.
  trustHost: true,
});
