import CONFIG from './config.js';

const SESSION_KEY = 'htbpdt_asistente_session_v3';
const REQUEST_TIMEOUT_MS = 25000;

const state = {
  user: getStoredSession(),
  loading: false,
  activeTab: 'dashboard',
  data: {
    units: [],
    crew: [],
    docs: [],
    historial: [],
    requisitos: [],
    stats: null
  },
  filterType: 'all',
  activeDocId: null,
activeDocType: null,
activeDocEntityId: null,
activeDocEntityType: null,
  refreshing: false
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
      portal: 'ASISTENTE'
    });

    state.user = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));

    document.getElementById('login-modal')?.classList.add('hidden');
    document.getElementById('app-container')?.classList.remove('hidden');
    document.body.classList.remove('overflow-hidden');

    setUserHeader(user);

    await reloadData();

  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    state.user = null;
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
      stats: res.stats || null
    };

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
    entityId: d.entityId || d.nexo_id || d.nexo,
    entityType: String(d.entityType || d.tipo_nexo || '').toLowerCase(),
    type: d.type || d.nombre_documento || d.documento,
    status: d.status || d.estado || d.estado_validacion || d.estado_vigencia || '-',
    expiryDate: d.expiryDate || d.fecha_vencimiento || d.vencimiento || '',
    fileUrl: d.fileUrl || d.archivo_url_actual || d.ruta_drive || ''
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
  const { stats, units, crew } = state.data;
  if (!stats) return;

  const globalVal = clampPercent(stats.companyCompliance || 0);

  const ring = document.getElementById('compliance-ring');
  const valText = document.getElementById('compliance-val');
  const offset = 263.89 * (1 - globalVal / 100);

  if (valText) valText.innerText = `${globalVal}%`;
  if (ring) setTimeout(() => ring.style.strokeDashoffset = offset, 100);

  renderStatBlock('stat-flota', 'Flota', stats.unitsCompliance || 0, '#10B981', 'Requisitos de unidad al día', '');
  renderStatBlock('stat-trip', 'Tripulación', stats.crewCompliance || 0, '#F59E0B', 'Licencias y capacitaciones', '');
  renderStatBlock('stat-empresa', 'Empresa', stats.companyCompliance || 0, '#3B82F6', 'Carga tributaria y legal', '');

  const alertEl = document.getElementById('expired-alert');

  if (alertEl) {
    if ((stats.expiredTodayCount || 0) > 0) {
      alertEl.classList.remove('hidden');
      alertEl.classList.add('flex');

      const text = document.getElementById('expired-text');
      if (text) {
        text.innerHTML = `Hay <strong>${stats.expiredTodayCount} documentos vencidos</strong> que requieren atención.`;
      }
    } else {
      alertEl.classList.add('hidden');
      alertEl.classList.remove('flex');
    }
  }

  const fleetContainer = document.getElementById('fleet-summary-list');

  if (fleetContainer) {
    fleetContainer.innerHTML = units.length
      ? units.slice(0, 3).map(u => `
          <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100">
                <i data-lucide="truck" size="20"></i>
              </div>
              <div>
                <p class="font-black text-slate-900">${escapeHtml(getUnitId(u))}</p>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${escapeHtml(u.sistema || '-')}</p>
              </div>
            </div>
            <p class="text-sm font-black text-emerald-500">${clampPercent(u.compliance)}%</p>
          </div>
        `).join('')
      : `<div class="p-8 text-center text-slate-400 font-bold">No hay unidades registradas.</div>`;
  }

  const crewContainer = document.getElementById('crew-summary-list');

  if (crewContainer) {
    crewContainer.innerHTML = crew.length
      ? crew.slice(0, 3).map(c => `
          <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100">
                <i data-lucide="user" size="20"></i>
              </div>
              <div>
                <p class="font-black text-slate-900">${escapeHtml(getCrewName(c))}</p>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${escapeHtml(getCrewRole(c))}</p>
              </div>
            </div>
            <span class="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase">REVISAR</span>
          </div>
        `).join('')
      : `<div class="p-8 text-center text-slate-400 font-bold">No hay tripulantes registrados.</div>`;
  }

  refreshIcons();
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
      <td class="px-8 py-6 font-black text-slate-900">${escapeHtml(getUnitId(u))}</td>
      <td class="px-8 py-6">
        <div class="space-y-1">
          <p class="text-xs font-bold text-slate-600">${escapeHtml(u.sistema || '-')}</p>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${escapeHtml(getUnitTipo(u))}</p>
        </div>
      </td>
      <td class="px-8 py-6">
        <div class="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
          <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
          ${escapeHtml(u.estado || 'ACTIVO')}
        </div>
      </td>
      <td class="px-8 py-6">
        <div class="flex items-center gap-4">
          <div class="flex-1 w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-500" style="width: ${clampPercent(u.compliance)}%"></div>
          </div>
          <span class="text-sm font-black text-slate-900">${clampPercent(u.compliance)}%</span>
        </div>
      </td>
      <td class="px-8 py-6 text-right">
        <button onclick="toggleDropdown(event, '${escapeHtml(getUnitId(u))}')" class="btn-action-trigger">
          <i data-lucide="more-vertical" size="18"></i>
        </button>
      </td>
    </tr>
  `).join('');

  html += `
    <tr class="hover:bg-slate-50/50 transition-all group">
      <td class="px-8 py-6">
        <button onclick="openUnitModal()" class="btn-primary whitespace-nowrap shadow-sm hover:translate-y-[-2px]">
          <i data-lucide="plus" size="18"></i>
          Registrar Unidad
        </button>
      </td>
      <td class="px-8 py-6"></td>
      <td class="px-8 py-6"></td>
      <td class="px-8 py-6"></td>
      <td class="px-8 py-6"></td>
    </tr>
  `;

  tbody.innerHTML = html;
  refreshIcons();
}

function renderCrew() {
  const grid = document.getElementById('crew-grid');
  if (!grid) return;

  const crew = state.data.crew || [];

  grid.innerHTML = crew.length
    ? crew.map(c => `
        <div class="p-8 bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-100/50 group hover:border-red-100 transition-all">
          <div class="flex items-start justify-between mb-8">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-[#E20613] group-hover:border-red-100 transition-all">
                <i data-lucide="user" size="24"></i>
              </div>
              <div>
                <h4 class="font-black text-slate-900 leading-tight uppercase">${escapeHtml(getCrewName(c))}</h4>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">${escapeHtml(getCrewRole(c))}</p>
              </div>
            </div>
            <button class="text-slate-200"><i data-lucide="more-vertical" size="18"></i></button>
          </div>

          <div class="space-y-4">
            <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>Cumplimiento</span>
              <span class="text-slate-900">${clampPercent(c.compliance)}%</span>
            </div>
            <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-[#E20613]" style="width: ${clampPercent(c.compliance)}%"></div>
            </div>
          </div>

          <div class="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span class="text-[9px] font-black text-slate-400 tracking-widest uppercase">${escapeHtml(c.estado || 'ACTIVO')}</span>
            </div>
            <button class="text-[11px] font-bold text-[#E20613] hover:underline">Ver Perfil</button>
          </div>
        </div>
      `).join('')
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

function filterDocs(type) {
  state.filterType = type;

  document.querySelectorAll('.doc-filter-btn').forEach(btn => {
    btn.classList.add('bg-white', 'text-slate-500', 'border-slate-100');
    btn.classList.remove('bg-slate-900', 'text-white', 'shadow-xl');
  });

  if (event?.target) {
    event.target.classList.remove('bg-white', 'text-slate-500', 'border-slate-100');
    event.target.classList.add('bg-slate-900', 'text-white', 'shadow-xl');
  }

  renderDocs();
}

function renderDocs() {
  const grid = document.getElementById('docs-grid');
  if (!grid) return;

  const docs = state.filterType === 'all'
    ? state.data.docs
    : state.data.docs.filter(d => d.entityType === state.filterType);

  grid.innerHTML = docs.length
    ? docs.map(d => `
        <div class="card-brand flex flex-col group hover:border-red-100">
          <div class="flex justify-between items-start mb-6">
            <div class="p-4 bg-slate-50 rounded-2xl text-slate-300 group-hover:text-[#E20613] transition-all">
              <i data-lucide="file-text" size="24"></i>
            </div>
            <span class="px-3 py-1 rounded-full border border-orange-100 bg-orange-50 text-orange-600 text-[9px] font-black uppercase tracking-widest">${escapeHtml(d.status)}</span>
          </div>

          <div class="flex-1 space-y-1.5">
            <h4 class="text-xl font-black text-slate-900 tracking-tight leading-tight">${escapeHtml(d.type)}</h4>
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${escapeHtml(d.entityId)}</p>
          </div>

          <div class="mt-10 space-y-4">
            <div class="flex items-center gap-3 text-slate-400">
              <i data-lucide="clock" size="14"></i>
              <p class="text-xs font-medium">Vence: <span class="font-bold text-slate-700">${escapeHtml(d.expiryDate || 'N/A')}</span></p>
            </div>
            <div class="flex gap-2">
              <button onclick="${d.fileUrl ? `window.open('${escapeHtml(d.fileUrl)}', '_blank')` : ''}" class="flex-1 py-3 border border-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">
                BAJAR
              </button>
              <button onclick="openUpload('${escapeHtml(d.entityId)}', '${escapeHtml(d.type)}', '${escapeHtml(d.entityType)}')" class="flex-1 py-3 bg-[#E20613] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#B90510] shadow-lg shadow-red-100">
                SUBIR
              </button>
            </div>
          </div>
        </div>
      `).join('')
    : `<div class="col-span-3 p-8 text-center text-slate-400 font-bold">No hay documentos registrados.</div>`;

  refreshIcons();
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
    document.getElementById('form-unit-poliza').value = unit.numero_poliza || unit.poliza || '';

    const isExclusiva = Boolean(unit.linea || unit.exclusiva === true || unit.exclusiva === 'true');
    document.getElementById('form-unit-exclusiva').checked = isExclusiva;
    toggleLineaExclusiva(isExclusiva);
    document.getElementById('form-unit-linea').value = unit.linea || '';

  } else {
    if (title) title.innerText = 'Registrar Unidad';
    if (modeInput) modeInput.value = 'create';
    placaInput.readOnly = false;
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
  numero_poliza: document.getElementById('form-unit-poliza')?.value.trim() || '',
  linea_exclusiva: document.getElementById('form-unit-exclusiva')?.checked
  ? document.getElementById('form-unit-linea')?.value.trim()
  : 'NO_EXCLUSIVA',
  estado: 'ACTIVO'
};;

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

function openCrewModal() {
  const modal = document.getElementById('crew-modal');
  const form = document.getElementById('crew-form');
  const placaSelect = document.getElementById('form-crew-placa');

  if (!modal || !form) {
    console.error('Falta #crew-modal o #crew-form en index.html.');
    return;
  }

  form.reset();

  if (placaSelect) {
    placaSelect.innerHTML = '<option value="">Sin asignar</option>';

    (state.data.units || []).forEach(unit => {
      const option = document.createElement('option');
      option.value = getUnitId(unit);
      option.textContent = `${getUnitId(unit)} — ${unit.sistema || ''}`;
      placaSelect.appendChild(option);
    });
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  refreshIcons();
}

function closeCrewModal() {
  document.getElementById('crew-modal')?.classList.add('hidden');
  document.getElementById('crew-modal')?.classList.remove('flex');
}

async function handleCrewSubmit(event) {
  event.preventDefault();

  const payload = {
    user: state.user,
    dni: document.getElementById('form-crew-dni')?.value.trim(),
    nombres: document.getElementById('form-crew-nombres')?.value.trim(),
    apellidos: document.getElementById('form-crew-apellidos')?.value.trim(),
    cargo: document.getElementById('form-crew-cargo')?.value.trim(),
    placa: document.getElementById('form-crew-placa')?.value.trim(),
    estado: 'ACTIVO'
  };

  if (!payload.dni || !payload.nombres || !payload.apellidos || !payload.cargo) {
    alert('Complete DNI, nombres, apellidos y cargo.');
    return;
  }

  setLoading(true, 'Registrando tripulante...');

  try {
    const res = await api.call('createCrew', payload);

    closeCrewModal();
    await reloadData();

    alert(res?.message || 'Tripulante registrado correctamente.');

  } catch (error) {
    alert(error.message || 'Error registrando tripulante.');
  } finally {
    setLoading(false);
  }
}

function openUpload(id, type, entityType = '') {
  state.activeDocEntityId = id;
  state.activeDocType = type;
  state.activeDocEntityType = entityType || state.filterType;

  const details = document.getElementById('upload-details');
  if (details) {
    details.innerHTML = `Sincronizando <strong>${escapeHtml(type)}</strong> para <strong>${escapeHtml(id)}</strong>`;
  }

  const fileInput = document.getElementById('upload-file');
  const fileLabel = document.getElementById('upload-file-label');
  const expiryInput = document.getElementById('upload-expiry');

  if (fileInput) fileInput.value = '';
  if (fileLabel) fileLabel.innerText = 'Seleccionar o Arrastrar Archivo';
  if (expiryInput) expiryInput.value = '';

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

  const file = fileInput?.files?.[0];

  if (!file) {
    alert('Seleccione un archivo.');
    return;
  }

  if (!state.activeDocType || !state.activeDocEntityId || !state.activeDocEntityType) {
    alert('No se pudo identificar el requisito documental.');
    return;
  }

  const maxSizeMb = 10;
  if (file.size > maxSizeMb * 1024 * 1024) {
    alert('El archivo supera el máximo permitido de 10MB.');
    return;
  }

  setLoading(true, 'Subiendo documento...');

  try {
    const fileBase64 = await fileToBase64(file);

    const payload = {
      user: state.user,
      nombre_documento: state.activeDocType,
      nexo_id: state.activeDocEntityId,
      tipo_nexo: state.activeDocEntityType,
      fileBase64,
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      fecha_vencimiento: expiryInput?.value || ''
    };

    const res = await api.call('uploadDocument', payload);

    closeUpload();
    await reloadData();

    alert(res?.message || 'Documento enviado a validación.');

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
          <p class="font-bold text-slate-500">No hay documentos registrados para esta unidad.</p>
        </div>
      `;
    } else {
      list.innerHTML = docs.map(d => `
        <div class="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-[32px] hover:shadow-lg transition-all group">
          <div class="flex items-center gap-6">
            <div class="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
              <i data-lucide="file-text" size="24"></i>
            </div>
            <div>
              <p class="font-black text-slate-900 leading-none">${escapeHtml(d.type)}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="px-2 py-0.5 bg-amber-50 text-amber-500 rounded text-[8px] font-black uppercase tracking-widest">${escapeHtml(d.status)}</span>
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">VENCE: ${escapeHtml(d.expiryDate || 'N/A')}</span>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  document.getElementById('details-modal')?.classList.remove('hidden');
  document.getElementById('details-modal')?.classList.add('flex');

  refreshIcons();
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
      label.innerText = uploadFile.files?.[0]?.name || 'Seleccionar o Arrastrar Archivo';
    }
  });
}
  

  const unitForm = document.getElementById('unit-form');
  if (unitForm) {
    unitForm.addEventListener('submit', handleUnitSubmit);
  }

  const crewForm = document.getElementById('crew-form');
  if (crewForm) {
    crewForm.addEventListener('submit', handleCrewSubmit);
  }

  if (state.user) {
    document.getElementById('login-modal')?.classList.add('hidden');
    document.getElementById('app-container')?.classList.remove('hidden');
    setUserHeader(state.user);

    try {
      await reloadData();
    } catch (error) {
      console.error(error);
    }
  }
});

window.switchTab = switchTab;
window.handleLogin = handleLogin;
window.logout = logout;
window.refreshData = refreshData;
window.filterDocs = filterDocs;
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
window.handleUploadDocument = handleUploadDocument;
