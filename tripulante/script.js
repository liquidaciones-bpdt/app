<script>
/**
 * HT-BPDT Crew Portal - Frontend Logic
 */

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
    lucide.createIcons();
};

/**
 * View Switcher Logic
 */
function switchView(viewName) {
  // Hide all views
  const views = ['login', 'dni-check', 'register', 'dashboard'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    el.classList.add('view-hidden');
    el.classList.remove('view-active');
  });

  // Show target view
  const targetEl = document.getElementById(`view-${viewName}`);
  targetEl.classList.remove('view-hidden');
  targetEl.classList.add('view-active');
  
  currentState.view = viewName;
  lucide.createIcons(); // Re-render icons for new view
}

/**
 * Loading Overlay
 */
function setIsLoading(loading) {
  currentState.isLoading = loading;
  const loader = document.getElementById('global-loader');
  if (loading) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

/**
 * Login Handler
 */
function handleLogin() {
  const dni = document.getElementById('login-dni').value;
  const pass = document.getElementById('login-pass').value;
  
  if (!dni || !pass) {
    alert('Por favor, ingresa tus credenciales.');
    return;
  }

  setIsLoading(true);
  
  google.script.run
    .withSuccessHandler(response => {
      setIsLoading(false);
      if (response.success) {
        currentState.user = response.user;
        renderDashboard();
        switchView('dashboard');
      } else {
        alert(response.message);
      }
    })
    .withFailureHandler(err => {
      setIsLoading(false);
      alert('Error de conexión con el servidor.');
    })
    .loginUser(dni, pass);
}

/**
 * DNI Check Handler
 */
function handleCheckDni() {
  const dni = document.getElementById('check-dni-input').value;
  if (!dni || dni.length < 8) return;

  setIsLoading(true);
  
  google.script.run
    .withSuccessHandler(response => {
      setIsLoading(false);
      currentState.dniStatus = response.status;
      
      const alertExists = document.getElementById('alert-exists');
      alertExists.classList.add('hidden');

      if (response.status === 'EXISTS') {
        alertExists.classList.remove('hidden');
      } else if (response.status === 'PRELOAD') {
        // Prepare registration form with preloaded data
        currentState.form.dni = response.data.dni;
        currentState.form.nombres = response.data.nombres;
        currentState.form.apellidos = response.data.apellidos;
        currentState.form.cargo = response.data.cargo;
        currentState.form.empresa = response.data.empresa;
        
        setupRegisterWizard('PRELOAD');
        switchView('register');
      } else {
        // NEW user
        currentState.form.dni = dni;
        currentState.form.nombres = '';
        currentState.form.apellidos = '';
        currentState.form.cargo = '';
        currentState.form.empresa = '';
        
        setupRegisterWizard('NEW');
        switchView('register');
      }
    })
    .withFailureHandler(err => {
      setIsLoading(false);
      alert('Error validando DNI.');
    })
    .checkDniStatus(dni);
}

/**
 * Register Wizard Setup
 */
function setupRegisterWizard(status) {
  const isPreload = status === 'PRELOAD';
  
  // Labels
  document.getElementById('reg-type-label').innerText = isPreload ? 'Complementar Perfil' : 'Nuevo Ingreso';
  document.getElementById('reg-step-1-desc').innerText = isPreload 
    ? 'Los siguientes datos han sido verificados por HT-BPDT.' 
    : 'Personaliza tu perfil de tripulante con tu información real.';

  // Fields
  const fields = ['nombres', 'apellidos', 'cargo', 'empresa'];
  fields.forEach(f => {
    const el = document.getElementById(`reg-${f}`);
    el.value = currentState.form[f];
    el.readOnly = isPreload;
    
    // Styling for read-only
    if (isPreload) {
      el.classList.add('bg-slate-50', 'text-slate-500', 'cursor-not-allowed');
    } else {
      el.classList.remove('bg-slate-50', 'text-slate-500', 'cursor-not-allowed');
    }
  });

  // Badges
  document.getElementById('badge-nombres').classList.toggle('hidden', !isPreload);
  document.getElementById('badge-apellidos').classList.toggle('hidden', !isPreload);

  // Pass Section
  document.getElementById('reg-pass-container').classList.toggle('hidden', isPreload);
  
  goToRegStep(1);
}

function goToRegStep(step) {
  currentState.regStep = step;
  
  // Bars
  document.getElementById('step-1-bar').className = `h-1.5 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-red-600' : 'bg-slate-200'}`;
  document.getElementById('step-2-bar').className = `h-1.5 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-red-600' : 'bg-slate-200'}`;
  document.getElementById('step-3-bar').className = `h-1.5 rounded-full transition-all duration-500 ${step >= 3 ? 'bg-red-600' : 'bg-slate-200'}`;

  // Panels
  document.getElementById('reg-step-1').classList.toggle('hidden', step !== 1);
  document.getElementById('reg-step-2').classList.toggle('hidden', step !== 2);
  document.getElementById('reg-step-3').classList.toggle('hidden', step !== 3);
  
  lucide.createIcons();
}

/**
 * Final Registration Handler
 */
function handleRegister() {
  const userData = {
    dni: currentState.form.dni,
    nombres: document.getElementById('reg-nombres').value,
    apellidos: document.getElementById('reg-apellidos').value,
    cargo: document.getElementById('reg-cargo').value,
    empresa: document.getElementById('reg-empresa').value,
    password: currentState.dniStatus === 'PRELOAD' ? '123456' : document.getElementById('reg-pass').value // Default pass for preload for demo
  };

  if (!userData.nombres || !userData.apellidos || !userData.cargo || !userData.empresa || (!userData.password && currentState.dniStatus === 'NEW')) {
    alert('Completa todos los campos obligatorios.');
    return;
  }

  setIsLoading(true);

  google.script.run
    .withSuccessHandler(response => {
      setIsLoading(false);
      if (response.success) {
        goToRegStep(3);
      } else {
        alert(response.message);
      }
    })
    .withFailureHandler(err => {
      setIsLoading(false);
      alert('Error en el registro.');
    })
    .registerUser(userData);
}

/**
 * Dashboard Rendering
 */
function renderDashboard() {
  const user = currentState.user;
  if (!user) return;

  // Header
  const names = user.nombres.split(' ');
  const lastNames = user.apellidos.split(' ');
  document.getElementById('dash-user-name').innerHTML = `${names[0]}<br/>${lastNames[0]}`;
  document.getElementById('dash-user-cargo').innerText = user.cargo;
  document.getElementById('dash-user-dni').innerText = `DNI ${user.dni}`;

  // KPI Ring
  const compliance = user.compliance;
  const circle = document.getElementById('dash-compl-circle');
  const text = document.getElementById('dash-compl-text');
  const label = document.getElementById('dash-compl-label');

  text.innerText = `${compliance}%`;
  label.innerText = compliance >= 80 ? 'EXCELENTE' : 'SOPORTE REQUERIDO';

  // Offset calculation: stroke-dasharray is 263.89
  const offset = 263.89 * (1 - compliance / 100);
  setTimeout(() => {
    circle.style.strokeDashoffset = offset;
  }, 100);
}

/**
 * Logout
 */
function handleLogout() {
  setIsLoading(true);
  setTimeout(() => {
    currentState.user = null;
    setIsLoading(false);
    switchView('login');
  }, 800);
}
</script>
