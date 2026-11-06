const CONFIG = {
  owner: 'yusufavcilaar', // BURAYI KENDİNE GÖRE AYARLA
  repo: 'allinone',       // BURAYI KENDİNE GÖRE AYARLA
  branch: 'main',
  dataPath: 'sites.json'
};

const TOKEN_KEY = 'gh_pat_session';
let currentSha = null, allSites = [];

const $ = (id) => document.getElementById(id);
const getDomain = (u) => { try { return new URL(u).hostname; } catch { return ''; } };

function showToast(msg, type = '') {
  const c = $('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

function initTheme() {
  if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
  $('themeToggle').onclick = () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  };
}

// Şık ve Modern Silme Modalı
function confirmModal(message) {
  return new Promise((resolve) => {
    const overlay = $('confirmModal');
    $('confirmMessage').textContent = message;
    overlay.classList.add('active');
    
    const cleanup = (val) => { overlay.classList.remove('active'); resolve(val); };
    
    const newOk = $('confirmOk').cloneNode(true);
    const newCancel = $('confirmCancel').cloneNode(true);
    $('confirmOk').replaceWith(newOk);
    $('confirmCancel').replaceWith(newCancel);

    newOk.onclick = () => cleanup(true);
    newCancel.onclick = () => cleanup(false);
  });
}

async function ghGet() {
  const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataPath}?ref=${CONFIG.branch}`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` }
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'Token geçersiz' : 'API Hatası');
  const data = await res.json();
  currentSha = data.sha;
  return JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
}

async function ghSave(payload, msg) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
  const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataPath}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem(TOKEN_KEY)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, content: b64, sha: currentSha, branch: CONFIG.branch })
  });
  if (!res.ok) throw new Error('Kaydetme başarısız');
  currentSha = (await res.json()).content.sha;
}

// 🔥 GÜNCEL FAVICON MANTIĞI (Admin İçin)
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
    
    const path = urlObj.pathname.endsWith('/') ? urlObj.pathname : urlObj.pathname + '/';
    img.src = `${urlObj.origin}${path}favicon.ico`;
    
    img.onerror = () => {
      img.onerror = () => {
        img.onerror = () => {
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
    c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">Kayıtlı site yok.</div>`;
    return;
  }

  sites.forEach(s => {
    const card = document.createElement('div');
    card.className = 'card';
    
    const header = document.createElement('div');
    header.className = 'card-header';
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

    const actions = document.createElement('div');
    actions.style = "display:flex; gap:0.5rem; margin-top:auto; border-top:1px solid var(--border); padding-top:1rem;";
    
    const edit = document.createElement('button');
    edit.className = 'secondary'; edit.textContent = '✏️ Düzenle'; edit.style.flex = '1';
    edit.onclick = () => startEdit(s.id);
    
    const del = document.createElement('button');
    del.className = 'danger'; del.textContent = '🗑️ Sil'; del.style.flex = '1';
    del.onclick = () => removeSite(s.id);

    actions.appendChild(edit); actions.appendChild(del);
    card.appendChild(actions);
    c.appendChild(card);
  });
}

function updateStats() {
  $('statTotal').textContent = allSites.length;
  $('statCategories').textContent = new Set(allSites.map(s => s.category).filter(Boolean)).size;
}

function applyFilters() {
  let list = allSites.slice();
  const q = $('adminSearch').value.toLowerCase();
  if (q) list = list.filter(s => s.title.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
  renderSites(list);
  updateStats();
}

function resetForm() {
  $('siteForm').reset();
  $('siteId').value = '';
  $('submitBtn').textContent = 'Kaydet';
  $('cancelEdit').style.display = 'none';
}

function startEdit(id) {
  const s = allSites.find(x => x.id === id);
  if (!s) return;
  $('siteId').value = s.id;
  $('title').value = s.title;
  $('url').value = s.url;
  $('category').value = s.category === 'Genel' ? '' : s.category;
  $('description').value = s.description;
  $('submitBtn').textContent = 'Güncelle';
  $('cancelEdit').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeSite(id) {
  const s = allSites.find(x => x.id === id);
  if (!s) return;

  const ok = await confirmModal(`"${s.title}" silinecek. Bu işlem geri alınamaz.`);
  if (!ok) return;

  try {
    await ghGet();
    allSites = allSites.filter(x => x.id !== id);
    await ghSave({ version: 1, updated: new Date().toISOString(), sites: allSites }, `Silindi: ${s.title}`);
    applyFilters();
    showToast('Silindi', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = $('siteId').value;
  const title = $('title').value.trim();
  const url = $('url').value.trim();
  const category = $('category').value.trim() || 'Genel';
  const description = $('description').value.trim();

  try {
    $('submitBtn').disabled = true;
    await ghGet();
    
    if (id) {
      const idx = allSites.findIndex(s => s.id === id);
      allSites[idx] = { ...allSites[idx], title, url, category, description };
    } else {
      allSites.push({ id: crypto.randomUUID(), title, url, category, description, createdAt: new Date().toISOString() });
    }
    
    await ghSave({ version: 1, updated: new Date().toISOString(), sites: allSites }, id ? 'Güncellendi' : 'Eklendi');
    applyFilters();
    resetForm();
    showToast('Kaydedildi', 'success');
  } catch (err) { 
    showToast(err.message, 'error'); 
  } finally { 
    $('submitBtn').disabled = false; 
  }
}

async function login() {
  const t = $('patInput').value.trim();
  if (!t) return;
  sessionStorage.setItem(TOKEN_KEY, t);
  try {
    const data = await ghGet();
    allSites = data.sites || [];
    $('loginSection').style.display = 'none';
    $('panelSection').style.display = 'block';
    $('logoutBtn').style.display = 'inline-block';
    applyFilters();
    showToast('Giriş başarılı', 'success');
  } catch (e) {
    sessionStorage.removeItem(TOKEN_KEY);
    $('loginError').textContent = 'Geçersiz token veya repo bulunamadı!';
  }
}

function init() {
  initTheme();
  $('loginBtn').onclick = login;
  $('siteForm').onsubmit = handleSubmit;
  $('cancelEdit').onclick = resetForm;
  $('adminSearch').oninput = applyFilters;
  $('logoutBtn').onclick = () => { sessionStorage.removeItem(TOKEN_KEY); location.reload(); };
  
  if (sessionStorage.getItem(TOKEN_KEY)) login();
}
init();
