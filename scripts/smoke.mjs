import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { getAIModel } from "../src/lib/ai-provider.server.ts";

// No paid API calls. Verify disabled/incomplete configuration fails closed.
delete process.env.AI_ENABLED;
assert.throws(() => getAIModel(), /desativada/);
process.env.AI_ENABLED = "true";
delete process.env.AI_API_KEY;
assert.throws(() => getAIModel(), /configurada/);
process.env.AI_API_KEY = "test-only";
process.env.AI_BASE_URL = "http://example.invalid/v1";
process.env.AI_MODEL = "test-only";
assert.throws(() => getAIModel(), /HTTPS/);
process.env.AI_ENABLED = "false";
console.log("PASS: AI disabled, missing credentials, insecure endpoint");

const server = spawn(process.execPath, [".output/server/index.mjs"], {
  env: { ...process.env, PORT: "3187", HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (data) => {
  logs += data;
});
server.stderr.on("data", (data) => {
  logs += data;
});
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      await fetch("http://127.0.0.1:3187/");
      ready = true;
      break;
    } catch {
      await delay(250);
    }
  }
  assert.ok(ready, "Production server failed to start: " + logs);
  for (const [path, status] of [
    ["/", 200],
    ["/login", 200],
    ["/cadastro", 200],
    ["/jogar", 200],
    ["/app", 200],
    ["/nao-existe", 404],
  ]) {
    const response = await fetch("http://127.0.0.1:3187" + path);
    const html = await response.text();
    assert.equal(response.status, status, path);
    assert.match(html, /Professor Play/, path);
    if (path === "/login")
      assert.ok(!html.includes("Continuar com o Google"), "Google must be hidden by default");
    console.log("PASS:", path, status);
  }
} finally {
  server.kill("SIGTERM");
}
