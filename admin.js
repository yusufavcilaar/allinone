const CONFIG = {
  owner: 'yusufavcilaar', // BURAYI KENDİNE GÖRE AYARLA
  repo: 'allinone',       // BURAYI KENDİNE GÖRE AYARLA
  branch: 'main',
  dataPath: 'sites.json'
};

const TOKEN_KEY = 'gh_pat_session';
const THEME_KEY = 'theme';
let currentSha = null, allSites = [], filteredSites = [];

const $ = (id) => document.getElementById(id);
const getDomain = (u) => { try { return new URL(u).hostname; } catch { return ''; } };

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

function confirmModal({ title, message }) {
  return new Promise((resolve) => {
    const overlay = $('confirmModal');
    if (!overlay) return resolve(false); // Element yoksa hata verme

    $('confirmTitle').textContent = title || 'Emin misiniz?';
    $('confirmMessage').textContent = message || 'Bu işlem geri alınamaz.';
    overlay.hidden = false;
    
    const cleanup = (val) => { overlay.hidden = true; resolve(val); };
    
    const newOkBtn = $('confirmOk').cloneNode(true);
    const newCancelBtn = $('confirmCancel').cloneNode(true);
    $('confirmOk').replaceWith(newOkBtn);
    $('confirmCancel').replaceWith(newCancelBtn);

    newOkBtn.onclick = () => cleanup(true);
    newCancelBtn.onclick = () => cleanup(false);
  });
}

async function ghGet() {
  const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataPath}?ref=${CONFIG.branch}`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` }
  });
  if (!res.ok) throw new Error('API Hatası: ' + res.status);
  const data = await res.json();
  currentSha = data.sha;
  // Base64 decode ve UTF-8 çözümü
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

function createFavicon(s) {
  const domain = getDomain(s.url);
  if (!domain) return null;
  const img = document.createElement('img');
  img.className = 'favicon';
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
  const c = $('siteList');
  if (!c) return;
  c.innerHTML = '';
  if (!sites.length) {
    c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">Henüz site yok.</div>`;
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
  const statTotal = $('statTotal');
  const statCategories = $('statCategories');
  if (statTotal) statTotal.textContent = allSites.length;
  if (statCategories) statCategories.textContent = new Set(allSites.map(s => s.category).filter(Boolean)).size;
}

function applyFilters() {
  let list = allSites.slice();
  const searchInput = $('adminSearch');
  const q = searchInput ? searchInput.value.toLowerCase() : '';
  
  if (q) list = list.filter(s => s.title.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
  filteredSites = list;
  renderSites(list);
  updateStats();
}

function resetForm() {
  const form = $('siteForm');
  if (form) form.reset();
  if ($('siteId')) $('siteId').value = '';
  if ($('submitBtn')) $('submitBtn').textContent = 'Kaydet';
  if ($('cancelEdit')) $('cancelEdit').style.display = 'none';
  if ($('formTitle')) $('formTitle').textContent = '➕ Yeni Site Ekle';
  if ($('descCounter')) $('descCounter').textContent = '0 / 300';
}

function startEdit(id) {
  const s = allSites.find(x => x.id === id);
  if (!s) return;
  if ($('siteId')) $('siteId').value = s.id;
  if ($('title')) $('title').value = s.title;
  if ($('url')) $('url').value = s.url;
  if ($('category')) $('category').value = s.category === 'Genel' ? '' : s.category;
  if ($('description')) $('description').value = s.description;
  if ($('submitBtn')) $('submitBtn').textContent = 'Güncelle';
  if ($('cancelEdit')) $('cancelEdit').style.display = 'inline-block';
  if ($('formTitle')) $('formTitle').textContent = '✏️ Siteyi Düzenle';
  if ($('descCounter')) $('descCounter').textContent = `${(s.description||'').length} / 300`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeSite(id) {
  const s = allSites.find(x => x.id === id);
  if (!s) return showToast('Site bulunamadı', 'error');

  const siteName = s.title ? `"${s.title}"` : 'Bu site';
  const ok = await confirmModal({ 
    title: 'Siteyi Sil', 
    message: `${siteName} kalıcı olarak silinecek. Emin misiniz?` 
  });
  
  if (!ok) return;

  try {
    await ghGet();
    allSites = allSites.filter(x => x.id !== id);
    await ghSave({ version: 1, updated: new Date().toISOString(), sites: allSites }, `Silindi: ${s.title || 'Bilinmeyen'}`);
    applyFilters();
    showToast('Site başarıyla silindi', 'success');
  } catch (e) { 
    showToast(e.message, 'error'); 
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = $('siteId') ? $('siteId').value : '';
  const title = $('title') ? $('title').value.trim() : '';
  const url = $('url') ? $('url').value.trim() : '';
  const category = $('category') ? ($('category').value.trim() || 'Genel') : 'Genel';
  const description = $('description') ? $('description').value.trim() : '';

  if(!title || !url) return showToast('Başlık ve URL zorunludur', 'error');

  const btn = $('submitBtn');
  try {
    if (btn) btn.disabled = true;
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
    showToast(id ? 'Site güncellendi' : 'Yeni site eklendi', 'success');
  } catch (err) { 
    showToast(err.message, 'error'); 
  }
  finally { 
    if (btn) btn.disabled = false; 
  }
}

async function login() {
  const t = $('patInput') ? $('patInput').value.trim() : '';
  if (!t) return;
  
  const btn = $('loginBtn');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Giriş Yapılıyor...'; }
    sessionStorage.setItem(TOKEN_KEY, t);
    const data = await ghGet();
    allSites = data.sites || [];
    
    if ($('loginSection')) $('loginSection').style.display = 'none';
    if ($('panelSection')) $('panelSection').style.display = 'block';
    if ($('logoutBtn')) $('logoutBtn').style.display = 'inline-block';
    
    applyFilters();
    showToast('Giriş başarılı', 'success');
  } catch (e) {
    sessionStorage.removeItem(TOKEN_KEY);
    if ($('loginError')) $('loginError').textContent = 'Geçersiz token! Detay: ' + e.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Giriş Yap'; }
  }
}

function init() {
  initTheme();
  
  if ($('loginBtn')) $('loginBtn').onclick = login;
  if ($('siteForm')) $('siteForm').onsubmit = handleSubmit;
  if ($('cancelEdit')) $('cancelEdit').onclick = resetForm;
  if ($('adminSearch')) $('adminSearch').oninput = applyFilters;
  if ($('logoutBtn')) $('logoutBtn').onclick = () => { sessionStorage.removeItem(TOKEN_KEY); location.reload(); };
  if ($('description')) $('description').oninput = (e) => {
    if ($('descCounter')) $('descCounter').textContent = `${e.target.value.length} / 300`;
  };
  
  if (sessionStorage.getItem(TOKEN_KEY)) login();
}

// DOM yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', init);
