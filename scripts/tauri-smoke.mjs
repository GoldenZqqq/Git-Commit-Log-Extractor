#!/usr/bin/env node

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const defaultBinary = path.join(rootDir, "src-tauri", "target", "debug", "gitpulse.exe");
const defaultArtifactDir = path.join(rootDir, "artifacts", "tauri-smoke");
const pollIntervalMs = 500;
const requestTimeoutMs = 10_000;
const timeoutMs = Number(process.env.TAURI_SMOKE_TIMEOUT_MS || 45_000);

if (process.platform !== "win32") {
  console.log("tauri smoke skipped: real WebView smoke is configured for Windows only");
  process.exit(0);
}

main().catch((error) => {
  console.error(`tauri smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  const context = await createSmokeContext();
  await runSmoke(context);
}

async function createSmokeContext() {
  const binaryPath = path.resolve(process.argv[2] || defaultBinary);
  const artifactDir = path.resolve(process.env.TAURI_SMOKE_ARTIFACT_DIR || defaultArtifactDir);
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Tauri binary not found: ${binaryPath}`);
  }
  fs.mkdirSync(artifactDir, { recursive: true });
  const port = Number(process.env.TAURI_SMOKE_PORT || await findFreePort());
  const driverCommand = process.env.TAURI_DRIVER_PATH || "tauri-driver";
  const appLog = [`binary=${binaryPath}`, `driver=${driverCommand}`, `port=${port}`];
  return { binaryPath, artifactDir, port, driverCommand, appLog, baseUrl: `http://127.0.0.1:${port}` };
}

async function runSmoke(context) {
  const runtime = { driver: null, driverStartError: null, sessionId: "" };

  try {
    await startDriver(context, runtime);
    const heading = await verifyApplication(context, runtime);
    writeSummary(context.artifactDir, { ok: true, heading, binaryPath: context.binaryPath, port: context.port });
    console.log(`tauri smoke passed: ${heading}; get_git_identity round trip ok`);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    await recordFailure(context, runtime, failure);
    throw failure;
  } finally {
    await cleanup(context, runtime);
  }
}

async function startDriver(context, runtime) {
  context.appLog.push("starting tauri-driver");
  runtime.driver = spawn(context.driverCommand, ["--port", String(context.port)], {
    cwd: rootDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  runtime.driver.on("error", (error) => {
    runtime.driverStartError = error;
    context.appLog.push(`driver start failed=${error.message}`);
  });
  captureStream(runtime.driver.stdout, path.join(context.artifactDir, "driver.stdout.log"));
  captureStream(runtime.driver.stderr, path.join(context.artifactDir, "driver.stderr.log"));
  await waitForDriver(context.baseUrl, runtime.driver, () => runtime.driverStartError);
  context.appLog.push("driver ready");
}

async function verifyApplication(context, runtime) {
  runtime.sessionId = await createSession(context.baseUrl, context.binaryPath);
  context.appLog.push(`session=${runtime.sessionId}`);
  const heading = await waitForWorkbench(context.baseUrl, runtime.sessionId, context.appLog);
  if (heading !== "工作报告工作台") {
    throw new Error(`unexpected workbench heading: ${heading || "<empty>"}`);
  }
  await verifyGitIdentity(context, runtime.sessionId);
  return heading;
}

async function verifyGitIdentity(context, sessionId) {
  const identity = await executeAsync(context.baseUrl, sessionId, `
    (async () => {
      const done = arguments[arguments.length - 1];
      try {
        const value = await window.__TAURI_INTERNALS__.invoke("get_git_identity");
        done({ ok: Boolean(value && typeof value === "object"), keys: Object.keys(value || {}) });
      } catch (error) {
        done({ ok: false, error: String(error) });
      }
    })();
  `);
  if (!identity?.ok) {
    throw new Error(`get_git_identity round trip failed: ${identity?.error || "invalid response"}`);
  }
  context.appLog.push(`get_git_identity ok (${(identity.keys || []).join(",")})`);
}

async function recordFailure(context, runtime, failure) {
  context.appLog.push(`failure=${failure.message}`);
  if (runtime.sessionId) {
    await saveScreenshot(context.baseUrl, runtime.sessionId, context.artifactDir, context.appLog);
  }
  writeSummary(context.artifactDir, {
    ok: false,
    error: failure.message,
    binaryPath: context.binaryPath,
    port: context.port,
  });
}

async function cleanup(context, runtime) {
  if (runtime.sessionId) await deleteSession(context.baseUrl, runtime.sessionId, context.appLog);
  await stopDriver(runtime.driver, context.appLog);
  fs.writeFileSync(path.join(context.artifactDir, "app.log"), `${context.appLog.join("\n")}\n`, "utf8");
}

async function waitForDriver(baseUrl, driver, getStartError) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    if (getStartError()) throw getStartError();
    if (driver.exitCode !== null) {
      throw new Error(`tauri-driver exited before becoming ready (code ${driver.exitCode})`);
    }
    try {
      const response = await request(baseUrl, "/status", { method: "GET" });
      if (response.value?.ready !== false) return;
      lastError = "driver reported not ready";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(pollIntervalMs);
  }
  throw new Error(`timed out waiting for tauri-driver: ${lastError}`);
}

async function createSession(baseUrl, binaryPath) {
  const response = await request(baseUrl, "/session", {
    method: "POST",
    body: JSON.stringify({
      capabilities: {
        alwaysMatch: {
          "tauri:options": { application: binaryPath },
        },
      },
    }),
  });
  const sessionId = response.sessionId || response.value?.sessionId;
  if (!sessionId) throw new Error("tauri-driver did not return a WebDriver session id");
  return sessionId;
}

async function waitForWorkbench(baseUrl, sessionId, appLog) {
  const deadline = Date.now() + timeoutMs;
  let lastHeading = "";
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const state = await executeSync(baseUrl, sessionId, `
        return (() => {
          const skip = [...document.querySelectorAll("button")]
            .find((button) => (button.textContent || "").includes("暂时跳过"));
          if (skip) {
            skip.click();
            return { heading: "", clickedSkip: true };
          }
          return { heading: document.querySelector("h1, h2")?.textContent?.trim() || "", clickedSkip: false };
        })();
      `);
      if (state?.clickedSkip) appLog.push("dismissed first-run onboarding");
      lastHeading = state?.heading || "";
      if (lastHeading === "工作报告工作台") return lastHeading;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(pollIntervalMs);
  }
  throw new Error(`timed out waiting for workbench heading: ${lastHeading || lastError || "<empty>"}`);
}

async function executeSync(baseUrl, sessionId, script) {
  const response = await request(baseUrl, `/session/${encodeURIComponent(sessionId)}/execute/sync`, {
    method: "POST",
    body: JSON.stringify({ script, args: [] }),
  });
  return response.value;
}

async function executeAsync(baseUrl, sessionId, script) {
  const response = await request(baseUrl, `/session/${encodeURIComponent(sessionId)}/execute/async`, {
    method: "POST",
    body: JSON.stringify({ script, args: [] }),
  });
  return response.value;
}

async function saveScreenshot(baseUrl, sessionId, artifactDir, appLog) {
  try {
    const response = await request(baseUrl, `/session/${encodeURIComponent(sessionId)}/screenshot`, { method: "GET" });
    if (response.value) {
      fs.writeFileSync(path.join(artifactDir, "failure.png"), Buffer.from(response.value, "base64"));
      appLog.push("saved failure.png");
    }
  } catch (error) {
    appLog.push(`screenshot failed=${error instanceof Error ? error.message : String(error)}`);
  }
}

async function deleteSession(baseUrl, sessionId, appLog) {
  try {
    await request(baseUrl, `/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    appLog.push("session deleted");
  } catch (error) {
    appLog.push(`session delete failed=${error instanceof Error ? error.message : String(error)}`);
  }
}

async function stopDriver(driver, appLog) {
  if (!driver) return;
  if (driver.exitCode !== null) {
    appLog.push("driver already stopped");
    return;
  }
  driver.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3_000);
    driver.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  appLog.push("driver stopped");
}

async function request(baseUrl, route, options) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { value: text };
  }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${route} -> HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function captureStream(stream, filePath) {
  const chunks = [];
  stream?.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  stream?.on("close", () => fs.writeFileSync(filePath, Buffer.concat(chunks), "utf8"));
}

function writeSummary(artifactDir, summary) {
  fs.writeFileSync(path.join(artifactDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
