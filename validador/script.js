/**
 * Frontend Logic (script.js)
 * Manages state, events, and dynamic rendering.
 */

// --- GLOBAL STATE ---
const State = {
  activeTab: 'dashboard',
  selectedCompanyId: null,
  companies: [],
  documents: [],
  isRefreshing: false,
  activeDoc: null
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initEventListeners();
  loadData();
});

// --- API FETCH ---
async function loadData() {
  try {
    // Simulating Fetch to code.gs
    // In actual GAS environment, this would be:
    // const response = await fetch(scriptUrl, { method: 'POST', body: JSON.stringify({ action: 'getInitialData' }) });
    // const result = await response.json();
    
    // For this migration, we'll call a local copy or simulate the delay
    setTimeout(() => {
      // Mock result as if from backend
      const mockResult = {
        companies: [
          { id: 'c1', name: 'MUNDO LOGÍSTICO S.A.C.', ruc: '20601234567', compliance: 40, stats: { totalUnits: 50, monitoredUnits: 40, fitUnits: 20, totalDrivers: 60, monitoredDrivers: 50, fitDrivers: 30, criticalDocs: 3 }, pillars: { unit: 72, crew: 68, company: 88 } },
          { id: 'c2', name: 'INDUAMERICA SERVICIOS', ruc: '20459876543', compliance: 30, stats: { totalUnits: 40, monitoredUnits: 30, fitUnits: 12, totalDrivers: 45, monitoredDrivers: 35, fitDrivers: 15, criticalDocs: 6 }, pillars: { unit: 50, crew: 52, company: 70 } },
          { id: 'c3', name: 'TRANSPORTES CHAMORRO', ruc: '20123456789', compliance: 85, stats: { totalUnits: 20, monitoredUnits: 20, fitUnits: 17, totalDrivers: 25, monitoredDrivers: 25, fitDrivers: 22, criticalDocs: 0 }, pillars: { unit: 93, crew: 89, company: 95 } },
          { id: 'c4', name: 'CORPORACIÓN ANDI', ruc: '20556677889', compliance: 45, stats: { totalUnits: 35, monitoredUnits: 25, fitUnits: 16, totalDrivers: 40, monitoredDrivers: 30, fitDrivers: 18, criticalDocs: 5 }, pillars: { unit: 58, crew: 60, company: 75 } }
        ],
        documents: [
          { id: 'd1', type: 'SOAT', status: 'PENDING', entityId: 'F3D-816', entityType: 'unit', companyId: 'c1', companyName: 'MUNDO LOGÍSTICO S.A.C.', uploadDate: '2026-04-18', expiryDate: '2027-04-18', logs: [] },
          { id: 'd2', type: 'SCTR', status: 'OBSERVED', entityId: 'CIRILO AGUILAR', entityType: 'driver', companyId: 'c2', companyName: 'INDUAMERICA SERVICIOS', uploadDate: '2026-04-17', logs: [{ user: 'Admin System', date: '2026-04-17', comment: 'Documento poco legible, por favor resubir.', status: 'OBSERVED' }] },
          { id: 'd3', type: 'LICENCIA DE CONDUCIR', status: 'PENDING', entityId: 'JUAN QUISPE', entityType: 'driver', companyId: 'c1', companyName: 'MUNDO LOGÍSTICO S.A.C.', uploadDate: '2026-04-18', expiryDate: '2026-12-15', logs: [] },
          { id: 'd4', type: 'REVISIÓN TÉCNICA', status: 'PENDING', entityId: 'ADR-853', entityType: 'unit', companyId: 'c4', companyName: 'CORPORACIÓN ANDI', uploadDate: '2026-04-18', logs: [] },
          { id: 'd5', type: 'POLÍTICA DE CALIDAD', status: 'PENDING', entityId: 'EMPRESA', entityType: 'company', companyId: 'c1', companyName: 'MUNDO LOGÍSTICO S.A.C.', uploadDate: '2026-04-18', logs: [] }
        ]
      };
      
      State.companies = mockResult.companies;
      State.documents = mockResult.documents;
      renderAll();
    }, 500);
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

// --- EVENT LISTENERS ---
function initEventListeners() {
  // Login
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('login-container').classList.add('opacity-0');
    setTimeout(() => {
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('app-container').style.display = 'flex';
      renderAll();
    }, 400);
  });

  // Sidebar Tabs
  document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tab = btn.dataset.tab;
    State.activeTab = tab;
    State.selectedCompanyId = null;
    renderAll();
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    location.reload();
  });

  // Refresh
  document.getElementById('refresh-btn').addEventListener('click', () => {
    if (State.isRefreshing) return;
    State.isRefreshing = true;
    const icon = document.querySelector('#refresh-btn i');
    icon.classList.add('spinning');
    setTimeout(() => {
      icon.classList.remove('spinning');
      State.isRefreshing = false;
      loadData();
    }, 1200);
  });

  // Back Button
  document.getElementById('back-btn').addEventListener('click', () => {
    State.selectedCompanyId = null;
    renderAll();
  });
}

// --- RENDERING CORE ---
function renderAll() {
  updateUIStrings();
  renderSidebar();
  renderActiveView();
  lucide.createIcons();
}

function updateUIStrings() {
  const titleEl = document.getElementById('view-title');
  const subtitleEl = document.getElementById('view-subtitle');
  const backBtn = document.getElementById('back-btn');

  if (State.selectedCompanyId) {
    const company = State.companies.find(c => c.id === State.selectedCompanyId);
    titleEl.textContent = `Detalle: ${company.name}`;
    subtitleEl.textContent = 'Monitoreo de cumplimiento por unidad y tripulante.';
    backBtn.classList.remove('hidden');
  } else {
    backBtn.classList.add('hidden');
    switch (State.activeTab) {
      case 'dashboard':
        titleEl.textContent = 'Resumen Central';
        subtitleEl.textContent = 'Gestiona la validación y el cumplimiento de la red.';
        break;
      case 'validation':
        titleEl.textContent = 'Bandeja de Entrada';
        subtitleEl.textContent = 'Gestiona la validación y el cumplimiento de la red.';
        break;
      case 'companies':
        titleEl.textContent = 'Proveedores';
        subtitleEl.textContent = 'Consolidado de empresas de transporte.';
        break;
      case 'reports':
        titleEl.textContent = 'Centro de Reportes';
        subtitleEl.textContent = 'Gestiona la validación y el cumplimiento de la red.';
        break;
    }
  }
}

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const pendingCount = State.documents.filter(d => d.status === 'PENDING' || d.status === 'OBSERVED').length;
  
  const tabs = [
    { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    { id: 'validation', icon: 'check-circle-2', label: 'Validación', badge: pendingCount },
    { id: 'companies', icon: 'building-2', label: 'Empresas' },
    { id: 'reports', icon: 'bar-chart-3', label: 'Reportes' }
  ];

  nav.innerHTML = tabs.map(tab => `
    <button data-tab="${tab.id}" class="w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all text-sm relative ${
      State.activeTab === tab.id && !State.selectedCompanyId
        ? 'text-white bg-[#E30613] shadow-xl shadow-red-100' 
        : 'text-slate-500 hover:bg-slate-50'
    }">
      <i data-lucide="${tab.icon}" style="width: 20px; height: 20px;"></i>
      ${tab.label}
      ${tab.badge > 0 ? `<span class="absolute right-6 px-2 py-0.5 rounded-lg text-[10px] font-black ${State.activeTab === tab.id ? 'bg-white text-[#E30613]' : 'bg-red-600 text-white'}">${tab.badge}</span>` : ''}
    </button>
  `).join('');
}

function renderActiveView() {
  // Hide all views
  document.querySelectorAll('.view-content').forEach(el => el.classList.remove('active'));
  
  if (State.selectedCompanyId) {
    document.getElementById('view-company-detail').classList.add('active');
    renderCompanyDetail();
  } else {
    const viewId = `view-${State.activeTab}`;
    document.getElementById(viewId).classList.add('active');
    
    switch (State.activeTab) {
      case 'dashboard': renderDashboard(); break;
      case 'validation': renderValidation(); break;
      case 'companies': renderCompanies(); break;
      case 'reports': renderReports(); break;
    }
  }
}

// --- VIEW RENDERS ---

function renderDashboard() {
  const stats = calculateStats();
  const container = document.getElementById('view-dashboard');
  
  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
      ${renderMetricCard("ALCANCE GLOBAL", stats.avgCompanyCompliance, "Promedio general de las empresas", "#3B82F6", stats.monitoredUnits, "Monitored", stats.universeUnits, "Universe", stats.globalCoverage, "Controlado")}
      ${renderMetricCard("PROMEDIO FLOTA", stats.globalCompliance, "Promedio general de flotas", "#E30613", stats.fitUnits, "Aptas", stats.universeUnits, "Total Universe", stats.monitoredCompliance, "Compliance", "#00B074")}
      ${renderMetricCard("PROMEDIO TRIPULACIÓN", stats.globalDriverCompliance, "Promedio general de tripulación", "#FFB300", stats.fitDrivers, "Aptos", stats.universeDrivers, "Total Universe", stats.globalDriverCompliance, "Aptitud", "#00B074")}
    </div>

    <!-- PROGRESS BAR -->
    <div class="card-brand p-8 bg-white border border-slate-50 flex items-center gap-10">
      <div class="min-w-[200px]">
         <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Documentación Procesada</p>
         <h4 class="text-2xl font-black text-slate-900">${stats.validationProgress}%</h4>
      </div>
      <div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
        <div class="h-full bg-slate-900 rounded-full transition-all duration-1000" style="width: ${stats.validationProgress}%"></div>
      </div>
      <div class="flex items-center gap-6 text-slate-400 font-mono text-[10px] font-bold uppercase tracking-widest">
         <span>TOTAL: ${stats.totalDocs}</span>
         <span>AUDITADOS: ${stats.completedDocs}</span>
      </div>
    </div>

    <!-- CHART CONTAINER -->
    <div class="card-brand p-12">
      <div class="flex justify-between items-center mb-10">
        <h3 class="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Progreso de Alcance Global</h3>
        <div class="flex gap-6 items-center">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[#3B82F6]"></div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PROGRESO REAL</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-[#FFB300]"></div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">META 90%</span>
          </div>
        </div>
      </div>
      <div class="h-[400px] w-full relative">
        <canvas id="dashboard-chart"></canvas>
      </div>
    </div>
  `;

  initDashboardChart(stats);
}

function renderMetricCard(label, value, sub, color, mini1, mini1Label, mini2, mini2Label, ringPct, ringLabel, mini1Color) {
  const dashoffset = 263.89 * (1 - ringPct / 100);
  return `
    <div class="card-brand p-8 bg-white flex items-center justify-between gap-6 h-full">
      <div class="flex-1 space-y-4">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">${label}</p>
        <h2 class="text-5xl font-black tracking-tighter leading-none" style="color: ${color}">${value}%</h2>
        <p class="text-[11px] font-bold text-slate-500 italic leading-tight">${sub}</p>
        <div class="flex gap-2 mt-4">
          <div class="flex-1 px-2 py-3 bg-white border border-slate-100 rounded-xl shadow-sm text-center">
            <p class="text-sm font-black text-slate-900 leading-none mb-1">${mini1}</p>
            <p class="text-[8px] font-black uppercase tracking-widest italic" style="color: ${mini1Color || '#3B82F6'}">${mini1Label}</p>
          </div>
          <div class="flex-1 px-2 py-3 bg-white border border-slate-100 rounded-xl shadow-sm text-center">
            <p class="text-sm font-black text-slate-900 leading-none mb-1">${mini2}</p>
            <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">${mini2Label}</p>
          </div>
        </div>
      </div>
      <div class="relative w-32 h-32 flex-shrink-0">
        <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="transparent" stroke="#F8FAFC" strokeWidth="10"></circle>
          <circle cx="50" cy="50" r="42" fill="transparent" stroke="${color}" strokeWidth="10" strokeDasharray="263.89" strokeDashoffset="${dashoffset}" strokeLinecap="round"></circle>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span class="text-xl font-black text-slate-900 tracking-tighter leading-none">${ringPct}%</span>
          <span class="text-[7px] font-black text-slate-400 uppercase tracking-[0.15em] mt-0.5 font-mono leading-none">${ringLabel}</span>
        </div>
      </div>
    </div>
  `;
}

function renderValidation() {
  const container = document.getElementById('view-validation');
  const docs = State.documents.filter(d => d.status === 'PENDING' || d.status === 'OBSERVED');
  
  container.innerHTML = `
    <div class="card-brand overflow-hidden">
      <div class="p-8 border-b border-slate-50 flex flex-wrap gap-4 items-center bg-white">
        <div class="relative flex-1 min-w-[300px]">
          <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" style="width: 18px; height: 18px;"></i>
          <input id="docs-search" type="text" placeholder="Buscar por placa, DNI o proveedor..." class="w-full pl-12 pr-4 py-3 bg-[#F8FAFC] border-none rounded-2xl outline-none focus:ring-4 focus:ring-red-50 font-medium text-sm">
        </div>
        <button class="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-slate-900 transition-all">
          <i data-lucide="filter" style="width: 18px; height: 18px;"></i>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-[#F8FAFC] border-b border-slate-100">
            <tr>
              <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documento</th>
              <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proveedor</th>
              <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha Carga</th>
              <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
              <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            ${docs.map(doc => `
              <tr class="hover:bg-slate-50 transition-colors group">
                <td class="px-8 py-6">
                  <p class="font-black text-slate-900 text-sm uppercase tracking-tighter">${doc.type}</p>
                  <p class="text-xs text-slate-400 font-mono italic mt-0.5">${doc.entityId}</p>
                </td>
                <td class="px-8 py-6">
                  <p class="font-bold text-slate-600 text-sm italic line-clamp-1">${doc.companyName}</p>
                </td>
                <td class="px-8 py-6">
                  <p class="text-sm font-medium text-slate-500">${doc.uploadDate}</p>
                </td>
                <td class="px-8 py-6">
                  <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(doc.status)}">
                    ${doc.status}
                  </span>
                </td>
                <td class="px-8 py-6 text-center">
                  <button onclick="openValidationModal('${doc.id}')" class="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-[#E30613] hover:border-red-100 hover:shadow-lg transition-all group-hover:scale-110">
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

function renderCompanies() {
  const container = document.getElementById('view-companies');
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-8">
      ${State.companies.map(c => `
        <div onclick="State.selectedCompanyId = '${c.id}'; renderAll();" class="card-brand p-10 cursor-pointer group flex flex-col justify-between h-full hover:bg-slate-50">
          <div class="flex justify-between items-start mb-10">
            <div class="space-y-4">
               <div>
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">RUC: ${c.ruc}</p>
                  <h3 class="text-2xl font-black text-slate-900 tracking-tighter leading-none line-clamp-1">${c.name}</h3>
               </div>
            </div>
            <div class="text-right">
              <p class="text-4xl font-black text-[#E30613] tracking-tighter">${c.compliance}%</p>
              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cumplimiento</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4 mb-8">
             <div class="text-center">
                <p class="text-lg font-black text-slate-700">${c.stats.monitoredDrivers}</p>
                <p class="text-[8px] font-black uppercase text-slate-400 italic">Tripulación</p>
             </div>
             <div class="text-center">
                <p class="text-lg font-black text-slate-700">${c.stats.monitoredUnits}</p>
                <p class="text-[8px] font-black uppercase text-slate-400 italic">Flota</p>
             </div>
             <div class="text-center">
                <p class="text-lg font-black text-red-600">${c.stats.criticalDocs}</p>
                <p class="text-[8px] font-black uppercase text-red-400 italic">Críticos</p>
             </div>
          </div>

          <div class="flex items-center justify-between pt-6 border-t border-slate-100">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-600">Ver Monitoreo</span>
            <i data-lucide="chevron-right" class="text-slate-300 group-hover:text-[#E30613]" style="width: 18px; height: 18px;"></i>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCompanyDetail() {
  const company = State.companies.find(c => c.id === State.selectedCompanyId);
  const container = document.getElementById('view-company-detail');
  
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
       <div class="card-brand p-10 bg-slate-50/50 flex flex-col items-center justify-center text-center">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Pilar: Unidad</p>
          <div class="relative w-32 h-32 mb-6">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="#F1F5F9" strokeWidth="12"></circle>
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="#E30613" strokeWidth="12" strokeDasharray="263.89" strokeDashoffset="${263.89 * (1 - company.pillars.unit / 100)}" strokeLinecap="round"></circle>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center text-xl font-black">${company.pillars.unit}%</div>
          </div>
          <p class="text-xs font-bold text-slate-500 italic">Nivel de cumplimiento vehicular</p>
       </div>
       <div class="card-brand p-10 flex flex-col items-center justify-center text-center">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Pilar: Tripulación</p>
          <div class="relative w-32 h-32 mb-6">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="#F1F5F9" strokeWidth="12"></circle>
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="#FFB300" strokeWidth="12" strokeDasharray="263.89" strokeDashoffset="${263.89 * (1 - company.pillars.crew / 100)}" strokeLinecap="round"></circle>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center text-xl font-black">${company.pillars.crew}%</div>
          </div>
          <p class="text-xs font-bold text-slate-500 italic">Nivel de cumplimiento humano</p>
       </div>
       <div class="card-brand p-10 flex flex-col items-center justify-center text-center">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Pilar: Gestión</p>
          <div class="relative w-32 h-32 mb-6">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="#F1F5F9" strokeWidth="12"></circle>
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="#00B074" strokeWidth="12" strokeDasharray="263.89" strokeDashoffset="${263.89 * (1 - company.pillars.company / 100)}" strokeLinecap="round"></circle>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center text-xl font-black">${company.pillars.company}%</div>
          </div>
          <p class="text-xs font-bold text-slate-500 italic">Documentación administrativa</p>
       </div>
    </div>

    <div class="card-brand overflow-hidden mt-12 bg-white">
       <div class="p-10 border-b border-slate-50 bg-slate-50/20">
          <div class="flex justify-between items-center">
            <h4 class="text-2xl font-black text-slate-900 tracking-tight italic uppercase">Unidades y Tripulación</h4>
            <div class="flex gap-4">
              <div class="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                 <i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i> Cumplen: ${company.stats.fitUnits} / ${company.stats.fitDrivers}
              </div>
              <div class="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 flex items-center gap-2">
                 <i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i> Riesgo: ${company.stats.criticalDocs}
              </div>
            </div>
          </div>
       </div>
       <div class="p-10 flex items-center justify-center text-slate-300 min-h-[300px]">
          <div class="text-center">
             <i data-lucide="truck" class="mx-auto mb-4" style="width: 64px; height: 64px; opacity: 0.2;"></i>
             <p class="font-bold text-slate-400 italic">Vista de detalle por placas y conductores en desarrollo...</p>
          </div>
       </div>
    </div>
  `;
}

function renderReports() {
  const container = document.getElementById('view-reports');
  const stats = calculateStats();
  
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
      ${renderSmallStat("UNIDADES CRÍTICAS", stats.criticalCount, "No cumplen BPDT", "#E30613")}
      ${renderSmallStat("TRIPULACIÓN APTA", stats.fitDrivers, `${Math.round((stats.fitDrivers/stats.universeDrivers)*100)} % del universo`, "#FFB300")}
      ${renderSmallStat("META GLOBAL", "95 %", "Objetivo Q2 2026", "#00B074")}
      ${renderSmallStat("RED PROVEEDORES", stats.totalCompanies, "Evaluación constante", "#3B82F6")}
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
       <div class="card-brand p-12 bg-slate-900 text-white">
          <h3 class="text-2xl font-black uppercase italic tracking-tighter text-[#FFB300] mb-10">BPDT Compliance Summary</h3>
          <div class="space-y-8">
             ${renderPillarBar("Capacidad Vehicular (Universe)", stats.globalCompliance, "#E30613")}
             ${renderPillarBar("Capacidad Humana (Crew fit)", stats.globalDriverCompliance, "#FFB300")}
             ${renderPillarBar("Eficiencia Operativa", 85, "#00B074")}
             ${renderPillarBar("Alcance de Monitoreo", stats.globalCoverage, "#3B82F6")}
          </div>
       </div>
       <div class="card-brand p-12 bg-white flex flex-col items-center justify-center text-center">
          <i data-lucide="arrow-left" class="text-slate-200 mb-6" style="width: 80px; height: 80px;"></i>
          <h4 class="text-3xl font-black text-slate-900 uppercase italic mb-4 tracking-tighter">Más Reportes pronto</h4>
          <p class="text-slate-500 font-medium max-w-sm">Estamos procesando los cubos de datos para generar reportes dinámicos por operación y zona geográfica.</p>
       </div>
    </div>
  `;
}

function renderSmallStat(label, value, sub, color) {
  return `
    <div class="card-brand p-8 text-center flex flex-col items-center justify-center">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">${label}</p>
      <h3 class="text-4xl font-black" style="color: ${color}">${value}</h3>
      <p class="text-[11px] font-bold text-slate-500 mt-1 italic">${sub}</p>
    </div>
  `;
}

function renderPillarBar(label, value, color) {
  return `
    <div class="space-y-2">
      <div class="flex justify-between items-end">
        <span class="text-xs font-black uppercase text-white/50 tracking-widest italic">${label}</span>
        <span class="text-xl font-black" style="color: ${color}">${value}%</span>
      </div>
      <div class="h-3 bg-white/10 rounded-full overflow-hidden">
        <div class="h-full" style="width: ${value}%; background-color: ${color}"></div>
      </div>
    </div>
  `;
}

// --- MODAL LOGIC ---
function openValidationModal(docId) {
  const doc = State.documents.find(d => d.id === docId);
  State.activeDoc = doc;
  
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="w-full max-w-3xl bg-white rounded-[40px] shadow-2xl p-10 relative max-h-[90vh] flex flex-col">
      <button onclick="closeModal()" class="absolute top-8 right-8 text-slate-300 hover:text-slate-900 z-10 p-2">
         <i data-lucide="more-vertical" style="width: 24px; height: 24px;"></i>
      </button>

      <div class="mb-8">
        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(doc.status)}">
          ${doc.status}
        </span>
        <h3 class="text-3xl font-black text-slate-900 tracking-tight italic mt-3 truncate">
          ${doc.type}: ${doc.entityId}
        </h3>
        <p class="text-slate-500 font-medium">Proveedor: ${doc.companyName}</p>
      </div>

      <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden">
        <div class="space-y-6">
           <div class="p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center h-full text-center">
              <div class="p-5 bg-white rounded-3xl text-[#E30613] shadow-sm mb-4">
                <i data-lucide="file-text" style="width: 48px; height: 48px;"></i>
              </div>
              <p class="font-bold text-slate-600">Previsualización de Documento</p>
              <button class="mt-4 text-xs font-black uppercase tracking-widest text-[#E30613] hover:underline">Ver pantalla completa</button>
           </div>
        </div>

        <div class="flex flex-col gap-6">
           <div class="space-y-4">
              <label class="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1 italic">Observaciones del Validador</label>
              <textarea id="val-comment" placeholder="Escribe aquí los motivos de rechazo u observación..." class="w-full h-32 p-6 bg-[#F8FAFC] border-none rounded-[32px] outline-none focus:ring-4 focus:ring-red-50 font-medium resize-none text-sm"></textarea>
           </div>

           <div class="mt-auto space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <button onclick="handleValidate('OBSERVED')" class="py-4 border-2 border-orange-100 text-orange-600 rounded-2xl font-bold hover:bg-orange-50 transition-all text-xs uppercase tracking-widest">Observar</button>
                <button onclick="handleValidate('REJECTED')" class="py-4 border-2 border-red-100 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition-all text-xs uppercase tracking-widest">Rechazar</button>
              </div>
              <button onclick="handleValidate('APPROVED')" class="w-full py-5 bg-[#E30613] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#C10510] shadow-xl shadow-red-100 flex items-center justify-center gap-2">
                <i data-lucide="check-circle-2" style="width: 18px; height: 18px;"></i> Aprobar Documento
              </button>
           </div>
        </div>
      </div>
    </div>
  `;
  
  container.classList.remove('hidden');
  container.classList.add('flex');
  lucide.createIcons();
}

function closeModal() {
  const container = document.getElementById('modal-container');
  container.classList.remove('flex');
  container.classList.add('hidden');
  State.activeDoc = null;
}

function handleValidate(status) {
  const comment = document.getElementById('val-comment').value;
  if ((status === 'OBSERVED' || status === 'REJECTED') && !comment) {
    alert('Debe ingresar un comentario para este estado.');
    return;
  }
  
  const doc = State.activeDoc;
  doc.status = status;
  doc.logs.push({ user: 'Validador Central', date: new Date().toISOString().split('T')[0], comment, status });
  
  closeModal();
  renderAll();
}

// --- CALCULATION HELPERS ---
function calculateStats() {
  const totalCompanies = State.companies.length;
  const compliantCount = State.companies.filter(c => c.compliance >= 90).length;
  const criticalCount = State.companies.filter(c => c.stats.criticalDocs > 0).length;
  
  const universeUnits = State.companies.reduce((sum, c) => sum + c.stats.totalUnits, 0);
  const monitoredUnits = State.companies.reduce((sum, c) => sum + c.stats.monitoredUnits, 0);
  const fitUnits = State.companies.reduce((sum, c) => sum + c.stats.fitUnits, 0);

  const universeDrivers = State.companies.reduce((sum, c) => sum + c.stats.totalDrivers, 0);
  const fitDrivers = State.companies.reduce((sum, c) => sum + c.stats.fitDrivers, 0);

  const globalCoverage = Math.round((monitoredUnits / universeUnits) * 100);
  const globalCompliance = Math.round((fitUnits / universeUnits) * 100);
  const monitoredCompliance = Math.round((fitUnits / monitoredUnits) * 100);
  const globalDriverCompliance = Math.round((fitDrivers / universeDrivers) * 100);
  const avgCompanyCompliance = Math.round(State.companies.reduce((acc, curr) => acc + curr.compliance, 0) / totalCompanies);

  const totalDocs = State.documents.length;
  const completedDocs = State.documents.filter(d => d.status === 'APPROVED' || d.status === 'REJECTED').length;
  const validationProgress = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

  return { 
    totalCompanies, compliantCount, criticalCount, 
    globalCompliance, globalCoverage, monitoredCompliance, globalDriverCompliance,
    universeUnits, monitoredUnits, fitUnits, universeDrivers, fitDrivers,
    avgCompanyCompliance, validationProgress, totalDocs, completedDocs, criticalCount
  };
}

function getStatusStyles(status) {
  switch (status) {
    case 'APPROVED': return 'bg-emerald-50 text-[#00B074] border-emerald-100';
    case 'REJECTED': return 'bg-red-50 text-[#E30613] border-red-100';
    case 'OBSERVED': return 'bg-orange-50 text-[#FFB300] border-orange-100';
    case 'PENDING': return 'bg-slate-50 text-slate-500 border-slate-200';
    default: return 'bg-slate-50 text-slate-400 border-slate-100';
  }
}

// --- CHART INIT ---
let dashboardChart = null;
function initDashboardChart(stats) {
  const ctx = document.getElementById('dashboard-chart');
  if (!ctx) return;
  
  if (dashboardChart) dashboardChart.destroy();
  
  dashboardChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
      datasets: [
        {
          label: 'Alcance Global',
          data: [45, 58, 65, stats.avgCompanyCompliance],
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 4,
          pointRadius: 6,
          pointBackgroundColor: '#3B82F6',
          pointBorderWidth: 4,
          pointBorderColor: '#fff'
        },
        {
          label: 'Meta de Cumplimiento',
          data: [90, 90, 90, 90],
          borderColor: '#FFB300',
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          titleColor: '#1e293b',
          bodyColor: '#64748b',
          borderColor: '#f1f5f9',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%` }
        }
      },
      scales: {
        y: { 
          min: 0, max: 100, 
          grid: { borderColor: 'transparent', color: '#f1f5f9' },
          ticks: { font: { weight: 'bold', size: 10 }, color: '#64748b' }
        },
        x: { 
          grid: { display: false },
          ticks: { font: { weight: 'bold', size: 10 }, color: '#64748b' }
        }
      }
    }
  });
}
