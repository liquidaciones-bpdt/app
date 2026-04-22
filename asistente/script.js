import CONFIG from './config.js';

/**
 * HT-BPDT: ASISTENTE DIGITAL
 * Lógica Principal de la Aplicación
 */

// --- ESTADO GLOBAL ---
const state = {
    user: null,
    activeTab: 'dashboard',
    lastData: null,
    isLoading: false
};

// --- SERVICIO API (Centralizado) ---
const api = {
    /**
     * Helper para peticiones HTTP contra GAS
     */
    async request(action, payload = {}) {
        if (!CONFIG.API_URL || CONFIG.API_URL.includes('XXXXXXXX')) {
            throw new Error("URL del Backend no configurada en config.js");
        }

        try {
            ui.toggleGlobalLoader(true);
            
            // Petición usando fetch con patrón para evitar bloqueos de CORS en GAS
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                mode: 'no-cors', // Evita preflight, GAS maneja el POST directamente
                body: JSON.stringify({ action, payload })
            });

            // Nota: Con 'no-cors' no podemos leer la respuesta directamente.
            // Para GitHub Pages + Apps Script real, usamos el truco de redirección o JSONP.
            // RECOMENDACIÓN PRODUCCIÓN: Si necesitas leer el JSON de vuelta con POST,
            // Google Apps Script requiere que la petición sea simple (text/plain).
            
            const simpleResponse = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action, payload })
            });

            const result = await simpleResponse.json();
            
            if (!result.ok) throw new Error(result.message || "Error desconocido en el servidor");
            
            return result;
        } catch (error) {
            console.error(`API Error [${action}]:`, error);
            ui.notify(`Error: ${error.message}`, 'error');
            throw error;
        } finally {
            ui.toggleGlobalLoader(false);
        }
    }
};

// --- UI HANDLERS (DOM) ---
const ui = {
    /**
     * Muestra/Oculta el cargador global y bloquea/desbloquea botones
     */
    toggleGlobalLoader(show, message = "Procesando...") {
        state.isLoading = show;
        const loader = document.getElementById('app-loader');
        const loaderMsg = document.getElementById('app-loader-message');
        const buttons = document.querySelectorAll('button');

        if (show) {
            loader.classList.remove('hidden');
            loader.classList.add('flex');
            loaderMsg.innerText = message;
            buttons.forEach(btn => btn.disabled = true);
        } else {
            loader.classList.add('hidden');
            loader.classList.remove('flex');
            buttons.forEach(btn => btn.disabled = false);
        }
    },

    /**
     * Notificaciones simples al usuario
     */
    notify(message, type = 'info') {
        alert(message); // En producción se puede reemplazar por un toast visual
    },

    /**
     * Cambia entre secciones de la aplicación
     */
    switchTab(tabId) {
        state.activeTab = tabId;
        
        // Actualizar Navegación
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('bg-[#E20613]', 'text-white', 'shadow-xl', 'shadow-red-200');
            btn.classList.add('text-slate-500', 'hover:bg-slate-50');
        });
        
        const activeBtn = document.getElementById(`nav-${tabId}`);
        if (activeBtn) {
            activeBtn.classList.add('bg-[#E20613]', 'text-white', 'shadow-xl', 'shadow-red-200');
            activeBtn.classList.remove('text-slate-500', 'hover:bg-slate-50');
        }

        // Actualizar Vistas
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
        const activeSec = document.getElementById(`view-${tabId}`);
        if (activeSec) activeSec.classList.remove('hidden');

        // Renderizar datos del tab
        this.renderCurrentTab();
    },

    renderCurrentTab() {
        if (!state.lastData) return;
        const data = state.lastData;

        switch (state.activeTab) {
            case 'dashboard': this.renderDashboard(data.stats, data.units, data.crew); break;
            case 'fleet': this.renderFleet(data.units); break;
            case 'crew': this.renderCrew(data.crew); break;
            case 'docs': this.renderDocs(data.docs); break;
        }
    },

    renderDashboard(stats, units, crew) {
        // Implementación de renderizado (Inyección de HTML)
        const complianceVal = Math.round((stats.unitsCompliance + stats.crewCompliance + stats.companyCompliance) / 3);
        document.getElementById('compliance-val').innerText = `${complianceVal}%`;
        
        const ring = document.getElementById('compliance-ring');
        const offset = 263.89 * (1 - complianceVal / 100);
        ring.style.strokeDashoffset = offset;

        // Renderizado de listas cortas
        document.getElementById('fleet-summary-list').innerHTML = units.slice(0, 3).map(u => `
            <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100">
                        <i data-lucide="truck" size="18"></i>
                    </div>
                    <p class="font-bold text-slate-900">${u.id}</p>
                </div>
                <span class="text-xs font-bold text-emerald-500">${u.compliance}%</span>
            </div>
        `).join('');
        
        lucide.createIcons();
    },

    renderFleet(units) {
        const tbody = document.getElementById('fleet-table-body');
        tbody.innerHTML = units.map(u => `
            <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                <td class="px-8 py-5 font-bold text-slate-900">${u.id}</td>
                <td class="px-8 py-5 text-sm text-slate-500">${u.sistema}</td>
                <td class="px-8 py-5 text-sm font-bold text-emerald-500">${u.estado}</td>
                <td class="px-8 py-5">
                    <div class="flex items-center gap-3">
                        <div class="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-500" style="width:${u.compliance}%"></div>
                        </div>
                        <span class="text-xs font-bold">${u.compliance}%</span>
                    </div>
                </td>
            </tr>
        `).join('');
    }
};

// --- EVENTOS Y CONTROLADORES ---
window.app = {
    /**
     * Inicio de sesión
     */
    async login(event) {
        event.preventDefault();
        const dni = document.getElementById('login-dni').value.trim();
        const pass = document.getElementById('login-pass').value.trim();

        if (!dni || !pass) return ui.notify("Por favor complete todos los campos", "warning");

        try {
            const res = await api.request('login', { dni, pass });
            state.user = res.data;
            
            // UI Transition
            document.getElementById('login-modal').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            document.getElementById('user-empresa').innerText = res.data.empresa;
            
            await this.refreshData();
        } catch (e) {
            // Error manejado en el service
        }
    },

    /**
     * Sincronización de datos
     */
    async refreshData() {
        try {
            const res = await api.request('getDashboard');
            state.lastData = res.data;
            ui.renderCurrentTab();
        } catch (e) {
            console.error("Fallo la actualización de datos");
        }
    },

    logout() {
        if (confirm("¿Está seguro que desea cerrar sesión?")) {
            ui.toggleGlobalLoader(true, "Finalizando sesión...");
            setTimeout(() => window.location.reload(), 1000);
        }
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
});

// Exponemos funciones necesarias para los onclick de HTML
window.switchTab = (id) => ui.switchTab(id);
window.handleLogin = (e) => window.app.login(e);
window.logout = () => window.app.logout();
window.refreshData = () => window.app.refreshData();
