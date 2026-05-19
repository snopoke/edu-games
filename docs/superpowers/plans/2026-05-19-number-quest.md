# Number Quest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Number Quest snake-with-questions game as a single-file HTML game and wire it into the existing landing page.

**Architecture:** One self-contained `games/number-quest/index.html` with inline CSS and JS, mirroring `games/multiplication-tables/index.html`. DOM-grid board, hand-rolled tick loop, three tiers driving math difficulty + snake speed + death rules from one `TIERS` config object. Pure question/distractor generators are exercised by an in-page `?test=1` self-test harness; everything else is verified by manual play against the spec's checklist.

**Tech Stack:** Plain HTML / CSS / JS, no build step. Tabler Icons via CDN (`@tabler/icons-webfont@3.30.0`, same pin as the multiplication game). `shared/tokens.css` and `shared/storage.js` already provide CSS variables and a `window.storage` polyfill — both are reused, neither is modified.

**Spec:** [`docs/superpowers/specs/2026-05-19-number-quest-design.md`](../specs/2026-05-19-number-quest-design.md)

**Local dev server:** From the project root, run `python3 -m http.server 8000`. The game's URL during development is `http://localhost:8000/games/number-quest/`. The self-test harness URL is `http://localhost:8000/games/number-quest/?test=1`.

**Convention notes:**

- The whole game lives in one file. Don't split into modules unless an obvious seam appears past Task 22.
- Commit messages follow the project style (look at `git log --oneline -10` for examples — imperative "Add X" / "Update Y" / "Tune Z").
- This codebase has no test framework. The `?test=1` self-test harness is the only programmatic check. The verification steps below are mostly manual — open the browser, press the key, look at the screen. That is the project's standard QA approach.
- `localStorage` is the persistence layer via the `window.storage` polyfill in `shared/storage.js`. Do not call `localStorage` directly — use the polyfill so future SPA migration works.

---

## File Structure

| File | Operation | Responsibility |
|---|---|---|
| `games/number-quest/index.html` | Create | The entire game: HTML scaffolding, all CSS, all JS, all three screens (Start/Play/Results), the `?test=1` harness. |
| `games.json` | Modify | Flip the existing `number-quest` entry to `"status": "playable"` and update its blurb. |

No other files change. `shared/tokens.css` and `shared/storage.js` are referenced as-is.

---

## Task 1: Create the skeleton document

**Files:**
- Create: `games/number-quest/index.html`

- [ ] **Step 1: Create the file with the skeleton**

Create `games/number-quest/index.html` with this content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Number Quest — Edu Games</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.30.0/dist/tabler-icons.min.css">
  <link rel="stylesheet" href="../../shared/tokens.css">
  <script src="../../shared/storage.js"></script>
  <style>
    :root {
      --nq-bg: #1a1140;
      --nq-bg-soft: #251a55;
      --nq-accent: #b9a8ff;
      --nq-cell: #2a1f63;
      --nq-cell-line: rgba(255,255,255,0.05);
      --nq-snake: #7df0a9;
      --nq-snake-head: #c8ffd8;
      --nq-pellet: #ffcc55;
      --nq-pellet-text: #2b1900;
      --nq-text: #f3eeff;
      --nq-text-soft: rgba(243,238,255,0.7);
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 2rem 1rem;
      background: var(--nq-bg);
      color: var(--nq-text);
      min-height: 100vh;
      box-sizing: border-box;
    }
    .game-container { max-width: 720px; margin: 0 auto; position: relative; }
    .nq-back {
      color: var(--nq-text-soft);
      text-decoration: none;
      font-size: 14px;
      display: inline-block;
      margin-bottom: 1rem;
    }
    .nq-back:hover { color: var(--nq-text); }
    .nq-screen[hidden] { display: none; }
  </style>
</head>
<body>
  <a class="nq-back" href="../../">← Games</a>
  <div class="game-container">
    <section id="nq-start" class="nq-screen"></section>
    <section id="nq-play" class="nq-screen" hidden></section>
    <section id="nq-results" class="nq-screen" hidden></section>
  </div>
  <script>
    'use strict';

    const state = {
      screen: 'start',
      tier: null,
      snake: [],
      dir: 'right',
      queuedDir: null,
      pellets: [],
      question: null,
      qCorrect: 0,
      tickId: null,
      startedMoving: false,
      bestByTier: { easy: 0, medium: 0, hard: 0 },
    };

    function showScreen(name) {
      state.screen = name;
      for (const id of ['nq-start', 'nq-play', 'nq-results']) {
        document.getElementById(id).hidden = (id !== `nq-${name}`);
      }
    }

    function init() {
      showScreen('start');
    }

    if (new URLSearchParams(location.search).get('test') !== '1') {
      init();
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Start the dev server (one-time per session)**

Run from the project root:

```bash
python3 -m http.server 8000
```

Leave it running in another terminal for the rest of the plan.

- [ ] **Step 3: Open the game in a browser**

Open `http://localhost:8000/games/number-quest/`.

Expected:
- Page loads with no console errors.
- "← Games" link visible top-left, navigates back to landing on click.
- Page is otherwise blank (the three `<section>`s are empty).

- [ ] **Step 4: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add number-quest skeleton page"
```

---

## Task 2: Add the self-test harness scaffold

**Files:**
- Modify: `games/number-quest/index.html` (extend the `<script>` block)

The harness is a small in-page runner that runs when the URL has `?test=1`. It is the only programmatic check in this project, so the runner needs to be visible in the browser too (not only console) — render a pass/fail summary at the top of the page so we can spot regressions at a glance.

- [ ] **Step 1: Add the harness functions and a test panel**

Find the `<script>` block. Right before `if (new URLSearchParams(...).get('test') !== '1') { init(); }`, add:

```js
    const tests = [];
    function test(name, fn) { tests.push({ name, fn }); }

    function runTests() {
      const root = document.createElement('div');
      root.style.cssText = 'background:#000;color:#fff;padding:1rem;font-family:ui-monospace,monospace;white-space:pre-wrap;font-size:13px;';
      document.body.prepend(root);
      let passed = 0, failed = 0;
      const lines = [];
      for (const t of tests) {
        try {
          t.fn();
          lines.push(`✓ ${t.name}`);
          passed++;
        } catch (e) {
          lines.push(`✗ ${t.name}\n    ${e && e.message ? e.message : e}`);
          failed++;
        }
      }
      const summary = `${passed}/${passed + failed} passed${failed ? ` — ${failed} FAILED` : ''}`;
      root.textContent = summary + '\n\n' + lines.join('\n');
      console.log(summary);
    }

    function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
    function assertEq(a, b, msg) {
      if (a !== b) throw new Error((msg || 'assertEq') + ` — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
    }
```

Then change the bottom guard from:

```js
    if (new URLSearchParams(location.search).get('test') !== '1') {
      init();
    }
```

to:

```js
    if (new URLSearchParams(location.search).get('test') === '1') {
      runTests();
    } else {
      init();
    }
```

- [ ] **Step 2: Add a smoke test so the panel renders something**

Just above `if (new URLSearchParams(...)) { ... } else { init(); }`, add:

```js
    test('harness is alive', () => { assertEq(1 + 1, 2); });
```

- [ ] **Step 3: Open the test URL and verify**

Open `http://localhost:8000/games/number-quest/?test=1`.

Expected: black panel at the top of the page shows `1/1 passed` and `✓ harness is alive`. No JS console errors.

- [ ] **Step 4: Verify the normal URL still works**

Reload `http://localhost:8000/games/number-quest/` (without `?test=1`).

Expected: no black panel, original blank page with "← Games" link still loads cleanly.

- [ ] **Step 5: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add number-quest self-test harness scaffold"
```

---

## Task 3: Add TIERS config and small utility helpers

**Files:**
- Modify: `games/number-quest/index.html` (extend the `<script>` block)

These are the constants and pure helpers every later task will use.

- [ ] **Step 1: Add the config and helpers**

In the `<script>` block, right after `'use strict';` and before the `state` definition, add:

```js
    const COLS = 20;
    const ROWS = 15;

    const TIERS = {
      easy:   { distractors: 2, tickMs: 220, wrap: true,  selfKills: false, math: 'addsub'  },
      medium: { distractors: 3, tickMs: 170, wrap: false, selfKills: false, math: 'mult'    },
      hard:   { distractors: 4, tickMs: 130, wrap: false, selfKills: true,  math: 'multdiv' },
    };

    function randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
```

- [ ] **Step 2: Add tests for `randInt` and `shuffle`**

Above the `test('harness is alive', ...)` line, add:

```js
    test('randInt is inclusive on both ends', () => {
      const seen = new Set();
      for (let i = 0; i < 1000; i++) seen.add(randInt(3, 5));
      assert(seen.has(3) && seen.has(4) && seen.has(5), 'range 3..5 should be covered');
      for (const v of seen) assert(v >= 3 && v <= 5, 'out of range: ' + v);
    });

    test('shuffle preserves elements', () => {
      const before = [1, 2, 3, 4, 5];
      const after = shuffle([...before]);
      assertEq(after.length, before.length);
      const sorted = [...after].sort((a, b) => a - b);
      assertEq(sorted.join(','), '1,2,3,4,5');
    });
```

- [ ] **Step 3: Open `?test=1` and verify**

Open `http://localhost:8000/games/number-quest/?test=1`.

Expected: `3/3 passed` shown in the panel.

- [ ] **Step 4: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add TIERS config and utility helpers for number-quest"
```

---

## Task 4: Add `generateQuestion` for Easy tier (+/−)

**Files:**
- Modify: `games/number-quest/index.html`

TDD: write the failing tests first, run, then implement.

- [ ] **Step 1: Add failing tests**

In the `<script>` block, before the harness guard, add:

```js
    test('easy questions: addition results in 0..20', () => {
      for (let i = 0; i < 1000; i++) {
        const q = generateQuestion('easy');
        assert(Number.isInteger(q.answer), 'answer must be integer: ' + q.answer);
        assert(q.answer >= 0 && q.answer <= 20, 'easy answer out of range: ' + q.answer);
        assert(/^[0-9]+ [+−] [0-9]+ = \?$/.test(q.prompt), 'bad prompt format: ' + q.prompt);
      }
    });

    test('easy questions: prompt arithmetic agrees with answer', () => {
      for (let i = 0; i < 1000; i++) {
        const q = generateQuestion('easy');
        const m = q.prompt.match(/^([0-9]+) ([+−]) ([0-9]+) = \?$/);
        assert(m, 'prompt did not parse: ' + q.prompt);
        const a = +m[1], b = +m[3];
        const expected = m[2] === '+' ? a + b : a - b;
        assertEq(q.answer, expected, 'prompt/answer mismatch: ' + q.prompt);
      }
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Open `http://localhost:8000/games/number-quest/?test=1`.

Expected: both new tests fail with something like `generateQuestion is not defined`. The smoke / utility tests from earlier still pass.

- [ ] **Step 3: Implement `generateQuestion` (Easy branch only)**

Add this function below the helpers block (after `shuffle`):

```js
    function generateQuestion(tier) {
      const math = TIERS[tier].math;
      if (math === 'addsub') {
        if (Math.random() < 0.5) {
          const a = randInt(0, 20);
          const b = randInt(0, 20 - a);
          return { prompt: `${a} + ${b} = ?`, answer: a + b };
        }
        const a = randInt(0, 20);
        const b = randInt(0, a);
        return { prompt: `${a} − ${b} = ?`, answer: a - b };
      }
      throw new Error(`unsupported math: ${math}`);
    }
```

Note: the subtraction prompt uses the Unicode minus `−` (U+2212), not the ASCII hyphen `-`. The test regex matches `[+−]` accordingly.

- [ ] **Step 4: Run tests to verify they pass**

Reload `http://localhost:8000/games/number-quest/?test=1`.

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add easy-tier question generator for number-quest"
```

---

## Task 5: Add `generateQuestion` for Medium tier (×)

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add failing tests**

Above the harness guard, add:

```js
    test('medium questions: multiplication 1..10 × 1..10', () => {
      for (let i = 0; i < 1000; i++) {
        const q = generateQuestion('medium');
        const m = q.prompt.match(/^([0-9]+) × ([0-9]+) = \?$/);
        assert(m, 'bad prompt format: ' + q.prompt);
        const a = +m[1], b = +m[2];
        assert(a >= 1 && a <= 10 && b >= 1 && b <= 10, 'factor out of range: ' + q.prompt);
        assertEq(q.answer, a * b);
      }
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Reload `http://localhost:8000/games/number-quest/?test=1`.

Expected: new test fails with `unsupported math: mult`.

- [ ] **Step 3: Extend `generateQuestion` to handle `mult`**

Modify `generateQuestion` so it now reads:

```js
    function generateQuestion(tier) {
      const math = TIERS[tier].math;
      if (math === 'addsub') {
        if (Math.random() < 0.5) {
          const a = randInt(0, 20);
          const b = randInt(0, 20 - a);
          return { prompt: `${a} + ${b} = ?`, answer: a + b };
        }
        const a = randInt(0, 20);
        const b = randInt(0, a);
        return { prompt: `${a} − ${b} = ?`, answer: a - b };
      }
      if (math === 'mult') {
        const a = randInt(1, 10);
        const b = randInt(1, 10);
        return { prompt: `${a} × ${b} = ?`, answer: a * b };
      }
      throw new Error(`unsupported math: ${math}`);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Reload `?test=1`.

Expected: 6/6 passed.

- [ ] **Step 5: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add medium-tier question generator for number-quest"
```

---

## Task 6: Add `generateQuestion` for Hard tier (× and ÷)

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add failing tests**

```js
    test('hard questions: × or ÷ with integer results 1..100', () => {
      let sawMul = false, sawDiv = false;
      for (let i = 0; i < 2000; i++) {
        const q = generateQuestion('hard');
        const mul = q.prompt.match(/^([0-9]+) × ([0-9]+) = \?$/);
        const div = q.prompt.match(/^([0-9]+) ÷ ([0-9]+) = \?$/);
        assert(mul || div, 'unrecognised prompt: ' + q.prompt);
        if (mul) {
          sawMul = true;
          const a = +mul[1], b = +mul[2];
          assert(a >= 1 && a <= 10 && b >= 1 && b <= 10);
          assertEq(q.answer, a * b);
        } else {
          sawDiv = true;
          const p = +div[1], b = +div[2];
          assert(b >= 1 && b <= 10);
          assert(p % b === 0, 'non-integer divide: ' + q.prompt);
          assertEq(q.answer, p / b);
          assert(q.answer >= 1 && q.answer <= 10);
        }
      }
      assert(sawMul, 'no × ever appeared');
      assert(sawDiv, 'no ÷ ever appeared');
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Reload `?test=1`. Expected: new test fails with `unsupported math: multdiv`.

- [ ] **Step 3: Extend `generateQuestion` to handle `multdiv`**

Modify `generateQuestion`:

```js
    function generateQuestion(tier) {
      const math = TIERS[tier].math;
      if (math === 'addsub') {
        if (Math.random() < 0.5) {
          const a = randInt(0, 20);
          const b = randInt(0, 20 - a);
          return { prompt: `${a} + ${b} = ?`, answer: a + b };
        }
        const a = randInt(0, 20);
        const b = randInt(0, a);
        return { prompt: `${a} − ${b} = ?`, answer: a - b };
      }
      if (math === 'mult') {
        const a = randInt(1, 10);
        const b = randInt(1, 10);
        return { prompt: `${a} × ${b} = ?`, answer: a * b };
      }
      if (math === 'multdiv') {
        if (Math.random() < 0.5) {
          const a = randInt(1, 10);
          const b = randInt(1, 10);
          return { prompt: `${a} × ${b} = ?`, answer: a * b };
        }
        const b = randInt(1, 10);
        const q = randInt(1, 10);
        return { prompt: `${b * q} ÷ ${b} = ?`, answer: q };
      }
      throw new Error(`unsupported math: ${math}`);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Reload `?test=1`. Expected: 7/7 passed.

- [ ] **Step 5: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add hard-tier question generator for number-quest"
```

---

## Task 7: Add `generateDistractors`

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add failing tests**

```js
    test('distractors: count matches request, no answer, no duplicates, non-negative', () => {
      for (const tier of ['easy', 'medium', 'hard']) {
        const count = TIERS[tier].distractors;
        for (let i = 0; i < 1000; i++) {
          const q = generateQuestion(tier);
          const ds = generateDistractors(q.answer, count);
          assertEq(ds.length, count, `${tier} distractor count`);
          assertEq(new Set(ds).size, count, `${tier} has duplicates: ${ds}`);
          for (const d of ds) {
            assert(Number.isInteger(d), `${tier} non-integer distractor: ${d}`);
            assert(d >= 0, `${tier} negative distractor: ${d}`);
            assert(d !== q.answer, `${tier} distractor equals answer: ${d}`);
          }
        }
      }
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Reload `?test=1`. Expected: new test fails with `generateDistractors is not defined`.

- [ ] **Step 3: Implement `generateDistractors`**

Add below `generateQuestion`:

```js
    function generateDistractors(answer, count) {
      const pool = new Set();
      for (const delta of [-1, 1, -2, 2, -10, 10, -5, 5]) {
        const v = answer + delta;
        if (v >= 0 && v !== answer) pool.add(v);
      }
      let guard = 0;
      while (pool.size < count && guard < 100) {
        const delta = randInt(-7, 7);
        const v = answer + delta;
        if (v >= 0 && v !== answer) pool.add(v);
        guard++;
      }
      return shuffle([...pool]).slice(0, count);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Reload `?test=1`. Expected: 8/8 passed.

- [ ] **Step 5: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add distractor generator for number-quest"
```

---

## Task 8: Render the Start screen

**Files:**
- Modify: `games/number-quest/index.html`

Now the visual work begins. From here on, the verification step is "open the game in a browser, do X, see Y" — there's no test framework for screen-level behaviour.

- [ ] **Step 1: Add Start-screen CSS**

In the `<style>` block, after `.nq-screen[hidden] { display: none; }`, add:

```css
    .nq-hero { text-align: center; padding: 1rem 0 2rem; }
    .nq-hero h1 { font-size: 2.5rem; margin: 0; }
    .nq-hero p { color: var(--nq-text-soft); margin: 0.5rem 0 0; }
    .nq-tier-list { display: grid; gap: 12px; max-width: 480px; margin: 0 auto; }
    .nq-tier {
      background: var(--nq-bg-soft);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      color: var(--nq-text);
      text-align: left;
      cursor: pointer;
      font: inherit;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .nq-tier:hover { border-color: var(--nq-accent); }
    .nq-tier h2 { margin: 0; font-size: 1.1rem; }
    .nq-tier-meta { color: var(--nq-text-soft); font-size: 0.85rem; }
    .nq-tier-best { font-size: 0.9rem; color: var(--nq-accent); }
```

- [ ] **Step 2: Add the `loadStats` function**

In the `<script>` block, after `generateDistractors`, add:

```js
    async function loadStats() {
      try {
        const r = await window.storage.get('nq-stats');
        if (!r || !r.value) return;
        const data = JSON.parse(r.value);
        if (data && data.bestByTier) {
          state.bestByTier = {
            easy: Number(data.bestByTier.easy) || 0,
            medium: Number(data.bestByTier.medium) || 0,
            hard: Number(data.bestByTier.hard) || 0,
          };
        }
      } catch (_e) { /* corrupt storage — keep defaults */ }
    }
```

- [ ] **Step 3: Add the `renderStart` function**

After `loadStats`, add:

```js
    function renderStart() {
      const tiers = [
        { id: 'easy',   title: 'Easy',   meta: 'Addition & subtraction' },
        { id: 'medium', title: 'Medium', meta: 'Multiplication tables' },
        { id: 'hard',   title: 'Hard',   meta: 'Multiplication & division' },
      ];
      const root = document.getElementById('nq-start');
      root.innerHTML = `
        <div class="nq-hero">
          <h1>Number Quest</h1>
          <p>Steer the snake. Eat the right answer. Grow.</p>
        </div>
        <div class="nq-tier-list">
          ${tiers.map(t => `
            <button class="nq-tier" data-tier="${t.id}">
              <span>
                <h2>${t.title}</h2>
                <div class="nq-tier-meta">${t.meta}</div>
              </span>
              <span class="nq-tier-best">Best: ${state.bestByTier[t.id] || '—'}</span>
            </button>
          `).join('')}
        </div>
      `;
      for (const btn of root.querySelectorAll('.nq-tier')) {
        btn.addEventListener('click', () => startRound(btn.dataset.tier));
      }
    }

    function startRound(tier) {
      // Placeholder — implemented in a later task.
      console.log('startRound', tier);
    }
```

- [ ] **Step 4: Hook `renderStart` into `init`**

Change `init` to:

```js
    async function init() {
      await loadStats();
      renderStart();
      showScreen('start');
    }
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:8000/games/number-quest/`.

Expected:
- "← Games" link top-left, then "Number Quest" hero with blurb.
- Three tier buttons: Easy / Medium / Hard, each showing "Best: —".
- Clicking a button logs `startRound easy` (or matching tier) in the console.
- `?test=1` URL still shows 8/8 passed.

- [ ] **Step 6: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add number-quest start screen with tier buttons"
```

---

## Task 9: Render an empty board on round start

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add board CSS**

In the `<style>` block, add:

```css
    .nq-hud {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .nq-question { font-size: 1.75rem; font-weight: 700; letter-spacing: 0.02em; }
    .nq-stats { color: var(--nq-text-soft); font-size: 0.9rem; }
    .nq-stats b { color: var(--nq-text); font-weight: 600; }

    .nq-board {
      --nq-cell-size: 32px;
      display: grid;
      grid-template-columns: repeat(20, var(--nq-cell-size));
      grid-template-rows: repeat(15, var(--nq-cell-size));
      gap: 1px;
      padding: 4px;
      background: var(--nq-cell-line);
      border-radius: 10px;
      width: max-content;
      margin: 0 auto;
      position: relative;
    }
    .nq-board::before {
      content: '';
      position: absolute;
      inset: 4px;
      background:
        repeating-linear-gradient(0deg, var(--nq-cell) 0 calc(var(--nq-cell-size)), var(--nq-cell-line) calc(var(--nq-cell-size)) calc(var(--nq-cell-size) + 1px)),
        repeating-linear-gradient(90deg, var(--nq-cell) 0 calc(var(--nq-cell-size)), var(--nq-cell-line) calc(var(--nq-cell-size)) calc(var(--nq-cell-size) + 1px));
      pointer-events: none;
      border-radius: 6px;
    }
```

- [ ] **Step 2: Add the Play-screen scaffold and render helpers**

Replace the placeholder `startRound` from Task 8 with this fuller version, and add `renderPlay` and `renderHud` below it:

```js
    function startRound(tier) {
      state.tier = tier;
      state.snake = [];
      state.dir = 'right';
      state.queuedDir = null;
      state.pellets = [];
      state.question = null;
      state.qCorrect = 0;
      state.startedMoving = false;
      if (state.tickId) { clearInterval(state.tickId); state.tickId = null; }
      renderPlay();
      showScreen('play');
    }

    function renderPlay() {
      const root = document.getElementById('nq-play');
      root.innerHTML = `
        <div class="nq-hud">
          <div class="nq-question" id="nq-question">&nbsp;</div>
          <div class="nq-stats">
            <span>Length <b id="nq-stat-length">3</b></span>
            &middot;
            <span>Q <b id="nq-stat-q">0</b>/10</span>
            &middot;
            <span>Best <b id="nq-stat-best">0</b></span>
          </div>
        </div>
        <div class="nq-board" id="nq-board"></div>
      `;
      renderHud();
    }

    function renderHud() {
      const q = state.question ? state.question.prompt : '';
      document.getElementById('nq-question').textContent = q;
      document.getElementById('nq-stat-length').textContent = state.snake.length || 0;
      document.getElementById('nq-stat-q').textContent = state.qCorrect;
      document.getElementById('nq-stat-best').textContent = state.bestByTier[state.tier] || 0;
    }
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:8000/games/number-quest/`. Click **Easy**.

Expected:
- Screen switches to Play.
- HUD strip on top: empty question slot on the left; `Length 0 · Q 0/10 · Best 0` on the right.
- A 20×15 grid below, with subtle grid lines and a dark cell background.
- No snake, no pellets yet.

- [ ] **Step 4: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add play-screen board and HUD scaffold for number-quest"
```

---

## Task 10: Render the snake on the board

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add snake CSS**

In the `<style>` block, after the board rules, add:

```css
    .nq-snake-seg, .nq-pellet {
      grid-column: var(--col);
      grid-row: var(--row);
      border-radius: 5px;
      z-index: 1;
      position: relative;
    }
    .nq-snake-seg {
      background: var(--nq-snake);
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
    }
    .nq-snake-seg.head { background: var(--nq-snake-head); }
```

- [ ] **Step 2: Add `renderBoard` and initial snake spawn**

In the `<script>` block, after `renderHud`, add:

```js
    function renderBoard() {
      const board = document.getElementById('nq-board');
      if (!board) return;
      let html = '';
      state.snake.forEach((seg, i) => {
        html += `<div class="nq-snake-seg${i === 0 ? ' head' : ''}" style="--col:${seg.col + 1};--row:${seg.row + 1}"></div>`;
      });
      state.pellets.forEach(p => {
        html += `<div class="nq-pellet" style="--col:${p.col + 1};--row:${p.row + 1}">${p.value}</div>`;
      });
      board.innerHTML = html;
    }
```

Then update `startRound` so it spawns the snake before rendering — find:

```js
      state.startedMoving = false;
      if (state.tickId) { clearInterval(state.tickId); state.tickId = null; }
      renderPlay();
      showScreen('play');
```

and replace with:

```js
      state.startedMoving = false;
      if (state.tickId) { clearInterval(state.tickId); state.tickId = null; }
      const midRow = Math.floor(ROWS / 2);
      const midCol = Math.floor(COLS / 2);
      state.snake = [
        { row: midRow, col: midCol },
        { row: midRow, col: midCol - 1 },
        { row: midRow, col: midCol - 2 },
      ];
      renderPlay();
      renderBoard();
      showScreen('play');
```

Also, update `renderHud` to use the snake length now that the snake exists — replace the line:

```js
      document.getElementById('nq-stat-length').textContent = state.snake.length || 0;
```

(it's already there; verify it reads `state.snake.length`).

- [ ] **Step 3: Verify in browser**

Reload and click **Easy**.

Expected:
- 3-segment snake horizontally near the centre of the board.
- Head segment (rightmost) is visually distinct (lighter).
- HUD shows `Length 3`.

- [ ] **Step 4: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Render snake on number-quest play board"
```

---

## Task 11: Spawn and render pellets

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add pellet CSS**

In the `<style>` block, add (after the snake-seg rule):

```css
    .nq-pellet {
      background: var(--nq-pellet);
      color: var(--nq-pellet-text);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 0 8px rgba(255, 204, 85, 0.5);
    }
```

- [ ] **Step 2: Add `spawnPellets` and `nextQuestion`**

In the `<script>` block, after `renderBoard`, add:

```js
    function isOccupied(row, col, extras = []) {
      if (state.snake.some(s => s.row === row && s.col === col)) return true;
      if (state.pellets.some(p => p.row === row && p.col === col)) return true;
      if (extras.some(e => e.row === row && e.col === col)) return true;
      return false;
    }

    function pickFreeCell(extras) {
      // Up to 200 attempts then bail (board is small, snake is small — fine in practice).
      for (let i = 0; i < 200; i++) {
        const row = randInt(0, ROWS - 1);
        const col = randInt(0, COLS - 1);
        if (!isOccupied(row, col, extras)) return { row, col };
      }
      return null;
    }

    function spawnPellets() {
      state.pellets = [];
      const tierCfg = TIERS[state.tier];
      const distractors = generateDistractors(state.question.answer, tierCfg.distractors);
      const values = [
        { value: state.question.answer, correct: true },
        ...distractors.map(v => ({ value: v, correct: false })),
      ];
      shuffle(values);
      const placed = [];
      for (const v of values) {
        const cell = pickFreeCell(placed);
        if (!cell) break;
        placed.push({ ...cell, ...v });
      }
      state.pellets = placed;
    }

    function nextQuestion() {
      state.question = generateQuestion(state.tier);
      spawnPellets();
      renderBoard();
      renderHud();
    }
```

- [ ] **Step 3: Have `startRound` generate the first question + pellets**

In `startRound`, after the snake-spawning block and before `renderPlay()`, add:

```js
      state.question = generateQuestion(tier);
      spawnPellets();
```

(So the sequence is: reset state → spawn snake → generate first question → spawn pellets → renderPlay → renderBoard → showScreen.)

- [ ] **Step 4: Verify in browser**

Reload, click **Easy**.

Expected:
- 3 pellets (1 + 2 distractors) on the board, each labeled with a number.
- The HUD shows a `+` or `−` question on the left.
- Pellets do not overlap the snake.
- Click **Medium** → 4 pellets; **Hard** → 5 pellets, math content matches the tier.

- [ ] **Step 5: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Spawn and render answer pellets per question"
```

---

## Task 12: Keyboard input → direction queue

**Files:**
- Modify: `games/number-quest/index.html`

The tick loop does not start yet. This task only wires keys to the queue and confirms the input layer works.

- [ ] **Step 1: Add `handleKey` and wire it up**

In the `<script>` block, after `nextQuestion`, add:

```js
    const KEY_DIRS = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
    };

    function isOpposite(a, b) {
      return (a === 'up' && b === 'down') ||
             (a === 'down' && b === 'up') ||
             (a === 'left' && b === 'right') ||
             (a === 'right' && b === 'left');
    }

    function handleKey(e) {
      if (state.screen !== 'play') return;
      const dir = KEY_DIRS[e.key];
      if (!dir) return;
      e.preventDefault();
      if (isOpposite(dir, state.dir)) return;
      state.queuedDir = dir;
      if (!state.startedMoving) {
        startTickLoop();
      }
    }

    function startTickLoop() {
      // Implemented in the next task.
      state.startedMoving = true;
      console.log('would start tick loop');
    }

    window.addEventListener('keydown', handleKey);
```

- [ ] **Step 2: Verify in browser**

Reload, click **Easy**, press an arrow key.

Expected:
- Console prints `would start tick loop` exactly once on the first valid key.
- Subsequent key presses do not log again.
- Press the opposite of the current direction (left, since the snake faces right): no log, no error.
- Switching to a perpendicular direction (up/down): no extra log.

- [ ] **Step 3: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Wire keyboard input to direction queue for number-quest"
```

---

## Task 13: Tick loop and snake movement (no collisions)

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Implement `startTickLoop` and `tick`**

Replace the stub `startTickLoop` with:

```js
    function startTickLoop() {
      if (state.startedMoving) return;
      state.startedMoving = true;
      const ms = TIERS[state.tier].tickMs;
      state.tickId = setInterval(tick, ms);
    }

    function tick() {
      if (state.queuedDir && !isOpposite(state.queuedDir, state.dir)) {
        state.dir = state.queuedDir;
      }
      state.queuedDir = null;

      const head = state.snake[0];
      let nr = head.row;
      let nc = head.col;
      if (state.dir === 'up') nr--;
      else if (state.dir === 'down') nr++;
      else if (state.dir === 'left') nc--;
      else if (state.dir === 'right') nc++;

      // Wall handling — placeholder: just stop ticking if out of bounds.
      // (Replaced with proper wrap/death logic in Task 14.)
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
        clearInterval(state.tickId);
        state.tickId = null;
        return;
      }

      state.snake.unshift({ row: nr, col: nc });
      state.snake.pop();
      renderBoard();
      renderHud();
    }
```

- [ ] **Step 2: Verify in browser**

Reload, click **Easy**, press a direction key.

Expected:
- Snake starts moving in that direction at the Easy speed (220ms/tick — visible but not fast).
- Steers via arrow keys / WASD.
- Walks off any wall — stops (placeholder behaviour). No errors.

- [ ] **Step 3: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add tick loop and snake movement for number-quest"
```

---

## Task 14: Wall behaviour driven by `TIERS`

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add `endRound` stub**

In the `<script>` block, after `tick`, add:

```js
    function endRound(reason) {
      if (state.tickId) { clearInterval(state.tickId); state.tickId = null; }
      // Placeholder — Results screen wiring lands in Task 18.
      console.log('endRound', reason, 'length=' + state.snake.length, 'qCorrect=' + state.qCorrect);
      showScreen('start');
    }
```

- [ ] **Step 2: Replace the wall-handling block in `tick`**

Find this block in `tick`:

```js
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
        clearInterval(state.tickId);
        state.tickId = null;
        return;
      }
```

Replace with:

```js
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
        if (TIERS[state.tier].wrap) {
          if (nr < 0) nr = ROWS - 1;
          else if (nr >= ROWS) nr = 0;
          if (nc < 0) nc = COLS - 1;
          else if (nc >= COLS) nc = 0;
        } else {
          endRound('wall');
          return;
        }
      }
```

- [ ] **Step 3: Verify in browser**

Reload.

- **Easy:** Run the snake into the right wall — it appears on the left edge. All four walls should wrap.
- **Medium:** Run the snake into a wall — console logs `endRound wall ...`, screen jumps back to Start.
- **Hard:** Same as Medium.

- [ ] **Step 4: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add tier-driven wall behaviour for number-quest"
```

---

## Task 15: Self-collision (Hard tier only)

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add the self-collision check in `tick`**

In `tick`, after the wall-handling block and before the line `state.snake.unshift({ row: nr, col: nc });`, add:

```js
      if (TIERS[state.tier].selfKills) {
        // Self-collision: check head's next cell against any body segment except
        // the current tail (which is about to vacate). This avoids a false
        // positive when the snake's head moves into the cell its tail leaves.
        const willMoveOntoTail =
          state.pellets.every(p => !(p.row === nr && p.col === nc)) &&
          state.snake[state.snake.length - 1].row === nr &&
          state.snake[state.snake.length - 1].col === nc;
        const hitsSelf = state.snake.some((seg, i) =>
          i < state.snake.length - 1 && seg.row === nr && seg.col === nc
        );
        if (hitsSelf && !willMoveOntoTail) {
          endRound('self');
          return;
        }
      }
```

Note: when eating a pellet the tail does not vacate, so the "move-onto-tail" exemption only applies in the no-pellet branch. The condition above guards against that explicitly.

- [ ] **Step 2: Verify in browser**

- **Hard:** Steer the snake to bite its own body — `endRound self` logs, jumps to Start.
- **Easy / Medium:** Steer through your own body — passes through, no death.

To make this easier to test by hand: the snake is length 3 at start, so you'll need to grow it (by eating a correct pellet) before the body is long enough to bite. Since eating isn't wired yet, alternatively temporarily lengthen the initial snake in `startRound` for this test, then revert. Or, easier: skip the Hard self-test until Task 17 lands, and just confirm Easy/Medium don't blow up here.

- [ ] **Step 3: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add tier-driven self-collision for number-quest"
```

---

## Task 16: Eat a correct pellet (grow, advance question)

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add pellet handling in `tick`**

In `tick`, between the self-collision check and `state.snake.unshift(...)`, add:

```js
      const pelletIdx = state.pellets.findIndex(p => p.row === nr && p.col === nc);
      if (pelletIdx >= 0) {
        const pellet = state.pellets[pelletIdx];
        state.pellets.splice(pelletIdx, 1);
        state.snake.unshift({ row: nr, col: nc });
        if (pellet.correct) {
          state.qCorrect++;
          if (state.qCorrect >= 10) {
            renderBoard();
            renderHud();
            endRound('done');
            return;
          }
          nextQuestion();
        } else {
          // Wrong eat handled in Task 17.
        }
        renderBoard();
        renderHud();
        return;
      }
```

This task only fully implements the **correct** branch; the wrong branch is a stub that arrives in Task 17.

- [ ] **Step 2: Verify in browser**

Reload, click **Easy**, eat the correct pellet (the answer to the displayed question).

Expected:
- Snake grows by 1 segment.
- HUD `Q` advances `0/10 → 1/10`.
- A new question appears.
- New pellets appear (1 correct + 2 distractors), none overlapping the snake.

- [ ] **Step 3: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Eat correct pellet: grow snake and advance question"
```

---

## Task 17: Eat a wrong pellet (shrink, question stays)

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Implement the wrong-eat branch**

In `tick`, find the `// Wrong eat handled in Task 17.` placeholder. Replace it with:

```js
          // Wrong eat: shrink the snake (floor 1), question stays.
          // We already unshifted the new head; pop the tail twice to net -1,
          // but skip the second pop if doing so would drop below length 1.
          state.snake.pop();
          if (state.snake.length > 1) state.snake.pop();
```

For clarity, the full pellet-handling block now reads:

```js
      const pelletIdx = state.pellets.findIndex(p => p.row === nr && p.col === nc);
      if (pelletIdx >= 0) {
        const pellet = state.pellets[pelletIdx];
        state.pellets.splice(pelletIdx, 1);
        state.snake.unshift({ row: nr, col: nc });
        if (pellet.correct) {
          state.qCorrect++;
          if (state.qCorrect >= 10) {
            renderBoard();
            renderHud();
            endRound('done');
            return;
          }
          nextQuestion();
        } else {
          state.snake.pop();
          if (state.snake.length > 1) state.snake.pop();
        }
        renderBoard();
        renderHud();
        return;
      }
```

- [ ] **Step 2: Verify in browser**

Reload, click **Easy**, eat a wrong pellet.

Expected:
- Snake shrinks by 1 segment.
- HUD `Q` does **not** advance.
- That pellet is gone; the question and other pellets remain.
- Keep eating wrongs: snake floors at length 1 — never disappears.
- Eating all wrong pellets leaves only the correct one; eating it advances normally.

- [ ] **Step 3: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Eat wrong pellet: shrink snake, keep same question"
```

---

## Task 18: Render the Results screen

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add Results CSS**

In the `<style>` block, add:

```css
    .nq-results-wrap { text-align: center; padding: 2rem 0; }
    .nq-results-headline { font-size: 1rem; color: var(--nq-text-soft); text-transform: uppercase; letter-spacing: 0.08em; }
    .nq-results-length { font-size: 4.5rem; font-weight: 700; line-height: 1; margin: 0.5rem 0; color: var(--nq-accent); }
    .nq-results-substats { color: var(--nq-text-soft); margin-bottom: 0.5rem; }
    .nq-results-new-best {
      display: inline-block;
      background: var(--nq-accent);
      color: var(--nq-bg);
      padding: 4px 12px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 0.9rem;
      margin: 0.5rem 0 1.5rem;
    }
    .nq-results-buttons { display: flex; gap: 12px; justify-content: center; margin-top: 1.5rem; }
    .nq-button {
      background: var(--nq-bg-soft);
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--nq-text);
      font: inherit;
      padding: 0.6rem 1.25rem;
      border-radius: 8px;
      cursor: pointer;
    }
    .nq-button:hover { border-color: var(--nq-accent); }
    .nq-button.primary { background: var(--nq-accent); color: var(--nq-bg); border-color: var(--nq-accent); font-weight: 700; }
```

- [ ] **Step 2: Add `renderResults` and wire `endRound`**

Replace the placeholder `endRound` with:

```js
    function endRound(reason) {
      if (state.tickId) { clearInterval(state.tickId); state.tickId = null; }
      const finalLength = state.snake.length;
      const tier = state.tier;
      const prevBest = state.bestByTier[tier] || 0;
      const newBest = finalLength > prevBest;
      if (newBest) {
        state.bestByTier[tier] = finalLength;
      }
      renderResults({ finalLength, qCorrect: state.qCorrect, tier, newBest, reason });
      showScreen('results');
    }

    function renderResults({ finalLength, qCorrect, tier, newBest, reason }) {
      const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
      const root = document.getElementById('nq-results');
      root.innerHTML = `
        <div class="nq-results-wrap">
          <div class="nq-results-headline">Final length</div>
          <div class="nq-results-length">${finalLength}</div>
          <div class="nq-results-substats">
            ${qCorrect} / 10 correct &middot; Tier: ${tierLabel}
          </div>
          ${newBest ? '<div class="nq-results-new-best">New best!</div>' : ''}
          <div class="nq-results-buttons">
            <button class="nq-button primary" id="nq-play-again">Play again</button>
            <button class="nq-button" id="nq-back">Back</button>
          </div>
        </div>
      `;
      document.getElementById('nq-play-again').addEventListener('click', () => startRound(tier));
      document.getElementById('nq-back').addEventListener('click', () => {
        renderStart();
        showScreen('start');
      });
    }
```

- [ ] **Step 3: Verify in browser**

Reload. Play one Easy round to completion (eat 10 correct pellets — the only way to finish Easy since walls wrap).

Expected:
- Results screen shows: "Final length", a big number, "10 / 10 correct · Tier: Easy".
- If this was your first round, "New best!" badge appears.
- "Play again" starts a fresh Easy round.
- "Back" returns to Start screen.
- On Medium / Hard, dying against a wall (or self on Hard) also takes you to Results, with partial `X / 10 correct`.

- [ ] **Step 4: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add results screen for number-quest"
```

---

## Task 19: Persist best length per tier

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add `saveStats` and call it on round end**

In the `<script>` block, after `loadStats`, add:

```js
    async function saveStats() {
      await window.storage.set('nq-stats', JSON.stringify({
        version: 1,
        bestByTier: state.bestByTier,
      }));
    }
```

In `endRound`, after `state.bestByTier[tier] = finalLength;`, add:

```js
        saveStats();
```

So the full `if (newBest)` block reads:

```js
      if (newBest) {
        state.bestByTier[tier] = finalLength;
        saveStats();
      }
```

Then, in `renderResults`, after the existing event listeners, refresh the Start-screen render so the tier button shows the new best next time:

```js
      renderStart();
```

(Place this line at the end of `renderResults`, after both `addEventListener` calls.)

- [ ] **Step 2: Verify in browser**

1. Reload, click **Easy**, play a round, finish.
2. Click **Back** → tier button now shows `Best: <n>` instead of `Best: —`.
3. Reload the page entirely → `Best: <n>` still shows.
4. Play another Easy round; if you beat the previous best, "New best!" appears. If not, no badge, and the Start-screen best is unchanged.
5. Open DevTools → Application → Local Storage → confirm `nq-stats` contains JSON like `{"version":1,"bestByTier":{"easy":N,"medium":0,"hard":0}}`.

- [ ] **Step 3: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Persist best length per tier in number-quest"
```

---

## Task 20: End-round affordance (button + Esc)

**Files:**
- Modify: `games/number-quest/index.html`

- [ ] **Step 1: Add the End-round button to the Play screen**

In `renderPlay`, change the inner HTML to include a footer with the End-round button. Replace:

```js
      root.innerHTML = `
        <div class="nq-hud">
          <div class="nq-question" id="nq-question">&nbsp;</div>
          <div class="nq-stats">
            <span>Length <b id="nq-stat-length">3</b></span>
            &middot;
            <span>Q <b id="nq-stat-q">0</b>/10</span>
            &middot;
            <span>Best <b id="nq-stat-best">0</b></span>
          </div>
        </div>
        <div class="nq-board" id="nq-board"></div>
      `;
```

with:

```js
      root.innerHTML = `
        <div class="nq-hud">
          <div class="nq-question" id="nq-question">&nbsp;</div>
          <div class="nq-stats">
            <span>Length <b id="nq-stat-length">3</b></span>
            &middot;
            <span>Q <b id="nq-stat-q">0</b>/10</span>
            &middot;
            <span>Best <b id="nq-stat-best">0</b></span>
          </div>
        </div>
        <div class="nq-board" id="nq-board"></div>
        <div class="nq-play-footer">
          <button class="nq-button" id="nq-end-round">End round</button>
        </div>
      `;
      document.getElementById('nq-end-round').addEventListener('click', () => endRound('user'));
```

Add the footer CSS:

```css
    .nq-play-footer { display: flex; justify-content: flex-end; margin-top: 12px; }
```

- [ ] **Step 2: Add Esc handler**

In `handleKey`, before the `KEY_DIRS` lookup, add:

```js
      if (e.key === 'Escape') {
        e.preventDefault();
        endRound('user');
        return;
      }
```

- [ ] **Step 3: Verify in browser**

- Reload, click **Easy**, start playing.
- Press **Esc** → Results screen.
- Click **Play again** → start a new round.
- Click the **End round** button → Results screen.
- Best persistence still works.

- [ ] **Step 4: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add End-round button and Esc handler for number-quest"
```

---

## Task 21: Eat feedback animations

**Files:**
- Modify: `games/number-quest/index.html`

The animations are visual polish, but the spec calls them out so they're worth making explicit.

- [ ] **Step 1: Add keyframes and animation classes**

In the `<style>` block, add:

```css
    @keyframes nq-pop {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.3); }
      100% { transform: scale(0); opacity: 0; }
    }
    @keyframes nq-shake {
      0%, 100% { transform: translateX(0); }
      25%      { transform: translateX(-4px); }
      75%      { transform: translateX(4px); }
    }
    .nq-board.shake { animation: nq-shake 0.25s ease; }
    .nq-flash {
      position: absolute;
      grid-column: var(--col);
      grid-row: var(--row);
      border-radius: 5px;
      pointer-events: none;
      animation: nq-pop 0.35s ease-out forwards;
      z-index: 2;
    }
    .nq-flash.correct { background: rgba(125, 240, 169, 0.7); }
    .nq-flash.wrong   { background: rgba(255, 99, 99, 0.7); }
```

- [ ] **Step 2: Add a `spawnFlash` helper**

In the `<script>` block, after `renderBoard`, add:

```js
    function spawnFlash(row, col, kind) {
      const board = document.getElementById('nq-board');
      if (!board) return;
      const el = document.createElement('div');
      el.className = `nq-flash ${kind}`;
      el.style.setProperty('--col', col + 1);
      el.style.setProperty('--row', row + 1);
      board.appendChild(el);
      setTimeout(() => el.remove(), 400);
    }
```

- [ ] **Step 3: Trigger feedback on eat**

In the pellet-handling block in `tick`, right after `const pellet = state.pellets[pelletIdx];`, add:

```js
        spawnFlash(pellet.row, pellet.col, pellet.correct ? 'correct' : 'wrong');
        if (!pellet.correct) {
          const board = document.getElementById('nq-board');
          if (board) {
            board.classList.remove('shake');
            // Force reflow so the animation can restart on consecutive wrongs.
            void board.offsetWidth;
            board.classList.add('shake');
          }
        }
```

- [ ] **Step 4: Verify in browser**

Reload, click any tier, play.

Expected:
- Eating a correct pellet flashes green where the pellet was.
- Eating a wrong pellet flashes red and the whole board shakes briefly.
- Consecutive wrong eats each produce their own shake.

- [ ] **Step 5: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add eat feedback animations for number-quest"
```

---

## Task 22: Space-theme decorations

**Files:**
- Modify: `games/number-quest/index.html`

Mirrors the multiplication game's decoration pattern (commits `d86a9ee`, `2257fa5`, `2fa01ea`): a fixed full-viewport layer behind the game with Tabler icons scattered across it at low opacity.

- [ ] **Step 1: Add the decoration CSS**

In the `<style>` block, add:

```css
    .nq-decor { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
    .nq-decor i {
      position: absolute;
      color: var(--nq-accent);
      opacity: 0.12;
      animation: nq-float 6s ease-in-out infinite;
    }
    @keyframes nq-float {
      0%, 100% { transform: translateY(0) rotate(var(--rot, 0deg)); }
      50%      { transform: translateY(-10px) rotate(var(--rot, 0deg)); }
    }
```

- [ ] **Step 2: Add a `renderDecor` function and call it once on init**

In the `<script>` block, after `loadStats`, add:

```js
    function renderDecor() {
      const icons = ['ti-planet', 'ti-star', 'ti-sparkles', 'ti-moon-stars', 'ti-comet', 'ti-rocket'];
      const root = document.createElement('div');
      root.className = 'nq-decor';
      const count = 24;
      let html = '';
      for (let i = 0; i < count; i++) {
        const top = Math.random() * 100;
        const left = Math.random() * 100;
        const size = 24 + Math.random() * 36;
        const delay = (Math.random() * 6).toFixed(2);
        const rot = (Math.random() * 60 - 30).toFixed(1);
        const icon = icons[Math.floor(Math.random() * icons.length)];
        html += `<i class="ti ${icon}" style="top:${top}vh;left:${left}vw;font-size:${size}px;--rot:${rot}deg;animation-delay:${delay}s"></i>`;
      }
      root.innerHTML = html;
      document.body.prepend(root);
    }
```

Then update `init`:

```js
    async function init() {
      await loadStats();
      renderDecor();
      renderStart();
      showScreen('start');
    }
```

- [ ] **Step 3: Verify in browser**

Reload. Decorations should appear behind the game container — purple icons (planets, stars, sparkles, moons, comets, rockets) at low opacity, gently floating. Game UI is unobstructed; clicks on tier buttons still work; snake and pellets render in front.

- [ ] **Step 4: Commit**

```bash
git add games/number-quest/index.html
git commit -m "Add space-theme decorations to number-quest"
```

---

## Task 23: Flip the manifest entry to playable

**Files:**
- Modify: `games.json`

- [ ] **Step 1: Update the entry**

Open `games.json`. Find:

```json
    {
      "slug": "number-quest",
      "title": "Number Quest",
      "blurb": "Number adventures coming soon.",
      "subject": "Math",
      "icon": "ti-planet",
      "accent": "space",
      "status": "coming-soon"
    }
```

Replace it with:

```json
    {
      "slug": "number-quest",
      "title": "Number Quest",
      "blurb": "Steer the snake. Eat the right answer. Grow.",
      "subject": "Math",
      "icon": "ti-planet",
      "accent": "space",
      "status": "playable"
    }
```

- [ ] **Step 2: Verify on the landing page**

Open `http://localhost:8000/`.

Expected:
- The Number Quest card no longer renders dimmed.
- Clicking it navigates to `games/number-quest/` and the game loads.
- The "Word Wild" card is still dimmed (untouched).

- [ ] **Step 3: Commit**

```bash
git add games.json
git commit -m "Promote number-quest to playable on landing page"
```

---

## Task 24: Walk the spec's verification checklist

**Files:**
- (No code changes — purely manual verification.)

Open `http://localhost:8000/` in a fresh browser tab. Walk through every checklist item from the spec's "Verification" section. For each, tick the box only after observing the behaviour live. If anything fails, file a fix as a follow-up task (or a quick patch commit) before moving on.

- [ ] **Step 1: Start screen sanity**

  - [ ] Opening `/games/number-quest/` shows the Start screen with three tier buttons and the "← Games" link.
  - [ ] Each tier button shows "—" before any round has been played, then a number after.

- [ ] **Step 2: Easy mode**

  - [ ] Click **Easy**: snake length 3, question visible in HUD, 3 pellets on board (1 correct + 2 wrong).
  - [ ] Tick loop does not start until the first arrow/WASD key press.
  - [ ] Correct pellet: grows snake by 1, advances `Q n/10`, refreshes pellets + question.
  - [ ] Wrong pellet: shrinks snake by 1, removes that pellet, keeps question + remaining pellets.
  - [ ] Snake length floors at 1; further wrongs at length 1 don't shrink.
  - [ ] Walls wrap; passing through self never kills.

- [ ] **Step 3: Medium mode**

  - [ ] Wall hit ends the round; passing through self does not.
  - [ ] Math is × tables 1–10.

- [ ] **Step 4: Hard mode**

  - [ ] Wall or self hit ends the round.
  - [ ] Math is mixed × and ÷, both with answers 1–100 (× ) and 1–10 (÷).

- [ ] **Step 5: End-of-round + persistence**

  - [ ] After 10 correct, Results shows final length, `10/10 correct`, "New best!" the first time.
  - [ ] Dying before 10 correct (Medium/Hard) still shows Results with partial `X/10`.
  - [ ] Reloading the page preserves best length per tier.
  - [ ] **End round** button and **Esc** both jump straight to Results with the current state.

- [ ] **Step 6: Generator integrity**

  - [ ] `?test=1` URL shows `8/8 passed` in the test panel.
  - [ ] Distractors never duplicate and never equal the correct answer (covered by the harness, but worth eyeballing during play too).

- [ ] **Step 7: Site integration**

  - [ ] Landing page (`/`) shows Number Quest as playable; click navigates correctly.
  - [ ] Theme decorations (stars/planets) appear behind the game container and don't interfere with input.

- [ ] **Step 8: (Optional) cleanup**

Once everything passes, remove the temporary console.logs that may have crept in during development (search for `console.log` in `games/number-quest/index.html` — any leftovers from earlier tasks should go). Then:

```bash
git add games/number-quest/index.html
git commit -m "Clean up debug logs in number-quest"
```

Skip this step if there are no logs left to clean.

---

## Done

When every checkbox in Task 24 is ticked, the feature is shippable. Push to `main` with a normal `git push` — GitHub Pages will publish it automatically.

If you want to add a follow-up entry for future polish (sound effects, mobile controls, second-pass distractor tuning), drop it into the spec's "Risks and Notes" section so future-you sees it before the next round of work.
