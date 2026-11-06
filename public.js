const DATA_URL = 'sites.json';
let allSites = [], state = { q: '', cat: '', sort: 'date-desc' };

const $ = (id) => document.getElementById(id);

function initTheme() {
  if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
  $('themeToggle').onclick = () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  };
}

// 🔥 ANA SAYFA İÇİN İKON ÇEKME MANTIĞI
// 1. Sitenin kendi dizinindeki favicon.ico'yu arar (örn: site.com/nickstudio/favicon.ico)
// 2. Bulamazsa ana dizini arar (örn: site.com/favicon.ico)
// 3. Bulamazsa Google servisini dener
// 4. O da olmazsa baş harfi (N, S) gösterir.
function createFaviconContainer(s) {
  const container = document.createElement('div');
  container.className = 'favicon-container';
  
  if (!s.url) {
    container.innerHTML = `<div class="favicon-fallback">${(s.title || '?').charAt(0).toUpperCase()}</div>`;
    return container;
  }

  try {
    const urlObj = new URL(s.url);
    const img = document.createElement('img');
    img.alt = 'icon';
    
    // 1. Aşama: URL'nin kendi klasöründeki favicon
    const path = urlObj.pathname.endsWith('/') ? urlObj.pathname : urlObj.pathname + '/';
    img.src = `${urlObj.origin}${path}favicon.ico`;
    
    img.onerror = () => {
      // 2. Aşama: Domain'in kök dizinindeki favicon
      img.onerror = () => {
        // 3. Aşama: Google Favicon API
        img.onerror = () => {
          // 4. Aşama: Baş harf (Fallback)
          container.innerHTML = `<div class="favicon-fallback">${(s.title || '?').charAt(0).toUpperCase()}</div>`;
        };
        img.src = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
      };
      img.src = `${urlObj.origin}/favicon.ico`;
    };
    
    container.appendChild(img);
  } catch(e) {
    container.innerHTML = `<div class="favicon-fallback">${(s.title || '?').charAt(0).toUpperCase()}</div>`;
  }
  
  return container;
}

function renderSites(sites) {
  const c = $('siteList');
  c.innerHTML = '';
  if (!sites.length) {
    c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">Sonuç bulunamadı.</div>`;
    return;
  }

  sites.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = `${i * 50}ms`;
    
    const header = document.createElement('div');
    header.className = 'card-header';
    
    // İkonu buraya ekliyoruz
    header.appendChild(createFaviconContainer(s));
    
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
    btn.className = `badge`;
    if (state.cat === val) btn.style.background = 'var(--primary)', btn.style.color = 'white';
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
    $('siteList').innerHTML = `<div style="text-align:center;padding:2rem;color:var(--danger);">Veri yüklenemedi.</div>`;
  }
}
init();
