import CONFIG from './config.js';

const SESSION_KEY = 'htbpdt_asistente_session_v3';
const REQUEST_TIMEOUT_MS = 25000;

const state = {
  user: getStoredSession(),
  activeTab: 'dashboard',
  lastData: null,
  isLoading: false
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

const utils = {
  escape(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  },

  clampPercent(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  },

  createIcons() {
    if (window.lucide) {
      lucide.createIcons();
    }
  },

  fileToBase64(file) {
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
  },

  unique(values) {
    return [...new Set(values.filter(Boolean))];
  }
};

const api = {
  async request(action, payload = {}) {
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('XXXXXXXX')) {
      throw new Error('Backend no configurado. Revisa config.js.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      ui.toggleGlobalLoader(true, 'Conectando con el servidor...');

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
        throw new Error(result.message || 'El servidor rechazó la solicitud.');
      }

      return result;

    } catch (error) {
      const message = api.getFriendlyError(error);
      ui.notify(message, 'error');
      console.error(`API Error [${action}]:`, error);
      throw error;

    } finally {
      clearTimeout(timeout);
      ui.toggleGlobalLoader(false);
    }
  },

  getFriendlyError(error) {
    const msg = error?.message || '';

    if (error.name === 'AbortError') {
      return 'La solicitud tardó demasiado. Verifica si la información se guardó y vuelve a intentar.';
    }

    if (msg.includes('Failed to fetch')) {
      return 'No se pudo conectar con Google Apps Script. Revisa internet, permisos, despliegue o URL del Web App.';
    }

    if (msg === 'HTTP_404') {
      return 'Error de configuración: la URL del backend no existe o está mal copiada.';
    }

    if (msg === 'HTTP_500' || msg === 'HTTP_503') {
      return 'El servidor está ocupado o tuvo un error temporal. Intenta nuevamente.';
    }

    return msg || 'Ocurrió un error inesperado.';
  }
};

const Components = {
  ProgressBar(value) {
    const percent = utils.clampPercent(value);

    return `
      <div class="flex items-center gap-3">
        <div class="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full bg-emerald-500" style="width:${percent}%"></div>
        </div>
        <span class="text-xs font-bold">${percent}%</span>
      </div>
    `;
  },

  Empty(message) {
    return `
      <div class="p-8 text-center text-slate-400 font-bold text-sm">
        ${utils.escape(message)}
      </div>
    `;
  },

  FleetRow(unit) {
    const placa = unit.placa || unit.id || '-';
    const sistema = unit.sistema || '-';
    const estado = unit.estado || '-';
    const compliance = unit.compliance || unit.cumplimiento || 0;

    return `
      <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
        <td class="px-8 py-5 font-bold text-slate-900">${utils.escape(placa)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">${utils.escape(sistema)}</td>
        <td class="px-8 py-5 text-sm font-bold text-emerald-500">${utils.escape(estado)}</td>
        <td class="px-8 py-5">${Components.ProgressBar(compliance)}</td>
      </tr>
    `;
  },

  CrewRow(person) {
    const dni = person.dni || '-';
    const nombre = person.nombre || `${person.nombres || ''} ${person.apellidos || ''}`.trim() || '-';
    const cargo = person.cargo || '-';
    const compliance = person.compliance || person.cumplimiento || 0;

    return `
      <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
        <td class="px-8 py-5 font-bold text-slate-900">${utils.escape(dni)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">${utils.escape(nombre)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">${utils.escape(cargo)}</td>
        <td class="px-8 py-5">${Components.ProgressBar(compliance)}</td>
      </tr>
    `;
  },

  DocRow(doc) {
    const tipo = doc.tipo_documento || doc.documento || '-';
    const nexo = doc.nexo_id || doc.nexo || '-';
    const estado = doc.estado || doc.estado_vigencia || '-';
    const vencimiento = doc.fecha_vencimiento || doc.vencimiento || '-';
    const version = doc.version_actual || '-';
    const url = doc.archivo_url_actual || doc.ruta_drive || '';

    return `
      <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
        <td class="px-8 py-5 font-bold text-slate-900">${utils.escape(tipo)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">${utils.escape(nexo)}</td>
        <td class="px-8 py-5 text-sm font-bold text-slate-600">${utils.escape(estado)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">${utils.escape(vencimiento)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">v${utils.escape(version)}</td>
        <td class="px-8 py-5 text-sm">
          ${url ? `<a href="${utils.escape(url)}" target="_blank" class="font-bold text-[#E20613]">Ver PDF</a>` : '-'}
        </td>
      </tr>
    `;
  },

  HistorialRow(item) {
    const tipo = item.tipo_documento || '-';
    const nexo = item.nexo_id || '-';
    const version = item.version || '-';
    const estado = item.estado_validacion || '-';
    const fecha = item.fecha_carga || '-';
    const url = item.archivo_url || '';

    return `
      <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
        <td class="px-8 py-5 font-bold text-slate-900">${utils.escape(tipo)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">${utils.escape(nexo)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">v${utils.escape(version)}</td>
        <td class="px-8 py-5 text-sm font-bold text-slate-600">${utils.escape(estado)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">${utils.escape(fecha)}</td>
        <td class="px-8 py-5 text-sm">
          ${url ? `<a href="${utils.escape(url)}" target="_blank" class="font-bold text-[#E20613]">Ver archivo</a>` : '-'}
        </td>
      </tr>
    `;
  }
};

const ui = {
  toggleGlobalLoader(show, message = 'Procesando...') {
    state.isLoading = show;

    const loader = document.getElementById('app-loader');
    const loaderMsg = document.getElementById('app-loader-message');

    if (!loader) return;

    if (loaderMsg) loaderMsg.innerText = message;

    if (show) {
      loader.classList.remove('hidden');
      loader.classList.add('flex');
    } else {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    }

    document.querySelectorAll('button').forEach(btn => {
      btn.disabled = show;
    });
  },

  notify(message, type = 'info') {
    let container = document.getElementById('toast-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-6 right-6 z-[2000] space-y-3';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');

    const colorClass = type === 'error'
      ? 'border-red-100 text-red-700'
      : type === 'success'
        ? 'border-emerald-100 text-emerald-700'
        : 'border-slate-100 text-slate-700';

    toast.className = `bg-white ${colorClass} border shadow-xl rounded-2xl px-5 py-4 text-sm font-bold max-w-[360px]`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4500);
  },

  ensureDynamicViews() {
    const main = document.querySelector('main');
    if (!main) return;

    if (!document.getElementById('view-crew')) {
      const crew = document.createElement('div');
      crew.id = 'view-crew';
      crew.className = 'view-section hidden';
      crew.innerHTML = `
        <div class="card-brand p-0 overflow-hidden">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-100">
              <tr class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <th class="px-8 py-5">DNI</th>
                <th class="px-8 py-5">Nombres</th>
                <th class="px-8 py-5">Cargo</th>
                <th class="px-8 py-5">Documentación</th>
              </tr>
            </thead>
            <tbody id="crew-table-body"></tbody>
          </table>
        </div>
      `;
      main.appendChild(crew);
    }

    if (!document.getElementById('view-docs')) {
      const docs = document.createElement('div');
      docs.id = 'view-docs';
      docs.className = 'view-section hidden';
      docs.innerHTML = `
        <div class="flex justify-between items-center mb-8">
          <div>
            <h3 class="font-black text-xl text-slate-900">DOCUMENTOS APROBADOS</h3>
            <p class="text-slate-400 text-sm font-bold">Solo se muestra la última versión aprobada.</p>
          </div>
          <button type="button" onclick="openUploadModal()" class="btn-primary">
            <i data-lucide="upload" size="18"></i> Subir Documento
          </button>
        </div>

        <div class="card-brand p-0 overflow-hidden mb-10">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-100">
              <tr class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <th class="px-8 py-5">Documento</th>
                <th class="px-8 py-5">Nexo</th>
                <th class="px-8 py-5">Vigencia</th>
                <th class="px-8 py-5">Vencimiento</th>
                <th class="px-8 py-5">Versión</th>
                <th class="px-8 py-5">Archivo</th>
              </tr>
            </thead>
            <tbody id="docs-table-body"></tbody>
          </table>
        </div>

        <div class="card-brand p-0 overflow-hidden">
          <div class="px-8 py-6 border-b border-slate-100">
            <h3 class="font-black text-xl text-slate-900">HISTORIAL DE CARGAS</h3>
            <p class="text-slate-400 text-sm font-bold">Incluye pendientes, aprobados, observados y rechazados.</p>
          </div>
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-100">
              <tr class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <th class="px-8 py-5">Documento</th>
                <th class="px-8 py-5">Nexo</th>
                <th class="px-8 py-5">Versión</th>
                <th class="px-8 py-5">Validación</th>
                <th class="px-8 py-5">Fecha carga</th>
                <th class="px-8 py-5">Archivo</th>
              </tr>
            </thead>
            <tbody id="historial-table-body"></tbody>
          </table>
        </div>
      `;
      main.appendChild(docs);
    }

    this.ensureUploadModal();
  },

  ensureUploadModal() {
    if (document.getElementById('upload-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'upload-modal';
    modal.className = 'fixed inset-0 z-[1500] bg-slate-900/40 backdrop-blur-sm hidden items-center justify-center p-6';
    modal.innerHTML = `
      <div class="bg-white w-full max-w-[620px] rounded-[40px] shadow-2xl p-8">
        <div class="flex justify-between items-start mb-8">
          <div>
            <h3 class="text-2xl font-black text-slate-900 tracking-tight">Subir Documento</h3>
            <p class="text-slate-400 text-sm font-bold mt-1">Se registrará en Historial como pendiente de validación.</p>
          </div>
          <button type="button" onclick="closeUploadModal()" class="p-3 rounded-full bg-slate-50 text-slate-400 hover:text-[#E20613]">
            <i data-lucide="x" size="20"></i>
          </button>
        </div>

        <form id="upload-form" class="space-y-5">
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de nexo</label>
            <select id="upload-tipo-nexo" class="input-brand" required>
              <option value="">Seleccione...</option>
              <option value="UNIDAD">Unidad</option>
              <option value="TRIPULACION">Tripulación</option>
              <option value="EMPRESA">Empresa</option>
            </select>
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Unidad / Tripulante</label>
            <select id="upload-nexo-id" class="input-brand" required>
              <option value="">Seleccione...</option>
            </select>
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de documento</label>
            <select id="upload-tipo-documento" class="input-brand" required>
              <option value="">Seleccione...</option>
            </select>
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fecha de vencimiento</label>
            <input id="upload-fecha-vencimiento" type="date" class="input-brand">
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Archivo PDF / Imagen</label>
            <input id="upload-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" class="input-brand" required>
          </div>

          <button type="submit" class="w-full btn-primary py-5">
            <i data-lucide="upload-cloud" size="18"></i> CARGAR A HISTORIAL
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('upload-tipo-nexo')?.addEventListener('change', () => {
      this.populateNexoOptions();
      this.populateDocumentoOptions();
    });

    document.getElementById('upload-form')?.addEventListener('submit', event => {
      window.app.uploadDocument(event);
    });

    utils.createIcons();
  },

  populateNexoOptions() {
    const tipo = document.getElementById('upload-tipo-nexo')?.value;
    const select = document.getElementById('upload-nexo-id');
    const data = state.lastData || {};

    if (!select) return;

    select.innerHTML = '<option value="">Seleccione...</option>';

    if (tipo === 'UNIDAD') {
      (data.units || []).forEach(unit => {
        const option = document.createElement('option');
        option.value = unit.placa;
        option.textContent = `${unit.placa} — ${unit.tipo_unidad || unit.sistema || ''}`;
        select.appendChild(option);
      });
    }

    if (tipo === 'TRIPULACION') {
      (data.crew || []).forEach(person => {
        const option = document.createElement('option');
        option.value = person.dni;
        option.textContent = `${person.dni} — ${person.nombre || person.nombres || ''}`;
        select.appendChild(option);
      });
    }

    if (tipo === 'EMPRESA') {
      const option = document.createElement('option');
      option.value = state.user?.empresa_ruc || '';
      option.textContent = state.user?.razon_social || state.user?.empresa || 'Empresa';
      select.appendChild(option);
      select.value = option.value;
    }
  },

  populateDocumentoOptions() {
    const tipo = document.getElementById('upload-tipo-nexo')?.value;
    const select = document.getElementById('upload-tipo-documento');
    const requisitos = state.lastData?.requisitos || [];

    if (!select) return;

    select.innerHTML = '<option value="">Seleccione...</option>';

    const tipos = utils.unique(
      requisitos
        .filter(req => String(req.tipo_nexo || '').toUpperCase() === tipo)
        .map(req => req.tipo_documento)
    );

    tipos.forEach(tipoDoc => {
      const option = document.createElement('option');
      option.value = tipoDoc;
      option.textContent = tipoDoc;
      select.appendChild(option);
    });

    const otro = document.createElement('option');
    otro.value = 'OTROS';
    otro.textContent = 'OTROS';
    select.appendChild(otro);
  },

  switchTab(tabId) {
    state.activeTab = tabId;

    const titles = {
      dashboard: 'Dashboard',
      fleet: 'Unidades',
      crew: 'Tripulación',
      docs: 'Documentos'
    };

    const title = document.getElementById('view-title');
    if (title) title.innerText = titles[tabId] || 'Dashboard';

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
      sec.classList.add('hidden');
    });

    const activeSec = document.getElementById(`view-${tabId}`);
    if (activeSec) activeSec.classList.remove('hidden');

    this.renderCurrentTab();
    utils.createIcons();
  },

  renderCurrentTab() {
    if (!state.lastData) return;

    const data = state.lastData;

    if (state.activeTab === 'dashboard') {
      this.renderDashboard(data.stats || {}, data.units || [], data.crew || []);
    }

    if (state.activeTab === 'fleet') {
      this.renderFleet(data.units || []);
    }

    if (state.activeTab === 'crew') {
      this.renderCrew(data.crew || []);
    }

    if (state.activeTab === 'docs') {
      this.renderDocs(data.docs || [], data.historial || []);
    }
  },

  renderDashboard(stats = {}, units = [], crew = []) {
    const complianceVal = utils.clampPercent(stats.companyCompliance || 0);

    const complianceText = document.getElementById('compliance-val');
    if (complianceText) complianceText.innerText = `${complianceVal}%`;

    const ring = document.getElementById('compliance-ring');

    if (ring) {
      const offset = 263.89 * (1 - complianceVal / 100);
      ring.style.strokeDashoffset = offset;
    }

    const fleetList = document.getElementById('fleet-summary-list');

    if (fleetList) {
      if (!units.length) {
        fleetList.innerHTML = Components.Empty('No hay unidades registradas.');
      } else {
        fleetList.innerHTML = units.slice(0, 3).map(u => {
          const placa = u.placa || '-';
          const compliance = utils.clampPercent(u.compliance || u.cumplimiento || 0);

          return `
            <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100">
                  <i data-lucide="truck" size="18"></i>
                </div>
                <p class="font-bold text-slate-900">${utils.escape(placa)}</p>
              </div>
              <span class="text-xs font-bold text-emerald-500">${compliance}%</span>
            </div>
          `;
        }).join('');
      }
    }

    utils.createIcons();
  },

  renderFleet(units = []) {
    const tbody = document.getElementById('fleet-table-body');
    if (!tbody) return;

    tbody.innerHTML = units.length
      ? units.map(Components.FleetRow).join('')
      : `<tr><td colspan="4">${Components.Empty('No hay unidades registradas.')}</td></tr>`;
  },

  renderCrew(crew = []) {
    const tbody = document.getElementById('crew-table-body');
    if (!tbody) return;

    tbody.innerHTML = crew.length
      ? crew.map(Components.CrewRow).join('')
      : `<tr><td colspan="4">${Components.Empty('No hay tripulantes registrados.')}</td></tr>`;
  },

  renderDocs(docs = [], historial = []) {
    const tbodyDocs = document.getElementById('docs-table-body');
    const tbodyHistorial = document.getElementById('historial-table-body');

    if (tbodyDocs) {
      tbodyDocs.innerHTML = docs.length
        ? docs.map(Components.DocRow).join('')
        : `<tr><td colspan="6">${Components.Empty('No hay documentos aprobados.')}</td></tr>`;
    }

    if (tbodyHistorial) {
      tbodyHistorial.innerHTML = historial.length
        ? historial.map(Components.HistorialRow).join('')
        : `<tr><td colspan="6">${Components.Empty('No hay cargas en historial.')}</td></tr>`;
    }
  },

  showApp() {
    const login = document.getElementById('login-modal');
    const app = document.getElementById('app-container');

    if (login) login.classList.add('hidden');
    if (app) app.classList.remove('hidden');

    const empresa = document.getElementById('user-empresa');

    if (empresa) {
      empresa.innerText =
        state.user?.razon_social ||
        state.user?.empresa ||
        'EMPRESA';
    }
  },

  showLogin() {
    const login = document.getElementById('login-modal');
    const app = document.getElementById('app-container');

    if (login) login.classList.remove('hidden');
    if (app) app.classList.add('hidden');
  },

  openUploadModal() {
    this.ensureUploadModal();
    this.populateNexoOptions();
    this.populateDocumentoOptions();

    const modal = document.getElementById('upload-modal');

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    utils.createIcons();
  },

  closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    const form = document.getElementById('upload-form');

    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    if (form) form.reset();
  }
};

window.app = {
  async login(event) {
    event.preventDefault();

    const dni = document.getElementById('login-dni')?.value.trim();
    const pass = document.getElementById('login-pass')?.value.trim();

    if (!dni || !pass) {
      ui.notify('Por favor complete DNI y contraseña.', 'error');
      return;
    }

    try {
      const res = await api.request('login', { dni, pass });

      if (!res.data || !res.data.dni) {
        throw new Error('El servidor no devolvió una sesión válida.');
      }

      state.user = res.data;
      localStorage.setItem(SESSION_KEY, JSON.stringify(res.data));

      ui.showApp();

      await this.refreshData();

      ui.notify('Sesión iniciada correctamente.', 'success');

    } catch (error) {
      localStorage.removeItem(SESSION_KEY);
      state.user = null;
      state.lastData = null;
      ui.showLogin();
    }
  },

  async refreshData() {
    if (!state.user) {
      ui.showLogin();
      return;
    }

    try {
      const res = await api.request('getDashboard', {
        user: state.user
      });

      state.lastData = res.data || {};

      if (res.data?.user) {
        state.user = res.data.user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(res.data.user));
        ui.showApp();
      }

      ui.renderCurrentTab();

    } catch (error) {
      console.error('Falló la actualización de datos:', error);

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
        state.lastData = null;
        state.activeTab = 'dashboard';
        ui.showLogin();
      }
    }
  },

  async uploadDocument(event) {
    event.preventDefault();

    if (!state.user) {
      ui.notify('Debe iniciar sesión.', 'error');
      return;
    }

    const tipoNexo = document.getElementById('upload-tipo-nexo')?.value;
    const nexoId = document.getElementById('upload-nexo-id')?.value;
    const tipoDocumento = document.getElementById('upload-tipo-documento')?.value;
    const fechaVencimiento = document.getElementById('upload-fecha-vencimiento')?.value;
    const file = document.getElementById('upload-file')?.files?.[0];

    if (!tipoNexo || !nexoId || !tipoDocumento || !file) {
      ui.notify('Complete todos los campos obligatorios.', 'error');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
      ui.notify('Formato no permitido. Use PDF, JPG, JPEG o PNG.', 'error');
      return;
    }

    try {
      const base64 = await utils.fileToBase64(file);

      const res = await api.request('uploadDocument', {
        user: state.user,
        tipo_nexo: tipoNexo,
        nexo_id: nexoId,
        tipo_documento: tipoDocumento,
        fecha_vencimiento: fechaVencimiento,
        file_name: file.name,
        mime_type: file.type,
        file_base64: base64
      });

      ui.closeUploadModal();

      await this.refreshData();

      ui.notify(
        res.data?.message || 'Documento cargado correctamente.',
        'success'
      );

    } catch (error) {
      console.error('Error al subir documento:', error);
    }
  },

  logout() {
    const confirmLogout = confirm('¿Está seguro que desea cerrar sesión?');

    if (!confirmLogout) return;

    localStorage.removeItem(SESSION_KEY);

    state.user = null;
    state.lastData = null;
    state.activeTab = 'dashboard';

    ui.showLogin();
    ui.notify('Sesión cerrada correctamente.', 'success');
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  ui.ensureDynamicViews();
  utils.createIcons();

  if (state.user) {
    ui.showApp();
    await window.app.refreshData();
  } else {
    ui.showLogin();
  }
});

window.switchTab = id => ui.switchTab(id);
window.handleLogin = event => window.app.login(event);
window.logout = () => window.app.logout();
window.refreshData = () => window.app.refreshData();
window.openUploadModal = () => ui.openUploadModal();
window.closeUploadModal = () => ui.closeUploadModal();
