# Badminton Ledger

Track your badminton group’s contributions, expenses, dues, and loans in Bangladeshi Taka.

## Downloads

| Platform | Download |
| --- | --- |
| Android · ARM64 | [APK](https://github.com/khalids01/badmintion-ledger/releases/latest/download/badminton-ledger-android-arm64.apk) |
| Mac · Apple Silicon | [DMG](https://github.com/khalids01/badmintion-ledger/releases/latest/download/badminton-ledger-macos-arm64.dmg) |
| Mac · Intel | [DMG](https://github.com/khalids01/badmintion-ledger/releases/latest/download/badminton-ledger-macos-x86_64.dmg) |

[All releases](https://github.com/khalids01/badmintion-ledger/releases) · [Build history](https://github.com/khalids01/badmintion-ledger/actions)

For Mac, choose **arm64** for M-series or **x86_64** for Intel. Mac builds are not Apple-notarized; first launch may require approval in Privacy & Security.

## First launch

Set up the administrator account for `khalids8774@gmail.com`, confirm the email, and sign in. Setup is available only once. Add your members, assign dues, and start recording transactions.

In **Settings → Club administration**, enable or disable signup, approve accounts into the club, edit names, remove membership, or ban and unban users. New accounts have no ledger access until approved. Approved members can view the shared ledger; only the administrator can edit it. Signups start disabled.

The app checks for updates on startup. Check manually in **Settings → Application updates**. Appearance settings offer **Light**, **Dark**, and **System** modes.

## Development

```sh
npm ci
cp .env.example .env  # Add your Supabase URL and publishable key.
npm run dev
```

Open http://localhost:3000. Run `npm test`, `npm run lint`, and `npm run build` to check changes.

[Publishing updates](docs/releases.md) · Database migrations: `supabase/migrations/`
