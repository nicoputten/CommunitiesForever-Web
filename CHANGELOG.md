# Changelog

## Unreleased
- Atmosphere: drifting fog and light shafts on the map page, the drifting map with fog and embers behind sign-in, a quiet glow on the other pages. A "Motion" switch in the account menu turns all motion off (or on); it follows your system setting until you flip it and is remembered on this device.
- The site runs as a Docker image on TrueNAS behind nginx at https://wow.vestras.nl; `/api/health` tells whether it is up and which version runs.
- Sign in with Battle.net. Only the admin, members of the community (everyone named in an accepted upload) and guests on the admin's guest list get in; everyone else sees "You're not on the list". A blocked BattleTag is out at once.
- Uploads are accepted only for your own file of the same community: someone else's file is rejected as "not your file", one of another community as "other community".
- The site gets its look: the "Night over Azeroth" colours and type, a top bar with the community's name, Map / Roster / Professions, how old the data is, Upload and the account menu with sign out, a tab bar on phones, the footer credit, and a banner when the last upload is a week old or more.
- Map data: Thousand Needles is dry canyon again instead of the Cataclysm lake; Mount Hyjal, The Riverglades, Shen'dralas and Zephras Isle are zones on the map, so characters there (and in Krol'dok Stronghold, The Barrow Deeps and Hyjal Summit) are placed on it instead of "elsewhere".
