import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import process from "node:process";

const root = new URL("../../../", import.meta.url);

const run = async (command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${String(code ?? signal)})`,
    );
  }
};

const reservePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Could not reserve a smoke-test port");
  }
  const { port } = address;
  server.close();
  await once(server, "close");
  return port;
};

const waitForHealth = async (child, port) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("Production API exited before it became healthy");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // Startup races are expected until the listener is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Production API did not become healthy within 10 seconds");
};

await run("pnpm", ["--filter", "@drag-visual/api", "build"]);

const port = await reservePort();
const api = spawn("node", ["apps/api/dist/main.js"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/drag_visual_smoke",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const apiExit = once(api, "exit");
let output = "";
api.stdout.setEncoding("utf8");
api.stderr.setEncoding("utf8");
api.stdout.on("data", (chunk) => {
  output += chunk;
});
api.stderr.on("data", (chunk) => {
  output += chunk;
});

try {
  await waitForHealth(api, port);
} catch (error) {
  throw new Error(`${error.message}\n${output}`);
} finally {
  if (api.exitCode === null && api.signalCode === null) api.kill("SIGTERM");
  await apiExit;
}

process.stdout.write("Production API start smoke passed\n");
