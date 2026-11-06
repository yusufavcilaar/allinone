const DATA_URL = 'sites.json';
let allSites = [], state = { q: '', cat: '', sort: 'date-desc' };

const $ = (id) => document.getElementById(id);
const getDomain = (u) => { try { return new URL(u).hostname; } catch { return ''; } };

function initTheme() {
  if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
  $('themeToggle').onclick = () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  };
}

function createFavicon(s) {
  const domain = getDomain(s.url);
  if (!domain) return null;
  const img = document.createElement('img');
  img.className = 'favicon';
  img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  img.onerror = () => {
    const f = document.createElement('div');
    f.className = 'favicon-fallback';
    f.textContent = (s.title || '?').charAt(0).toUpperCase();
    img.replaceWith(f);
  };
  return img;
}

function renderSites(sites) {
  const c = $('siteList');
  c.innerHTML = '';
  if (!sites.length) {
    c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">Sonuç bulunamadı.</div>`;
    return;
  }

  sites.forEach(s => {
    const card = document.createElement('div');
    card.className = 'card';
    
    const header = document.createElement('div');
    header.className = 'card-header';
    const fav = createFavicon(s);
    if (fav) header.appendChild(fav);
    
    const h3 = document.createElement('h3');
    const a = document.createElement('a');
    a.href = s.url; a.target = '_blank'; a.textContent = s.title;
    h3.appendChild(a); header.appendChild(h3);
    card.appendChild(header);

    const urlP = document.createElement('p');
    urlP.className = 'url'; urlP.textContent = s.url;
    card.appendChild(urlP);

    if (s.category) {
      const b = document.createElement('span');
      b.className = 'badge'; b.textContent = s.category;
      card.appendChild(b);
    }
    if (s.description) {
      const d = document.createElement('p');
      d.className = 'desc'; d.textContent = s.description;
      card.appendChild(d);
    }
    c.appendChild(card);
  });
}

function applyFilters() {
  let list = allSites.slice();
  const q = state.q.toLowerCase().trim();
  if (q) {
    list = list.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.url.toLowerCase().includes(q) || 
      (s.category && s.category.toLowerCase().includes(q)) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  }
  if (state.cat) list = list.filter(s => s.category === state.cat);
  
  if (state.sort === 'title-asc') list.sort((a,b) => a.title.localeCompare(b.title));
  else if (state.sort === 'title-desc') list.sort((a,b) => b.title.localeCompare(a.title));
  else if (state.sort === 'date-asc') list.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
  else list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  renderSites(list);
}

function renderChips() {
  const wrap = $('categoryChips');
  const cats = [...new Set(allSites.map(s => s.category).filter(Boolean))];
  wrap.innerHTML = '';
  if (!cats.length) return;
  
  const mk = (label, val) => {
    const btn = document.createElement('button');
    btn.className = `badge ${state.cat === val ? 'active' : ''}`;
    btn.textContent = label;
    btn.style.cursor = 'pointer';
    btn.onclick = () => { state.cat = val; renderChips(); applyFilters(); };
    return btn;
  };
  wrap.appendChild(mk('Tümü', ''));
  cats.forEach(c => wrap.appendChild(mk(c, c)));
}

async function init() {
  initTheme();
  try {
    const res = await fetch(DATA_URL + '?v=' + Date.now());
    const data = await res.json();
    allSites = data.sites || [];
    renderChips();
    applyFilters();
    
    $('search').oninput = (e) => { state.q = e.target.value; applyFilters(); };
    $('sortBy').onchange = (e) => { state.sort = e.target.value; applyFilters(); };
  } catch (e) {
    $('siteList').innerHTML = `<div style="text-align:center;padding:2rem;color:red;">Veri yüklenemedi.</div>`;
  }
}
init();
