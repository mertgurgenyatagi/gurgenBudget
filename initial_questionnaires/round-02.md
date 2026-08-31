# gurgenBudget Questop — Round 02 Answers

Paste the copied Q&A block from the questionnaire artifact below this line.

---

gurgenBudget — Questop, Round 2 of 10

01. You confirmed a purchased Wishlist item needs to leave a record after the month ends, so you can look back at what you actually bought. How should that record be surfaced?
Answer: No separate screen — extend History so past months also show their full Wishlist (not just Base items), with purchased ones crossed out in context.

02. You also confirmed Flex and Wishlist items keep a quiet history on deletion, as a safety net against accidental deletes. Should that history be visible and recoverable, or stay silent like Base's unsurfaced history?
Answer: Silent — kept quietly like Base's history, not shown anywhere in the UI.

03. Given "extreme mobile priority" — should this be an installable PWA (add-to-homescreen, feels like a native app), or a normal mobile-responsive site you open in the browser?
Answer: A plain mobile-responsive site, no install step.

04. Since it's mobile-first by design, should the app actively discourage desktop use, or just let the (unoptimized) layout render as-is if someone opens it on a laptop?
Answer: Let it render as-is, unoptimized — no gatekeeping.

05. For a true single-user app, should Firebase Auth have a normal public sign-up screen, or should the app be locked to one account you create yourself, with no sign-up screen at all?
Answer: A normal sign-up flow, in case that changes later.

06. For that sign-in: email/password, Google sign-in, or does it matter?
Answer: Google sign-in only.

07. GitHub Pages hosts a static site. Any preference on the frontend approach — a framework with a build step, or plain HTML/CSS/JS with none?
Answer: A framework with a build step (e.g. Vite + React), deployed via GitHub Actions on every push.

08. The daily log records a raw balance change "for a day." What decides where one day ends and the next begins — a fixed timezone, or whatever timezone your device happens to be set to?
Answer: A single fixed timezone (Turkey time), always — regardless of where you are when you log.

09. The earliest-unlogged-day flow is the app's main fast path. When you open the app, should it default straight into that flow, or land somewhere else first?
Answer: A home dashboard first (this month's numbers, current allowance), with the log flow one tap away.

10. When there are several unlogged days to catch up on, should logging one chain straight into the next unlogged day automatically, or return you to a summary after each entry?
Answer: To be honest, we'll probably have a grid of boxes denoting each day of the month rather than a big button, so the earliest unlogged day is kind of a moot point. This will surface in design so don't worry too much about it.

