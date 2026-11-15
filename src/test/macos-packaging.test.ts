import { afterEach, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0))
    rmSync(path, { recursive: true, force: true });
});
function packageApp(fail = "") {
  const root = mkdtempSync(join(tmpdir(), "macos-packaging-"));
  temporary.push(root);
  const bin = join(root, "bin"),
    temp = join(root, "temp"),
    app = join(root, "Badminton Ledger.app");
  mkdirSync(bin);
  mkdirSync(temp);
  mkdirSync(join(app, "Contents"), { recursive: true });
  writeFileSync(join(app, "Contents", "Info.plist"), "signed-app-fixture");
  writeFileSync(join(bin, "ditto"), '#!/bin/bash\ncp -R "$1" "$2"\n', {
    mode: 0o755,
  });
  writeFileSync(
    join(bin, "hdiutil"),
    `#!/bin/bash
set -eu
printf '%s\\n' "$1" >> "$PACKAGING_ROOT/calls"
if [ "$1" = "$FAIL_COMMAND" ]; then exit 17; fi
if [ "$1" = create ]; then
  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -srcfolder) staging=$2; shift 2 ;;
      *) output=$1; shift ;;
    esac
  done
  test "$(cat "$staging/Badminton Ledger.app/Contents/Info.plist")" = signed-app-fixture
  test "$(readlink "$staging/Applications")" = /Applications
  printf '%s' "$staging" > "$PACKAGING_ROOT/staging"
  touch "$output"
fi
`,
    { mode: 0o755 },
  );
  const output = join(root, "bundle with spaces", "ledger.dmg");
  const result = spawnSync(
    "bash",
    [resolve("scripts/package-macos-dmg.sh"), app, output],
    {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TMPDIR: temp,
        PACKAGING_ROOT: root,
        FAIL_COMMAND: fail,
      },
      encoding: "utf8",
    },
  );
  return { root, output, result, temp };
}
it("packages the signed app with an Applications shortcut and verifies the DMG without mounting it", () => {
  const { root, output, result } = packageApp();
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(output)).toBe(true);
  expect(readFileSync(join(root, "calls"), "utf8")).toBe("create\nverify\n");
  expect(existsSync(readFileSync(join(root, "staging"), "utf8"))).toBe(false);
});
for (const command of ["create", "verify"]) {
  it(`fails the job and cleans staging when hdiutil ${command} fails`, () => {
    const { root, result, temp } = packageApp(command);
    expect(result.status).toBe(17);
    expect(readFileSync(join(root, "calls"), "utf8")).toBe(
      command === "create" ? "create\n" : "create\nverify\n",
    );
    expect(execFileSync("ls", ["-A", temp], { encoding: "utf8" })).toBe("");
  });
}
