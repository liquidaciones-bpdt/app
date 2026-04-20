/**
 * HT-BPDT Portal Asistente — Frontend Logic
 * Versión conectada al backend Google Apps Script via fetch()
 *
 * CONFIGURACIÓN:
 *   Reemplaza GAS_WEBAPP_URL con la URL de tu deploy en Apps Script.
 */

// ─── Configuración ────────────────────────────────────────────

const CONFIG = {
  GAS_WEBAPP_URL: 'https://script.google.com/macros/s/REEMPLAZA_CON_TU_DEPLOYMENT_ID/exec',
  APP_TOKEN:      '',
  TIMEOUT_MS:     20000
};

// ─── Estado global ────────────────────────────────────────────

const state = {
  user:        null,
  loading:     false,
  activeTab:   'dashboard',
  data: {
    units:  [],
    crew:   [],
    docs:   [],
    stats:  null,
    empresa: null
  },
  filterType:  'all',
  activeDocId: null,
  refreshing:  false
};

// =============================================================
// API LAYER
// =============================================================

/**
 * Función base para todas las llamadas al backend.
 * @param {Object} payload  { action, ...params }
 * @returns {Promise<Object>}  { success, data, message }
 */
function apiCall(payload) {
  if (CONFIG.APP_TOKEN) payload.app_token = CONFIG.APP_TOKEN;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  return fetch(CONFIG.GAS_WEBAPP_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' }, // evita preflight CORS en GAS
    body:    JSON.stringify(payload),
    signal:  controller.signal
  })
  .then(res => {
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  })
  .then(data => {
    if (typeof data.success === 'undefined') throw new Error('Respuesta inesperada del servidor');
    return data;
  })
  .catch(err => {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Revisa tu conexión.');
    throw err;
  });
}

// =============================================================
// LOADER
// =============================================================

function showLoader(message = 'Procesando...') {
  const loader = document.getElementById('app-loader');
  const msgEl  = document.getElementById('app-loader-message');
  if (!loader) return;
  msgEl.innerText = message;
  loader.classList.remove('hidden');
  loader.classList.add('flex');
  setTimeout(() => {
    loader.classList.add('opacity-100');
    loader.classList.remove('opacity-0');
  }, 10);
}

function hideLoader() {
  const loader = document.getElementById('app-loader');
  if (!loader) return;
  loader.classList.add('opacity-0');
  loader.classList.remove('opacity-100');
  setTimeout(() => {
    loader.classList.add('hidden');
    loader.classList.remove('flex');
  }, 300);
}

function setLoading(val, message) {
  if (val) showLoader(message);
  else hideLoader();
}

// =============================================================
// AUTENTICACIÓN
// =============================================================

async function handleLogin() {
  const dni  = document.getElementById('login-dni').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  if (!dni || !pass) { alert('Ingresa tu DNI y contraseña.'); return; }

  showLoader('Validando acceso seguro...');
  try {
    const res = await apiCall({ action: 'loginUser', dni, password: pass });

    if (res.success) {
      const user = res.data.user;

      // Validar que el rol sea ADMIN o ASISTENTE
      if (!['ADMIN', 'ASISTENTE'].includes(user.rol)) {
        hideLoader();
        alert('Este portal es exclusivo para asistentes y administradores.');
        return;
      }

      state.user = user;

      document.getElementById('login-modal').classList.add('hidden');
      document.getElementById('app-container').classList.remove('hidden');

      // Header info
      document.getElementById('user-empresa').innerText = user.empresa || '';
      const initials = (user.empresa || 'XX').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      document.getElementById('user-avatar').innerText = initials;

      await reloadData();
    } else {
      hideLoader();
      alert(res.message || 'Credenciales incorrectas.');
    }
  } catch (e) {
    hideLoader();
    alert('Error conectando al sistema: ' + e.message);
  }
}

function logout() {
  showLoader('Cerrando sesión de forma segura...');
  setTimeout(() => {
    state.user = null;
    location.reload();
  }, 1200);
}

// =============================================================
// NAVEGACIÓN
// =============================================================

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

  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const section = document.getElementById(`view-${tabId}`);
  if (section) section.classList.add('active');

  const labels = { dashboard: 'Dashboard', fleet: 'Unidades', crew: 'Tripulación', docs: 'Documentos', company: 'Empresa' };
  document.getElementById('view-title').innerText = labels[tabId] || tabId;

  renderTab();
}

// =============================================================
// CARGA DE DATOS
// =============================================================

async function reloadData() {
  try {
    await refreshData(true);
  } catch (e) {
    console.error('reloadData error:', e);
    hideLoader();
  }
}

async function refreshData(silent = false) {
  const btn = document.getElementById('refresh-btn');
  if (state.refreshing) return;
  state.refreshing = true;

  if (!silent) showLoader('Sincronizando datos...');
  if (btn) btn.classList.add('pointer-events-none', 'spinning');

  try {
    const res = await apiCall({
      action:      'getAssistantData',
      empresa_ruc: state.user.empresa_ruc
    });

    if (res.success) {
      // Mapear la respuesta al formato que espera el render
      const d = res.data;
      state.data.units   = d.units   || [];
      state.data.crew    = d.crew    || [];
      state.data.docs    = d.docs    || [];
      state.data.stats   = d.stats   || null;
      state.data.empresa = d.empresa || null;
    } else {
      console.error('getAssistantData error:', res.message);
    }

    renderTab();
    if (!silent) console.log('Datos sincronizados correctamente.');
  } catch (e) {
    console.error('refreshData error:', e);
    if (!silent) alert('No se pudo sincronizar: ' + e.message);
  } finally {
    if (btn) btn.classList.remove('pointer-events-none', 'spinning');
    if (!silent) hideLoader();
    else hideLoader();
    state.refreshing = false;
  }
}

// =============================================================
// RENDER TABS
// =============================================================

function renderTab() {
  if (state.activeTab === 'dashboard') renderDashboard();
  if (state.activeTab === 'fleet')     renderFleet();
  if (state.activeTab === 'crew')      renderCrew();
  if (state.activeTab === 'docs')      renderDocs();
  if (state.activeTab === 'company')   renderCompany();
}

// ── Dashboard ─────────────────────────────────────────────────

function renderDashboard() {
  const { stats, units, crew } = state.data;
  if (!stats) return;

  const globalVal = Math.round((stats.unitsCompliance + stats.crewCompliance + stats.companyCompliance) / 3);

  // Compliance ring
  const ring    = document.getElementById('compliance-ring');
  const valText = document.getElementById('compliance-val');
  valText.innerText = `${globalVal}%`;
  setTimeout(() => {
    ring.style.strokeDashoffset = 263.89 * (1 - globalVal / 100);
  }, 100);

  // Stat blocks
  renderStatBlock('stat-flota',   'Flota',       stats.unitsCompliance,   '#10B981', 'Requisitos de unidad al día');
  renderStatBlock('stat-trip',    'Tripulación',  stats.crewCompliance,    '#F59E0B', 'Licencias y capacitaciones');
  renderStatBlock('stat-empresa', 'Empresa',      stats.companyCompliance, '#3B82F6', 'Carga tributaria y legal');

  // Alert banner
  const alertEl = document.getElementById('expired-alert');
  if (stats.expiredTodayCount > 0) {
    alertEl.classList.remove('hidden');
    alertEl.classList.add('flex');
    document.getElementById('expired-text').innerHTML =
      `Hay <strong>${stats.expiredTodayCount} documentos vencidos</strong> que requieren atención para evitar paralizaciones.`;
  } else {
    alertEl.classList.add('hidden');
    alertEl.classList.remove('flex');
  }

  // Fleet summary (top 3)
  document.getElementById('fleet-summary-list').innerHTML = units.slice(0, 3).map(u => `
    <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100">
          <i data-lucide="truck" size="20"></i>
        </div>
        <div>
          <p class="font-black text-slate-900">${u.id}</p>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${u.sistema}</p>
        </div>
      </div>
      <p class="text-sm font-black ${u.compliance >= 80 ? 'text-emerald-500' : u.compliance >= 60 ? 'text-amber-500' : 'text-red-500'}">${u.compliance}%</p>
    </div>
  `).join('');

  // Crew summary (top 3)
  document.getElementById('crew-summary-list').innerHTML = crew.slice(0, 3).map(c => `
    <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100">
          <i data-lucide="user" size="20"></i>
        </div>
        <div>
          <p class="font-black text-slate-900">${c.nombre} ${c.apellidos}</p>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${c.rol}</p>
        </div>
      </div>
      <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase ${c.compliance >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}">
        ${c.compliance >= 80 ? 'OK' : 'REVISAR'}
      </span>
    </div>
  `).join('');

  lucide.createIcons();
}

function renderStatBlock(id, label, val, color, sub, trend = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `
    <div class="space-y-1">
      <p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">${label}</p>
      <div class="flex items-baseline gap-2">
        <h3 class="text-[42px] font-black leading-none tracking-tighter" style="color: ${color}">${val}%</h3>
        ${trend ? `<span class="text-xs font-bold text-emerald-400">${trend}</span>` : ''}
      </div>
    </div>
    <p class="text-[11px] font-medium text-slate-500 mt-4">${sub}</p>
  `;
}

// ── Fleet ─────────────────────────────────────────────────────

function renderFleet() {
  const tbody = document.getElementById('fleet-table-body');
  const units = state.data.units;

  let html = units.map(u => {
    const compColor = u.compliance >= 80 ? 'bg-emerald-500' : u.compliance >= 60 ? 'bg-amber-500' : 'bg-red-500';
    return `
      <tr class="hover:bg-slate-50/50 transition-all">
        <td class="px-8 py-6 font-black text-slate-900">${u.id}</td>
        <td class="px-8 py-6">
          <div class="space-y-1">
            <p class="text-xs font-bold text-slate-600">${u.sistema}</p>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${u.tipo}</p>
          </div>
        </td>
        <td class="px-8 py-6">
          <div class="flex items-center gap-2 ${u.estado === 'ACTIVO' ? 'text-emerald-500' : 'text-slate-400'} text-[10px] font-black uppercase tracking-widest">
            <div class="w-1.5 h-1.5 ${u.estado === 'ACTIVO' ? 'bg-emerald-500' : 'bg-slate-300'} rounded-full"></div>
            ${u.estado}
          </div>
        </td>
        <td class="px-8 py-6">
          <div class="flex items-center gap-4">
            <div class="flex-1 w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full ${compColor}" style="width: ${u.compliance}%"></div>
            </div>
            <span class="text-sm font-black text-slate-900">${u.compliance}%</span>
          </div>
        </td>
        <td class="px-8 py-6 text-right">
          <button onclick="toggleDropdown(event, '${u.id}')" class="btn-action-trigger">
            <i data-lucide="more-vertical" size="18"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  html += `
    <tr class="hover:bg-slate-50/50 transition-all group">
      <td class="px-8 py-6" colspan="5">
        <button onclick="openUnitModal()" class="btn-primary shadow-sm hover:translate-y-[-2px] text-xs px-6 py-3">
          <i data-lucide="plus" size="16"></i> Registrar Unidad
        </button>
      </td>
    </tr>
  `;

  tbody.innerHTML = html;
  lucide.createIcons();
}

// ── Crew ──────────────────────────────────────────────────────

function renderCrew() {
  const grid = document.getElementById('crew-grid');
  if (!state.data.crew.length) {
    grid.innerHTML = '<p class="text-slate-400 font-medium col-span-3 text-center py-12">No hay tripulantes registrados para esta empresa.</p>';
    return;
  }
  grid.innerHTML = state.data.crew.map(c => `
    <div class="p-8 bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-100/50 group hover:border-red-100 transition-all">
      <div class="flex items-start justify-between mb-8">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-[#E20613] group-hover:border-red-100 transition-all">
            <i data-lucide="user" size="24"></i>
          </div>
          <div>
            <h4 class="font-black text-slate-900 leading-tight uppercase">${c.nombre} ${c.apellidos}</h4>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">${c.rol}</p>
          </div>
        </div>
      </div>
      <div class="space-y-4">
        <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span>Cumplimiento</span>
          <span class="text-slate-900">${c.compliance}%</span>
        </div>
        <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full ${c.compliance >= 80 ? 'bg-emerald-500' : c.compliance >= 60 ? 'bg-amber-500' : 'bg-[#E20613]'}" style="width: ${c.compliance}%"></div>
        </div>
      </div>
      <div class="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 ${c.estado === 'ACTIVO' ? 'bg-emerald-500' : 'bg-slate-300'} rounded-full"></div>
          <span class="text-[9px] font-black text-slate-400 tracking-widest uppercase">${c.estado}</span>
        </div>
        <button onclick="openCrewDocs('${c.id}')" class="text-[11px] font-bold text-[#E20613] hover:underline">Ver Documentos</button>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

// ── Docs ──────────────────────────────────────────────────────

function filterDocs(type) {
  state.filterType = type;
  document.querySelectorAll('.doc-filter-btn').forEach(btn => {
    btn.classList.add('bg-white', 'text-slate-500', 'border-slate-100');
    btn.classList.remove('bg-slate-900', 'text-white', 'shadow-xl');
  });
  event.target.classList.remove('bg-white', 'text-slate-500', 'border-slate-100');
  event.target.classList.add('bg-slate-900', 'text-white', 'shadow-xl');
  renderDocs();
}

function renderDocs() {
  const grid = document.getElementById('docs-grid');
  const allDocs = state.data.docs;
  const docs = state.filterType === 'all'
    ? allDocs
    : allDocs.filter(d => d.entityType.toLowerCase() === state.filterType);

  if (!docs.length) {
    grid.innerHTML = '<div class="col-span-3 text-center py-16 text-slate-400 font-medium">No hay documentos en esta categoría.</div>';
    return;
  }

  const statusStyle = {
    'VALIDADO':   'border-emerald-100 bg-emerald-50 text-emerald-600',
    'PENDIENTE':  'border-orange-100 bg-orange-50 text-orange-600',
    'OBSERVADO':  'border-amber-100 bg-amber-50 text-amber-600',
    'VENCIDO':    'border-red-100 bg-red-50 text-red-600',
    'RECHAZADO':  'border-red-100 bg-red-50 text-red-600'
  };

  grid.innerHTML = docs.map(d => {
    const badge = statusStyle[d.status] || statusStyle['PENDIENTE'];
    const driveBtn = d.fileUrl
      ? `<button onclick="window.open('${d.fileUrl}', '_blank')" class="flex-1 py-3 border border-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">BAJAR</button>`
      : `<button class="flex-1 py-3 border border-slate-100 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed" disabled>BAJAR</button>`;
    return `
      <div class="card-brand flex flex-col group hover:border-red-100">
        <div class="flex justify-between items-start mb-6">
          <div class="p-4 bg-slate-50 rounded-2xl text-slate-300 group-hover:text-[#E20613] transition-all">
            <i data-lucide="file-text" size="24"></i>
          </div>
          <span class="px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${badge}">${d.status}</span>
        </div>
        <div class="flex-1 space-y-1.5">
          <h4 class="text-xl font-black text-slate-900 tracking-tight leading-tight">${d.type}</h4>
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${d.entityId}</p>
        </div>
        <div class="mt-10 space-y-4">
          <div class="flex items-center gap-3 text-slate-400">
            <i data-lucide="clock" size="14"></i>
            <p class="text-xs font-medium">Vence: <span class="font-bold text-slate-700">${d.expiryDate || 'Sin fecha'}</span></p>
          </div>
          <div class="flex gap-2">
            ${driveBtn}
            <button onclick="openUpload('${d.entityId}', '${d.type}', '${d.entityType}')" class="flex-1 py-3 bg-[#E20613] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#B90510] shadow-lg shadow-red-100">SUBIR</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

// ── Company ───────────────────────────────────────────────────

function renderCompany() {
  const empresa = state.data.empresa;
  if (!empresa) return;

  const el = document.querySelector('#view-company');

  // Actualizar los campos dinámicos de la sección Empresa
  const razonSocial = el.querySelector('[data-field="razon_social"]');
  const rucField    = el.querySelector('[data-field="ruc"]');

  if (razonSocial) razonSocial.innerText = empresa.razon_social || '';
  if (rucField)    rucField.innerText    = empresa.ruc || '';

  // Actualizar el estado del header empresa también
  document.getElementById('user-empresa').innerText = empresa.razon_social || state.user.empresa || '';
}

// =============================================================
// MODALS — UPLOAD
// =============================================================

// Contexto actual para el upload
let _uploadContext = { entityId: '', type: '', entityType: '' };

function openUpload(id, type, entityType = 'unidad') {
  _uploadContext = { entityId: id, type, entityType };
  document.getElementById('upload-details').innerHTML =
    `Sincronizando <strong>${type}</strong> para <strong>${id}</strong>`;
  document.getElementById('upload-expiry').value = '';

  // Reasignar el botón de sincronizar al handler correcto
  const btn = document.getElementById('btn-sync-doc');
  btn.onclick = handleSyncDoc;

  document.getElementById('upload-modal').classList.remove('hidden');
  document.getElementById('upload-modal').classList.add('flex');
}

function closeUpload() {
  document.getElementById('upload-modal').classList.add('hidden');
  document.getElementById('upload-modal').classList.remove('flex');
}

/**
 * Sincroniza metadatos del documento al backend.
 * En este flujo el archivo no sube aquí: el asistente registra la metadata
 * (tipo, entidad, fecha vencimiento) y queda como PENDIENTE_VALIDACION.
 * La URL de Drive es opcional; si el asistente tiene el link lo puede pegar.
 */
async function handleSyncDoc() {
  const { entityId, type, entityType } = _uploadContext;
  const expiry   = document.getElementById('upload-expiry').value;
  const empresaRuc = state.user.empresa_ruc || '';

  if (!entityId || !type) { alert('Faltan datos del documento.'); return; }

  setLoading(true, 'Sincronizando documento...');
  try {
    const res = await apiCall({
      action:            'guardarFormulario',
      dni:               entityType === 'tripulacion' ? entityId : null,
      placa:             entityType === 'unidad'      ? entityId : null,
      empresa_ruc:       empresaRuc,
      tipo_documento:    type,
      tipo_nexo:         entityType === 'tripulacion' ? 'TRIPULACION' : 'UNIDAD',
      fecha_vencimiento: expiry || '',
      ruta_drive:        ''
    });

    if (res.success) {
      closeUpload();
      await reloadData();
    } else {
      alert('Error al sincronizar: ' + res.message);
    }
  } catch (e) {
    alert('Error de conexión: ' + e.message);
  } finally {
    setLoading(false);
  }
}

// =============================================================
// MODALS — UNIT DETAILS (documentos de la unidad)
// =============================================================

function viewUnitDetails(id) {
  const unit = state.data.units.find(u => u.id === id);
  if (!unit) return;

  const docs = state.data.docs.filter(d => d.entityId === id && d.entityType === 'unidad');

  document.getElementById('details-modal-title').innerText   = `Documentación: ${unit.id}`;
  document.getElementById('details-modal-subtitle').innerText = `${unit.sistema} • ${unit.tipo}`;

  const list = document.getElementById('details-docs-list');

  if (!docs.length) {
    list.innerHTML = `
      <div class="text-center py-12 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100">
        <i data-lucide="file-warning" class="mx-auto text-slate-300 mb-4" size="48"></i>
        <p class="font-bold text-slate-500">No hay documentos registrados para esta unidad.</p>
      </div>
    `;
  } else {
    list.innerHTML = docs.map(d => {
      const isGood   = d.status === 'VALIDADO' || d.status === 'APROBADO';
      const isAlert  = d.status === 'VENCIDO' || d.status === 'RECHAZADO';
      const statusColor = isGood ? 'text-emerald-500' : (isAlert ? 'text-red-500' : 'text-amber-500');
      const statusBg    = isGood ? 'bg-emerald-50'    : (isAlert ? 'bg-red-50'    : 'bg-amber-50');
      return `
        <div class="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-[32px] hover:shadow-lg transition-all group">
          <div class="flex items-center gap-6">
            <div class="w-14 h-14 ${statusBg} rounded-2xl flex items-center justify-center ${statusColor}">
              <i data-lucide="file-text" size="24"></i>
            </div>
            <div>
              <p class="font-black text-slate-900 leading-none">${d.type}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="px-2 py-0.5 ${statusBg} ${statusColor} rounded text-[8px] font-black uppercase tracking-widest">${d.status}</span>
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">VENCE: ${d.expiryDate || 'N/A'}</span>
              </div>
            </div>
          </div>
          <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
            ${d.fileUrl
              ? `<button onclick="window.open('${d.fileUrl}', '_blank')" class="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-[#E20613] hover:bg-red-50 transition-all"><i data-lucide="download" size="18"></i></button>`
              : ''}
            <button onclick="openUpload('${d.entityId}', '${d.type}', 'unidad')" class="p-3 bg-[#E20613] text-white rounded-xl hover:bg-[#B90510] transition-all">
              <i data-lucide="refresh-cw" size="18"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('details-modal').classList.remove('hidden');
  document.getElementById('details-modal').classList.add('flex');
  lucide.createIcons();
}

function closeDetailsModal() {
  document.getElementById('details-modal').classList.add('hidden');
  document.getElementById('details-modal').classList.remove('flex');
}

/**
 * Abre el modal de documentos para un tripulante desde la sección Crew.
 */
function openCrewDocs(dni) {
  const crewMember = state.data.crew.find(c => c.id === dni);
  if (!crewMember) return;

  const docs = state.data.docs.filter(d => d.entityId === dni && d.entityType === 'tripulacion');

  document.getElementById('details-modal-title').innerText   = `Documentación: ${crewMember.nombre} ${crewMember.apellidos}`;
  document.getElementById('details-modal-subtitle').innerText = `${crewMember.rol} • DNI ${crewMember.id}`;

  const list = document.getElementById('details-docs-list');

  if (!docs.length) {
    list.innerHTML = `
      <div class="text-center py-12 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100">
        <i data-lucide="file-warning" class="mx-auto text-slate-300 mb-4" size="48"></i>
        <p class="font-bold text-slate-500">No hay documentos registrados para este tripulante.</p>
      </div>
    `;
  } else {
    list.innerHTML = docs.map(d => {
      const isGood  = d.status === 'VALIDADO' || d.status === 'APROBADO';
      const isAlert = d.status === 'VENCIDO'  || d.status === 'RECHAZADO';
      const sColor  = isGood ? 'text-emerald-500' : (isAlert ? 'text-red-500' : 'text-amber-500');
      const sBg     = isGood ? 'bg-emerald-50'    : (isAlert ? 'bg-red-50'    : 'bg-amber-50');
      return `
        <div class="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-[32px] hover:shadow-lg transition-all group">
          <div class="flex items-center gap-6">
            <div class="w-14 h-14 ${sBg} rounded-2xl flex items-center justify-center ${sColor}">
              <i data-lucide="file-text" size="24"></i>
            </div>
            <div>
              <p class="font-black text-slate-900 leading-none">${d.type}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="px-2 py-0.5 ${sBg} ${sColor} rounded text-[8px] font-black uppercase">${d.status}</span>
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">VENCE: ${d.expiryDate || 'N/A'}</span>
              </div>
            </div>
          </div>
          <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
            <button onclick="openUpload('${d.entityId}', '${d.type}', 'tripulacion')" class="p-3 bg-[#E20613] text-white rounded-xl hover:bg-[#B90510] transition-all">
              <i data-lucide="refresh-cw" size="18"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('details-modal').classList.remove('hidden');
  document.getElementById('details-modal').classList.add('flex');
  lucide.createIcons();
}

// =============================================================
// MODALS — UNIT FORM (crear / editar)
// =============================================================

function openUnitModal(id = null) {
  const modal     = document.getElementById('unit-modal');
  const form      = document.getElementById('unit-form');
  const title     = document.getElementById('unit-modal-title');
  const modeInput = document.getElementById('unit-form-mode');

  form.reset();
  toggleLineaExclusiva(false);

  if (id) {
    const unit = state.data.units.find(u => u.id === id);
    if (!unit) return;
    title.innerText       = 'Actualizar Unidad';
    modeInput.value       = 'edit';
    document.getElementById('form-unit-id').value       = unit.id;
    document.getElementById('form-unit-id').readOnly    = true;
    document.getElementById('form-unit-sistema').value  = unit.sistema;
    document.getElementById('form-unit-tipo').value     = unit.tipo;
    document.getElementById('form-unit-marca').value    = unit.marca    || '';
    document.getElementById('form-unit-modelo').value   = unit.modelo   || '';
    document.getElementById('form-unit-capacidad').value = unit.capacidad || '';
    const isExclusiva = unit.exclusiva === true || unit.exclusiva === 'true';
    document.getElementById('form-unit-exclusiva').checked = isExclusiva;
    toggleLineaExclusiva(isExclusiva);
    document.getElementById('form-unit-linea').value = unit.linea || '';
  } else {
    title.innerText     = 'Registrar Unidad';
    modeInput.value     = 'create';
    document.getElementById('form-unit-id').readOnly = false;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeUnitModal() {
  document.getElementById('unit-modal').classList.add('hidden');
  document.getElementById('unit-modal').classList.remove('flex');
}

async function handleUnitSubmit(e) {
  e.preventDefault();

  const mode = document.getElementById('unit-form-mode').value;
  const placa = document.getElementById('form-unit-id').value.trim().toUpperCase();

  if (!placa) { alert('La placa es obligatoria.'); return; }

  const unitData = {
    placa,
    sistema:    document.getElementById('form-unit-sistema').value,
    tipo:       document.getElementById('form-unit-tipo').value.trim().toUpperCase(),
    marca:      document.getElementById('form-unit-marca').value.trim().toUpperCase(),
    modelo:     document.getElementById('form-unit-modelo').value.trim().toUpperCase(),
    capacidad:  document.getElementById('form-unit-capacidad').value || '',
    exclusiva:  document.getElementById('form-unit-exclusiva').checked,
    linea:      document.getElementById('form-unit-exclusiva').checked
                  ? document.getElementById('form-unit-linea').value
                  : '',
    empresa_ruc: state.user.empresa_ruc || '',
    estado:     'ACTIVO'
  };

  setLoading(true, mode === 'create' ? 'Registrando unidad...' : 'Actualizando unidad...');
  try {
    const res = await apiCall({ action: 'saveUnit', mode, unitData });
    if (res.success) {
      closeUnitModal();
      await reloadData();
    } else {
      alert('Error: ' + (res.message || 'No se pudo guardar la unidad.'));
    }
  } catch (err) {
    alert('Error de conexión: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function toggleLineaExclusiva(checked) {
  const wrapper = document.getElementById('wrapper-linea-exclusiva');
  if (checked) wrapper.classList.remove('hidden');
  else {
    wrapper.classList.add('hidden');
    document.getElementById('form-unit-linea').value = '';
  }
}

// =============================================================
// DROPDOWN (menú contextual de unidades)
// =============================================================

function toggleDropdown(event, id) {
  event.stopPropagation();
  const dropdown = document.getElementById('global-dropdown');
  const isOpen   = dropdown.style.display === 'block';

  if (isOpen && state.activeDocId === id) { closeDropdown(); return; }

  state.activeDocId = id;
  const rect = event.currentTarget.getBoundingClientRect();
  dropdown.style.top  = `${rect.bottom + window.scrollY}px`;
  dropdown.style.left = `${rect.right - 160 + window.scrollX}px`;
  dropdown.style.display = 'block';
  lucide.createIcons();
}

function closeDropdown() {
  document.getElementById('global-dropdown').style.display = 'none';
  state.activeDocId = null;
}

function handleMenuAction(action) {
  const unitId = state.activeDocId;
  const unit   = state.data.units.find(u => u.id === unitId);
  closeDropdown();
  if (!unit && action !== 'report') return;

  if (action === 'details') viewUnitDetails(unit.id);
  else if (action === 'edit') openUnitModal(unit.id);
  else if (action === 'report') {
    alert(`Generando reporte consolidado para ${unitId}...\n(En producción: genera PDF/ZIP desde Drive API)`);
  }
}

// =============================================================
// EVENTOS GLOBALES
// =============================================================

window.addEventListener('click', e => {
  if (!e.target.closest('#global-dropdown')) closeDropdown();
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
