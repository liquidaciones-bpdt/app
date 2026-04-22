/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * HT-BPDT Crew Portal - Professional Vanilla Controller
 */

// --- STATE MANAGEMENT ---
const state = {
  view: 'login',
  isLoading: false,
  user: null,
  dniStatus: null,
  regStep: 1,
  form: {
    dni: '',
    pass: '',
    nombres: '',
    apellidos: '',
    cargo: '',
    empresa: ''
  }
};

// --- DOM CACHE ---
const UI = {
  loader: () => document.getElementById('global-loader'),
  views: {
    login: () => document.getElementById('view-login'),
    dniCheck: () => document.getElementById('view-dni-check'),
    register: () => document.getElementById('view-register'),
    dashboard: () => document.getElementById('view-dashboard')
  }
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  setupEventListeners();
  // Start at logical initial view
  switchView('login');
});

// --- CORE UTILITIES ---

/**
 * Centralized API Helper
 * Handles fetch, JSON parsing, and basic GAS POST requirements
 */
async function apiCall(action, params = {}) {
  if (!window.CONFIG.BACKEND_URL || window.CONFIG.BACKEND_URL === "MY_APPS_SCRIPT_WEB_APP_URL") {
    console.error("DEBUG: Backend URL not configured in config.js");
    return { ok: false, message: "Error de configuración de servidor." };
  }

  setLoading(true);
  try {
    // We use common POST approach for GAS Web Apps
    // Note: Due to CORS, we send as text/plain or use specific GAS handling
    const response = await fetch(window.CONFIG.BACKEND_URL, {
      method: "POST",
      mode: "no-cors", // Standard for simple GAS calls, or use server-side CORS headers
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...params })
    });

    // Handle the "no-cors" limitation: We won't see the body.
    // RECOMMENDATION: For real data, deploy GAS with specific JSONP or explicit CORS headers.
    // For this implementation, we assume a standard fetch-compatible GAS setup.
    
    // If your GAS supports JSON response (CORS enabled):
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    return { ok: false, message: "Error de red o servidor no disponible." };
  } finally {
    setLoading(false);
  }
}

/**
 * View Switcher
 */
function switchView(viewName) {
  Object.keys(UI.views).forEach(v => {
    const el = UI.views[v]();
    if (el) el.classList.add('hidden');
  });

  const target = UI.views[viewName]();
  if (target) {
    target.classList.remove('hidden');
    state.view = viewName;
    lucide.createIcons();
  }
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  const loader = UI.loader();
  if (loader) {
    loader.classList.toggle('hidden', !isLoading);
  }
  // Disable all buttons during loading to prevent double-clicks
  document.querySelectorAll('button').forEach(btn => btn.disabled = isLoading);
}

// --- LOGIC HANDLERS ---

async function handleLogin() {
  const dni = document.getElementById('login-dni').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  if (!dni || dni.length < CONFIG.DNI_LENGTH) {
    alert("DNI inválido.");
    return;
  }
  if (!pass) {
    alert("Ingresa tu clave.");
    return;
  }

  const res = await apiCall('login', { dni, pass });
  if (res.ok) {
    state.user = res.data;
    renderDashboard();
    switchView('dashboard');
  } else {
    alert(res.message || "Error al iniciar sesión.");
  }
}

async function handleCheckDni() {
  const dni = document.getElementById('check-dni-input').value.trim();
  if (!dni || dni.length < CONFIG.DNI_LENGTH) {
    alert("DNI inválido.");
    return;
  }

  const res = await apiCall('checkDni', { dni });
  const alertExists = document.getElementById('alert-exists');
  alertExists.classList.add('hidden');

  if (res.ok) {
    state.dniStatus = res.data.status; // EXISTS, PRELOAD, NEW
    
    if (res.data.status === 'EXISTS') {
      alertExists.classList.remove('hidden');
    } else {
      setupRegisterWizard(res.data);
      switchView('register');
    }
  } else {
    alert(res.message || "Error al validar DNI.");
  }
}

function setupRegisterWizard(data) {
  const isPreload = data.status === 'PRELOAD';
  state.form.dni = data.dni || '';
  
  // Set labels/UI
  document.getElementById('reg-type-label').innerText = isPreload ? 'Complementar Perfil' : 'Nuevo Ingreso';
  
  const fields = ['nombres', 'apellidos', 'cargo', 'empresa'];
  fields.forEach(f => {
    const el = document.getElementById(`reg-${f}`);
    el.value = data[f] || '';
    el.readOnly = isPreload;
    el.classList.toggle('bg-slate-50', isPreload);
    el.classList.toggle('text-slate-500', isPreload);
  });

  document.getElementById('badge-nombres').classList.toggle('hidden', !isPreload);
  document.getElementById('badge-apellidos').classList.toggle('hidden', !isPreload);
  document.getElementById('reg-pass-container').classList.toggle('hidden', isPreload);
  
  goToStep(1);
}

function goToStep(step) {
  state.regStep = step;
  // Bars
  [1, 2, 3].forEach(s => {
    document.getElementById(`step-${s}-bar`).classList.toggle('bg-red-600', step >= s);
    document.getElementById(`step-${s}-bar`).classList.toggle('bg-slate-200', step < s);
    document.getElementById(`reg-step-${s}`).classList.toggle('hidden', step !== s);
  });
  lucide.createIcons();
}

async function handleRegister() {
  const payload = {
    dni: state.form.dni,
    nombres: document.getElementById('reg-nombres').value.trim(),
    apellidos: document.getElementById('reg-apellidos').value.trim(),
    cargo: document.getElementById('reg-cargo').value.trim(),
    empresa: document.getElementById('reg-empresa').value.trim(),
    pass: document.getElementById('reg-pass')?.value.trim() || ""
  };

  if (!payload.nombres || !payload.apellidos) {
    alert("Completa tus datos personales.");
    return;
  }

  const res = await apiCall('registerUser', payload);
  if (res.ok) {
    goToStep(3);
  } else {
    alert(res.message || "Error en el registro.");
  }
}

function renderDashboard() {
  const u = state.user;
  if (!u) return;
  
  document.getElementById('dash-user-name').innerHTML = `${u.nombres || ''} <br/> ${u.apellidos || ''}`;
  document.getElementById('dash-user-cargo').innerText = u.cargo || 'TRIPULANTE';
  document.getElementById('dash-user-empresa').innerText = u.empresa || 'HT-BPDT';
  
  const compliance = u.compliance || 0;
  document.getElementById('dash-compl-text').innerText = `${compliance}%`;
  
  const circle = document.getElementById('dash-compl-circle');
  const offset = 263.89 * (1 - compliance / 100);
  circle.style.strokeDashoffset = offset;

  // Render Documents List (Simplified example)
  const list = document.getElementById('dash-doc-list');
  list.innerHTML = (u.documents || []).map(doc => `
    <div class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
      <div class="p-4 bg-slate-50 text-slate-400 rounded-2xl"><i data-lucide="file-text"></i></div>
      <div class="flex-1">
        <p class="font-bold text-slate-800">${doc.name}</p>
        <p class="text-[10px] text-slate-400 font-bold uppercase">${doc.status}</p>
      </div>
      <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">${doc.expiry}</span>
    </div>
  `).join('');
  
  lucide.createIcons();
}

function handleLogout() {
  state.user = null;
  switchView('login');
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Use IDs for specific button actions to separate from logic
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = btn.getAttribute('data-action');
      if (typeof window[action] === 'function') window[action]();
    });
  });
}

// Map logical function names to global for the click handlers (optional but cleaner)
window.handleLogin = handleLogin;
window.handleCheckDni = handleCheckDni;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.switchView = switchView;
window.goToStep = goToStep;
