# Gurutaku Dashboard

A static, GitHub Pages-friendly entrance page for the Gurutaku learning games.

## What it does

The dashboard supports three discovery modes in `apps.json`:

- `auto`: discover public GitHub repositories that have GitHub Pages enabled.
- `manual`: show only the entries in `manualApps`.
- `hybrid`: discover GitHub Pages apps and also include the entries in `manualApps`.

The default is `hybrid`.

GitHub's public repository API exposes a `has_pages` field, so the dashboard can use that to identify repositories with Pages enabled. Public repository listing can be used without authentication. See the GitHub REST API documentation: https://docs.github.com/en/rest/repos/repos

## Recommended deployment

Put this dashboard in your main `gurutaku.github.io` repository. Then publish the other games as separate GitHub Pages project sites, for example:

- `https://gurutaku.github.io/chinese-character-weekly/`
- `https://gurutaku.github.io/math24/`

GitHub Pages project sites use the repository name as the path under the main `*.github.io` site. See: https://docs.github.com/en/pages/quickstart

## Managing apps manually

Edit `apps.json`.

A manual entry looks like:

```json
{
  "id": "my-game",
  "title": "我的新遊戲",
  "description": "A short description shown on the card.",
  "url": "https://gurutaku.github.io/my-game/",
  "category": "遊戲",
  "icon": "🎮",
  "featured": false,
  "order": 20
}
```

### Useful controls

`manualApps` — explicit list of apps to show.

`overrides` — customize an automatically discovered repository without changing its repo metadata. You can set `title`, `description`, `category`, `icon`, `featured`, `order`, or `hide`.

`discovery.mode` — `auto`, `manual`, or `hybrid`.

`discovery.discoverGitHubPages` — set to `false` to disable GitHub API discovery entirely.

## School-network-friendly behavior

The dashboard itself has no external JavaScript or CSS dependencies. If the GitHub API is blocked on a school network, the dashboard automatically falls back to `apps.json` so the app list can still appear.

For the most reliable school deployment, keep your important games listed in `manualApps`, even when automatic discovery is enabled.

## Notes about automatic discovery

Automatic discovery can identify repositories with Pages enabled, but GitHub does not provide a perfect "this is an educational app" classification. The `overrides` section lets you rename, categorize, pin, or hide discovered repositories.
