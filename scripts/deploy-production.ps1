$ErrorActionPreference = "Stop"

$repo = "C:\Users\bypass\CascadeProjects\big-sandy-crime-watch"
$remoteHost = "rragent"
$remoteRoot = "/opt/big-sandy-crime-watch"
$nodeBin = "/root/.nvm/versions/node/v24.11.1/bin/node"
$npmCli = "/root/.nvm/versions/node/v24.11.1/lib/node_modules/npm/bin/npm-cli.js"
$commit = (git -C $repo rev-parse HEAD).Trim()
$shortCommit = (git -C $repo rev-parse --short HEAD).Trim()
$archive = Join-Path $env:TEMP "big-sandy-deploy-$shortCommit.tar.gz"

Set-Location $repo

if (Test-Path $archive) {
  Remove-Item $archive -Force
}

git archive --format=tar.gz -o $archive HEAD
scp $archive "${remoteHost}:/tmp/big-sandy-deploy.tar.gz"

$remoteScript = @'
set -euo pipefail
export PATH=/root/.nvm/versions/node/v24.11.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd __REMOTE_ROOT__
backup="/opt/backups/big-sandy-crime-watch-pre-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "\$backup" -C /opt big-sandy-crime-watch
tar -xzf /tmp/big-sandy-deploy.tar.gz -C __REMOTE_ROOT__
__NODE_BIN__ -e "require('node:fs').writeFileSync('.build-sha', '__SHORT_COMMIT__\n')"
if ! __NODE_BIN__ __NPM_CLI__ ci; then
  echo "npm ci failed on server, falling back to npm install" >&2
  __NODE_BIN__ __NPM_CLI__ install
fi
__NODE_BIN__ ./node_modules/prisma/build/index.js generate
__NODE_BIN__ ./node_modules/next/dist/bin/next build
NODE_BINARY=__NODE_BIN__ /root/.nvm/versions/node/v24.11.1/bin/pm2 startOrReload ecosystem.config.cjs --update-env
/root/.nvm/versions/node/v24.11.1/bin/pm2 save
rm -f /tmp/big-sandy-deploy.tar.gz
'@

$remoteScript = $remoteScript.Replace("__REMOTE_ROOT__", $remoteRoot).Replace("__NODE_BIN__", $nodeBin).Replace("__NPM_CLI__", $npmCli).Replace("__SHORT_COMMIT__", $shortCommit)

ssh $remoteHost $remoteScript

curl.exe -I https://bigsandycrimewatch.com/
curl.exe -I https://bigsandycrimewatch.com/today
