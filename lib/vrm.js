// Victron VRM API v2 client — read-only live data for the AI OS "Off-Grid" app.
// Auth: a VRM "Access token" (VRM Portal -> avatar -> Preferences -> Integrations
// -> Access tokens) sent as header  X-Authorization: Token <token>.  Built on
// Node's global fetch (Node 18+); no dependencies. The token stays server-side.
//
// Live current values come from the installation "diagnostics" endpoint, which
// returns a flat list of records each with a human `description`, a `formattedValue`
// (e.g. "87.3 %") and a numeric `rawValue`. We map those to a normalised shape by
// matching on description, degrading gracefully when a field isn't present.

const VRM_BASE = "https://vrmapi.victronenergy.com/v2";

function authHeaders(token) {
  return { "X-Authorization": "Token " + token, "Content-Type": "application/json" };
}

async function vrmGet(path, token) {
  if (typeof fetch !== "function") throw new Error("global fetch unavailable — Node 18+ required");
  if (!token) throw new Error("No VRM access token configured");
  const r = await fetch(VRM_BASE + path, { headers: authHeaders(token) });
  const text = await r.text();
  let data = {}; try { data = JSON.parse(text); } catch (_) {}
  if (!r.ok || data.success === false) {
    const msg = (data && (data.errors || data.error_code || data.message)) || ("VRM error " + r.status);
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg)); err.status = r.status; throw err;
  }
  return data;
}

// List the token owner's installations so the user can find their site id.
async function listInstallations(token) {
  const me = await vrmGet("/users/me", token);
  const idUser = me && me.user && (me.user.id || me.user.idUser);
  if (!idUser) throw new Error("Could not read VRM user id");
  const res = await vrmGet("/users/" + idUser + "/installations", token);
  return (res.records || []).map((s) => ({ idSite: s.idSite, name: s.name }));
}

// ---- diagnostics mapping helpers ----
function pick(records, needles) {
  const n = needles.map((s) => s.toLowerCase());
  for (const r of records) {
    const d = String(r.description || "").toLowerCase();
    if (n.some((x) => d.includes(x))) return r;
  }
  return null;
}
function num(r) { if (!r) return null; const f = parseFloat(r.rawValue != null ? r.rawValue : r.formattedValue); return Number.isFinite(f) ? f : null; }
function fmt(r) { return r ? String(r.formattedValue != null ? r.formattedValue : r.rawValue) : null; }

function normalize(records, siteName) {
  records = Array.isArray(records) ? records : [];
  const soc = pick(records, ["state of charge"]);
  const bv = pick(records, ["battery voltage"]) || pick(records, ["voltage"]);
  const bc = pick(records, ["battery current"]) || pick(records, ["current"]);
  const ttg = pick(records, ["time to go", "time-to-go"]);
  const dcp = pick(records, ["dc power", "battery power"]);
  const pvp = pick(records, ["pv power", "pv - dc", "pv dc-coupled", "solar power"]);
  const acl = pick(records, ["ac consumption", "ac loads", "output power"]);
  const gen = pick(records, ["generator"]);
  const inv = pick(records, ["vebus state", "inverter state", "system state"]); // not bare "state" — collides with "state of charge"

  // tanks: any record that looks like a tank level
  const tanks = [];
  for (const r of records) {
    const d = String(r.description || "").toLowerCase();
    if (/(fresh|waste|black|grey|gray|fuel|live ?well|oil|gasoline|water)/.test(d) && /(level|%|tank|water|fuel)/.test(d + (r.formattedValue || ""))) {
      const v = num(r);
      if (v != null && v <= 100 && v >= 0) tanks.push({ name: r.description, pct: Math.round(v), formatted: fmt(r) });
    }
  }

  const currentA = num(bc);
  let state = "Idle";
  if (currentA != null) state = currentA > 0.3 ? "Charging" : currentA < -0.3 ? "Discharging" : "Idle";

  return {
    siteName: siteName || "VRM installation",
    battery: { socPct: num(soc), voltageV: num(bv), currentA, timeToGoH: ttg ? num(ttg) : null, state, socFmt: fmt(soc), voltageFmt: fmt(bv), currentFmt: fmt(bc), timeToGoFmt: fmt(ttg) },
    dc: { powerW: num(dcp), powerFmt: fmt(dcp) },
    pv: { powerW: num(pvp), powerFmt: fmt(pvp), name: null },
    acLoads: { powerW: num(acl), powerFmt: fmt(acl) },
    generator: { label: fmt(gen) },
    inverter: { state: fmt(inv) },
    tanks,
    weather: null, // not available via diagnostics
    recordCount: records.length,
  };
}

async function fetchLive(token, siteId, siteName) {
  if (!siteId) throw new Error("No VRM site id configured");
  const res = await vrmGet("/installations/" + encodeURIComponent(siteId) + "/diagnostics?count=1000", token);
  return normalize(res.records || [], siteName);
}

module.exports = { fetchLive, listInstallations, normalize };
