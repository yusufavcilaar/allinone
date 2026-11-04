/* ============ Site Koleksiyonum – Public ============ */
const DATA_URL = 'sites.json';
const THEME_KEY = 'theme';

let allSites = [];
let filteredSites = [];
let state = { q: '', cat: '', sort: 'date-desc' };

/* ---------- Yardımcılar ---------- */
const $ = (id) => document.getElementById(id);
const debounce = (fn, ms = 150) => {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
const getDomain = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const safeText = (s) => (s == null ? '' : String(s));
const escapeHtml = (s) => safeText(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function highlight(text, q) {
  const t = safeText(text);
  if (!q) return escapeHtml(t);
  const qq = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${qq})`, 'gi');
  return escapeHtml(t).replace(re, '<mark>$1</mark>');
}

/* ---------- Toast ---------- */
function showToast(msg, type = '') {
  const c = $('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 350);
  }, 3200);
}

/* ---------- Tema ---------- */
function isDarkMode() {
  if (document.body.classList.contains('dark')) return true;
  if (document.body.classList.contains('light')) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function updateThemeIcon() {
  const btn = $('themeToggle');
  if (!btn) return;
  btn.textContent = isDarkMode() ? '☀️' : '🌙';
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') document.body.classList.add(saved);
  updateThemeIcon();
  $('themeToggle').addEventListener('click', () => {
    const nowDark = isDarkMode();
    document.body.classList.remove('dark', 'light');
    if (nowDark) {
      document.body.classList.add('light');
      localStorage.setItem(THEME_KEY, 'light');
    } else {
      document.body.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    }
    updateThemeIcon();
  });
}

/* ---------- Veri yükleme ---------- */
async function loadSites() {
  const res = await fetch(DATA_URL + '?v=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Veri yüklenemedi');
  const data = await res.json();
  return Array.isArray(data.sites) ? data.sites : [];
}

function showSkeletons(n = 6) {
  const c = $('siteList');
  c.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton';
    c.appendChild(s);
  }
}

/* ---------- Render ---------- */
function renderSites(sites) {
  const container = $('siteList');
  const statusEl = $('status');
  const resultCount = $('resultCount');
  const clearBtn = $('clearFilters');

  statusEl.textContent = '';
  statusEl.className = 'status';
  container.innerHTML = '';

  resultCount.textContent = sites.length;

  const hasFilter = state.q || state.cat;
  clearBtn.hidden = !hasFilter;

  if (!sites.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = hasFilter
      ? `<span class="empty-icon">🔍</span><h3>Sonuç bulunamadı</h3><p>Farklı bir arama veya kategori deneyin.</p>`
      : `<span class="empty-icon">📭</span><h3>Henüz site eklenmemiş</h3><p>Yakında burada siteler görünecek.</p>`;
    container.appendChild(empty);
    return;
  }

  sites.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.setProperty('--i', i);

    const header = document.createElement('div');
    header.className = 'card-header';

    const domain = getDomain(s.url);
    if (domain) {
      const img = document.createElement('img');
      img.className = 'favicon';
      img.alt = '';
      img.loading = 'lazy';
      img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
      img.onerror = () => img.remove();
      header.appendChild(img);
    }

    const h3 = document.createElement('h3');
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = highlight(s.title, state.q);
    h3.appendChild(a);
    header.appendChild(h3);
    card.appendChild(header);

    const urlP = document.createElement('p');
    urlP.className = 'url';
    urlP.innerHTML = highlight(s.url, state.q);
    card.appendChild(urlP);

    if (s.category) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.innerHTML = highlight(s.category, state.q);
      card.appendChild(b);
    }
    if (s.description) {
      const d = document.createElement('p');
      d.className = 'desc';
      d.innerHTML = highlight(s.description, state.q);
      card.appendChild(d);
    }
    container.appendChild(card);
  });
}

/* ---------- Filtreler ---------- */
function applyFilters() {
  const q = state.q.toLowerCase().trim();
  let list = allSites.slice();

  if (q) {
    list = list.filter(s =>
      safeText(s.title).toLowerCase().includes(q) ||
      safeText(s.url).toLowerCase().includes(q) ||
      safeText(s.category).toLowerCase().includes(q) ||
      safeText(s.description).toLowerCase().includes(q)
    );
  }
  if (state.cat) list = list.filter(s => s.category === state.cat);

  switch (state.sort) {
    case 'title-asc': list.sort((a, b) => safeText(a.title).localeCompare(safeText(b.title), 'tr')); break;
    case 'title-desc': list.sort((a, b) => safeText(b.title).localeCompare(safeText(a.title), 'tr')); break;
    case 'date-asc': list.sort((a, b) => safeText(a.createdAt).localeCompare(safeText(b.createdAt))); break;
    case 'date-desc':
    default: list.sort((a, b) => safeText(b.createdAt).localeCompare(safeText(a.createdAt))); break;
  }

  filteredSites = list;
  renderSites(list);
  syncUrl();
}

function renderChips() {
  const wrap = $('categoryChips');
  const cats = [...new Set(allSites.map(s => s.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  wrap.innerHTML = '';
  if (!cats.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';

  const mk = (label, value) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (state.cat === value ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      state.cat = (state.cat === value && value !== '') ? '' : value;
      renderChips();
      applyFilters();
    });
    return btn;
  };

  wrap.appendChild(mk('Tümü', ''));
  cats.forEach(c => wrap.appendChild(mk(c, c)));
}

/* ---------- İstatistikler ---------- */
function updateStats() {
  $('statTotal').textContent = allSites.length;
  const cats = new Set(allSites.map(s => s.category).filter(Boolean));
  $('statCategories').textContent = cats.size;
}

/* ---------- URL state ---------- */
function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.cat) p.set('cat', state.cat);
  if (state.sort && state.sort !== 'date-desc') p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}
function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') || '';
  state.cat = p.get('cat') || '';
  state.sort = p.get('sort') || 'date-desc';
}

/* ---------- Back to top ---------- */
function initBackToTop() {
  const btn = $('backToTop');
  const onScroll = () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ---------- Init ---------- */
async function init() {
  initTheme();
  $('year').textContent = new Date().getFullYear();
  initBackToTop();
  readUrl();

  const search = $('search');
  search.value = state.q;
  $('sortBy').value = state.sort;

  search.addEventListener('input', debounce((e) => {
    state.q = e.target.value;
    applyFilters();
  }, 120));

  $('sortBy').addEventListener('change', (e) => {
    state.sort = e.target.value;
    applyFilters();
  });

  $('clearFilters').addEventListener('click', () => {
    state.q = ''; state.cat = '';
    search.value = '';
    renderChips();
    applyFilters();
  });

  // Ctrl+K / Escape kısayolları
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      search.focus();
      search.select();
    }
    if (e.key === 'Escape' && document.activeElement === search && search.value) {
      search.value = '';
      state.q = '';
      applyFilters();
    }
  });

  // İskelet → veri
  showSkeletons();
  try {
    allSites = await loadSites();
    updateStats();
    renderChips();
    applyFilters();
  } catch (e) {
    $('siteList').innerHTML = '';
    const p = $('status');
    p.textContent = 'Siteler yüklenemedi.';
    p.className = 'status error';
    showToast('Veri yüklenemedi', 'error');
  }
}

init();
