"use strict";

const fs = require("node:fs/promises");
const { createReadStream, createWriteStream } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { execFileSync } = require("node:child_process");

const VERSION = "1.0.102";
async function sha256(file) {
  const hash = crypto.createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

async function install() {
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("This installer currently supports Windows x64 only.");
  const cache = path.join(process.env.LOCALAPPDATA, "sdd-studio-build", `copilot-${VERSION}`);
  await fs.mkdir(cache, { recursive: true });
  const response = await fetch(`https://api.github.com/repos/github/copilot-cli/releases/tags/v${VERSION}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`GitHub release metadata returned HTTP ${response.status}.`);
  const release = await response.json();
  const names = ["copilot-win32-x64.zip"];
  const records = [];
  for (const name of names) {
    const asset = release.assets.find(item => item.name === name);
    if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest) || new URL(asset.browser_download_url).origin !== "https://github.com") throw new Error(`No verified official asset: ${name}`);
    const file = path.join(cache, name);
    let present = false;
    try { present = `sha256:${await sha256(file)}` === asset.digest; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!present) {
      const download = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(180000) });
      if (!download.ok) throw new Error(`GitHub asset returned HTTP ${download.status}.`);
      await pipeline(Readable.fromWeb(download.body), createWriteStream(file));
    }
    if (`sha256:${await sha256(file)}` !== asset.digest) throw new Error(`SHA-256 mismatch: ${name}`);
    records.push({ name, digest: asset.digest, source: asset.browser_download_url });
  }
  const unpack = await fs.mkdtemp(path.join(cache, "sdk-extract-"));
  const vendor = path.join(__dirname, "vendor", "copilot");
  await fs.mkdir(vendor, { recursive: true });
  try {
    execFileSync("tar.exe", ["-xf", path.join(cache, names[0]), "-C", unpack]);
    await fs.copyFile(path.join(unpack, "copilot.exe"), path.join(vendor, "copilot.exe"));
    const reported = execFileSync(path.join(vendor, "copilot.exe"), ["--no-auto-update", "--version"], {
      env: { ...process.env, COPILOT_AUTO_UPDATE: "false" }, encoding: "utf8",
    });
    if (!reported.includes(VERSION)) throw new Error("The verified portable CLI did not report the pinned version.");
    const extracted = path.join(process.env.LOCALAPPDATA, "copilot", "pkg", "win32-x64", VERSION);
    const source = path.join(extracted, "copilot-sdk");
    await fs.access(path.join(source, "index.js"));
    await fs.cp(source, path.join(vendor, "sdk"), { recursive: true });
    await fs.copyFile(path.join(extracted, "LICENSE.md"), path.join(vendor, "LICENSE.md"));
    await fs.writeFile(path.join(vendor, "package.json"), JSON.stringify({ private: true, type: "module" }) + "\n");
    await fs.writeFile(path.join(vendor, "provenance.json"), JSON.stringify({
      runtimeVersion: VERSION, sdkVersion: `CLI-bundled-${VERSION}`, assets: records,
      sdkSource: "Matched SDK from the pinned portable CLI's self-extracted package",
      sdkSha256: await sha256(path.join(vendor, "sdk", "index.js")),
      executableSha256: await sha256(path.join(vendor, "copilot.exe")),
    }, null, 2) + "\n");
  } finally {
    await fs.rm(unpack, { recursive: true, force: true });
  }
  console.log(`Official Copilot ${VERSION} CLI + matched public SDK installed; published asset SHA-256 digests verified. No npm registry required.`);
}

install().catch(error => { console.error(error.message); process.exitCode = 1; });
