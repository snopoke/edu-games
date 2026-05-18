# Edu Games — Static Site Design

**Date:** 2026-05-18
**Status:** Approved (brainstorming phase)

## Goal

Turn the repo from "one Claude-artifact HTML fragment" into a small static site
that hosts a handful of educational games for the author's kids. The site is
designed to grow to 3-6 games over the next few months and to migrate cleanly
to a compiled SPA later (with user profiles and cross-game scores) without
rewriting the games.

Starting point: `multiplication_tables_game_v5_pacing.html`, an artifact-style
fragment that depends on a host-provided design system (`--color-*` CSS
variables), Tabler Icons, and a `window.storage` API.

## Non-Goals

The following are explicitly out of scope for this iteration:

- Profile / avatar / per-user identity
- Cross-game score tracking, dashboards, site-level achievements
- Theme picker on the landing page
- Categories, search, filtering, tags as filter UI
- Dark mode
- Build tooling, bundlers, SPA framework
- Analytics, SEO, accessibility audit beyond what the game already does
- Service worker / offline support

The architecture leaves room for each of these; none are implemented now.

## Audience and Scale

- **Primary audience:** the author's own kids / family.
- **Game count:** ~3-6 games over the next few months.
- **Traffic:** essentially zero; runs on a known device.

This audience justifies keeping the site minimal — no concessions to strangers,
no SEO, no "first-run guidance." It also justifies investing slightly in shared
infrastructure (tokens, storage polyfill, manifest) since multiple games are
coming.

## Architecture Decisions

### Static now, SPA-clean conventions

Plain HTML/JS/CSS, no build step. Per-game folders, a `games.json` manifest,
and a `localStorage` schema chosen so that when a profile system arrives, the
game code does not have to change — only the storage wrapper underneath it
does. When the SPA migration happens, the manifest becomes the route table and
the design tokens move into the framework's theming layer; the games
themselves remain framework-agnostic fragments.

### File layout

```
edu-games/
├── index.html                       # Landing page (hero + grid)
├── games.json                       # Game manifest
├── shared/
│   ├── tokens.css                   # Design tokens (--color-* vars)
│   └── storage.js                   # window.storage polyfill → localStorage
├── games/
│   └── multiplication-tables/
│       └── index.html               # Adapted from the v5_pacing file
├── docs/
│   └── superpowers/
│       └── specs/                   # This document and future specs
├── .gitignore
├── LICENSE
└── README.md                        # (optional, not in this iteration)
```

**URLs (GitHub Pages):**

- `/` → landing page
- `/games/multiplication-tables/` → game

### Hosting

GitHub Pages from `main` branch, root directory. Push to `main` = deploy.
No CI, no build step.

## Landing Page

### Visual layout

Centered hero (title "Edu Games", subtitle "Pick a game to play") followed by a
responsive grid of game cards. The grid is 1 column on phones, 2 columns on
tablets, 3 columns on desktop.

Each card shows: Tabler icon, title, one-line blurb, optional subject tag,
theme-accent color. Cards with `status: "playable"` link to
`games/<slug>/`; cards with `status: "coming-soon"` render dimmed and are
non-interactive.

The landing page header has no profile/avatar widget — that arrives with the
SPA migration.

### Game manifest schema (`games.json`)

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
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `slug` | string | Folder name under `games/`. URL-safe. |
| `title` | string | Display name on the card. |
| `blurb` | string | One-line description. |
| `subject` | string | Optional. Rendered as a small tag. |
| `icon` | string | Tabler icon class, e.g. `"ti-target"`. |
| `accent` | string | Theme key — one of `classic`, `jungle`, `space`, `ocean` (the existing game's palette). Drives the card's accent color. |
| `status` | string | `"playable"` or `"coming-soon"`. |

The landing page fetches this manifest at runtime and renders cards from it.
For the SPA future, this same JSON becomes the route table — fields stay,
additional ones (e.g. `component`, `route`) can be added.

### Rendering

Vanilla JS in `index.html`. Roughly:

```js
const res = await fetch('games.json');
const { games } = await res.json();
const grid = document.querySelector('#games-grid');
grid.innerHTML = games.map(renderCard).join('');
```

Where `renderCard` writes a card template and sets `href="games/<slug>/"` for
playable games (no `href` for coming-soon — they render as a `<div>`).

## Shared Infrastructure

### `shared/tokens.css` — design tokens

Defines the `--color-*` and `--border-radius-*` CSS variables that the
existing game depends on, so the game's CSS works without changes. Tokens are
extracted from the colors the game already uses (e.g. `#378ADD` for info,
`#1D9E75` for success-adjacent greens). Light theme only for now; a dark
variant can be added later under `prefers-color-scheme: dark`.

Tokens to define:

- `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`
- `--color-text-info`, `--color-text-success`, `--color-text-warning`, `--color-text-danger`
- `--color-background-primary`, `--color-background-secondary`
- `--color-background-info`, `--color-background-success`, `--color-background-warning`
- `--color-border-secondary`, `--color-border-tertiary`, `--color-border-info`
- `--border-radius-md`, `--border-radius-lg`

### Tabler Icons

Loaded via CDN in each page's `<head>`:

```html
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@<pinned>/dist/tabler-icons.min.css">
```

The version is pinned (not `latest`) to avoid surprise visual changes. The
implementation plan should pick the exact version available at build time.

### `shared/storage.js` — storage polyfill

The existing game calls `await window.storage.get(key, false)` and
`await window.storage.set(key, value, false)` — a third argument that the
original host API accepted. The polyfill matches that signature (the extra
arg is ignored) so the game's call sites do not change:

```js
window.storage = {
  async get(key, _opts)        { return { value: localStorage.getItem(key) }; },
  async set(key, value, _opts) { localStorage.setItem(key, value); }
};
```

Keys are already namespaced by the game (`mt-stats`, `mt-prefs`), so future
games will not collide as long as they follow the same convention
(e.g. `ww-stats` for "Word Wild").

**SPA migration path:** when profiles arrive, this wrapper changes to route to
`profile.<id>.<key>` (or similar) without changing the game's call sites. The
game keeps calling `window.storage.get('mt-stats')`; the wrapper decides where
that data lives.

## Adapting the Multiplication Game

The existing fragment becomes `games/multiplication-tables/index.html`, wrapped
as a full HTML document:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Multiplication Tables — Edu Games</title>
  <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@<pinned>/dist/tabler-icons.min.css">
  <link rel="stylesheet" href="../../shared/tokens.css">
  <script src="../../shared/storage.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                       Helvetica, Arial, sans-serif;
           margin: 0; padding: 2rem 1rem;
           background: var(--color-background-primary);
           color: var(--color-text-primary); }
    .game-container { max-width: 720px; margin: 0 auto; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0;
               margin:-1px; overflow:hidden; clip:rect(0,0,0,0); border:0; }
  </style>
</head>
<body>
  <div class="game-container">
    <!-- existing <style>, <h2 class="sr-only">, <div id="mt-wrap">,
         and <script>(async ...)</script> pasted unchanged -->
  </div>
</body>
</html>
```

**The game's own code is not modified.** All `window.storage` calls keep
working via the polyfill, all `--color-*` references resolve from
`tokens.css`, all `ti-*` icons resolve from the Tabler CDN.

The old file `multiplication_tables_game_v5_pacing.html` is deleted in the
same commit that adds the new file — git history preserves it.

## Implementation Order

1. **`shared/tokens.css` + `shared/storage.js`** — the dependencies the game
   needs. Trivially testable in isolation (no UI yet).
2. **`games/multiplication-tables/index.html`** — wrap the existing game,
   delete the old file. Verify end-to-end in a browser: settings screen
   renders, icons appear, a round runs, score persists after reload.
3. **`games.json`** — one playable entry plus 1-2 placeholder "coming soon"
   entries so the grid is not lonely. Placeholders are easy to edit later.
4. **`index.html`** — landing page. Fetches the manifest, renders the grid
   from layout A, links playable cards to their game folders.
5. **GitHub Pages setup** — enable Pages on `main` / root in repo settings.
   Verify the live URL works: icons load, game persists state, links work.

Each step is independently verifiable before moving to the next.

## Verification Checklist

After implementation, the following must all be true:

- [ ] Opening `games/multiplication-tables/index.html` via a local dev server
      renders the settings screen with all icons and themes.
- [ ] Starting a round, answering questions, and reloading the page preserves
      stats (achievements, best scores).
- [ ] Opening `index.html` via a local dev server fetches `games.json` and
      renders the card grid.
- [ ] Clicking the multiplication-tables card navigates to the game and the
      game loads correctly.
- [ ] Coming-soon cards render dimmed and are not clickable.
- [ ] On GitHub Pages, all the above still works at the deployed URL.

## Risks and Notes

- **Tabler Icons version drift** — pin to a specific version in the CDN URL.
  `latest` would silently change icons over time.
- **`file://` testing limits** — `fetch('games.json')` does not work when
  pages are opened directly off disk. Local testing needs a tiny dev server
  (`python -m http.server` or `npx serve`). This is a development-only
  consideration; GitHub Pages does not have this problem.
- **localStorage quotas** — well below limits for this scale.
- **No build step is a feature, not a gap** — keeps the bar to add a game low
  and matches the personal-use audience.

## Future Migration Path (Informational)

When the SPA arrives, the migration story is:

- `games.json` becomes the route table fed to the framework's router.
- `shared/tokens.css` either keeps working (CSS variables are framework-agnostic)
  or moves into the framework's theming layer.
- `shared/storage.js` evolves into a profile-aware storage layer. Game code
  does not change.
- Each game's `index.html` becomes a route that renders inside the SPA shell
  — the game's own JS keeps running as-is, but framework chrome (header,
  profile widget, score syncing) wraps it.

The decisions in this design are chosen so that none of the above migrations
require rewriting game logic.
