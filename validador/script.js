import CONFIG from './config.js';

const SESSION_KEY = 'htbpdt_validador_session_v1';
const REQUEST_TIMEOUT_MS = 25000;

const ESTADOS = {
  PENDIENTE: 'PENDIENTE_VALIDACION',
  VALIDADO: 'VALIDADO',
  OBSERVADO: 'OBSERVADO',
  RECHAZADO: 'RECHAZADO'
};

const state = {
  user: getStoredSession(),
  loading: false,
  activeTab: 'dashboard',
  data: {
    docs: [],
    stats: null,
    companies: []
  },
  activeFilter: 'PENDIENTE_VALIDACION',
  selectedDoc: null,
  refreshing: false
};

/* =========================
   SESSION
========================= */

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.dni && !parsed?.usuario_id) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(user) {
  state.user = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

/* =========================
   API
========================= */

const api = {
  async call(action, payload = {}) {
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('XXXXXXXX')) {
      throw new Error('Backend no configurado. Revisa config.js.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.message || 'Error del servidor.');
      }

      return result.data;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('La solicitud tardó demasiado. Verifica conexión o despliegue.');
      }

      if (String(error.message || '').includes('Failed to fetch')) {
        throw new Error('No se pudo conectar con Google Apps Script. Revisa URL, permisos o despliegue.');
      }

      throw error;

    } finally {
      clearTimeout(timeout);
    }
  }
};

/* =========================
   HELPERS
========================= */

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value = '') {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function normalizeUpper(value = '') {
  return String(value || '').trim().toUpperCase();
}

function clampNumber(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return n;
}

function formatDate(value) {
  if (!value) return 'N/A';

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function getStatusStyle(status) {
  const estado = normalizeUpper(status);

  if (estado === ESTADOS.PENDIENTE) {
    return {
      badge: 'bg-amber-50 text-amber-600 border-amber-100',
      icon: 'bg-amber-50 text-amber-500',
      label: 'Pendiente'
    };
  }

  if (estado === ESTADOS.VALIDADO) {
    return {
      badge: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      icon: 'bg-emerald-50 text-emerald-500',
      label: 'Validado'
    };
  }

  if (estado === ESTADOS.OBSERVADO) {
    return {
      badge: 'bg-orange-50 text-orange-600 border-orange-100',
      icon: 'bg-orange-50 text-orange-500',
      label: 'Observado'
    };
  }

  if (estado === ESTADOS.RECHAZADO) {
    return {
      badge: 'bg-red-50 text-red-600 border-red-100',
      icon: 'bg-red-50 text-red-500',
      label: 'Rechazado'
    };
  }

  return {
    badge: 'bg-slate-50 text-slate-500 border-slate-100',
    icon: 'bg-slate-50 text-slate-400',
    label: estado || 'Sin estado'
  };
}

/* =========================
   NAVIGATION
========================= */

function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('bg-[#E30613]', 'text-white', 'shadow-xl', 'shadow-red-200');
    btn.classList.add('text-slate-500', 'hover:bg-slate-50');
  });

  const activeBtn = document.getElementById(`nav-${tabId}`);

  if (activeBtn) {
    activeBtn.classList.add('bg-[#E30613]', 'text-white', 'shadow-xl', 'shadow-red-200');
    activeBtn.classList.remove('text-slate-500', 'hover:bg-slate-50');
  }

  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.remove('active');
  });

  const section = document.getElementById(`view-${tabId}`);
  if (section) section.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    validation: 'Validación',
    companies: 'Empresas',
    reports: 'Reportes',
    'company-detail': 'Detalle Empresa'
  };

  const subtitles = {
    dashboard: 'Resumen de cumplimiento de la red.',
    validation: 'Cola de documentos pendientes por revisar.',
    companies: 'Monitor de empresas transportistas.',
    reports: 'Indicadores y trazabilidad documental.',
    'company-detail': 'Detalle de documentos y cumplimiento por empresa.'
  };

  setText('view-title', titles[tabId] || 'Dashboard');
  setText('view-subtitle', subtitles[tabId] || '');

  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    if (tabId === 'company-detail') {
      btnBack.classList.remove('hidden');
    } else {
      btnBack.classList.add('hidden');
    }
  }

  renderTab();
}

function renderTab() {
  if (state.activeTab === 'dashboard') renderDashboard();
  if (state.activeTab === 'validation') renderValidation();
  if (state.activeTab === 'companies') renderCompanies();
  if (state.activeTab === 'reports') renderReports();
}

/* =========================
   AUTH
========================= */

async function handleLogin(event) {
  if (event) event.preventDefault();

  const dni = document.getElementById('login-dni')?.value.trim();
  const pass = document.getElementById('login-pass')?.value.trim();

  if (!dni || !pass) {
    alert('Ingrese DNI y contraseña.');
    return;
  }

  showLoader('Validando acceso seguro...');

  try {
    const user = await api.call('login', {
      dni,
      pass,
      portal: 'VALIDADOR'
    });

    saveSession(user);

    document.getElementById('login-modal')?.classList.add('hidden');
    document.getElementById('app-container')?.classList.remove('hidden');

    setUserHeader(user);

    await reloadData();

  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    state.user = null;
    alert(error.message || 'Error iniciando sesión.');
  } finally {
    hideLoader();
  }
}

function setUserHeader(user) {
  const fullName = `${user?.nombre || ''} ${user?.apellidos || ''}`.trim();
  const displayName = fullName || user?.razon_social || 'VALIDADOR';

  setText('user-display-name', displayName);
  setText('user-role', user?.rol_app || 'VALIDADOR');

  const avatar = document.getElementById('user-avatar');
  if (avatar) {
    avatar.innerText = displayName
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'V';
  }
}

function logout() {
  showLoader('Cerrando sesión...');

  setTimeout(() => {
    localStorage.removeItem(SESSION_KEY);
    state.user = null;
    location.reload();
  }, 700);
}

/* =========================
   DATA
========================= */

async function reloadData() {
  await refreshData(true);
}

async function refreshData(silent = false) {
  const btn = document.getElementById('refresh-btn');

  if (state.refreshing) return;

  if (!state.user) {
    document.getElementById('login-modal')?.classList.remove('hidden');
    document.getElementById('app-container')?.classList.add('hidden');
    return;
  }

  state.refreshing = true;

  try {
    if (!silent) showLoader('Actualizando validaciones...');

    if (btn) btn.classList.add('pointer-events-none', 'spinning');

    const res = await api.call('getValidatorDashboard', {
      user: state.user
    });

    state.data = {
      docs: normalizeDocs(res.docs || []),
      stats: res.stats || null,
      companies: []
    };

    if (res.user) {
      saveSession(res.user);
      setUserHeader(res.user);
    }

    state.data.companies = buildCompanies(state.data.docs);

    renderTab();

  } catch (error) {
    console.error('Error refreshData:', error);
    alert(error.message || 'Error cargando información.');

    const msg = String(error.message || '');

    if (
      msg.includes('Sesión inválida') ||
      msg.includes('Usuario no encontrado') ||
      msg.includes('Usuario inactivo') ||
      msg.includes('No tiene permisos') ||
      msg.includes('no tiene permiso')
    ) {
      localStorage.removeItem(SESSION_KEY);
      state.user = null;
      location.reload();
    }

  } finally {
    if (btn) btn.classList.remove('pointer-events-none', 'spinning');
    if (!silent) hideLoader();
    state.refreshing = false;
  }
}

function normalizeDocs(docs = []) {
  return docs.map(d => ({
    ...d,
    historial_id: d.historial_id || `${d.documento_id}|${d.version}`,
    fecha_carga: d.fecha_carga || '',
    tipo_documento: d.tipo_documento || d.type || '',
    version: Number(d.version || 1),
    nexo_id: d.nexo_id || d.entityId || '',
    tipo_nexo: normalizeUpper(d.tipo_nexo || d.entityType || ''),
    documento_id: d.documento_id || '',
    empresa_ruc: d.empresa_ruc || '',
    razon_social: d.razon_social || d.empresa || '',
    archivo_url: d.archivo_url || d.fileUrl || '',
    fecha_vencimiento: d.fecha_vencimiento || d.expiryDate || '',
    cargado_por: d.cargado_por || '',
    estado_validacion: normalizeUpper(d.estado_validacion || d.status || ''),
    validado_por: d.validado_por || '',
    fecha_validacion: d.fecha_validacion || '',
    observaciones: d.observaciones || ''
  }));
}

function buildCompanies(docs = []) {
  const map = {};

  docs.forEach(doc => {
    const key = doc.empresa_ruc || 'SIN_RUC';

    if (!map[key]) {
      map[key] = {
        empresa_ruc: key,
        razon_social: doc.razon_social || key,
        total: 0,
        pendientes: 0,
        observados: 0,
        rechazados: 0,
        validados: 0
      };
    }

    map[key].total += 1;

    if (doc.estado_validacion === ESTADOS.PENDIENTE) map[key].pendientes += 1;
    if (doc.estado_validacion === ESTADOS.OBSERVADO) map[key].observados += 1;
    if (doc.estado_validacion === ESTADOS.RECHAZADO) map[key].rechazados += 1;
    if (doc.estado_validacion === ESTADOS.VALIDADO) map[key].validados += 1;
  });

  return Object.values(map);
}

/* =========================
   RENDER DASHBOARD
========================= */

function renderDashboard() {
  const view = document.getElementById('view-dashboard');
  if (!view) return;

  const docs = state.data.docs || [];
  const stats = state.data.stats || buildStatsFromDocs(docs);

  const recent = docs.slice(0, 5);

  view.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
      ${renderStatCard('Total', stats.total || 0, 'file-text', 'text-slate-500')}
      ${renderStatCard('Pendientes', stats.pendientes || 0, 'clock', 'text-amber-500')}
      ${renderStatCard('Observados', stats.observados || 0, 'eye', 'text-orange-500')}
      ${renderStatCard('Rechazados', stats.rechazados || 0, 'x-circle', 'text-red-500')}
      ${renderStatCard('Validados', stats.validados || 0, 'check-circle-2', 'text-emerald-500')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="card-brand p-8 lg:col-span-2">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h3 class="text-xl font-black text-slate-900 uppercase tracking-tight">Cola de validación</h3>
            <p class="text-sm text-slate-400 font-medium">Últimos documentos recibidos.</p>
          </div>

          <button type="button" onclick="switchTab('validation')" class="px-5 py-3 rounded-2xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest">
            Revisar
          </button>
        </div>

        <div class="space-y-4">
          ${
            recent.length
              ? recent.map(renderDocRow).join('')
              : `<div class="p-8 text-center text-slate-400 font-bold">No hay documentos pendientes.</div>`
          }
        </div>
      </div>

      <div class="card-brand p-8">
        <h3 class="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Resumen</h3>

        <div class="space-y-5">
          ${renderProgressLine('Pendientes', stats.pendientes || 0, stats.total || 0)}
          ${renderProgressLine('Observados', stats.observados || 0, stats.total || 0)}
          ${renderProgressLine('Validados', stats.validados || 0, stats.total || 0)}
        </div>
      </div>
    </div>
  `;

  refreshIcons();
}

function renderStatCard(label, value, icon, colorClass) {
  return `
    <div class="card-brand p-6">
      <div class="flex items-center justify-between mb-6">
        <div class="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center ${colorClass}">
          <i data-lucide="${icon}" style="width: 22px; height: 22px;"></i>
        </div>
      </div>
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${escapeHtml(label)}</p>
      <h3 class="text-4xl font-black text-slate-900 tracking-tighter mt-1">${value}</h3>
    </div>
  `;
}

function renderProgressLine(label, value, total) {
  const pct = total ? Math.round((value / total) * 100) : 0;

  return `
    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-black text-slate-500 uppercase tracking-widest">${escapeHtml(label)}</span>
        <span class="text-xs font-black text-slate-900">${pct}%</span>
      </div>
      <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full bg-[#E30613]" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

function buildStatsFromDocs(docs) {
  return {
    total: docs.length,
    pendientes: docs.filter(d => d.estado_validacion === ESTADOS.PENDIENTE).length,
    observados: docs.filter(d => d.estado_validacion === ESTADOS.OBSERVADO).length,
    rechazados: docs.filter(d => d.estado_validacion === ESTADOS.RECHAZADO).length,
    validados: docs.filter(d => d.estado_validacion === ESTADOS.VALIDADO).length
  };
}

/* =========================
   RENDER VALIDATION
========================= */

function renderValidation() {
  const view = document.getElementById('view-validation');
  if (!view) return;

  const docs = getFilteredDocs();

  view.innerHTML = `
    <div class="flex flex-wrap gap-3">
      ${renderFilterButton('PENDIENTE_VALIDACION', 'Pendientes')}
      ${renderFilterButton('OBSERVADO', 'Observados')}
      ${renderFilterButton('RECHAZADO', 'Rechazados')}
      ${renderFilterButton('VALIDADO', 'Validados')}
      ${renderFilterButton('TODOS', 'Todos')}
    </div>

    <div class="grid grid-cols-1 gap-5">
      ${
        docs.length
          ? docs.map(renderValidationCard).join('')
          : `<div class="card-brand p-12 text-center text-slate-400 font-black uppercase tracking-widest text-xs">No hay documentos para mostrar.</div>`
      }
    </div>
  `;

  refreshIcons();
}

function getFilteredDocs() {
  const docs = state.data.docs || [];

  if (state.activeFilter === 'TODOS') return docs;

  return docs.filter(doc => doc.estado_validacion === state.activeFilter);
}

function renderFilterButton(status, label) {
  const active = state.activeFilter === status;

  return `
    <button type="button" onclick="filterValidation('${status}')" class="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active
        ? 'bg-slate-900 text-white shadow-xl'
        : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
    }">
      ${escapeHtml(label)}
    </button>
  `;
}

function renderValidationCard(doc) {
  const style = getStatusStyle(doc.estado_validacion);
  const canValidate = doc.estado_validacion === ESTADOS.PENDIENTE;

  return `
    <div class="card-brand p-7 hover:border-red-100">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div class="flex items-start gap-5">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center ${style.icon}">
            <i data-lucide="file-text" style="width: 24px; height: 24px;"></i>
          </div>

          <div>
            <div class="flex flex-wrap items-center gap-3 mb-2">
              <h3 class="font-black text-slate-900 text-lg uppercase tracking-tight">${escapeHtml(doc.tipo_documento)}</h3>
              <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${style.badge}">
                ${escapeHtml(style.label)}
              </span>
            </div>

            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              ${escapeHtml(doc.tipo_nexo)} · ${escapeHtml(doc.nexo_id)} · V${escapeHtml(doc.version)}
            </p>

            <p class="text-sm text-slate-500 mt-3">
              Empresa: <strong>${escapeHtml(doc.razon_social || doc.empresa_ruc)}</strong>
            </p>

            <p class="text-xs text-slate-400 mt-1">
              Cargado: ${formatDate(doc.fecha_carga)} · Vence: ${formatDate(doc.fecha_vencimiento)}
            </p>
          </div>
        </div>

        <div class="flex gap-3 justify-end">
          ${
            doc.archivo_url
              ? `<button type="button" onclick="openFile('${escapeAttr(doc.archivo_url)}')" class="px-5 py-3 rounded-2xl bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100">Ver archivo</button>`
              : ''
          }

          <button type="button" onclick="openValidationModal('${escapeAttr(doc.historial_id)}')" class="px-5 py-3 rounded-2xl ${
            canValidate
              ? 'bg-[#E30613] text-white hover:bg-[#B90510]'
              : 'bg-slate-900 text-white hover:bg-slate-700'
          } text-[10px] font-black uppercase tracking-widest">
            ${canValidate ? 'Validar' : 'Ver detalle'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderDocRow(doc) {
  const style = getStatusStyle(doc.estado_validacion);

  return `
    <div class="flex items-center justify-between p-4 bg-slate-50 rounded-3xl">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl flex items-center justify-center ${style.icon}">
          <i data-lucide="file-text" style="width: 20px; height: 20px;"></i>
        </div>
        <div>
          <p class="font-black text-slate-900 uppercase">${escapeHtml(doc.tipo_documento)}</p>
          <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest">
            ${escapeHtml(doc.tipo_nexo)} · ${escapeHtml(doc.nexo_id)} · V${escapeHtml(doc.version)}
          </p>
        </div>
      </div>

      <button type="button" onclick="openValidationModal('${escapeAttr(doc.historial_id)}')" class="text-[10px] font-black text-[#E30613] uppercase tracking-widest">
        Revisar
      </button>
    </div>
  `;
}

/* =========================
   COMPANIES / REPORTS
========================= */

function renderCompanies() {
  const view = document.getElementById('view-companies');
  if (!view) return;

  const companies = state.data.companies || [];

  view.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${
        companies.length
          ? companies.map(company => `
              <div class="card-brand p-8">
                <div class="flex items-start justify-between mb-8">
                  <div>
                    <h3 class="font-black text-slate-900 uppercase tracking-tight leading-tight">${escapeHtml(company.razon_social)}</h3>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">${escapeHtml(company.empresa_ruc)}</p>
                  </div>
                  <div class="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                    <i data-lucide="building-2" style="width: 22px; height: 22px;"></i>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-center">
                  <div class="p-4 bg-slate-50 rounded-2xl">
                    <p class="text-xl font-black text-slate-900">${company.total}</p>
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                  </div>
                  <div class="p-4 bg-amber-50 rounded-2xl">
                    <p class="text-xl font-black text-amber-600">${company.pendientes}</p>
                    <p class="text-[9px] font-black text-amber-600 uppercase tracking-widest">Pend.</p>
                  </div>
                </div>
              </div>
            `).join('')
          : `<div class="col-span-3 card-brand p-12 text-center text-slate-400 font-bold">No hay empresas para mostrar.</div>`
      }
    </div>
  `;

  refreshIcons();
}

function renderReports() {
  const view = document.getElementById('view-reports');
  if (!view) return;

  const stats = state.data.stats || buildStatsFromDocs(state.data.docs);

  view.innerHTML = `
    <div class="card-brand p-10">
      <h3 class="text-2xl font-black text-slate-900 uppercase tracking-tight mb-3">Reporte de Validación</h3>
      <p class="text-slate-500 font-medium mb-8">Resumen operativo de documentos revisados y pendientes.</p>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        ${renderStatCard('Pendientes', stats.pendientes || 0, 'clock', 'text-amber-500')}
        ${renderStatCard('Observados', stats.observados || 0, 'eye', 'text-orange-500')}
        ${renderStatCard('Rechazados', stats.rechazados || 0, 'x-circle', 'text-red-500')}
        ${renderStatCard('Validados', stats.validados || 0, 'check-circle-2', 'text-emerald-500')}
      </div>
    </div>
  `;

  refreshIcons();
}

/* =========================
   MODAL VALIDATION
========================= */

function openValidationModal(historialId) {
  const doc = state.data.docs.find(d => String(d.historial_id) === String(historialId));

  if (!doc) {
    alert('Documento no encontrado.');
    return;
  }

  state.selectedDoc = doc;

  const style = getStatusStyle(doc.estado_validacion);
  const isPending = doc.estado_validacion === ESTADOS.PENDIENTE;

  const modal = document.getElementById('modal-container');
  const content = document.getElementById('modal-content');

  if (!modal || !content) return;

  content.innerHTML = `
    <button type="button" onclick="closeValidationModal()" class="absolute top-8 right-8 text-slate-300 hover:text-slate-900">
      <i data-lucide="x" style="width: 24px; height: 24px;"></i>
    </button>

    <div class="space-y-8">
      <div class="pr-12">
        <div class="flex items-center gap-3 mb-3">
          <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${style.badge}">
            ${escapeHtml(style.label)}
          </span>
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            V${escapeHtml(doc.version)}
          </span>
        </div>

        <h3 class="text-2xl font-black text-slate-900 tracking-tight uppercase">${escapeHtml(doc.tipo_documento)}</h3>
        <p class="text-slate-500 font-medium mt-1">
          ${escapeHtml(doc.tipo_nexo)} · ${escapeHtml(doc.nexo_id)}
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${renderInfoBox('Empresa', doc.razon_social || doc.empresa_ruc)}
        ${renderInfoBox('RUC', doc.empresa_ruc)}
        ${renderInfoBox('Fecha de carga', formatDate(doc.fecha_carga))}
        ${renderInfoBox('Fecha de vencimiento', formatDate(doc.fecha_vencimiento))}
        ${renderInfoBox('Cargado por', doc.cargado_por || 'N/A')}
        ${renderInfoBox('Documento ID', doc.documento_id)}
      </div>

      ${
        doc.archivo_url
          ? `
            <div class="rounded-[32px] border border-slate-100 overflow-hidden bg-slate-50">
              <div class="p-4 flex items-center justify-between bg-white border-b border-slate-100">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista del documento</p>
                <button type="button" onclick="openFile('${escapeAttr(doc.archivo_url)}')" class="text-[10px] font-black text-[#E30613] uppercase tracking-widest">
                  Abrir en Drive
                </button>
              </div>
              <iframe src="${escapeAttr(doc.archivo_url)}" class="w-full h-[420px] bg-white"></iframe>
            </div>
          `
          : `<div class="p-8 rounded-[32px] bg-slate-50 text-center text-slate-400 font-bold">No hay archivo disponible.</div>`
      }

      <div class="space-y-2">
        <label class="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Observación del validador</label>
        <textarea id="validation-comment" class="input-brand min-h-[120px] rounded-[28px]" placeholder="Escribe una observación si vas a observar o rechazar...">${escapeHtml(doc.observaciones || '')}</textarea>
      </div>

      <div class="flex flex-col md:flex-row gap-4 pt-2">
        <button type="button" onclick="closeValidationModal()" class="flex-1 py-4 rounded-2xl border-2 border-slate-100 text-slate-500 font-black hover:bg-slate-50">
          Cerrar
        </button>

        ${
          isPending
            ? `
              <button type="button" onclick="observeSelectedDoc()" class="flex-1 py-4 rounded-2xl bg-orange-50 text-orange-600 font-black hover:bg-orange-100">
                Observar
              </button>

              <button type="button" onclick="rejectSelectedDoc()" class="flex-1 py-4 rounded-2xl bg-red-50 text-red-600 font-black hover:bg-red-100">
                Rechazar
              </button>

              <button type="button" onclick="approveSelectedDoc()" class="flex-[1.5] py-4 btn-primary">
                Aprobar
              </button>
            `
            : ''
        }
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  refreshIcons();
}

function renderInfoBox(label, value) {
  return `
    <div class="p-5 bg-slate-50 rounded-3xl">
      <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">${escapeHtml(label)}</p>
      <p class="font-black text-slate-800 break-words">${escapeHtml(value || 'N/A')}</p>
    </div>
  `;
}

function closeValidationModal() {
  state.selectedDoc = null;

  const modal = document.getElementById('modal-container');
  const content = document.getElementById('modal-content');

  if (content) content.innerHTML = '';

  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function approveSelectedDoc() {
  if (!state.selectedDoc) {
    alert('No hay documento seleccionado.');
    return;
  }

  if (!confirm('¿Confirmas aprobar este documento?')) return;

  showLoader('Aprobando documento...');

  try {
    const res = await api.call('approveHistoricalVersion', {
      user: state.user,
      documento_id: state.selectedDoc.documento_id,
      version: state.selectedDoc.version,
      observaciones: getValidationComment()
    });

    closeValidationModal();
    await reloadData();

    alert(res?.message || 'Documento aprobado correctamente.');

  } catch (error) {
    alert(error.message || 'Error aprobando documento.');
  } finally {
    hideLoader();
  }
}

async function observeSelectedDoc() {
  await rejectOrObserveSelectedDoc(ESTADOS.OBSERVADO);
}

async function rejectSelectedDoc() {
  await rejectOrObserveSelectedDoc(ESTADOS.RECHAZADO);
}

async function rejectOrObserveSelectedDoc(status) {
  if (!state.selectedDoc) {
    alert('No hay documento seleccionado.');
    return;
  }

  const observaciones = getValidationComment();

  if (!observaciones) {
    alert('Debe ingresar una observación.');
    return;
  }

  const label = status === ESTADOS.OBSERVADO ? 'observar' : 'rechazar';
  if (!confirm(`¿Confirmas ${label} este documento?`)) return;

  showLoader('Actualizando validación...');

  try {
    const res = await api.call('rejectHistoricalVersion', {
      user: state.user,
      documento_id: state.selectedDoc.documento_id,
      version: state.selectedDoc.version,
      estado_validacion: status,
      observaciones
    });

    closeValidationModal();
    await reloadData();

    alert(res?.message || 'Documento actualizado correctamente.');

  } catch (error) {
    alert(error.message || 'Error actualizando documento.');
  } finally {
    hideLoader();
  }
}

function getValidationComment() {
  return document.getElementById('validation-comment')?.value.trim() || '';
}

/* =========================
   LOADER
========================= */

function showLoader(message = 'Procesando solicitud...') {
  const loader = document.getElementById('app-loader');
  const messageEl = document.getElementById('app-loader-message');

  if (messageEl) messageEl.innerText = message;

  if (loader) {
    loader.classList.remove('hidden');
    loader.classList.add('flex');
  }
}

function hideLoader() {
  const loader = document.getElementById('app-loader');

  if (loader) {
    loader.classList.add('hidden');
    loader.classList.remove('flex');
  }
}

function openFile(url) {
  if (!url) return;
  window.open(url, '_blank');
}

/* =========================
   INIT
========================= */

document.addEventListener('DOMContentLoaded', async () => {
  refreshIcons();

  if (state.user) {
    document.getElementById('login-modal')?.classList.add('hidden');
    document.getElementById('app-container')?.classList.remove('hidden');

    setUserHeader(state.user);

    try {
      await reloadData();
    } catch (error) {
      console.error(error);
    }
  } else {
    document.getElementById('login-modal')?.classList.remove('hidden');
    document.getElementById('app-container')?.classList.add('hidden');
  }
});

/* =========================
   GLOBALS
========================= */

window.switchTab = switchTab;
window.handleLogin = handleLogin;
window.logout = logout;
window.refreshData = refreshData;
window.filterValidation = filterValidation;

window.openValidationModal = openValidationModal;
window.closeValidationModal = closeValidationModal;
window.approveSelectedDoc = approveSelectedDoc;
window.observeSelectedDoc = observeSelectedDoc;
window.rejectSelectedDoc = rejectSelectedDoc;

window.openFile = openFile;
