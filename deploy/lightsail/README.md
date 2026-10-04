# Deploy CytoLab on AWS Lightsail

One Lightsail server runs everything with Docker Compose: the app, PostgreSQL,
and [Caddy](https://caddyserver.com), which serves HTTPS with free Let's Encrypt
certificates. Route 53 points your domain at the server, and cron runs the
nightly demo reset. Allow 30 to 45 minutes.

The steps use `cytolab.ai`; use your own domain wherever it appears.

```
visitor ──https──▶ Caddy (ports 80/443) ──▶ app (Next.js) ──▶ PostgreSQL
                     certificates            private network only
cron 04:00 UTC ──▶ demo reset · 04:30 UTC ──▶ needs-attention scan
```

You need:

- the domain in Route 53, with its hosted zone (created for you when you buy
  the domain there)
- access to the `cytohub/CytoLab` repository on GitHub
- a terminal with `ssh`, or Lightsail's in-browser SSH

## 1. Create the server

1. Open the [Lightsail console](https://lightsail.aws.amazon.com) and choose
   **Create instance**.
2. **Region**: the one closest to your visitors.
3. **Platform**: Linux/Unix. **Blueprint**: OS Only → **Ubuntu 24.04 LTS**.
4. **Networking**: dual-stack (not IPv6-only).
5. **Plan**: **2 GB** memory. The app needs about 200 MB once running, but
   building it needs more.
6. **Name**: `cytolab`, then **Create instance**.

## 2. Give it a fixed address

1. In Lightsail, open **Networking → Create static IP**.
2. Attach it to `cytolab` and name it `cytolab-ip`.
3. Note the address (for example `203.0.113.25`). Your DNS records will point at it.

## 3. Open the firewall

Open the `cytolab` instance, then **Networking**. Under **IPv4 Firewall**:

| Application | Port | Note |
| --- | --- | --- |
| SSH | 22 | Already there. Use **Restrict to IP address** to allow only your own address. |
| HTTP | 80 | Add it. Let's Encrypt and the redirect to HTTPS use it. |
| HTTPS | 443 | Add it. |

Under **IPv6 Firewall**, delete the rules, because this setup serves IPv4 only
(see step 4).

## 4. Point the domain at the server (Route 53)

1. Open **Route 53 → Hosted zones → cytolab.ai**.
2. **Create record**: leave the name empty, type **A**, value = the static IP,
   TTL **300**.
3. **Create record**: name `www`, type **A**, same IP, TTL 300.
4. If the zone already has A, AAAA or CNAME records for `cytolab.ai` or
   `www` from an earlier host (Railway, Cloudflare), delete them.

Don't add AAAA (IPv6) records. Docker would pass every IPv6 visitor to Caddy
under one internal address, so all of them would share a single rate-limit
allowance.

Check from your own computer, which can take a few minutes:

```sh
dig +short cytolab.ai       # the static IP
dig +short www.cytolab.ai   # the static IP
```

If you bought the domain somewhere else, set its name servers to the four
NS values listed in the hosted zone.

## 5. Prepare the server

Connect from the instance page (**Connect using SSH**), or with the key from
**Account → SSH keys**:

```sh
ssh -i LightsailDefaultKey-<region>.pem ubuntu@203.0.113.25
```

Install Docker and Git, and add swap so the build has room:

```sh
sudo apt update && sudo apt -y upgrade
sudo apt -y install docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu

sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Log out (`exit`) and connect again so the `docker` group applies. Then check:

```sh
docker compose version
```

## 6. Get the code

The repository is private, so give the server a read-only deploy key:

```sh
ssh-keygen -t ed25519 -N '' -f ~/.ssh/cytolab_deploy
cat ~/.ssh/cytolab_deploy.pub
```

1. Copy the printed line.
2. On GitHub, open **cytohub/CytoLab → Settings → Deploy keys → Add deploy key**.
3. Paste the line, name the key `lightsail`, and leave **Allow write access**
   off.

Then clone:

```sh
printf 'Host github.com\n  IdentityFile ~/.ssh/cytolab_deploy\n' >> ~/.ssh/config
git clone git@github.com:cytohub/CytoLab.git ~/cytolab
```

Answer `yes` when asked to trust github.com.

## 7. Configure

```sh
cd ~/cytolab/deploy/lightsail
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^APP_DB_PASSWORD=.*/APP_DB_PASSWORD=$(openssl rand -hex 24)/" .env
chmod 600 .env
nano .env    # set DOMAIN=cytolab.ai if your domain differs; save with Ctrl+O, Enter, Ctrl+X
```

The two passwords take effect when the database is first created. Keep
`DEMO_MODE=true` and `PUBLIC_DEMO=true` for the public demo.

## 8. Start

```sh
docker compose up -d --build
```

The first build takes 5 to 10 minutes. Then watch the app start:

```sh
docker compose logs -f web
```

You should see these lines, then press Ctrl+C:

```
✔ Migrations applied
✔ Granted row access to cytolab_app
✔ Seeded demo workspace: 7 projects, 132 experiments, 8 users, 420 activity events
✓ Ready in …
```

Caddy requests the certificates as soon as it starts:

```sh
docker compose logs caddy | grep -i 'certificate obtained'
```

## 9. Check the site

- `https://cytolab.ai` shows **Sign in to CytoLab** with the demo accounts.
  Pick one to reach the dashboard.
- `http://cytolab.ai` and `https://www.cytolab.ai` both redirect to
  `https://cytolab.ai`.
- From your computer, `curl -s https://cytolab.ai/api/v1/health` returns
  `{"data":{"status":"healthy","database":"ok",…}}`.
- In the demo, creating or editing an experiment works. Deleting one says
  "Deleting projects and experiments is turned off in the public demo".

## 10. Schedule the nightly jobs

```sh
crontab ~/cytolab/deploy/lightsail/cytolab.cron
crontab -l
```

These two jobs then run every day:

- **04:00 UTC**: the demo is rebuilt with fresh synthetic data. Everyone is
  signed out, and requests made during the few seconds it takes may fail.
- **04:30 UTC**: needs-attention notifications are sent.

Their output goes to `~/cytolab-jobs.log`. To run the reset now:

```sh
cd ~/cytolab/deploy/lightsail && docker compose run --rm -T web pnpm db:reset
```

## 11. Turn on snapshots (optional)

On the instance page, open **Snapshots** and turn on **Automatic snapshots**.
The demo rebuilds itself every night, so this mainly saves you setting the
server up again.

## Updating to a new version

```sh
cd ~/cytolab && git pull
cd deploy/lightsail && docker compose up -d --build
docker image prune -f
```

The app is unavailable for about 10 seconds while it restarts. Migrations run
on start.

## Moving off Railway

If `cytolab.ai` was served from Railway, do this once the Lightsail site
works:

1. In Railway, remove the custom domain from `web`.
2. Delete the `web`, `reset` and `attention` services and the Postgres
   database.

Cloudflare and `CLIENT_IP_SECRET` aren't needed here. Caddy is the only way in
and sets the visitor's address itself.

## Everyday commands

Run these from `~/cytolab/deploy/lightsail`.

| Task | Command |
| --- | --- |
| Status | `docker compose ps` |
| App logs | `docker compose logs -f web` |
| Restart the app | `docker compose restart web` |
| Database shell | `docker compose exec db psql -U cytolab -d cytolab` |
| Stop everything | `docker compose down` (data is kept) |

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The browser warns about the certificate, or Caddy's log shows ACME errors | DNS isn't pointing at the server yet, or port 80 or 443 is closed. Check `dig +short cytolab.ai` and the firewall (step 3), then run `docker compose restart caddy`. |
| The build stops with `exit code: 137` or "Killed" | The server ran out of memory. Use the 2 GB plan and add the swap from step 5. |
| `502 Bad Gateway` | The app is starting or has stopped. Check `docker compose logs web`. |
| `password authentication failed` after editing `.env` | The passwords were stored when the database was created. Put the old values back. Or, on a demo, run `docker compose down -v` and start again, which deletes all data. |
| Reset log: `Refusing to reset the database…` | `PUBLIC_DEMO` isn't `true` in `.env`, or the database holds a non-demo organization. |
| Many visitors get "You are making changes faster than the public demo allows" at once | An AAAA record was added (step 4). Remove it. |

The limits listed under "Before this becomes a real (non-demo) deployment" in
`DEPLOY.md` apply here too. One more applies to this setup: uploaded files live
in a Docker volume on this server, so a real deployment needs backups of that
volume or object storage.
