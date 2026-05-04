import CONFIG from './config.js';

/**
 * HT-BPDT — Portal Asistente
 * script.js definitivo para GitHub Pages + Google Apps Script
 */

// ===============================
// SESIÓN SEGURA
// ===============================
const SESSION_KEY = 'htbpdt_asistente_session';

function getStoredSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

// ===============================
// ESTADO GLOBAL
// ===============================
const state = {
    user: getStoredSession(),
    activeTab: 'dashboard',
    lastData: null,
    isLoading: false
};

// ===============================
// UTILIDADES
// ===============================
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

    getAveragePercent(values = []) {
        const valid = values
            .map(Number)
            .filter(v => !Number.isNaN(v));

        if (!valid.length) return 0;

        return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
    },

    createIcons() {
        if (window.lucide) {
            lucide.createIcons();
        }
    }
};

// ===============================
// API SERVICE
// ===============================
const api = {
    async request(action, payload = {}) {
        if (!CONFIG.API_URL || CONFIG.API_URL.includes('XXXXXXXX')) {
            throw new Error('Backend no configurado. Revisa config.js.');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

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

// ===============================
// COMPONENTES HTML
// ===============================
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
        const placa = unit.id || unit.placa || unit.Placa || '-';
        const sistema = unit.sistema || unit.tipo || unit.Sistema || '-';
        const estado = unit.estado || unit.Estado || '-';
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
        const dni = person.dni || person.DNI || '-';
        const nombre = person.nombre || person.nombres || person.Nombres || '-';
        const cargo = person.cargo || person.Cargo || '-';
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
        const tipo = doc.tipo_documento || doc.tipo || doc.documento || '-';
        const nexo = doc.nexo_id || doc.nexo || doc.placa || doc.dni || '-';
        const estado = doc.estado || doc.Estado || '-';
        const vencimiento = doc.fecha_vencimiento || doc.vencimiento || '-';

        return `
            <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                <td class="px-8 py-5 font-bold text-slate-900">${utils.escape(tipo)}</td>
                <td class="px-8 py-5 text-sm text-slate-500">${utils.escape(nexo)}</td>
                <td class="px-8 py-5 text-sm font-bold text-slate-600">${utils.escape(estado)}</td>
                <td class="px-8 py-5 text-sm text-slate-500">${utils.escape(vencimiento)}</td>
            </tr>
        `;
    }
};

// ===============================
// UI
// ===============================
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
                <div class="card-brand p-0 overflow-hidden">
                    <table class="w-full text-left">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                <th class="px-8 py-5">Documento</th>
                                <th class="px-8 py-5">Nexo</th>
                                <th class="px-8 py-5">Estado</th>
                                <th class="px-8 py-5">Vencimiento</th>
                            </tr>
                        </thead>
                        <tbody id="docs-table-body"></tbody>
                    </table>
                </div>
            `;
            main.appendChild(docs);
        }
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
            this.renderDocs(data.docs || []);
        }
    },

    renderDashboard(stats = {}, units = [], crew = []) {
        const complianceVal = utils.getAveragePercent([
            stats.unitsCompliance,
            stats.crewCompliance,
            stats.companyCompliance
        ]);

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
                    const placa = u.id || u.placa || u.Placa || '-';
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

    renderDocs(docs = []) {
        const tbody = document.getElementById('docs-table-body');
        if (!tbody) return;

        tbody.innerHTML = docs.length
            ? docs.map(Components.DocRow).join('')
            : `<tr><td colspan="4">${Components.Empty('No hay documentos registrados.')}</td></tr>`;
    },

    showApp() {
        const login = document.getElementById('login-modal');
        const app = document.getElementById('app-container');

        if (login) login.classList.add('hidden');
        if (app) app.classList.remove('hidden');

        const empresa = document.getElementById('user-empresa');
        if (empresa) {
            empresa.innerText =
                state.user?.empresa ||
                state.user?.razon_social ||
                state.user?.Razon_Social ||
                'EMPRESA';
        }
    },

    showLogin() {
        const login = document.getElementById('login-modal');
        const app = document.getElementById('app-container');

        if (login) login.classList.remove('hidden');
        if (app) app.classList.add('hidden');
    }
};

// ===============================
// APP CONTROLLERS
// ===============================
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
            console.error('Fallo la actualización de datos:', error);

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

// ===============================
// INICIALIZACIÓN
// ===============================
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

// ===============================
// FUNCIONES GLOBALES PARA HTML
// ===============================
window.switchTab = id => ui.switchTab(id);
window.handleLogin = event => window.app.login(event);
window.logout = () => window.app.logout();
window.refreshData = () => window.app.refreshData();
