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

## Favorites

Tap the star on a game card to add or remove it from favorites. Use **Show favorites** above the game list to filter to saved games. Favorites are saved in the browser's local storage, so they stay on that browser/device. If browser storage is disabled, the favorite still works for the current session.

## Today's pick

Set `site.featuredAppId` in `apps.json` to the `id` of the game you want in the **Today's pick** panel. For example:

```json
{
  "site": {
    "name": "gurutaku",
    "tagline": "Game Garden",
    "description": "A cheerful home for Gurutaku learning games.",
    "githubUser": "gurutaku",
    "githubUrl": "https://github.com/gurutaku",
    "featuredAppId": "gr4-math-quest"
  }
}
```

Change `featuredAppId` to another entry's `id`, such as `keyquest` or `karaoke4kids`. The `id` must match exactly. If the chosen ID is not found, the dashboard falls back to an entry with `featured: true`, then a recent game, then the first game in the list.
