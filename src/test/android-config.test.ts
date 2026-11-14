import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const repo = process.cwd();
describe("generated Android shell configuration", () => {
  it("preserves the native namespace and installs safe-area handling plus branded icons", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-android-test-"));
    try {
      const main = path.join(dir, "src-tauri/gen/android/app/src/main");
      fs.mkdirSync(path.join(main, "java/com/example"), { recursive: true });
      fs.writeFileSync(
        path.join(main, "java/com/example/MainActivity.kt"),
        "package com.example.original\nclass MainActivity : TauriActivity() {}\n",
      );
      fs.mkdirSync(path.join(dir, "src-tauri/android"), { recursive: true });
      fs.copyFileSync(
        path.join(repo, "src-tauri/android/MainActivity.kt"),
        path.join(dir, "src-tauri/android/MainActivity.kt"),
      );
      fs.cpSync(
        path.join(repo, "src-tauri/icons/android"),
        path.join(dir, "src-tauri/icons/android"),
        { recursive: true },
      );
      const result = spawnSync(
        process.execPath,
        [path.join(repo, "scripts/configure-android.mjs")],
        { cwd: dir, encoding: "utf8" },
      );
      expect(result.status, result.stderr).toBe(0);
      const source = fs.readFileSync(
        path.join(main, "java/com/example/MainActivity.kt"),
        "utf8",
      );
      expect(source).toContain("package com.example.original");
      expect(source).toContain(
        "Type.systemBars() or WindowInsetsCompat.Type.displayCutout()",
      );
      expect(source).toContain(".setInsets(types, Insets.NONE)");
      expect(
        fs.readFileSync(path.join(main, "res/mipmap-hdpi/ic_launcher.png")),
      ).toEqual(
        fs.readFileSync(
          path.join(
            repo,
            "src-tauri/icons/android/mipmap-hdpi/ic_launcher.png",
          ),
        ),
      );
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});
