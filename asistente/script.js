/**
 * HT-BPDT Asistente - Frontend (Vanilla JS)
 */

const state = {
    user: null,
    loading: false,
    activeTab: 'dashboard',
    data: {
        units: [],
        crew: [],
        docs: [],
        stats: null
    },
    filterType: 'all',
    activeDocId: null,
    refreshing: false
};

/**
 * API WRAPPER
 */
const api = {
    call: (func, ...args) => {
        return new Promise((resolve, reject) => {
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(resolve)
                    .withFailureHandler(reject)[func](...args);
            } else {
                // Mock Logic for Local Preview
                console.warn(`Mocking API: ${func}`);
                setTimeout(() => resolve(getMockResponse(func)), 800);
            }
        });
    }
};

/**
 * NAVIGATION
 */
function switchTab(tabId) {
    state.activeTab = tabId;
    
    // Update Nav Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-[#E20613]', 'text-white', 'shadow-xl', 'shadow-red-200');
        btn.classList.add('text-slate-500', 'hover:bg-slate-50');
    });
    
    const activeBtn = document.getElementById(`nav-${tabId}`);
    activeBtn.classList.add('bg-[#E20613]', 'text-white', 'shadow-xl', 'shadow-red-200');
    activeBtn.classList.remove('text-slate-500', 'hover:bg-slate-50');

    // Update Sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');

    // Update Title
    const labels = { dashboard: 'Dashboard', fleet: 'Unidades', crew: 'Tripulación', docs: 'Documentos', company: 'Empresa' };
    document.getElementById('view-title').innerText = labels[tabId];

    renderTab();
}

/**
 * AUTHENTICATION
 */
async function handleLogin() {
    const dni = document.getElementById('login-dni').value;
    const pass = document.getElementById('login-pass').value;

    if (!dni || !pass) return alert('Ingresar credenciales.');

    showLoader('Validando acceso seguro...');
    try {
        const res = await api.call('loginUser', dni, pass);
        if (res.success) {
            state.user = res.user;
            document.getElementById('login-modal').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            document.body.classList.remove('overflow-hidden');
            
            // Set user info
            document.getElementById('user-empresa').innerText = res.user.empresa;
            document.getElementById('user-avatar').innerText = res.user.empresa.split(' ').map(w => w[0]).join('').slice(0, 2);
            
            reloadData();
        } else {
            alert(res.message);
        }
    } catch (e) {
        alert('Error conectando al sistema.');
    } finally {
        hideLoader();
    }
}

function logout() {
    showLoader('Cerrando sesión de forma segura...');

    // Provide immediate visual feedback on the button if possible
    const logoutBtn = document.querySelector('button[onclick="logout()"]');
    if (logoutBtn) {
        logoutBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" size="20"></i> Cerrando...';
        lucide.createIcons();
    }

    // Wait for the transition to finish
    setTimeout(() => {
        // Clear state and reload
        state.user = null;
        location.reload();
    }, 1200); // 1.2s total (fading + processing time)
}

/**
 * DATA RENDERING
 */
async function reloadData() {
    try {
        await refreshData(true);
    } catch (e) {
        console.error(e);
    }
}

async function refreshData(silent = false) {
    const btn = document.getElementById('refresh-btn');

    if (state.refreshing) return;
    state.refreshing = true;

    try {
        // Core Behavior: Show global loader for manual sync
        if (!silent) {
            showLoader("Updating data...");
        }
        
        if (btn) btn.classList.add('pointer-events-none', 'spinning');

        const res = await api.call('getAssistantData');
        state.data = res;
        renderTab();
        
        if (!silent) console.log('Data synced successfully.');
    } catch (e) {
        console.error('Error refreshing data:', e);
    } finally {
        // ALWAYS executed: Stop animation and hide loader
        if (btn) btn.classList.remove('pointer-events-none', 'spinning');
        
        if (!silent) hideLoader();
        state.refreshing = false;
    }
}

function renderTab() {
    if (state.activeTab === 'dashboard') renderDashboard();
    if (state.activeTab === 'fleet') renderFleet();
    if (state.activeTab === 'crew') renderCrew();
    if (state.activeTab === 'docs') renderDocs();
}

function renderDashboard() {
    const { stats, units, crew, docs } = state.data;
    if (!stats) return;

    // Master KPI Logic: Simple Average of secondary KPIs
    // Formula: Global = (Fleet + Crew + Company) / 3
    const globalVal = Math.round((stats.unitsCompliance + stats.crewCompliance + stats.companyCompliance) / 3);

    // Compliance Ring
    const ring = document.getElementById('compliance-ring');
    const valText = document.getElementById('compliance-val');
    const offset = 263.89 * (1 - globalVal / 100);
    valText.innerText = `${globalVal}%`;
    setTimeout(() => ring.style.strokeDashoffset = offset, 100);

    // Stats
    renderStatBlock('stat-flota', 'Flota', stats.unitsCompliance, '#10B981', 'Requisitos de unidad al día', '↑ +4%');
    renderStatBlock('stat-trip', 'Tripulación', stats.crewCompliance, '#F59E0B', 'Licencias y capacitaciones');
    renderStatBlock('stat-empresa', 'Empresa', stats.companyCompliance, '#3B82F6', 'Carga tributaria y legal');

    // Alert
    const alertEl = document.getElementById('expired-alert');
    if (stats.expiredTodayCount > 0) {
        alertEl.classList.remove('hidden');
        alertEl.classList.add('flex');
        document.getElementById('expired-text').innerHTML = `Hay <strong>${stats.expiredTodayCount} documentos vencidos</strong> que requieren atención para evitar paralizaciones.`;
    } else {
        alertEl.classList.add('hidden');
        alertEl.classList.remove('flex');
    }

    // List Summaries
    const fleetContainer = document.getElementById('fleet-summary-list');
    fleetContainer.innerHTML = units.slice(0, 3).map(u => `
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
            <p class="text-sm font-black text-emerald-500">${u.compliance}%</p>
        </div>
    `).join('');

    const crewContainer = document.getElementById('crew-summary-list');
    crewContainer.innerHTML = crew.slice(0, 3).map(c => `
         <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 border border-slate-100">
                    <i data-lucide="user" size="20"></i>
                </div>
                <div>
                    <p class="font-black text-slate-900">${c.nombre}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${c.rol}</p>
                </div>
            </div>
            <span class="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase">REVISAR</span>
        </div>
    `).join('');

    lucide.createIcons();
}

function renderStatBlock(id, label, val, color, sub, trend = '') {
    const el = document.getElementById(id);
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

function renderFleet() {
    const tbody = document.getElementById('fleet-table-body');
    const units = state.data.units;
    let html = units.map((u, i) => `
        <tr class="hover:bg-slate-50/50 transition-all">
            <td class="px-8 py-6 font-black text-slate-900">${u.id}</td>
            <td class="px-8 py-6">
                <div class="space-y-1">
                    <p class="text-xs font-bold text-slate-600">${u.sistema}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${u.tipo}</p>
                </div>
            </td>
            <td class="px-8 py-6">
                <div class="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                    <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    ${u.estado}
                </div>
            </td>
            <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                    <div class="flex-1 w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-emerald-500" style="width: ${u.compliance}%"></div>
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
    `).join('');

    // Add empty row with registration button at the bottom
    html += `
        <tr class="hover:bg-slate-50/50 transition-all group">
            <td class="px-8 py-6" style="width: 224.409px; height: 89.3926px;">
                <button onclick="openUnitModal()" class="btn-primary whitespace-nowrap shadow-sm hover:translate-y-[-2px]" style="width: 170.426px; font-size: 12px; border-style: solid; height: 46.9959px; line-height: 20.5px;">
                    <i data-lucide="plus" style="width: 22.1529px; height: 31px; font-size: 17px;"></i> Registrar Unidad
                </button>
            </td>
            <td class="px-8 py-6"></td>
            <td class="px-8 py-6"></td>
            <td class="px-8 py-6"></td>
            <td class="px-8 py-6"></td>
        </tr>
    `;

    tbody.innerHTML = html;
    lucide.createIcons();
}

function renderCrew() {
    const grid = document.getElementById('crew-grid');
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
                <button class="text-slate-200"><i data-lucide="more-vertical" size="18"></i></button>
            </div>
            <div class="space-y-4">
                <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span>Cumplimiento</span>
                    <span class="text-slate-900">${c.compliance}%</span>
                </div>
                <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-[#E20613]" style="width: ${c.compliance}%"></div>
                </div>
            </div>
             <div class="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    <span class="text-[9px] font-black text-slate-400 tracking-widest uppercase">ACTIVO</span>
                </div>
                <button class="text-[11px] font-bold text-[#E20613] hover:underline">Ver Perfil</button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

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
     const docs = state.filterType === 'all' ? state.data.docs : state.data.docs.filter(d => d.entityType === state.filterType);
     
     grid.innerHTML = docs.map(d => `
        <div class="card-brand flex flex-col group hover:border-red-100">
            <div class="flex justify-between items-start mb-6">
                <div class="p-4 bg-slate-50 rounded-2xl text-slate-300 group-hover:text-[#E20613] transition-all">
                    <i data-lucide="file-text" size="24"></i>
                </div>
                <span class="px-3 py-1 rounded-full border border-orange-100 bg-orange-50 text-orange-600 text-[9px] font-black uppercase tracking-widest">${d.status}</span>
            </div>
            <div class="flex-1 space-y-1.5">
                <h4 class="text-xl font-black text-slate-900 tracking-tight leading-tight">${d.type}</h4>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${d.entityId}</p>
            </div>
            <div class="mt-10 space-y-4">
                 <div class="flex items-center gap-3 text-slate-400">
                    <i data-lucide="clock" size="14"></i>
                    <p class="text-xs font-medium">Vence: <span class="font-bold text-slate-700">${d.expiryDate}</span></p>
                </div>
                <div class="flex gap-2">
                    <button class="flex-1 py-3 border border-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">BAJAR</button>
                    <button onclick="openUpload('${d.entityId}', '${d.type}')" class="flex-1 py-3 bg-[#E20613] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#B90510] shadow-lg shadow-red-100">SUBIR</button>
                </div>
            </div>
        </div>
     `).join('');
     lucide.createIcons();
}

/**
 * MODALS
 */
function openUpload(id, type) {
    document.getElementById('upload-details').innerHTML = `Sincronizando <strong>${type}</strong> para <strong>${id}</strong>`;
    document.getElementById('upload-modal').classList.remove('hidden');
    document.getElementById('upload-modal').classList.add('flex');
}

function closeUpload() {
    document.getElementById('upload-modal').classList.add('hidden');
    document.getElementById('upload-modal').classList.remove('flex');
}

/**
 * DROPDOWN LOGIC
 */
function toggleDropdown(event, id) {
    event.stopPropagation();
    const dropdown = document.getElementById('global-dropdown');
    const isOpen = dropdown.style.display === 'block';
    
    if (isOpen && state.activeDocId === id) {
        closeDropdown();
        return;
    }

    state.activeDocId = id;
    
    // Position dropdown near the button
    const rect = event.currentTarget.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.right - 160 + window.scrollX}px`;
    dropdown.style.display = 'block';
    
    lucide.createIcons();
}

function closeDropdown() {
    const dropdown = document.getElementById('global-dropdown');
    dropdown.style.display = 'none';
    state.activeDocId = null;
}

function handleMenuAction(action) {
    const unitId = state.activeDocId;
    const unit = state.data.units.find(u => u.id === unitId);
    
    closeDropdown();

    if (!unit) return;

    if (action === 'details') {
        viewUnitDetails(unit.id);
    } else if (action === 'edit') {
        openUnitModal(unit.id);
    } else if (action === 'report') {
        alert(`Generando reporte consolidado para ${unit.id}...\n(En producción esto generará un ZIP/PDF con el SDK de Drive)`);
    }
}

function toggleLineaExclusiva(checked) {
    const wrapper = document.getElementById('wrapper-linea-exclusiva');
    if (checked) {
        wrapper.classList.remove('hidden');
    } else {
        wrapper.classList.add('hidden');
        document.getElementById('form-unit-linea').value = '';
    }
}

/**
 * UNIT MODAL LOGIC
 */
function openUnitModal(id = null) {
    const modal = document.getElementById('unit-modal');
    const form = document.getElementById('unit-form');
    const title = document.getElementById('unit-modal-title');
    const modeInput = document.getElementById('unit-form-mode');
    
    form.reset();
    toggleLineaExclusiva(false);
    
    if (id) {
        const unit = state.data.units.find(u => u.id === id);
        title.innerText = 'Actualizar Unidad';
        modeInput.value = 'edit';
        document.getElementById('form-unit-id').value = unit.id;
        document.getElementById('form-unit-id').readOnly = true;
        document.getElementById('form-unit-sistema').value = unit.sistema;
        document.getElementById('form-unit-tipo').value = unit.tipo;
        
        document.getElementById('form-unit-marca').value = unit.marca || '';
        document.getElementById('form-unit-modelo').value = unit.modelo || '';
        document.getElementById('form-unit-capacidad').value = unit.capacidad || '';
        
        const isExclusiva = unit.exclusiva === true || unit.exclusiva === 'true';
        document.getElementById('form-unit-exclusiva').checked = isExclusiva;
        toggleLineaExclusiva(isExclusiva);
        document.getElementById('form-unit-linea').value = unit.linea || '';
    } else {
        title.innerText = 'Registrar Unidad';
        modeInput.value = 'create';
        document.getElementById('form-unit-id').readOnly = false;
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeUnitModal() {
    document.getElementById('unit-modal').classList.add('hidden');
    document.getElementById('unit-modal').classList.remove('flex');
}

async function handleUnitSubmit(e) {
    e.preventDefault();
    const mode = document.getElementById('unit-form-mode').value;
    
    const unitData = {
        id: document.getElementById('form-unit-id').value,
        sistema: document.getElementById('form-unit-sistema').value,
        tipo: document.getElementById('form-unit-tipo').value,
        marca: document.getElementById('form-unit-marca').value,
        modelo: document.getElementById('form-unit-modelo').value,
        capacidad: document.getElementById('form-unit-capacidad').value,
        exclusiva: document.getElementById('form-unit-exclusiva').checked,
        linea: document.getElementById('form-unit-exclusiva').checked ? document.getElementById('form-unit-linea').value : '',
        estado: 'ACTIVO',
        compliance: mode === 'create' ? 0 : state.data.units.find(u => u.id === document.getElementById('form-unit-id').value).compliance
    };

    setLoading(true);
    try {
        const res = await api.call('saveUnit', unitData);
        if (res.success) {
            closeUnitModal();
            reloadData();
        } else {
            alert('Error guardando unidad: ' + res.message);
        }
    } catch (err) {
        alert('Error de conexión.');
    } finally {
        setLoading(false);
    }
}

/**
 * UNIT DETAILS LOGIC
 */
function viewUnitDetails(id) {
    const unit = state.data.units.find(u => u.id === id);
    const docs = state.data.docs.filter(d => d.entityId === id);
    
    document.getElementById('details-modal-title').innerText = `Documentación: ${unit.id}`;
    document.getElementById('details-modal-subtitle').innerText = `${unit.sistema} • ${unit.tipo}`;
    
    const list = document.getElementById('details-docs-list');
    if (docs.length === 0) {
        list.innerHTML = `
            <div class="text-center py-12 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100">
                <i data-lucide="file-warning" class="mx-auto text-slate-300 mb-4" size="48"></i>
                <p class="font-bold text-slate-500">No hay documentos registrados para esta unidad.</p>
            </div>
        `;
    } else {
        list.innerHTML = docs.map(d => {
            const isExpired = d.status === 'VENCIDO' || d.status === 'OBSERVADO';
            const statusColor = d.status === 'APROBADO' ? 'text-emerald-500' : (isExpired ? 'text-red-500' : 'text-amber-500');
            const statusBg = d.status === 'APROBADO' ? 'bg-emerald-50' : (isExpired ? 'bg-red-50' : 'bg-amber-50');
            
            return `
                <div class="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-[32px] hover:shadow-lg transition-all group">
                    <div class="flex items-center gap-6">
                        <div class="w-14 h-14 ${statusBg} rounded-2xl flex items-center justify-center ${statusColor} transition-colors">
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
                        <button onclick="window.open('${d.fileUrl}', '_blank')" class="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-[#E20613] hover:bg-red-50 transition-all">
                            <i data-lucide="download" size="18"></i>
                        </button>
                        <button onclick="openUpload('${d.entityId}', '${d.type}')" class="p-3 bg-[#E20613] text-white rounded-xl hover:bg-[#B90510] transition-all">
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

// Global click listener to dismiss dropdown
window.addEventListener('click', (e) => {
    if (!e.target.closest('#global-dropdown')) {
        closeDropdown();
    }
});

// Sticky Header Shadow on Scroll
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

/**
 * HELPERS & GLOBAL LOADER
 */
function showLoader(message = 'Procesando...') {
    const loader = document.getElementById('app-loader');
    const msgEl = document.getElementById('app-loader-message');
    
    if (loader && msgEl) {
        msgEl.innerText = message;
        loader.classList.remove('hidden');
        loader.classList.add('flex');
        
        // Trigger opacity for fade in
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
        
        // Wait for transition
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

function getMockResponse(func) {
    const mockData = {
        units: [
            { id: 'F3D-816', sistema: 'ISOTERMICO', tipo: 'CAMION', estado: 'ACTIVO', compliance: 85 },
            { id: 'ADR-853', sistema: 'CLIMATIZADA', tipo: 'PORTER', estado: 'ACTIVO', compliance: 65 },
            { id: 'F3L-844', sistema: 'BASICA', tipo: 'NO_REGISTRA', estado: 'ACTIVO', compliance: 45 },
        ],
        crew: [
            { id: '123', nombre: 'JUAN', apellidos: 'QUISPE', rol: 'CHOFER', compliance: 88, estado: 'ACTIVO' },
            { id: '456', nombre: 'MARCO', apellidos: 'RAMOS', rol: 'AUXILIAR', compliance: 42, estado: 'ACTIVO' },
        ],
        docs: [
            { id: 'd1', entityId: 'F3D-816', entityType: 'unidad', type: 'SOAT', status: 'PENDIENTE', expiryDate: '2026-06-15' },
            { id: 'd2', entityId: '123', entityType: 'tripulacion', type: 'SCTR', status: 'OBSERVADO', expiryDate: '2026-03-30' },
        ],
        stats: {
            unitsCompliance: 82,
            crewCompliance: 68,
            companyCompliance: 92,
            // globalCompliance will be calculated as Math.round((82 + 68 + 92) / 3) = 81
            globalCompliance: 81, 
            expiredTodayCount: 3
        }
    };
    if (func === 'loginUser') return { success: true, user: { dni: '1', nombres: 'ADMIN', apellidos: 'DEMO', empresa: 'MUNDO LOGISTICO S.A.C.' } };
    if (func === 'getAssistantData') return mockData;
    return { success: true };
}
