# Simplify Multiplication Game Start UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multiplication-tables game's configuration-heavy start screen with three one-click mode buttons (Practice / Play 10 / Play 20), drop survival mode, hardcode time-per-question and all-tables-active.

**Architecture:** Edits only `games/multiplication-tables/index.html`. The change spans three logical layers in the file's inline `<script>`: (1) data model and persistence (constants, state shape, load/save migration), (2) game logic (submit/timer behavior, mode-aware end conditions, achievement triggers), (3) UI rendering (settings/playing/results screens). Intermediate states between tasks will not be fully functional; the game is verified in the browser after Task 3.

**Tech Stack:** Vanilla JS, inline HTML/CSS, `localStorage`, Tabler Icons (already loaded).

**Reference spec:** `docs/superpowers/specs/2026-05-19-simplify-multiplication-start-ui-design.md`

---

## File Structure

Only one file is modified:

| Path | Responsibility | Change |
|------|----------------|--------|
| `games/multiplication-tables/index.html` | The multiplication-tables game (HTML wrapper around a self-contained game with inline CSS + JS). | Edits to inline `<script>` and inline `<style>` only. No changes to the page-level `<head>` (Tabler/tokens/storage links remain). |

No new files. No file deletions.

---

## Testing Approach

Same as the broader site: no automated test framework. **Verification is manual in a browser** using the local dev server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/games/multiplication-tables/`.

Intermediate tasks (Task 1, Task 2) will leave the game in a non-runnable state because their changes assume the others land. Full verification happens at the end of Task 3.

**To exercise the migration path:** before running, seed an old-shape `mt-stats` entry via the browser DevTools console:

```js
localStorage.setItem('mt-stats', JSON.stringify({
  achievements: ['survival-10','survival-20','streak-3'],
  totalAnswered: 42,
  bestClassic: { '10': 150, '20': 320, '50': 999 },
  bestSurvival: 18,
}));
location.reload();
```

After Task 3 lands, on reload the stored object should be rewritten to the new shape (see Task 3 Step 7).

---

## Task 1: Data model and persistence

**File:** `games/multiplication-tables/index.html` (inline `<script>` block)

This task changes constants, state shape, and load/save functions. The game's runtime is broken at the end of this task; Tasks 2 and 3 restore it.

- [ ] **Step 1: Update the achievements map (`ACH`)**

Locate the `const ACH = { ... };` block in the script. Replace it entirely:

```js
const ACH = {
    'streak-3':      { name: 'Three in a row',   icon: 'ti-flame' },
    'streak-5':      { name: 'Five in a row',    icon: 'ti-flame' },
    'streak-10':     { name: 'On fire!',         icon: 'ti-rocket' },
    'streak-15':     { name: 'Unstoppable',      icon: 'ti-bolt' },
    'perfect':       { name: 'Perfect round',    icon: 'ti-medal' },
    'boss-defeated': { name: 'Boss defeated',    icon: 'ti-target-arrow' },
    'marathon':      { name: 'Marathon',         icon: 'ti-infinity' },
    'century':       { name: '100 answered',     icon: 'ti-trophy' },
    'speedy':        { name: 'Lightning fast',   icon: 'ti-bolt' },
};
```

Changes vs the previous map:
- Removed: `survival-10`, `survival-20`.
- Added: `streak-15` ("Unstoppable", `ti-bolt`), `marathon` ("Marathon", `ti-infinity`).
- `speedy` retains the `ti-bolt` icon (intentional sharing with `streak-15` — both are "fast" symbols; visually distinguished by name).

- [ ] **Step 2: Update the initial state**

Locate the `const state = { ... };` block. Replace the property lines for `mode`, `tables`, `totalQuestions`, `bestClassic`, and `bestSurvival`. Keep every other property as-is.

The relevant lines currently read:

```js
mode: 'classic',
...
tables: new Set([2,3,4,5,6,7,8,9,10,11,12]),
totalQuestions: 10,
...
bestClassic: {},
bestSurvival: 0,
```

Change them to:

```js
mode: 'play10',
...
tables: new Set([2,3,4,5,6,7,8,9,10,11,12]),
totalQuestions: 10,
...
bestByMode: { play10: 0, play20: 0 },
```

(`tables` stays a full set — the UI to toggle it is removed in Task 3 but the field stays so `pickQuestion()` keeps working. `totalQuestions` stays at 10 as a default; `startMode()` in Task 3 overrides it when launching each mode.)

Also add a new field `questionStartedAt: 0` adjacent to `lastAnswerTime: 0` in the state object. This timestamp is set in `beginQuestion()` (Task 2) and read in `submitAnswer()` (Task 2) so that the `speedy` achievement works regardless of mode.

The resulting state init for these specific fields, in order:

```js
mode: 'play10',
theme: 'classic',
timePerQuestion: 10,                                    // unchanged; hardcoded
tables: new Set([2,3,4,5,6,7,8,9,10,11,12]),            // unchanged
totalQuestions: 10,                                     // default; overridden per mode
currentQuestion: 0,
score: 0,
points: 0,
wrong: [],
streak: 0,
bestStreak: 0,
soundOn: true,
achievements: new Set(),
totalAnswered: 0,
bestByMode: { play10: 0, play20: 0 },                   // replaces bestClassic + bestSurvival
a: 0, b: 0, correctAnswer: 0,
isBoss: false, isInverted: false, inversionTarget: null,
answer: '',
timeLeft: 10, baseTime: 10,
timerId: null, advanceId: null,
tickPlayed: false,
lastAnswerTime: 0,
questionStartedAt: 0,                                   // NEW: high-res timestamp set in beginQuestion()
lastBossWin: false,
lastEncourage: '',
```

- [ ] **Step 3: Rewrite `loadAll()` with migration**

Replace the existing `async function loadAll() { ... }` with this version:

```js
async function loadAll() {
    let migratedShape = false;
    try {
      const r = await window.storage.get('mt-stats', false);
      if (r && r.value) {
        const d = JSON.parse(r.value);
        // achievements: drop now-unreachable survival IDs
        const acc = Array.isArray(d.achievements) ? d.achievements : [];
        const cleanedAcc = acc.filter(id => id !== 'survival-10' && id !== 'survival-20');
        if (cleanedAcc.length !== acc.length) migratedShape = true;
        state.achievements = new Set(cleanedAcc);

        state.totalAnswered = d.totalAnswered || 0;

        // best scores: migrate bestClassic + drop bestSurvival
        const byMode = (d.bestByMode && typeof d.bestByMode === 'object') ? { ...d.bestByMode } : { play10: 0, play20: 0 };
        if (d.bestClassic && typeof d.bestClassic === 'object') {
          if (d.bestClassic['10']) byMode.play10 = Math.max(byMode.play10 || 0, d.bestClassic['10']);
          if (d.bestClassic['20']) byMode.play20 = Math.max(byMode.play20 || 0, d.bestClassic['20']);
          migratedShape = true;
        }
        if (typeof d.bestSurvival === 'number') {
          migratedShape = true;  // we keep it out of the new shape entirely
        }
        state.bestByMode = byMode;
      }
    } catch (e) {}
    try {
      const r = await window.storage.get('mt-prefs', false);
      if (r && r.value) {
        const d = JSON.parse(r.value);
        if (typeof d.soundOn === 'boolean') state.soundOn = d.soundOn;
        if (d.theme && THEMES[d.theme]) state.theme = d.theme;
      }
    } catch (e) {}

    // Write back once if we found old shape, so the file is now in the new shape.
    if (migratedShape) {
      await saveStats();
    }
}
```

Behavioural notes:
- The migration is one-way and idempotent: subsequent loads after the first save just see the new shape and don't trigger another write.
- Unknown keys in `bestClassic` (e.g. `bestClassic['50']`) are silently dropped — those modes no longer exist.

- [ ] **Step 4: Rewrite `saveStats()` to write the new shape**

Replace the existing `async function saveStats() { ... }`:

```js
async function saveStats() {
    try {
      await window.storage.set('mt-stats', JSON.stringify({
        achievements: Array.from(state.achievements),
        totalAnswered: state.totalAnswered,
        bestByMode: state.bestByMode,
      }), false);
    } catch (e) {}
}
```

(`savePrefs()` is unchanged — it only persists sound + theme and those didn't change.)

- [ ] **Step 5: Remove the `getQuestionTime()` helper**

Locate and delete the function `function getQuestionTime() { ... }` entirely. The new mode-aware timing happens directly in `beginQuestion()` (Task 2). No callers remain after Task 2 lands.

The deletion target — these lines, removed:

```js
function getQuestionTime() {
    if (state.mode === 'survival') {
      const start = state.timePerQuestion;
      const min = Math.max(2.5, start * 0.3);
      return Math.max(min, start - state.currentQuestion * 0.4);
    }
    return state.timePerQuestion;
}
```

- [ ] **Step 6: Sanity-check the file still parses**

Run:

```bash
python3 -c "import re,sys; html=open('games/multiplication-tables/index.html').read(); print('OK,', len(html), 'bytes')"
```

Expected: prints `OK, <byte count>`.

Open `http://localhost:8000/games/multiplication-tables/` in a browser. The page may not work as a game yet (settings screen renders but mode tabs reference 'classic'/'survival', mode buttons not yet present) — that's expected. **Confirm only that the page loads and there are no `SyntaxError` entries in the console.**

- [ ] **Step 7: Commit**

```bash
git add games/multiplication-tables/index.html
git commit -m "Replace mode/persistence/achievements schema for simplified UI

Updates the achievements map (drops survival-10/-20, adds streak-15
and marathon), the initial state shape (bestByMode replaces
bestClassic/bestSurvival, default mode becomes play10), and the
load/save functions (migrates old shapes once on load). Removes the
survival-only getQuestionTime helper. Game is intentionally not
runnable end-to-end until Tasks 2-3 land."
```

---

## Task 2: Game logic — mode-aware behavior

**File:** `games/multiplication-tables/index.html` (inline `<script>` block)

Adapts the gameplay logic to the new mode set. The settings UI is still old-shape until Task 3, but everything downstream from "user clicks start" works correctly after this task.

- [ ] **Step 1: Rewrite `beginQuestion()` for practice mode (no timer)**

Locate `function beginQuestion()`. Replace its body so it skips the timer entirely in practice mode but still records a high-res start time for the `speedy` achievement:

```js
function beginQuestion() {
    state.questionStartedAt = performance.now();
    if (state.mode === 'practice') {
      state.baseTime = 0;
      state.timeLeft = 0;
      renderPlaying();
    } else {
      state.baseTime = 10;
      state.timeLeft = 10;
      renderPlaying();
      startTimer();
    }
    setTimeout(() => { const i = root.querySelector('#mt-answer'); if (i) i.focus(); }, 30);
}
```

- [ ] **Step 2: Rewrite `submitAnswer()` for new mode semantics**

Locate `function submitAnswer(timeout) { ... }`. Replace the **entire function body** with this version:

```js
function submitAnswer(timeout) {
    clearTimers();
    const answerTime = (performance.now() - state.questionStartedAt) / 1000;
    const userAns = parseInt(state.answer, 10);
    let expected;
    if (state.isInverted) expected = state.inversionTarget === 'a' ? state.a : state.b;
    else expected = state.correctAnswer;
    const isCorrect = !timeout && Number.isFinite(userAns) && userAns === expected;

    state.totalAnswered++;
    state.lastAnswerTime = answerTime;
    state.lastBossWin = isCorrect && state.isBoss;

    if (isCorrect) {
      const mult = getMult();
      const pts = getBase() * mult;
      state.score++;
      state.points += pts;
      state.streak++;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      if (state.soundOn) sfx.correct();
      setTimeout(() => popupScore(pts, mult), 80);
      confetti(Math.min(60, 20 + state.streak * 3));
    } else {
      state.streak = 0;
      state.wrong.push({
        a: state.a, b: state.b, answer: state.correctAnswer,
        given: timeout ? '—' : (state.answer || '—'),
        isInverted: state.isInverted, inversionTarget: state.inversionTarget,
        expected: expected, timeout,
      });
      if (state.soundOn) sfx.wrong();
    }

    state.currentQuestion++;
    renderFeedback(isCorrect, timeout);

    const newlyUnlocked = [];
    const tests = {
      'streak-3':      () => state.streak >= 3,
      'streak-5':      () => state.streak >= 5,
      'streak-10':     () => state.streak >= 10,
      'streak-15':     () => state.streak >= 15,
      'boss-defeated': () => state.lastBossWin,
      'marathon':      () => state.mode === 'practice' && state.currentQuestion >= 50,
      'century':       () => state.totalAnswered >= 100,
      'speedy':        () => isCorrect && answerTime < 2,
    };
    for (const id of Object.keys(tests)) {
      if (!state.achievements.has(id) && tests[id]()) {
        state.achievements.add(id);
        newlyUnlocked.push(id);
      }
    }

    let endGame = false;
    if ((state.mode === 'play10' || state.mode === 'play20') && state.currentQuestion >= state.totalQuestions) {
      endGame = true;
    }

    if (endGame && state.wrong.length === 0 && !state.achievements.has('perfect')) {
      state.achievements.add('perfect');
      newlyUnlocked.push('perfect');
    }
    saveStats();

    const feedbackDelay = isCorrect ? 1300 : (endGame ? 1900 : 1800);
    state.advanceId = setTimeout(() => {
      const finish = () => {
        if (endGame) {
          const key = state.mode; // 'play10' or 'play20'
          if (state.points > (state.bestByMode[key] || 0)) state.bestByMode[key] = state.points;
          saveStats();
          state.screen = 'results';
          renderResults();
        } else {
          newQuestion();
        }
      };
      playAchievementChain(newlyUnlocked, finish);
    }, feedbackDelay);
}
```

Differences vs old:
- `answerTime` is now computed from `performance.now()` instead of `state.baseTime - state.timeLeft`, so it's meaningful in practice mode too.
- Achievement tests drop `survival-10` / `survival-20`, add `streak-15` and `marathon`.
- `endGame` only fires for play10/play20 at the question-count threshold. Practice never auto-ends here.
- The `perfect` achievement no longer checks `state.mode === 'classic'` — it gates on `endGame` (which is only true for play10/play20).
- Best-score record uses `bestByMode[state.mode]` (a single source of truth) instead of two separate fields.
- The survival-only `sfx.gameover()` call is gone.

- [ ] **Step 3: Add an `endPractice()` helper**

Locate the line just above `function submitAnswer(timeout) {` and add this new function (still inside the same IIFE):

```js
function endPractice() {
    clearTimers();
    state.screen = 'results';
    renderResults();
}
```

This function is wired to the new "End practice" button in Task 3. It does no best-score update (practice is not ranked) and no achievement chain (those triggered during play).

- [ ] **Step 4: Sanity-check parsing**

```bash
python3 -c "html=open('games/multiplication-tables/index.html').read(); print('OK,', len(html), 'bytes')"
```

The game is still not runnable as a whole — Task 3 fixes the UI. Just confirm no syntax error.

- [ ] **Step 5: Commit**

```bash
git add games/multiplication-tables/index.html
git commit -m "Update game logic for practice/play10/play20 modes

submitAnswer end-game conditions now only fire for the timed play
modes; practice ends only via endPractice() (used by the End practice
button added in the next task). Question elapsed time is measured
with performance.now() so the speedy achievement works in practice
too. Adds marathon and streak-15 achievement triggers, drops the
survival-only sfx.gameover call. Game still not runnable until the
settings UI is replaced in Task 3."
```

---

## Task 3: Settings UI rewrite + End practice button + results variant

**File:** `games/multiplication-tables/index.html` (inline `<style>` and `<script>`)

Replaces the configuration-chip settings screen with three mode buttons, adds the End practice button on the playing screen, and adjusts the status bar and results screen for practice mode.

- [ ] **Step 1: Add CSS for the new mode cards**

Locate the inline `<style>` block (the one near the top of `<div class="game-container">` that defines `.mt-wrap`, `.mt-decor`, etc.). Find the rule for `.mt-mode-tab`. Replace it and the adjacent rule with these new mode-card rules:

The current rules:

```css
.mt-mode-tab { padding: 10px 16px; cursor: pointer; font-size: 14px; font-weight: 500; border-bottom: 2px solid transparent; color: var(--color-text-secondary); user-select: none; }
.mt-mode-tab.on { color: var(--mt-accent, var(--color-text-info)); border-bottom-color: var(--mt-accent, var(--color-text-info)); }
```

Replace with:

```css
.mt-mode-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 540px) { .mt-mode-cards { grid-template-columns: 1fr; } }
.mt-mode-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 12px; border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); background: var(--color-background-primary); cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; user-select: none; }
.mt-mode-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-color: var(--mt-accent-border, var(--color-border-info)); }
.mt-mode-card i { font-size: 32px; color: var(--mt-accent, var(--color-text-info)); }
.mt-mode-card .mt-mode-name { font-size: 16px; font-weight: 500; }
.mt-mode-card .mt-mode-desc { font-size: 12px; color: var(--color-text-secondary); text-align: center; }
.mt-end-practice { padding: 10px 20px; font-size: 14px; background: transparent; color: var(--color-text-secondary); border: 0.5px solid var(--color-border-secondary); border-radius: var(--border-radius-md); cursor: pointer; margin-left: 8px; }
.mt-end-practice:hover { color: var(--color-text-primary); border-color: var(--color-text-primary); }
```

- [ ] **Step 2: Add a `MODES` constant and a `startMode()` helper**

Locate the `const ACH = { ... };` block. Immediately after it, add:

```js
const MODES = {
    practice: { name: 'Practice', icon: 'ti-school',       desc: 'No timer · play as long as you like', totalQuestions: Infinity },
    play10:   { name: 'Play 10',  icon: 'ti-player-play',  desc: '10 questions · 10 s each',            totalQuestions: 10 },
    play20:   { name: 'Play 20',  icon: 'ti-player-play',  desc: '20 questions · 10 s each',            totalQuestions: 20 },
};

function startMode(modeKey) {
    if (!MODES[modeKey]) return;
    state.mode = modeKey;
    state.totalQuestions = MODES[modeKey].totalQuestions;
    state.currentQuestion = 0;
    state.score = 0;
    state.points = 0;
    state.wrong = [];
    state.streak = 0;
    state.bestStreak = 0;
    audio();              // unlock AudioContext on user gesture
    newQuestion();
}
```

The `MODES.practice.totalQuestions = Infinity` matters: the question-count comparison in `submitAnswer()` (`state.currentQuestion >= state.totalQuestions`) will never be true for practice, so practice never auto-ends.

- [ ] **Step 3: Rewrite `renderSettings()`**

Locate `function renderSettings() { ... }`. Replace its body with this version:

```js
function renderSettings() {
    state.screen = 'settings'; clearTimers();
    const achList = Object.keys(ACH);
    const themeList = Object.keys(THEMES);
    const modeList = Object.keys(MODES);

    const bestLines = [];
    if (state.bestByMode.play10) bestLines.push(`Play 10: <strong style="font-weight:500;">${state.bestByMode.play10} pts</strong>`);
    if (state.bestByMode.play20) bestLines.push(`Play 20: <strong style="font-weight:500;">${state.bestByMode.play20} pts</strong>`);
    const hasBests = bestLines.length > 0;

    root.innerHTML = `
      <div style="max-width: 520px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 500;"><i class="ti ${theme().icon}" aria-hidden="true" style="color: var(--mt-accent); vertical-align: -2px; margin-right: 6px;"></i>Times tables</h1>
          ${soundButton()}
        </div>
        <p style="color: var(--color-text-secondary); margin: 0 0 1.5rem; font-size: 14px;">Pick a mode below to start</p>

        <div class="mt-section">
          <div class="mt-mode-cards">${modeList.map(k => {
            const m = MODES[k];
            return `<div class="mt-mode-card" data-mode="${k}">
              <i class="ti ${m.icon}" aria-hidden="true"></i>
              <div class="mt-mode-name">${m.name}</div>
              <div class="mt-mode-desc">${m.desc}</div>
            </div>`;
          }).join('')}</div>
        </div>

        <div class="mt-section">
          <div class="mt-label">Theme</div>
          <div class="mt-chips">${themeList.map(k => {
            const t = THEMES[k];
            return `<div class="mt-chip mt-theme-chip ${state.theme === k ? 'on' : ''}" data-theme="${k}">
              <span class="mt-theme-swatch" style="background:${t.accent}"></span>
              <i class="ti ${t.icon}" aria-hidden="true"></i>
              ${t.name}
            </div>`;
          }).join('')}</div>
        </div>

        ${hasBests ? `
        <div style="background: var(--color-background-secondary); border-radius: var(--border-radius-md); padding: 10px 14px; margin-bottom: 1.5rem; font-size: 13px; color: var(--color-text-secondary);">
          <div style="font-weight: 500; color: var(--color-text-primary); margin-bottom: 4px;"><i class="ti ti-trophy" aria-hidden="true" style="vertical-align:-2px;margin-right:4px;"></i>Best scores</div>
          <div>${bestLines.join(' · ')}</div>
        </div>` : ''}

        <div class="mt-section">
          <div class="mt-label" style="display: flex; justify-content: space-between;">Achievements <span style="color: var(--color-text-tertiary); font-weight: 400; font-size: 13px;">${state.achievements.size} / ${achList.length}</span></div>
          <div class="mt-ach-grid">
            ${achList.map(id => {
              const has = state.achievements.has(id);
              const a = ACH[id];
              return `<div class="mt-ach-cell ${has ? 'unlocked' : ''}" title="${has ? a.name : 'Locked'}"><i class="ti ${has ? a.icon : 'ti-lock'}" aria-hidden="true"></i></div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    attachSoundBtn();
    root.querySelectorAll('[data-theme]').forEach(el => el.addEventListener('click', () => { applyTheme(el.dataset.theme); savePrefs(); renderSettings(); }));
    root.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => startMode(el.dataset.mode)));
}
```

What's gone vs the old version:
- Mode tabs (Classic / Survival)
- Time-per-question chips
- Tables-to-practice chips
- Questions-per-round chips
- The standalone `#mt-start` button + its click handler

What stayed:
- Title, sound button, subtitle (with new text)
- Theme picker
- Best scores summary (now driven by `bestByMode`)
- Achievements grid

What's new:
- Three mode cards in a 3-col grid (1-col on narrow screens)

- [ ] **Step 4: Rewrite `statusBar()` for practice mode**

Locate `function statusBar() { ... }`. Replace its body:

```js
function statusBar() {
    const mult = getMult();
    const streakHtml = state.streak > 1
      ? `<span style="color: var(--color-text-warning); margin-left: 8px;"><i class="ti ti-flame" aria-hidden="true" style="vertical-align: -2px;"></i> ${state.streak}${mult > 1 ? ` <span class="mt-mult-badge">×${mult}</span>` : ''}</span>`
      : '';
    let q;
    if (state.mode === 'practice') {
      q = `Practice <span style="color: var(--color-text-tertiary);">· Q${state.currentQuestion + 1}</span>`;
    } else {
      q = `Question ${Math.min(state.currentQuestion + 1, state.totalQuestions)} of ${state.totalQuestions}`;
    }
    return `<div class="mt-row">
      <span>${q}</span>
      <span style="display: inline-flex; align-items: center; gap: 4px;">${state.points} pts${streakHtml}</span>
    </div>`;
}
```

- [ ] **Step 5: Update `renderPlaying()` — hide timer bar + add End practice button in practice**

Locate `function renderPlaying() { ... }`. Replace its body:

```js
function renderPlaying() {
    state.screen = 'playing';
    const isPractice = state.mode === 'practice';
    const timerBar = isPractice ? '' : '<div class="mt-timer-bar"><div class="mt-timer-fill"></div></div>';
    const endBtn = isPractice ? '<button class="mt-end-practice" id="mt-endpractice">End practice</button>' : '';
    const hint = state.isInverted ? 'Find the missing factor' : 'Press Enter to submit';
    root.innerHTML = `
      <div class="mt-play">
        <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 4px;">
          ${soundButton()}
        </div>
        ${statusBar()}
        ${timerBar}
        <div style="text-align: center; padding: 0.5rem 0;">
          <div class="mt-problem mt-pop">${problemHtml()}</div>
          <input id="mt-answer" class="mt-input" type="number" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${state.answer}" />
          <div style="margin-top: 1.25rem;">
            <button class="mt-primary" id="mt-submit">Submit</button>
            ${endBtn}
          </div>
          <div style="margin-top: 0.75rem; font-size: 12px; color: var(--color-text-tertiary);">${hint}</div>
        </div>
      </div>
    `;
    attachSoundBtn();
    const input = root.querySelector('#mt-answer');
    input.addEventListener('input', e => { state.answer = e.target.value; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && state.answer.length > 0) submitAnswer(false); });
    root.querySelector('#mt-submit').addEventListener('click', () => { if (state.answer.length > 0) submitAnswer(false); });
    if (isPractice) {
      root.querySelector('#mt-endpractice').addEventListener('click', endPractice);
    }
}
```

Notes:
- The timer bar div is omitted in practice. `updateTimerUI()` is never called in practice because the timer never starts (Task 2 Step 1).
- The End practice button uses the new `.mt-end-practice` class from Step 1.

- [ ] **Step 6: Update `renderResults()` for practice variation**

Locate `function renderResults() { ... }`. Replace its body:

```js
function renderResults() {
    clearTimers();
    const isPractice = state.mode === 'practice';
    const isPlay = state.mode === 'play10' || state.mode === 'play20';
    const total = isPractice ? state.currentQuestion : state.totalQuestions;
    const pct = total > 0 ? Math.round((state.score / total) * 100) : 0;
    let message, icon;
    if (isPractice) {
      message = `Practice session · ${state.currentQuestion} ${state.currentQuestion === 1 ? 'question' : 'questions'}`;
      icon = 'ti-school';
    } else {
      if (pct === 100) { message = 'Perfect round!'; icon = 'ti-trophy'; }
      else if (pct >= 80) { message = 'Excellent work!'; icon = 'ti-medal'; }
      else if (pct >= 60) { message = 'Good job!'; icon = 'ti-star'; }
      else { message = 'Keep practicing!'; icon = 'ti-target-arrow'; }
    }
    const isNewBest = isPlay
      ? state.bestByMode[state.mode] === state.points && state.points > 0
      : false;

    root.innerHTML = `
      <div style="text-align: center; max-width: 520px; margin: 0 auto;">
        <i class="ti ${icon} mt-results-icon" aria-hidden="true" style="font-size: 72px;"></i>
        <h1 style="font-size: 22px; font-weight: 500; margin: 0.75rem 0 0.5rem;">${message}</h1>
        ${isNewBest ? `<div style="display: inline-flex; align-items: center; gap: 6px; background: var(--color-background-warning); color: var(--color-text-warning); padding: 4px 12px; border-radius: var(--border-radius-md); font-size: 13px; font-weight: 500; margin-bottom: 12px;"><i class="ti ti-star" aria-hidden="true"></i>New personal best!</div>` : ''}
        <div style="display: flex; justify-content: center; gap: 32px; margin: 1rem 0;">
          <div>
            <div style="font-size: 13px; color: var(--color-text-secondary);">Points</div>
            <div style="font-size: 36px; font-weight: 500;">${state.points}</div>
          </div>
          <div>
            <div style="font-size: 13px; color: var(--color-text-secondary);">Correct</div>
            <div style="font-size: 36px; font-weight: 500;">${state.score}${isPlay ? `<span style="color: var(--color-text-tertiary); font-size: 24px;">/${total}</span>` : ''}</div>
          </div>
          <div>
            <div style="font-size: 13px; color: var(--color-text-secondary);">Best streak</div>
            <div style="font-size: 36px; font-weight: 500;">${state.bestStreak}</div>
          </div>
        </div>
        ${state.wrong.length > 0 ? `
          <div style="background: var(--color-background-secondary); border-radius: var(--border-radius-lg); padding: 1rem 1.25rem; margin: 1rem 0 1.5rem; text-align: left;">
            <div style="font-size: 14px; font-weight: 500; margin-bottom: 10px;">Review these</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${state.wrong.map(w => `<div class="mt-review-tag">${w.a} × ${w.b} = <strong style="font-weight: 500;">${w.answer}</strong></div>`).join('')}
            </div>
          </div>` : (isPlay ? `
          <div style="background: var(--color-background-success); border-radius: var(--border-radius-lg); padding: 12px; margin: 1rem 0 1.5rem; color: var(--color-text-success); font-size: 14px;">
            <i class="ti ti-confetti" aria-hidden="true" style="vertical-align: -2px; margin-right: 6px;"></i>Flawless round — no mistakes!
          </div>` : '')}
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button class="mt-primary" id="mt-again"><i class="ti ti-refresh" aria-hidden="true" style="vertical-align: -2px; margin-right: 6px;"></i>Play again</button>
          <button class="mt-ghost" id="mt-resettings">Change settings</button>
        </div>
      </div>
    `;
    root.querySelector('#mt-again').addEventListener('click', () => startMode(state.mode));
    root.querySelector('#mt-resettings').addEventListener('click', renderSettings);
}
```

Notes:
- For practice, `total = state.currentQuestion` (number actually answered) and the `/N` suffix on Correct is hidden.
- The "Flawless round" celebration block is gated on `isPlay` (practice has no concept of flawless).
- "Play again" now calls `startMode(state.mode)` to relaunch the same mode.

- [ ] **Step 7: Sanity-check and browser-verify end-to-end**

Start (or confirm) the dev server:

```bash
pgrep -f "http.server 8000" > /dev/null || (python3 -m http.server 8000 > /tmp/srv.log 2>&1 &)
sleep 1
curl -s -o /dev/null -w "Game: %{http_code}\n" http://localhost:8000/games/multiplication-tables/
```

Expected: `Game: 200`.

Then open `http://localhost:8000/games/multiplication-tables/` and walk through:

1. **Settings screen** renders three mode cards, theme picker, sound toggle, achievements grid. No mode tabs, no time chips, no table chips, no count chips visible.

2. **Click Play 10.** Game starts immediately. Timer bar visible. Status reads `Question 1 of 10`. Answer 10 questions → results screen shows correct/N suffix and "New personal best" badge on first run.

3. Click **Change settings** → back to start screen. Best scores summary now shows `Play 10: NNN pts`.

4. **Click Play 20.** Same as above with 20 questions.

5. **Click Practice.** Status reads `Practice · Q1`. No timer bar visible. Sit on the question for 30+ seconds — no timeout fires. Answer a few questions to verify streaks/multipliers/bosses still work. Click **End practice** → results screen reads `Practice session · N questions`, no `/N` on Correct, no best-score badge.

6. **Migration check.** Open DevTools console, paste this *before reloading*:

```js
localStorage.setItem('mt-stats', JSON.stringify({
  achievements: ['survival-10','survival-20','streak-3'],
  totalAnswered: 42,
  bestClassic: { '10': 150, '20': 320, '50': 999 },
  bestSurvival: 18,
}));
location.reload();
```

After reload, in the console run `JSON.parse(localStorage.getItem('mt-stats'))`. The result should be:

```js
{
  achievements: ['streak-3'],       // survival-10 and survival-20 dropped
  totalAnswered: 42,
  bestByMode: { play10: 150, play20: 320 },   // bestClassic['50'] silently dropped
  // bestClassic and bestSurvival no longer present
}
```

The Best Scores summary should also show `Play 10: 150 pts · Play 20: 320 pts`. The achievements grid should show "Three in a row" as unlocked.

7. **No console errors** in any of the flows.

If any of these fail, fix and re-verify before committing.

- [ ] **Step 8: Commit**

```bash
git add games/multiplication-tables/index.html
git commit -m "Replace settings UI with three mode buttons; add End practice

Settings screen now shows Practice / Play 10 / Play 20 as one-click
mode cards. Configuration chips (time, tables, count) and the
classic/survival tabs are removed. Playing screen hides the timer
bar and shows an End practice button when in practice mode. Results
screen has a practice-specific header. Migrating localStorage from
the old bestClassic/bestSurvival/survival-achievement shape happens
once on first load."
```

---

## Out of Scope

The following are explicitly excluded from this plan and must not be added:

- Changes to any file other than `games/multiplication-tables/index.html`.
- Anything in `games.json`, `index.html`, `shared/*`, or other games.
- Dark mode, landing-page theme picker, profile UI, cross-game scores.
- A formal automated test suite (the project has none; verification stays manual).
- Refactoring beyond what the spec calls for (e.g. extracting modes into a separate module, adding TypeScript, etc.).
