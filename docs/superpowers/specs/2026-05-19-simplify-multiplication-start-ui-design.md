# Multiplication Game — Start UI Simplification

**Date:** 2026-05-19
**Status:** Approved (brainstorming phase)
**Touches:** `games/multiplication-tables/index.html` only.

## Goal

The start screen of the multiplication-tables game shows too many configuration
chips (mode tabs, time-per-question, tables-to-practice, questions-per-round).
For the personal-family-use audience this is overwhelming choice. Replace the
configuration UI with three one-click mode buttons and hardcode the previously
configurable values.

## Non-Goals

- Anything outside this game file. The landing page, manifest, shared infra,
  and other games stay untouched.
- Dark mode, profile UI, landing-page theme picker — still deferred.
- Reflecting the new mode list in `games.json` — the manifest only describes
  the landing-page card, not per-game internals.

## Modes

Three modes. Each one is its own start-button on the settings screen — one
click launches the mode immediately.

| Mode | Timer | Question count | Notes |
|------|-------|----------------|-------|
| `practice` | none | unlimited | User ends manually via an "End practice" button on the playing screen. |
| `play10`   | 10 s | 10 | Identical timing/boss/streak behavior to today's "classic 10". |
| `play20`   | 10 s | 20 | Identical timing/boss/streak behavior to today's "classic 20". |

Bosses (every 5 questions), inversion problems, streak multipliers, confetti,
sound effects, and Tabler-icon polish apply in **all three** modes. The only
mechanical difference is that practice has no timer, no timeout path, and no
fixed end.

## Settings (Start) Screen

The simplified screen has these blocks, top to bottom:

1. **Header row:** title (`Times tables` + theme icon) on the left, sound
   toggle on the right.
2. **Subtitle:** `Pick a mode below to start` (replaces "Beat the clock,
   build streaks, defeat bosses" which no longer covers practice).
3. **Mode picker:** three large equally-weighted buttons. Each shows a
   Tabler icon, name, and a one-line descriptor:
   - `ti-school` **Practice** — "no timer, play as long as you like"
   - `ti-player-play` **Play 10** — "10 questions, 10 s each"
   - `ti-player-play` **Play 20** — "20 questions, 10 s each"
   The buttons are displayed in a single row on tablet/desktop widths and
   stack vertically at narrow widths (< 540 px). Clicking any one of them
   starts that mode immediately — there is no separate "Start" button.
4. **Theme picker:** unchanged. Four chips: Classic, Jungle, Space, Ocean.
5. **Best scores summary:** conditional block (see Persistence).
6. **Achievements grid:** 9 cells, 3 columns. Same render style as today.

**Removed entirely:**
- Classic/Survival mode tabs
- Time-per-question chips
- Tables-to-practice chips
- Questions-per-round chips
- The separate "Start round" / "Start survival" button (mode buttons are
  themselves the launchers)

## Playing Screen

### Play 10 and Play 20

No visible changes beyond the status text:

- Status reads `Question N of 10` (or `of 20`).
- Same timer bar, problem display, input box, Submit button, Enter-to-submit
  hint, tick sound at low time, etc.

### Practice

- **Timer bar is removed entirely.** No `mt-timer-bar` div in the DOM, no
  countdown interval, no tick sound, no timeout path. Practice problems
  cannot time out — the user takes as long as they want.
- Status reads `Practice · Qn` (where `n` is the 1-indexed current question).
  No total, no `· survival` tag.
- The "Press Enter to submit" hint is unchanged.
- An **"End practice"** button (using the existing `mt-ghost` style) appears
  next to the Submit button. Clicking it ends the session and goes to the
  results screen using the answers given so far.

The boss-round intro, streak multipliers, inversion problems, confetti, and
sound effects all behave exactly as in Play 10/20.

## Results Screen

The existing results screen layout is reused with two small label changes:

- **Practice mode:** header reads `Practice session · N questions` and the
  "New personal best" badge is **not** shown (practice is not tracked as a
  best score — see Persistence).
- **Play 10 / Play 20:** behave exactly as today's classic-mode results
  (with the "New personal best" badge when applicable).

The "Play again" button restarts the same mode. "Change settings" returns to
the settings screen.

## Persistence

The single `mt-stats` localStorage entry keeps its key but its shape changes:

```js
{
  achievements: [...],   // unchanged
  totalAnswered: 123,    // unchanged
  bestByMode: { play10: 150, play20: 320 },   // renamed from bestClassic
}
```

**Migration (on load, first time only):**

1. If the loaded JSON has `bestClassic`, copy `bestClassic["10"]` →
   `bestByMode.play10` and `bestClassic["20"]` → `bestByMode.play20`
   (when present), then drop `bestClassic`.
2. Drop `bestSurvival` if present. Survival is gone.
3. If the loaded JSON has `achievements` containing `survival-10` or
   `survival-20`, drop those IDs from the array. The user does not get
   automatic unlocks for the replacement achievements.

After migration, save once so the file is in the new shape going forward.

**Practice is not ranked:** there is no `bestPractice` field. Practice
sessions still increment `totalAnswered` (so the `century` achievement still
works) and still trigger `streak-*`, `boss-defeated`, `speedy`, `marathon`,
and `streak-15` achievements.

## Achievements

Final list of 9 achievements:

| ID | Name | Icon | Trigger |
|----|------|------|---------|
| `streak-3`      | Three in a row  | `ti-flame`         | reach a 3-answer streak |
| `streak-5`      | Five in a row   | `ti-flame`         | reach a 5-answer streak |
| `streak-10`     | On fire!        | `ti-rocket`        | reach a 10-answer streak |
| `streak-15`     | Unstoppable     | `ti-bolt`          | reach a 15-answer streak (**new**) |
| `perfect`       | Perfect round   | `ti-medal`         | 10/10 or 20/20 in Play 10 / Play 20 |
| `boss-defeated` | Boss defeated   | `ti-target-arrow`  | beat a boss question |
| `marathon`      | Marathon        | `ti-infinity`      | answer 50 questions in a single practice session (**new**) |
| `century`       | 100 answered    | `ti-trophy`        | lifetime total answered ≥ 100 |
| `speedy`        | Lightning fast  | `ti-bolt`          | answer correctly in < 2 s (any timed mode) |

**Removed:** `survival-10` (Survivor), `survival-20` (Survival pro). They are
not reachable and not displayed.

**Practice and `perfect`:** `perfect` triggers only on full completion of
Play 10 or Play 20 with zero wrong answers. Practice cannot trigger it
(there's no fixed end). `speedy` requires the answer-elapsed-time to be
< 2 s; practice's elapsed time is still measured, so technically `speedy`
could trigger in practice — that's fine and matches the spirit of the
achievement.

## State Shape Inside the Game

Existing relevant state, with the changes called out:

```js
state.mode = 'practice' | 'play10' | 'play20';   // replaces 'classic' | 'survival'
state.timePerQuestion = 10;                       // hardcoded constant; no longer settable
state.tables = new Set([2,3,4,5,6,7,8,9,10,11,12]); // always full; no UI to change
state.totalQuestions = 10 | 20 | Infinity;        // derived from mode at start

state.bestByMode = { play10: 0, play20: 0 };      // replaces bestClassic + bestSurvival
```

The `getQuestionTime()` helper becomes trivial — always returns 10 — but it
is removed entirely because the new mode logic decides whether to start a
timer at all.

End-of-round logic:
- `play10` / `play20`: ends when `currentQuestion >= totalQuestions`.
- `practice`: ends only when the user clicks "End practice".
- No "one wrong answer ends the run" logic (that was survival).

## Out-of-Scope and Risks

- **Wrong-answers review list:** unchanged. Still shown at end of any mode
  including practice (limited to whatever was asked in the session).
- **`getQuestionTime()` shrinking-time formula:** belonged to survival mode.
  Removed.
- **Sound:** the tick sound only plays in Play 10 / Play 20. Practice is
  silent on the time-pressure side; it still has correct/wrong/boss/achieve
  sound effects.
- **Storage corruption resilience:** if the loaded JSON has unexpected
  fields, ignore them silently (consistent with the existing try/catch
  pattern around `loadAll`).

## Verification Checklist

After implementation, all the following must be true:

- [ ] Start screen shows the three mode buttons, the theme picker, sound
      toggle, best-scores summary block, and achievements grid — and
      nothing else from the old configuration UI.
- [ ] Clicking Practice opens the playing screen with no timer bar and an
      "End practice" button. The question can be left for minutes; no
      timeout fires.
- [ ] Clicking Play 10 starts a 10-question round with a 10-second timer
      per question. Identical to today's classic-mode behavior.
- [ ] Clicking Play 20 starts a 20-question round with a 10-second timer
      per question.
- [ ] Boss rounds, streak multipliers, inversion problems, confetti, and
      sound effects work in all three modes (modulo practice having no
      tick sound).
- [ ] After a Play 10 / Play 20 round, the results screen shows points,
      correct/total, best streak. After a Practice session, the results
      screen reads `Practice session · N questions` and no best-score
      badge.
- [ ] The Best Scores summary on the start screen reads `Play 10: …` and
      `Play 20: …` (each line conditional on having played that mode).
      The whole block hides when neither has been played.
- [ ] If localStorage previously had `bestClassic` / `bestSurvival` /
      survival-achievement IDs, they migrate as specified (best scores
      preserved, survival achievements silently dropped) on first load.
- [ ] Achievements grid shows 9 cells. The new `marathon`, `streak-15`
      icons are reachable via the new flows.
- [ ] No console errors in any of the flows. No icons render as empty
      squares.
