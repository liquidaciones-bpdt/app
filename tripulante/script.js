/**
 * HT-BPDT Crew Portal - Frontend Logic (GAS Optimized)
 * Versión híbrida: Robustez de red + Sintaxis moderna.
 */

// CONFIGURACIÓN: Reemplaza con la URL de tu Web App desplegada en Google Apps Script
const CONFIG = {
  WEB_APP_URL: "URL_DE_TU_WEB_APP_AQUI",
  TIMEOUT_MS: 15000 // 15 segundos de espera máxima
};

// --- Global State ---
let currentState = {
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

// --- Initializing Lucide Icons ---
window.onload = () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

/**
 * Capa de API - Comunicación robusta con el Backend
 * @param {string} action - Nombre de la función en el backend
 * @param {Object} data - Datos a enviar
 */
async function callBackend(action, data = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.WEB_APP_URL, {
      method: "POST",
      // Usamos text/plain para evitar el preflight de CORS en Google Apps Script
      headers: { 'Content-Type': 'text/plain' }, 
      body: JSON.stringify({ action, data }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const result = await response.json();
    return result;

  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Error de API:", error);
    
    let message = "Error de conexión con el servidor.";
    if (error.name === 'AbortError') message = "La solicitud tardó demasiado. Reintenta.";
    
    return { success: false, message };
  }
}

/**
 * View Switcher Logic
 */
function switchView(viewName) {
  const views = ['login', 'dni-check', 'register', 'dashboard'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      el.classList.add('view-hidden');
      el.classList.remove('view-active');
    }
  });

  const targetEl = document.getElementById(`view-${viewName}`);
  if (targetEl) {
    targetEl.classList.remove('view-hidden');
    targetEl.classList.add('view-active');
  }
  
  currentState.view = viewName;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Control del estado de carga (Overlay)
 */
function setIsLoading(loading) {
  currentState.isLoading = loading;
  const overlay = document.getElementById('global-loader');
  if (overlay) {
    overlay.style.display = loading ? 'flex' : 'none';
  }
}

/**
 * HANDLERS: Lógica de Negocio
 */

async function handleLogin() {
  const dni = document.getElementById('login-dni').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  if (!dni || !pass) {
    alert("Ingresa DNI y contraseña.");
    return;
  }

  setIsLoading(true);
  const result = await callBackend("login", { dni, pass });
  setIsLoading(false);

  if (result.success) {
    currentState.user = result.user;
    renderDashboard();
    switchView('dashboard');
  } else {
    alert(result.message || "Credenciales inválidas.");
  }
}

async function handleCheckDni() {
  const dni = document.getElementById('check-dni-input').value.trim();
  if (dni.length < 8) {
    alert("El DNI debe tener al menos 8 dígitos.");
    return;
  }

  setIsLoading(true);
  const result = await callBackend("checkDni", { dni });
  setIsLoading(false);

  if (result.success) {
    if (result.exists) {
      alert("Este DNI ya se encuentra registrado.");
    } else {
      currentState.form.dni = dni;
      switchView('register');
    }
  } else {
    alert(result.message);
  }
}

async function handleFinalRegister() {
  const pass = document.getElementById('reg-pass').value.trim();
  const nombres = document.getElementById('reg-nombres').value.trim();
  const apellidos = document.getElementById('reg-apellidos').value.trim();
  const cargo = document.getElementById('reg-cargo').value.trim();
  const empresa = document.getElementById('reg-empresa').value.trim();

  if (!pass || !nombres || !apellidos || !cargo || !empresa) {
    alert("Por favor, completa todos los campos.");
    return;
  }

  const userData = {
    dni: currentState.form.dni,
    pass, nombres, apellidos, cargo, empresa
  };

  setIsLoading(true);
  const result = await callBackend("register", userData);
  setIsLoading(false);

  if (result.success) {
    goToRegStep(3);
  } else {
    alert(result.message || "No se pudo procesar el registro.");
  }
}

/**
 * Navegación interna del Registro (Wizard)
 */
function goToRegStep(step) {
  document.querySelectorAll('[id^="reg-step-"]').forEach(el => el.classList.add('hidden'));
  const targetStep = document.getElementById(`reg-step-${step}`);
  if (targetStep) targetStep.classList.remove('hidden');
  
  currentState.regStep = step;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * DASHBOARD: Renderizado de Datos
 */
function renderDashboard() {
  const user = currentState.user;
  if (!user) return;

  // Formateo de nombre (Primer nombre y primer apellido)
  const names = user.nombres.split(' ');
  const lastNames = user.apellidos.split(' ');
  
  document.getElementById('dash-user-name').innerHTML = `${names[0]}<br/>${lastNames[0]}`;
  document.getElementById('dash-user-cargo').innerText = user.cargo;
  document.getElementById('dash-user-dni').innerText = `DNI ${user.dni}`;

  // Indicador de cumplimiento (Compliance)
  const compliance = user.compliance || 0;
  const circle = document.getElementById('dash-compl-circle');
  const text = document.getElementById('dash-compl-text');
  const label = document.getElementById('dash-compl-label');

  if (text) text.innerText = `${compliance}%`;
  if (label) label.innerText = compliance >= 80 ? 'EXCELENTE' : 'SOPORTE REQUERIDO';

  if (circle) {
    // 263.89 es el perímetro del círculo (stroke-dasharray)
    const offset = 263.89 - (compliance / 100) * 263.89;
    circle.style.strokeDashoffset = offset;
  }

  renderDocuments(user.documents || []);
}

function renderDocuments(docs) {
  const container = document.getElementById('docs-container');
  if (!container) return;

  if (docs.length === 0) {
    container.innerHTML = `<p class="text-center text-slate-400 py-10">No hay documentos registrados.</p>`;
    return;
  }

  container.innerHTML = docs.map(d => {
    let style = "bg-emerald-50 border-emerald-100 text-emerald-600";
    let icon = "check-circle";
    
    if (d.state === 'VENCIDO') {
      style = "bg-rose-50 border-rose-100 text-rose-600";
      icon = "alert-circle";
    } else if (d.state === 'POR VENCER' || d.state === 'OBSERVADO') {
      style = "bg-amber-50 border-amber-100 text-amber-600";
      icon = "clock";
    }

    return `
      <div class="p-5 bg-white border border-slate-100 rounded-[24px] shadow-sm space-y-4 hover:border-slate-200 transition-colors">
          <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                  <h4 class="text-[15px] font-bold text-slate-800 leading-tight">${d.name}</h4>
                  <div class="flex items-center gap-2 text-slate-400">
                      <i data-lucide="calendar" size="14"></i>
                      <p class="text-[12px] font-medium uppercase tracking-wide">Vence: ${d.expiry}</p>
                  </div>
              </div>
              <div class="px-3 py-1.5 rounded-full border ${style.split(' ').slice(0, 2).join(' ')} flex items-center gap-1.5 shrink-0">
                  <i data-lucide="${icon}" size="14"></i>
                  <span class="text-[10px] font-black uppercase tracking-widest leading-none">${d.state}</span>
              </div>
          </div>
          ${d.note ? `
            <div class="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                <p class="text-[12px] font-medium text-amber-800 leading-relaxed">${d.note}</p>
            </div>
          ` : ''}
      </div>
    `;
  }).join('');
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleRefresh() {
  if (!currentState.user) return;
  
  setIsLoading(true);
  const result = await callBackend("login", { 
    dni: currentState.user.dni, 
    pass: currentState.user.pass 
  });
  setIsLoading(false);

  if (result.success) {
    currentState.user = result.user;
    renderDashboard();
  } else {
    alert("No se pudo actualizar la información.");
  }
}

function handleLogout() {
  currentState.user = null;
  // Opcional: Limpiar inputs
  document.getElementById('login-dni').value = "";
  document.getElementById('login-pass').value = "";
  switchView('login');
}
