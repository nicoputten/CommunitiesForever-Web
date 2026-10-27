# Unreleased addon samples

Samples of saved data an addon change has defined but not released yet, copied unchanged from the addon repo so the
site can read it before the release (decided with Nico, 2026-10-27, WEB-43). When the addon releases it, its golden
fixture joins `tests/fixtures/addon/<release>/` as usual (CLAUDE.md rule 4) and the sample here can go.

| File | Addon source | What |
|---|---|---|
| `pending.lua` | `tests/fixtures/pending.lua` at addon `develop` 408cf0e (CF-47, CF-48) | `global.pending` of schema 2: runs planned, answers, asks, pings |
