const DATA_URL = 'sites.json';
const THEME_KEY = 'theme';
let allSites = [], state = { q: '', cat: '', sort: 'date-desc' };

const $ = (id) => document.getElementById(id);
const getDomain = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const safeText = (s) => (s == null ? '' : String(s));

function showToast(msg, type = '') {
  const c = $('toastContainer');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function initTheme() {
  if (localStorage.getItem(THEME_KEY) === 'dark') document.body.classList.add('dark');
  const btn = $('themeToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
    });
  }
}

function createFavicon(s) {
  const domain = getDomain(s.url);
  if (!domain) return null;
  const img = document.createElement('img');
  img.className = 'favicon';
  img.alt = '';
  img.loading = 'lazy';
  img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  img.onerror = () => {
    const f = document.createElement('div');
    f.className = 'favicon-fallback';
    f.textContent = (s.title || '?').charAt(0).toUpperCase();
    img.replaceWith(f);
  };
  return img;
}

function renderSites(sites) {
  const container = $('siteList');
  const resultCount = $('resultCount');
  
  if (resultCount) resultCount.textContent = sites.length;
  if (!container) return;
  
  container.innerHTML = '';

  if (!sites.length) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">Sonuç bulunamadı.</div>`;
    return;
  }

  sites.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = `${i * 40}ms`;

    const header = document.createElement('div');
    header.className = 'card-header';
    const fav = createFavicon(s);
    if (fav) header.appendChild(fav);

    const h3 = document.createElement('h3');
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.textContent = s.title;
    h3.appendChild(a);
    header.appendChild(h3);
    card.appendChild(header);

    const urlP = document.createElement('p');
    urlP.className = 'url';
    urlP.textContent = s.url;
    card.appendChild(urlP);

    if (s.category) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = s.category;
      card.appendChild(b);
    }

    if (s.description) {
      const d = document.createElement('p');
      d.className = 'desc';
      d.textContent = s.description;
      card.appendChild(d);
    }

    container.appendChild(card);
  });
}

function applyFilters() {
  let list = allSites.slice();
  const searchVal = $('search') ? $('search').value : '';
  const q = searchVal.toLowerCase().trim();
  
  if (q) {
    list = list.filter(s => 
      safeText(s.title).toLowerCase().includes(q) || 
      safeText(s.description).toLowerCase().includes(q) ||
      safeText(s.url).toLowerCase().includes(q)
    );
  }
  
  if (state.cat) list = list.filter(s => s.category === state.cat);
  
  if (state.sort === 'title-asc') list.sort((a,b) => safeText(a.title).localeCompare(safeText(b.title)));
  else if (state.sort === 'title-desc') list.sort((a,b) => safeText(b.title).localeCompare(safeText(a.title)));
  else list.sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));

  renderSites(list);
}

function renderChips() {
  const wrap = $('categoryChips');
  if (!wrap) return;
  const cats = [...new Set(allSites.map(s => s.category).filter(Boolean))];
  wrap.innerHTML = '';
  if (!cats.length) { wrap.style.display = 'none'; return; }
  
  const mk = (label, val) => {
    const btn = document.createElement('button');
    btn.className = `chip ${state.cat === val ? 'active' : ''}`;
    btn.textContent = label;
    btn.onclick = () => { state.cat = val; renderChips(); applyFilters(); };
    return btn;
  };
  wrap.appendChild(mk('Tümü', ''));
  cats.forEach(c => wrap.appendChild(mk(c, c)));
}

async function init() {
  initTheme();
  
  const searchInput = $('search');
  if (searchInput) searchInput.addEventListener('input', (e) => { state.q = e.target.value; applyFilters(); });
  
  const sortSelect = $('sortBy');
  if (sortSelect) sortSelect.addEventListener('change', (e) => { state.sort = e.target.value; applyFilters(); });

  try {
    const res = await fetch(DATA_URL + '?v=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allSites = data.sites || [];
    renderChips();
    applyFilters();
  } catch (e) {
    console.error(e);
    const container = $('siteList');
    if (container) {
      container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#ef4444;border:1px dashed #ef4444;border-radius:12px;">Siteler yüklenemedi! Lütfen sites.json dosyanızın formatını kontrol edin.<br><br><small>Hata: ${e.message}</small></div>`;
    }
  }
}

// DOM yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', init);
