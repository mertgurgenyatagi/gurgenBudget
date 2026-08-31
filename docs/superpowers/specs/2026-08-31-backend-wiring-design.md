# Backend Wiring — Design

Branch: `backend-wire` (from `main` at `54953e3`).

## Goal

Replace every hardcoded placeholder figure across the eight ring screens plus
`/history` with real data: a Firestore-backed data model, the formulas from
PROJECT.md (with Buffer reworked from a flat ₺/day amount to a percentage),
and the write-side interactions needed to actually create and edit that data
(item add/edit, day logging, Buffer settings, sign out).

This is UI-and-data wiring, not a redesign. Every screen keeps its already-
picked visual design; this pass makes the numbers on them real and makes the
inert affordances ("+ Add", "log", "Sign out") actually do something.

## Non-goals

- No new Exhibop-style design exploration. History reuses the existing
  `MonthSetupScreen` and Wishlist presentation rather than getting its own
  visual pass.
- No data migration/seeding tooling — every account starts empty, per the
  spec's "no first-run onboarding" principle.
- No UI for the quiet deleted-item history or the quiet Base-item amount
  history. Both are explicitly unsurfaced safety nets, not user-facing
  features (PROJECT.md, "Retroactive Recalculation & The Data Model").
- No offline-conflict handling beyond whatever the Firestore SDK gives for
  free.
- No changes to the ring navigation, palette, or any already-shipped screen
  layout beyond what's needed to plug in real data and the new interactions
  described below.

## Data model (Firestore)

All paths are under `users/{uid}/`, already scoped by `firestore.rules`.

```
items/{itemId}
  category: 'baseIncome' | 'flexIncome' | 'baseSpend' | 'flexSpend' | 'wishlist'
  name: string
  amount: number
  history: { amount: number, until: MonthKey }[]
  createdMonth: MonthKey
  deletedMonth: MonthKey | null
  month: MonthKey | null        // null for base items
  deleted: boolean
  purchased: boolean            // meaningful only when category === 'wishlist'

days/{DayKey}                   // e.g. "2026-04-15"
  amount: number                // raw signed bank-balance change for that day

settings/buffer
  percent: number                // whole percentage points — 10 means 10%, not 0.10
  mode: 'surplus' | 'slice'
  history: { percent: number, mode: 'surplus' | 'slice', until: MonthKey }[]
```

Item `amount` and day-log `amount` are always whole lira (integers) — the
numeric inputs for both round to whole numbers as the user types, matching
PROJECT.md's "no kuruş, no decimal places, anywhere in the app, including
inputs." The Buffer `percent` is a rate, not a currency figure, so that rule
doesn't apply to it — it accepts decimals (e.g. `7.5`).

`MonthKey` is `"YYYY-MM"`, `DayKey` is `"YYYY-MM-DD"`. Both are derived from a
fixed UTC+3 offset (Turkey has run no DST since 2016, so a plain offset
constant is correct — no timezone library needed), never from the device's
local time. There is no stored "current month" pointer anywhere: it's always
computed fresh from the wall clock, which is what makes month rollover a
no-op rather than a job — the spec's "lazy/on-visit" requirement falls out
for free.

**One collection for all five categories**, discriminated by `category`,
was chosen over five separate collections specifically because moving an
item between Flex Spend and Wishlist — which the spec requires sharing one
add entry point — is then a single-field update on the same doc. The item
keeps its id and its (empty, for flex/wishlist) history. Five collections
would force a delete-and-recreate on that move, severing the quiet-history
undo backstop the spec asks for.

Moving an item out of `wishlist` always resets `purchased` to `false` —
`purchased` has no meaning outside the Wishlist.

**History-append rule**, used identically by `editItem` and `setBuffer`:
when a value changes, append `{ old value, until: prevMonth(effectiveMonth) }`
to `history` — *unless* an entry with that exact `until` already exists, in
which case only the live value is overwritten. This is what makes editing
the same item twice within one month a single retroactive change rather
than a stack of history entries, and it's why a base item's `history` array
only ever gains an entry on the *first* edit that crosses a given month
boundary. `effectiveMonth` is whichever month the edit happens against: the
current month for every ring screen, or the viewed month when editing from
inside History — `editItem(item, changes, month)` and `setBuffer(value, month)`
both take that month explicitly rather than assuming "now".

## Formulas (`src/lib/formulas.ts`)

`amountInMonth(item, month)` is the one function that makes retroactive
editing and forward-only base creation/deletion both work, for every
category, for any month:

- Base items: `null` before `createdMonth`; `null` at/after `deletedMonth`
  if set; otherwise the historic amount resolved by walking `history` for
  the newest entry whose `until >= month`, falling back to the live
  `amount`.
- Flex/Wishlist items: `null` unless `item.month === month`; otherwise same
  historic-amount resolution (in practice a no-op, since these items only
  ever have one month to resolve against).
- Either kind: `null` if `item.deleted`.

```
Surplus = BaseIncome + FlexIncome − BaseSpend − FlexSpend

// pct = buffer.percent / 100

// buffer.mode === 'surplus'
DailyAllowance = (Surplus × (1 − pct) − Wishlist) / daysInMonth

// buffer.mode === 'slice'
DailyAllowance = ((Surplus − Wishlist) / daysInMonth) × (1 − pct)

MoneySaved = Surplus + spendSoFar − (DailyAllowance × remainingDays) − purchasedTotal
```

**Sign note, caught while drafting the formula tests, worth recording so it
doesn't regress:** `spendSoFar` sums the *raw* daily logs — negative when
money left the account, per the Daily Log's own convention (PROJECT.md:
"the raw, whole change in their bank balance for that day"). PROJECT.md's
prose ("Surplus − sum of actual daily logs") reads as a subtraction, but
taken literally with that sign convention it's wrong: plugging in numbers
(Surplus 10,000, no Wishlist, no Buffer, spending exactly the ₺333/day
allowance for 10 days) makes Money Saved *climb* from 0 toward 20,000 over
the month under literal subtraction — i.e. spending exactly your allowance
would manufacture money from nowhere. Money Saved is supposed to **sit
flat** at the cushion value while spending stays on pace (PROJECT.md's own
word is "sitting", not "arriving at"), which only holds with `+ spendSoFar`
as written above. Re-verified against the hand-derived example: both modes
still land exactly on `Wishlist + bonus` at month end with this sign.

`MoneySaved` takes no branch on Buffer mode — it consumes whichever
`DailyAllowance` was already computed. Verified both modes preserve the
"spend exactly the allowance every day → Money Saved covers the current
Wishlist plus a bonus cushion" identity PROJECT.md calls load-bearing:
the bonus is `Surplus × pct` under `surplus` mode, `(Surplus − Wishlist) × pct`
under `slice` mode. PROJECT.md's illustrative sentence describing that
identity under the old flat Buffer will need its wording/numbers updated
once this ships — noted here so it isn't forgotten, not done as part of
this spec.

The Buffer percent and mode both follow the same forward-only, quiet-history
rule the flat Buffer amount already had: a change only applies to months
from that point forward; past months keep resolving against whichever
`{percent, mode}` was in effect at the time, via the same kind of
history-walk as item amounts. No 0–100 clamp on the percent input — every
other amount field in the app already refuses to block zero, negative, or
unusual values, and this is the same kind of field.

`computeMonth(items, days, buffer, month, at?)` bundles all of the above
into the one result every screen actually consumes.

## Data layer (`src/data/DataContext.tsx`)

A `DataProvider` context wraps the app inside `RequireAuth`, holding three
live `onSnapshot` listeners (`items`, `days`, `settings/buffer`) plus the
write functions: `addItem`, `editItem`, `deleteItem`, `moveItem`,
`setPurchased`, `logDay`, `setBuffer`. A `useData()` hook is the only way
any screen touches Firestore — no screen calls Firestore directly.

Every write is optimistic-by-default (Firestore's own local cache + live
listener handles the round-trip); a `saveError` surfaces on the (rare)
failure the same way across every screen, rather than each screen inventing
its own error handling.

## Screen wiring

- **Dashboard** — unchanged layout; the hardcoded `₺284` becomes
  `computeMonth(...).dailyAllowance` for the current month.
- **Base Income / Flex Income / Base Spend / Flex Spend** (shared
  `MonthSetupScreen`) — real items + total for the current month via
  `categoryTotal`. "+ Add" and tapping a row open the item sheet.
- **Wishlist** — real items + `moneySaved` for the current month. Tapping
  an item opens the item sheet.
- **Calendar** — a `viewedMonth` (defaults to the current month) that the
  `‹ ›` header steps through: unlimited backward, capped at the actual
  current month going forward (future days can't be logged; future months
  have no items yet). Tapping any cell opens a minimal inline number input
  to set/correct that day's raw amount; clearing it deletes the `days` doc,
  returning the day to unlogged. Tint and the allowance line use the real
  formulas for `viewedMonth`.
- **Settings** — Buffer becomes a percent input plus the two-option
  `surplus`/`slice` mode toggle, both wired through `setBuffer` (which
  implements the forward-only history rule above). Email comes from real
  auth state. "Sign out" calls Firebase's `signOut()`. "History ›"
  navigates to `/history`.
- **History** (`/history`, replacing its current `RingPage` placeholder) —
  its own small month stepper (same forward cap at the current month as
  Calendar's, for the same reason), a Surplus/Allowance/Money Saved summary
  line, then the four category breakdowns and the Wishlist list stacked
  underneath — reusing `MonthSetupScreen` and the Wishlist presentation
  fed a past `month` instead of the current one. Tapping an item opens the
  same item sheet as everywhere else; nothing here is read-only, matching
  PROJECT.md's "no locking, ever."

## The item sheet (`src/routes/pages/ItemSheet.tsx`, new)

One shared component, opened by "+ Add" (empty) or by tapping an existing
row (pre-filled, with a Delete action). Two flavors by category:

- **Base Income / Flex Income / Base Spend** — name, amount.
- **Flex Spend / Wishlist** — name, amount, a Flex Spend ⇄ Wishlist toggle,
  and (only while the item is currently categorized as Wishlist) a
  Purchased checkbox.

No required-field validation on name or amount, consistent with every
other numeric field in the app.

## Testing scope

Vitest (new devDependency; nothing else about the toolchain changes) over
`src/lib/formulas.ts` only — no component tests, no Firestore emulator.
Planned cases:

1. Base item: `amountInMonth` is `null` before `createdMonth`.
2. Base item: resolves the live `amount` with no history.
3. Base item: an edit's history entry resolves the *old* amount for months
   at/before the boundary, and the *new* amount after.
4. Base item: editing twice within the same month does not double-record
   a history entry at the same boundary.
5. Base item: `null` at and after `deletedMonth`; still resolves normally
   the month before deletion.
6. Flex/Wishlist item: `null` outside its one `month`.
7. Flex/Wishlist item: `null` once `deleted` is true.
8. `surplus` — positive and negative cases.
9. `dailyAllowance` under `mode: 'surplus'` matches the hand-derived example.
10. `dailyAllowance` under `mode: 'slice'` matches the hand-derived example.
11. `moneySaved` end-of-month identity holds under both Buffer modes.
12. An unlogged day contributes zero to `spendSoFar`.

## File layout

```
src/lib/time.ts              MonthKey/DayKey helpers, Turkey offset
src/lib/formulas.ts           Category/Item/HistoryEntry/Buffer types + formulas
src/money.ts                  (already exists — unchanged)
src/data/DataContext.tsx      DataProvider + useData()
src/routes/pages/ItemSheet.tsx  shared add/edit sheet
src/routes/History.tsx        real History screen (replaces RingPage placeholder)
```

Existing screen files (`Dashboard.tsx`, `Wishlist.tsx`, `DailyLog.tsx`,
`Settings.tsx`, `MonthSetupScreen.tsx` and its four thin wrappers) are
edited in place to consume `useData()` instead of hardcoded arrays.
