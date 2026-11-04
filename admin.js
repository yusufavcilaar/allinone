/* ============ Admin Paneli – Güvenli Mod v2 ============ */

const CONFIG = {
  owner: 'yusufavcilaar',
  repo: 'allinone',
  branch: 'main',
  dataPath: 'sites.json',
  idleTimeoutMs: 15 * 60 * 1000,
};

const TOKEN_KEY = 'gh_pat_session';
const THEME_KEY = 'theme';

let currentSha = null;
let allSites = [];
let filteredSites = [];
let idleTimer = null;
let adminState = { q: '', sort: 'date-desc' };

/* ---------- Yardımcılar ---------- */
const $ = (id) => document.getElementById(id);
const debounce = (fn, ms = 150) => {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
const getDomain = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const safeText = (s) => (s == null ? '' : String(s));

function isValidHttpUrl(u) {
  try {
    const p = new URL(u);
    return (p.protocol === 'https:' || p.protocol === 'http:')
      && p.hostname.includes('.')
      && !p.username
      && !p.password;
  } catch { return false; }
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

/* ---------- Confirm Modal (Promise) ---------- */
function confirmModal({ title = 'Onayla', message = '', okLabel = 'Tamam', danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = $('confirmModal');
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    const okBtn = $('confirmOk');
    okBtn.textContent = okLabel;
    okBtn.className = danger ? 'danger' : '';
    overlay.hidden = false;

    const cleanup = (val) => {
      overlay.hidden = true;
      okBtn.removeEventListener('click', onOk);
      $('confirmCancel').removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlay = (e) => { if (e.target === overlay) cleanup(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };

    okBtn.addEventListener('click', onOk);
    $('confirmCancel').addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  });
}

/* ---------- Tema ---------- */
function isDarkMode() {
  if (document.body.classList.contains('dark')) return true;
  if (document.body.classList.contains('light')) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function updateThemeIcon() {
  const btn = $('themeToggle');
  if (btn) btn.textContent = isDarkMode() ? '☀️' : '🌙';
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

/* ---------- Token ---------- */
function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t); resetIdle(); }
function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

/* ---------- Idle logout ---------- */
function resetIdle() {
  clearTimeout(idleTimer);
  if (!getToken()) return;
  idleTimer = setTimeout(() => {
    clearToken();
    showToast('Güvenlik için oturum kapatıldı.', 'error');
    setTimeout(() => location.reload(), 800);
  }, CONFIG.idleTimeoutMs);
}
['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev =>
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

/* ---------- Görünüm ---------- */
function showPanel() {
  $('loginSection').style.display = 'none';
  $('panelSection').style.display = 'block';
  $('logoutBtn').style.display = 'inline-flex';
}
function showLogin() {
  $('loginSection').style.display = 'block';
  $('panelSection').style.display = 'none';
  $('logoutBtn').style.display = 'none';
}

function setStatus(msg, kind = '') {
  const el = $('panelStatus');
  el.className = 'status ' + kind;
  el.textContent = msg || '';
}

/* ---------- İstatistikler ---------- */
function updateStats() {
  $('statTotal').textContent = allSites.length;
  const cats = new Set(allSites.map(s => s.category).filter(Boolean));
  $('statCategories').textContent = cats.size;
  $('statVisible').textContent = filteredSites.length;
}

/* ---------- Render ---------- */
function applyAdminFilters() {
  const q = adminState.q.toLowerCase().trim();
  let list = allSites.slice();
  if (q) {
    list = list.filter(s =>
      safeText(s.title).toLowerCase().includes(q) ||
      safeText(s.url).toLowerCase().includes(q) ||
      safeText(s.category).toLowerCase().includes(q) ||
      safeText(s.description).toLowerCase().includes(q)
    );
  }
  switch (adminState.sort) {
    case 'title-asc': list.sort((a, b) => safeText(a.title).localeCompare(safeText(b.title), 'tr')); break;
    case 'title-desc': list.sort((a, b) => safeText(b.title).localeCompare(safeText(a.title), 'tr')); break;
    case 'date-asc': list.sort((a, b) => safeText(a.createdAt).localeCompare(safeText(b.createdAt))); break;
    default: list.sort((a, b) => safeText(b.createdAt).localeCompare(safeText(a.createdAt)));
  }
  filteredSites = list;
  renderSites(list);
  updateStats();
}

function renderSites(sites) {
  const container = $('siteList');
  container.innerHTML = '';

  if (!sites.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = allSites.length
      ? `<span class="empty-icon">🔍</span><h3>Sonuç yok</h3><p>Aramanızla eşleşen site bulunamadı.</p>`
      : `<span class="empty-icon">📝</span><h3>Henüz site yok</h3><p>Yukarıdaki formdan ilk sitenizi ekleyin.</p>`;
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
    editBtn.textContent = '✏️ Düzenle';
    editBtn.addEventListener('click', () => startEdit(s.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = '🗑️ Sil';
    delBtn.addEventListener('click', () => removeSite(s.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

/* ---------- Form ---------- */
function resetForm() {
  $('siteForm').reset();
  $('siteId').value = '';
  $('submitBtn').textContent = 'Ekle';
  $('cancelEdit').style.display = 'none';
  updateDescCounter();
}

function updateDescCounter() {
  const len = $('description').value.length;
  const el = $('descCounter');
  el.textContent = `${len} / 300`;
  el.classList.toggle('over', len > 300);
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = $('siteId').value;
  const title = $('title').value.trim();
  const url = $('url').value.trim();
  const category = $('category').value.trim() || 'Genel';
  const description = $('description').value.trim();

  if (!title) return setStatus('Başlık gerekli.', 'error');
  if (!isValidHttpUrl(url)) return setStatus('Geçerli bir http/https URL girin.', 'error');
  if (description.length > 300) return setStatus('Açıklama 300 karakteri geçemez.', 'error');

  try {
    setStatus('Kaydediliyor...');
    $('submitBtn').disabled = true;

    const data = await ghGetFile();
    const list = Array.isArray(data.sites) ? data.sites : [];

    // Duplicate URL kontrolü (kendi id'si hariç)
    const dup = list.find(s => s.url === url && s.id !== id);
    if (dup) {
      $('submitBtn').disabled = false;
      return setStatus(`Bu URL zaten kayıtlı: "${dup.title}"`, 'error');
    }

    if (id) {
      const idx = list.findIndex(s => s.id === id);
      if (idx === -1) throw new Error('Kayıt bulunamadı');
      list[idx] = {
        ...list[idx], title, url, category, description,
        updatedAt: new Date().toISOString(),
      };
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
    applyAdminFilters();
    resetForm();
    setStatus('Kaydedildi ✓', 'success');
    showToast(id ? 'Site güncellendi' : 'Yeni site eklendi', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
    showToast(err.message, 'error');
  } finally {
    $('submitBtn').disabled = false;
  }
}

function startEdit(id) {
  const s = allSites.find(x => x.id === id);
  if (!s) return;
  $('siteId').value = s.id;
  $('title').value = s.title || '';
  $('url').value = s.url || '';
  $('category').value = s.category === 'Genel' ? '' : (s.category || '');
  $('description').value = s.description || '';
  $('submitBtn').textContent = 'Güncelle';
  $('cancelEdit').style.display = 'inline-block';
  updateDescCounter();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  $('title').focus();
}

async function removeSite(id) {
  const s = allSites.find(x => x.id === id);
  if (!s) return;

  const ok = await confirmModal({
    title: 'Siteyi sil?',
    message: `"${s.title}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
    okLabel: 'Sil',
    danger: true,
  });
  if (!ok) return;

  try {
    setStatus('Siliniyor...');
    const data = await ghGetFile();
    const list = (data.sites || []).filter(x => x.id !== id);
    await ghSaveFile(
      { version: 1, updated: new Date().toISOString(), sites: list },
      `Site silindi: ${s.title}`
    );
    allSites = list;
    applyAdminFilters();
    setStatus('Silindi ✓', 'success');
    showToast('Site silindi', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
    showToast(err.message, 'error');
  }
}

/* ---------- Giriş / Çıkış ---------- */
async function login() {
  const token = $('patInput').value.trim();
  const errEl = $('loginError');
  errEl.textContent = '';

  if (!token) { errEl.textContent = 'Token gerekli.'; return; }
  if (!token.startsWith('github_pat_') && !token.startsWith('ghp_')) {
    errEl.textContent = 'Token formatı geçersiz görünüyor.';
    return;
  }

  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'Giriş yapılıyor...';

  try {
    setToken(token);
    const data = await ghGetFile();
    allSites = Array.isArray(data.sites) ? data.sites : [];
    applyAdminFilters();
    showPanel();
    setStatus(`${allSites.length} site yüklendi.`, 'success');
    showToast('Giriş başarılı', 'success');
  } catch (err) {
    clearToken();
    errEl.textContent = err.message;
  } finally {
    $('loginBtn').disabled = false;
    $('loginBtn').textContent = 'Giriş Yap';
  }
}

function logout() {
  clearToken();
  location.reload();
}

/* ---------- Başlat ---------- */
async function init() {
  initTheme();

  $('loginBtn').addEventListener('click', login);
  $('patInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
  $('logoutBtn').addEventListener('click', logout);
  $('siteForm').addEventListener('submit', handleSubmit);
  $('cancelEdit').addEventListener('click', resetForm);
  $('description').addEventListener('input', updateDescCounter);

  $('adminSearch').addEventListener('input', debounce((e) => {
    adminState.q = e.target.value;
    applyAdminFilters();
  }, 120));

  $('adminSort').addEventListener('change', (e) => {
    adminState.sort = e.target.value;
    applyAdminFilters();
  });

  // Ctrl+K → arama
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const s = $('adminSearch');
      if (s && !$('panelSection').style.display.includes('none')) { s.focus(); s.select(); }
    }
  });

  updateDescCounter();

  // Otomatik giriş
  if (getToken()) {
    try {
      const data = await ghGetFile();
      allSites = Array.isArray(data.sites) ? data.sites : [];
      applyAdminFilters();
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
