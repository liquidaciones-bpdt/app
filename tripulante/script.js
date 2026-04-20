const API_URL = "https://script.google.com/macros/s/AKfycbyPXQDIVDOmeiPEH0tQ_ALH7wDqccLUXarTiyp4eFi9hS7bP70NEbgj6ORd3uBgwYzh/exec";

async function apiCall(action, payload = {}) {
  const token = localStorage.getItem("token");

  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, payload, token })
  });

  const data = await res.json();

  if (!data.success) throw new Error(data.message);

  return data.data;
}

// LOGIN
async function handleLogin() {
  const dni = document.getElementById("login-dni").value;
  const password = document.getElementById("login-pass").value;

  const res = await apiCall("login", { dni, password });

  localStorage.setItem("token", res.token);
  localStorage.setItem("user", JSON.stringify(res.user));

  location.reload();
}

// DATA
async function loadTripulante() {
  const data = await apiCall("getTripulante");
  renderData(data);
}
