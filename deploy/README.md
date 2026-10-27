# Deploying wow.vestras.nl

How the site runs (WEB-07, `docs/ARCHITECTURE.md` "Hosting"):

```
browser ──https──▶ router :443 ──▶ nginx (TrueNAS app, TLS) ──http──▶ TrueNAS <ip>:3000 ──▶ CommunitiesForever app
                                                                                            └─ /data: dataset /mnt/<pool>/apps/cf
```

- The image is `ghcr.io/nicoputten/communitiesforever-web`, built by `.github/workflows/release.yml` when a `v*` tag lands on `main`. Pushing a tag is a deploy: only on Nico's go-ahead.
- The app listens on port 3000, on the LAN only. nginx (already running as an app on TrueNAS) terminates TLS and proxies to it.
- Everything the site keeps is one SQLite file in `/data`. Migrations run when the container starts.

Steps 1 to 8 are the first install; 9 and 10 are for later.

## 1. DNS at Hostnet
1. Hostnet control panel → domain `vestras.nl` → DNS.
2. Add an **A record**: name `wow`, value your home IP (the one that already serves your other nginx sites), TTL 1 hour. With an IPv6 address on your connection and in nginx, an AAAA record as well.
3. Router: ports 80 and 443 already forward to nginx for your other sites; nothing new. **Do not forward port 3000.**
4. Check: `nslookup wow.vestras.nl` shows your home IP (may take up to the TTL).

## 2. nginx and the certificate
The certificate comes from Let's Encrypt through your nginx app, like your other sites. Step 1 must resolve first: Let's Encrypt checks `http://wow.vestras.nl/.well-known/acme-challenge/` on port 80.

**If the app is Nginx Proxy Manager** (a web UI with "Proxy Hosts", the likely case when certificates are "made in nginx"):
1. Hosts → Proxy Hosts → Add Proxy Host.
2. Details: domain `wow.vestras.nl`, scheme `http`, forward hostname/IP: the TrueNAS LAN IP, port `3000`. Tick "Block common exploits". Websockets support is not needed.
3. SSL: "Request a new SSL certificate", tick Force SSL, HTTP/2 support and HSTS enabled; agree to the Let's Encrypt terms; Save. NPM renews it by itself.
4. Advanced → Custom Nginx Configuration:
   ```nginx
   client_max_body_size 300m;
   proxy_request_buffering off;
   proxy_send_timeout 300s;
   proxy_read_timeout 300s;
   ```
   300 MB and 5 minutes because the uploader's release workflow publishes its installer through the site (WEB-35); the app still refuses data uploads over 25 MiB itself.
   NPM already sets `Host`, `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Real-IP`, which Auth.js needs.

**If it is plain nginx with config files:** copy [`nginx/wow.vestras.nl.conf`](nginx/wow.vestras.nl.conf) into its config folder (often `conf.d/`), replace `<truenas-ip>` and point `ssl_certificate` / `ssl_certificate_key` at where your other sites' certificates live. Get the certificate the way you do for those (with certbot: `certbot certonly --webroot -w /var/www/letsencrypt -d wow.vestras.nl`, with the HTTP block loaded first). Then `nginx -t` and reload.

Why these settings: uploads go up to 25 MiB (`MAX_UPLOAD_BYTES`), so the body limit is 30 MiB; a large upload is parsed and merged before the answer, so the timeouts are 2 minutes; Auth.js trusts the forwarded host and protocol (`trustHost`, with `AUTH_URL` naming the public origin) to build the Battle.net callback and secure cookies.

## 3. The dataset
1. Datasets → select `<pool>/apps` (or create `apps` first) → Add Dataset: name `cf`, preset **Apps**. Leave compression on.
2. Edit Permissions on the new dataset: owner user `apps` (568), owner group `apps` (568), tick "Apply user" and "Apply group"; Save. The container runs as 568:568 (`user:` in `compose.yaml`) and must write here.
3. The path is `/mnt/<pool>/apps/cf`.

## 4. The image on GHCR
The image is public: it holds no secrets (those are the app's environment variables) and TrueNAS can pull it without a login. After the **first** release workflow run:
1. github.com → your profile → Packages → `communitiesforever-web` → Package settings.
2. Danger Zone → Change visibility → **Public**.
3. Same page: "Manage Actions access" should list `CommunitiesForever-Web` with write (the workflow created the package, so it does; the `org.opencontainers.image.source` label links the package to the repo).

Check from any machine: `docker pull ghcr.io/nicoputten/communitiesforever-web:<tag>` works without `docker login`.

## 5. The environment values
Fill in the `<...>` values in a copy of [`compose.yaml`](compose.yaml); keep that copy out of the repo.

| Variable | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 33` (once; changing it signs everyone out) |
| `AUTH_URL` | `https://wow.vestras.nl` |
| `AUTH_BATTLENET_ID`, `AUTH_BATTLENET_SECRET` | the Battle.net app at https://develop.battle.net. Its redirect URLs must include `https://wow.vestras.nl/api/auth/callback/battlenet` |
| `ADMIN_BATTLETAG` | your BattleTag, `Name#1234` (case doesn't matter) |
| `UPLOADER_DEPLOY_SECRET` | `openssl rand -base64 33`; the same value as the GitHub secret `UPLOADER_DEPLOY_SECRET` in the uploader repo (WEB-35). Leave it out and publishing uploader releases is off |
| `DATA_DIR` | `/data` (the image's default; keep it) |

Also set the `image:` tag to the release you deploy, and the dataset path from step 3.

## 6. The Custom App
1. Apps → Discover Apps → ⋮ (top right) → **Install via YAML**.
2. Name `communitiesforever`, paste your filled-in `compose.yaml`, Save.
3. TrueNAS pulls the image and starts it. Apps → Installed → communitiesforever shows it running; the logs show `Ready`.

## 7. First start and health check
- On the LAN: `curl http://<truenas-ip>:3000/api/health` → `{"ok":true,"version":"<tag>"}`. The database file appears in the dataset at that moment (migrations ran at start).
- Through nginx: `curl https://wow.vestras.nl/api/health` → the same, with a valid certificate.
- The container's own `HEALTHCHECK` calls the same endpoint every 30 s; TrueNAS shows the app as unhealthy after three failures.
- `/api/health` is the one route open without a sign-in. It says only ok (the database opens) and the version, nothing about the data.
- If the app restarts in a loop, look at the logs: usually the dataset isn't writable by 568 (step 3) or a value is missing.

## 8. First sign-in and first upload
1. Open https://wow.vestras.nl → Sign in with Battle.net. Battle.net asks once to allow the app; it only shares your BattleTag.
2. You land on the site as admin (`ADMIN_BATTLETAG`). Anyone else is "not on the list" until your first upload names them or you add them as a guest.
3. Upload `WTF/Account/<ACCOUNT>/SavedVariables/CommunitiesForever.lua` (after `/reload` or logging out, so the game has written it). Your upload sets the community: from then on members of that community can sign in and upload their own file.

## 9. Updating to a new tag
1. After Nico's go-ahead, the release is tagged on `main` (`vX.Y.Z`); the Release workflow pushes `:vX.Y.Z` and `:latest`. Check the run is green.
2. TrueNAS → Apps → communitiesforever → Edit → change the `image:` tag to `vX.Y.Z` → Save. TrueNAS pulls and restarts it; new migrations run at start.
3. Check `/api/health` shows the new version.
4. Rolling back: set the previous tag again. Migrations only go forward, so after a release with a migration, roll back by restoring the snapshot taken before the update (step 10) together with the old tag.

A rebuild of an existing tag (e.g. for a base image fix): GitHub → Actions → Release → Run workflow, with the tag; then on TrueNAS stop and start the app so it pulls again.

## 10. Backup
Everything is in the dataset: `communitiesforever.sqlite` (plus `-wal` and `-shm` while running). The raw uploads are stored inside it, so the site can always be rebuilt from it.
1. Data Protection → Periodic Snapshot Tasks → Add: dataset `<pool>/apps/cf`, every day, keep 4 weeks.
2. Take a manual snapshot before every update (Datasets → `cf` → Take Snapshot).
3. ZFS snapshots are atomic, so SQLite recovers a snapshot taken while the app runs like after a power cut.
4. Restore: stop the app, roll the dataset back to the snapshot (or copy the files out of `/mnt/<pool>/apps/cf/.zfs/snapshot/<name>/`), start the app.
5. Off the box: replicate the dataset with a Replication Task or Cloud Sync, like your other important datasets.
