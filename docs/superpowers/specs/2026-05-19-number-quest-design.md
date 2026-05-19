# Number Quest — Design

**Date:** 2026-05-19
**Status:** Approved (brainstorming phase)

## Goal

Add a second playable game to Edu Games that doubles as math practice for the
author's kids. The game is a classic snake reskinned as "eat-the-answer": the
HUD shows an arithmetic question, the board holds one correct pellet and several
plausible wrong pellets. Correct = grow, wrong = shrink. Three difficulty tiers
scale the math, snake speed, pellet count, and death rules together so a single
"how hard" knob covers both arithmetic and navigation.

This fills the existing `number-quest` (Math / space) placeholder in
`games.json` rather than introducing a new slot.

## Non-Goals

- Touch / mobile controls (desktop arrow keys + WASD only).
- Achievements, badges, lifetime totals, leaderboards.
- Cross-game scoring or profile integration (covered by the broader SPA
  migration in [`2026-05-18-edu-games-site-design.md`](2026-05-18-edu-games-site-design.md)).
- Sound effects (out of scope; can be added later without redesign).
- Configurable math content separate from tier (tier choice picks the math —
  no independent "addition only on Hard" knob).
- A boss mode or unlockables beyond per-tier best length.

## Audience and Scale

Same as the broader site: the author's own kids. One device at a time, no
network, no traffic. Justifies a single-file game with hand-rolled rendering
and manual verification.

## Game Identity

| Field | Value |
|---|---|
| `slug` | `number-quest` |
| `title` | Number Quest |
| `blurb` | Steer the snake. Eat the right answer. Grow. |
| `subject` | Math |
| `icon` | `ti-planet` |
| `accent` | `space` |
| `status` | `playable` (flipped from `coming-soon`) |

The existing entry in `games.json` is updated in place — the manifest schema
already supports everything needed.

## Mechanics

### Per-round flow

A round ends when the kid answers 10 questions correctly, or the snake dies
under that tier's rules. Wrong eats do not count toward the 10 — the same
question stays on screen until it's answered correctly.

For each question:

1. The HUD shows the question (e.g. `7 × 8 = ?`).
2. Pellets are spawned: exactly one correct + N wrong, where N depends on tier
   (see table). Pellets occupy free board cells, never overlapping the snake.
3. The snake moves continuously on a fixed tick. Arrow keys and WASD steer.
   180° reversals are blocked (queuing the opposite of the current direction is
   ignored — standard snake rule).
4. **Eating the correct pellet:** snake grows by 1, `qCorrect` increments, the
   board refreshes with the next question and a fresh pellet set.
5. **Eating a wrong pellet:** snake shrinks by 1 (tail removed, length floors
   at 1), the eaten pellet disappears, the question and remaining pellets
   stay. `qCorrect` does **not** increment. The kid keeps trying.

The round always terminates: each wrong eat removes one distractor, so within
at most `N + 1` eats per question the only remaining pellet is the correct
one. Worst-case path length is `(N + 1) × 10` eats per round, which is finite
even on Hard (5 × 10 = 50). Snake death (Medium/Hard) is the other exit.

### Tier table

| Tier | Math content | Pellets (correct + wrong) | Snake speed (ms / tick) | Death rule |
|---|---|---|---|---|
| Easy | Addition and subtraction, results in `0..20` | 1 + 2 | 220 | Walls wrap; self-collision ignored |
| Medium | Multiplication, factors in `1..10` | 1 + 3 | 170 | Walls kill; self-collision ignored |
| Hard | Mixed: multiplication and division (division is the inverse of the 1..10 multiplication table, so always integer results) | 1 + 4 | 130 | Walls and self both kill |

### Starting state

- Board: 20 columns × 15 rows. At a 32px cell that's 640 × 480, comfortably
  inside the existing 720px game container. The implementation plan may shift
  this by ±a few cells if the cell size needs to flex with the HUD height,
  but the aspect ratio and rough size should hold.
- Snake: length 3, head at roughly the center of the board, facing right.
- First question + pellets generated immediately on round start.
- Tick loop starts on the first key press, *not* on round start, so the kid
  has time to read the first question. (Open to revisiting if it feels wrong
  in playtest — the implementation plan should call this out.)

### Score

Score = snake length at the moment the round ends.

- Final length is shown on the Results screen.
- `bestByTier[tier]` is updated and persisted iff the new length exceeds the
  saved best for that tier.
- The questions-correct count (`X/10`) is shown alongside as a secondary stat
  but is not used as the score.

### Question generation

`generateQuestion(tier)` returns `{prompt: string, answer: number}`.

- **Easy:** pick op ∈ {`+`, `−`}. For `+`, pick `a, b ∈ 0..20` with `a + b ≤ 20`.
  For `−`, pick `a ∈ 0..20` then `b ∈ 0..a`. Prompt: `"a + b = ?"` etc.
- **Medium:** pick `a, b ∈ 1..10`. Prompt: `"a × b = ?"`. Answer: `a * b`.
- **Hard:** flip a coin between × and ÷.
  - × as in Medium but with `a, b ∈ 1..10`.
  - ÷ generated as the inverse: pick `b ∈ 1..10`, pick `q ∈ 1..10`, prompt
    `"(b × q) ÷ b = ?"` — written `"P ÷ b = ?"` where `P = b × q`. Answer: `q`.

### Distractor generation

`generateDistractors(answer, tier)` returns an array of N integers (`N` per
tier table) that are plausible wrong answers. Rules:

- Never equal to `answer`.
- Never duplicate within the set.
- Always non-negative integers.
- Source pool: `answer ± 1, answer ± 2, answer ± 10`, plus a tier-appropriate
  "near-miss" (e.g. for `7 × 8 = 56`, include `54` from `6 × 9`; for
  `12 − 5 = 7`, include `17` from misreading the op). Implementation may
  simplify to ±1 / ±2 / ±10 / random nearby integer in the first pass and
  refine if rounds feel too easy.

### Collisions

A "collision" is what happens when the snake's head moves onto a cell.

| Cell contents | Easy | Medium | Hard |
|---|---|---|---|
| Empty | Move; tail shifts | Move; tail shifts | Move; tail shifts |
| Off the grid | Wrap to opposite edge | End round | End round |
| Own body | Pass through harmlessly | Pass through harmlessly | End round |
| Correct pellet | Grow by 1, advance question | Grow by 1, advance question | Grow by 1, advance question |
| Wrong pellet | Shrink by 1 (floor 1), pellet vanishes | Shrink by 1 (floor 1), pellet vanishes | Shrink by 1 (floor 1), pellet vanishes |

## Screens

### Start screen (`#nq-start`)

- "Back to games" link top-left (matches the multiplication game's pattern).
- Title "Number Quest" + one-line blurb.
- Three large tier buttons stacked vertically:
  - **Easy** — `+` / `−` — `Best: <n>` (or "—" if never played).
  - **Medium** — `×` — `Best: <n>`.
  - **Hard** — `×` and `÷` — `Best: <n>`.

Shown on initial load and after every Results screen.

### Play screen (`#nq-play`)

- **HUD strip** along the top:
  - Left: the question, large and prominent (e.g. `7 × 8 = ?`).
  - Right: three small stats — `Length N` · `Q n/10` (where `n = qCorrect`) ·
    `Best m` (current tier's best for context / motivation).
- **Board** below the HUD: a CSS grid container of `cols × rows` cells.
  Snake segments and pellets are absolutely positioned `<div>`s inside the
  board, placed by their `row, col` via CSS variables. The snake's head is
  visually distinct from the body. Pellets show their number large enough to
  read at a glance; correct and wrong pellets look identical (no visual tells).
- **End round** button bottom-right of the screen. Clicking it immediately
  ends the round at the current stats and goes to Results — same affordance
  the multiplication game added in commit `e63cd29`.
- **Visual feedback:**
  - Correct eat: pellet pops, brief green flash on the cell, new tail segment
    fades in.
  - Wrong eat: pellet pops red, snake shake animation (reusing the
    `mt-shake`-style keyframe), tail segment fades out.

Layout follows mockup A from brainstorming: HUD on top, full-width board.

### Results screen (`#nq-results`)

- Headline: the final snake length, big.
- Sub-stats: `X / 10 correct` (10 unless the snake died early), `final length N`,
  `tier: Easy/Medium/Hard`.
- "New best!" badge if `length > bestByTier[tier]` *before* this round.
- Buttons: **Play again** (same tier, jumps back to Play with a fresh round)
  and **Back** (returns to Start screen).

### Theme decorations

Reuses the `space` accent from `tokens.css` — purple background tint. Scatters
star and planet decorations (`ti-planet`, `ti-star`, etc.) pinned to the
viewport, matching the multiplication game's theme-decoration pattern
introduced in commits `d86a9ee` / `2257fa5` / `2fa01ea`. Decorations sit
behind the game container and do not interfere with the board.

## Controls

Desktop only.

| Input | Effect |
|---|---|
| `ArrowUp` / `W` | Queue direction up |
| `ArrowDown` / `S` | Queue direction down |
| `ArrowLeft` / `A` | Queue direction left |
| `ArrowRight` / `D` | Queue direction right |
| `Esc` | End round (same as End-round button) |

Direction queuing prevents 180° reversals on the same tick. The actual
direction change applies on the next tick to avoid mid-tick teleporting.

## Persistence

Storage key: `nq-stats`. Wrapper: existing `window.storage` polyfill
(`shared/storage.js`).

Schema (JSON-serialised string):

```json
{ "version": 1, "bestByTier": { "easy": 0, "medium": 0, "hard": 0 } }
```

Load on `initApp()`; save after each round whose final length beats the
recorded best for that tier. No migration code needed in v1 — when v2 arrives,
the existing multiplication-game pattern (defensive defaults + `version`
check) is the template.

## File Structure

Single-file game, same convention as `games/multiplication-tables/`:

```
games/number-quest/
└── index.html        # HTML + CSS + JS in one document
```

Document skeleton mirrors the multiplication game:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Number Quest — Edu Games</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@<pinned>/dist/tabler-icons.min.css">
  <link rel="stylesheet" href="../../shared/tokens.css">
  <script src="../../shared/storage.js"></script>
  <style>/* game styles */</style>
</head>
<body>
  <a class="nq-back" href="../../">← Games</a>
  <div class="game-container">
    <section id="nq-start" class="nq-screen"></section>
    <section id="nq-play"  class="nq-screen" hidden></section>
    <section id="nq-results" class="nq-screen" hidden></section>
  </div>
  <script>(async () => { /* game logic */ })();</script>
</body>
</html>
```

Tabler Icons version is pinned to whatever the multiplication game pins —
they should match.

## Code Architecture

Hand-rolled, no engine, no build. Mirrors the multiplication game's
single-module style.

### State

One module-level object:

```js
const state = {
  screen: 'start',           // 'start' | 'play' | 'results'
  tier: null,                // 'easy' | 'medium' | 'hard' | null
  snake: [],                 // [{row, col}, ...] — head at index 0
  dir: 'right',
  queuedDir: null,
  pellets: [],               // [{row, col, value, correct: bool}]
  question: null,            // {prompt: '7 × 8 = ?', answer: 56}
  qCorrect: 0,               // 0..10 — correct answers so far; round ends at 10
  tickId: null,              // setInterval handle
  startedMoving: false,      // tick loop only runs after first key press
  bestByTier: { easy: 0, medium: 0, hard: 0 },
};
```

### Functions (responsibility breakdown)

| Function | Responsibility |
|---|---|
| `initApp()` | Boot. Load stats. Wire start-screen buttons. Render initial screen. |
| `showScreen(name)` | Toggle `hidden` on the three screen sections. |
| `renderStart()` | Paint tier buttons with current `bestByTier`. |
| `startRound(tier)` | Reset state, build board grid, spawn snake at center, generate first question + pellets, attach keydown handler, transition to Play. Tick does not start yet. |
| `handleKey(e)` | Translate key → `queuedDir`, ignore reversals. On first valid key, kick the tick loop via `startedMoving = true; tickId = setInterval(tick, tierSpeed)`. |
| `tick()` | Apply `queuedDir → dir`. Compute next head cell. Resolve collision (wrap / wall-death / self-death / pellet eat / empty). Repaint. |
| `eat(pellet)` | Branch on `pellet.correct`. If correct: grow snake, increment `qCorrect`, call `nextQuestion()` — or `endRound('done')` if `qCorrect === 10`. If wrong: shrink snake (floor 1), remove pellet from `state.pellets`. |
| `nextQuestion()` | `question = generateQuestion(tier)`, `pellets = spawnPellets()`, repaint HUD + board. |
| `generateQuestion(tier)` | See "Question generation" above. Returns `{prompt, answer}`. |
| `generateDistractors(answer, tier)` | See "Distractor generation" above. Returns N integers. |
| `spawnPellets()` | Pick `1 + N` distinct empty cells (not on snake), assign correct + distractor values, shuffle so correct isn't always at index 0. |
| `endRound(reason)` | Clear `tickId`. Compute final length. If `length > bestByTier[tier]` save it. Persist stats. Render Results. |
| `renderHud()` | Update question text and stats line. |
| `renderBoard()` | Repaint snake segments + pellets. Idempotent — safe to call every tick. |
| `loadStats()` / `saveStats()` | `window.storage.get('nq-stats')` / `set('nq-stats', JSON.stringify(state.bestByTier))`. |

No classes; functions read/write `state` directly, like the multiplication
game. If `index.html` grows past ~800 lines and a clear seam emerges, the
implementation plan can revisit splitting — but v1 stays single-file to match
convention.

### Tier config

```js
const TIERS = {
  easy:   { distractors: 2, tickMs: 220, wrap: true,  selfKills: false, math: 'addsub'  },
  medium: { distractors: 3, tickMs: 170, wrap: false, selfKills: false, math: 'mult'    },
  hard:   { distractors: 4, tickMs: 130, wrap: false, selfKills: true,  math: 'multdiv' },
};
```

One source of truth that the tick loop, collision handler, and question
generator all read from.

## Manifest Update

`games.json` change: the existing `number-quest` entry flips `status` from
`"coming-soon"` to `"playable"`. The blurb is updated to the design's blurb.
Everything else (slug, title, subject, icon, accent) is already correct.

## Verification

Manual verification — no test framework in place. Each item must pass before
the game ships:

- [ ] Opening `games/number-quest/index.html` via a local dev server shows
      the Start screen with three tier buttons and the "← Games" link.
- [ ] Each tier button shows "—" before any round is played; shows the best
      length after.
- [ ] Selecting **Easy** starts a round: snake length 3, question visible in
      HUD, 3 pellets on board (1 correct + 2 wrong).
- [ ] The tick loop does not start until the first arrow / WASD key press.
- [ ] Eating a correct pellet grows the snake by 1, advances `Q n/10`,
      refreshes pellets and question.
- [ ] Eating a wrong pellet shrinks the snake by 1, removes that pellet, and
      leaves the question + other pellets.
- [ ] Snake length floors at 1 — repeated wrongs at length 1 do not shrink
      further.
- [ ] On Easy, the snake wraps at walls and passes through itself.
- [ ] On Medium, wall hit ends the round; passing through self does not.
- [ ] On Hard, wall or self hit ends the round.
- [ ] After 10 correct answers, the Results screen shows final length, `10/10
      correct`, and "New best!" when applicable.
- [ ] On Medium/Hard, dying before 10 correct still shows the Results screen
      with the partial `X/10 correct` count and final length.
- [ ] Reloading the page preserves best length per tier.
- [ ] The "End round" button (and `Esc`) mid-game goes to Results with the
      current state's stats.
- [ ] Math content is correct per tier: Easy is +/− with results 0–20;
      Medium is × tables 1–10; Hard is mixed × and ÷.
- [ ] Distractors are never duplicates and never equal to the correct answer.
- [ ] Landing page (`/`) shows Number Quest as playable; clicking it
      navigates to the game.
- [ ] Theme decorations (stars / planets) appear behind the game container
      and don't interfere with input.

### Optional self-test harness

The implementation plan may add a small `?test=1` query-flag block that runs
the question and distractor generators 1000× per tier and console-asserts:

- every generated prompt parses to a valid arithmetic expression matching
  `answer`,
- every distractor is a non-negative integer,
- no distractor set contains the correct answer,
- no distractor set contains duplicates.

This is optional and easy to delete when a real test framework arrives. Skip
if the implementation feels tight enough to verify by play alone.

## Risks and Notes

- **Tick speed needs playtesting.** The values in the tier table (220 / 170 /
  130 ms) are educated guesses. The implementation plan should call out a
  playtest step where the kids actually try each tier and the numbers get
  tuned. Adjust in the `TIERS` constant if needed.
- **Distractor difficulty needs playtesting.** "Plausible" is subjective —
  rounds might feel too easy with naive ±1/±2 distractors. Be ready to add
  the "near-miss from a related times-table row" rule if so.
- **First-question read time.** Starting the tick loop only on first key
  press is a deliberate choice so the kid can read the question without
  panicking. If it feels weird ("why isn't anything happening?"), fall back
  to a 1–2 second grace timer.
- **Single-file size.** This game is probably 600–900 lines once styled.
  Still small enough to live in one file alongside the multiplication game's
  889-line `index.html`. If it grows much past that, the spec for the next
  game should revisit shared infrastructure (a `shared/snake.js`? probably
  not yet).
- **No mobile.** Explicitly out of scope. If the kids want to play on a
  tablet, controls are a separate follow-up — the current architecture
  doesn't preclude it.

## Future Migration

When the SPA migration in
[`2026-05-18-edu-games-site-design.md`](2026-05-18-edu-games-site-design.md)
happens:

- `games.json` becomes the route table — Number Quest's entry needs no
  changes.
- `window.storage` keeps working via the wrapper.
- The game's own code (board grid, tick loop, question generator) is
  framework-agnostic and survives unchanged.
- Theme decorations and HUD will likely be wrapped by SPA chrome rather than
  the game owning the viewport — implementation plan should keep the game's
  outer container assumption-free (no `position: fixed` on game-owned
  elements).

The design intentionally borrows the multiplication game's patterns so that
when one migrates, the other follows the same recipe.
