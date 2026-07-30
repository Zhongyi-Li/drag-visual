import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const [sourceArgument, destinationArgument] = process.argv.slice(2);

if (!sourceArgument || !destinationArgument) {
  throw new Error("Usage: node make-portable-api-runtime.mjs <source> <destination>");
}

const source = resolve(sourceArgument);
const destination = resolve(destinationArgument);
const sourceNodeModules = join(source, "node_modules");
const destinationNodeModules = join(destination, "node_modules");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const entry of await readdir(source)) {
  if (entry === "node_modules") continue;
  await cp(join(source, entry), join(destination, entry), {
    recursive: true,
    dereference: true,
    force: true,
  });
}

await mkdir(destinationNodeModules, { recursive: true });

for (const entry of await readdir(sourceNodeModules)) {
  // pnpm's virtual store contains the link targets. The top-level entries are
  // copied with dereference enabled, producing a standard portable tree.
  if (entry === ".pnpm" || entry === ".cache" || entry === ".vite" || entry === ".vite-temp") continue;
  await cp(join(sourceNodeModules, entry), join(destinationNodeModules, entry), {
    recursive: true,
    dereference: true,
    force: true,
  });
}
