# Deployment

Audit date: 2026-06-07 UTC.

## Current Deployment Model

Production code is deployed at:

```bash
/opt/big-sandy-crime-watch
```

The production directory is not a git working tree. It contains source files, `.next`, `node_modules`, `.env`, `work`, and a large backup file. A `.build-sha` file was observed with `ea32e38`, matching the latest GitHub commit at audit time.

This means deployment should be treated as artifact/file synchronization plus install/build/restart, not as `git pull` on the server.

## PM2

Canonical PM2 config:

```bash
ecosystem.config.cjs
```

Applications:

- `big-sandy-crime-watch`
- `big-sandy-crime-watch-automation`

Observed production state:

- Web app online, bound to `127.0.0.1:3100`.
- Automation worker online, running `node_modules/tsx/dist/cli.mjs scripts/automation-runner.ts`.
- PM2 logrotate module installed.
- Other unrelated PM2 apps exist on the server and must not be touched during BSCW deployment.

Use the Node binary from the runbook:

```bash
/root/.nvm/versions/node/v24.11.1/bin/node
```

The default SSH shell does not put PM2 on `PATH`, so operational commands should export the Node path first.

## Safe Deploy Sequence

Do not deploy until tests and the audit checklist pass.

Expected sequence:

```bash
cd /opt/big-sandy-crime-watch
export PATH=/root/.nvm/versions/node/v24.11.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export NODE_BINARY=/root/.nvm/versions/node/v24.11.1/bin/node
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

If no migration changed, `npx prisma migrate deploy` should still be safe, but the duplicate unfinished migration metadata noted in `DATABASE.md` should be resolved before introducing new migrations.

## Nginx

Nginx site file:

```bash
/etc/nginx/sites-available/big-sandy-crime-watch
```

Enabled symlink:

```bash
/etc/nginx/sites-enabled/big-sandy-crime-watch
```

Observed config:

- `server_name bigsandycrimewatch.com www.bigsandycrimewatch.com`
- HTTPS listens on `443` and `[::]:443`
- HTTP listens on `80` and `[::]:80`
- HTTP redirects to HTTPS through Certbot-managed blocks
- HTTPS proxies `/` to `http://127.0.0.1:3100`
- Forwarded headers include `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`

`nginx -t` passed during audit.

## SSL

Certificate:

- Name: `bigsandycrimewatch.com`
- Domains: `bigsandycrimewatch.com`, `www.bigsandycrimewatch.com`
- Provider: Let's Encrypt / Certbot
- Observed expiration: `2026-08-29 04:53:25+00:00`
- Cert path: `/etc/letsencrypt/live/bigsandycrimewatch.com/fullchain.pem`
- Key path: `/etc/letsencrypt/live/bigsandycrimewatch.com/privkey.pem`

Do not print private key contents.

## Ports

Observed listening ports relevant to BSCW:

- `80`: Nginx
- `443`: Nginx
- `127.0.0.1:3100`: Next.js BSCW app
- `127.0.0.1:5432`: PostgreSQL

Other services on the box include Redis, Ollama, Tailscale, and unrelated PM2 apps. Keep them out of BSCW deploy steps.

## Smoke Checks

Use after deployment:

```bash
curl -I https://bigsandycrimewatch.com/
curl -I https://bigsandycrimewatch.com/today
curl -I https://bigsandycrimewatch.com/last-72-hours
curl -I https://bigsandycrimewatch.com/county/johnson
curl -I https://bigsandycrimewatch.com/county/rowan
curl -I https://bigsandycrimewatch.com/search
npm run status:automation
pm2 logs big-sandy-crime-watch --lines 80 --nostream
pm2 logs big-sandy-crime-watch-automation --lines 120 --nostream
```

All listed public HTTPS routes returned `200` during audit.

