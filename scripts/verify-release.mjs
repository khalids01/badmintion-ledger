import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const config = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargo = fs
  .readFileSync("src-tauri/Cargo.toml", "utf8")
  .match(/^version = "([^"]+)"/m)?.[1];
if (pkg.version !== config.version || pkg.version !== cargo)
  throw new Error("Package, Tauri, and Cargo versions must match.");
if (process.env.GITHUB_REF_NAME !== `v${pkg.version}`)
  throw new Error(`Run this workflow on the v${pkg.version} tag.`);
if (!fs.readFileSync("RELEASE_NOTES.md", "utf8").trim())
  throw new Error("Add release notes first.");
console.log(`Release v${pkg.version} validated.`);
