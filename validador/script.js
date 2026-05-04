import CONFIG from './config.js';

const SESSION_KEY = 'htbpdt_validador_session_v1';
const REQUEST_TIMEOUT_MS = 25000;

const ESTADOS = {
  PENDIENTE: 'PENDIENTE_VALIDACION',
  VALIDADO: 'VALIDADO',
  OBSERVADO: 'OBSERVADO',
  RECHAZADO: 'RECHAZADO'
};

const State = {
  user: getStoredSession(),
  loading: false,
  docs: [],
  selectedDoc: null,
  activeFilter: 'PENDIENTE_VALIDACION'
};

/* =========================
   SESSION
========================= */

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(user) {
  State.user = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  State.user = null;
  location.reload();
}

/* =========================
   API
========================= */

async function apiRequest(action, payload = {}) {
  if (!CONFIG.API_URL || CONFIG.API_URL.includes('XXXXXXXX')) {
    throw new Error('Backend no configurado. Revisa config.js.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    showLoader(true);

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action,
        payload
      }),
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
    showLoader(false);
  }
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

  try {
    const user = await apiRequest('login', { dni, pass });

    saveSession(user);

    document.getElementById('login-modal')?.classList.add('hidden');
    document.getElementById('app-container')?.classList.remove('hidden');

    setUserHeader(user);

    await refreshData();

  } catch (error) {
    alert(error.message || 'Error iniciando sesión.');
  }
}

function setUserHeader(user) {
  const name = user?.nombre || user?.razon_social || 'VALIDADOR';

  const userName = document.getElementById('user-name');
  if (userName) userName.innerText = name;

  const userRole = document.getElementById('user-role');
  if (userRole) userRole.innerText = user?.rol_app || 'VALIDADOR';

  const avatar = document.getElementById('user-avatar');
  if (avatar) {
    avatar.innerText = name
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'VA';
  }
}

/* =========================
   DATA
========================= */

async function refreshData() {
  if (!State.user) return;

  try {
    const data = await apiRequest('getValidatorDashboard', {
      user: State.user
    });

    State.docs = normalizeDocs(data.docs || data.historial || []);
    renderDashboard();
    renderDocs();

  } catch (error) {
    alert(error.message || 'Error cargando documentos.');
  }
}

function normalizeDocs(docs = []) {
  return docs.map(d => ({
    ...d,
    historial_id: d.historial_id || d.id || `${d.documento_id}|${d.version}`,
    fecha_carga: d.fecha_carga || '',
    tipo_documento: d.tipo_documento || d.type || '',
    version: Number(d.version || 1),
    nexo_id: d.nexo_id || d.entityId || '',
    tipo_nexo: String(d.tipo_nexo || d.entityType || '').toUpperCase(),
    documento_id: d.documento_id || d.id || '',
    empresa_ruc: d.empresa_ruc || d['empresa_ruc (FK)'] || '',
    razon_social: d.razon_social || d.empresa || '',
    archivo_url: d.archivo_url || d.fileUrl || '',
    fecha_vencimiento: d.fecha_vencimiento || d.expiryDate || '',
    cargado_por: d.cargado_por || '',
    estado_validacion: String(d.estado_validacion || d.status || '').toUpperCase(),
    validado_por: d.validado_por || '',
    fecha_validacion: d.fecha_validacion || '',
    observaciones: d.observaciones || ''
  }));
}

/* =========================
   RENDER
========================= */

function renderDashboard() {
  const total = State.docs.length;
  const pendientes = State.docs.filter(d => d.estado_validacion === ESTADOS.PENDIENTE).length;
  const observados = State.docs.filter(d => d.estado_validacion === ESTADOS.OBSERVADO).length;
  const rechazados = State.docs.filter(d => d.estado_validacion === ESTADOS.RECHAZADO).length;
  const validados = State.docs.filter(d => d.estado_validacion === ESTADOS.VALIDADO).length;

  setText('stat-total', total);
  setText('stat-pendientes', pendientes);
  setText('stat-observados', observados);
  setText('stat-rechazados', rechazados);
  setText('stat-validados', validados);
}

function renderDocs() {
  const container = document.getElementById('docs-list') || document.getElementById('validation-list');
  if (!container) return;

  const docs = State.docs.filter(d => {
    if (State.activeFilter === 'TODOS') return true;
    return d.estado_validacion === State.activeFilter;
  });

  if (!docs.length) {
    container.innerHTML = `
      <div class="p-10 bg-white rounded-[32px] border border-slate-100 text-center">
        <p class="font-black text-slate-400 uppercase tracking-widest text-xs">
          No hay documentos para mostrar.
        </p>
      </div>
    `;
    refreshIcons();
    return;
  }

  container.innerHTML = docs.map(doc => `
    <div class="bg-white border border-slate-100 rounded-[32px] p-6 shadow-xl shadow-slate-100/50 hover:border-red-100 transition-all">
      <div class="flex items-start justify-between gap-6">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
            <i data-lucide="file-text" size="24"></i>
          </div>

          <div>
            <h3 class="font-black text-slate-900 uppercase leading-tight">
              ${escapeHtml(doc.tipo_documento)}
            </h3>

            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              ${escapeHtml(doc.tipo_nexo)} · ${escapeHtml(doc.nexo_id)} · v${doc.version}
            </p>

            <p class="text-xs text-slate-500 mt-3">
              Empresa: <strong>${escapeHtml(doc.razon_social || doc.empresa_ruc)}</strong>
            </p>

            <p class="text-xs text-slate-500">
              Vence: <strong>${formatDate(doc.fecha_vencimiento) || 'N/A'}</strong>
            </p>
          </div>
        </div>

        <span class="${getStatusClass(doc.estado_validacion)}">
          ${escapeHtml(doc.estado_validacion)}
        </span>
      </div>

      <div class="mt-6 flex flex-wrap gap-3 justify-end">
        ${doc.archivo_url ? `
          <button type="button" onclick="openFile('${escapeAttr(doc.archivo_url)}')" class="px-5 py-3 rounded-2xl bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100">
            Ver Archivo
          </button>
        ` : ''}

        <button type="button" onclick="openValidationModal('${escapeAttr(doc.historial_id)}')" class="px-5 py-3 rounded-2xl bg-[#E20613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#B90510]">
          Validar
        </button>
      </div>
    </div>
  `).join('');

  refreshIcons();
}

/* =========================
   FILTERS
========================= */

function filterValidation(status) {
  State.activeFilter = status;
  renderDocs();

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('bg-slate-900', 'text-white', 'shadow-xl');
    btn.classList.add('bg-white', 'text-slate-500');
  });

  if (event?.target) {
    event.target.classList.add('bg-slate-900', 'text-white', 'shadow-xl');
    event.target.classList.remove('bg-white', 'text-slate-500');
  }
}

/* =========================
   MODAL VALIDACIÓN
========================= */

function openValidationModal(historialId) {
  const doc = State.docs.find(d => String(d.historial_id) === String(historialId));

  if (!doc) {
    alert('Documento no encontrado.');
    return;
  }

  State.selectedDoc = doc;

  setText('modal-doc-title', doc.tipo_documento);
  setText('modal-doc-nexo', `${doc.tipo_nexo} · ${doc.nexo_id}`);
  setText('modal-doc-version', `Versión v${doc.version}`);
  setText('modal-doc-empresa', doc.razon_social || doc.empresa_ruc);
  setText('modal-doc-vencimiento', formatDate(doc.fecha_vencimiento) || 'N/A');

  const comment = document.getElementById('validation-comment');
  if (comment) comment.value = '';

  const iframe = document.getElementById('doc-preview');
  if (iframe && doc.archivo_url) {
    iframe.src = doc.archivo_url;
  }

  const modal = document.getElementById('validation-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  refreshIcons();
}

function closeValidationModal() {
  State.selectedDoc = null;

  const iframe = document.getElementById('doc-preview');
  if (iframe) iframe.src = '';

  const modal = document.getElementById('validation-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

/* =========================
   ACCIONES DE VALIDACIÓN
========================= */

async function approveSelectedDoc() {
  if (!State.selectedDoc) {
    alert('No hay documento seleccionado.');
    return;
  }

  const confirmOk = confirm('¿Confirmas aprobar este documento?');
  if (!confirmOk) return;

  try {
    await apiRequest('approveHistoricalVersion', {
      user: State.user,
      documento_id: State.selectedDoc.documento_id,
      version: State.selectedDoc.version,
      observaciones: getValidationComment()
    });

    closeValidationModal();
    await refreshData();

    alert('Documento validado correctamente.');

  } catch (error) {
    alert(error.message || 'Error aprobando documento.');
  }
}

async function observeSelectedDoc() {
  await rejectOrObserveSelectedDoc(ESTADOS.OBSERVADO);
}

async function rejectSelectedDoc() {
  await rejectOrObserveSelectedDoc(ESTADOS.RECHAZADO);
}

async function rejectOrObserveSelectedDoc(status) {
  if (!State.selectedDoc) {
    alert('No hay documento seleccionado.');
    return;
  }

  const observaciones = getValidationComment();

  if (!observaciones) {
    alert('Debe ingresar una observación para observar o rechazar.');
    return;
  }

  const label = status === ESTADOS.OBSERVADO ? 'observar' : 'rechazar';
  const confirmOk = confirm(`¿Confirmas ${label} este documento?`);
  if (!confirmOk) return;

  try {
    await apiRequest('rejectHistoricalVersion', {
      user: State.user,
      documento_id: State.selectedDoc.documento_id,
      version: State.selectedDoc.version,
      estado_validacion: status,
      observaciones
    });

    closeValidationModal();
    await refreshData();

    alert(`Documento ${status.toLowerCase()} correctamente.`);

  } catch (error) {
    alert(error.message || 'Error actualizando documento.');
  }
}

function getValidationComment() {
  return document.getElementById('validation-comment')?.value.trim() || '';
}

/* =========================
   HELPERS
========================= */

function showLoader(show) {
  const loader = document.getElementById('app-loader');

  if (!loader) return;

  if (show) {
    loader.classList.remove('hidden');
    loader.classList.add('flex');
  } else {
    loader.classList.add('hidden');
    loader.classList.remove('flex');
  }
}

function openFile(url) {
  if (!url) return;
  window.open(url, '_blank');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

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

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function getStatusClass(status) {
  const base = 'px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border';

  if (status === ESTADOS.PENDIENTE) {
    return `${base} bg-amber-50 text-amber-600 border-amber-100`;
  }

  if (status === ESTADOS.VALIDADO) {
    return `${base} bg-emerald-50 text-emerald-600 border-emerald-100`;
  }

  if (status === ESTADOS.OBSERVADO) {
    return `${base} bg-orange-50 text-orange-600 border-orange-100`;
  }

  if (status === ESTADOS.RECHAZADO) {
    return `${base} bg-red-50 text-red-600 border-red-100`;
  }

  return `${base} bg-slate-50 text-slate-500 border-slate-100`;
}

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

/* =========================
   INIT
========================= */

document.addEventListener('DOMContentLoaded', async () => {
  refreshIcons();

  if (State.user) {
    document.getElementById('login-modal')?.classList.add('hidden');
    document.getElementById('app-container')?.classList.remove('hidden');

    setUserHeader(State.user);

    await refreshData();
  } else {
    document.getElementById('login-modal')?.classList.remove('hidden');
    document.getElementById('app-container')?.classList.add('hidden');
  }
});

/* =========================
   GLOBALS
========================= */

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
