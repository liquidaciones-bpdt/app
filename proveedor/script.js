import CONFIG from './config.js';

const SESSION_KEY = 'htbpdt_proveedor_session_v3';
const REQUEST_TIMEOUT_MS = 25000;

const state = {
  user: getStoredSession(),
  loading: false,
  activeTab: 'dashboard',
  lastFetchAt: 0,
  cacheTTL: 60000,
  data: {
    units: [],
    crew: [],
    docs: [],
    historial: [],
    requisitos: [],
    stats: null,
    acciones_requeridas: []
  },
  filterType: 'all',
  filterStatus: 'all',
  activeDocId: null,
  activeDocType: null,
  activeDocEntityId: null,
  activeDocEntityType: null,
  activeRequirementId: null,
  refreshing: false,
  activeCrewId: null,
  activeCrewMenuOpen: false
};

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

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clampPercent(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getUnitId(unit) {
  return unit.id || unit.placa || '-';
}

function getUnitTipo(unit) {
  return unit.tipo || unit.tipo_unidad || '-';
}

function getCrewName(person) {
  return person.nombre || `${person.nombres || ''} ${person.apellidos || ''}`.trim() || '-';
}

function getCrewRole(person) {
  return person.rol || person.cargo || '-';
}

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

function showLoginScreen() {
  const loginModal = document.getElementById('login-modal');
  const appContainer = document.getElementById('app-container');

  if (appContainer) {
    appContainer.classList.add('hidden');
  }

  if (loginModal) {
    loginModal.classList.remove('hidden');
    loginModal.classList.add('flex');
  }

  document.body.classList.add('overflow-hidden');
}

function showAppScreen() {
  const loginModal = document.getElementById('login-modal');
  const appContainer = document.getElementById('app-container');

  if (loginModal) {
    loginModal.classList.add('hidden');
    loginModal.classList.remove('flex');
  }

  if (appContainer) {
    appContainer.classList.remove('hidden');
  }

  document.body.classList.remove('overflow-hidden');
}

function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('bg-[#E20613]', 'text-white', 'shadow-xl', 'shadow-red-200');
    btn.classList.add('text-slate-500', 'hover:bg-slate-50');
  });

  const activeBtn = document.getElementById(`nav-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-[#E20613]', 'text-white', 'shadow-xl', 'shadow-red-200');
    activeBtn.classList.remove('text-slate-500', 'hover:bg-slate-50');
  }

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
    sec.classList.add('hidden');
  });

  const section = document.getElementById(`view-${tabId}`);
  if (section) {
    section.classList.add('active');
    section.classList.remove('hidden');
  }

  const labels = {
    dashboard: 'Dashboard',
    fleet: 'Unidades',
    crew: 'Tripulación',
    docs: 'Documentos',
    company: 'Empresa'
  };

  const title = document.getElementById('view-title');
  if (title) title.innerText = labels[tabId] || 'Dashboard';

  renderTab();
}

async function handleLogin(event) {
  if (event) event.preventDefault();

  const dni = document.getElementById('login-dni')?.value.trim();
  const pass = document.getElementById('login-pass')?.value.trim();

  if (!dni || !pass) {
    alert('Ingresar credenciales.');
    return;
  }

  showLoader('Validando acceso seguro...');

  try {
    const user = await api.call('login', {
      dni,
      pass,
      portal: 'PROVEEDOR'
    });

    state.user = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));

    showAppScreen();

    setUserHeader(user);
    
    await reloadData(true);

  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    state.user = null;
    showLoginScreen();
    alert(error.message || 'Error conectando al sistema.');
  } finally {
    hideLoader();
  }
}

function setUserHeader(user) {
  const empresaNombre = user?.razon_social || user?.empresa || 'EMPRESA';

  const empresaEl = document.getElementById('user-empresa');
  if (empresaEl) empresaEl.innerText = empresaNombre;

  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl) {
    avatarEl.innerText = empresaNombre
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'HT';
  }

  const rucEl = document.getElementById('company-ruc');
  if (rucEl) rucEl.innerText = user?.empresa_ruc || 'CARGANDO...';

  const razonEl = document.getElementById('company-razon-social');
  if (razonEl) razonEl.innerText = empresaNombre;
}

function logout() {
  showLoader('Cerrando sesión de forma segura...');

  const logoutBtn = document.querySelector('button[onclick="logout()"]');

  if (logoutBtn) {
    logoutBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" size="20"></i> Cerrando...';
    refreshIcons();
  }

  setTimeout(() => {
    localStorage.removeItem(SESSION_KEY);
    state.user = null;
    location.reload();
  }, 900);
}

async function reloadData(force = true) {
  await refreshData(true, force);
}

async function refreshData(silent = false, force = false) {
  const btn = document.getElementById('refresh-btn');

  if (state.refreshing) return;

  if (!state.user) {
    showLoginScreen();
    return;
  }

  const now = Date.now();
  const hasData =
    (state.data.units && state.data.units.length) ||
    (state.data.crew && state.data.crew.length) ||
    (state.data.docs && state.data.docs.length);
  
  if (!force && hasData && now - state.lastFetchAt < state.cacheTTL) {
    renderTab();
    return;
  }
  
  state.refreshing = true;

  try {
    if (!silent) showLoader('Actualizando datos...');

    if (btn) btn.classList.add('pointer-events-none', 'spinning');

    const res = await api.call('getDashboard', {
      user: state.user
    });

    state.data = {
      units: normalizeUnits(res.units || []),
      crew: normalizeCrew(res.crew || []),
      docs: normalizeDocs(res.docs || []),
      historial: res.historial || [],
      requisitos: res.requisitos || [],
      stats: res.stats || null,
      empresa: res.empresa || null,
      acciones_requeridas: res.acciones_requeridas || []
    };

    state.lastFetchAt = Date.now();

    if (res.user) {
      state.user = res.user;
      localStorage.setItem(SESSION_KEY, JSON.stringify(res.user));
      setUserHeader(res.user);
    }

    renderTab();

  } catch (error) {
    console.error('Error refreshing data:', error);
    alert(error.message || 'Error actualizando datos.');

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

function normalizeUnits(units = []) {
  return units.map(u => ({
    ...u,
    id: u.id || u.placa,
    tipo: u.tipo || u.tipo_unidad || '',
    sistema: u.sistema || '',
    estado: u.estado || 'ACTIVO',
    compliance: clampPercent(u.compliance || u.cumplimiento || 0),
    exclusiva: u.exclusiva || u.linea_exclusiva || '',
    linea: u.linea || u.linea_exclusiva || ''
  }));
}

function normalizeCrew(crew = []) {
  return crew.map(c => ({
    ...c,
    id: c.id || c.dni,
    nombre: getCrewName(c),
    rol: c.rol || c.cargo || '',
    compliance: clampPercent(c.compliance || c.cumplimiento || 0),
    estado: c.estado || 'ACTIVO'
  }));
}

function normalizeDocs(docs = []) {
  return docs.map(d => ({
    ...d,
    id: d.id || d.documento_id,
    documento_id: d.documento_id || d.id || '',

    requisito_id: d.requisito_id || '',

    entityId: d.entityId || d.nexo_id || d.nexo,
    entityType: String(d.entityType || d.tipo_nexo || '').toLowerCase(),

    type: d.type || d.nombre_documento || d.documento,
    nombre_documento: d.nombre_documento || d.type || d.documento,

    grupo_documental: d.grupo_documental || 'GENERAL',
    descripcion: d.descripcion || '',

    status: d.status || d.estado || d.estado_validacion || d.estado_vigencia || '-',
    estado_vigencia: d.estado_vigencia || d.status || '-',

    expiryDate: d.expiryDate || d.fecha_vencimiento || d.vencimiento || '',
    fecha_vencimiento: d.fecha_vencimiento || d.expiryDate || '',

    fileUrl: d.fileUrl || d.archivo_url_actual || d.ruta_drive || '',
    archivo_url_actual: d.archivo_url_actual || d.fileUrl || '',

    requiere_vencimiento: d.requiere_vencimiento || 'SI',
    dias_alerta: d.dias_alerta || 15,

    tiene_pendiente: Boolean(d.tiene_pendiente),
    tiene_documento_aprobado: Boolean(d.tiene_documento_aprobado)
  }));
}

function renderTab() {
  if (state.activeTab === 'dashboard') renderDashboard();
  if (state.activeTab === 'fleet') renderFleet();
  if (state.activeTab === 'crew') renderCrew();
  if (state.activeTab === 'docs') renderDocs();
  if (state.activeTab === 'company') renderCompany();
}

function renderDashboard() {
  const view = document.getElementById('view-dashboard');
  if (!view) return;

  const stats = state.data.stats || {};
  const actions = state.data.acciones_requeridas || [];
  const units = state.data.units || [];
  const crew = state.data.crew || [];

  const globalVal = clampPercent(stats.companyCompliance || 0);
  const estado = stats.estado_operacional || state.data.empresa?.estado_operacional || 'SIN_REQUISITOS';
  const estadoMeta = getOperationalStatusMeta(estado);

  const criticalUnits = [...units]
    .sort((a, b) => clampPercent(a.compliance) - clampPercent(b.compliance))
    .slice(0, 4);

  const criticalCrew = [...crew]
    .sort((a, b) => clampPercent(a.compliance) - clampPercent(b.compliance))
    .slice(0, 4);

  view.innerHTML = `
    <div class="space-y-10">

      <section class="card-brand bg-slate-900 text-white border-none overflow-hidden relative">
        <div class="absolute right-[-80px] top-[-80px] w-64 h-64 bg-[#E20613]/20 rounded-full blur-3xl"></div>

        <div class="relative grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10 items-center">
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">Estado de cumplimiento</p>

            <div class="flex flex-wrap items-center gap-4 mb-5">
              <h3 class="text-4xl font-black tracking-tight">${estadoMeta.label}</h3>
              <span class="${estadoMeta.badge} px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
                ${escapeHtml(estado)}
              </span>
            </div>

            <p class="text-slate-300 font-medium max-w-2xl">
              ${escapeHtml(estadoMeta.message)}
            </p>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              ${renderMiniKpi('Acciones pendientes', stats.acciones_pendientes || stats.pendingCount || 0)}
              ${renderMiniKpi('En validación', stats.documentos_en_validacion || stats.pendientes_validacion || 0)}
              ${renderMiniKpi('Total requisitos', stats.total_requisitos || 0)}
              ${renderMiniKpi('Documentos válidos', stats.documentos_validos || 0)}
            </div>
          </div>

          <div class="flex justify-center">
            <div class="relative w-56 h-56">
              <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="transparent" stroke="rgba(255,255,255,0.12)" stroke-width="10"></circle>
                <circle cx="50" cy="50" r="42" fill="transparent" stroke="#E20613" stroke-width="10" stroke-dasharray="263.89" stroke-dashoffset="${263.89 * (1 - globalVal / 100)}" stroke-linecap="round"></circle>
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-4xl font-black">${globalVal}%</span>
                <span class="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mt-2">Cumplimiento</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5">
        ${renderDashboardKpi('Vigentes', stats.vigentes || 0, 'check-circle-2')}
        ${renderDashboardKpi('Faltantes', stats.faltantes || 0, 'file-warning')}
        ${renderDashboardKpi('Observados', stats.observados || 0, 'eye')}
        ${renderDashboardKpi('Rechazados', stats.rechazados || 0, 'x-circle')}
        ${renderDashboardKpi('Por vencer', stats.por_vencer || 0, 'clock')}
        ${renderDashboardKpi('Vencidos', stats.vencidos || 0, 'alert-circle')}
      </section>

      <section class="card-brand">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h3 class="text-2xl font-black uppercase tracking-tight">Acciones requeridas</h3>
            <p class="text-sm text-slate-400 font-medium mt-1">Prioridad documental para quedar apto.</p>
          </div>

          <button type="button" onclick="switchTab('docs')" class="btn-primary px-5 py-3 text-[10px]">
            Ver todo
          </button>
        </div>

        <div class="space-y-4">
          ${
            actions.length
              ? actions.map(renderRequiredAction).join('')
              : `<div class="p-8 rounded-[32px] bg-emerald-50 text-emerald-700 font-bold text-center">
                  No tienes acciones documentales pendientes.
                </div>`
          }
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="card-brand">
          <h3 class="font-black text-xl tracking-tight uppercase mb-6">Unidades con menor cumplimiento</h3>
          <div class="space-y-4">
            ${
              criticalUnits.length
                ? criticalUnits.map(u => renderEntitySummary(getUnitId(u), u.sistema || getUnitTipo(u), u.compliance, 'truck')).join('')
                : `<div class="p-8 text-center text-slate-400 font-bold">No hay unidades registradas.</div>`
            }
          </div>
        </div>

        <div class="card-brand">
          <h3 class="font-black text-xl tracking-tight uppercase mb-6">Tripulación con menor cumplimiento</h3>
          <div class="space-y-4">
            ${
              criticalCrew.length
                ? criticalCrew.map(c => renderEntitySummary(getCrewName(c), getCrewRole(c), c.compliance, 'user')).join('')
                : `<div class="p-8 text-center text-slate-400 font-bold">No hay tripulantes registrados.</div>`
            }
          </div>
        </div>
      </section>

    </div>
  `;

  refreshIcons();
}

function getOperationalStatusMeta(status) {
  const estado = String(status || '').toUpperCase();

  if (estado === 'APTO') {
    return {
      label: 'Proveedor apto',
      message: 'Tu documentación obligatoria se encuentra vigente y aprobada.',
      badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20'
    };
  }

  if (estado === 'NO_APTO') {
    return {
      label: 'Proveedor no apto',
      message: 'Tienes documentos faltantes, vencidos o rechazados que impiden completar el cumplimiento.',
      badge: 'bg-red-500/15 text-red-300 border border-red-400/20'
    };
  }

  if (estado === 'OBSERVADO') {
    return {
      label: 'Proveedor observado',
      message: 'Existen documentos por corregir, renovar o completar para alcanzar el cumplimiento total.',
      badge: 'bg-amber-500/15 text-amber-300 border border-amber-400/20'
    };
  }

  return {
    label: 'Sin requisitos configurados',
    message: 'Aún no existen requisitos activos para evaluar el cumplimiento.',
    badge: 'bg-slate-500/15 text-slate-300 border border-slate-400/20'
  };
}

function renderMiniKpi(label, value) {
  return `
    <div class="p-4 bg-white/5 border border-white/10 rounded-2xl">
      <p class="text-2xl font-black text-white">${escapeHtml(value)}</p>
      <p class="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">${escapeHtml(label)}</p>
    </div>
  `;
}

function renderDashboardKpi(label, value, icon) {
  return `
    <div class="card-brand p-6 min-h-[180px] flex flex-col justify-between">
      <div class="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#E20613] mb-6">
        <i data-lucide="${icon}" size="22"></i>
      </div>
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${escapeHtml(label)}</p>
      <h3 class="text-4xl font-black text-slate-900 tracking-tight mt-1">${escapeHtml(value)}</h3>
    </div>
  `;
}

function renderRequiredAction(item) {
  const status = getStatusMeta(item.estado);
  const action = item.accion || getActionLabelByStatus(item.estado);

  return `
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-5 p-5 bg-slate-50 rounded-[28px] border border-slate-100">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#E20613] border border-slate-100">
          <i data-lucide="file-text" size="22"></i>
        </div>

        <div>
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <h4 class="font-black text-slate-900 uppercase">${escapeHtml(item.nombre_documento)}</h4>
            <span class="${status.badge} px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">
              ${escapeHtml(item.estado)}
            </span>
          </div>

          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            ${escapeHtml(item.tipo_nexo || item.entityType)} · ${escapeHtml(item.entityId || item.nexo_id)}
          </p>

          <p class="text-xs text-slate-400 mt-1">
            Vence: ${escapeHtml(item.fecha_vencimiento || 'N/A')}
          </p>
        </div>
      </div>

      <button type="button"
        onclick="openUpload('${escapeHtml(item.entityId || item.nexo_id)}', '${escapeHtml(item.nombre_documento)}', '${escapeHtml(item.entityType || item.tipo_nexo)}', '${escapeHtml(item.requisito_id || '')}')"
        class="px-5 py-3 rounded-2xl bg-[#E20613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#B90510]">
        ${escapeHtml(action)}
      </button>
    </div>
  `;
}

function renderEntitySummary(title, subtitle, compliance, icon) {
  const pct = clampPercent(compliance);

  return `
    <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100">
          <i data-lucide="${icon}" size="20"></i>
        </div>
        <div>
          <p class="font-black text-slate-900">${escapeHtml(title)}</p>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${escapeHtml(subtitle || '-')}</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full bg-[#E20613]" style="width: ${pct}%"></div>
        </div>
        <p class="text-sm font-black text-slate-900">${pct}%</p>
      </div>
    </div>
  `;
}

function getStatusMeta(status) {
  const estado = String(status || '').toUpperCase();

  if (estado === 'VIGENTE') return { badge: 'bg-emerald-50 text-emerald-600 border border-emerald-100' };
  if (estado === 'POR_VENCER') return { badge: 'bg-amber-50 text-amber-600 border border-amber-100' };
  if (estado === 'FALTANTE') return { badge: 'bg-red-50 text-red-600 border border-red-100' };
  if (estado === 'VENCIDO') return { badge: 'bg-red-50 text-red-700 border border-red-100' };
  if (estado === 'OBSERVADO') return { badge: 'bg-orange-50 text-orange-600 border border-orange-100' };
  if (estado === 'RECHAZADO') return { badge: 'bg-red-100 text-red-700 border border-red-200' };
  if (estado === 'PENDIENTE_VALIDACION') return { badge: 'bg-blue-50 text-blue-600 border border-blue-100' };

  return { badge: 'bg-slate-50 text-slate-500 border border-slate-100' };
}

function getActionLabelByStatus(status) {
  const estado = String(status || '').toUpperCase();

  if (estado === 'FALTANTE') return 'SUBIR';
  if (estado === 'VENCIDO') return 'REEMPLAZAR';
  if (estado === 'OBSERVADO') return 'CORREGIR';
  if (estado === 'RECHAZADO') return 'CORREGIR';
  if (estado === 'POR_VENCER') return 'RENOVAR';

  return 'REVISAR';
}

function renderStatBlock(id, label, val, color, sub, trend = '') {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerHTML = `
    <div class="space-y-1">
      <p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">${escapeHtml(label)}</p>
      <div class="flex items-baseline gap-2">
        <h3 class="text-[42px] font-black leading-none tracking-tighter" style="color: ${color}">${clampPercent(val)}%</h3>
        ${trend ? `<span class="text-xs font-bold text-emerald-400">${escapeHtml(trend)}</span>` : ''}
      </div>
    </div>
    <p class="text-[11px] font-medium text-slate-500 mt-4">${escapeHtml(sub)}</p>
  `;
}

function renderFleet() {
  const tbody = document.getElementById('fleet-table-body');
  if (!tbody) return;

  const units = state.data.units || [];

  let html = units.map(u => `
    <tr class="hover:bg-slate-50/50 transition-all">
      
      <td class="px-4 py-5 w-[140px] whitespace-nowrap">
        <p class="text-lg font-black text-slate-900 tracking-tight">
          ${escapeHtml(getUnitId(u))}
        </p>
      </td>

      <td class="px-4 py-5">
        <div class="space-y-1">
          <p class="text-xs font-black text-slate-900">
            ${escapeHtml(u.sistema || '-')}
          </p>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            ${escapeHtml(getUnitTipo(u))}
          </p>
        </div>
      </td>

      <td class="px-4 py-5">
        <div class="space-y-1">
          <p class="text-xs font-black text-slate-900">
            ${escapeHtml(u.marca || '-')}
          </p>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            ${escapeHtml(u.modelo || '-')}
          </p>
        </div>
      </td>

      <td class="px-4 py-5">
        <span class="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest">
          ${escapeHtml(u.linea_exclusiva || 'NO_EXCLUSIVA')}
        </span>
      </td>

      <td class="px-4 py-5">
        <span class="text-xs font-bold text-slate-700">
          ${escapeHtml(u.telefono || '-')}
        </span>
      </td>

      <td class="px-4 py-5">
        <span class="text-xs font-bold text-slate-700">
          ${escapeHtml(u.poliza || '-')}
        </span>
      </td>

      <td class="px-4 py-5">
        <div class="flex items-center gap-4">
          <div class="flex-1 w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-500" style="width: ${clampPercent(u.compliance)}%"></div>
          </div>
          <span class="text-sm font-black text-slate-900">
            ${clampPercent(u.compliance)}%
          </span>
        </div>
      </td>

      <td class="px-4 py-5 text-right">
        <button onclick="toggleDropdown(event, '${escapeHtml(getUnitId(u))}')" class="btn-action-trigger">
          <i data-lucide="more-vertical" size="18"></i>
        </button>
      </td>

    </tr>
  `).join('');

  html += `
    <tr class="hover:bg-slate-50/50 transition-all group">
      <td class="px-4 py-5">
        <button onclick="openUnitModal()" class="btn-primary whitespace-nowrap shadow-sm hover:translate-y-[-2px]">
          <i data-lucide="plus" size="18"></i>
          Registrar Unidad
        </button>
      </td>

      <td colspan="7"></td>
    </tr>
  `;

  tbody.innerHTML = html;

  refreshIcons();
}

function renderCrew() {
  const grid = document.getElementById('crew-grid');
  if (!grid) return;

  const search = document.getElementById('crew-search')?.value.trim().toLowerCase() || '';

const crew = (state.data.crew || []).filter(c => {
  const text = [
    c.dni,
    c.id,
    getCrewName(c),
    getCrewRole(c),
    c.placa,
    c.estado
  ].filter(Boolean).join(' ').toLowerCase();

  return !search || text.includes(search);
});

  grid.innerHTML = crew.length
    ? crew.map(c => {
        const compliance = clampPercent(c.compliance || 0);
        const placa = c.placa || 'SIN ASIGNAR';
        const isInactive = String(c.estado || '').toUpperCase() === 'INACTIVO';
        const crewId = c.id || c.dni;

        const docs = (state.data.docs || []).filter(d =>
          String(d.entityType).toLowerCase() === 'tripulacion' &&
          String(d.entityId) === String(crewId)
        );
        
        const pendingCount = docs.filter(d =>
          ['FALTANTE', 'PENDIENTE_VALIDACION'].includes(String(d.status || '').toUpperCase())
        ).length;
        
        const observedCount = docs.filter(d =>
          String(d.status || '').toUpperCase() === 'OBSERVADO'
        ).length;
        
        const expiredCount = docs.filter(d =>
          String(d.status || '').toUpperCase() === 'VENCIDO'
        ).length;

        return `
          <div class="p-6 bg-white rounded-[36px] border border-slate-100 shadow-xl shadow-slate-100/50 group hover:border-red-100 transition-all ${isInactive ? 'opacity-70' : ''}">
            
            <div class="flex items-start justify-between gap-4 mb-5">
              <div class="flex items-start gap-4 min-w-0">
                <div class="w-16 h-16 bg-slate-50 border border-red-100 rounded-2xl flex items-center justify-center text-[#E20613] shrink-0">
                  <i data-lucide="user" size="26"></i>
                </div>

                <div class="min-w-0">
                  <h4 class="font-black text-slate-900 leading-tight uppercase text-[15px] break-words">
                    ${escapeHtml(getCrewName(c))}
                  </h4>

                  <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    DNI: ${escapeHtml(c.dni || c.id || '-')}
                  </p>

                  <p class="text-[12px] font-black text-[#E20613] uppercase tracking-widest mt-2">
                    ${escapeHtml(getCrewRole(c))}
                  </p>

                  <p class="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    ${escapeHtml(placa)}
                  </p>
                </div>
              </div>

              <div class="relative shrink-0">
                <button
                  type="button"
                  onclick="toggleCrewDropdown(event, '${escapeHtml(c.dni || c.id)}')"
                  class="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:bg-slate-50 hover:text-slate-500 transition-all"
                >
                  <i data-lucide="more-vertical" size="18"></i>
                </button>
              </div>
            </div>

            <div class="space-y-3 mb-5">
              <div class="flex justify-between items-center text-[11px] font-bold uppercase tracking-widest text-slate-400">
                <span>Cumplimiento</span>
                <span class="text-slate-900">${compliance}%</span>
              </div>

              <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-[#E20613]" style="width: ${compliance}%"></div>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3 mb-5">
              <div class="rounded-[22px] bg-slate-50 p-4 text-center">
                <p class="text-3xl font-black text-slate-900 leading-none">${pendingCount}</p>
                <p class="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Pend.</p>
              </div>

              <div class="rounded-[22px] bg-amber-50 p-4 text-center">
                <p class="text-3xl font-black text-amber-600 leading-none">${observedCount}</p>
                <p class="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-500">Obs.</p>
              </div>

              <div class="rounded-[22px] bg-rose-50 p-4 text-center">
                <p class="text-3xl font-black text-rose-600 leading-none">${expiredCount}</p>
                <p class="mt-2 text-[10px] font-black uppercase tracking-widest text-rose-500">Venc.</p>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 ${isInactive ? 'bg-slate-300' : 'bg-emerald-500'} rounded-full"></div>
                <span class="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                  ${escapeHtml(c.estado || 'ACTIVO')}
                </span>
              </div>

              <span class="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                Tripulante
              </span>
            </div>
          </div>
        `;
      }).join('')
    : `
      <div class="col-span-3 flex flex-col items-center justify-center py-20 gap-6">
        <p class="text-slate-400 font-bold">No hay tripulantes registrados.</p>
        <button type="button" onclick="openCrewModal()" class="btn-primary">
          <i data-lucide="plus" size="18"></i>
          Registrar Tripulante
        </button>
      </div>
    `;

  refreshIcons();
}

function toggleCrewDropdown(event, crewId) {
  event.stopPropagation();

  closeCrewDropdown();

  const existing = document.getElementById('crew-card-dropdown');
  if (existing) existing.remove();

  state.activeCrewId = crewId;
  state.activeCrewMenuOpen = true;

  const crew = (state.data.crew || []).find(c =>
    String(c.dni || c.id) === String(crewId)
  );

  if (!crew) return;

  const isInactive = String(crew.estado || '').toUpperCase() === 'INACTIVO';

  const menu = document.createElement('div');
  menu.id = 'crew-card-dropdown';
  menu.className = 'fixed z-[9999] w-56 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/50 p-2';

  menu.innerHTML = `
    <button type="button" onclick="handleCrewDropdownAction('edit')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-left text-sm font-bold text-slate-700">
      <i data-lucide="pencil" size="16"></i>
      Actualizar
    </button>

    <button type="button" onclick="handleCrewDropdownAction('docs')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-left text-sm font-bold text-slate-700">
      <i data-lucide="folder-open" size="16"></i>
      Gestionar documentos
    </button>

    <div class="h-px bg-slate-100 my-2"></div>

    <button type="button" onclick="handleCrewDropdownAction('activate')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-50 text-left text-sm font-bold text-emerald-700 ${!isInactive ? 'opacity-50 pointer-events-none' : ''}">
      <i data-lucide="badge-check" size="16"></i>
      Marcar Activo
    </button>

    <button type="button" onclick="handleCrewDropdownAction('deactivate')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-50 text-left text-sm font-bold text-rose-700 ${isInactive ? 'opacity-50 pointer-events-none' : ''}">
      <i data-lucide="user-x" size="16"></i>
      Marcar Inactivo
    </button>
  `;

  document.body.appendChild(menu);

  const rect = event.currentTarget.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 8}px`;
  menu.style.left = `${Math.max(16, rect.right - 224)}px`;

  refreshIcons();
}

function closeCrewDropdown() {
  const menu = document.getElementById('crew-card-dropdown');
  if (menu) menu.remove();

  state.activeCrewId = null;
  state.activeCrewMenuOpen = false;
}

async function handleCrewDropdownAction(action) {
  const crewId = state.activeCrewId;
  const crew = (state.data.crew || []).find(c =>
    String(c.dni || c.id) === String(crewId)
  );

  closeCrewDropdown();

  if (!crew) return;

  if (action === 'edit') {
    openCrewModal(crewId);
    return;
  }

  if (action === 'docs') {
  viewCrewDetails(crewId);
  return;
}

  if (action === 'activate') {
    await changeCrewStatus(crew, 'ACTIVO');
    return;
  }

  if (action === 'deactivate') {
    await changeCrewStatus(crew, 'INACTIVO');
    return;
  }
}

async function changeCrewStatus(crew, estado) {
  const confirmText =
    estado === 'INACTIVO'
      ? `¿Desea marcar como INACTIVO a ${getCrewName(crew)}?`
      : `¿Desea marcar como ACTIVO a ${getCrewName(crew)}?`;

  if (!confirm(confirmText)) return;

  setLoading(true, estado === 'INACTIVO' ? 'Desactivando tripulante...' : 'Activando tripulante...');

  try {
    const payload = {
      user: state.user,
      dni: crew.dni || crew.id,
      nombres: crew.nombres || '',
      apellidos: crew.apellidos || '',
      cargo: crew.cargo || crew.rol || '',
      placa: crew.placa || '',
      estado
    };

    const res = await api.call('updateCrew', payload);

    await reloadData(true);

    alert(res?.message || `Tripulante marcado como ${estado}.`);
  } catch (error) {
    alert(error.message || 'No se pudo actualizar el estado del tripulante.');
  } finally {
    setLoading(false);
  }
}

function filterDocs(type, ev = null) {
  state.filterType = type;

  document.querySelectorAll('.doc-filter-btn').forEach(btn => {
    btn.classList.add('bg-white', 'text-slate-500', 'border-slate-100');
    btn.classList.remove('bg-slate-900', 'text-white', 'shadow-xl');
  });

  const target = ev?.target || document.querySelector(`[onclick="filterDocs('${type}')"]`);

  if (target) {
    target.classList.remove('bg-white', 'text-slate-500', 'border-slate-100');
    target.classList.add('bg-slate-900', 'text-white', 'shadow-xl');
  }

  renderDocs();
}

function renderDocs() {
  const grid = document.getElementById('docs-grid');
  if (!grid) return;

  let docs = state.filterType === 'all'
  ? state.data.docs
  : state.data.docs.filter(d => d.entityType === state.filterType);

if (state.filterStatus !== 'all') {
  docs = docs.filter(d =>
    String(d.status || '').toUpperCase() === String(state.filterStatus || '').toUpperCase()
  );
}

  if (!docs.length) {
  grid.className = 'block';
  grid.innerHTML = `
    <div class="space-y-5">
      ${renderDocsStatusFilters()}

      <div class="card-brand p-6 text-center text-slate-400 font-bold">
        No hay documentos para mostrar.
      </div>
    </div>
  `;
  return;
}

  grid.className = 'block';

  grid.innerHTML = `
  <div class="space-y-5">
    ${renderDocsStatusFilters()}

    <div class="card-brand p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          ${renderDocsTableHead(state.filterType)}
          <tbody class="divide-y divide-slate-50">
            ${docs.map(doc => renderDocsTableRow(doc, state.filterType)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
`;

  refreshIcons();
}

function renderDocsStatusFilters() {
  const filters = [
    ['all', 'Todos'],
    ['FALTANTE', 'Faltantes'],
    ['OBSERVADO', 'Observados'],
    ['RECHAZADO', 'Rechazados'],
    ['VENCIDO', 'Vencidos'],
    ['POR_VENCER', 'Por vencer'],
    ['PENDIENTE_VALIDACION', 'En validación'],
    ['VIGENTE', 'Vigentes']
  ];

  return `
    <div class="flex flex-wrap gap-3">
      ${filters.map(([status, label]) => {
        const active = state.filterStatus === status;

        return `
          <button type="button"
            data-doc-status="${status}"
            onclick="filterDocsStatus('${status}')"
            class="doc-status-filter-btn px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              active
                ? 'bg-[#E20613] text-white shadow-xl border-transparent'
                : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
            }">
            ${label}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function filterDocsStatus(status) {
  state.filterStatus = status;

  document.querySelectorAll('.doc-status-filter-btn').forEach(btn => {
    btn.classList.add('bg-white', 'text-slate-500', 'border-slate-100');
    btn.classList.remove('bg-[#E20613]', 'text-white', 'shadow-xl');
  });

  const target = document.querySelector(`[data-doc-status="${status}"]`);

  if (target) {
    target.classList.remove('bg-white', 'text-slate-500', 'border-slate-100');
    target.classList.add('bg-[#E20613]', 'text-white', 'shadow-xl');
  }

  renderDocs();
}

function renderDocsTableHead(type) {
  if (type === 'unidad') {
    return `
      <thead class="bg-slate-50 border-b border-slate-100">
        <tr class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
          <th class="px-4 py-5">Placa</th>
          <th class="px-4 py-5">Documento</th>
          <th class="px-4 py-5">Estado</th>
          <th class="px-4 py-5">Vence</th>
          <th class="px-4 py-5 text-right">Acción</th>
        </tr>
      </thead>
    `;
  }

  if (type === 'tripulacion') {
    return `
      <thead class="bg-slate-50 border-b border-slate-100">
        <tr class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
          <th class="px-4 py-5">DNI</th>
          <th class="px-4 py-5">Nombre completo</th>
          <th class="px-4 py-5">Documento</th>
          <th class="px-4 py-5">Estado</th>
          <th class="px-4 py-5">Vence</th>
          <th class="px-4 py-5 text-right">Acción</th>
        </tr>
      </thead>
    `;
  }

  if (type === 'empresa') {
    return `
      <thead class="bg-slate-50 border-b border-slate-100">
        <tr class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
          <th class="px-4 py-5">Documento</th>
          <th class="px-4 py-5">Estado</th>
          <th class="px-4 py-5">Vence</th>
          <th class="px-4 py-5 text-right">Acción</th>
        </tr>
      </thead>
    `;
  }

  return `
    <thead class="bg-slate-50 border-b border-slate-100">
      <tr class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
        <th class="px-4 py-5">Documento</th>
        <th class="px-4 py-5">Pertenece a</th>
        <th class="px-4 py-5">Estado</th>
        <th class="px-4 py-5">Vence</th>
        <th class="px-4 py-5 text-right">Acción</th>
      </tr>
    </thead>
  `;
}

function renderDocsTableRow(doc, type) {
  const status = getStatusMeta(doc.status);
  const actionLabel = getActionLabelByStatus(doc.status);
  const actionButton = renderDocumentActionButton(doc, actionLabel);

  if (type === 'unidad') {
    return `
      <tr class="hover:bg-slate-50/50 transition-all">
        <td class="px-4 py-5 font-black text-slate-900">${escapeHtml(doc.entityId)}</td>
        <td class="px-4 py-5">${renderDocNameCell(doc)}</td>
        <td class="px-4 py-5">${renderDocStatusBadge(doc.status, status)}</td>
        <td class="px-4 py-5 text-sm font-bold text-slate-500">${escapeHtml(doc.expiryDate || 'N/A')}</td>
        <td class="px-4 py-5 text-right">${actionButton}</td>
      </tr>
    `;
  }

  if (type === 'tripulacion') {
    const person = getCrewByDoc(doc);

    return `
      <tr class="hover:bg-slate-50/50 transition-all">
        <td class="px-4 py-5 font-black text-slate-900">${escapeHtml(doc.entityId)}</td>
        <td class="px-4 py-5 font-bold text-slate-700">${escapeHtml(person?.nombre || '-')}</td>
        <td class="px-4 py-5">${renderDocNameCell(doc)}</td>
        <td class="px-4 py-5">${renderDocStatusBadge(doc.status, status)}</td>
        <td class="px-4 py-5 text-sm font-bold text-slate-500">${escapeHtml(doc.expiryDate || 'N/A')}</td>
        <td class="px-4 py-5 text-right">${actionButton}</td>
      </tr>
    `;
  }

  if (type === 'empresa') {
    return `
      <tr class="hover:bg-slate-50/50 transition-all">
        <td class="px-4 py-5">${renderDocNameCell(doc)}</td>
        <td class="px-4 py-5">${renderDocStatusBadge(doc.status, status)}</td>
        <td class="px-4 py-5 text-sm font-bold text-slate-500">${escapeHtml(doc.expiryDate || 'N/A')}</td>
        <td class="px-4 py-5 text-right">${actionButton}</td>
      </tr>
    `;
  }

  return `
    <tr class="hover:bg-slate-50/50 transition-all">
      <td class="px-4 py-5">${renderDocNameCell(doc)}</td>
      <td class="px-4 py-5">
        <p class="font-black text-slate-900">${escapeHtml(getDocOwnerLabel(doc))}</p>
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${escapeHtml(doc.entityType)}</p>
      </td>
      <td class="px-4 py-5">${renderDocStatusBadge(doc.status, status)}</td>
      <td class="px-4 py-5 text-sm font-bold text-slate-500">${escapeHtml(doc.expiryDate || 'N/A')}</td>
      <td class="px-4 py-5 text-right">${actionButton}</td>
    </tr>
  `;
}

function renderDocNameCell(doc) {
  return `
    <div>
      <p class="font-black text-slate-900 uppercase">${escapeHtml(doc.type || doc.nombre_documento)}</p>
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${escapeHtml(doc.grupo_documental || 'GENERAL')}</p>
    </div>
  `;
}

function renderDocStatusBadge(status, meta) {
  return `
    <span class="${meta.badge} px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
      ${escapeHtml(status || '-')}
    </span>
  `;
}

function renderDocumentActionButton(doc, actionLabel) {
  const estado = String(doc.status || '').toUpperCase();

  if (estado === 'VIGENTE' && doc.fileUrl) {
    return `
      <button type="button"
        onclick="window.open('${escapeHtml(doc.fileUrl)}', '_blank')"
        class="px-4 py-3 rounded-2xl bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100">
        VER
      </button>
    `;
  }

  if (estado === 'PENDIENTE_VALIDACION') {
    return `
      <span class="px-4 py-3 rounded-2xl bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest">
        EN VALIDACIÓN
      </span>
    `;
  }

  return `
    <button type="button"
      onclick="openUpload('${escapeHtml(doc.entityId)}', '${escapeHtml(doc.type)}', '${escapeHtml(doc.entityType)}', '${escapeHtml(doc.requisito_id || '')}')"
      class="px-4 py-3 rounded-2xl bg-[#E20613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#B90510]">
      ${escapeHtml(actionLabel)}
    </button>
  `;
}

function getCrewByDoc(doc) {
  return (state.data.crew || []).find(person =>
    String(person.id || person.dni) === String(doc.entityId)
  );
}

function getDocOwnerLabel(doc) {
  if (doc.entityType === 'unidad') return doc.entityId;

  if (doc.entityType === 'tripulacion') {
    const person = getCrewByDoc(doc);
    return person?.nombre || doc.entityId;
  }

  if (doc.entityType === 'empresa') {
    return state.user?.razon_social || state.data.empresa?.razon_social || 'Empresa';
  }

  return doc.entityId || '-';
}

function renderCompany() {
  setUserHeader(state.user);

  const badge = document.getElementById('company-compliance-badge');
  if (badge) {
    const val = clampPercent(state.data.stats?.companyCompliance || 0);
    badge.innerText = `${val}% CUMPLIMIENTO`;
  }
}

function openUnitModal(id = null) {
  const modal = document.getElementById('unit-modal');
  const form = document.getElementById('unit-form');
  const title = document.getElementById('unit-modal-title');
  const modeInput = document.getElementById('unit-form-mode');

  if (!modal || !form) {
    console.error('Falta #unit-modal o #unit-form en index.html.');
    return;
  }

  form.reset();
  toggleLineaExclusiva(false);

  const placaInput = document.getElementById('form-unit-id');

  if (id) {
    const unit = state.data.units.find(u => getUnitId(u) === id);

    if (!unit) {
      alert('Unidad no encontrada.');
      return;
    }

    if (title) title.innerText = 'Actualizar Unidad';
    if (modeInput) modeInput.value = 'edit';

    placaInput.value = getUnitId(unit);
    placaInput.readOnly = true;

    document.getElementById('form-unit-sistema').value = unit.sistema || '';
    document.getElementById('form-unit-tipo').value = getUnitTipo(unit);
    document.getElementById('form-unit-marca').value = unit.marca || '';
    document.getElementById('form-unit-modelo').value = unit.modelo || '';
    document.getElementById('form-unit-capacidad').value = unit.capacidad || '';
    document.getElementById('form-unit-poliza').value = unit.poliza || '';

    const estadoInput = document.getElementById('form-unit-estado');
    if (estadoInput) estadoInput.value = unit.estado || 'ACTIVO';

    const lineaValue = unit.linea || unit.linea_exclusiva || '';
    const isExclusiva = lineaValue && lineaValue !== 'NO_EXCLUSIVA';
    document.getElementById('form-unit-exclusiva').checked = isExclusiva;
    toggleLineaExclusiva(isExclusiva);
    document.getElementById('form-unit-linea').value = isExclusiva ? lineaValue : '';

  } else {
    if (title) title.innerText = 'Registrar Unidad';
    if (modeInput) modeInput.value = 'create';
    placaInput.readOnly = false;
    const estadoInput = document.getElementById('form-unit-estado');
    if (estadoInput) estadoInput.value = 'ACTIVO';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  refreshIcons();
}

function closeUnitModal() {
  document.getElementById('unit-modal')?.classList.add('hidden');
  document.getElementById('unit-modal')?.classList.remove('flex');
}

function toggleLineaExclusiva(checked) {
  const wrapper = document.getElementById('wrapper-linea-exclusiva');

  if (!wrapper) return;

  if (checked) {
    wrapper.classList.remove('hidden');
  } else {
    wrapper.classList.add('hidden');
    const linea = document.getElementById('form-unit-linea');
    if (linea) linea.value = '';
  }
}

async function handleUnitSubmit(e) {
  e.preventDefault();

  const mode = document.getElementById('unit-form-mode')?.value || 'create';
  const placa = document.getElementById('form-unit-id')?.value.trim().toUpperCase();
  const sistema = document.getElementById('form-unit-sistema')?.value.trim();
  const tipoUnidad = document.getElementById('form-unit-tipo')?.value.trim();

  if (!placa || !sistema || !tipoUnidad) {
    alert('Complete placa, sistema y tipo de unidad.');
    return;
  }

const currentUnit = state.data.units.find(u => getUnitId(u) === placa);

 const payload = {
  user: state.user,
  mode,
  placa,
  sistema,
  tipo_unidad: tipoUnidad,
  marca: document.getElementById('form-unit-marca')?.value.trim() || '',
  modelo: document.getElementById('form-unit-modelo')?.value.trim() || '',
  año: document.getElementById('form-unit-anio')?.value.trim() || '',
  anio: document.getElementById('form-unit-anio')?.value.trim() || '',
  capacidad: document.getElementById('form-unit-capacidad')?.value.trim() || '',
  telefono: document.getElementById('form-unit-telefono')?.value.trim() || '',
  poliza: document.getElementById('form-unit-poliza')?.value.trim() || '',
  linea_exclusiva: document.getElementById('form-unit-exclusiva')?.checked
  ? document.getElementById('form-unit-linea')?.value.trim()
  : 'NO_EXCLUSIVA',
  estado: document.getElementById('form-unit-estado')?.value || 'ACTIVO'
};

  setLoading(true, mode === 'edit' ? 'Actualizando unidad...' : 'Registrando unidad...');

  try {
    const action = mode === 'edit' ? 'updateUnit' : 'createUnit';
    const res = await api.call(action, payload);

    closeUnitModal();
    await reloadData();

    alert(res?.message || 'Unidad guardada correctamente.');

  } catch (error) {
    alert(error.message || 'Error guardando unidad.');
  } finally {
    setLoading(false);
  }
}

function openCrewModal(id = null) {
  const modal = document.getElementById('crew-modal');
  const form = document.getElementById('crew-form');
  const placaSelect = document.getElementById('form-crew-placa');
  const modeInput = document.getElementById('crew-form-mode');
  const title = document.getElementById('crew-modal-title');
  const dniInput = document.getElementById('form-crew-dni');

  if (!modal || !form) {
    console.error('Falta #crew-modal o #crew-form en index.html.');
    return;
  }

  form.reset();

  if (modeInput) {
    modeInput.value = id ? 'edit' : 'create';
  }

  if (placaSelect) {
    placaSelect.innerHTML = '<option value="">Sin asignar</option>';

    (state.data.units || []).forEach(unit => {
      const option = document.createElement('option');
      option.value = getUnitId(unit);
      option.textContent = `${getUnitId(unit)} — ${unit.sistema || ''}`;
      placaSelect.appendChild(option);
    });
  }

  if (id) {
    const person = (state.data.crew || []).find(c =>
      String(c.id || c.dni) === String(id)
    );

    if (!person) {
      alert('Tripulante no encontrado.');
      return;
    }

    if (title) title.innerText = 'Actualizar Tripulante';

    if (dniInput) {
      dniInput.value = person.dni || person.id || '';
      dniInput.readOnly = true;
      dniInput.classList.add('bg-slate-50', 'text-slate-400');
    }

    const nombresInput = document.getElementById('form-crew-nombres');
    const apellidosInput = document.getElementById('form-crew-apellidos');
    const cargoInput = document.getElementById('form-crew-cargo');
    const placaInput = document.getElementById('form-crew-placa');

    if (nombresInput) nombresInput.value = person.nombres || '';
    if (apellidosInput) apellidosInput.value = person.apellidos || '';
    if (cargoInput) cargoInput.value = person.cargo || person.rol || '';
    if (placaInput) placaInput.value = person.placa || '';

  } else {
    if (title) title.innerText = 'Registrar Tripulante';

    if (dniInput) {
      dniInput.value = '';
      dniInput.readOnly = false;
      dniInput.classList.remove('bg-slate-50', 'text-slate-400');
    }
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  refreshIcons();
}

function closeCrewModal() {
  const modal = document.getElementById('crew-modal');
  const dniInput = document.getElementById('form-crew-dni');
  const modeInput = document.getElementById('crew-form-mode');
  const title = document.getElementById('crew-modal-title');

  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  if (dniInput) {
    dniInput.readOnly = false;
    dniInput.classList.remove('bg-slate-50', 'text-slate-400');
  }

  if (modeInput) {
    modeInput.value = 'create';
  }

  if (title) {
    title.innerText = 'Registrar Tripulante';
  }
}

async function handleCrewSubmit(event) {
  event.preventDefault();

  const mode = document.getElementById('crew-form-mode')?.value || 'create';

  const payload = {
    user: state.user,
    dni: document.getElementById('form-crew-dni')?.value.trim(),
    nombres: document.getElementById('form-crew-nombres')?.value.trim(),
    apellidos: document.getElementById('form-crew-apellidos')?.value.trim(),
    cargo: document.getElementById('form-crew-cargo')?.value.trim(),
    placa: document.getElementById('form-crew-placa')?.value.trim(),
    estado: mode === 'edit'
  ? ((state.data.crew || []).find(c =>
      String(c.id || c.dni) === String(document.getElementById('form-crew-dni')?.value.trim())
    )?.estado || 'ACTIVO')
  : 'ACTIVO'
  };

  if (!payload.dni || !payload.nombres || !payload.apellidos || !payload.cargo) {
    alert('Complete DNI, nombres, apellidos y cargo.');
    return;
  }

  setLoading(
    true,
    mode === 'edit'
      ? 'Actualizando tripulante...'
      : 'Registrando tripulante...'
  );

  try {
    const action = mode === 'edit'
      ? 'updateCrew'
      : 'createCrew';

    const res = await api.call(action, payload);

    closeCrewModal();

    await reloadData(true);

    alert(
      res?.message ||
      (mode === 'edit'
        ? 'Tripulante actualizado correctamente.'
        : 'Tripulante registrado correctamente.')
    );

  } catch (error) {
    alert(error.message || 'Error guardando tripulante.');
  } finally {
    setLoading(false);
  }
}

function openUpload(id, type, entityType = '', requisitoId = '') {
  const finalEntityType = entityType || state.filterType;

  state.activeDocEntityId = id;
  state.activeDocType = type;
  state.activeDocEntityType = finalEntityType;
  state.activeRequirementId = requisitoId;

  const doc = state.data.docs.find(d =>
    String(d.entityId) === String(id) &&
    String(d.type) === String(type) &&
    String(d.entityType) === String(finalEntityType)
  );

  const details = document.getElementById('upload-details');
  if (details) {
    details.innerHTML = `Sincronizando <strong>${escapeHtml(type)}</strong> para <strong>${escapeHtml(id)}</strong>`;
  }

  const fileInput = document.getElementById('upload-file');
const fileLabel = document.getElementById('upload-file-label');
const expiryInput = document.getElementById('upload-expiry');
const expiryWrapper = expiryInput?.closest('.space-y-2');

const polizaWrapper = document.getElementById('upload-poliza-wrapper');
const polizaInput = document.getElementById('upload-poliza');

if (fileInput) fileInput.value = '';
if (fileLabel) fileLabel.innerText = 'Seleccionar o Arrastrar Archivo';
if (expiryInput) expiryInput.value = '';
if (polizaInput) polizaInput.value = '';

const isSoat = String(type || '').trim().toUpperCase() === 'SOAT';

if (polizaWrapper) {
  if (isSoat && String(finalEntityType || '').toLowerCase() === 'unidad') {
    polizaWrapper.classList.remove('hidden');
  } else {
    polizaWrapper.classList.add('hidden');
  }
}

  if (doc && String(doc.requiere_vencimiento || '').toUpperCase() === 'NO') {
    if (expiryWrapper) expiryWrapper.classList.add('hidden');
  } else {
    if (expiryWrapper) expiryWrapper.classList.remove('hidden');
  }

  document.getElementById('upload-modal')?.classList.remove('hidden');
  document.getElementById('upload-modal')?.classList.add('flex');
}

function closeUpload() {
  document.getElementById('upload-modal')?.classList.add('hidden');
  document.getElementById('upload-modal')?.classList.remove('flex');
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };

    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function handleUploadDocument() {
  const fileInput = document.getElementById('upload-file');
  const expiryInput = document.getElementById('upload-expiry');
  const polizaInput = document.getElementById('upload-poliza');

  const file = fileInput?.files?.[0];

  if (!file) {
    alert('Seleccione un archivo.');
    return;
  }

  if (!state.activeDocType || !state.activeDocEntityId || !state.activeDocEntityType) {
    alert('No se pudo identificar el requisito documental.');
    return;
  }

  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png'
  ];

  if (!allowedTypes.includes(file.type)) {
    alert('Formato no permitido. Solo PDF, JPG, JPEG o PNG.');
    return;
  }

  const maxSizeMb = 10;

  if (file.size > maxSizeMb * 1024 * 1024) {
    alert('El archivo supera el máximo permitido de 10MB.');
    return;
  }

  const currentDoc = state.data.docs.find(d =>
    String(d.entityId) === String(state.activeDocEntityId) &&
    String(d.type) === String(state.activeDocType) &&
    String(d.entityType) === String(state.activeDocEntityType)
  );

  if (
    currentDoc &&
    String(currentDoc.requiere_vencimiento || '').toUpperCase() === 'SI' &&
    !expiryInput?.value
  ) {
    alert('Ingrese la fecha de vencimiento para este documento.');
    return;
  }

  const isSoatUpload =
  String(state.activeDocType || '').trim().toUpperCase() === 'SOAT' &&
  String(state.activeDocEntityType || '').toLowerCase() === 'unidad';

if (isSoatUpload && !polizaInput?.value.trim()) {
  alert('Ingrese el número de póliza SOAT.');
  return;
}

  setLoading(true, 'Subiendo documento...');

  try {
    const fileBase64 = await fileToBase64(file);

    const payload = {
  user: state.user,
  requisito_id: state.activeRequirementId || '',
  nombre_documento: state.activeDocType,
  nexo_id: state.activeDocEntityId,
  tipo_nexo: String(state.activeDocEntityType || '').toUpperCase(),
  fileBase64,
  fileName: file.name,
  mimeType: file.type || 'application/pdf',
  fecha_vencimiento: expiryInput?.value || '',
  poliza: isSoatUpload ? polizaInput?.value.trim() : ''
};

  const res = await api.call('uploadDocument', payload);
  
  closeUpload();
  
  alert(res?.message || 'Documento enviado a validación.');
  
  setTimeout(() => {
    refreshData(true, true);
  }, 300);

  } catch (error) {
    alert(error.message || 'Error subiendo documento.');
  } finally {
    setLoading(false);
  }
}

function toggleDropdown(event, id) {
  event.stopPropagation();

  const dropdown = document.getElementById('global-dropdown');
  if (!dropdown) return;

  const isOpen = dropdown.style.display === 'block';

  if (isOpen && state.activeDocId === id) {
    closeDropdown();
    return;
  }

  state.activeDocId = id;

  const rect = event.currentTarget.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + window.scrollY}px`;
  dropdown.style.left = `${rect.right - 160 + window.scrollX}px`;
  dropdown.style.display = 'block';

  refreshIcons();
}

function closeDropdown() {
  const dropdown = document.getElementById('global-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  state.activeDocId = null;
}

function handleMenuAction(action) {
  const unitId = state.activeDocId;
  const unit = state.data.units.find(u => getUnitId(u) === unitId);

  closeDropdown();

  if (!unit) return;

  if (action === 'details') {
    viewUnitDetails(getUnitId(unit));
  } else if (action === 'edit') {
    openUnitModal(getUnitId(unit));
  } else if (action === 'report') {
    alert(`Generando reporte consolidado para ${getUnitId(unit)}...`);
  }
}

function viewUnitDetails(id) {
  const unit = state.data.units.find(u => getUnitId(u) === id);
  const docs = state.data.docs.filter(d => d.entityId === id);

  if (!unit) return;

  const title = document.getElementById('details-modal-title');
  const subtitle = document.getElementById('details-modal-subtitle');

  if (title) title.innerText = `Documentación: ${getUnitId(unit)}`;
  if (subtitle) subtitle.innerText = `${unit.sistema || '-'} • ${getUnitTipo(unit)}`;

  const list = document.getElementById('details-docs-list');

  if (list) {
  if (!docs.length) {
    list.innerHTML = `
      <div class="text-center py-12 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100">
        <i data-lucide="file-warning" class="mx-auto text-slate-300 mb-4" size="48"></i>
        <p class="font-bold text-slate-500">No hay documentos configurados para esta unidad.</p>
      </div>
    `;
  } else {
    list.innerHTML = docs.map(d => renderEntityDocumentItem(d)).join('');
  }
}

  document.getElementById('details-modal')?.classList.remove('hidden');
  document.getElementById('details-modal')?.classList.add('flex');

  refreshIcons();
}

function viewCrewDetails(id) {
  const person = state.data.crew.find(c =>
    String(c.id || c.dni) === String(id)
  );

  const docs = state.data.docs.filter(d =>
    String(d.entityType).toLowerCase() === 'tripulacion' &&
    String(d.entityId) === String(id)
  );

  if (!person) return;

  const title = document.getElementById('details-modal-title');
  const subtitle = document.getElementById('details-modal-subtitle');
  const list = document.getElementById('details-docs-list');

  if (title) title.innerText = `Documentación: ${getCrewName(person)}`;
  if (subtitle) subtitle.innerText = `DNI ${person.dni || person.id} • ${getCrewRole(person)} • ${person.placa || 'SIN PLACA'}`;

  if (list) {
    list.innerHTML = docs.length
      ? docs.map(d => renderEntityDocumentItem(d)).join('')
      : `
        <div class="text-center py-12 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100">
          <i data-lucide="file-warning" class="mx-auto text-slate-300 mb-4" size="48"></i>
          <p class="font-bold text-slate-500">No hay documentos configurados para este tripulante.</p>
        </div>
      `;
  }

  document.getElementById('details-modal')?.classList.remove('hidden');
  document.getElementById('details-modal')?.classList.add('flex');

  refreshIcons();
}

function renderEntityDocumentItem(d) {
  const status = getStatusMeta(d.status);
  const actionLabel = getActionLabelByStatus(d.status);

  return `
    <div class="flex items-center justify-between gap-5 p-5 bg-white border border-slate-100 rounded-[28px] hover:shadow-lg transition-all">
      <div class="flex items-center gap-5">
        <div class="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#E20613] border border-slate-100">
          <i data-lucide="file-text" size="22"></i>
        </div>

        <div>
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-black text-slate-900 uppercase">${escapeHtml(d.type || d.nombre_documento)}</p>
            <span class="${status.badge} px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">
              ${escapeHtml(d.status)}
            </span>
          </div>

          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            ${escapeHtml(d.grupo_documental || 'GENERAL')}
          </p>

          <p class="text-xs text-slate-400 mt-1">
            Vence: ${escapeHtml(d.expiryDate || 'N/A')}
          </p>
        </div>
      </div>

      ${renderEntityDocumentAction(d, actionLabel)}
    </div>
  `;
}

function renderEntityDocumentAction(d, actionLabel) {
  const estado = String(d.status || '').toUpperCase();

  if (estado === 'VIGENTE' && d.fileUrl) {
    return `
      <button type="button"
        onclick="window.open('${escapeHtml(d.fileUrl)}', '_blank')"
        class="px-4 py-3 rounded-2xl bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100">
        VER
      </button>
    `;
  }

  if (estado === 'PENDIENTE_VALIDACION') {
    return `
      <span class="px-4 py-3 rounded-2xl bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest">
        EN VALIDACIÓN
      </span>
    `;
  }

  return `
    <button type="button"
      onclick="openUpload('${escapeHtml(d.entityId)}', '${escapeHtml(d.type)}', '${escapeHtml(d.entityType)}', '${escapeHtml(d.requisito_id || '')}')"
      class="px-4 py-3 rounded-2xl bg-[#E20613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#B90510]">
      ${escapeHtml(actionLabel)}
    </button>
  `;
}

function closeDetailsModal() {
  document.getElementById('details-modal')?.classList.add('hidden');
  document.getElementById('details-modal')?.classList.remove('flex');
}

function showLoader(message = 'Procesando...') {
  const loader = document.getElementById('app-loader');
  const msgEl = document.getElementById('app-loader-message');

  if (loader && msgEl) {
    msgEl.innerText = message;
    loader.classList.remove('hidden');
    loader.classList.add('flex');

    setTimeout(() => {
      loader.classList.add('opacity-100');
      loader.classList.remove('opacity-0');
    }, 10);
  }
}

function hideLoader() {
  const loader = document.getElementById('app-loader');

  if (loader) {
    loader.classList.add('opacity-0');
    loader.classList.remove('opacity-100');

    setTimeout(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    }, 300);
  }
}

function setLoading(val, message) {
  if (val) showLoader(message);
  else hideLoader();
}

window.addEventListener('click', e => {
  if (!e.target.closest('#global-dropdown')) {
    closeDropdown();
  }

  if (!e.target.closest('#crew-card-dropdown')) {
    closeCrewDropdown();
  }
});

window.addEventListener('scroll', () => {
  const header = document.getElementById('main-header');
  if (!header) return;

  if (window.scrollY > 20) {
    header.classList.add('shadow-md', 'border-slate-100', 'bg-white');
    header.classList.remove('border-transparent', 'bg-white/80');
  } else {
    header.classList.remove('shadow-md', 'border-slate-100', 'bg-white');
    header.classList.add('border-transparent', 'bg-white/80');
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  refreshIcons();

  const uploadFile = document.getElementById('upload-file');

  if (uploadFile) {
    uploadFile.addEventListener('change', () => {
      const label = document.getElementById('upload-file-label');

      if (label) {
        label.innerText =
          uploadFile.files?.[0]?.name ||
          'Seleccionar o Arrastrar Archivo';
      }
    });
  }

  const crewSearch = document.getElementById('crew-search');

  if (crewSearch) {
    crewSearch.addEventListener('input', () => {
      renderCrew();
    });
  }

  if (state.user) {
    showAppScreen();

    setUserHeader(state.user);

    try {
      await reloadData(true);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error actualizando datos.');
    }

  } else {
    showLoginScreen();
  }
});

window.switchTab = switchTab;
window.handleLogin = handleLogin;
window.logout = logout;
window.refreshData = refreshData;
window.filterDocs = filterDocs;
window.filterDocsStatus = filterDocsStatus;
window.openUpload = openUpload;
window.closeUpload = closeUpload;
window.openUnitModal = openUnitModal;
window.closeUnitModal = closeUnitModal;
window.toggleLineaExclusiva = toggleLineaExclusiva;
window.handleUnitSubmit = handleUnitSubmit;
window.openCrewModal = openCrewModal;
window.closeCrewModal = closeCrewModal;
window.handleCrewSubmit = handleCrewSubmit;
window.toggleDropdown = toggleDropdown;
window.handleMenuAction = handleMenuAction;
window.closeDetailsModal = closeDetailsModal;
window.viewCrewDetails = viewCrewDetails;
window.handleUploadDocument = handleUploadDocument;
window.toggleCrewDropdown = toggleCrewDropdown;
window.handleCrewDropdownAction = handleCrewDropdownAction;
