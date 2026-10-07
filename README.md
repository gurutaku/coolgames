# Gurutaku Game Garden

A kid-friendly, English-first GitHub Pages dashboard for Gurutaku learning games.

## What it does

- Automatically discovers current GitHub Pages repositories for the `gurutaku` account.
- Excludes the dashboard repository itself (`gurutaku.github.io`).
- Ignores archived, disabled, and forked repositories.
- Uses fresh GitHub API requests instead of storing a discovered-app cache, so deleted repositories do not linger in the dashboard.
- Supports a simple `apps.json` file for manual games, custom titles, categories, icons, featured games, and ordering.
- Hybrid mode combines the manual list with discovered apps.
- Search, subject filters, favorites, recent-game highlighting, responsive mobile/tablet layout, and a playful elementary-school visual design.

## Why a deleted repository might have appeared before

The earlier dashboard build could show repositories through its discovery path and also accepted manually configured entries. It also did not hard-exclude the dashboard URL at the final merge stage. This build now filters the dashboard repository by both repository name and URL, de-duplicates results, ignores forks, and never persists a discovered-app cache.

## `apps.json`

Use `discovery.mode`:

- `hybrid`: show manual apps plus discovered Pages apps.
- `auto`: show only discovered Pages apps.
- `manual`: show only entries in `manualApps`.

Use `discovery.ignoreRepositories` for repositories that should never be shown. Use `overrides.<repo-name>.hide: true` for a per-repository hide rule.

For a tightly curated school-facing portal, `manual` mode is the safest choice because every visible game is explicitly selected. `hybrid` mode is convenient while you are actively creating new games.

## GitHub Pages

Upload the contents of this folder to the `gurutaku.github.io` repository and enable GitHub Pages from the repository's `main` branch (or use your preferred Pages workflow).
