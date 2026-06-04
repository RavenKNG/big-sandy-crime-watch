const NODE_BINARY =
  process.env.NODE_BINARY || "/root/.nvm/versions/node/v24.11.1/bin/node";

module.exports = {
  apps: [
    {
      name: "big-sandy-crime-watch",
      cwd: "/opt/big-sandy-crime-watch",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3100",
      interpreter: NODE_BINARY,
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production",
      },
      time: true,
      max_memory_restart: "512M",
      autorestart: true,
    },
    {
      name: "big-sandy-crime-watch-automation",
      cwd: "/opt/big-sandy-crime-watch",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "scripts/automation-runner.ts",
      interpreter: NODE_BINARY,
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production",
      },
      time: true,
      max_memory_restart: "512M",
      autorestart: true,
    },
  ],
};
