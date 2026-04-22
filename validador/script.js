/**
 * Portal Validador HT-BPDT
 * Vanilla JS Implementation (State-driven)
 */

const State = {
    user: null,
    activeTab: 'dashboard',
    selectedCompanyId: null,
    companies: [],
    documents: [],
    isLoading: false,
    dashboardStats: null
};

// --- CORE UTILS ---

/**
 * Centralized fetch helper for Apps Script Web App
 */
async function apiRequest(action, data = {}) {
    showLoader(true);
    try {
        const response = await fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action, ...data })
        });
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const result = await response.json();
        if (!result.ok) throw new Error(result.message || "Error desconocido en el servidor");
        
        return result.data;
    } catch (err) {
        console.error("API Request Failed:", err);
        alert(`Error: ${err.message}`);
        return null;
    } finally {
        showLoader(false);
    }
}

function showLoader(show) {
    State.isLoading = show;
    const loader = document.getElementById('global-loader');
    loader.style.display = show ? 'flex' : 'none';
}

// --- APP LOGIC ---

async function init() {
    lucide.createIcons();
    setupEventListeners();
}

function setupEventListeners() {
    // Login Form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Sidebar Navigation
    document.getElementById('sidebar-nav').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        navigateTo(btn.dataset.tab);
    });

    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', () => refreshData());

    // Back Button
    document.getElementById('btn-back').addEventListener('click', () => {
        State.selectedCompanyId = null;
        render();
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        location.reload(); // Simple reset
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const dni = document.getElementById('login-dni').value;
    const pass = document.getElementById('login-pass').value;

    if (!dni || !pass) return alert("Por favor complete todos los campos.");

    const data = await apiRequest('login', { dni, pass });
    if (data) {
        State.user = data.user;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        document.getElementById('user-display-name').textContent = State.user.name;
        document.getElementById('user-avatar').textContent = State.user.name.charAt(0);
        
        await refreshData();
    }
}

async function refreshData() {
    const data = await apiRequest('getDashboard');
    if (data) {
        State.companies = data.companies;
        State.documents = data.documents;
        State.dashboardStats = calculateStats();
        render();
    }
}

function navigateTo(tab) {
    State.activeTab = tab;
    State.selectedCompanyId = null;
    render();
}

// --- RENDERERS ---

function render() {
    updateHeadings();
    renderSidebar();
    renderActiveView();
    lucide.createIcons();
}

function updateHeadings() {
    const title = document.getElementById('view-title');
    const subtitle = document.getElementById('view-subtitle');
    const backBtn = document.getElementById('btn-back');

    if (State.selectedCompanyId) {
        const company = State.companies.find(c => c.id === State.selectedCompanyId);
        title.textContent = `Detalle: ${company.name}`;
        subtitle.textContent = "Análisis de pilar vehicular y tripulación.";
        backBtn.classList.remove('hidden');
    } else {
        backBtn.classList.add('hidden');
        switch (State.activeTab) {
            case 'dashboard':
                title.textContent = "Resumen Central";
                subtitle.textContent = "Estado global de la red HT-BPDT.";
                break;
            case 'validation':
                title.textContent = "Bandeja de Entrada";
                subtitle.textContent = "Validación de documentos pendientes.";
                break;
            case 'companies':
                title.textContent = "Proveedores";
                subtitle.textContent = "Gestión de empresas de transporte.";
                break;
            case 'reports':
                title.textContent = "Centro de Reportes";
                subtitle.textContent = "Exportación de datos y auditorías.";
                break;
        }
    }
}

function renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    const pendingCount = State.documents.filter(d => d.status === 'PENDING').length;
    
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
        { id: 'validation', label: 'Validación', icon: 'check-circle-2', badge: pendingCount },
        { id: 'companies', label: 'Empresas', icon: 'building-2' },
        { id: 'reports', label: 'Reportes', icon: 'bar-chart-3' }
    ];

    nav.innerHTML = tabs.map(tab => `
        <button data-tab="${tab.id}" class="w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all text-sm relative ${
            State.activeTab === tab.id && !State.selectedCompanyId ? 'bg-[#E30613] text-white shadow-xl shadow-red-100' : 'text-slate-500 hover:bg-slate-50'
        }">
            <i data-lucide="${tab.icon}" style="width: 20px; height: 20px;"></i>
            <span>${tab.label}</span>
            ${tab.badge > 0 ? `<span class="absolute right-6 px-2 py-0.5 rounded-lg text-[10px] font-black ${State.activeTab === tab.id ? 'bg-white text-[#E30613]' : 'bg-red-600 text-white'}">${tab.badge}</span>` : ''}
        </button>
    `).join('');
}

function renderActiveView() {
    document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
    
    if (State.selectedCompanyId) {
        document.getElementById('view-company-detail').classList.add('active');
        renderCompanyDetail();
        return;
    }

    const activeView = document.getElementById(`view-${State.activeTab}`);
    activeView.classList.add('active');

    switch (State.activeTab) {
        case 'dashboard': renderDashboardView(); break;
        case 'validation': renderValidationView(); break;
        case 'companies': renderCompaniesView(); break;
        case 'reports': renderReportsView(); break;
    }
}

// --- VIEW COMPONENTS ---

function renderDashboardView() {
    const stats = State.dashboardStats;
    const view = document.getElementById('view-dashboard');
    
    view.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            ${renderMetricCard("ALCANCE GLOBAL", stats.avgCompliance, "Promedio general proveedores", "#3B82F6", stats.coverage, "Controlado")}
            ${renderMetricCard("CUMPLIMIENTO FLOTA", stats.fleetCompliance, "Unidades aptas s/ universo", "#E30613", stats.fleetFit, "Aptas", "#00B074")}
            ${renderMetricCard("APTITUD TRIPULACIÓN", stats.crewCompliance, "Conductores aptos s/ universo", "#FFB300", stats.crewFit, "Aptos", "#00B074")}
        </div>
        
        <div class="card-brand p-12 bg-white">
            <h3 class="text-2xl font-black text-slate-900 uppercase italic mb-10">Evolución de Alcance</h3>
            <div class="h-[400px] w-full"><canvas id="chart-evolution"></canvas></div>
        </div>
    `;
    
    initChart(stats);
}

function renderMetricCard(title, pct, sub, color, ringPct, ringLabel, miniColor = color) {
    const dashOffset = 263.89 * (1 - ringPct / 100);
    return `
        <div class="card-brand p-8 bg-white flex items-center justify-between gap-6">
            <div class="space-y-4 flex-1">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">${title}</p>
                <h2 class="text-5xl font-black tracking-tighter" style="color: ${color}">${pct}%</h2>
                <p class="text-[11px] font-bold text-slate-500 italic">${sub}</p>
            </div>
            <div class="relative w-32 h-32 shrink-0">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="transparent" stroke="#F8FAFC" stroke-width="10"></circle>
                    <circle cx="50" cy="50" r="42" fill="transparent" stroke="${color}" stroke-width="10" stroke-dasharray="263.89" stroke-dashoffset="${dashOffset}" stroke-linecap="round"></circle>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-xl font-black text-slate-900">${ringPct}%</span>
                    <span class="text-[7px] font-black text-slate-400 uppercase">${ringLabel}</span>
                </div>
            </div>
        </div>
    `;
}

function renderValidationView() {
    const docs = State.documents.filter(d => d.status === 'PENDING' || d.status === 'OBSERVED');
    const view = document.getElementById('view-validation');

    view.innerHTML = `
        <div class="card-brand overflow-hidden">
            <div class="p-8 border-b border-slate-50 bg-white">
                <div class="relative w-full max-w-md">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" style="width: 18px; height: 18px;"></i>
                    <input type="text" placeholder="Buscar documento, placa o RUC..." class="input-brand pl-12 text-sm">
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="bg-[#F8FAFC] border-b border-slate-100">
                        <tr>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Tipo</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documento</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proveedor</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${docs.map(doc => `
                            <tr>
                                <td class="px-8 py-6 text-center">
                                    <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400">
                                        <i data-lucide="${doc.entityType === 'unit' ? 'truck' : 'users'}" style="width: 18px; height: 18px;"></i>
                                    </div>
                                </td>
                                <td class="px-8 py-6">
                                    <p class="font-black text-slate-900 text-sm tracking-tight uppercase">${doc.type}</p>
                                    <p class="text-xs text-slate-400 font-mono italic">${doc.entityId}</p>
                                </td>
                                <td class="px-8 py-6 text-slate-600 font-bold text-xs uppercase line-clamp-1">${doc.companyName}</td>
                                <td class="px-8 py-6">
                                    <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${CONFIG.STATUS_CLASSES[doc.status]}">
                                        ${doc.status}
                                    </span>
                                </td>
                                <td class="px-8 py-6 text-xs text-slate-400 font-medium">${doc.uploadDate}</td>
                                <td class="px-8 py-6 text-center">
                                    <button onclick="openValidationModal('${doc.id}')" class="p-3 bg-white border border-slate-100 rounded-xl text-slate-300 hover:text-[#E30613] hover:border-red-100 transition-all">
                                        <i data-lucide="eye" style="width: 18px; height: 18px;"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderCompaniesView() {
    const view = document.getElementById('view-companies');
    view.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            ${State.companies.map(c => `
                <div onclick="State.selectedCompanyId = '${c.id}'; render();" class="card-brand p-10 cursor-pointer group flex flex-col h-full hover:bg-slate-50">
                    <div class="flex justify-between items-start mb-10">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase mb-1">RUC: ${c.ruc}</p>
                            <h3 class="text-2xl font-black text-slate-900 tracking-tighter leading-none">${c.name}</h3>
                        </div>
                        <div class="text-right">
                            <p class="text-4xl font-black text-[#E30613]">${c.compliance}%</p>
                            <p class="text-[10px] font-bold text-slate-400 uppercase mt-1">Cumplimiento</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4 mb-10 text-center">
                        <div><p class="text-lg font-black">${c.stats.monitoredUnits}</p><p class="text-[8px] font-black text-slate-400 uppercase italic">Unidades</p></div>
                        <div><p class="text-lg font-black">${c.stats.monitoredDrivers}</p><p class="text-[8px] font-black text-slate-400 uppercase italic">Conductores</p></div>
                        <div><p class="text-lg font-black text-red-600">${c.stats.criticalDocs}</p><p class="text-[8px] font-black text-red-300 uppercase italic">Críticos</p></div>
                    </div>
                    <div class="mt-auto pt-6 border-t border-slate-100 flex justify-between items-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                        <span>Ver Expediente Operativo</span>
                        <i data-lucide="chevron-right" class="group-hover:text-[#E30613]" style="width: 16px; height: 16px;"></i>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderReportsView() {
    const view = document.getElementById('view-reports');
    view.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            ${['Global Compliance', 'Expediente Proveedor', 'Auditoría Validación', 'Alerta Críticos'].map(rep => `
                <div class="card-brand p-12 hover:shadow-2xl transition-all group">
                    <div class="p-6 bg-slate-50 rounded-3xl w-fit mb-8 group-hover:bg-red-50 text-slate-300 group-hover:text-red-500 transition-colors">
                        <i data-lucide="file-text" style="width: 32px; height: 32px;"></i>
                    </div>
                    <h3 class="text-2xl font-black uppercase italic tracking-tighter mb-4">${rep}</h3>
                    <p class="text-slate-500 font-medium mb-10 text-sm">Reporte detallado generado en tiempo real desde la sincronización de Google Sheets.</p>
                    <button class="w-full py-4 bg-slate-900 text-white rounded-[1.5rem] font-bold uppercase text-[10px] tracking-widest hover:bg-slate-700">Descargar Informe</button>
                </div>
            `).join('')}
        </div>
    `;
}

// --- MODAL ACTIONS ---

function openValidationModal(docId) {
    const doc = State.documents.find(d => d.id === docId);
    if (!doc) return;

    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
        <div class="flex justify-between items-start mb-8">
            <div>
                <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${CONFIG.STATUS_CLASSES[doc.status]}">${doc.status}</span>
                <h3 class="text-3xl font-black italic tracking-tighter uppercase mt-3">${doc.type}</h3>
                <p class="text-slate-500 font-medium">Proveedor: ${doc.companyName}</p>
            </div>
            <button onclick="closeModal()" class="p-3 text-slate-300 hover:text-slate-900"><i data-lucide="x" style="width: 24px; height: 24px;"></i></button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div class="h-64 lg:h-full bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                <i data-lucide="file-text" style="width: 64px; height: 64px; opacity: 0.1;"></i>
                <p class="text-[10px] font-black uppercase tracking-widest mt-4">Previsualización</p>
                <a href="#" class="text-[9px] text-blue-500 underline font-bold mt-2 uppercase">Ver archivo original</a>
            </div>
            <div class="space-y-6">
                <div class="space-y-4">
                    <label class="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">Motivo / Observación</label>
                    <textarea id="val-comment" class="w-full h-32 p-6 bg-slate-50 rounded-[2rem] border-none outline-none focus:bg-white focus:ring-4 focus:ring-red-50 text-sm font-medium resize-none" placeholder="Motivo del rechazo u observación..."></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <button onclick="handleValidationSubmit('${doc.id}', 'OBSERVED')" class="py-4 border-2 border-orange-100 text-orange-600 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-orange-50">Observar</button>
                    <button onclick="handleValidationSubmit('${doc.id}', 'REJECTED')" class="py-4 border-2 border-red-100 text-red-600 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-red-50">Rechazar</button>
                </div>
                <button onclick="handleValidationSubmit('${doc.id}', 'APPROVED')" class="w-full py-5 btn-primary text-xs">Confirmar Aprobación</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    lucide.createIcons();
}

function closeModal() {
    document.getElementById('modal-container').style.display = 'none';
}

async function handleValidationSubmit(docId, status) {
    const comment = document.getElementById('val-comment').value;
    if ((status === 'REJECTED' || status === 'OBSERVED') && !comment) {
        return alert("Es obligatorio dejar un comentario para observar o rechazar.");
    }

    const data = await apiRequest('validateDoc', { docId, status, comment });
    if (data) {
        closeModal();
        await refreshData();
    }
}

// --- STATS & CHARTS ---

function calculateStats() {
    const total = State.companies.length;
    const universeUnits = State.companies.reduce((a, b) => a + b.stats.totalUnits, 0);
    const fitUnits = State.companies.reduce((a, b) => a + b.stats.fitUnits, 0);
    const monitoredUnits = State.companies.reduce((a, b) => a + b.stats.monitoredUnits, 0);
    
    const universeDrivers = State.companies.reduce((a, b) => a + b.stats.totalDrivers, 0);
    const fitDrivers = State.companies.reduce((a, b) => a + b.stats.fitDrivers, 0);

    return {
        avgCompliance: Math.round(State.companies.reduce((a, b) => a + b.compliance, 0) / total),
        fleetCompliance: Math.round((fitUnits / universeUnits) * 100),
        crewCompliance: Math.round((fitDrivers / universeDrivers) * 100),
        coverage: Math.round((monitoredUnits / universeUnits) * 100),
        fleetFit: fitUnits,
        crewFit: fitDrivers,
        universeUnits,
        universeDrivers,
        validationProgress: Math.round((State.documents.filter(d => d.status !== 'PENDING').length / State.documents.length) * 100)
    };
}

let chartInstance = null;
function initChart(stats) {
    const ctx = document.getElementById('chart-evolution');
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026 (Actual)'],
            datasets: [{
                label: 'Compliance Real',
                data: [45, 62, 75, stats.avgCompliance],
                borderColor: '#3B82F6',
                borderWidth: 4,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: '#fff',
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.05)'
            }, {
                label: 'Meta BPDT',
                data: [90, 90, 90, 90],
                borderColor: '#FFB300',
                borderDash: [5, 10],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, grid: { borderDash: [5, 5] }, ticks: { font: { weight: 'bold' } } },
                x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
            }
        }
    });
}

// Start
init();
