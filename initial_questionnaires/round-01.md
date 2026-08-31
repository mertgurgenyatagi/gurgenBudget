# gurgenBudget Questop — Round 01 Answers

Paste the copied Q&A block from the questionnaire artifact below this line.

---

gurgenBudget — Questop, Round 1 of 10

01. Money Saved currently starts from the full Surplus, not Surplus minus Wishlist — even though Daily Allowance already subtracts the Wishlist. Should Money Saved subtract the Wishlist too, so both figures are drawn from the same starting pot?
Answer: I'm having sort of a brain melt right now, but I'l just say this: Money Saved is basically your currency on the Wishlist playground. It's not something that carries over. It's what you can spend to buy cool shit on the Wishlist.

02. The Buffer is described as "set once, permanent." If you ever do change it anyway, should that change apply retroactively (recalculating past months as if the new Buffer had always been there), or only forward from the change?
Answer: Only forward — past months keep their old Buffer, same as how deleting a Base item works.

03. When you add a brand-new Base Income or Base Spend item, should it count in months before it was created — or only from the month you added it onward?
Answer: Only from now onward — past months are left exactly as they were.

04. Wishlist items — and their "purchased" checkmarks — get discarded at the end of the month. Should the purchased checkmark just vanish along with the item, or should it leave some kind of record behind?
Answer: Keep a lightweight record somewhere, so you can look back and see what you actually bought in past months.

05. Deletion history is only specified for Base items (forward-only, past months keep it). What about deleting a Flex Spend, Flex Income, or Wishlist item — plain removal with no history kept?
Answer: Keep a quiet history for these too, in case something gets deleted by accident.

06. This is a personal, single-user app. Do you want real login, or is something lighter enough?
Answer: Full login via Firebase Auth (email/password or Google sign-in).

07. How should a month actually "end"? Automatically at midnight on the 1st via a scheduled job, or only when you next open the app and it notices the date has changed?
Answer: Lazy — nothing runs in the background. The app checks the date when you open it and starts the new month then.

08. Firestore is already the chosen backend. For hosting the site itself, stay inside the Firebase family, or split the frontend out to somewhere like Vercel?
Answer: Github pages

09. The spec is TRY-only, whole lira, no decimals, throughout. Hard-code that, or build it as a setting even though only TRY is used today?
Answer: Hard-code TRY and whole numbers only — build exactly what the spec says, nothing speculative.

10. Will you ever want to log or check things from your phone, or is this strictly a desktop tool?
Answer: This is strictly a mobile tool. Extreme mobile priority.


