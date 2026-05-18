# Edu Games Static Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the repo from a one-off Claude-artifact fragment into a small static site that hosts the multiplication-tables game (adapted to run standalone) plus a landing page driven by a games manifest, deployed via GitHub Pages.

**Architecture:** Plain HTML/CSS/JS, no build step. A `shared/` directory holds the design tokens and `window.storage` polyfill that the existing game expects. Games live under `games/<slug>/index.html`. The landing page (`index.html`) reads `games.json` and renders a responsive card grid. Conventions are chosen so a future SPA migration re-skins the shell without touching game logic.

**Tech Stack:** HTML5, CSS3 (custom properties), vanilla JS (no framework), Tabler Icons (webfont via jsdelivr CDN), `localStorage`. GitHub Pages for hosting. `python3 -m http.server` for local dev.

**Reference spec:** `docs/superpowers/specs/2026-05-18-edu-games-site-design.md`

---

## File Structure

| Path | Created in | Responsibility |
|------|------------|----------------|
| `shared/tokens.css` | Task 1 | Define `--color-*` and `--border-radius-*` design tokens used by every page and by the existing game's CSS. |
| `shared/storage.js` | Task 1 | Define `window.storage.get/set` as a thin async wrapper around `localStorage`, matching the host API the game was originally written against. |
| `games/multiplication-tables/index.html` | Task 2 | Standalone HTML wrapper around the existing game fragment. Loads tokens, storage polyfill, and Tabler Icons; pastes the game's `<style>` + markup + `<script>` unchanged. |
| `games.json` | Task 3 | Manifest of games (slug, title, blurb, subject, icon, accent, status). Drives the landing page. |
| `index.html` | Task 4 | Landing page: hero + responsive card grid. Fetches `games.json` and renders cards; playable cards link to `games/<slug>/`, coming-soon cards render dimmed. |

**Deleted in Task 2:** `multiplication_tables_game_v5_pacing.html` (the original artifact-style fragment). Git history preserves it.

---

## Testing Approach

This project has no automated test framework — it is a static HTML/CSS/JS site. **Verification is manual, in a browser.** Each task that produces a user-visible artifact ends with explicit browser verification steps before the commit.

**Local dev server:** all browser verification uses

```bash
cd /home/skelly/src/edu-games
python3 -m http.server 8000
```

then open `http://localhost:8000/...` in a browser. `fetch()` and module loading do not work from `file://` URLs, so the dev server is required.

**Stop the server** with Ctrl+C between tasks (or leave it running — it auto-serves the latest files).

---

## Task 1: Shared infrastructure (tokens + storage polyfill)

**Files:**
- Create: `shared/tokens.css`
- Create: `shared/storage.js`

- [ ] **Step 1: Create `shared/tokens.css`**

Create the file with these contents:

```css
/* Design tokens for Edu Games.
   These resolve every var(--color-*) and var(--border-radius-*) the
   existing multiplication game's CSS references. Light theme only. */

:root {
  /* Text */
  --color-text-primary:   #1f2937;
  --color-text-secondary: #6b7280;
  --color-text-tertiary:  #9ca3af;
  --color-text-info:      #378ADD;
  --color-text-success:   #1D9E75;
  --color-text-warning:   #B5650D;
  --color-text-danger:    #C2410C;

  /* Backgrounds */
  --color-background-primary:   #ffffff;
  --color-background-secondary: #f3f4f6;
  --color-background-info:      #E8F3FD;
  --color-background-success:   #E5F4ED;
  --color-background-warning:   #FAEEDA;

  /* Borders */
  --color-border-secondary: #d1d5db;
  --color-border-tertiary:  #e5e7eb;
  --color-border-info:      #A8CFEE;

  /* Radii */
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
}
```

- [ ] **Step 2: Create `shared/storage.js`**

Create the file with these contents:

```js
/* Polyfill for the window.storage API that the multiplication game was
   originally written against. The third argument to get/set was used by the
   original host; we accept and ignore it so the game's call sites don't
   need to change. */

window.storage = {
  async get(key, _opts)        { return { value: localStorage.getItem(key) }; },
  async set(key, value, _opts) { localStorage.setItem(key, value); }
};
```

- [ ] **Step 3: Verify both files exist and are non-empty**

Run:

```bash
ls -la shared/
wc -l shared/tokens.css shared/storage.js
```

Expected: both files present, `tokens.css` is roughly 30 lines, `storage.js` is roughly 10 lines.

- [ ] **Step 4: Commit**

```bash
git add shared/tokens.css shared/storage.js
git commit -m "Add shared design tokens and window.storage polyfill"
```

---

## Task 2: Adapt the multiplication-tables game

**Files:**
- Create: `games/multiplication-tables/index.html`
- Delete: `multiplication_tables_game_v5_pacing.html`

Goal: produce a standalone HTML page that runs the existing game without any modification to the game's CSS or JS. The page wraps the existing fragment with a proper HTML document, loads design tokens, the storage polyfill, and Tabler Icons.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p games/multiplication-tables
```

- [ ] **Step 2: Build the HTML wrapper**

Create `games/multiplication-tables/index.html`. The wrapper has three parts:
1. `<head>` with charset, viewport, title, Tabler Icons CDN link, `shared/tokens.css` link, `shared/storage.js` script, and a small `<style>` block for page-level layout.
2. `<body>` with a `.game-container` div.
3. Inside that container, paste the existing game's `<style>` + `<h2 class="sr-only">` + `<div id="mt-wrap">` + `<script>(async function() {...})()</script>` **unchanged** from `multiplication_tables_game_v5_pacing.html`.

Use this skeleton:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Multiplication Tables — Edu Games</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.30.0/dist/tabler-icons.min.css">
  <link rel="stylesheet" href="../../shared/tokens.css">
  <script src="../../shared/storage.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 2rem 1rem;
      background: var(--color-background-primary);
      color: var(--color-text-primary);
    }
    .game-container { max-width: 720px; margin: 0 auto; }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0;
      margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0;
    }
  </style>
</head>
<body>
  <div class="game-container">
    <!-- PASTE THE FULL CONTENTS OF multiplication_tables_game_v5_pacing.html HERE -->
    <!-- (starting with the <style> block and ending with the closing </script>) -->
  </div>
</body>
</html>
```

To actually fill in the pasted section, copy the **entire contents** of `multiplication_tables_game_v5_pacing.html` (from the opening `<style>` on line 1 to the closing `</script>` near the end) verbatim into the `<div class="game-container">`. Do **not** edit anything inside — no renames, no removals, no `window.storage` → `localStorage` rewrites. The polyfill handles it.

- [ ] **Step 3: Start a local dev server in the background**

```bash
python3 -m http.server 8000 &
echo "Server started; remember to kill it when done"
```

- [ ] **Step 4: Verify the game loads and runs in a browser**

Open `http://localhost:8000/games/multiplication-tables/` in a browser.

Verification checklist (all must pass):

1. The settings screen renders with the "Times tables" header and a `ti-circle-dot` icon (theme: Classic).
2. The four theme chips (Classic, Jungle, Space, Ocean) all show their colored swatch and icon.
3. The time-per-question chips, table chips (×2 through ×12), and "Questions per round" chips all render with the correct active state.
4. The achievements grid at the bottom shows 9 lock icons (or any unlocked icons from prior plays).
5. Click "Start round". The playing screen appears with a problem like `7 × 4`, a timer bar, and an input box.
6. Answer correctly. The feedback screen shows a green check icon, the equation, and an encouragement message.
7. Finish a 10-question round. The results screen appears with points, correct count, and best streak. Click "Change settings" to return to the home screen — your stats persist.
8. Reload the page. The achievements you unlocked are still shown as unlocked. (This proves `localStorage` is working through the polyfill.)
9. Open browser DevTools → Application → Local Storage → `http://localhost:8000`. You should see entries `mt-stats` and `mt-prefs`.
10. No console errors. (Some missing-icon 404s from the CDN would indicate a bad version pin — see troubleshooting below.)

**Troubleshooting:** If any icons render as empty squares, the Tabler Icons version pin (`3.30.0`) may not be available. Check `https://www.jsdelivr.com/package/npm/@tabler/icons-webfont` for current versions and update the `<link>` href to a pinned version that exists. After updating, hard-reload and re-verify.

- [ ] **Step 5: Delete the old fragment file**

```bash
git rm multiplication_tables_game_v5_pacing.html
```

- [ ] **Step 6: Stop the dev server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 7: Commit**

```bash
git add games/multiplication-tables/index.html
git commit -m "Adapt multiplication-tables game to standalone page

Wrap the existing artifact-style fragment in a proper HTML document,
load shared tokens + storage polyfill + Tabler Icons CDN. The game's
CSS and JS are pasted unchanged; the polyfill maps window.storage
calls to localStorage."
```

---

## Task 3: Games manifest (`games.json`)

**Files:**
- Create: `games.json`

- [ ] **Step 1: Create `games.json`**

Create the file at the repo root with this content:

```json
{
  "games": [
    {
      "slug": "multiplication-tables",
      "title": "Multiplication Tables",
      "blurb": "Beat the clock, build streaks, defeat bosses.",
      "subject": "Math",
      "icon": "ti-target",
      "accent": "classic",
      "status": "playable"
    },
    {
      "slug": "word-wild",
      "title": "Word Wild",
      "blurb": "Word challenges coming soon.",
      "subject": "English",
      "icon": "ti-leaf",
      "accent": "jungle",
      "status": "coming-soon"
    },
    {
      "slug": "number-quest",
      "title": "Number Quest",
      "blurb": "Number adventures coming soon.",
      "subject": "Math",
      "icon": "ti-planet",
      "accent": "space",
      "status": "coming-soon"
    }
  ]
}
```

The two coming-soon entries are placeholders so the grid is not lonely. The user can rename, delete, or expand them at any time.

- [ ] **Step 2: Verify the JSON parses**

Run:

```bash
python3 -m json.tool games.json > /dev/null && echo "OK"
```

Expected output: `OK`. If you see a JSON parse error, fix the file.

- [ ] **Step 3: Commit**

```bash
git add games.json
git commit -m "Add games manifest with one playable + two placeholder entries"
```

---

## Task 4: Landing page (`index.html`)

**Files:**
- Create: `index.html`

Goal: a single-file landing page that fetches `games.json` at runtime and renders the card grid (layout A from brainstorming: centered hero + responsive 1/2/3-column grid).

- [ ] **Step 1: Create `index.html`**

Create the file at the repo root with these contents:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Edu Games</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.30.0/dist/tabler-icons.min.css">
  <link rel="stylesheet" href="shared/tokens.css">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 2rem 1rem;
      background: var(--color-background-primary);
      color: var(--color-text-primary);
    }
    .lp-wrap { max-width: 960px; margin: 0 auto; }
    .lp-hero { text-align: center; padding: 2rem 1rem 2.5rem; }
    .lp-hero h1 { font-size: 2.5rem; font-weight: 600; margin: 0; }
    .lp-hero p { font-size: 1rem; color: var(--color-text-secondary); margin: 0.5rem 0 0; }

    .lp-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    @media (min-width: 640px)  { .lp-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 960px)  { .lp-grid { grid-template-columns: repeat(3, 1fr); } }

    .lp-card {
      display: block;
      background: var(--color-background-primary);
      border: 1px solid var(--color-border-tertiary);
      border-radius: var(--border-radius-lg);
      padding: 1.25rem;
      text-decoration: none;
      color: inherit;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .lp-card.playable:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      border-color: var(--lp-accent, var(--color-border-info));
    }
    .lp-card.coming-soon {
      opacity: 0.55;
      cursor: default;
    }

    .lp-card-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--border-radius-md);
      background: var(--lp-accent-bg, var(--color-background-info));
      color: var(--lp-accent, var(--color-text-info));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 12px;
    }
    .lp-card-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 4px; }
    .lp-card-blurb { font-size: 0.85rem; color: var(--color-text-secondary); line-height: 1.4; margin-bottom: 8px; }
    .lp-card-tag {
      display: inline-block;
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--color-background-secondary);
      color: var(--color-text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .lp-error {
      text-align: center;
      color: var(--color-text-secondary);
      padding: 2rem;
    }
  </style>
</head>
<body>
  <div class="lp-wrap">
    <header class="lp-hero">
      <h1>Edu Games</h1>
      <p>Pick a game to play</p>
    </header>
    <main id="lp-grid" class="lp-grid"></main>
  </div>

  <script>
    // Accent palette mirrors the multiplication game's theme palette so card
    // colors match the theme each game uses internally.
    const ACCENTS = {
      classic: { fg: '#378ADD', bg: '#E8F3FD' },
      jungle:  { fg: '#1D9E75', bg: '#E5F4ED' },
      space:   { fg: '#7F77DD', bg: '#EEEAFB' },
      ocean:   { fg: '#0E7C9C', bg: '#DFF1F7' },
    };

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    function renderCard(g) {
      const accent = ACCENTS[g.accent] || ACCENTS.classic;
      const styles = `--lp-accent:${accent.fg};--lp-accent-bg:${accent.bg};`;
      const iconClass = escapeHtml(g.icon || 'ti-circle-dot');
      const title  = escapeHtml(g.title);
      const blurb  = escapeHtml(g.blurb || '');
      const subjectTag = g.subject
        ? `<span class="lp-card-tag">${escapeHtml(g.subject)}</span>`
        : '';
      const inner = `
        <div class="lp-card-icon"><i class="ti ${iconClass}" aria-hidden="true"></i></div>
        <div class="lp-card-title">${title}</div>
        <div class="lp-card-blurb">${blurb}</div>
        ${subjectTag}
      `;
      if (g.status === 'playable') {
        const slug = encodeURIComponent(g.slug);
        return `<a class="lp-card playable" style="${styles}" href="games/${slug}/">${inner}</a>`;
      }
      return `<div class="lp-card coming-soon" style="${styles}">${inner}</div>`;
    }

    async function load() {
      const grid = document.getElementById('lp-grid');
      try {
        const res = await fetch('games.json');
        if (!res.ok) throw new Error('manifest fetch failed: ' + res.status);
        const { games } = await res.json();
        grid.innerHTML = games.map(renderCard).join('');
      } catch (err) {
        console.error(err);
        grid.innerHTML = '<p class="lp-error">Could not load games list.</p>';
      }
    }

    load();
  </script>
</body>
</html>
```

- [ ] **Step 2: Start a local dev server**

```bash
python3 -m http.server 8000 &
```

- [ ] **Step 3: Verify the landing page renders**

Open `http://localhost:8000/` in a browser.

Verification checklist:

1. Page title in the tab reads "Edu Games".
2. Centered hero shows "Edu Games" heading and "Pick a game to play" subtitle.
3. Three cards render in the grid: Multiplication Tables (blue accent, target icon), Word Wild (green accent, leaf icon), Number Quest (purple accent, planet icon).
4. The Multiplication Tables card is fully opaque and has a hover effect (slight lift and shadow on mouseover).
5. Word Wild and Number Quest cards render dimmed (no hover effect).
6. Each card shows the subject tag (Math / English / Math) in a small pill.
7. Resize the browser window: at narrow widths cards stack in 1 column, around tablet width they become 2 columns, at desktop width 3 columns.
8. Click the Multiplication Tables card. It navigates to `/games/multiplication-tables/` and the game loads.
9. Use the browser back button to return to the landing page. No errors.
10. No console errors. No missing-icon squares.

**Troubleshooting:** If the grid is empty and the console shows a manifest fetch error, confirm `games.json` is valid (re-run `python3 -m json.tool games.json`). If you opened the file via `file://` instead of through the dev server, `fetch` will fail — use `http://localhost:8000/` instead.

- [ ] **Step 4: Stop the dev server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Add landing page with manifest-driven game grid"
```

---

## Task 5: Deploy to GitHub Pages

**Files:** none modified. This task is configuration on GitHub.

- [ ] **Step 1: Push the branch**

```bash
git push origin main
```

- [ ] **Step 2: Enable GitHub Pages**

This is a manual step in the GitHub UI:

1. Open `https://github.com/snopoke/edu-games/settings/pages` in a browser.
2. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose `main` and `/ (root)`. Click **Save**.
4. GitHub will display a banner saying "Your site is being deployed." The first deploy typically takes 1–3 minutes.

- [ ] **Step 3: Wait for the deploy to finish**

Refresh the Pages settings page until it shows:

> Your site is live at `https://snopoke.github.io/edu-games/`

(or similar URL).

- [ ] **Step 4: Verify the live site**

Open the live URL in a browser. Verify:

1. The landing page loads with all three cards.
2. Icons render correctly (Tabler CDN works from the GitHub Pages origin).
3. Click Multiplication Tables. The game loads, settings screen renders, all icons appear.
4. Start a round, answer a few questions, return to settings. State persists.
5. Reload the game page. Achievements and prefs persist (`localStorage` works on the deployed origin).
6. Use the browser back button to return to the landing page. The site behaves the same as the local dev server.

- [ ] **Step 5 (no commit): record the live URL**

Nothing to commit. Optionally note the live URL somewhere (e.g. in `README.md` later, or in the repo's GitHub "About" section).

---

## Out of Scope

The following are deliberately excluded per the spec and must **not** be added in this plan's tasks:

- Profile / avatar / per-user identity UI or storage
- Cross-game score tracking, dashboards, site-level achievements
- Theme picker on the landing page
- Categories, search, filtering UI
- Dark mode
- Build tooling, bundlers, SPA framework
- Analytics, SEO, accessibility audit
- Service worker / offline support
- A README (defer unless explicitly requested)
- Automated tests (this is a static site; verification is manual in-browser)
