/**
 * HT-BPDT | Script Operativo
 */

// -- STATE --
let STATE = {
  user: null,
  activeTab: 'dashboard',
  masterData: null,
  dashboardStats: null,
  records: [],
  pendingUpload: null
};

// -- INIT --
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  checkSession();
  initEventListeners();
});

function initEventListeners() {
  // Login
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  
  // Registry Form
  document.getElementById('registry-form').addEventListener('submit', handleRegistrySubmit);
  
  // File Upload
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('bg-blue-100');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('bg-blue-100');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('bg-blue-100');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect({ target: fileInput });
    }
  });

  // Registry Select Logic
  document.getElementById('reg-range').addEventListener('change', (e) => {
    const isNoCumple = e.target.value === 'NO_CUMPLE';
    const detailGroup = document.getElementById('inc-detail-group');
    const statusSelect = document.getElementById('reg-inc-status');
    
    if (isNoCumple) {
      detailGroup.classList.remove('hidden');
      if (statusSelect.value === 'SIN_INCIDENCIA') {
        statusSelect.value = 'ABIERTA';
      }
      const optSinInc = [...statusSelect.options].find(o => o.value === 'SIN_INCIDENCIA');
      if (optSinInc) optSinInc.disabled = true;
    } else {
      detailGroup.classList.add('hidden');
      statusSelect.value = 'SIN_INCIDENCIA';
      const optSinInc = [...statusSelect.options].find(o => o.value === 'SIN_INCIDENCIA');
      if (optSinInc) optSinInc.disabled = false;
    }
  });
}

/**
 * SESIÓN
 */
function checkSession() {
  const saved = localStorage.getItem('HT_BPDT_SESSION');
  if (saved) {
    STATE.user = JSON.parse(saved);
    showApp();
  } else {
    showLogin();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const dni = document.getElementById('login-dni').value;
  const password = document.getElementById('login-pass').value;

  // -- BYPASS LOCAL PARA DEMO --
  if (dni === '1234' && password === '1234') {
    STATE.user = {
      usuario_id: 'DEMO_001',
      dni: '1234',
      nombre_completo: 'Usuario Demo HT',
      empresa_ruc: '20512345678',
      rol_app: 'VALIDADOR',
      cargo: 'SUPERVISOR LOGÍSTICO',
      fecha_login: new Date().toISOString()
    };
    localStorage.setItem('HT_BPDT_SESSION', JSON.stringify(STATE.user));
    showApp();
    return;
  }

  toggleLoader(true, 'Iniciando sesión...');
  
  try {
    const res = await callApi('login', { dni, password });
    if (res.ok) {
      STATE.user = res.data.session;
      localStorage.setItem('HT_BPDT_SESSION', JSON.stringify(STATE.user));
      showApp();
    } else {
      alert(res.message);
    }
  } catch (err) {
    alert('Error de conexión con el servidor.');
  } finally {
    toggleLoader(false);
  }
}

function logout() {
  localStorage.removeItem('HT_BPDT_SESSION');
  STATE.user = null;
  showLogin();
}

/**
 * NAVEGACIÓN
 */
function switchTab(tabId) {
  STATE.activeTab = tabId;
  
  // UI Tabs
  document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
  const view = document.getElementById(`view-${tabId}`);
  if (view) view.classList.remove('hidden');
  
  // UI Nav buttons
  document.querySelectorAll('aside nav button').forEach(b => b.classList.remove('nav-active'));
  const navBtn = document.getElementById(`nav-${tabId}`);
  if (navBtn) navBtn.classList.add('nav-active');
  
  // Header
  const titles = {
    dashboard: 'Dashboard Global',
    registry: 'Registro de Trazabilidad',
    history: 'Consulta Histórica'
  };
  document.getElementById('view-title').textContent = titles[tabId] || 'Panel';

  // Refresh data if needed
  refreshData();
}

function openUploadModal() {
  document.getElementById('upload-modal').classList.remove('hidden');
  document.getElementById('upload-modal').classList.add('flex');
}

function closeUploadModal() {
  document.getElementById('upload-modal').classList.add('hidden');
  document.getElementById('upload-modal').classList.remove('flex');
}

/**
 * CARGA DE DATOS (EXCEL)
 */
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  STATE.pendingUpload = file;
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('drop-zone').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');
}

function clearUpload() {
  STATE.pendingUpload = null;
  document.getElementById('file-input').value = '';
  document.getElementById('drop-zone').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-result').classList.add('hidden');
  document.getElementById('btn-process-upload').disabled = false;
  document.getElementById('btn-process-upload').classList.remove('opacity-50');
}

async function processUpload() {
  if (!STATE.pendingUpload) return;
  
  toggleLoader(true, 'Parseando archivo...');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(worksheet);

    toggleLoader(true, 'Enviando datos al servidor...');
    
    try {
      const res = await callApi('bulkUpload', json);
      showUploadResults(res.data);
    } catch (err) {
      alert('Error procesando la carga: ' + err.message);
    } finally {
      toggleLoader(false);
    }
  };
  reader.readAsArrayBuffer(STATE.pendingUpload);
}

function showUploadResults(stats) {
  const resultDiv = document.getElementById('upload-result');
  const statsDiv = document.getElementById('upload-stats');
  const errorsDiv = document.getElementById('upload-errors');

  resultDiv.classList.remove('hidden');
  statsDiv.innerHTML = `
    <div>Leídos: ${stats.read}</div>
    <div>Nuevos: ${stats.new}</div>
    <div>Duplicados: ${stats.duplicates}</div>
    <div>Errores: ${stats.errors}</div>
  `;

  if (stats.errors > 0) {
    errorsDiv.classList.remove('hidden');
    errorsDiv.innerHTML = stats.details.map(d => `<div class="py-1 border-b border-white/5">• ${d}</div>`).join('');
  } else {
    errorsDiv.classList.add('hidden');
  }
  
  document.getElementById('btn-process-upload').disabled = true;
  document.getElementById('btn-process-upload').classList.add('opacity-50');

  if (stats.errors === 0 && stats.new > 0) {
    setTimeout(() => {
      closeUploadModal();
      refreshData();
    }, 2500);
  }
}

/**
 * REGISTRO
 */
async function loadRegistryTable() {
  const tableBody = document.getElementById('registry-table-body');
  tableBody.innerHTML = '<tr><td colspan="5" class="p-10 text-center animate-pulse font-bold text-slate-300">Cargando pendientes...</td></tr>';
  
  try {
    const res = await callApi('listRecords', { estado_trazabilidad: 'PENDIENTE' });
    STATE.records = res.data;
    renderRegistryTable(res.data);
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-red-400">Error al cargar registros.</td></tr>';
  }
}

function renderRegistryTable(data) {
  const tableBody = document.getElementById('registry-table-body');
  if (data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-400">No hay viajes pendientes de registro posterior.</td></tr>';
    return;
  }
  tableBody.innerHTML = data.map(item => `
    <tr class="hover:bg-slate-50/50 transition-colors group">
      <td class="px-6 py-5 font-bold text-slate-500 text-xs">${formatDateShort(item.fecha_despacho)}</td>
      <td class="px-6 py-5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] font-black">${item.tipo_viaje}</span>
          <span class="font-black text-slate-700 tracking-tight">${item.viaje}</span>
        </div>
        <div class="text-[9px] font-bold text-slate-400 uppercase mt-1">${item.centro_distribucion || 'SD'}</div>
      </td>
      <td class="px-6 py-5">
        <div class="flex items-center gap-2 font-black text-slate-900">
          <i data-lucide="truck" size="14" class="text-slate-300"></i>
          ${item.placa}
        </div>
      </td>
      <td class="px-6 py-5">
        <span class="badge ${CONFIG.COLORS[item.estado_trazabilidad]}">
          ${item.estado_trazabilidad}
        </span>
      </td>
      <td class="px-6 py-5 text-right">
        <button onclick="openRegistryModal('${item.trazabilidad_id}')" class="inline-flex items-center justify-center w-10 h-10 text-blue-600 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 hover:scale-105 transition-all" title="Completar">
          <i data-lucide="arrow-right" size="18"></i>
        </button>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

function openRegistryModal(id) {
  const item = STATE.records.find(r => r.trazabilidad_id === id);
  if (!item) return;

  document.getElementById('reg-id').value = id;
  document.getElementById('modal-title').textContent = item.viaje + ' | ' + item.placa;
  document.getElementById('reg-range').value = '';
  document.getElementById('reg-complete').value = '';
  document.getElementById('reg-inc-status').value = 'SIN_INCIDENCIA';
  document.getElementById('reg-inc-detail').value = '';
  document.getElementById('reg-obs').value = '';
  document.getElementById('inc-detail-group').classList.add('hidden');
  
  document.getElementById('registry-modal').classList.remove('hidden');
  document.getElementById('registry-modal').classList.add('flex');
}

function closeRegistryModal() {
  document.getElementById('registry-modal').classList.add('hidden');
  document.getElementById('registry-modal').classList.remove('flex');
}

async function handleRegistrySubmit(e) {
  e.preventDefault();
  const payload = {
    trazabilidad_id: document.getElementById('reg-id').value,
    rango_temperatura: document.getElementById('reg-range').value,
    trazabilidad_completa: document.getElementById('reg-complete').value,
    estado_incidencia: document.getElementById('reg-inc-status').value,
    incidencia_temperatura: document.getElementById('reg-inc-detail').value,
    observacion: document.getElementById('reg-obs').value
  };

  toggleLoader(true, 'Guardando trazabilidad...');
  try {
    const res = await callApi('completeRegistry', payload);
    if (res.ok) {
      closeRegistryModal();
      loadRegistryTable();
    } else {
      alert(res.message);
    }
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    toggleLoader(false);
  }
}

/**
 * DASHBOARD
 */
async function loadDashboard() {
  try {
    const res = await callApi('getDashboard', {});
    STATE.dashboardStats = res.data;
    renderDashboard(res.data);
  } catch (err) {
    console.error('Error dashboard', err);
  }
}

function renderDashboard(s) {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    ${renderKpi('Viajes Cargados', s.cargados, 'database', 'blue')}
    ${renderKpi('Pendientes Eval.', s.pendientes, 'clock', 'amber', s.pendientes > 0)}
    ${renderKpi('Viajes Trazados', s.completados, 'check-circle', 'emerald')}
    ${renderKpi('Cumplimiento Tr.', Math.round(s.cumplimiento_trazabilidad || 0) + '%', 'shield-check', 'indigo')}
  `;

  const progressContainer = document.getElementById('dashboard-progress');
  if (progressContainer) {
    progressContainer.innerHTML = `
      <div class="flex flex-col md:flex-row gap-10 items-center">
        <div class="relative w-48 h-48 shrink-0 group">
          <svg class="w-full h-full -rotate-90 drop-shadow-md" viewBox="0 0 100 100">
            <circle class="text-slate-100" stroke-width="8" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50"/>
            <circle class="text-[#E20613] transition-all duration-1000 ease-out" stroke-width="8" stroke-dasharray="264" stroke-dashoffset="${264 - (264 * s.avance / 100)}" stroke-linecap="round" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50"/>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-4xl font-black text-slate-900 tracking-tighter">${Math.round(s.avance)}<small class="text-sm">%</small></span>
            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Avance Evaluación</span>
          </div>
        </div>
        
        <div class="flex-1 w-full space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
               <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Doc. Trazas SI</p>
               <p class="text-2xl font-black text-emerald-600">${s.trazabilidad_completa}</p>
            </div>
            <div class="p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
               <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cumplimiento T°</p>
               <p class="text-2xl font-black text-blue-600">${Math.round(s.cumplimiento_temp)}%</p>
            </div>
          </div>
          <div class="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center gap-4">
            <div class="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <i data-lucide="info" size="20"></i>
            </div>
            <p class="text-xs font-medium text-blue-700 leading-relaxed">
              El <strong>${Math.round(s.cumplimiento_trazabilidad || 0)}%</strong> de tus viajes evaluados cuentan con trazabilidad cerrada (Documentos SI + Temperatura Óptima).
            </p>
          </div>
        </div>
      </div>
    `;
  }

  document.getElementById('dashboard-incidents').innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center p-4 bg-red-50 rounded-xl border border-red-100">
        <span class="text-[10px] font-bold text-red-600 uppercase">Alertas Térmicas</span>
        <span class="font-black text-red-700">${s.no_conformes}</span>
      </div>
      <div class="flex justify-between items-center p-4 bg-amber-50 rounded-xl border border-amber-100">
        <span class="text-[10px] font-bold text-amber-600 uppercase">Incidencias Activas</span>
        <span class="font-black text-amber-700">${s.incidencias_abiertas}</span>
      </div>
      <div class="flex justify-between items-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
        <span class="text-[10px] font-bold text-emerald-600 uppercase">Incidencias Cerradas</span>
        <span class="font-black text-emerald-700">${s.incidencias_cerradas}</span>
      </div>
    </div>
  `;

  lucide.createIcons();
}

function renderCompanySummary(records) {
  const valid = records.filter(r => r.estado_trazabilidad !== 'ANULADO');
  const companies = {};

  valid.forEach(r => {
    const ruc = r.empresa_ruc || 'SIN-RUC';
    if (!companies[ruc]) {
      companies[ruc] = {
        razon: r.razon_social || 'EMPRESA NO IDENTIFICADA',
        trazados: 0,
        cumplen: 0
      };
    }
    
    if (r.estado_trazabilidad !== 'PENDIENTE') {
      companies[ruc].trazados++;
      if (r.estado_trazabilidad === 'CERRADO') {
        companies[ruc].cumplen++;
      }
    }
  });

  const tableBody = document.getElementById('company-summary-body');
  const sorted = Object.values(companies).sort((a, b) => b.trazados - a.trazados);
  
  if (sorted.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400">No hay datos de transportistas disponibles.</td></tr>';
    return;
  }

  tableBody.innerHTML = sorted.map(c => {
    const ef = c.trazados > 0 ? Math.round((c.cumplen / c.trazados) * 100) : 0;
    return `
      <tr class="hover:bg-slate-50/50 transition-colors">
        <td class="px-6 py-5">
           <p class="font-black text-slate-900 text-[11px] uppercase">${c.razon}</p>
        </td>
        <td class="px-6 py-5 text-center font-bold text-slate-600 text-xs">${c.trazados}</td>
        <td class="px-6 py-5 text-center font-bold text-emerald-600 text-xs">${c.cumplen}</td>
        <td class="px-6 py-5 text-right">
          <div class="flex items-center justify-end gap-3">
             <span class="font-black text-slate-900 text-xs">${ef}%</span>
             <div class="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full" style="width: ${ef}%"></div>
             </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderKpi(label, value, icon, color, highlight = false) {
  const themes = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    red: 'bg-red-50 text-red-600 border-red-100'
  };
  return `
    <div class="card-brand p-8 group ${highlight ? 'ring-2 ring-amber-400 ring-offset-4' : ''}">
      <div class="flex justify-between items-start mb-6">
        <div class="w-12 h-12 ${themes[color]} border rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
          <i data-lucide="${icon}"></i>
        </div>
        <div class="text-[10px] font-bold text-slate-300 uppercase tracking-widest">REALTIME</div>
      </div>
      <div>
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${label}</p>
        <h4 class="text-3xl font-black text-slate-900 tracking-tighter">${value}</h4>
      </div>
    </div>
  `;
}

/**
 * HISTORIAL
 */
async function loadHistoryTable(filters = {}) {
  const tableBody = document.getElementById('history-table-body');
  tableBody.innerHTML = '<tr><td colspan="7" class="p-10 text-center animate-pulse text-slate-300">Consultando registros...</td></tr>';
  
  try {
    const res = await callApi('listRecords', filters);
    renderHistoryTable(res.data);
    updateFilterOptions(res.data);
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="7" class="p-10 text-center text-red-300">Error en consulta.</td></tr>';
  }
}

function updateFilterOptions(data) {
  const cdSelect = document.getElementById('hist-filter-cd');
  const cds = [...new Set(data.map(i => i.centro_distribucion).filter(Boolean))];
  const currentVal = cdSelect.value;
  
  cdSelect.innerHTML = '<option value="">Todos los CD</option>' + 
    cds.sort().map(cd => `<option value="${cd}" ${cd === currentVal ? 'selected' : ''}>${cd}</option>`).join('');
}

function renderHistoryTable(data) {
  const tableBody = document.getElementById('history-table-body');
  if (data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="p-10 text-center text-slate-400">Sin resultados para los filtros aplicados.</td></tr>';
    return;
  }
  tableBody.innerHTML = data.map(item => `
    <tr class="hover:bg-slate-50/50 group text-[11px] font-medium text-slate-600 transition-colors">
      <td class="px-6 py-5 font-black text-slate-800">
        ${formatDateShort(item.fecha_despacho)}
        <div class="text-[9px] font-bold text-slate-300 uppercase mt-0.5">${item.trazabilidad_id}</div>
      </td>
      <td class="px-6 py-5 text-slate-500 font-bold">${item.centro_distribucion || 'SD'}</td>
      <td class="px-6 py-5">
        <div class="font-black text-slate-900 mb-0.5">${item.viaje}</div>
        <div class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">${item.placa} • ${item.sensor}</div>
        <div class="text-[10px] font-bold text-blue-500 uppercase truncate max-w-[150px] mt-1">${item.razon_social}</div>
      </td>
      <td class="px-6 py-5">
        <span class="badge ${CONFIG.COLORS[item.rango_temperatura] || 'bg-slate-50 text-slate-300'}">
          ${item.rango_temperatura || 'PENDIENTE'}
        </span>
      </td>
      <td class="px-6 py-5">
        <div class="flex items-center gap-2">
          <span class="font-black ${item.trazabilidad_completa === 'SI' ? 'text-emerald-500' : 'text-amber-500'}">${item.trazabilidad_completa || 'NO'}</span>
          <div class="h-1.5 w-10 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full ${item.trazabilidad_completa === 'SI' ? 'bg-emerald-500' : 'bg-amber-400'}" style="width: ${item.trazabilidad_completa === 'SI' ? '100%' : '30%'}"></div>
          </div>
        </div>
      </td>
      <td class="px-6 py-5">
        <span class="badge ${CONFIG.COLORS[item.estado_trazabilidad]}">
          ${item.estado_trazabilidad}
        </span>
      </td>
      <td class="px-6 py-5 text-right">
        <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onclick="handleAnular('${item.trazabilidad_id}')" class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Anular Registro">
            <i data-lucide="slash" size="16"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();
}

async function handleAnular(id) {
  if (!confirm('¿Seguro que desea ANULAR este registro? No se podrá revertir.')) return;
  
  toggleLoader(true, 'Anulando registro...');
  try {
    await callApi('updateStatus', { trazabilidad_id: id, estado_trazabilidad: 'ANULADO', observacion: 'Anulado por Validador' });
    refreshData();
  } catch (err) {
    alert('Error al anular.');
  } finally {
    toggleLoader(false);
  }
}

function applyHistoryFilters() {
  const filters = {
    fechaDesde: document.getElementById('hist-date-from').value,
    fechaHasta: document.getElementById('hist-date-to').value,
    centro_distribucion: document.getElementById('hist-filter-cd').value,
    trazabilidad_completa: document.getElementById('hist-filter-complete').value,
    estado_incidencia: document.getElementById('hist-filter-inc-status').value,
    estado_trazabilidad: document.getElementById('hist-filter-status').value
  };
  loadHistoryTable(filters);
}

// -- HELPERS CORE --
const MOCK_DATA = {
  db: [
    { trazabilidad_id: 'DT|1001|F6N787|260511', fecha_despacho: '2026-05-11', tipo_viaje: 'DT', viaje: '1001', placa: 'F6N787', centro_distribucion: 'HUACHIPA', empresa_ruc: '20512345678', sensor: 'SN-787', rango_temperatura: '', incidencia_temperatura: '', estado_incidencia: '', trazabilidad_completa: '', observacion: '', estado_trazabilidad: 'PENDIENTE', razon_social: 'TRANSPORTES DEL SUR S.A.C.' },
    { trazabilidad_id: 'OTM|2002|ABC123|260511', fecha_despacho: '2026-05-11', tipo_viaje: 'OTM', viaje: '2002', placa: 'ABC123', centro_distribucion: 'VILLA EL SALVADOR', empresa_ruc: '20100010001', sensor: 'SN-001', rango_temperatura: 'CUMPLE', incidencia_temperatura: 'SIN INCIDENCIA', estado_incidencia: 'SIN_INCIDENCIA', trazabilidad_completa: 'SI', observacion: 'Conforme', estado_trazabilidad: 'CERRADO', razon_social: 'LOGISTICA EXPRESS SAC' }
  ]
};

function mockRouter(action, payload) {
  console.log('MOCK MODE:', action, payload);
  
  const routes = {
    login: () => ({ ok: true, data: { session: STATE.user } }),
    getDashboard: () => {
      const valid = MOCK_DATA.db.filter(r => r.estado_trazabilidad !== 'ANULADO');
      const evaluados = valid.filter(r => r.estado_trazabilidad !== 'PENDIENTE');
      const countEvaluados = evaluados.length;
      return {
        ok: true,
        data: {
          cargados: valid.length,
          pendientes: valid.filter(r => r.estado_trazabilidad === 'PENDIENTE').length,
          completados: countEvaluados,
          avance: valid.length > 0 ? (countEvaluados / valid.length) * 100 : 0,
          cumplimiento_temp: countEvaluados > 0 ? (evaluados.filter(r => r.rango_temperatura === 'CUMPLE').length / countEvaluados) * 100 : 0,
          no_conformes: evaluados.filter(r => r.rango_temperatura === 'NO_CUMPLE').length,
          incidencias_abiertas: evaluados.filter(r => ['ABIERTA', 'REPORTADA', 'EN_SEGUIMIENTO'].includes(r.estado_incidencia)).length,
          incidencias_cerradas: evaluados.filter(r => r.estado_incidencia === 'CERRADA').length,
          trazabilidad_completa: evaluados.filter(r => r.trazabilidad_completa === 'SI').length,
          trazabilidad_incompleta: evaluados.filter(r => r.trazabilidad_completa === 'NO').length,
        }
      };
    },
    listRecords: () => {
      let filtered = [...MOCK_DATA.db];
      if (payload.estado_trazabilidad) filtered = filtered.filter(r => r.estado_trazabilidad === payload.estado_trazabilidad);
      if (payload.centro_distribucion) filtered = filtered.filter(r => r.centro_distribucion === payload.centro_distribucion);
      return { ok: true, data: filtered.reverse() };
    },
    bulkUpload: () => ({ ok: true, data: { read: payload.length, new: payload.length, duplicates: 0, errors: 0, details: [] } }),
    completeRegistry: () => {
      const idx = MOCK_DATA.db.findIndex(r => r.trazabilidad_id === payload.trazabilidad_id);
      if (idx !== -1) {
        let est = 'OBSERVADO';
        if (payload.trazabilidad_completa === 'SI') {
          if (payload.rango_temperatura === 'CUMPLE') est = 'CERRADO';
          else if (payload.estado_incidencia === 'CERRADA') est = 'CERRADO';
        }
        MOCK_DATA.db[idx] = { ...MOCK_DATA.db[idx], ...payload, estado_trazabilidad: est };
      }
      return { ok: true };
    },
    updateStatus: () => {
      const idx = MOCK_DATA.db.findIndex(r => r.trazabilidad_id === payload.trazabilidad_id);
      if (idx !== -1) MOCK_DATA.db[idx].estado_trazabilidad = payload.estado_trazabilidad;
      return { ok: true };
    }
  };

  return routes[action] ? routes[action]() : { ok: false, message: 'Acción no soportada en MOCK' };
}

async function callApi(action, payload) {
  // Bridge para DEMO / No configurado
  if (CONFIG.API_URL === 'TU_WEB_APP_URL_AQUI' || (STATE.user && STATE.user.usuario_id === 'DEMO_001')) {
    return mockRouter(action, payload);
  }

  const body = {
    action,
    payload,
    session: STATE.user
  };

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const text = await response.text();
    if (!text) throw new Error('Respuesta vacía del servidor');
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('JSON Parse Error:', text);
      throw new Error('La respuesta del servidor no es un JSON válido');
    }
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

function toggleLoader(show, text = 'Cargando...') {
  const loader = document.getElementById('app-loader');
  const loaderText = document.getElementById('loader-text');
  loaderText.textContent = text;
  if (show) {
    loader.classList.remove('hidden');
    loader.classList.add('flex');
  } else {
    loader.classList.add('hidden');
    loader.classList.remove('flex');
  }
}

function showLogin() {
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  document.getElementById('user-name').textContent = STATE.user.nombre_completo;
  
  // Tab inicial
  switchTab('dashboard');
}

function refreshData() {
  if (STATE.activeTab === 'dashboard') {
    loadDashboard();
    // Also load raw records for company summary
    callApi('listRecords', { limit: 1000 }).then(res => {
      renderCompanySummary(res.data || []);
    });
  }
  if (STATE.activeTab === 'registry') loadRegistryTable();
  if (STATE.activeTab === 'history') loadHistoryTable();
}

function formatDateShort(iso) {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

function formatDateFull(iso) {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleString('es-ES');
}
