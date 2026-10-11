import "./require-linux.mjs";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import ts from "typescript";

// Archive Wrangler's final Linux bundle, including WASM modules, rather than
// rebuilding OpenNext or resolving Prisma again on the deploy operator's OS.
const directory = ".release/worker";
mkdirSync(directory, { recursive: true });
cpSync(".wrangler-dry-run", `${directory}/worker`, { recursive: true });
cpSync(".open-next/assets", `${directory}/assets`, { recursive: true });
const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", readFileSync("wrangler.jsonc", "utf8"));
if (parsed.error) throw new Error("Invalid Wrangler configuration");
const config = parsed.config;
delete config.$schema;
config.main = "worker/worker.js";
config.assets.directory = "assets";
config.no_bundle = true;
config.find_additional_modules = true;
config.rules = [{ type: "CompiledWasm", globs: ["**/*.wasm"], fallthrough: true }];
writeFileSync(`${directory}/wrangler.json`, JSON.stringify(config, null, 2));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) : {};
const release = {
  commit: git("rev-parse", "HEAD"),
  sourceHead: event.pull_request?.head.sha ?? git("rev-parse", "HEAD"),
  tree: git("rev-parse", "HEAD^{tree}"),
  platform: process.platform,
  node: process.version,
  workerSha256: createHash("sha256").update(readFileSync(`${directory}/worker/worker.js`)).digest("hex"),
};
writeFileSync(`${directory}/release.json`, JSON.stringify(release, null, 2));
execFileSync("tar", ["-czf", ".release/worker-release.tar.gz", "-C", directory, "."]);
console.log(`Packaged Linux Worker for ${release.sourceHead} (tree ${release.tree})`);
