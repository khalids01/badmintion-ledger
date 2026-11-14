# Badminton Ledger

A mobile-first React/TypeScript financial ledger with a Tauri 2 native shell and Supabase backend. Desktop uses a sidebar; phones use bottom navigation. Currency is BDT and dates use Asia/Dhaka.

## Downloads

| Platform | Download |
| --- | --- |
| Android · ARM64 | [Download APK archive](https://github.com/khalids01/badmintion-ledger/actions/runs/43594597679/artifacts/14113628731) |
| Mac · Apple Silicon (M-series) | [Download DMG and app ZIP](https://github.com/khalids01/badmintion-ledger/actions/runs/43594597696/artifacts/14113258955) |
| Mac · Intel | [Download DMG and app ZIP](https://github.com/khalids01/badmintion-ledger/actions/runs/43594597696/artifacts/14113229764) |

Sign in to GitHub, download and unzip the artifact, then open the APK or DMG. These downloads include checksums and expire **December 14, 2026**. For newer builds, visit [Android builds](https://github.com/khalids01/badmintion-ledger/actions/workflows/android-apk.yml) or [Mac builds](https://github.com/khalids01/badmintion-ledger/actions/workflows/macos.yml).

Android builds are debug-signed. Mac builds are ad-hoc signed and not Apple-notarized; first launch may require approval in **System Settings → Privacy & Security**.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The ignored `.env` is configured for the new **Badminton Ledger** Supabase project (`wjrlgcvyefbewkkwnvlv`). `.env.example` lists the required public configuration. No service-role key is used.

On the login screen, choose **First time? Set up administrator account**, set a password for **khalids8774@gmail.com**, and confirm the Supabase email. Then sign in. Other email addresses are blocked by a database trigger. This is administrator-only provisioning; group members have no login or registration.

Choose **Explore the sample ledger** to try the app without an account. Preview data is isolated in memory and resets on reload. It is never sent to Supabase.

After signing in, add yourself as a member and select **This is me**. All eight expense categories are created automatically. Add members, assign dues, then record transactions.

## Native builds

```sh
npm run tauri -- dev
npm run tauri -- build
npm run tauri -- android init
npm run tauri -- android build --apk
```

Android requires Java, Android SDK/NDK and the Android Rust targets; these are not installed on this host. iOS requires macOS, Xcode and Apple signing. Tauri uses only `core:default`; no shell or filesystem plugins are enabled. CSV export uses the WebView download mechanism and needs device verification before shipping native mobile releases.

## Backend

Applied migrations are in `supabase/migrations`. Types generated from the connected database are in `src/lib/database.types.ts`. Tables have RLS and composite foreign keys to prevent cross-owner references. No client delete access exists: members/categories are archived and transactions are voided with a reason. Voided entries cannot be changed. Loan checks execute in the database and serialize writes per owner to prevent concurrent overpayment.

Categories are seeded by an invoker trigger when the first member is added. No balance fields are stored. `src/lib/accounting.ts` derives totals using integer poisha; PostgreSQL uses NUMERIC(12,2).

For web hosting, add the deployment origin to Supabase Authentication → URL Configuration. The local app uses port 3000 to match Supabase’s default local Site URL. If confirmation or recovery links do not return to the app, set the Site URL to http://localhost:3000 and add that origin to the redirect allowlist. The connected MCP integration does not expose Auth configuration updates. Native email recovery should be opened in the local web app until a platform deep-link flow is configured.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

`supabase/tests/ledger_rls.sql` runs temporary fixtures and rolls back everything. It verifies owner isolation, cross-owner inserts and foreign keys, seeded categories, valid transaction combinations, and excessive loan repayment rejection. Run only against this project's schema using a privileged SQL connection. Test fixtures use privileged SQL provisioning inside the rolled-back transaction.

The Supabase security advisor reported no findings after schema setup. UI interaction tests exercise temporary preview records; manual browser/device QA and a real email-confirmed administrator sign-in remain release checks.

## Download an Android APK from GitHub

Every push to `main`, pull request, and manual **Run workflow** starts **Build Android APK**. It runs type checking, lint, and tests, installs Java/Android SDK/NDK/Rust, generates the Tauri Android project, and builds an **ARM64 debug APK**.

1. Open [Actions → Build Android APK](https://github.com/khalids01/badmintion-ledger/actions/workflows/android-apk.yml).
2. Open a successful run and download **badminton-ledger-android-arm64-…** from **Artifacts** (or use the run summary download link).
3. Unzip the archive and install `badminton-ledger-arm64-debug.apk`. Allow installation from your browser/file manager if Android requests it. The archive includes a SHA-256 checksum.

Artifacts are kept for 30 days. GitHub requires signing in to download Actions artifacts. The APK is debug-signed and intended for personal testing, not Google Play distribution. Different fresh runners can generate different debug signing keys; uninstall an older test build if Android refuses an update. Uninstalling clears the local login session; your financial records remain in Supabase.

The workflow supplies the connected project's public Supabase URL and publishable key. Optional repository **Variables** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` override these defaults. No service-role key, account password, or private release signing key is needed. `.env` stays ignored.

## Download the Mac app from GitHub

[Actions → Build macOS installers](https://github.com/khalids01/badmintion-ledger/actions/workflows/macos.yml) builds on every push to `main`, pull request, or manual run. Choose the successful run and download the artifact for your Mac:

- **arm64**: Apple Silicon (M-series Macs).
- **x86_64**: Intel Macs.

Each artifact includes a **DMG installer**, a **ZIP of the app**, and **SHA256SUMS.txt**. Unzip the artifact, open the DMG, and drag **Badminton Ledger** into Applications. Downloads expire after 30 days; rerun the workflow to generate new ones. GitHub sign-in is required for artifact downloads.

The workflow verifies the app signature and CPU architecture before uploading. Builds are **ad-hoc signed, not Apple-notarized**; macOS may require first-launch approval under **System Settings → Privacy & Security**. Developer ID signing and notarization require your Apple Developer credentials, which are not configured here. See [Tauri’s macOS signing documentation](https://v2.tauri.app/distribute/sign/macos/).

Like the APK build, macOS builds use the connected Supabase public configuration and support optional repository-variable overrides. Private credentials and `.env` stay out of Git.
