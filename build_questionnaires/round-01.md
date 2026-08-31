# gurgenBudget Build Questop — Round 01 Answers

Paste the copied Q&A block from the questionnaire artifact below this line.

---

gurgenBudget — Build Questop, Round 1 of 10

01. Base items need a quiet history of past amounts so old months keep computing correctly. Should that history live as a small list right inside each item's own document, or as a separate collection of its own?
Answer: A list field inside the item's own document.

02. When you open a past month, should the app recompute that month's numbers fresh from the raw items every time, or keep a saved snapshot of each month's totals that gets updated whenever something relevant changes?
Answer: Recompute fresh every time, straight from the raw items.

03. For keeping the screen in sync with what's in the database, should the app listen live (updates itself the instant something changes), or fetch once and need a manual refresh?
Answer: Refresh after every change.

04. Every "day" in the log needs to boundary at midnight Turkey time, not wherever the phone happens to be. Turkey has used a fixed UTC+3 offset with no daylight saving since 2016 — so is a small hand-written offset calculation enough, or worth pulling in a timezone library for this?
Answer: A small hand-written fixed offset — no library.

05. For typing in an amount (a bank-balance change, an item amount, etc.), should it just be a plain number field, or a fancier input that live-formats as you type (showing "₺1,234" while you're still typing)?
Answer: A plain number field, formatted only for display afterward.

06. The swipeable ring of screens needs some code to handle the swiping itself. Should that be hand-rolled with the browser's own scroll behavior, or built on a small dedicated carousel library?
Answer: Hand-rolled, using the browser's own scroll-snap behavior.

07. How much automated testing should this build get — just tests for the money formulas themselves (Surplus, Daily Allowance, Money Saved), or a fuller suite that also tests the screens and components?
Answer: Just the formulas.

08. While building, should the app talk to a local practice copy of the database (the Firebase Emulator), or the real, live gurgenbudget Firestore project the whole time?
Answer: A local practice copy (the Firebase Emulator) while building.

09. How should day-to-day app state (which month you're viewing, what's currently in the item lists, etc.) be held together while the app runs — plain React, or a dedicated state-management library?
Answer: Plain React (Context + hooks), no extra library.

10. If a save to the database fails (say, you're offline for a moment), how much should the app do about it — a simple "didn't save, try again" message, or a fuller system that queues the change and retries automatically once you're back online?
Answer: A simple retry message.

