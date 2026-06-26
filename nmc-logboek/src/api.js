const BASE = "/wp-json/nmc/v1";

function getToken() {
  return localStorage.getItem("nmc_jwt_token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

export async function login(username, password) {
  const res = await fetch("/wp-json/jwt-auth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem("nmc_jwt_token", data.token);
    localStorage.setItem("nmc_user_naam", data.user_display_name);
    return { success: true, naam: data.user_display_name };
  }
  return { success: false, error: data.message };
}

export function logout() {
  localStorage.removeItem("nmc_jwt_token");
  localStorage.removeItem("nmc_user_naam");
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
