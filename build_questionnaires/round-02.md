# gurgenBudget Build Questop — Round 02 Answers

Paste the copied Q&A block from the questionnaire artifact below this line.

---

gurgenBudget — Build Questop, Round 2 of 10

01. Should each item category (Base Income, Flex Income, Base Spend, Flex Spend, Wishlist) live in its own Firestore collection, or should they all sit in one shared "items" collection with a field marking which category each one belongs to?
Answer: One shared "items" collection, with a category field.

02. Should each day's log entry be its own small Firestore document, or should a whole month's worth of days live together in one document (e.g. a map of day-number to amount)?
Answer: One document per day.

03. The Buffer is "set once, permanent," but if it's ever changed, the change should only apply going forward — the same rule as Base item history. Should the Buffer track its own small history of past values, or is a single current value enough since it changes so rarely?
Answer: Give the Buffer its own history, same mechanism as Base items.

04. When a Flex Income, Flex Spend, or Wishlist item gets deleted, the spec wants a quiet safety-net history kept. Should that deleted item just get a "deleted" flag and stay in the same collection (hidden from view), or get moved into a separate "trash" collection?
Answer: A "deleted" flag on the same document, filtered out of normal views.

05. For styling the app, should it be plain CSS (hand-written stylesheets, matching how the Exhibop mockups were built), or a utility framework like Tailwind?
Answer: Plain hand-written CSS.

06. For talking to Firestore, should the app call the Firebase SDK directly inside small custom hooks, or go through a general-purpose data-fetching library (like TanStack Query) layered on top?
Answer: Firebase SDK directly, in custom hooks.

07. When you mark a Wishlist item purchased (or log a day), should the screen update immediately while the save happens in the background (and quietly correct itself if the save fails), or wait for Firestore to confirm the write before changing anything on screen?
Answer: Update immediately, correct quietly if the save fails (optimistic update).

08. Does swiping between screens in the ring actually change the browser URL/route (so the back button and reloading land you on the same screen), or is the ring purely an on-screen state that always resets to Dashboard on reload?
Answer: I would prefer a sophisticated seamless experience, and I feel like seperate URLs would work against that. I am also not against using Tailwind, however the truth is I know absolutely nothing about web design and this is all up to you.

09. For formatting whole-lira figures (₺45,000, not ₺45000), should the app use the browser's built-in number formatting (Intl.NumberFormat), or a small hand-written formatting function?
Answer: The browser's built-in Intl.NumberFormat.

10. Right now, Firestore's security rules only check that a document lives under the right user's own path. Should they stay that simple, or also enforce the shape of the data itself (e.g. rejecting a write where the amount isn't a number)?
Answer: Keep rules simple — ownership-only, no shape enforcement.

