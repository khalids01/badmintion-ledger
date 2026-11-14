# Implementation checklist
- [x] Inspect empty repository and discover connected projects
- [x] Confirm new project and organization with user
- [x] Create active Supabase project `wjrlgcvyefbewkkwnvlv`
- [x] Initialize React, TypeScript, Vite, Tailwind and Tauri 2
- [x] Implement integer-minor-unit accounting and tests
- [x] Build responsive dashboard, transactions, members, dues, reports, settings
- [x] Implement administrator authentication, password recovery, first-run member setup, CSV and error states
- [x] Apply ownership-safe schema, constraints, RLS and serialized loan validation
- [x] Generate TypeScript database types
- [x] Verify RLS, cross-owner foreign keys, categories and financial constraints with rolled-back database fixtures
- [x] Verify anonymous REST access denied and unauthorized email signup rejected
- [x] Run Supabase security advisor (no findings)
- [x] Typecheck, lint, accounting and component tests, production frontend build
- [x] Cargo check and Tauri Linux debug build
- [ ] Visual browser QA: browser host unavailable
- [ ] Real administrator sign-in/session persistence: user must first choose a password and confirm their email
- [ ] Android build: initialization attempted; Java/Android SDK/NDK absent
- [ ] iOS build: requires macOS/Xcode; unavailable on Linux
- [ ] Native device CSV download and email callback verification

Preview data lives only in memory. All real records use the connected Supabase SDK and owner-scoped RLS.
