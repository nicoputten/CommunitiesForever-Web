# Bot API

The contract between this site and the Discord bot ([CommunitiesForever-Discord](https://github.com/nicoputten/CommunitiesForever-Discord)). This repo owns it, as `docs/UPLOADER-API.md` is for the uploader. The site is the bot's only data source: it decides what is worth posting (milestones, runs, the recap) and who is linked; the bot formats and posts.

Status: **v1** (WEB-38, 2026-10-27). Built: the token, `settings`, the event feed and acknowledging, `milestones` events, run events and run actions (WEB-40), and `runEnded`, `askNow` and `ping` from uploads (WEB-43); asks stored on the site, `/ask` and answering asks (WEB-51).

**Versioning.** Within v1 changes are additive only: new optional fields, new event types, new endpoints, new error codes. The bot ignores fields and event types it doesn't know and acts on `error` codes it knows. A breaking change gets `/v2/`.

## Principles
- One bot, one token. All endpoints are under `/api/bot/v1/`, HTTPS, JSON, `Cache-Control: no-store`. Times are Unix seconds (UTC).
- `Authorization: Bearer <token>` ([RFC 6750](https://www.rfc-editor.org/rfc/rfc6750)) on every call. Session cookies are not accepted here, and the bot token nowhere else (CLAUDE.md rule 6).
- The bot opens no port: it asks the site (a long poll), so new events reach it within about a second.
- Names only. Payloads carry character names and friends' display names, never BattleTags (the posts are for a Discord channel).
- Errors look like the uploader API's: `{ "error": "<code>", "error_description": "<text for logs>" }`.

```json
{ "error": "invalid_token", "error_description": "Unknown or revoked token." }
```

| Status | `error` | When |
|---|---|---|
| 401 | `invalid_request` | No `Authorization: Bearer` header (with `WWW-Authenticate: Bearer realm="bot"`) |
| 401 | `invalid_token` | Not the active bot token: unknown, revoked, or another kind of token |
| 400 | `invalid_cursor` | `after` is not a cursor |
| 400 | `invalid_request` | `posted` without a valid `messageId` |
| 404 | `unknown_event` | `posted` for an event that doesn't exist |
| 409 | `already_posted` | `posted` again with another message id |
| 410 | `expired` | `posted` for an event older than 7 days |

## Token
- `cfb_` and 32 random bytes in base64url (47 characters). The site stores only its SHA-256 and shows it once.
- One active token: making a new one ends the old one. It doesn't expire; it is revoked.
- The admin makes, replaces and revokes it on the Discord page (`/discord`, "Bot token", WEB-39); it is shown once. The page shows the bot online while it called in the last minute.
- The token goes into the bot's environment (never into a repo, CLAUDE.md rule 7).

## Settings
`GET /api/bot/v1/settings` → `200`:

```json
{
  "apiVersion": 1,
  "siteName": "Doombringers",
  "longPollSeconds": 30,
  "eventTtlSeconds": 604800,
  "posts": { "milestones": true, "runs": true, "recap": true },
  "channels": { "posts": null, "recap": null, "runs": null },
  "mentionRole": null,
  "recap": { "day": 0, "time": "13:00", "timeZone": "Europe/Amsterdam" },
  "runs": { "reminders": true, "reminderMinutes": 30, "startingNow": true, "askNow": true, "markDone": true }
}
```

- `posts`: which post types are on (the admin's switches on the Discord page, WEB-39). `posts.milestones` off also means no milestone events are made.
- Added in WEB-39, optional (older sites leave them out):
  - `channels`: Discord channel ids (snowflakes as text) per kind, `null` until the admin picked one.
  - `mentionRole`: the role mentioned on new runs, or `null`.
  - `recap`: weekday (`0` Sunday … `6` Saturday) and `HH:MM` in `timeZone` (the admin's IANA time zone, `UTC` without one).
  - `runs`: reminders on or off, minutes before the start (15, 30, 60 or 120), `startingNow` (always `true`), ask now from the game, mark runs done from uploads.

## Events
`GET /api/bot/v1/events?after=<cursor>` → `200`:

```json
{
  "events": [
    {
      "id": 12,
      "type": "milestones",
      "createdAt": 1793112000,
      "data": {
        "uploadId": 40,
        "uploadedAt": 1793112000,
        "milestones": [
          {
            "kind": "maxLevel",
            "character": { "guid": "Player-1-MIRA", "name": "Mira Sunstrider", "classFile": "MAGE", "level": 60, "ownerName": "Mira" },
            "level": 60,
            "from": 58
          }
        ]
      }
    }
  ],
  "cursor": "12"
}
```

- **Long poll.** When there are events after the cursor that the bot hasn't acknowledged, the answer comes at once (oldest first, at most 50). Otherwise the site holds the request until an upload makes one or `longPollSeconds` (30) pass, and then answers `{ "events": [], "cursor": <the same> }`. The bot asks again right away. Its HTTP timeout must be longer than 30 s (nginx's 60 s is).
- **Cursor.** The id of the last event handed out, as text; send it as `after` next time. Without `after` (or `0`) the feed starts from the oldest event not yet acknowledged. A restarted bot can start there: acknowledged events never come again.
- **Handed out until acknowledged.** An event comes again (from cursor `0`) until the bot acknowledges it.
- **7 days.** Events not acknowledged within 7 days (`eventTtlSeconds`) are no longer handed out, so a bot that was offline doesn't flood the channel with old news (decided with Nico, 2026-10-27).
- Event types the bot doesn't know: acknowledge them without posting, or leave them; they expire.

## Acknowledging
`POST /api/bot/v1/events/<id>/posted` with `{ "messageId": "1100000000000000001" }` (the Discord message id, digits) → `200 { "id": 12, "messageId": "1100000000000000001" }`.

- From then on the event is never handed out again.
- The same acknowledgement again is fine (a retry after a lost answer). Another `messageId` for the same event is `409 already_posted`.
- Several events may be acknowledged with the same `messageId`: the bot groups milestones from uploads within a few minutes into one message by editing it (bot BOT-09).
- **Posting once.** Post, then acknowledge. If the bot stops between the two, the event comes again; the bot avoids a second post by remembering what it posted (e.g. the event id in the message) before acknowledging. The site never hands out an acknowledged event.

## Guild (built, WEB-46)
`POST /api/bot/v1/guild` with the Discord server's channels and roles, so the site's Discord page can offer them in its dropdowns:

```json
{
  "channels": [{ "id": "1100000000000000010", "name": "general" }],
  "roles": [{ "id": "1100000000000000020", "name": "Raiders" }]
}
```

→ `200 { "channels": 1, "roles": 1 }`.

- `channels`: the text channels the bot may post in; `roles`: the roles it may mention. Both lists in Discord's own order; each item an `id` (a snowflake as text) and a `name`. The bot decides what to include (BOT-08).
- Send it when the bot connects and whenever the server's channels or roles change. Each report replaces the last one whole.
- At most 500 channels and 250 roles; names are text only (control characters removed, 100 characters at most). Anything else, a missing list, an id twice: `400 invalid_request`, and nothing changes.
- A channel or role the admin picked that is no longer reported stays picked: the page shows it as removed, and `settings` keeps its id until the admin picks another.
- Optional within v1: a site without it answers `404`; the bot carries on without reporting.

## Card images (built, WEB-41d)
`GET /api/bot/v1/cards/<id>.png` → `200 image/png` (`Cache-Control: private, max-age=86400`), for the bot to attach to a post. `404 not_found` for an id the site can't draw. Rendered by the site in its own style (Nico's references in `design/cards/`); a card that shows the map carries its credit ("Map: Syrio, CC BY-SA 4.0").

| id | Size | When it exists |
|---|---|---|
| `recap-<week>-header` | 1200 × 400 | every stored recap: the award winner, else the busiest zone, else the headline |
| `recap-<week>-zone` | 800 × 400 | a recap with the Zone of the week card (`S1`) |
| `milestone-<event>-<n>` | 800 × 400 | the `n`-th milestone (from 0) of a `milestones` event when it is a `maxLevel`, a `newCharacter` at level 60, or a `professionCap` at 300 |
| `whereis-<guid>` | 800 × 400 | a character the site has seen in a zone the map draws (for `/whereis`): the newest sighting and up to two earlier ones |

Optional within v1: an older site answers 404 and the bot posts text only.

## Look-ups (built, WEB-39b)
`GET /api/bot/v1/lookup/<what>?discordUserId=<id>&…` → `200` the data of the bot's look-up commands (board `bot-commands-runs`); the bot formats it. Answered for anyone in the bot's server: only friends are in it (Nico, 2026-10-28, as for `/recap`). Only `me` needs the asker linked (WEB-39) to someone on the list who may sign in: `400 invalid_request` without `discordUserId`, `403 not_linked` otherwise (the bot then shows "Link your Discord first"). `404 no_data` before the first upload, `404 not_found` for an unknown friend, character or look-up.

With a linked `discordUserId`, every answer has `asker`: the asker's display name (for the bot's "Shared by …"); without one it is left out. A character is `{ guid, name, owner?, classFile?, className?, race?, level?, role? ("tank" | "heal" | "dps"), spec?, ilvl?, talents? (points per tree), professions: [{ name, rank, max? }], seen?: { zone, at } }`: full names, the owner's display name, never a BattleTag. `seen.zone` is the map's zone name (a dungeon's name inside one).

| `<what>` | Parameters | Answer |
|---|---|---|
| `names` | `q`, `kind` (`friend`, `character`, both when left out) | `{ names: [{ kind, name, value }] }`, at most 25: friends by display name (`value` = the name), characters by full name (`value` = GUID), for autocomplete |
| `professions` | | `{ professions: [name] }`: every profession anyone has |
| `whereis` | `friend` (display name) or `character` (GUID or full name) | `{ friend?, characters, card? }`: newest sighting first; `card` is the GUID for `cards/whereis-<guid>.png` |
| `who` | `level` (`30-40` or `35`), `role` (`tank`, `healer`, `damage`), `class` (classFile), `recent=true` (seen in the last 24 hours) | `{ total, characters }`: highest level first, at most 15 |
| `whocancraft` | `profession` | `{ profession, crafters: [character + { rank, max?, best }] }`: best first, `best` for the highest rank |
| `character` | `name` (GUID or full name) | `{ character }` |
| `alts` | `friend` (display name) | `{ friend, characters }`: highest level first |
| `me` | | `{ friend, characters, week? }`: the asker's characters; `week: { levels, quests, runs }` from the activity feed of the last 7 days, only when they share their activity |

Optional within v1: an older site answers 404 and the bot says the look-up isn't available.

## Event types

### `milestones` (built, WEB-38)
One event per accepted upload that reached at least one milestone. `data`: `uploadId`, `uploadedAt`, `milestones` (sorted: `maxLevel`, `level`, `professionCap`, `newCharacter`, then by name). Every milestone has `kind` and `character`:

| Field | |
|---|---|
| `character.guid` | the character's key |
| `character.name`, `classFile`, `level` | as the site knows it after the upload (optional) |
| `character.ownerName` | the friend's display name (optional) |

| `kind` | Extra fields | When |
|---|---|---|
| `level` | `level` (10, 20 … 50), `from` | A level up crossed a multiple of 10: one milestone for the highest one crossed (18 → 31 is 30) |
| `maxLevel` | `level` (60), `from` | Reached the level cap; never also a `level` milestone |
| `professionCap` | `skillLine`, `profession` (optional), `rank` | A profession's rank rose to the cap of its training rank (75/75, 150/150, 225/225, 300/300). Training a higher cap (75/75 → 75/150) is not one |
| `newCharacter` | | A character the group didn't know (or knew only by name). Its level and professions are part of it, not milestones of their own |

Decided with Nico (2026-10-27): the site's first accepted upload makes no milestones (everything would be new). After that every accepted upload counts, also a newcomer's first data. A rebuild of the uploads never makes events again.

### `test` (built, WEB-39)
The admin's "Send a test post" on the Discord page. `data`: `{ "kind": "posts" }` (the channel for posts). The bot posts a short test message there and acknowledges it like any event. A bot that doesn't know the type skips it (and still acknowledges it, so it isn't handed out again).

### `recap` (built, WEB-41c)
The weekly recap, once per week at the recap moment (the Discord page's day and time in the admin's time zone; default Sunday 13:00), when the page's Weekly recap is on. `data` is the recap as it is to be posted:

| Field | |
|---|---|
| `week` | 1 for the first recap after launch |
| `start`, `end` | the week, Unix seconds, `[start, end)` |
| `quiet` | under 3 levels in total: the short recap (no award, one card) |
| `headline` | `{ id, text }` |
| `numbers` | `{ levels, friendsPlayed, runs, newCharacters }` |
| `award` | optional: `{ id, slot: "award", name ("<site> of the week · The Grinder"), title, text, facts, friends }` |
| `cards` | up to 4 cards in slot order (`stat`, `progress`, `social`, `fun`), each `{ id, slot, name, title, text, facts, friends }` |
| `challenge` | `{ id, text }` |
| `closing` | a closing line |

- Texts are finished: the bot posts them as they are. `||…||` is a Discord spoiler (the answer of "Who am I?").
- `facts` are the values the texts were made from (for images and later layouts); `friends` are person keys, never shown.
- Card ids are the board's catalogue (A1 … F13). Names only: never a BattleTag.

`GET /api/bot/v1/recap/latest` → `200` the last recap in the same shape (for `/recap`), `404 no_recap` before the first one.

### Run events (built, WEB-40)
Written when the admin's Runs switch is on (WEB-39); the reminders have their own switch. Each `data` has `run`, the run as it is at that moment; a test post from the Discord page has `"test": true` and `run.id` 0 (nothing was planned).

```json
{
  "run": {
    "id": 7,
    "dungeon": { "id": "sm-armory", "name": "Scarlet Monastery: Armory", "typicalLevels": { "min": 32, "max": 42 } },
    "startsAt": 1793131200,
    "note": "Bring water, we clear the courtyard first.",
    "organiser": { "name": "Nico", "character": "Ves Doombringer", "discordId": "100000000000000001" },
    "source": "website",
    "state": "open",
    "open": { "tank": 1, "healer": 0, "damage": 1 },
    "counts": { "in": 3, "maybe": 1, "cant": 0 },
    "answers": [
      { "name": "Femke", "character": "Lia Thornwhisper", "discordId": "100000000000000003", "answer": "in", "role": "healer", "source": "discord" },
      { "name": "Bob", "character": "Tok Ironhide", "guid": "Player-1-0000B002", "fit": { "kind": "fits", "label": "fits" }, "answer": "maybe", "role": "healer", "source": "website", "reserve": true, "waitlisted": true }
    ]
  }
}
```

- `startsAt` is UTC: the bot shows it with Discord's timestamp markup (`<t:1793131200:f>`), which every reader sees in their own time.
- `state`: `open`, `full`, `started` (from start time), `past` (2 hours after start), `cancelled`.
- `open`: free slots per role (one tank, one healer, three damage). `answers`, oldest first: `answer` is `in`, `maybe` or `cant`; `role` the slot the character fills (from talents or set by the player; unknown is `damage`); `waitlisted`: answered I'm in while the role was full, first in line; `movedUp`: moved up from Maybe. `note`, `character`, `discordId` (only for linked friends) and the flags are optional.
- Names only, never BattleTags.

| `type` | Extra in `data` | When |
|---|---|---|
| `runCreated` | | Planned on the site or in Discord |
| `runChanged` | `changed`: some of `startsAt`, `note`, `answers` | The organiser changed day, time or note, or someone answered |
| `runCancelled` | `by` (a name), `mention` | Deleted by its organiser or the admin. The bot marks the post cancelled |
| `runReminder` | `mention`, `minutes` | `minutes` before start (the admin's reminder time) |
| `runStarting` | `mention` | At start time |
| `runMovedUp` | `who` (`name`, `discordId`) | A reserve (or a Maybe) moved up into a freed slot: a quiet notice to them (a direct message), not a channel post |
| `runMoved` | `who` (`name`, `discordId`), `to` (`tank`, `healer`, `damage`, `reserve` or `removed`), `by` (a name) | WEB-47: the organiser or the admin moved their sign-up: a quiet notice to them, not a channel post |
| `runEnded` | `outcome`: `done` (with `came` and `signedUp`) or `didntHappen` | An upload's run log showed it ("Ran it · 3 of 5 signed-up came"), or none did within 4 hours of the start. Only with the admin's "Mark runs done from uploads"; not posted for a run that ended more than a day ago |
| `askNow` | `ask` (see "Asks"; no `run`) | A new ask: an "Ask now" from the game with "Also post on Discord" (addon CF-47), only within 10 minutes of being made and with the admin's "Ask now from the game" on; or `/ask` (WEB-51) with the Runs switch on |
| `askChanged` | `ask` | WEB-51: someone answered the ask (on Discord, the site or in game) |
| `askExpired` | `ask` | WEB-51: its 10 minutes are over (written when the bot polls, once): end the post, remove its buttons |
| `ping` | `from` (`name`, `discordId`), `to` (`name`, `character`, `discordId`) | Someone pinged a friend on Discord from the game's start panel (addon CF-48); `run` is the run it's about |

`mention`: Discord user ids of linked friends who answered I'm in or Maybe (decided with Nico: reminders mention only them).

Reminders and "starting now" are written when the bot polls (decided with Nico, 2026-10-27: no scheduler): each look of a waiting `events` call writes the ones that fell due, each once, so they arrive within about 5 s. A run whose start passed more than the reminder time ago gets neither. A new start time brings both back.

### Run actions (built, WEB-40)
For `/plan`, `/runs`, the answer buttons ("Pick my character") and `/run` (edit, cancel). Every action carries the `discordUserId` of the Discord user who did it; the site acts only when that account is linked (WEB-39) to someone who may sign in, and checks every right itself: `403 not_linked` otherwise.

| Request | Body / query | Answer |
|---|---|---|
| `GET /api/bot/v1/dungeons` | | `{ dungeons: [{ id, name, shortName, typicalLevels }] }`: Scarlet Monastery as its four wings |
| `GET /api/bot/v1/plan?discordUserId=` | | BOT-04, `/plan`: `{ timeZone, admin, days: [{ offset, label, date }], dungeons: [{ id, name, typicalLevels, lead }] }`. `admin`: whether they are the admin (`/run edit` and `/run cancel` list every run for them). `days`: today and the next six in the user's own calendar (`label` "Today · Thu 19", "Fri 20"; send `offset` as `dayOffset`). `lead`: the character they would lead as (`guid`, `name`, `level`, `classFile`, `role`, `fit`; the best fit first, then the highest level), `null` when none of theirs may say I'm in |
| `GET /api/bot/v1/runs` | | `{ runs: [run] }`: upcoming (not cancelled, not past), by start |
| `GET /api/bot/v1/runs/<id>` | | `{ run }` |
| `POST /api/bot/v1/runs` | `discordUserId`, `dungeonId`, `startsAt`, or `date` (`"2026-10-27"`) and `time` (`"20:30"`) in the user's own time zone, or `dayOffset` (`0` today … `6`, the user's own calendar; BOT-04) and `time`, `note` (optional, ≤ 200), `leadGuid` (optional: their character to lead as) | `201 { run }` |
| `PATCH /api/bot/v1/runs/<id>` | `discordUserId`, `startsAt`, or `date` and `time`, or `dayOffset` and `time`, and `note` (each optional) | `{ run }`. Organiser only; dungeon can't change (delete and plan again) |
| `POST /api/bot/v1/runs/<id>/cancel` | `discordUserId` | `{ run }`. The organiser, or the admin any run |
| `POST /api/bot/v1/runs/<id>/answers` | `discordUserId`, `answer` (`in`, `maybe`, `cant`), `characterId` (or `guid`; required for `in`), `role` (optional, WEB-47: `tank`, `healer` or `damage`, one the class can play; default the character's role) | `{ stored: { answer, role, waitlisted }, run }`. I'm in on a full role is stored as Maybe, first in line: tell the user |
| `GET /api/bot/v1/runs/<id>/characters?discordUserId=` | | `{ characters: [{ guid, name, level, classFile, role, roles, fit }] }`: the user's characters that may say I'm in (Pick my character); `roles` the roles their class can play, `fit` how their level fits (WEB-47) |
| `POST /api/bot/v1/runs/<id>/move` | `discordUserId`, `characterId`, `to` (`tank`, `healer`, `damage`, `reserve` or `remove`) | `{ run }`. WEB-47: the organiser, or the admin any run, moves a sign-up to another role's open slot, to reserve, or off the run (the friend may answer again). The moved friend gets `runMoved` |

For the bot's run post (BOT-04; optional fields within v1):
- `organiser` and each answer with a character carry the character's `level` and `classFile` ("37 · Femke", "Ves Doombringer (39 Warlock)").
- `outcome`: once known, `{ "kind": "done", "at", "came", "signedUp" }` ("Ran it · 3 of 5 signed-up came") or `{ "kind": "didntHappen", "at" }`.
- `couldFill`: one entry per role with an open slot, `{ role, open, characters: [...], close?: [...] }`. `characters` lists up to three characters of friends who haven't answered that fit or are over and play that role (`name`, `character`, `level`, `classFile`, `fit`). Without one, `close` lists the closest below the range ("Close: Grom Ashfeller 24 (Nico), 8 below"). Names only, never BattleTags.

WEB-47 (optional fields within v1): each answer in a run carries `guid`, `fit` (`kind`: `fits`, `over`, `carry`, `low` or `tooLow`; `label`: "fits", "+3 over", "carry · +12", "4 below"), and for a reserve `reserve: true`. A reserve is sent as `"answer": "maybe"` and keeps `waitlisted: true`, for bots from before WEB-47. "Runs I can join" and suggestions use `fits` and `over`; `tooLow` (6 or more below) can only answer Maybe. Errors for `answers` and `move`: `400 role_not_for_class`, `404 unknown_sign_up`, `409 role_full`, `409 same`.

### Asks (built, WEB-51)
An ask ("who's up right now") is a run that starts when it is made and takes answers for 10 minutes (`expiresAt`), from the game (WEB-43) or Discord's `/ask`. It has no slots: I'm in is in, there is no reserve (decided with Nico, 2026-10-28). It is stored even when the admin's "Ask now from the game" is off; that setting only decides whether an ask from the game reaches Discord (asks from Discord follow the Runs switch). Asks are not in `GET runs`, and the run endpoints answer `404 unknown_run` for them.

```json
{
  "ask": {
    "id": 12,
    "dungeon": { "id": "dm", "name": "The Deadmines", "typicalLevels": { "min": 17, "max": 26 } },
    "from": { "name": "Nico", "discordId": "100000000000000001" },
    "character": "Grom Ashfeller",
    "role": "tank",
    "note": "Quick one",
    "source": "game",
    "at": 1793119800,
    "expiresAt": 1793120400,
    "state": "open",
    "counts": { "in": 2, "maybe": 0, "cant": 1 },
    "answers": [
      { "name": "Nico", "character": "Grom Ashfeller", "discordId": "100000000000000001", "answer": "in", "role": "tank", "source": "game", "guid": "Player-1-0000A003", "fit": { "kind": "fits", "label": "fits" }, "level": 24, "classFile": "WARRIOR" }
    ]
  }
}
```

- `id`: the stored ask's id since WEB-51 (before, the game item's id). `role`: the asker's, as the addon names it (`tank` / `heal` / `dps`), as in WEB-43; each answer's `role` is `tank`, `healer` or `damage` as in runs. `character` and `role` are missing when the asker has no character that may join. `state`: `open`, `expired` or `cancelled`. `source`: `game` or `discord`. `answers` as a run's (oldest first, `fit`, `level`, `classFile`), never `reserve`.

| Request | Body / query | Answer |
|---|---|---|
| `GET /api/bot/v1/asks` | | `{ asks: [ask] }`: the open asks, oldest first |
| `GET /api/bot/v1/asks/<id>` | | `{ ask }` (also an expired one) |
| `POST /api/bot/v1/asks` | `discordUserId`, `dungeonId`, `note` (optional, ≤ 200), `leadGuid` (optional: the asker's character, as `/plan`'s `lead`), `role` (optional: its role, one the class can play) | `201 { ask }`: `/ask`, starting now, open for 10 minutes |
| `POST /api/bot/v1/asks/<id>/answers` | as a run's answers | `{ stored: { answer, role }, ask }`. After `expiresAt`: `409 expired` ("This ask has expired") |
| `GET /api/bot/v1/asks/<id>/characters?discordUserId=` | | as a run's (Pick my character) |

Errors (besides the ones above): `400 unknown_dungeon`, `invalid_time` (no time, or one that doesn't exist in the user's zone), `time_passed`, `note_too_long`, `lead_not_yours`, `lead_out_of_range`, `not_your_character`, `no_character`, `out_of_range` (I'm in with a character outside the range; Maybe and Can't always go); `403 not_linked`, `not_organiser`, `not_allowed`; `404 unknown_run`; `409 closed` (started or cancelled), `already_cancelled`, `expired` (an ask past its 10 minutes, WEB-51).
