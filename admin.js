/* ============ Admin Paneli – Güvenli Mod ============ */

const CONFIG = {
  owner: 'yusufavcilaar',      // <- değiştir
  repo: 'allinone',                // <- değiştir
  branch: 'main',
  dataPath: 'sites.json',
  idleTimeoutMs: 15 * 60 * 1000,
};

const TOKEN_KEY = 'gh_pat_session';
let currentSha = null;
let allSites = [];
let idleTimer = null;

/* ---------- Token ---------- */
function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t); resetIdle(); }
function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

/* ---------- Inactivity logout ---------- */
function resetIdle() {
  clearTimeout(idleTimer);
  if (!getToken()) return;
  idleTimer = setTimeout(() => {
    clearToken();
    alert('Güvenlik için oturum kapatıldı.');
    location.reload();
  }, CONFIG.idleTimeoutMs);
}
['mousemove','keydown','click','touchstart'].forEach(ev =>
  document.addEventListener(ev, resetIdle, { passive: true })
);

/* ---------- GitHub API ---------- */
function ghHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghGetFile() {
  const t = getToken();
  if (!t) throw new Error('Oturum yok');
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataPath}?ref=${CONFIG.branch}`;
  const res = await fetch(url, { headers: ghHeaders(t) });
  if (res.status === 401) throw new Error('Token geçersiz veya süresi dolmuş.');
  if (res.status === 404) throw new Error('Repo/dosya bulunamadı. CONFIG ayarlarını kontrol edin.');
  if (!res.ok) throw new Error('GitHub API hatası: ' + res.status);
  const data = await res.json();
  currentSha = data.sha;
  const bin = atob(data.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function ghSaveFile(payload, message) {
  const t = getToken();
  if (!t) throw new Error('Oturum yok');
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dataPath}`;
  const text = JSON.stringify(payload, null, 2);
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  const b64 = btoa(bin);

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(t), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: b64,
      sha: currentSha,
      branch: CONFIG.branch,
    }),
  });
  if (res.status === 409) throw new Error('Çakışma var. Sayfayı yenileyip tekrar deneyin.');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Kaydetme başarısız');
  }
  const result = await res.json();
  currentSha = result.content.sha;
}

/* ---------- Doğrulamalar ---------- */
function isValidHttpUrl(u) {
  try {
    const p = new URL(u);
    return (p.protocol === 'https:' || p.protocol === 'http:') && !p.username && !p.password;
  } catch { return false; }
}

/* ---------- Görünüm ---------- */
function showPanel() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('panelSection').style.display = 'block';
  document.getElementById('logoutBtn').style.display = 'inline-block';
}
function showLogin() {
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('panelSection').style.display = 'none';
  document.getElementById('logoutBtn').style.display = 'none';
}

function getDomain(u) { try { return new URL(u).hostname; } catch { return ''; } }

function renderSites() {
  const container = document.getElementById('siteList');
  container.innerHTML = '';
  if (!allSites.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Henüz site yok.';
    container.appendChild(p);
    return;
  }
  for (const s of allSites) {
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
    a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = s.title || '';
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

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'secondary';
    editBtn.textContent = 'Düzenle';
    editBtn.addEventListener('click', () => startEdit(s.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Sil';
    delBtn.addEventListener('click', () => removeSite(s.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);
    container.appendChild(card);
  }
}

function setStatus(msg, kind = '') {
  const el = document.getElementById('panelStatus');
  el.className = 'status ' + kind;
  el.textContent = msg || '';
}

/* ---------- CRUD ---------- */
function resetForm() {
  document.getElementById('siteForm').reset();
  document.getElementById('siteId').value = '';
  document.getElementById('submitBtn').textContent = 'Ekle';
  document.getElementById('cancelEdit').style.display = 'none';
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('siteId').value;
  const title = document.getElementById('title').value.trim();
  const url = document.getElementById('url').value.trim();
  const category = document.getElementById('category').value.trim() || 'Genel';
  const description = document.getElementById('description').value.trim();

  if (!isValidHttpUrl(url)) {
    setStatus('Geçerli bir http/https URL girin.', 'error');
    return;
  }

  try {
    setStatus('Kaydediliyor...');
    const data = await ghGetFile();
    const list = Array.isArray(data.sites) ? data.sites : [];

    if (id) {
      const idx = list.findIndex(s => s.id === id);
      if (idx === -1) throw new Error('Kayıt bulunamadı');
      list[idx] = { ...list[idx], title, url, category, description,
                    updatedAt: new Date().toISOString() };
    } else {
      list.push({
        id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
        title, url, category, description,
        createdAt: new Date().toISOString(),
      });
    }

    await ghSaveFile(
      { version: 1, updated: new Date().toISOString(), sites: list },
      id ? `Site güncellendi: ${title}` : `Yeni site: ${title}`
    );

    allSites = list;
    renderSites();
    resetForm();
    setStatus('Kaydedildi ✓', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function startEdit(id) {
  const s = allSites.find(x => x.id === id);
  if (!s) return;
  document.getElementById('siteId').value = s.id;
  document.getElementById('title').value = s.title || '';
  document.getElementById('url').value = s.url || '';
  document.getElementById('category').value = s.category === 'Genel' ? '' : (s.category || '');
  document.getElementById('description').value = s.description || '';
  document.getElementById('submitBtn').textContent = 'Güncelle';
  document.getElementById('cancelEdit').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeSite(id) {
  const s = allSites.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`"${s.title}" silinsin mi?`)) return;
  try {
    setStatus('Siliniyor...');
    const data = await ghGetFile();
    const list = (data.sites || []).filter(x => x.id !== id);
    await ghSaveFile(
      { version: 1, updated: new Date().toISOString(), sites: list },
      `Site silindi: ${s.title}`
    );
    allSites = list;
    renderSites();
    setStatus('Silindi ✓', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

/* ---------- Giriş / Çıkış ---------- */
async function login() {
  const token = document.getElementById('patInput').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!token) { errEl.textContent = 'Token gerekli.'; return; }
  document.getElementById('loginBtn').disabled = true;
  try {
    setToken(token);
    const data = await ghGetFile();       // doğrulama testi
    allSites = Array.isArray(data.sites) ? data.sites : [];
    renderSites();
    showPanel();
    setStatus(`${allSites.length} site yüklendi.`, 'success');
  } catch (err) {
    clearToken();
    errEl.textContent = err.message;
  } finally {
    document.getElementById('loginBtn').disabled = false;
  }
}

function logout() {
  clearToken();
  location.reload();
}

/* ---------- Başlat ---------- */
async function init() {
  if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');

  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('patInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('siteForm').addEventListener('submit', handleSubmit);
  document.getElementById('cancelEdit').addEventListener('click', resetForm);

  // Token varsa otomatik giriş dene
  if (getToken()) {
    try {
      const data = await ghGetFile();
      allSites = Array.isArray(data.sites) ? data.sites : [];
      renderSites();
      showPanel();
    } catch {
      clearToken();
      showLogin();
    }
  } else {
    showLogin();
  }
}

init();
