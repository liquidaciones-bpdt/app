// ===============================
// ESTADO GLOBAL
// ===============================
let state = {
  user: null,
  fleet: [],
  crew: [],
  docs: []
};

const API_URL = "TU_WEBAPP_URL_AQUI";

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  showLogin();
});

// ===============================
// UI CONTROL
// ===============================
function showLogin() {
  document.getElementById("login-modal").classList.remove("hidden");
  document.getElementById("app-container").classList.add("hidden");
}

function showApp() {
  document.getElementById("login-modal").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
}

// ===============================
// LOGIN
// ===============================
async function handleLogin() {
  const dni = document.getElementById("login-dni").value;
  const pass = document.getElementById("login-pass").value;

  if (!dni || !pass) return alert("Completa los datos");

  showLoader("Validando...");

  const res = await apiCall("login", { dni, pass });

  hideLoader();

  if (!res.ok) return alert("Credenciales inválidas");

  state.user = res.user;

  document.getElementById("user-empresa").innerText = res.user.empresa || "Empresa";

  showApp();
  await loadAllData();
}

// ===============================
// LOGOUT
// ===============================
function logout() {
  state = { user: null, fleet: [], crew: [], docs: [] };
  showLogin();
}

// ===============================
// NAVIGATION
// ===============================
function switchTab(tab) {
  document.querySelectorAll(".view-section").forEach(v => v.classList.remove("active"));
  document.getElementById(`view-${tab}`).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.remove("bg-[#E20613]", "text-white");
    b.classList.add("text-slate-500");
  });

  const activeBtn = document.getElementById(`nav-${tab}`);
  activeBtn.classList.add("bg-[#E20613]", "text-white");
}

// ===============================
// LOADER
// ===============================
function showLoader(msg = "Cargando...") {
  const loader = document.getElementById("app-loader");
  loader.classList.remove("hidden");
  loader.style.opacity = 1;
  document.getElementById("app-loader-message").innerText = msg;
}

function hideLoader() {
  const loader = document.getElementById("app-loader");
  loader.style.opacity = 0;
  setTimeout(() => loader.classList.add("hidden"), 300);
}

// ===============================
// API
// ===============================
async function apiCall(action, payload = {}) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, ...payload }),
    });
    return await res.json();
  } catch (e) {
    console.error(e);
    return { ok: false };
  }
}

// ===============================
// DATA LOAD
// ===============================
async function loadAllData() {
  showLoader("Sincronizando...");

  const res = await apiCall("getAllData");

  hideLoader();

  if (!res.ok) return alert("Error cargando datos");

  state.fleet = res.fleet || [];
  state.crew = res.crew || [];
  state.docs = res.docs || [];

  renderAll();
}

// ===============================
// RENDER
// ===============================
function renderAll() {
  renderFleet();
  renderCrew();
  renderDocs();
}

// ===============================
// FLEET
// ===============================
function renderFleet() {
  const tbody = document.getElementById("fleet-table-body");
  tbody.innerHTML = "";

  state.fleet.forEach(u => {
    tbody.innerHTML += `
      <tr>
        <td class="px-8 py-4 font-bold">${u.placa}</td>
        <td class="px-8 py-4">${u.tipo}</td>
        <td class="px-8 py-4">${u.estado}</td>
        <td class="px-8 py-4">${u.cumplimiento || 0}%</td>
        <td class="px-8 py-4 text-right">
          <button onclick="openDetails('${u.placa}')">Ver</button>
        </td>
      </tr>
    `;
  });
}

// ===============================
// CREW
// ===============================
function renderCrew() {
  const grid = document.getElementById("crew-grid");
  grid.innerHTML = "";

  state.crew.forEach(c => {
    grid.innerHTML += `
      <div class="card-brand">
        <p class="font-bold">${c.nombre}</p>
        <p class="text-sm">${c.dni}</p>
      </div>
    `;
  });
}

// ===============================
// MODALES BASE
// ===============================
function openModal(id) {
  const el = document.getElementById(id);
  el.classList.remove("hidden");
  el.classList.add("flex");
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.add("hidden");
  el.classList.remove("flex");
}

function openCreateUnit() {
  document.getElementById("unit-form").reset();
  document.getElementById("unit-form-mode").value = "create";
  document.getElementById("unit-modal-title").innerText = "Registrar Unidad";
  openModal("unit-modal");
}

function openEditUnit(placa) {
  const unit = state.fleet.find(u => u.placa === placa);
  if (!unit) return;

  document.getElementById("unit-form-mode").value = "edit";
  document.getElementById("unit-modal-title").innerText = "Editar Unidad";

  document.getElementById("form-unit-id").value = unit.placa;
  document.getElementById("form-unit-sistema").value = unit.sistema;
  document.getElementById("form-unit-tipo").value = unit.tipo;
  document.getElementById("form-unit-marca").value = unit.marca;
  document.getElementById("form-unit-modelo").value = unit.modelo || "";
  document.getElementById("form-unit-capacidad").value = unit.capacidad || "";

  openModal("unit-modal");
}

async function handleUnitSubmit(e) {
  e.preventDefault();

  const mode = document.getElementById("unit-form-mode").value;

  const data = {
    placa: document.getElementById("form-unit-id").value,
    sistema: document.getElementById("form-unit-sistema").value,
    tipo: document.getElementById("form-unit-tipo").value,
    marca: document.getElementById("form-unit-marca").value,
    modelo: document.getElementById("form-unit-modelo").value,
    capacidad: document.getElementById("form-unit-capacidad").value
  };

  showLoader("Guardando...");

  const res = await apiCall(
    mode === "create" ? "createUnit" : "updateUnit",
    data
  );

  hideLoader();

  if (!res.ok) return alert("Error guardando");

  closeModal("unit-modal");
  await loadAllData();
}

function openDetails(placa) {
  const docs = state.docs.filter(d => d.placa === placa);
  const list = document.getElementById("details-docs-list");

  list.innerHTML = "";

  docs.forEach(d => {
    list.innerHTML += `
      <div class="p-4 border rounded-xl">
        <p class="font-bold">${d.nombre}</p>
        <p class="text-sm">${d.estado}</p>
      </div>
    `;
  });

  document.getElementById("details-modal-title").innerText = `Unidad ${placa}`;
  openModal("details-modal");
}

function openActionMenu(event, placa) {
  event.stopPropagation();

  currentContext = placa;

  const menu = document.getElementById("global-dropdown");

  menu.style.display = "block";
  menu.style.top = event.pageY + "px";
  menu.style.left = event.pageX + "px";
}

function handleMenuAction(action) {
  if (!currentContext) return;

  if (action === "details") openDetails(currentContext);
  if (action === "edit") openEditUnit(currentContext);

  document.getElementById("global-dropdown").style.display = "none";
}

document.addEventListener("click", () => {
  document.getElementById("global-dropdown").style.display = "none";
});

function openUpload(placa, docName) {
  currentContext = { placa, docName };
  document.getElementById("upload-details").innerText = `${placa} - ${docName}`;
  openModal("upload-modal");
}

document.getElementById("btn-sync-doc")
  .addEventListener("click", async () => {

    const file = document.getElementById("upload-file").files[0];
    const expiry = document.getElementById("upload-expiry").value;

    if (!file) return alert("Selecciona archivo");

    const reader = new FileReader();

    reader.onload = async function () {
      showLoader("Subiendo documento...");

      const res = await apiCall("uploadDoc", {
        placa: currentContext.placa,
        nombre: currentContext.docName,
        file: reader.result,
        expiry
      });

      hideLoader();

      if (!res.ok) return alert("Error subiendo");

      closeModal("upload-modal");
      await loadAllData();
    };

    reader.readAsDataURL(file);
  });


// ===============================
// DOCS
// ===============================
function renderDocs() {
  const grid = document.getElementById("docs-grid");
  grid.innerHTML = "";

  state.docs.forEach(d => {
    grid.innerHTML += `
      <div class="card-brand">
        <p class="font-bold">${d.nombre}</p>
        <p class="text-sm">${d.estado}</p>
      </div>
    `;
  });
}

// Mostrar nombre del archivo seleccionado
document.getElementById("upload-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    document.getElementById("file-name").innerText = file ? file.name : "";
});

async function uploadDocument() {
    const file = document.getElementById("upload-file").files[0];
    const expiry = document.getElementById("upload-expiry").value;

    if (!file) {
        alert("Selecciona un archivo");
        return;
    }

    console.log("Archivo:", file.name);
    console.log("Vence:", expiry);

    // 🔹 SIMULACIÓN (por ahora)
    alert("Documento listo para enviar");

    closeUpload();
}

// ===============================
// REFRESH
// ===============================
function refreshData() {
  const btn = document.getElementById("refresh-btn");
  btn.classList.add("spinning");

  loadAllData().finally(() => {
    btn.classList.remove("spinning");
  });
}
