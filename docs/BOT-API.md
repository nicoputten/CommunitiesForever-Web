# Bot API

The contract between this site and the Discord bot ([CommunitiesForever-Discord](https://github.com/nicoputten/CommunitiesForever-Discord)). This repo owns it, as `docs/UPLOADER-API.md` is for the uploader. The site is the bot's only data source: it decides what is worth posting (milestones, runs, the recap) and who is linked; the bot formats and posts.

Status: **v1** (WEB-38, 2026-10-27). Built: the token, `settings`, the event feed and acknowledging, `milestones` events. Run events and run actions are **planned** (WEB-40 and later): their shapes below are a draft and may still change until they ship; the site does not send them yet.

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
- **Until the Discord page (WEB-39)** the admin makes and revokes it from the browser console while signed in on the site:
  - make: `await (await fetch("/api/admin/bot-token", { method: "POST" })).json()` → `{ "token": "cfb_…" }`
  - revoke: `await (await fetch("/api/admin/bot-token", { method: "DELETE" })).json()` → `{ "revoked": true }`
- The token goes into the bot's environment (never into a repo, CLAUDE.md rule 7).

## Settings
`GET /api/bot/v1/settings` → `200`:

```json
{
  "apiVersion": 1,
  "siteName": "Doombringers",
  "longPollSeconds": 30,
  "eventTtlSeconds": 604800,
  "posts": { "milestones": true }
}
```

- `posts`: which post types are on. Fixed to `milestones: true` until WEB-39's toggles. WEB-39 adds (optional) channels, the recap time, the mention role and the runs settings.

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
- **Posting once.** Post, then acknowledge. If the bot stops between the two, the event comes again; the bot avoids a second post by remembering what it posted (e.g. the event id in the message) before acknowledging. The site never hands out an acknowledged event.

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

### Run events (planned, WEB-40 and later; not sent yet)
A draft, so the bot can be designed around them. Each `data` has `run`:

```json
{
  "run": {
    "id": 7,
    "dungeon": { "id": "sm-armory", "name": "Scarlet Monastery: Armory", "typicalLevels": { "min": 32, "max": 42 } },
    "startsAt": 1793131200,
    "note": "Quick clear",
    "organiser": { "name": "Nico", "character": "Ves Doombringer" },
    "source": "website",
    "state": "open",
    "slots": { "tank": 1, "healer": 1, "damage": 3 },
    "answers": [{ "name": "Bob", "character": "Bob Example", "answer": "in", "role": "damage" }]
  }
}
```

| `type` | Extra in `data` | When |
|---|---|---|
| `runCreated` | | Planned on the site, in Discord or in the game |
| `runChanged` | `changed`: `["startsAt", "note", "answers"]` | Time, note or answers changed |
| `runCancelled` | | Cancelled by its organiser or the admin |
| `runReminder` | `mention`: the answers to mention (I'm in, Maybe) | The reminder time before start (WEB-39 setting) |
| `runStarting` | | At start time |
| `runEnded` | `outcome`: `done` or `didntHappen` | Marked done (also from an upload, WEB-43) or not |
| `askNow` | `ask` (dungeon, level range, roles, from whom) | An "Ask now" from the game with "Also post on Discord" (addon CF-27) |
| `ping` | `from`, `text` | A Discord ping made in the game |

### Run actions (planned, WEB-40 and later; not built yet)
For `/plan`, `/ask`, the answer buttons ("Pick my character" lists the asker's characters in range) and `/run` (edit, cancel: own runs, the admin any). Each is done for a Discord user id, accepted only when it is linked to a member or guest (WEB-39). Endpoints follow with WEB-40.
