const BASE = "/wp-json/nmc/v1";

function getToken() {
  return sessionStorage.getItem("nmc_jwt_token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

export async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success) {
    sessionStorage.setItem("nmc_jwt_token", data.token);
    sessionStorage.setItem("nmc_user_naam", data.naam);
    sessionStorage.setItem("nmc_user_role", data.role);
    return { success: true, naam: data.naam, role: data.role };
  }
  return { success: false, error: data.error };
}

export function logout() {
  sessionStorage.removeItem("nmc_jwt_token");
  sessionStorage.removeItem("nmc_user_naam");
  sessionStorage.removeItem("nmc_user_role");
}

// De sessie stond vroeger in localStorage en bleef daardoor ook na het sluiten
// van de browser bestaan. Ruim die resten eenmalig op, zodat er nergens meer
// een oud token blijft rondslingeren.
export function ruimOudeSessieOp() {
  ["nmc_jwt_token", "nmc_user_naam", "nmc_user_role"].forEach(k => localStorage.removeItem(k));
}

// Eigen, nog corrigeerbare invoer (of null als het venster verstreken is).
export async function getCorrigeerbaar() {
  const res = await fetch(`${BASE}/logboek/corrigeerbaar`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function corrigeerEntry(uuid, entry) {
  const res = await fetch(`${BASE}/logboek/${uuid}/correctie`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Corrigeren mislukt.");
  }
  return res.json();
}

export async function getUserRole() {
  const res = await fetch(`${BASE}/me`, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.role;
}

export async function getEntries(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const res = await fetch(`${BASE}/logboek?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows.map(r => ({
    ...r,
    ...(typeof r.data_json === "string" ? JSON.parse(r.data_json) : r.data_json),
  }));
}

export async function saveEntry(entry) {
  const res = await fetch(`${BASE}/logboek`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(entry),
  });
  if (res.status === 409) {
    const data = await res.json();
    throw new Error("DUPLICATE:" + data.message);
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateEntry(uuid, entry) {
  const res = await fetch(`${BASE}/logboek/${uuid}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteEntry(uuid) {
  const res = await fetch(`${BASE}/logboek/${uuid}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function checkDuplicate(datum, shift, type, meteoroloog) {
  const params = new URLSearchParams({ datum, shift, type, meteoroloog }).toString();
  const res = await fetch(`${BASE}/logboek/check?${params}`, { headers: authHeaders() });
  if (!res.ok) return false;
  const data = await res.json();
  return data.exists;
}

export async function getUsers() {
  const res = await fetch(`${BASE}/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createUser(user) {
  const res = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Aanmaken gebruiker mislukt.");
  }
  return res.json();
}

export async function updateUser(id, user) {
  const res = await fetch(`${BASE}/users/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(user),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUser(id) {
  const res = await fetch(`${BASE}/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getLoginLogs() {
  const res = await fetch(`${BASE}/logs`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function downloadLoginLog(bestand) {
  const res = await fetch(`${BASE}/logs/${bestand}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestand;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
