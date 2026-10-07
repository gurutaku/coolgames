const BUILD = '2026.10.07-kids-2';
const FALLBACK_CONFIG = {
  site: { name: 'gurutaku', tagline: 'Game Garden', githubUser: 'gurutaku', githubUrl: 'https://github.com/gurutaku' },
  discovery: {
    mode: 'hybrid',
    discoverGitHubPages: true,
    maxRepositories: 300,
    ignoreRepositories: ['coolgames']
  },
  overrides: {},
  manualApps: []
};

const state = {
  config: FALLBACK_CONFIG,
  apps: [],
  query: '',
  category: 'All Games',
  favorites: loadJSON('gurutaku-dashboard-favorites', []),
  recent: loadJSON('gurutaku-dashboard-recent', []),
  discoveryWorked: false
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
    title: String(app.title || app.name || app.id || 'Untitled game'),
    subtitle: app.subtitle ? String(app.subtitle) : '',
    description: String(app.description || 'A fun Gurutaku game.'),
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
  if (/chinese|zh|中文|漢字|mandarin|bopomofo/.test(text)) return 'Chinese';
  if (/math|algebra|multiplication|fraction/.test(text)) return 'Math';
  if (/reading|read|spell|vocab/.test(text)) return 'English';
  return 'Other';
}
function inferIcon(app) {
  const cat = inferCategory(app);
  if (cat === 'Chinese') return '🀄';
  if (cat === 'Math') return '🔢';
  if (cat === 'Reading') return '📚';
  if (cat === 'Science') return '🔬';
  if (cat === 'Games') return '🎮';
  return '⭐';
}

function applyOverride(app, override = {}) {
  const merged = { ...app };
  for (const key of ['title', 'subtitle', 'description', 'category', 'icon', 'featured', 'order', 'hide']) {
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
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}_=${encodeURIComponent(BUILD)}-${Date.now()}`, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchRepoPages(endpointBase, maxRepositories) {
  const results = [];
  const pagesNeeded = Math.ceil(maxRepositories / 100);
  for (let page = 1; page <= pagesNeeded; page++) {
    const data = await fetchJSON(`${endpointBase}&per_page=100&page=${page}`);
    if (!Array.isArray(data) || !data.length) break;
    results.push(...data);
    if (data.length < 100) break;
  }
  return results;
}

async function discoverPagesRepos(username, maxRepositories = 300) {
  const candidates = [
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated`,
    `https://api.github.com/orgs/${encodeURIComponent(username)}/repos?type=all&sort=updated`
  ];
  const results = await Promise.allSettled(candidates.map(base => fetchRepoPages(base, maxRepositories)));
  const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  if (!successful.length) throw new Error('GitHub repository discovery was unavailable.');

  const repoMap = new Map();
  successful.flat().forEach(repo => {
    if (repo && repo.name) repoMap.set(repo.name.toLowerCase(), repo);
  });

  return [...repoMap.values()]
    .filter(repo => repo && repo.has_pages && !repo.archived && !repo.disabled && !repo.fork)
    .slice(0, maxRepositories)
    .map(repo => ({
      id: repo.name,
      name: repo.name,
      title: repo.name,
      description: repo.description || 'A fun Gurutaku game.',
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
  const ignored = new Set([
    'coolgames',
    ...(config.discovery?.ignoreRepositories || []),
    ...Object.entries(config.overrides || {}).filter(([, v]) => v && v.hide).map(([id]) => id)
  ].map(String).map(v => v.toLowerCase()));

  const discoveredNormalized = discovered.map(a => {
    const override = config.overrides?.[a.id] || {};
    return normalizeApp(applyOverride(a, override));
  }).filter(Boolean);
  const manualMerged = manual.map(a => normalizeApp(applyOverride(a, config.overrides?.[a.id] || {}))).filter(Boolean);

  const discoveredUnique = discoveredNormalized.filter(a => !manualIds.has(a.id));
  const merged = [...manualMerged, ...discoveredUnique]
    .filter(a => !ignored.has(a.id.toLowerCase()))
    .filter(a => !ignored.has(repoIdFromUrl(a.url).toLowerCase()))
    .filter(a => a.url !== `https://${config.site?.githubUser || 'gurutaku'}.github.io/`)
    .filter((app, i, arr) => arr.findIndex(x => x.id.toLowerCase() === app.id.toLowerCase()) === i);

  merged.sort((a, b) => {
    if (a.featured !== b.featured) return Number(b.featured) - Number(a.featured);
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title, 'en');
  });
  return merged;
}

function repoIdFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const match = host.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!match) return '';
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] || `${match[1]}.github.io`;
  } catch (_) { return ''; }
}

function getVisibleApps() {
  const q = state.query.trim().toLowerCase();
  return state.apps.filter(app => {
    const matchesCategory = state.category === 'All Games' || app.category === state.category;
    if (!matchesCategory) return false;
    if (!q) return true;
    const haystack = `${app.title} ${app.subtitle} ${app.description} ${app.category} ${app.id} ${(app.topics || []).join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
}

function categories() {
  const values = [...new Set(state.apps.map(a => a.category).filter(Boolean))];
  return ['All Games', ...values.sort((a, b) => a.localeCompare(b, 'en'))];
}

const CATEGORY_STYLE = {
  'All Games': 'rainbow',
  'Math': 'math',
  'Chinese': 'chinese',
  'Reading': 'reading',
  'Science': 'science',
  'Games': 'games',
  'Other': 'other'
};

function categoryIcon(category) {
  return {
    'All Games': '🌈', Math: '🔢', Chinese: '🀄', Reading: '📚', Science: '🔬', Games: '🎮', Other: '✨'
  }[category] || '⭐';
}

function renderFilters() {
  const wrap = $('categoryFilters');
  wrap.innerHTML = '';
  categories().forEach(category => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-btn ${CATEGORY_STYLE[category] || 'other'}${state.category === category ? ' active' : ''}`;
    btn.textContent = `${categoryIcon(category)} ${category}`;
    btn.setAttribute('aria-pressed', String(state.category === category));
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
  const style = CATEGORY_STYLE[app.category] || 'other';
  card.className = `app-card ${style}`;
  card.style.animationDelay = `${Math.min(index, 12) * 35}ms`;

  const top = document.createElement('div');
  top.className = 'card-top';

  const badge = document.createElement('div');
  badge.className = 'card-badge';
  badge.textContent = app.category;
  top.appendChild(badge);

  const fav = document.createElement('button');
  fav.type = 'button';
  fav.className = `favorite-btn${isFavorite(app.id) ? ' active' : ''}`;
  fav.title = isFavorite(app.id) ? 'Remove from favorites' : 'Add to favorites';
  fav.textContent = isFavorite(app.id) ? '★' : '☆';
  fav.setAttribute('aria-label', fav.title);
  fav.addEventListener('click', () => toggleFavorite(app.id));
  top.appendChild(fav);
  card.appendChild(top);

  const iconWrap = document.createElement('div');
  iconWrap.className = 'app-icon-wrap';
  iconWrap.innerHTML = `<span class="app-icon" aria-hidden="true">${escapeHTML(app.icon)}</span>`;
  card.appendChild(iconWrap);

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

  const play = document.createElement('a');
  play.className = 'play-btn';
  play.target = '_blank';
  play.rel = 'noreferrer';
  play.href = app.url;
  play.innerHTML = 'Play <span aria-hidden="true">▶</span>';
  play.addEventListener('click', () => recordRecent(app.id));
  card.appendChild(play);

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
  $('resultCount').textContent = `${visible.length} ${visible.length === 1 ? 'game' : 'games'}`;
}

function renderHero() {
  const featured = state.apps.find(a => a.featured) || state.apps.find(a => state.recent.includes(a.id)) || state.apps[0];
  const node = $('featuredPreview');
  if (!featured) {
    node.innerHTML = '<div class="no-feature"><span>🌱</span><strong>Your game garden is growing!</strong><p>Add a game to <code>apps.json</code> or publish a GitHub Pages app.</p></div>';
    return;
  }
  const style = CATEGORY_STYLE[featured.category] || 'other';
  node.innerHTML = `
    <div class="feature-art ${style}"><span>${escapeHTML(featured.icon)}</span><b>${escapeHTML(featured.category)}</b></div>
    <div class="feature-copy">
      <span class="featured-tag">⭐ Featured game</span>
      <h3>${escapeHTML(featured.title)}</h3>
      <p>${escapeHTML(featured.description)}</p>
      <a class="featured-cta" target="_blank" rel="noreferrer" href="${escapeAttr(featured.url)}">Let's play! <span aria-hidden="true">🚀</span></a>
    </div>
  `;
  node.querySelector('a').addEventListener('click', () => recordRecent(featured.id));
}

function renderAll() {
  renderFilters();
  renderHero();
  renderApps();
  $('appCount').textContent = String(state.apps.length);
  $('categoryCount').textContent = String(Math.max(0, categories().length - 1));
  $('sourceStatus').textContent = state.discoveryWorked ? 'Live' : 'List';
  $('lastUpdated').textContent = `Checked ${new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}
function escapeAttr(value) { return escapeHTML(value).replace(/'/g, '&#39;'); }

async function loadDashboard() {
  $('sourceStatus').textContent = 'Loading…';
  // Older builds did not persist a repo cache, but clear any experimental/stale key just in case.
  localStorage.removeItem('gurutaku-dashboard-discovered-apps');

  try {
    const response = await fetch(`apps.json?_=${encodeURIComponent(BUILD)}-${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('apps.json unavailable');
    state.config = { ...FALLBACK_CONFIG, ...(await response.json()) };
  } catch (_) {
    state.config = FALLBACK_CONFIG;
  }

  const mode = state.config.discovery?.mode || 'hybrid';
  const shouldDiscover = state.config.discovery?.discoverGitHubPages !== false && mode !== 'manual';
  let discovered = [];
  state.discoveryWorked = false;
  if (shouldDiscover) {
    try {
      discovered = await discoverPagesRepos(state.config.site?.githubUser || 'gurutaku', state.config.discovery?.maxRepositories || 300);
      state.discoveryWorked = true;
    } catch (_) {
      discovered = [];
    }
  }

  state.apps = mergeApps({ ...state.config, manualApps: mode === 'auto' ? [] : (state.config.manualApps || []) }, discovered);
  renderAll();
}

$('searchInput').addEventListener('input', e => {
  state.query = e.target.value;
  renderApps();
});
$('clearFiltersBtn').addEventListener('click', () => {
  state.query = '';
  state.category = 'All Games';
  $('searchInput').value = '';
  renderAll();
});
$('refreshBtn').addEventListener('click', () => loadDashboard());
$('githubBtn').href = FALLBACK_CONFIG.site.githubUrl;

loadDashboard();
