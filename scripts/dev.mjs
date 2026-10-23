import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
const envFile = path.join(root, "services/api/.env");
if (existsSync(envFile))
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !env[match[1]])
      env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
const python = path.join(
  root,
  "services/api/.venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
if (!existsSync(python)) {
  console.error(
    "Create services/api/.venv and install requirements first. See README.md.",
  );
  process.exit(1);
}
const api = spawn(
  python,
  ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
  {
    cwd: path.join(root, "services/api"),
    env,
    stdio: "inherit",
    windowsHide: true,
  },
);
let web;
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  api.kill();
  web?.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
api.on("exit", (code) => stop(code || 0));
api.on("error", (error) => {
  console.error("API startup failed:", error.message);
  stop(1);
});
// Do not serve auth callbacks until the database-backed API can accept them.
const deadline = Date.now() + 60000;
let healthy = false;
while (!closing && Date.now() < deadline) {
  try {
    const response = await fetch("http://127.0.0.1:8000/health", {
      signal: AbortSignal.timeout(2000),
    });
    healthy = response.ok;
  } catch {}
  if (healthy) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!closing && !healthy) {
  console.error(
    "API did not become ready within 60 seconds. Check database connectivity.",
  );
  stop(1);
}
if (!closing) {
  web = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ],
    {
      cwd: path.join(root, "apps/web"),
      env,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  web.on("exit", (code) => stop(code || 0));
  web.on("error", (error) => {
    console.error("Web startup failed:", error.message);
    stop(1);
  });
}
