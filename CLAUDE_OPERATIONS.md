# Claude Operations

Reusable operation definitions for this project. When the user invokes an operation by name (e.g. "Gitops"), follow its steps exactly.

## Gitops

Triggered by: "Gitops" / "please Gitops"

1. Update relevant project documentation (e.g. PROJECT.md) to reflect the work just completed. Write these updates as already-accurate history — describe the commit/push/merge as done, since the git steps below will make that true by the time anyone reads the docs.
2. Commit the changes (docs + code) with a clear, conventional commit message.
3. Push the current branch.
4. Merge into `main`.

## Tachyon Mode

Triggered by: "Tachyon mode"

Skip the usual deliberation overhead and implement directly, using your own judgement in place of the steps below:

- No brainstorming skill invocation.
- No Playwright verification.
- No explicit up-front planning.
- No clarifying questions to the user — decide and proceed.
- No extensive testing — light/spot verification only.

**Overrides:** the user can re-enable any individual step by naming it explicitly in the same instruction, e.g. "Tachyon mode. You may use Playwright." or "Tachyon mode, but ask if unsure." Only the named exception is restored; everything else stays skipped.

## Questop

Triggered by: "Questop"

A multi-round Q&A cycle for gathering the user's decisions on a body of open questions, run as a published artifact plus a set of answer files. Defaults: 10 questions per round, 10 rounds total — both overridable by the user at kickoff.

**Setup**

1. Publish one artifact containing the first questionnaire: N questions, each multiple choice.
   - Every question also has a free-text input box at the bottom, for when none of the listed options fit.
   - Exactly one option per question is explicitly labeled as your recommendation.
   - Exactly one option per question is the literal choice "Your call" (i.e. "I have no preference, use your judgement").
   - Write questions and answers in plain, everyday language — light on jargon, not dumbed down.
   - Include a copy-to-clipboard button at the end that copies the full set of questions and answers.
2. Create N empty placeholder `.md` files (one per round) for the user to paste their answers into.

**Per round**

3. The user fills out the current questionnaire, pastes their answers into the matching placeholder file, and tells you it's done.
4. You update the project docs to reflect those answers.
5. You then republish the *same* artifact URL with the next round's questionnaire (same format, new questions).
6. Repeat until all rounds are complete.

**Overrides:** the user can change the question count and/or round count at kickoff (e.g. "Questop, 5 questions, 3 rounds"), and any other detail of this operation can be overridden the same way.

## Exhibop

Triggered by: "Exhibop [page]"

Uses the "Hallmark" plugin to produce a single HTML exhibition of 20 distinct first-look designs for the stated page.

Rules:
- **First look only** — these are static impressions, not interactive prototypes. No animation work required.
- **Hand-crafted, not generated** — each of the 20 designs is individually designed. No templated/mass-automated variation.
- **Hide button** — every design has a control that dismisses it "to the shadow realm" (removes it from view); the only way to bring it back is a page refresh.
- **Font** — Inter, and only Inter, on every design.
- **No sentences** — labels/fragments only, extremely non-wordy, barebones.
- **No vertical scrolling** — each design must fit within the viewport height.

**Overrides:** any of the above (design count, font, wordiness, scroll behavior, etc.) can be changed if the user states it explicitly.

---

*(More operations to be added below.)*
