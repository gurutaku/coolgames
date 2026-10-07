const FALLBACK_CONFIG = {
  site: { name: 'gurutaku', tagline: 'Learning Playground', githubUser: 'gurutaku', githubUrl: 'https://github.com/gurutaku' },
  discovery: { mode: 'hybrid', discoverGitHubPages: true, maxRepositories: 300 },
  overrides: {},
  manualApps: []
};

const state = {
  config: FALLBACK_CONFIG,
  apps: [],
  query: '',
  category: 'All',
  favorites: loadJSON('gurutaku-dashboard-favorites', []),
  recent: loadJSON('gurutaku-dashboard-recent', [])
};

const $ = (id) => document.getElementById(id);

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch (_) { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function normalizeApp(app) {
  if (!app || !app.url) return null;
  return {
    id: String(app.id || app.slug || app.name || app.title || app.url),
    title: String(app.title || app.name || app.id || 'Untitled app'),
    subtitle: app.subtitle ? String(app.subtitle) : '',
    description: String(app.description || 'A Gurutaku learning activity.'),
    url: String(app.url),
    category: String(app.category || inferCategory(app)),
    icon: String(app.icon || inferIcon(app)),
    featured: Boolean(app.featured),
    order: Number.isFinite(Number(app.order)) ? Number(app.order) : 9999,
    topics: Array.isArray(app.topics) ? app.topics.map(String) : [],
    source: app.source || 'manual'
  };
}

function inferCategory(app) {
  const text = `${app.name || ''} ${app.description || ''} ${(app.topics || []).join(' ')}`.toLowerCase();
  if (/chinese|zh|中文|漢字|mandarin|注音/.test(text)) return 'Chinese';
  if (/math|算|數|algebra/.test(text)) return 'Math';
  if (/vocab|spell/.test(text)) return 'English';
  return app.language ? String(app.language) : 'Other';
}
function inferIcon(app) {
  const cat = inferCategory(app);
  if (cat === 'Chinese Learning') return '🀄';
  if (cat === 'Math') return '➗';
  if (cat === 'Reading') return '📖';
  return '✨';
}

function applyOverride(app, override = {}) {
  const merged = { ...app };
  for (const key of ['title', 'description', 'category', 'icon', 'featured', 'order', 'hide']) {
    if (override[key] !== undefined) merged[key] = override[key];
  }
  return merged;
}

function pageUrl(repo, username) {
  if (repo.name === `${username}.github.io`) return `https://${username}.github.io/`;
  if (repo.homepage && /^https?:\/\//i.test(repo.homepage)) return repo.homepage;
  return `https://${username}.github.io/${encodeURIComponent(repo.name)}/`;
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function discoverPagesRepos(username, maxRepositories = 300) {
  const ownerEndpoints = [
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=100&page=1`,
    `https://api.github.com/orgs/${encodeURIComponent(username)}/repos?type=all&sort=updated&per_page=100&page=1`
  ];

  const results = await Promise.allSettled(ownerEndpoints.map(fetchJSON));
  const batches = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  if (!batches.length) throw new Error('GitHub repository discovery was unavailable.');

  const first = batches.flat();
  const pages = first.filter(repo => repo && repo.has_pages && !repo.archived && !repo.disabled);
  return pages.slice(0, maxRepositories).map(repo => ({
    id: repo.name,
    name: repo.name,
    title: repo.name,
    description: repo.description || 'A Gurutaku learning app.',
    url: pageUrl(repo, username),
    category: inferCategory(repo),
    icon: inferIcon(repo),
    featured: false,
    order: 9999,
    topics: repo.topics || [],
    source: 'github',
    stars: repo.stargazers_count || 0,
    updatedAt: repo.pushed_at || repo.updated_at || null
  }));
}

function mergeApps(config, discovered) {
  const manual = (config.manualApps || []).map(a => ({ ...a, source: 'manual' })).map(normalizeApp).filter(Boolean);
  const manualIds = new Set(manual.map(a => a.id));
  const hidden = new Set(Object.entries(config.overrides || {}).filter(([, v]) => v && v.hide).map(([id]) => id));

  const discoveredNormalized = discovered.map(a => {
    const override = config.overrides?.[a.id] || {};
    return normalizeApp(applyOverride(a, override));
  }).filter(Boolean);

  const manualMerged = manual.map(a => normalizeApp(applyOverride(a, config.overrides?.[a.id] || {}))).filter(Boolean);
  const discoveredUnique = discoveredNormalized.filter(a => !manualIds.has(a.id));
  const merged = [...manualMerged, ...discoveredUnique].filter(a => !hidden.has(a.id));

  merged.sort((a, b) => {
    if (a.featured !== b.featured) return Number(b.featured) - Number(a.featured);
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title, 'zh-Hant');
  });
  return merged;
}

function getVisibleApps() {
  const q = state.query.trim().toLowerCase();
  return state.apps.filter(app => {
    const matchesCategory = state.category === 'All' || app.category === state.category;
    if (!matchesCategory) return false;
    if (!q) return true;
    const haystack = `${app.title} ${app.description} ${app.category} ${app.id} ${(app.topics || []).join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
}

function categories() {
  const values = [...new Set(state.apps.map(a => a.category).filter(Boolean))];
  return ['All', ...values.sort((a, b) => a.localeCompare(b, 'en'))];
}

function renderFilters() {
  const wrap = $('categoryFilters');
  wrap.innerHTML = '';
  categories().forEach(category => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-btn${state.category === category ? ' active' : ''}`;
    btn.textContent = category;
    btn.setAttribute('aria-selected', String(state.category === category));
    btn.addEventListener('click', () => {
      state.category = category;
      renderAll();
    });
    wrap.appendChild(btn);
  });
}

function isFavorite(id) { return state.favorites.includes(id); }

function toggleFavorite(id) {
  state.favorites = isFavorite(id) ? state.favorites.filter(x => x !== id) : [id, ...state.favorites];
  saveJSON('gurutaku-dashboard-favorites', state.favorites);
  renderAll();
}

function recordRecent(id) {
  state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 8);
  saveJSON('gurutaku-dashboard-recent', state.recent);
}

function appCard(app, index) {
  const card = document.createElement('article');
  card.className = 'app-card';
  card.style.animationDelay = `${Math.min(index, 10) * 35}ms`;

  const top = document.createElement('div');
  top.className = 'card-top';
  top.innerHTML = `<div class="app-icon" aria-hidden="true">${escapeHTML(app.icon)}</div>`;

  const fav = document.createElement('button');
  fav.type = 'button';
  fav.className = `favorite-btn${isFavorite(app.id) ? ' active' : ''}`;
  fav.title = isFavorite(app.id) ? 'Remove from favorites' : 'Add to favorites';
  fav.textContent = isFavorite(app.id) ? '★' : '☆';
  fav.setAttribute('aria-label', fav.title);
  fav.addEventListener('click', () => toggleFavorite(app.id));
  top.appendChild(fav);
  card.appendChild(top);

  const title = document.createElement('h3');
  title.textContent = app.title;
  card.appendChild(title);
  if (app.subtitle) {
    const subtitle = document.createElement('div');
    subtitle.className = 'app-subtitle';
    subtitle.textContent = app.subtitle;
    card.appendChild(subtitle);
  }

  const desc = document.createElement('p');
  desc.className = 'app-description';
  desc.textContent = app.description;
  card.appendChild(desc);

  const bottom = document.createElement('div');
  bottom.className = 'card-bottom';
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.innerHTML = `<span class="tag">${escapeHTML(app.category)}</span>${app.featured ? '<span class="tag featured">推薦</span>' : ''}`;
  bottom.appendChild(meta);

  const play = document.createElement('a');
  play.className = 'play-btn';
  play.target = '_blank';
  play.rel = 'noreferrer';
  play.href = app.url;
  play.textContent = 'Play ↗';
  play.addEventListener('click', () => recordRecent(app.id));
  bottom.appendChild(play);

  card.appendChild(bottom);
  return card;
}

function renderApps() {
  const grid = $('appGrid');
  const empty = $('emptyState');
  const visible = getVisibleApps();
  grid.innerHTML = '';
  if (!visible.length) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    visible.forEach((app, i) => grid.appendChild(appCard(app, i)));
  }
  $('resultCount').textContent = `${visible.length} result${visible.length === 1 ? '' : 's'}`;
}

function renderHero() {
  const featured = state.apps.find(a => a.featured) || state.apps.find(a => state.recent.includes(a.id)) || state.apps[0];
  const node = $('featuredPreview');
  if (!featured) {
    node.innerHTML = '<p>No published games yet. Publish a GitHub Pages app or add a site to apps.json.</p>'; 
    return;
  }
  node.innerHTML = `
    <span class="featured-tag">${escapeHTML(featured.category)}</span>
    <h3>${escapeHTML(featured.icon)} ${escapeHTML(featured.title)}</h3>
    <p>${escapeHTML(featured.description)}</p>
    <a class="featured-cta" target="_blank" rel="noreferrer" href="${escapeAttr(featured.url)}">Play now ↗</a>
  `;
  node.querySelector('a').addEventListener('click', () => recordRecent(featured.id));
}

function renderAll() {
  renderFilters();
  renderHero();
  renderApps();
  $('appCount').textContent = String(state.apps.length);
  $('categoryCount').textContent = String(Math.max(0, categories().length - 1));
  $('sourceStatus').textContent = state.apps.some(a => a.source === 'github') ? 'GitHub + local' : 'apps.json';
  $('lastUpdated').textContent = `Updated ${new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}
function escapeAttr(value) { return escapeHTML(value).replace(/'/g, '&#39;'); }

async function loadDashboard() {
  $('sourceStatus').textContent = 'Loading';
  try {
    const response = await fetch('apps.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('apps.json unavailable');
    state.config = { ...FALLBACK_CONFIG, ...(await response.json()) };
  } catch (_) {
    state.config = FALLBACK_CONFIG;
  }

  const mode = state.config.discovery?.mode || 'hybrid';
  const shouldDiscover = state.config.discovery?.discoverGitHubPages !== false && mode !== 'manual';
  let discovered = [];
  let discoveryWorked = false;
  if (shouldDiscover) {
    try {
      discovered = await discoverPagesRepos(state.config.site?.githubUser || 'gurutaku', state.config.discovery?.maxRepositories || 300);
      discoveryWorked = true;
    } catch (_) {
      discovered = [];
    }
  }

  state.apps = mergeApps({ ...state.config, manualApps: mode === 'auto' ? [] : (state.config.manualApps || []) }, discovered);
  renderAll();

  if (!discoveryWorked && shouldDiscover) {
    $('sourceStatus').textContent = state.apps.length ? 'apps.json 備援' : '未連線';
  } else if (discoveryWorked && mode === 'auto') {
    $('sourceStatus').textContent = 'GitHub';
  }
}

$('searchInput').addEventListener('input', e => {
  state.query = e.target.value;
  renderApps();
});
$('clearFiltersBtn').addEventListener('click', () => {
  state.query = '';
  state.category = 'All';
  $('searchInput').value = '';
  renderAll();
});
$('refreshBtn').addEventListener('click', () => loadDashboard());

loadDashboard();
