# gurgenBudget Build Questop — Round 03 Answers

Paste the copied Q&A block from the questionnaire artifact below this line.

---

gurgenBudget — Build Questop, Round 3 of 3 (Final)

01. Once the app is actually running, your real current numbers (Base Income, Base Spend, etc.) need to get into it somehow. Should you just type them in by hand, one at a time — the same simple "+ Add" flow as everyday use — or is a one-time bulk import (e.g. pasting a spreadsheet) worth building just for that first day?
Answer: Type them in by hand, one at a time.

02. Should the app work at all when you have no signal — reading what's already loaded, and even logging a day offline, syncing once you're back — or is a live connection safe to assume every time you open it?
Answer: Support basic offline use.

03. Should this whole build-and-integration phase land as one large branch you review at the very end, or as a sequence of smaller pieces (e.g. data layer and formulas first, then each screen) that you can look at and approve along the way?
Answer: We'll just go YOLO and tachyon build the app in its entirety.

04. The swipeable ring just decided against separate URLs, to keep things seamless. History is reached differently, outside the ring — should it still get its own real URL (so reloading or bookmarking a specific month works), or should it be seamless, in-memory state too, matching the rest of the app?
Answer: The month selection past day editing can just live inside the calendar. The rest of the history information is super useless and niche, so tuck it away in settings somewhere.

05. What actually counts as "done" for this build-and-integration phase — all five screens wired to real data with the formulas correct (even if it's not fully polished yet), or full production-level polish (animations, every edge case handled) before you'd call it finished?
Answer: Who cares.

06. Once a screen is working end-to-end, should it go live on the real GitHub Pages site right away (so you can start using it for real logging as each piece lands), or should everything stay on the branch until the whole phase is finished?
Answer: You'll build the whole thing right now and then I'll tell you to deploy it.

