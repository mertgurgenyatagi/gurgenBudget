# Launch Hotfixes — Design

Branch: `launch-hotfixes` (from `main`).

## Goal

A batch of six agency/UX fixes to the shipped app, gathered from real use:

1. Every ring screen that deals with month-scoped data shares one browsable
   month, instead of each being pinned to "the current month."
2. The Daily Log allows logging today and future days, not just past ones.
3. The Wishlist Active checkbox moves from the item-edit sheet onto the list
   row itself.
4. The item-creation/edit sheet is removed entirely, replaced by inline
   editing directly on the list row, with instant boilerplate creation.
5. New Wishlist items default to inactive.
6. A new "Dynamic Allowance" setting recomputes today's spendable rate from
   money already spent this month, instead of a flat figure.

Several of these interact (1 and 2 both touch which month/day is "current";
4 subsumes 3's checkbox move), so this is one spec rather than six.

## Non-goals

- No new Exhibop-style visual exploration. Existing picked designs (bar
  share, ledger stub, classic month grid, two-tone Settings) are kept; rows
  get taller/gain inline controls, but the visual language doesn't change.
- No change to ring navigation, palette, or swipe mechanics.
- No persistence of the browsed month across reloads — it always resets to
  the real current month on open, same as today's lazy-rollover behavior.
- No uniqueness enforcement on boilerplate item names — `ItemNN` numbering
  only avoids obvious collisions within one add session, nothing more.
- Money Saved's ledger math and the Calendar's day-tint baseline are
  explicitly *not* touched by Dynamic Allowance (see §6).

## 1. Shared browsable month

A new `ViewedMonthContext` (`src/data/ViewedMonthContext.tsx`), provided
once around `<Ring>`, holds `{ month: MonthKey, next(), prev() }`,
initialized to `currentMonth()`.

Screens that currently call `currentMonth()` locally or hardcode `month`
props switch to `useViewedMonth()`:

- `Dashboard`, `Wishlist`, `BaseIncome`, `FlexIncome`, `BaseSpend`,
  `FlexSpend`, `DailyLog`.
- `Settings` is unaffected — it has no month-scoped content.

Each of those screens shows the same small `‹ MonthLabel ›` header
(extracted from `DailyLog`'s existing stepper into a shared
`MonthStepper` component used everywhere). Stepping the month on any one
screen moves all of them — swipe from Flex Spend (November) to Wishlist,
Wishlist is also on November.

This is what makes "set Flex values in advance" work: step forward to next
month on any Month Setup screen, add items there — they're created with
`month: viewedMonth`, same `addItem` call as today, just fed a different
month.

**Dashboard** shows whichever month is currently browsed rather than always
the real current month. Its label switches: `"Today"` when the browsed
month is the real current month, otherwise the month name (e.g.
`"November"`). The figure itself is `displayAllowance` for that month (see
§6 for the dynamic/flat distinction).

**History is deleted** — `src/routes/History.tsx`, its `/history` route in
`App.tsx`, and the "History ›" row in `Settings.tsx`. Its entire job
(browse a past month's full Base/Flex/Wishlist picture, fully editable) is
now native to the ring screens themselves via the shared month.

## 2. Present/future-day logging

`DailyLog`'s `future` cell state and the `onClick={() => !future && ...}`
guard are removed. Every cell — past, today, future — is clickable and
opens the same inline day-amount editor. Cell visual state collapses to
just `logged` / `unlogged` (tinted vs. not); there's no more third state.

### Formula fix: remaining days becomes log-based, not date-based

Today, Money Saved's "remaining days to project" is purely calendar-driven
(`daysInMonth − elapsedDays`), while `spendSoFar` sums every logged day in
the month regardless of date. Once a future day can carry a real log entry,
that day would be counted twice: once as an actual (via `spendSoFar`), once
as a projected allowance day (via `remaining`).

Fix — replace the calendar-based remaining-days count with a log-based one,
in `src/lib/formulas.ts`:

```ts
function remainingDays(days: Map<DayKey, number>, month: MonthKey, at?: Date): number {
  const now = currentMonth(at)
  if (month < now) return 0
  const total = daysInMonth(month)
  const from = month === now ? todayDayOfMonth(at) : 1
  let count = 0
  for (let d = from; d <= total; d++) {
    if (!days.has(dayKey(month, d))) count++
  }
  return count
}
```

`moneySaved` uses this instead of `daysInMonth(month) - elapsedDays(month, at)`.
Behavior is unchanged for every case that already works today (a past
month's remaining is 0; an unlogged past day within the current month still
reads as "$0 spent," since it's before `from` and only affects `spendSoFar`,
not `remaining`); the only new behavior is that a *logged* future day now
correctly drops out of the projected bucket instead of being double-counted.
`elapsedDays` itself stays as-is in `time.ts` (still used for
`todayDayOfMonth`-relative display elsewhere) — only `moneySaved`'s
remaining-days source changes.

## 3 & 5. Wishlist Active checkbox moves to the row; defaults off

Covered by §4 below, since the sheet these currently live in is removed
entirely. Net effect: `WishlistBody`'s row gains an inline checkbox wired
straight to `setActive(item, checked)`. `DataContext.addItem` defaults
`active: false` instead of `true` for new items (only meaningful for
`category === 'wishlist'`; ignored for the other four categories).

## 4. Inline item editing — the sheet is removed

`src/routes/pages/ItemSheet.tsx` is deleted. Every screen that used it
(`MonthSetupScreen`, `Wishlist`, and the now-deleted `History`) drops its
`editing` modal state entirely.

**Creation:** tapping **+ Add** calls `addItem` immediately with a
boilerplate name and `amount: 0` — no intermediate step. Name is
`Item${NN}`, zero-padded, numbered one past however many items already
exist in that add's scope (category, and month for Flex/Wishlist). The new
row renders in place, already sorted by §4's magnitude rule (so a fresh
`0`-amount item sorts last), with its name field auto-focused for instant
rename.

**Editing:** `CategoryBars` and `WishlistBody` rows grow to hold live
controls directly, replacing the "tap row → open sheet" flow:

- Name and amount are real inputs on the row itself, committing on blur
  (same rounding/parsing rules the sheet used: amount rounds to a whole
  number, defaulting to 0 on unparseable input).
- A small delete affordance per row, calling `deleteItem` directly — no
  confirmation, per the app's existing no-confirmation-prompts principle.
- Flex Spend and Wishlist rows additionally get a small inline move toggle
  (replacing the sheet's Flex Spend/Wishlist button pair), calling
  `moveItem` directly.
- Wishlist rows additionally get the Active checkbox from §3.

Base Income/Spend keep the bar-share visual (the proportional fill bar sits
behind the taller row); Wishlist keeps the ledger-stub look. Both grow
enough to comfortably fit the added inline controls — exact sizing is an
implementation-time visual call, not specified here.

## 6. Sort by magnitude

`itemsInMonth` results are sorted by `Math.abs(amount)` descending before
being handed to `CategoryBars` / `WishlistBody`, on every list. Larger
items lead; ties keep insertion order (stable sort).

## 7. Dynamic Allowance

A new boolean field on the existing `settings/buffer` doc:
`dynamicAllowance: boolean` (default `false`), set from a plain toggle in
`Settings`, next to Buffer. Not historized, unlike Buffer's
`{percent, mode, history}` — it only ever affects the currently-elapsing
month's live display, so there's nothing meaningful to remember about past
months.

Formula, in `formulas.ts`:

```ts
function dynamicAllowance(flat: number, days: number, spendSoFar: number, remaining: number): number {
  if (remaining <= 0) return flat
  return (flat * days + spendSoFar) / remaining
}
```

`computeMonth` gains a `displayAllowance` field: `dynamicAllowance(...)`
when the setting is on, else equal to `dailyAllowance`. **Only**
`displayAllowance` is exposed to Dashboard and the Calendar header's
"Allowance X/day" label — both switch to reading it instead of
`dailyAllowance`.

`dailyAllowance` itself keeps being used, unchanged, for:

- `moneySaved`'s internal math. Feeding the dynamic figure back into Money
  Saved's own formula algebraically collapses it to a constant
  (`surplus − flatAllowance × daysInMonth`) — it would stop tracking actual
  day-to-day behavior. Money Saved must stay pinned to the flat allowance
  regardless of the Dynamic Allowance setting.
- `DailyLog`'s per-cell tint baseline (`tintFor`) — a day's color reflects
  how it compares to the flat allowance, not a same-day-shifting dynamic
  target.

For a month other than the one in progress, `remaining` (from §2's fix) is
either `0` (past, fully elapsed) or the full month minus any pre-logged
days (future) — both make `dynamicAllowance` degrade to (at, or very near)
the flat figure automatically, no month-type branching needed in the
formula itself.

## Files touched (implementation-time reference, not exhaustive)

- `src/data/ViewedMonthContext.tsx` — new.
- `src/routes/pages/MonthStepper.tsx` — new, extracted from `DailyLog`.
- `src/routes/pages/ItemSheet.tsx` — deleted.
- `src/routes/History.tsx` — deleted; `/history` route and Settings link
  removed.
- `src/routes/{Dashboard,Wishlist,BaseIncome,FlexIncome,BaseSpend,
  FlexSpend,DailyLog,Settings}.tsx` — updated.
- `src/routes/pages/{CategoryBars,WishlistBody,MonthSetupScreen}.tsx` —
  updated for inline editing and sorting.
- `src/data/DataContext.tsx` — `addItem` default `active: false`; buffer
  doc gains `dynamicAllowance`.
- `src/lib/formulas.ts` — `remainingDays`, `dynamicAllowance`,
  `displayAllowance` on `MonthFigures`, sort helper.
- `src/lib/formulas.test.ts` — new/updated cases for remaining-days and
  dynamic-allowance behavior.
