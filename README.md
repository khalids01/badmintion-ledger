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

## What the app does

Four tabs, mobile-first, with Settings in the header:

- **Home** — a large cash-in-hand hero (actual available cash), compact cards for outstanding member dues and total club spending, plus a visible club-debt indicator when loans are outstanding. Two quick actions: **Collect money** and **Add expense**. Lists the members who still owe and recent transactions.
- **Members** — searchable compact list with avatars, dues status and amount. Opens a dedicated member detail with total fees charged, total payments, remaining dues, and full history (cash, personal purchases, loans). Includes a **Record payment** button preselected to that member. Switch to the **Dues** tab for balances, fee assignments and member-balance CSV export.
- **Transactions** — chronological, grouped by date, compact rows distinguishing incoming money, expenses and loans. Search plus a type filter; member, category and date filters hide under **Filters** until needed. Tap a row for its detail; edit or void with confirmation.
- **Reports** — monthly income vs expenses, weekly cash in/out, expenses by category, fee payments by member, cash balance history, and club debts. Date-range selection and CSV exports.

One global **Add** button opens a sheet with four options:

1. **Collect money** — member payment; select member, amount, note (optional), save.
2. **Add expense** — club expense; amount, category, details.
3. **Borrow or repay** — club borrows from a member, or repays one.
4. **Assign dues** — entry or weekly fees to selected members in bulk.

Focused forms hide advanced fields under **Advanced details**. Approved read-only members get the same layout with no edit or admin actions.

The cash view shows actual available cash, not total contributions or dues. A non-cash contribution never increases available cash. Loan repayments from a fee payment save together — the payer gets full fee credit and both entries stay linked.

## Your club's ledger

In **Settings → Club administration**, enable or disable signup, approve accounts into the club, edit names, remove membership, or ban and unban users. New accounts have no ledger access until approved. Approved members can view the shared ledger; only the administrator can edit it. Signups start disabled.

Choose **English** or **বাংলা** from the language selector; your preference is saved. Link your own member profile in **Settings → My member profile**.

When recording a fee payment, enable **Use this payment to repay a loan**, choose the lender, and enter the repayment amount. The payer receives full fee credit; both cash movements save together. Open either transaction to view its linked entry.

The app checks for updates on startup. Check manually in **Settings → Application updates**. Appearance settings offer **Light**, **Dark**, and **System** modes.

## Development

```sh
npm ci
cp .env.example .env  # Add your Supabase URL and publishable key.
npm run dev
```

Open http://localhost:3000. Run `npm test`, `npm run lint`, and `npm run build` to check changes.

[Publishing updates](docs/releases.md) · Database migrations: `supabase/migrations/`

Temporary players can contribute any amount and are not selected by default for fee assignments. Existing payments have an **Apply to loan repayment** action; this adds only the repayment. **Screenshot** saves the current page or open details as a PNG, while **CSV export** downloads ledger data.
