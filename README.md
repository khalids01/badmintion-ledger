# Badminton Ledger

A mobile-first React/TypeScript financial ledger with a Tauri 2 native shell and Supabase backend. Desktop uses a sidebar; phones use bottom navigation. Currency is BDT and dates use Asia/Dhaka.

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
