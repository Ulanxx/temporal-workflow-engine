#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const stateDir = join(repoRoot, ".dev");
const titlePrefix = "temporal-workflow-engine:";

const services = [
  { name: "temporal", command: "make temporal", delayMs: 3000 },
  { name: "api", command: "make api", delayMs: 2000 },
  { name: "worker", command: "make worker", delayMs: 2000 },
  { name: "designer", command: "make designer", delayMs: 0 },
];

const action = process.argv[2];

if (!["start", "stop"].includes(action)) {
  console.error("Usage: node scripts/dev-windows.mjs <start|stop>");
  process.exit(1);
}

if (action === "start") {
  startAll();
} else {
  stopAll();
}

function startAll() {
  mkdirSync(stateDir, { recursive: true });

  for (const service of services) {
    const title = `${titlePrefix}${service.name}`;
    const pidFile = join(stateDir, `${service.name}.pid`);
    const command = [
      `cd ${sh(repoRoot)}`,
      "mkdir -p .dev",
      `printf '\\033]0;${title}\\007'`,
      `echo $$ > ${sh(pidFile)}`,
      `trap 'rm -f ${sh(pidFile)}' EXIT`,
      `exec ${service.command}`,
    ].join(" && ");

    console.log(`Starting ${service.name} in Terminal...`);
    runAppleScript(`
      tell application "Terminal"
        activate
        set devTab to do script ${as(command)}
        set custom title of devTab to ${as(title)}
      end tell
    `);

    sleep(service.delayMs);
  }

  console.log("All services started in Terminal windows.");
  console.log("Use `make stop-all` to stop services and close those windows.");
}

function stopAll() {
  console.log("Stopping Temporal Workflow Engine dev services...");

  for (const service of [...services].reverse()) {
    const pidFile = join(stateDir, `${service.name}.pid`);
    const pid = readPid(pidFile);

    if (pid) {
      stopProcessTree(pid);
      rmSync(pidFile, { force: true });
      console.log(`Stopped ${service.name}.`);
    }
  }

  sleep(800);
  closeTerminalTabs();
  rmSync(stateDir, { recursive: true, force: true });
  console.log("Closed Temporal Workflow Engine Terminal windows.");
}

function stopProcessTree(rootPid) {
  const pids = collectDescendants(rootPid);

  for (const signal of ["SIGINT", "SIGTERM"]) {
    for (const pid of [...pids].reverse()) {
      killIfRunning(pid, signal);
    }
    sleep(signal === "SIGINT" ? 1200 : 500);
  }
}

function collectDescendants(rootPid) {
  const rows = spawnSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8" })
    .stdout.trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter(([pid, ppid]) => Number.isFinite(pid) && Number.isFinite(ppid));

  const childrenByParent = new Map();
  for (const [pid, ppid] of rows) {
    const children = childrenByParent.get(ppid) ?? [];
    children.push(pid);
    childrenByParent.set(ppid, children);
  }

  const collected = [];
  const visit = (pid) => {
    collected.push(pid);
    for (const child of childrenByParent.get(pid) ?? []) {
      visit(child);
    }
  };

  visit(rootPid);
  return collected;
}

function closeTerminalTabs() {
  runAppleScript(`
    tell application "Terminal"
      set tabsToClose to {}
      repeat with terminalWindow in windows
        repeat with terminalTab in tabs of terminalWindow
          if custom title of terminalTab starts with ${as(titlePrefix)} then
            set end of tabsToClose to terminalTab
          end if
        end repeat
      end repeat

      repeat with terminalTab in tabsToClose
        close terminalTab saving no
      end repeat
    end tell
  `);
}

function readPid(pidFile) {
  if (!existsSync(pidFile)) return null;

  const pid = Number(readFileSync(pidFile, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function killIfRunning(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function runAppleScript(script) {
  execFileSync("osascript", ["-e", script], { stdio: "inherit" });
}

function sleep(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function as(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function sh(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}
