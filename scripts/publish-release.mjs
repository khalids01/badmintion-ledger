import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const tag = `v${version}`;
if (process.env.GITHUB_REF_NAME !== tag)
  throw new Error("Release tag and app version do not match.");
const repo = process.env.GITHUB_REPOSITORY;
if (repo !== "khalids01/badmintion-ledger")
  throw new Error("Unexpected release repository.");
const root = "release-assets";
const expected = [
  "badminton-ledger-android-arm64.apk",
  ...["arm64", "x86_64"].flatMap((arch) =>
    [`.dmg`, `.app.zip`, `.app.tar.gz`, `.app.tar.gz.sig`].map(
      (ext) => `badminton-ledger-macos-${arch}${ext}`,
    ),
  ),
];
for (const name of expected) {
  if (!fs.statSync(path.join(root, name)).size)
    throw new Error("Empty release artifact: " + name);
}
const entry = (arch) => ({
  url: `https://github.com/${repo}/releases/download/${tag}/badminton-ledger-macos-${arch}.app.tar.gz`,
  signature: fs
    .readFileSync(
      path.join(root, `badminton-ledger-macos-${arch}.app.tar.gz.sig`),
      "utf8",
    )
    .trim(),
});
const arm = entry("arm64"),
  intel = entry("x86_64");
if (!arm.signature || !intel.signature)
  throw new Error("Missing update signatures.");
const notes = fs.readFileSync("RELEASE_NOTES.md", "utf8").trim();
const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "darwin-aarch64": arm,
    "darwin-aarch64-app": arm,
    "darwin-x86_64": intel,
    "darwin-x86_64-app": intel,
  },
};
fs.writeFileSync(
  path.join(root, "latest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const names = [...expected, "latest.json"];
fs.writeFileSync(
  path.join(root, "SHA256SUMS.txt"),
  names
    .map(
      (name) =>
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(root, name)))
          .digest("hex") +
        "  " +
        name,
    )
    .join("\n") + "\n",
);
names.push("SHA256SUMS.txt");
const headers = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!response.ok)
    throw new Error(
      `GitHub release request failed (${response.status}): ${await response.text()}`,
    );
  return response.status === 204 ? null : response.json();
}
const base = `https://api.github.com/repos/${repo}`;
const releases = await api(`${base}/releases?per_page=100`);
let release = releases.find((r) => r.tag_name === tag);
if (release && !release.draft)
  throw new Error(
    "This version is already published. Bump the app version for a new release.",
  );
if (!release)
  release = await api(`${base}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      name: `Badminton Ledger ${version}`,
      body: notes,
      draft: true,
      prerelease: false,
    }),
  });
for (const name of names) {
  const previous = release.assets?.find((a) => a.name === name);
  if (previous)
    await api(`${base}/releases/assets/${previous.id}`, { method: "DELETE" });
  await api(
    `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: fs.readFileSync(path.join(root, name)),
    },
  );
}
await api(`${base}/releases/${release.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ draft: false, make_latest: "true" }),
});
console.log(`Published https://github.com/${repo}/releases/tag/${tag}`);
