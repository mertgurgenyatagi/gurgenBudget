# gurgenBudget

A personal budget website that plans monthly transactions and tells you how much you can safely spend per day.

The app answers one question, every day, with one number: **how much can I spend today?** Everything else in the system exists to make that number correct and to keep the effort of maintaining it near zero.

---

## Design Principles

These are the non-negotiables that the rest of the spec falls out of.

1. **Logging is the hot path.** Entering the day's bank-balance change is the single most frequent action in the app and must be near-frictionless. Every other flow can afford friction; this one cannot.
2. **The user has full agency.** No locked months, no confirmation prompts, no "are you sure" on destructive or retroactive edits. If the user wants to change a figure in a month from a year ago, they can, and the app just recalculates.
3. **Estimates are first-class.** Amounts are expected to be rough and expected to be edited later. Nothing in the UI should imply an amount is final.
4. **No decoration on the data.** Items are a name and an amount. No due dates, no sub-categories, no notes, no tags.
5. **No moralising.** A negative Surplus or a negative allowance is displayed plainly, with no warning styling, no alerts, no encouragement.

---

## Money Formatting

Every TRY figure displays as **whole lira** — no kuruş, no decimal places, anywhere in the app, including inputs, totals, and the daily allowance.

---

## Transaction Categories

Every item in the system is a **name + amount**. Nothing else. Amounts accept anything numeric — no validation blocking zero or negative values (consistent with the app's "full agency, no confirmation prompts" principle; a negative Flex Spend, for instance, might legitimately represent a refund).

Items are added and edited **inline, directly on the list** — no add/edit dialog. "+ Add" creates a real item immediately (boilerplate name `ItemNN`, amount 0) already sorted into the list, its name field focused for an instant rename; name and amount are always-live inputs on the row itself, with delete alongside them. No bulk-entry table. Flex Spend and Wishlist each keep their own add entry point (rather than sharing one with a toggle at creation time), but every row on either screen carries a move control that sends the item to the other list — items still move freely between the two, just after creation rather than at it.

| # | Category | Lifetime | Example |
|---|---|---|---|
| 1 | **Base Income** | Created once; persists unchanged across months until manually edited | Salary |
| 2 | **Flex Income** | Created and discarded at the end of the month | Side gig payment |
| 3 | **Base Spend** | Created once; persists unchanged across months until manually edited | Rent |
| 4 | **Flex Spend** | Created and discarded at the end of the month. Necessary-but-unplanned spending, typically set during the first few days of the month | Car wash fee |
| 5 | **Wishlist** | Created and discarded at the end of the month. Fully optional spending | New guitar |

**Base** items are the standing state of the user's finances. **Flex** items are the month's improvisation. **Wishlist** is a semi-separate module — see [Wishlist & Money Saved](#wishlist--money-saved).

---

## Core Formulas

### Surplus

```
Surplus = Base Income + Flex Income − Base Spend − Flex Spend
```

Surplus is the total left over that is free to spend on other things. It may be negative; that is displayed as-is.

### Daily Allowance

**Buffer is a percentage, not a flat ₺/day amount** — a deliberate margin of safety expressed as a rate, with a **mode toggle** (in Settings) governing how that rate folds into the formula:

```
// mode: "of surplus" — the cut comes off Surplus alone, before Wishlist
Daily Allowance = (Surplus × (1 − Buffer%) − Wishlist) / days in month

// mode: "of full slice" — the cut comes off the whole daily figure, after Wishlist
Daily Allowance = ((Surplus − Wishlist) / days in month) × (1 − Buffer%)
```

- **days in month** is the calendar length of the month (28–31). The allowance is a flat per-day figure for the whole month, not a value that re-slices across the remaining days.
- **Buffer%** and its **mode** are both set in Settings, and both follow the same forward-only rule: changing either only applies to months from that point on — past months keep whatever `{percent, mode}` was in effect at the time, the same as Base item deletion below. No 0–100 clamp; it accepts anything, like every other numeric field in the app.
- **Wishlist** here means the sum of whatever is *currently in the Wishlist list*. It changes only when items are added, deleted, or moved to/from Flex Spend. Marking a Wishlist item **inactive removes it from this total** (same effect as a delete, but reversible) — see [Active / inactive](#active--inactive-replaces-the-old-purchased-mechanic) below.
- A negative Daily Allowance is allowed and shown as-is.
- **Dynamic Allowance** (a Settings toggle, off by default) swaps the *displayed* daily figure — on Dashboard and the Calendar header only — for a recomputed one: `(Daily Allowance × days in month + money spent so far) / days left unlogged`. Spend at that new rate for the rest of the month and total spend still lands on what the flat Daily Allowance would have produced. It's purely a display recompute: Money Saved and the Calendar's per-day tinting always use the flat Daily Allowance, never the dynamic figure, so the underlying ledger math never shifts underfoot.

---

## The Daily Log

- Once a day, the user logs a single number: the **raw, whole change in their bank balance** for that day. No mental subtraction of rent, bills, or anything else — whatever the bank shows is what gets typed in.
- A day with **no entry counts as zero spent**.
- Logged days can be corrected later at any time, **including days in past or closed months**, with no confirmation warning.
- **Logging is inherently retrospective in practice** — late-night orders land after the day is functionally over, so the user will rarely if ever log the current day in real time. The app doesn't enforce that, though: every day in the grid, past, today, or future, is directly loggable, in keeping with the app's full-agency principle. The fast path remains catching up on unlogged days; logging today, or pre-logging a future day, is simply never blocked.
- **Day boundaries use a fixed timezone (Turkey time), always** — never the device's local time. This keeps the numbers stable regardless of where the user is when they log.
- **The app opens to a dashboard first** (this month's numbers, current Daily Allowance), with logging one tap away — not straight into a logging flow.
- The exact logging interaction (e.g. a calendar-style grid of day boxes rather than a sequential "next unlogged day" prompt) is a **UI design decision, deferred to implementation** — not a spec question. Whatever the layout, an unlogged day still counts as zero spent until corrected.

---

## Retroactive Recalculation & The Data Model

The governing idea: **a month is computed from whatever was true during that specific month.** The data model must store values-over-time, not a single current value plus an audit log.

### Editing

- Base Income and Base Spend items keep a **quiet, unsurfaced history** of amount changes — old value and date only. No reason, no note. It is not shown in the UI; it exists so that past months compute correctly.
- Editing a Base item's amount, or a Flex/Wishlist item, is treated as if the new value **had been true since 00:00 on day 1 of whatever month it applies to**. That month's figures recalculate retroactively.
- This applies to closed and past months too. No locking, no warning prompts.
- This only applies to a value change on an *existing* item. **Creating a brand-new Base item does not backfill** — it only applies from its creation month forward. Months before it existed are left exactly as they were, symmetrical with deletion below.

### Deletion (scoped differently from editing)

- A Base Income or Base Spend item can be deleted outright, but **only going forward**.
- Current and future months stop including it. **Past months keep showing it exactly as it was.**
- Flex Income, Flex Spend, and Wishlist items also keep a **quiet history** on deletion (not just Base items) — a safety net against accidental deletes, mid-month. **Confirmed silent/unsurfaced**, same as Base's history — not a visible "recently deleted" list. Distinct from the Wishlist purchase record below: this is a general undo/recovery backstop, not a purchase log.

### Consequence for the UI

Firestore has no concept of a "closed month" and none is enforced by the data model. The distinction between **"current month"** and **"history"** is a **display concept only** — it never locks data.

---

## Wishlist & Money Saved

A deliberately semi-separate sub-system — *"a playground, not in terms of feel, but in terms of function."*

### The Wishlist list

- The only ways the list itself changes: items **added**, **deleted**, **moved to/from Flex Spend**, or toggled **active/inactive** (see below).
- The Wishlist total feeding the Daily Allowance formula is the sum of the **active** items currently in the list — an inactive item contributes nothing to it.
- The list is **flat** — no manual reordering or priority ranking. Every list in the app, Wishlist included, sorts by **magnitude of amount, descending** (largest first), not insertion order.

### Active / inactive (replaces the old "purchased" mechanic)

- Every Wishlist item carries an **Active** checkbox, right on its row in the list — not tucked into an edit dialog. It's **off by default** when the item is added, since a freshly created item is a placeholder (see [Transaction Categories](#transaction-categories) above) rather than something meant to count yet.
- Checking it in makes the item **count toward that month's math**; unchecked, it **behaves exactly like a deleted item** — excluded from the Wishlist total, and therefore from the Daily Allowance and Money Saved calculations that total feeds into.
- Unlike a delete, it's **fully surfaced and instantly reversible**: the item stays visible in the list, dimmed via opacity, and re-checking Active brings it right back into the totals. No quiet/unsurfaced history involved — this is a plain, user-facing toggle, not the deletion safety net.
- There is no separate "purchased" state, no crossing-out, and marking an item inactive **does not consume Money Saved** the way the old purchased mechanic did — it simply removes the item's amount from the Wishlist total, same as any other item leaving the list would.

### Money Saved

```
Money Saved = Surplus − (sum of actual daily logs so far) − (projected spend for remaining days)
```

- The projection applies the **Daily Allowance to every remaining day of the month**.
- Money Saved **resets to a zero basis each month**, computed purely from that month's own Surplus. There is no carry-over from prior months.
- **Money Saved lives on the Wishlist page** — not a separate screen.
- **Confirmed: the basis is the full Surplus, not `Surplus − Wishlist`.** This looked like a leftover asymmetry from the old multi-allowance design, but it's actually load-bearing: Money Saved is explicitly *"your currency on the Wishlist playground"* — the moment a Wishlist item's amount is folded into the Wishlist total, most of its cost is immediately credited to Money Saved by shrinking the rest of the month's Daily Allowance. Subtracting the Wishlist from the basis instead would zero out that purchasing power and break the mechanic. No change needed.
- Spending exactly the Daily Allowance every day of the month leaves Money Saved sitting at the Wishlist total plus a bonus cushion — precisely enough to buy the entire current Wishlist, plus that cushion. The cushion's size depends on the Buffer mode: `Surplus × Buffer%` under "of surplus", `(Surplus − Wishlist) × Buffer%` under "of full slice". The Money Saved formula itself doesn't change between modes — it's defined purely in terms of Surplus and the Daily Allowance, so it inherits whichever Buffer mode produced that allowance automatically.

---

## Screens Implied By The Spec

Not yet designed, but the spec implies at minimum:

- **Dashboard / home** — the default screen on open: this month's numbers and current Daily Allowance, with logging one tap away. No first-run onboarding — even on a brand-new account, it's the same empty dashboard, figured out as you go. Follows whichever month is currently browsed (see Calendar below), not always the real current month — its label switches between "Today" and the month name accordingly.
- **Calendar** (the Daily log) — the unlogged-days catch-up flow, though every day (past, today, or future) is directly loggable, not just past ones. Exact interaction (day-grid vs. sequential prompt) is a design decision, not yet made. **Month changing** lives in a small stepper shared by every month-scoped screen (Dashboard, Wishlist, the four Month Setup screens, and Calendar itself) — stepping the month on any one of them moves all of them together.
- **Base Income**, **Flex Income**, **Base Spend**, **Flex Spend** — four separate screens (not one combined "Month setup" screen). Items added/edited inline, one at a time, each with its own add entry point (see Transaction Categories above).
- **Wishlist** — the Wishlist list (flat, unordered) and Money Saved together.
- ~~History~~ — **removed.** Originally spec'd as a separate destination for browsing/editing past months; once every month-scoped ring screen could browse and edit any month directly (via the shared stepper described under Calendar above), History's entire job became redundant, so the screen, its route, and its Settings entry were all deleted.
- **Settings** — a visible, dedicated screen. The Buffer (percent + mode toggle) and the **Dynamic Allowance** toggle both live here (not edited inline elsewhere), alongside things like sign-out.

---

## Navigation — Swipeable Ring

Cross-screen navigation is a horizontal swipe carousel, one screen per swipe, arranged in a **circular ring** around Dashboard rather than a tree of menus. The pattern was chosen from the **Exhibop** design exploration for the Dashboard screen ([exhibop/dashboard.html](exhibop/dashboard.html), 20 hand-crafted first-look mockups) — specifically design **#17, the carousel** — then extended app-wide.

From Dashboard:

- **swipe right once** → Calendar
- **swipe left once** → Wishlist
- continuing left past Wishlist → the four Month Setup screens, in the order **Base Income, Flex Income, Base Spend, Flex Spend**
- **then Settings**, which sits between Flex Spend and Calendar — i.e. one swipe *right* of Calendar, two swipes right of Dashboard — closing the ring.

There is no History screen — see [Screens Implied By The Spec](#screens-implied-by-the-spec) above; month changing lives in a stepper shared by every month-scoped ring screen.

---

## Color Palette

### Light (paper/sheet)

| Token | Value | Purpose |
|---|---|---|
| `--paper` | `oklch(95% .013 127)` | sage paper background |
| `--ink` | `oklch(21% .037 134)` | near-black text |
| `--muted` | `oklch(53% .027 131)` | secondary text |
| `--rule` | `oklch(85% .015 127)` | hairlines |
| `--track` | `oklch(89% .016 128)` | progress track |
| `--accent` | `oklch(45% .11 139)` | deep moss/olive accent |
| `--short` | `oklch(53% .12 41)` | warning/over-budget (warm rust) |
| `--onink` | `oklch(95% .013 127)` | text on dark band |
| `--backdrop` | `oklch(90% .025 85)` | light beige ground the ring's cards float over |

### Dark hero band (re-pitched)

| Token | Value | Purpose |
|---|---|---|
| `--b-muted` | `oklch(72% .028 132)` | secondary text on dark band |
| `--b-rule` | `oklch(34% .04 133)` | hairlines on dark band |
| `--b-track` | `oklch(30% .035 133)` | progress track on dark band |
| `--b-logged` | `oklch(57% .095 141)` | moss on dark |
| `--b-short` | `oklch(59% .132 42)` | warning on dark |

---

## Technical Notes

- **Backend:** Firestore.
- **Hosting:** GitHub Pages, static export.
- **Frontend:** a framework with a build step (Vite + React), deployed via GitHub Actions on every push.
- **Auth:** Firebase Auth, Google sign-in only, with a normal (not single-account-locked) sign-up flow.
- **Currency:** TRY, whole lira only. Hard-coded, not a setting.
- **Platform priority:** extreme mobile priority — a mobile-responsive site (not an installable PWA). No desktop gatekeeping; an unoptimized desktop layout is acceptable, just not a target.
- **Month rollover:** lazy/on-visit — no scheduled backend job. The app checks the date when opened and starts the new month then.
- **Day boundary:** fixed Turkey timezone, always — not the device's local time.
- The data model must support per-month reconstruction of every Base item's value (values-over-time), since any month — past, present, or future — is computed from what was true during it.

---

## Open Questions

None outstanding. Rounds 1–3 of the **Questop** operation are answered — see [initial_questionnaires/](initial_questionnaires/) — and every resolution is folded into the sections above.

---

## Status

Requirements-gathering via the **Questop** operation (defined in [CLAUDE_OPERATIONS.md](CLAUDE_OPERATIONS.md)) is complete after 3 rounds — trimmed down from the original 10-round default once the core spec gaps and architecture settled.

Project scaffold is in place: Vite + React + TypeScript, React Router (`HashRouter`, to sidestep GitHub Pages' deep-link 404 issue with no extra config), Firebase (Auth + Firestore, config read from `VITE_FIREBASE_*` env vars — see [.env.example](.env.example)), and a GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) that builds and deploys to GitHub Pages on every push to `main`. Google sign-in gates all routes except `/sign-in`. The six screens from [Screens Implied By The Spec](#screens-implied-by-the-spec) exist as stub components under `src/routes/` with no real logic yet — no formulas, no Firestore reads/writes, no actual data model. No application logic has been written.

**The Firebase project is live**, created via the Firebase CLI: project ID `gurgenbudget`, Firestore in `europe-west3`. `firestore.rules` scopes every document to `/users/{uid}/**`, readable/writable only by that uid — any future data model must nest under that path. Google sign-in is enabled in the Firebase console, and the 6 `VITE_FIREBASE_*` values are set as GitHub repository secrets, so the [deploy workflow](.github/workflows/deploy.yml) can build and publish to Pages on push to `main`.

The scaffold, Firebase config, and this doc were committed, pushed, and merged into `main`.

Design exploration for the Dashboard screen was run via the **Exhibop** operation (Hallmark plugin) on the `dashboard-ui` branch: 20 hand-crafted first-look mockups at [exhibop/dashboard.html](exhibop/dashboard.html). Design #17, a swipeable carousel, was picked as the app's cross-screen navigation pattern and extended into the full ring described in [Navigation — Swipeable Ring](#navigation--swipeable-ring): Calendar one swipe right of Dashboard, Wishlist one swipe left, Settings two swipes left, and the four Month Setup screens (Base Income, Flex Income, Base Spend, Flex Spend — split into individual screens rather than one combined setup screen) filling the rest of the ring between Settings and Calendar. That work is merged into `main`.

Design exploration for the four Month Setup screens — **Base Income, Flex Income, Base Spend, Flex Spend: four distinct screens, not panels of one combined screen** — was run via the **Exhibop** operation on the `ms_pages_ui` branch: 20 hand-crafted first-look mockups, each rendering all four screens side by side for comparison, at [exhibop/monthsetup.html](exhibop/monthsetup.html). Design #8, **bar share** — each item shown as a labeled horizontal bar sized to its share of the category total — was picked as the visual pattern for these four screens.

The first pass at this exhibit mis-scoped what "four pages per design" meant — four shrunk-down thumbnails crammed into one viewport, reusing the Dashboard exhibit's own single-figure motifs — rather than four fresh designs built for a category-label-plus-item-list screen. It also added an unexplained decorative dot row gesturing at the carousel nav. Both were corrected after review: the dot row was removed, and the pool of 20 designs was rebuilt from scratch, then recolored to use only the canon tokens from [Color Palette](#color-palette) above — no other colors anywhere in the exhibit. That work is merged into `main`.

Design exploration for the Wishlist screen and Money Saved, plus two screens beyond its original scope, was run via the **Exhibop** operation on the `wishlist_ui` branch, cut from `main`:

- **Wishlist** — 20 first looks at [exhibop/wishlist.html](exhibop/wishlist.html), each pairing the flat Wishlist list (purchased items struck through in place, never removed) with Money Saved in one viewport. Design **#01, ledger stub** — a torn-edge ledger card with Money Saved as the bold footer stat — was picked.
- **Calendar** (the Daily Log) — 20 first looks at [exhibop/calendar.html](exhibop/calendar.html), split between grid-shaped and sequential-catch-up-shaped approaches to leave the previously open day-grid-vs-sequential-prompt question genuinely explored. Design **#01, classic month grid** was picked, with three build-time refinements confirmed: 4 rectangles per row (not 7), no minus signs on logged amounts, and a variable-intensity tint per day — red for overspent, green for underspent against the Daily Allowance — using the palette's existing `--short` and `--accent` tokens rather than new colors.
- **Settings** — 20 first looks at [exhibop/settings.html](exhibop/settings.html), exploring arrangements of the Buffer figure and the Account/Sign-out row (content is intentionally spare, per spec). Design **#03, two-tone** — a dark account band over a light Buffer/sign-out panel — was picked.

That work is merged into `main`. A first attempt at the next phase — implementing the data model and core formulas, on a `build-and-integration` branch — was reverted rather than merged.

Work continued instead on a `ui-perfecting` branch to get the picked navigation pattern itself actually working before any backend logic sits behind it. The swipe-ring's feel — drag-follow, momentum flick, infinite wraparound — was validated standalone in a throwaway prototype ([ring-nav-prototype.html](ring-nav-prototype.html)) before being ported into a real `Ring` component ([src/routes/Ring.tsx](src/routes/Ring.tsx)), which now replaces the old link-based `Layout` as the app's actual navigation shell. `MonthSetup.tsx` was split into its four spec'd screens (`BaseIncome.tsx`, `FlexIncome.tsx`, `BaseSpend.tsx`, `FlexSpend.tsx`). All eight ring screens — Dashboard, Wishlist, Settings, the four Month Setup screens, and Calendar — are colored, labeled placeholders (`RingPage.tsx`) for now: no Firestore, no formulas, no real content, deliberately, so the navigation itself could be judged on a real phone before anything else is built on top of it. Google sign-in gates the ring behind `/sign-in`, with a plain, unstyled "Sign in via Google" button.

That work is merged into `main` and deployed live at [mertgurgenyatagi.github.io/gurgenBudget](https://mertgurgenyatagi.github.io/gurgenBudget/). The ring navigation has been confirmed working end-to-end on a real Android Chrome device — swipe in both directions, fast or slow, loops seamlessly with no dead ends. The data model and core formulas are still unbuilt; that's the next phase.

The Dashboard ring screen is the first to move past the colored `RingPage` placeholder to real content, per the picked design in [page_designs/dashboard.PNG](page_designs/dashboard.PNG): the whole slot is one dark card (no separate white/beige panel behind it), showing today's Daily Allowance as a bold whole-lira figure with a small "Today" label beneath. The canon [Color Palette](#color-palette) tokens are now real CSS custom properties in `src/index.css` rather than one-off `oklch(...)` literals per screen, so the remaining seven ring screens can pick them up the same way as their own placeholders get replaced. The figure shown is still a hardcoded placeholder — no Firestore reads, no formula wiring — since that's still the deferred backend phase. That work is merged into `main`.

**All eight ring screens are now built as real UI**, each one matching its picked design — the approved reference screenshots live in [page_designs/](page_designs/), one PNG per screen, and are the authority where they and the exhibits differ:

- **Wishlist** — ledger stub: item rows over a dashed rule, purchased items struck through in place, Money Saved as the bold moss footer stat, torn bottom edge via `clip-path`.
- **Calendar** — classic month grid with all three confirmed refinements applied: **4 rectangles per row** (the exhibit's own screenshot still shows 7), **no minus signs** on logged amounts (a money-in day keeps its `+`), and a **variable-intensity tint per day** — rust past the Daily Allowance, moss under it, saturation scaled by the size of the gap and mixed against paper with `color-mix` so the figures stay legible.
- **Settings** — two-tone: ink account band over a paper panel holding Buffer and Sign out.
- **Base Income, Flex Income, Base Spend, Flex Spend** — bar share, one labeled bar per item sized to its share of the category total; income bars moss, spend bars rust. They stay four distinct ring screens, sharing one presentational component rather than four copies of the same markup.

Three follow-up passes on that UI, all merged: the ring's backdrop went to a **darker gray** (`--backdrop`) so the paper cards read as cards floating over a ground rather than paper on paper; **Settings moved on the ring** to sit between Flex Spend and Calendar, one swipe right of Calendar; and **History was dissolved as a destination** — month stepping now lives in the Calendar header (`‹ April ›`), and the leftover History entry is a quiet row at the foot of Settings. `/history` still exists as a route with the old colored placeholder behind it, unlinked and undesigned.

Supporting changes: **Inter** is now loaded as the app's typeface (every picked design was drawn in it), and whole-lira formatting lives in one place (`src/money.ts`) so no screen hand-rolls it. Every figure on every screen is still hardcoded placeholder data — this pass is deliberately UI-only, with no Firestore reads, no formulas, and no interactivity behind the "+ Add", "log", and "Sign out" affordances. **History** is the one screen still on the colored `RingPage` placeholder: it sits off the ring and never had an Exhibop run, so no design has been picked for it yet. That work is merged into `main`.

**Backend wiring is complete**, built on a `backend-wire` branch per the design spec at [docs/superpowers/specs/2026-08-31-backend-wiring-design.md](docs/superpowers/specs/2026-08-31-backend-wiring-design.md) and its implementation plan at [docs/superpowers/plans/2026-08-31-backend-wiring.md](docs/superpowers/plans/2026-08-31-backend-wiring.md). Every hardcoded figure across all eight ring screens and `/history` is now real:

- **Data model** (`src/lib/formulas.ts`, `src/lib/time.ts`) — a single Firestore `items` collection discriminated by category (so moving a Flex Spend item to Wishlist is a one-field update, not a delete-and-recreate), a `days` collection for the daily log, and a `settings/buffer` doc. Retroactive editing, forward-only Base item creation/deletion, and the quiet per-item history all resolve through one `amountInMonth()` function against a fixed UTC+3 clock. Verified by 14 Vitest cases over the pure formula layer — nothing else in the app has test coverage, by design.
- **Firestore wiring** (`src/data/DataContext.tsx`) — one `DataProvider` with three live `onSnapshot` listeners and every write (`addItem`, `editItem`, `deleteItem`, `moveItem`, `setPurchased`, `logDay`, `setBuffer`); no screen talks to Firestore directly. Write failures surface through a small shared banner rather than each screen inventing its own error handling.
- **The Buffer** shipped as the percentage-with-a-mode-toggle described above, not the flat ₺/day amount originally spec'd — see [Core Formulas](#core-formulas) and [Wishlist & Money Saved](#wishlist--money-saved) above, both updated to match.
- **Every screen is interactive now**: a shared item sheet (name, amount, and — for Flex Spend/Wishlist — the category toggle plus a Purchased checkbox) handles add/edit/delete everywhere; the Calendar logs a day inline by tapping its cell and steps between months in its own header; Settings edits the Buffer and actually signs out.
- **History** got the design it never had an Exhibop for: a small month stepper, a Surplus/Allowance/Money Saved summary, then the four category breakdowns and the Wishlist list for whichever month is selected — reusing the same components the ring screens use (`CategoryBars`, `WishlistBody`), not a separate design.

That work is merged into `main`.

The ring's backdrop went darker still — `--backdrop` is now a very dark gray (`oklch(18% .006 127)`, low enough chroma to read as neutral gray rather than tinted), distinct from `--ink`'s mossier near-black so the Dashboard's ink-toned card still stands apart from the ground behind it.

**Two bugs found and fixed by debugging live against the real Firebase account via Playwright** (dev server running locally, the user signed in with their real Google account, Claude driving the browser):

- **Nothing on any ring screen was clickable.** Root cause, confirmed by instrumenting `click`/`pointerup` targets directly: `Ring.tsx`'s drag handling called `track.setPointerCapture()` on *every* pointerdown anywhere in the ring, unconditionally. Once an element has pointer capture, the browser retargets the resulting `click` to the capturing element instead of whatever's visually under the pointer — so every tap on a button/input inside a ring slot resolved to a click on `.ring-track` itself. Invisible before backend wiring, since ring slots had nothing clickable in them until then. Fixed with an 8px movement deadzone: capture only engages once a pointerdown has actually turned into a drag, so a tap that never crosses it fires its native click normally, while real swipes work exactly as before.
- **The item sheet was unusable even after that fix** — its scrim wasn't covering the viewport. `.ring-track` has `will-change: transform` plus an active `transform` for the swipe animation, which makes it the containing block for any `position: fixed` descendant. The sheet, nested inside a ring screen, was sizing itself against the track's own (much wider, mostly off-screen) box instead of the viewport. Fixed by portalling the sheet straight to `document.body`.
- Confirmed via a full live round-trip through the real account: add → shows in Wishlist and updates Money Saved and the Dashboard allowance → edit (pre-fills correctly) → delete (soft-deleted, not hard-removed, per the quiet-history undo backstop) → swipe navigation still intact both directions, deadzone confirmed not to swallow taps.

**Month navigation and edits are no longer capped at the current month** — the `›` step in both the Calendar and History now goes as far into the future as you like, for pre-planning ahead (adding a Flex Income item for next month, say). The formulas already handled any month generically; this was only ever a self-imposed UI cap, now removed.

**The "purchased" mechanic on Wishlist items was replaced with a plain Active/Inactive toggle.** Marking an item purchased used to leave it crossed out in the list while separately deducting its amount from the projected Money Saved, on top of the amount already being baked into the Wishlist total. That's gone. Every Wishlist item now carries an `active` field (defaulting to `true`); unchecking Active in the item sheet excludes the item from the Wishlist total for that month — the same effect a delete has on the Daily Allowance and Money Saved formulas — but, unlike a delete, it's a fully surfaced, instantly reversible toggle: the item stays in the list at reduced opacity rather than disappearing into the quiet deletion history. `formulas.ts` dropped `purchasedTotal` entirely and `moneySaved` no longer takes a purchased-amount argument; `categoryTotal` now filters out inactive Wishlist items before summing. Covered by an added Vitest case. Also, unrelated: `--backdrop` (the ring's ground color) went from dark gray to light beige. Both merged into `main`.

**Six agency/UX fixes landed as a batch** ("launch hotfixes"), per the design spec at [docs/superpowers/specs/2026-09-02-launch-hotfixes-design.md](docs/superpowers/specs/2026-09-02-launch-hotfixes-design.md) and its implementation plan at [docs/superpowers/plans/2026-09-02-launch-hotfixes.md](docs/superpowers/plans/2026-09-02-launch-hotfixes.md):

- **One shared browsable month** (`src/data/ViewedMonthContext.tsx`) replaces every screen's own `currentMonth()` call — Dashboard, Wishlist, the four Month Setup screens, and Calendar all read and step the same month via a small shared `MonthStepper` header, so stepping forward on any one of them (to pre-set next month's Flex items, say) moves all of them together. Dashboard now shows whichever month is browsed, its label switching between "Today" and the month name.
- **History is deleted** — `History.tsx`, its `/history` route, and its Settings entry are gone; every ring screen that touches month-scoped data now does what History used to do, plus lets you edit while browsing.
- **Every day in the Calendar is directly loggable** — past, today, or future, no more "future" cell restriction. This exposed a real double-counting bug in Money Saved (a pre-logged future day was counted both as an actual and as a projected allowance day); fixed by redefining "remaining days" in `formulas.ts` as unlogged days rather than calendar-future days.
- **The item sheet is gone.** `ItemSheet.tsx` is deleted; `CategoryBars` and `WishlistBody` rows are directly editable — live name/amount inputs, a delete action, and (Flex Spend/Wishlist) a move-to-the-other-list action, right on the row. "+ Add" creates a real item immediately (`ItemNN`, amount 0) instead of opening a dialog, sorted into the list by magnitude like every other list (largest first).
- **The Wishlist Active checkbox moved onto the row itself** and now **defaults off** — a freshly created Wishlist item doesn't count toward the Wishlist total (and therefore Daily Allowance / Money Saved) until explicitly switched on.
- **Dynamic Allowance**, a new Settings toggle (off by default): recomputes the daily figure shown on Dashboard and the Calendar header from money already spent this month, so the month's total projected spend still lands on what the flat allowance would have produced. Purely a display recompute — Money Saved and the Calendar's per-day tinting always stay pinned to the flat allowance.

Covered by 8 added Vitest cases (28 total) over the formula layer. That work is merged into `main`.

**Fixed a sign-inversion bug in the Daily Log input.** The stored day-log value is a raw signed balance change (negative = spent), matching `spendSoFar`/`moneySaved`/`tintFor` throughout `formulas.ts`, and `amountFor` already displays it accordingly — a spend shows with no sign, only money-in gets a `+`. But the edit field passed typed text straight through with no inversion, so a plain "50" stored as `+50` (read as income) and only "-50" registered as the intended spend. `DailyLog.tsx` now flips the sign at the input boundary in both directions — typing a plain number logs a spend, matching the display convention instead of fighting it. Merged into `main`.
