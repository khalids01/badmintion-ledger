import fs from "node:fs";
import path from "node:path";
const root = "src-tauri/gen/android/app/src/main";
function findActivities(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? findActivities(path.join(dir, entry.name))
        : entry.name === "MainActivity.kt"
          ? [path.join(dir, entry.name)]
          : [],
    );
}
const activities = findActivities(root);
if (activities.length !== 1)
  throw new Error("Expected one generated Android MainActivity.");
const existing = fs.readFileSync(activities[0], "utf8");
// Preserve the generated Kotlin namespace, which may differ from applicationId.
const appPackage = existing.match(/^package\s+([^\r\n]+)/m)?.[1].trim();
if (!appPackage)
  throw new Error("Generated Android activity has no package declaration.");
const source = fs
  .readFileSync("src-tauri/android/MainActivity.kt", "utf8")
  .replace("__APP_PACKAGE__", appPackage);
fs.writeFileSync(activities[0], source);
fs.cpSync("src-tauri/icons/android", path.join(root, "res"), {
  recursive: true,
});
console.log(
  "Android system-bar safe area and branded launcher icons configured.",
);
