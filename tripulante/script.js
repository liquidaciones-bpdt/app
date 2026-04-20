const API_URL = "URL_DE_TU_WEB_APP_DEPLOYADA"; // CAMBIAR ESTO

let state = {
    user: null,
    isLoading: false
};

const apiCall = async (action, payload) => {
    showLoading(true);
    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action, payload })
        });
        const res = await resp.json();
        if (!res.success) throw new Error(res.message);
        return res.data;
    } catch (e) {
        alert("Error: " + e.message);
        return null;
    } finally {
        showLoading(false);
    }
};

function showLoading(show) {
    document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

function switchView(view) {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.replace('view-active', 'view-hidden'));
    document.getElementById(`view-${view}`).classList.replace('view-hidden', 'view-active');
    lucide.createIcons();
}

async function handleLogin() {
    const dni = document.getElementById('login-dni').value;
    const pass = document.getElementById('login-pass').value;
    const data = await apiCall('login', { dni, pass });
    if (data) {
        state.user = data;
        renderDashboard();
        switchView('dashboard');
    }
}

async function handleDniCheck() {
    const dni = document.getElementById('check-dni-input').value;
    const res = await apiCall('checkDniStatus', { dni });
    if (res.status === 'EXISTS') alert("Ya tienes cuenta, inicia sesión.");
    else if (res.status === 'NEW') alert("No registrado en base operativa.");
    else switchView('register'); // Aquí abrirías tu vista de registro
}

function renderDashboard() {
    const { user } = state;
    document.getElementById('dash-user-name').innerHTML = `${user.nombres}<br>${user.apellidos}`;
    document.getElementById('dash-user-cargo').innerText = user.cargo;
    document.getElementById('avatar-initials').innerText = user.nombres[0] + user.apellidos[0];
    
    const compliance = user.compliance || 0;
    document.getElementById('dash-compl-text').innerText = `${compliance}%`;
    const offset = 263.89 - (263.89 * compliance) / 100;
    document.getElementById('dash-compl-circle').style.strokeDashoffset = offset;
    document.getElementById('dash-compl-label').innerText = compliance >= 80 ? 'EXCELENTE' : 'PENDIENTE';
}

function handleLogout() {
    state.user = null;
    switchView('login');
}

window.onload = () => lucide.createIcons();
