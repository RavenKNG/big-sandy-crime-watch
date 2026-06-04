$ErrorActionPreference = "Stop"

$repo = "C:\Users\bypass\CascadeProjects\big-sandy-crime-watch"
$remoteHost = "rragent"
$remoteRoot = "/opt/big-sandy-crime-watch"
$nodeBin = "/root/.nvm/versions/node/v24.11.1/bin/node"
$commit = (git -C $repo rev-parse HEAD).Trim()
$shortCommit = (git -C $repo rev-parse --short HEAD).Trim()
$archive = Join-Path $env:TEMP "big-sandy-deploy-$shortCommit.tar.gz"

Set-Location $repo

if (Test-Path $archive) {
  Remove-Item $archive -Force
}

git archive --format=tar.gz -o $archive HEAD
scp $archive "${remoteHost}:/tmp/big-sandy-deploy.tar.gz"

$remoteScript = @"
set -e
cd $remoteRoot
backup="/opt/backups/big-sandy-crime-watch-pre-deploy-\$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "\$backup" -C /opt big-sandy-crime-watch
tar -xzf /tmp/big-sandy-deploy.tar.gz -C $remoteRoot
$nodeBin -e "require('node:fs').writeFileSync('.build-sha', '$shortCommit\n')"
$nodeBin ./node_modules/npm/bin/npm-cli.js ci
$nodeBin ./node_modules/prisma/build/index.js generate
$nodeBin ./node_modules/next/dist/bin/next build
NODE_BINARY=$nodeBin /root/.nvm/versions/node/v24.11.1/bin/pm2 startOrReload ecosystem.config.cjs --update-env
/root/.nvm/versions/node/v24.11.1/bin/pm2 save
"@

ssh $remoteHost $remoteScript

curl.exe -I https://bigsandycrimewatch.com/
curl.exe -I https://bigsandycrimewatch.com/today
