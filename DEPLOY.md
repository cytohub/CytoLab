# Deploying the CytoLab public demo (Railway + cytolab.ai)

This guide puts CytoLab on `https://cytolab.ai` as a **public demo**:

- anyone can open the site and sign in with one click to the synthetic workspace;
- file uploads and account changes are switched off;
- each visitor can make at most 100 changes per 10 minutes;
- every night the database is rebuilt from the seed, which wipes all changes.

All data in the demo is synthetic. The sign-in page and the in-app banner say
so, and the demo must never be presented as real scientific findings.

## How it fits together

One Railway project with three services:

| Service    | What it is | What it runs |
| ---------- | ---------- | ------------ |
| `Postgres` | Railway's managed PostgreSQL | — |
| `web`      | This repository, built from the `Dockerfile` | `scripts/docker/start.sh`: applies migrations, seeds the demo workspace if it is missing, then starts the server |
| `reset`    | The same repository and image | `pnpm db:reset` on a nightly schedule, then exits |

Settings live in the Railway dashboard, not in a `railway.json` file.
Railway has deprecated that file format ("Config as Code"), and it stops
working on 2026-12-01.

### The switches this deployment uses

| Variable | Effect |
| -------- | ------ |
| `DEMO_MODE=true` | The sign-in page lists one demo account per role and shows the shared password. |
| `PUBLIC_DEMO=true` | Uploads, users, teams and profiles become read-only (HTTP 403 with an explanation). All other writes are allowed but counted per visitor IP (HTTP 429 with `Retry-After` beyond the limit). The banner and sign-in page mention the nightly reset. It also allows `db:seed` and `db:reset` to run in production, but only while the database contains nothing except demo workspaces. |
| `CLIENT_IP_HEADER` | Which request header carries the visitor's real IP. It must be a header your proxy overwrites, so visitors cannot fake their address to dodge the limit. |
| `APP_URL` | The canonical address. In production, `www.<that host>` redirects to it. |

## 1. Put the code where Railway can build it

Railway builds from a GitHub repository (recommended, because every push then
redeploys) or from a folder you upload with its CLI.

**GitHub.** Push this branch to the repository you want Railway to watch, for
example `cytohub/cytolab`. If you only have the `cytolab.bundle` file:

```sh
git clone cytolab.bundle cytolab
cd cytolab
git remote set-url origin https://github.com/cytohub/cytolab.git
git push -u origin HEAD:main
```

If GitHub rejects the push because the repository already has commits (for
example a README created with it), push to a new branch instead with
`git push -u origin HEAD:cytolab` and choose that branch in Railway.

**CLI (no GitHub).** Install it with `npm i -g @railway/cli`, then run
`railway login`. In step 2, start with **New Project → Empty Project**, add
PostgreSQL, and create two **Empty Service**s named `web` and `reset`. Then,
in the code folder, run `railway link` to pick the project, followed by
`railway up --service web` and `railway up --service reset`. Run both
`railway up` commands again whenever you want to deploy new code.

## 2. Create the project and database

1. Sign in at [railway.com](https://railway.com). You need a plan that allows
   custom domains. Hobby costs $5/month and includes $5 of usage; usage beyond
   that is billed.
2. Click **New Project → Deploy from GitHub repo** and pick the repository and
   branch. Railway finds the `Dockerfile` and builds it. The first deploy
   fails with `DATABASE_URL is not set`. That is expected; step 3 fixes it.
3. On the project canvas, click **Create → Database → PostgreSQL**.
4. Rename the app service to `web` (click it, then **Settings**).

## 3. Configure the `web` service

1. Open **web → Variables → Raw Editor** and paste:

   ```sh
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   APP_URL=https://cytolab.ai
   DEMO_MODE=true
   PUBLIC_DEMO=true
   CLIENT_IP_HEADER=x-real-ip
   ```

   Use `CLIENT_IP_HEADER=cf-connecting-ip` instead if you will put Cloudflare's
   proxy in front (step 6, option A).
2. In **Settings → Deploy**, set **Healthcheck Path** to `/api/v1/health`.
   Leave the start command empty, because the image already knows how to
   start.
3. Keep **Replicas** at 1. The write limit is counted in memory, per instance.
4. In **Settings → Networking**, click **Generate Domain**. This gives you an
   address such as `https://web-production-1234.up.railway.app`.
5. Click **Deploy** to apply the staged changes.

## 4. Check it on the Railway address

- `https://<your-railway-domain>/api/v1/health` returns
  `{"data":{"status":"healthy","database":"ok",...}}`.
- The home page shows **Sign in to CytoLab** with a list of demo accounts.
  Pick one to reach the dashboard. The banner ends with "Changes reset every
  night."
- **Settings**: the profile card is read-only and says why.
- Any experiment's **Files** tab says uploads are turned off.
- Creating or editing an experiment still works.

## 5. Add the nightly reset

1. On the canvas, click **Create → GitHub Repo** and pick the same repository
   and branch again. Rename the new service to `reset`. (On the CLI path, use
   the `reset` service you already created.)
2. Set its **Variables**:

   ```sh
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   PUBLIC_DEMO=true
   ```

3. In **Settings → Deploy**, set **Custom Start Command** to `pnpm db:reset`.
4. In **Settings → Cron Schedule**, enter `0 4 * * *` (every day at 04:00 UTC;
   Railway cron schedules run in UTC).
5. Give it no domain and no healthcheck, then **Deploy**.

The reset drops and rebuilds the schema and re-seeds the workspace. Dates in
the seed are relative to the reset time, so the demo always looks current.
Everyone is signed out at that moment, and requests during the few seconds
the reset takes may fail. The script refuses to run unless `PUBLIC_DEMO=true`
and every organization in the database is a demo workspace, so pointing it at
a real database by mistake does nothing.

## 6. Point cytolab.ai at Railway

In **web → Settings → Networking**, click **+ Custom Domain** and enter
`cytolab.ai`. Railway shows two records to create at your DNS provider: a
**CNAME** (its target looks like `abc123.up.railway.app`) and a **TXT**
record. Both are required; without the TXT record the domain answers with 404
even once the CNAME resolves.

A root domain such as `cytolab.ai` can only point at Railway if your DNS
provider supports CNAME flattening or ALIAS records. Pick the option for
wherever your domain's DNS is hosted (by default, the registrar you bought it
from).

### A. Cloudflare (recommended)

1. Add a **CNAME** record with name `@`, the Railway target, and proxy status
   **on** (orange cloud).
2. Add the **TXT** record exactly as Railway shows it.
3. Add a **CNAME** record with name `www`, target `@`, and proxy **on**.
4. In **SSL/TLS → Overview**, select **Full**. Not "Full (strict)": Railway
   says strict mode does not work, and other modes cause
   `ERR_TOO_MANY_REDIRECTS`.
5. In **SSL/TLS → Edge Certificates**, turn on **Universal SSL**.
6. Railway's domain panel should now show "Cloudflare proxy detected".
7. Under **Bulk Redirects**, create a list with source
   `https://www.cytolab.ai`, target `https://cytolab.ai`, status `301`, and
   every option ticked (preserve query string, include subdomains, subpath
   matching, preserve path suffix). Save and deploy it.
8. On the `web` service, set `CLIENT_IP_HEADER=cf-connecting-ip` and deploy.
   Behind Cloudflare, Railway sees Cloudflare's address instead of the
   visitor's.
9. Once `https://cytolab.ai` works, delete the `*.up.railway.app` domain from
   **Settings → Networking**. All traffic then passes through Cloudflare, which
   is what makes `cf-connecting-ip` trustworthy.

### B. Namecheap, DNSimple or bunny.net

1. Create the root record for `@` pointing at the Railway target. Use CNAME,
   or ALIAS where the provider calls it that.
2. Add the **TXT** record.
3. In Railway, add `www.cytolab.ai` as a second custom domain and create its
   CNAME and TXT records the same way. CytoLab redirects `www` to
   `cytolab.ai` itself.
4. Keep `CLIENT_IP_HEADER=x-real-ip`.

### C. Any other provider

GoDaddy, Squarespace, AWS Route 53, Azure DNS, Hostinger, NameSilo and
Hurricane Electric cannot point a root domain at Railway. Move the domain's DNS
to Cloudflare (the free plan is enough): add the site in Cloudflare, replace the
nameservers at your registrar with the two Cloudflare gives you, wait for
Cloudflare to confirm, then follow option A.

Railway issues a Let's Encrypt certificate automatically, usually within an
hour of the records being correct. Until then the browser may warn about the
certificate.

## 7. Final checks

- `https://cytolab.ai` shows the sign-in page, and `https://www.cytolab.ai`
  redirects to it.
- `https://cytolab.ai/api/v1/health` reports `"healthy"`.
- `curl -sI https://cytolab.ai/login` includes `strict-transport-security` and
  `content-security-policy` headers.
- Signing in, creating an experiment, and signing out all work. The profile and
  file uploads say they are turned off.
- The next morning, the change you made is gone, which confirms the reset ran.
  Its log shows `✔ Seeded demo workspace`.

## Updating the demo

With the GitHub setup, every push to the watched branch rebuilds both services.
`web` applies new migrations as it starts, and the old version keeps serving
until the new one passes its healthcheck.

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| Deploy log: `DATABASE_URL is not set` | The variable is missing on that service, or the reference name doesn't match the database service (`${{Postgres.DATABASE_URL}}` assumes it is called `Postgres`). |
| Many visitors get "You are making changes faster than the public demo allows" at once | `CLIENT_IP_HEADER` doesn't match your setup, so everyone appears to share one address. Use `cf-connecting-ip` behind Cloudflare's proxy, otherwise `x-real-ip`. |
| Reset log: `Refusing to reset the database…` | `PUBLIC_DEMO=true` is missing on `reset`, or the database contains a non-demo organization. The reset will not touch real data. |
| `ERR_TOO_MANY_REDIRECTS` behind Cloudflare | SSL/TLS mode must be **Full**. |
| Custom domain answers 404 | The TXT verification record is missing or wrong. |

## Before this becomes a real (non-demo) deployment

Remove `DEMO_MODE`, `PUBLIC_DEMO` and the `reset` service first, then address
the following:

- Attachments are stored on the container's local disk, which is ephemeral.
  Real use needs object storage (or a Railway volume mounted at
  `/app/.data/uploads`).
- The rate limiters are in memory, so more than one replica needs a shared
  store such as Redis.
- Set up database backups.
