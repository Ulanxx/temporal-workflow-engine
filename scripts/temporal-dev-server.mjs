#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const check = spawnSync("temporal", ["--version"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (check.error?.code === "ENOENT") {
  console.error("Temporal CLI is not installed.");
  console.error("");
  console.error("Install it first:");
  console.error("  brew install temporal");
  console.error("");
  console.error("Then run:");
  console.error("  pnpm temporal:dev-server");
  process.exit(127);
}

if (check.status !== 0) {
  console.error("Temporal CLI exists, but `temporal --version` failed.");
  if (check.stderr) console.error(check.stderr.trim());
  process.exit(check.status ?? 1);
}

const server = spawnSync(
  "temporal",
  ["server", "start-dev", "--db-filename", "temporal.db"],
  { stdio: "inherit" },
);

process.exit(server.status ?? 1);
