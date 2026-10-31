/* ============ Site Koleksiyonum – Halka Açık ============ */

const DATA_URL = 'sites.json';

async function loadSites() {
  try {
    const res = await fetch(DATA_URL + '?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Veri yüklenemedi');
    const data = await res.json();
    return Array.isArray(data.sites) ? data.sites : [];
  } catch (e) {
    document.getElementById('status').textContent = 'Siteler yüklenemedi.';
    document.getElementById('status').classList.add('error');
    return [];
  }
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function safeText(s) { return s == null ? '' : String(s); }

function renderSites(sites) {
  const container = document.getElementById('siteList');
  const statusEl = document.getElementById('status');
  if (!sites.length) {
    container.innerHTML = '';
    statusEl.textContent = 'Henüz site eklenmemiş.';
    return;
  }
  statusEl.textContent = `${sites.length} site listeleniyor.`;
  container.innerHTML = '';

  for (const s of sites) {
    const card = document.createElement('div');
    card.className = 'card';

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
    a.href = s.url;               // doğrulanmış URL (admin'de kontrol ediliyor)
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = safeText(s.title);
    h3.appendChild(a);
    header.appendChild(h3);
    card.appendChild(header);

    const urlP = document.createElement('p');
    urlP.className = 'url';
    urlP.textContent = safeText(s.url);
    card.appendChild(urlP);

    if (s.category) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = safeText(s.category);
      card.appendChild(b);
    }
    if (s.description) {
      const d = document.createElement('p');
      d.className = 'desc';
      d.textContent = safeText(s.description);
      card.appendChild(d);
    }
    container.appendChild(card);
  }
}

function updateCategoryOptions(sites) {
  const select = document.getElementById('categoryFilter');
  const current = select.value;
  const cats = [...new Set(sites.map(s => s.category).filter(Boolean))].sort();
  select.innerHTML = '<option value="">Tüm Kategoriler</option>';
  for (const c of cats) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  }
  if (cats.includes(current)) select.value = current;
}

let allSites = [];

function applyFilters() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  const cat = document.getElementById('categoryFilter').value;
  let filtered = allSites;
  if (q) {
    filtered = filtered.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.url || '').toLowerCase().includes(q) ||
      (s.category || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  }
  if (cat) filtered = filtered.filter(s => s.category === cat);
  renderSites(filtered);
}

function initTheme() {
  if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme',
      document.body.classList.contains('dark') ? 'dark' : 'light');
  });
}

async function init() {
  initTheme();
  document.getElementById('search').addEventListener('input', applyFilters);
  document.getElementById('categoryFilter').addEventListener('change', applyFilters);
  allSites = await loadSites();
  updateCategoryOptions(allSites);
  renderSites(allSites);
}

init();