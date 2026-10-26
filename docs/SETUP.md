# Setup: Battle.net sign-in

What a real Battle.net sign-in needs, locally and live. Tried for real on 2026-10-26 (the manual step of WEB-06).

## 1. Battle.net client
At https://develop.battle.net/access/clients, **Create client**:

| Field | Value |
|---|---|
| Client name | any, e.g. `Doombringers web` |
| Redirect URLs | `http://localhost:3000/api/auth/callback/battlenet` and `https://wow.vestras.nl/api/auth/callback/battlenet` (exactly, no trailing slash) |
| Service URL | optional; `https://wow.vestras.nl` |
| Intended use | a sentence, e.g. "Sign-in for a private website for my WoW guild; only the BattleTag is read." |

- No region on the client: one client works in every region. The code picks EU through the issuer `https://eu.battle.net/oauth` (`src/server/auth.ts`).
- No scopes on the client either: the code asks for `openid`, which gives the BattleTag in the ID token (`battle_tag`).
- The client id and secret go in `AUTH_BATTLENET_ID` and `AUTH_BATTLENET_SECRET`: `.env.local` locally, the TrueNAS app config live. Never in the repo or a chat.

## 2. `.env.local`
Copy `.env.example` to `.env.local` (gitignored) and fill in:

- `AUTH_SECRET`: 32+ random bytes in base64, e.g. `npx auth secret` or `node -e "console.log(require('crypto').randomBytes(33).toString('base64'))"`
- `AUTH_URL=http://localhost:3000`
- `ADMIN_BATTLETAG="Name#1234"`: **quoted**. Unquoted, dotenv reads everything from the `#` on as a comment, so the admin becomes `Name` and lands on "not on the list". (Environment variables set directly, as in the TrueNAS app config, need no quotes.)
- `AUTH_BATTLENET_ID`, `AUTH_BATTLENET_SECRET`

## 3. Run
```bash
npm ci --ignore-scripts   # on Windows without Visual Studio, see below
npm run dev
```
Open http://localhost:3000, sign in with Battle.net. The admin lands on `/`; a BattleTag not on the list lands on `/not-on-list`.

## Gotchas
- **`npm ci` fails on Windows without Visual Studio**: npm runs `node-gyp rebuild` for the approved `better-sqlite3` (it has a `binding.gyp`), which needs the C++ build tools. The package ships prebuilt binaries in `prebuilds/` and loads them anyway, so `npm ci --ignore-scripts` works (`docs/ARCHITECTURE.md` Stack). A `node_modules` from before WEB-06 lacks `next-auth` (`Can't resolve 'next-auth/jwt'`): reinstall.
- **Battle.net needs `state` and sends a `nonce`**: Auth.js sends only PKCE for OIDC providers by default. Battle.net then answers "400 The state parameter must be provided", and once `state` is sent, it puts its own `nonce` in the ID token, which Auth.js rejects ("unexpected ID Token nonce claim value", sign-in page with `error=Configuration`). Fixed with `checks: ["pkce", "state", "nonce"]` in `src/server/auth.ts`.
- **Another account**: Battle.net remembers the last login and ignores `prompt=login`, and its OIDC logout (`/oauth/logout`) answers 400. `https://eu.battle.net/login/logout?ref=<url>` does sign out and send the browser on to `<url>`; "Use another Battle.net account" on "not on the list" uses it (WEB-17, `battleNetLogoutUrl` in `src/server/auth.ts`).
- After changing `.env.local` the dev server reloads it ("Reload env"); restart `npm run dev` if the Battle.net client id or secret changed, as Auth.js reads them when it loads.
- `next dev` (Next.js 16.4) writes an untracked `AGENTS.md` in the repo root on every start; don't commit it by accident.
