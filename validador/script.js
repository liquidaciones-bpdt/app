/**
 * ============================================================
 *  HT-BPDT — Portal Validador (VERSIÓN ESTANDARIZADA)
 * ============================================================
 */

// ── CONFIG GLOBAL ────────────────────────────────────────────
const CONFIG = {
  BASE_URL: 'TU_WEBAPP_URL_AQUI',
  APP_NAME: 'validador'
};

// ── STATE GLOBAL ─────────────────────────────────────────────
const State = {
  activeTab: 'dashboard',
  selectedCompanyId: null,
  companies: [],
  documents: [],
  isRefreshing: false,
  activeDoc: null,
  token: null,
  user: null
};

// ─────────────────────────────────────────────────────────────
//  API CORE
// ─────────────────────────────────────────────────────────────
async function apiCall(action, payload = {}) {
  try {
    const res = await fetch(CONFIG.BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        app: CONFIG.APP_NAME,
        token: State.token,
        ...payload
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Normalización
    return {
      success: data.success ?? false,
      message: data.message ?? '',
      data: data
    };

  } catch (err) {
    console.error('API ERROR:', err);
    return { success: false, message: 'Error de conexión' };
  }
}

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initEvents();
});

// ─────────────────────────────────────────────────────────────
//  EVENTS
// ─────────────────────────────────────────────────────────────
function initEvents() {

  // LOGIN
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const inputs = e.target.querySelectorAll('input');
    const dni = inputs[0]?.value?.trim();
    const password = inputs[1]?.value?.trim();

    if (!dni || !password) return alert('Completa los datos');

    const res = await apiCall('login', { dni, password });

    if (!res.success) return alert(res.message);

    if (!['VALIDADOR', 'ADMIN'].includes(res.data.user?.rol)) {
      return alert('Sin permisos');
    }

    State.user = res.data.user;
    State.token = res.data.token;

    switchToApp();
    loadData();
  });

  // SIDEBAR
  document.getElementById('sidebar-nav')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    State.activeTab = btn.dataset.tab;
    State.selectedCompanyId = null;
    renderAll();
  });

  // LOGOUT
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    State.token = null;
    location.reload();
  });

  // REFRESH
  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    if (State.isRefreshing) return;
    State.isRefreshing = true;

    await loadData();
    State.isRefreshing = false;
  });
}

// ─────────────────────────────────────────────────────────────
//  UI FLOW
// ─────────────────────────────────────────────────────────────
function switchToApp() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';
}

// ─────────────────────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────────────────────
async function loadData() {
  const res = await apiCall('getValidatorData');

  if (!res.success) {
    console.error(res.message);
    return;
  }

  const data = res.data;

  State.companies = data.companies || [];
  State.documents = data.documents || [];

  renderAll();
}

// ─────────────────────────────────────────────────────────────
//  RENDER CORE
// ─────────────────────────────────────────────────────────────
function renderAll() {
  renderSidebar();
  renderView();
  lucide.createIcons();
}

function renderView() {
  document.querySelectorAll('.view-content')
    .forEach(v => v.classList.remove('active'));

  if (State.selectedCompanyId) {
    document.getElementById('view-company-detail')?.classList.add('active');
    renderCompanyDetail();
    return;
  }

  const view = document.getElementById(`view-${State.activeTab}`);
  view?.classList.add('active');

  switch (State.activeTab) {
    case 'dashboard': renderDashboard(); break;
    case 'validation': renderValidation(); break;
    case 'companies': renderCompanies(); break;
  }
}

// ─────────────────────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const pending = State.documents.filter(d =>
    ['PENDING', 'OBSERVED'].includes(d.status)
  ).length;

  nav.innerHTML = `
    ${navItem('dashboard', 'layout-dashboard', 'Dashboard')}
    ${navItem('validation', 'check-circle-2', 'Validación', pending)}
    ${navItem('companies', 'building-2', 'Empresas')}
  `;
}

function navItem(id, icon, label, badge = 0) {
  return `
    <button data-tab="${id}" class="nav-btn ${State.activeTab === id ? 'active' : ''}">
      <i data-lucide="${icon}"></i>
      ${label}
      ${badge ? `<span class="badge">${badge}</span>` : ''}
    </button>
  `;
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────
function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  if (!el) return;

  const stats = calculateStats();

  el.innerHTML = `
    <div class="p-8">
      <h2 class="text-xl font-bold">Cumplimiento Global</h2>
      <p class="text-4xl font-black">${stats.globalCompliance}%</p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
//  VALIDATION
// ─────────────────────────────────────────────────────────────
function renderValidation() {
  const el = document.getElementById('view-validation');
  if (!el) return;

  const docs = State.documents.filter(d =>
    ['PENDING', 'OBSERVED'].includes(d.status)
  );

  el.innerHTML = docs.map(d => `
    <div class="card">
      <b>${d.type}</b>
      <p>${d.companyName}</p>
      <button onclick="openValidation('${d.id}')">Ver</button>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────
//  EMPRESAS
// ─────────────────────────────────────────────────────────────
function renderCompanies() {
  const el = document.getElementById('view-companies');
  if (!el) return;

  el.innerHTML = State.companies.map(c => `
    <div class="card" onclick="selectCompany('${c.id}')">
      <b>${c.name}</b>
      <p>${c.compliance}%</p>
    </div>
  `).join('');
}

function selectCompany(id) {
  State.selectedCompanyId = id;
  renderAll();
}

// ─────────────────────────────────────────────────────────────
//  DETALLE EMPRESA
// ─────────────────────────────────────────────────────────────
function renderCompanyDetail() {
  const el = document.getElementById('view-company-detail');
  const c = State.companies.find(x => x.id === State.selectedCompanyId);

  if (!el || !c) return;

  el.innerHTML = `
    <h2>${c.name}</h2>
    <p>RUC: ${c.ruc}</p>
  `;
}

// ─────────────────────────────────────────────────────────────
//  VALIDACIÓN ACCIONES
// ─────────────────────────────────────────────────────────────
async function openValidation(id) {
  const doc = State.documents.find(d => d.id === id);
  if (!doc) return;

  const action = confirm(`¿Aprobar ${doc.type}?`) ? 'APPROVED' : 'REJECTED';

  const res = await apiCall('validateDocument', {
    documentId: id,
    action
  });

  if (!res.success) return alert(res.message);

  State.documents = State.documents.map(d =>
    d.id === id ? { ...d, status: action } : d
  );

  renderAll();
}

// ─────────────────────────────────────────────────────────────
//  STATS
// ─────────────────────────────────────────────────────────────
function calculateStats() {
  const total = State.documents.length;
  const approved = State.documents.filter(d => d.status === 'APPROVED').length;

  return {
    globalCompliance: total ? Math.round((approved / total) * 100) : 0
  };
}
