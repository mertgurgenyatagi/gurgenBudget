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

Items are added and edited **one at a time**: a simple "+ Add," tap an existing item to edit it. No bulk-entry table. Flex Spend and Wishlist share one add entry point with a toggle for which list a new item lands in, reflecting that items already move between the two.

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

```
Daily Allowance = ((Surplus − Wishlist) / days in month) − Buffer
```

- **days in month** is the calendar length of the month (28–31). The allowance is a flat per-day figure for the whole month, not a value that re-slices across the remaining days.
- **Buffer** is a single fixed amount, set once, permanent. It is a deliberate margin of safety subtracted from every day. If it is ever changed anyway, the change applies **only going forward** — past months keep the old Buffer, the same as Base item deletion below.
- **Wishlist** here means the sum of whatever is *currently in the Wishlist list*. It changes only when items are added, deleted, or moved to/from Flex Spend. Marking a Wishlist item **purchased does not change this total**.
- A negative Daily Allowance is allowed and shown as-is.

---

## The Daily Log

- Once a day, the user logs a single number: the **raw, whole change in their bank balance** for that day. No mental subtraction of rent, bills, or anything else — whatever the bank shows is what gets typed in.
- A day with **no entry counts as zero spent**.
- Logged days can be corrected later at any time, **including days in past or closed months**, with no confirmation warning.
- **Logging is inherently retrospective.** The user will never log the current day in real time — late-night orders land after the day is functionally over for them. There is therefore **no same-day "log today" fast path**. The fast path is catching up on unlogged days.
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

- The only ways the list itself changes: items **added**, **deleted**, or **moved to/from Flex Spend**.
- The Wishlist total feeding the Daily Allowance formula is the sum of the list as it currently stands.
- The list is **flat and unordered** — no manual reordering or priority ranking. Items show in the order added.

### Money Saved

```
Money Saved = Surplus − (sum of actual daily logs so far) − (projected spend for remaining days)
```

- The projection applies the **Daily Allowance to every remaining day of the month**.
- Money Saved **resets to a zero basis each month**, computed purely from that month's own Surplus. There is no carry-over from prior months.
- **Money Saved lives on the Wishlist page** — not a separate screen.
- **Confirmed: the basis is the full Surplus, not `Surplus − Wishlist`.** This looked like a leftover asymmetry from the old multi-allowance design, but it's actually load-bearing: Money Saved is explicitly *"your currency on the Wishlist playground"* — the balance you spend by marking Wishlist items purchased. Spending exactly the Daily Allowance every day of the month leaves Money Saved sitting at `Wishlist total + (Buffer × days in month)` — precisely enough to buy the entire current Wishlist, plus the month's accumulated Buffer as a bonus cushion. Subtracting the Wishlist from the basis instead would zero out that purchasing power and break the mechanic. No change needed.

### Marking an item purchased

- Within the Wishlist view, an item can be marked **purchased**.
- This **consumes some of the projected Money Saved**.
- It does **not** touch the Wishlist total used in the Daily Allowance formula, and does **not** touch the daily log.
- A purchased item **stays visible in the list, crossed out**. It is not moved to a separate list.
- Marking purchased is **reversible** — it can be un-marked if done by mistake.
- Marking purchased simply deducts the item's **existing stored amount**. There is no separate "confirm actual amount paid" step. If the estimate was wrong, edit the item's amount the normal way, like any other item.
- **Confirmed: purchases leave a record past month-end, surfaced through History.** Wishlist items don't carry forward into the next month, but each month's Wishlist (including which items were marked purchased) is retained and shown when browsing that month in History — the same way Base items are. No separate Purchase History screen; browsing into a past month shows its full Wishlist as it stood, purchased items crossed out in context.

---

## Screens Implied By The Spec

Not yet designed, but the spec implies at minimum:

- **Dashboard / home** — the default screen on open: this month's numbers and current Daily Allowance, with logging one tap away. No first-run onboarding — even on a brand-new account, it's the same empty dashboard, figured out as you go.
- **Calendar** (the Daily log) — the unlogged-days catch-up flow. Exact interaction (day-grid vs. sequential prompt) is a design decision, not yet made.
- **Base Income**, **Flex Income**, **Base Spend**, **Flex Spend** — four separate screens (not one combined "Month setup" screen). Items added/edited one at a time. Flex Spend shares its add entry point with Wishlist, via a list toggle.
- **Wishlist** — the Wishlist list (flat, unordered) and Money Saved together.
- **History** — past months, still fully editable; each past month shows its own Base/Flex figures *and* its own Wishlist (purchased items crossed out in context). Navigated via a direct picker (jump to any month), not just back/forward. Separated from the current month by display only. Outside the swipe ring below — reached its own way, not by swiping.
- **Settings** — a visible, dedicated screen. The Buffer lives here (not edited inline elsewhere), alongside things like sign-out.

---

## Navigation — Swipeable Ring

Cross-screen navigation is a horizontal swipe carousel, one screen per swipe, arranged in a **circular ring** around Dashboard rather than a tree of menus. The pattern was chosen from the **Exhibop** design exploration for the Dashboard screen ([exhibop/dashboard.html](exhibop/dashboard.html), 20 hand-crafted first-look mockups) — specifically design **#17, the carousel** — then extended app-wide.

From Dashboard:

- **swipe right once** → Calendar
- **swipe left once** → Wishlist
- **swipe left twice** → Settings
- continuing left past Settings → the four Month Setup screens (Base Income, Flex Income, Base Spend, Flex Spend) — internal order among these four not yet decided — then back around to Calendar, closing the ring.

History is not on the ring; it keeps the direct month-picker navigation described above.

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

Work continues on the **`wishlist_ui`** branch, cut from `main`, whose focus is the Wishlist screen and Money Saved.

Next step is implementing the data model and the core formulas — still true for every screen, dashboard and Month Setup included, since no application logic has been written yet.
