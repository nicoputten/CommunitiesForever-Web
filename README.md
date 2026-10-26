# CommunitiesForever Web

Private website (`wow.vestras.nl`) that shows the data of the [CommunitiesForever](https://github.com/nicoputten/CommunitiesForever) World of Warcraft: Forever addon outside the game: alts, professions, and where characters were last seen.

Plan and status: `docs/STORIES.md`. How it fits together: `docs/ARCHITECTURE.md`.

## Local setup
Needs Node.js 24 LTS (`winget install OpenJS.NodeJS.LTS`).

```bash
npm ci
npx playwright install chromium   # once, for the end-to-end tests
npm run dev                       # http://localhost:3000
```

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run lint` | ESLint, Prettier check (code, not Markdown), TypeScript check |
| `npm run format` | Prettier write |
| `npm test` | unit and compat tests (Vitest) |
| `npm run build` | production build (standalone) |
| `npm run start` | runs the standalone build as the Docker image will |
| `npm run test:e2e` | Playwright on the production build, desktop and phone (build first) |

Configuration: copy `.env.example` to `.env.local`.
Signing in needs a Battle.net app (`AUTH_BATTLENET_ID`, `AUTH_BATTLENET_SECRET`, redirect URL `http://localhost:3000/api/auth/callback/battlenet`), `AUTH_SECRET` and your BattleTag as `ADMIN_BATTLETAG` (quoted: `"Name#1234"`); step by step in `docs/SETUP.md`. The tests don't need any of it: they sign in with a minted session cookie.

On Windows without Visual Studio, use `npm ci --ignore-scripts` (`better-sqlite3` would try to compile; its prebuilt binary works).
