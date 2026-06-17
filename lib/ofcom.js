// Ofcom broadband coverage API client (server-side; the subscription key NEVER
// reaches the browser). GET https://api-proxy.ofcom.org.uk/broadband/coverage/{POSTCODE}
// with header  Ocp-Apim-Subscription-Key. Postcode must be UPPERCASE, no spaces.
// Returns authoritative AVAILABILITY/SPEED data (not prices). Built on Node fetch.
//
// Field names in Ofcom's response vary, so we match candidate keys case-insensitively
// and aggregate across the per-address BroadbandProvision array — robust to schema
// quirks, and easy to tighten once a live sample is seen.

const OFCOM_BASE = "https://api-proxy.ofcom.org.uk/broadband/coverage/";

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
function isYes(v) { if (v == null) return null; const s = String(v).toLowerCase(); return s === "yes" || s === "true" || s === "y" || s === "1" || s === "available"; }
function pick(rec, needles) {
  for (const k of Object.keys(rec)) { const lk = k.toLowerCase(); if (needles.some((n) => lk.includes(n))) return rec[k]; }
  return undefined;
}

function normalize(data, pc) {
  const list = Array.isArray(data) ? data
    : (data.BroadbandProvision || data.broadbandProvision || data.results || data.Results || []);
  let maxDown = null, maxUp = null, fttp = false, ultrafast = false, superfast = false, count = 0;
  (Array.isArray(list) ? list : []).forEach((rec) => {
    if (!rec || typeof rec !== "object") return;
    count++;
    const d = num(pick(rec, ["maxbbpredicteddown", "maxpredicteddown", "maxdown", "predicteddown", "downspeed", "download"]));
    const u = num(pick(rec, ["maxbbpredictedup", "maxpredictedup", "maxup", "predictedup", "upspeed", "upload"]));
    if (d != null) maxDown = Math.max(maxDown == null ? 0 : maxDown, d);
    if (u != null) maxUp = Math.max(maxUp == null ? 0 : maxUp, u);
    if (isYes(pick(rec, ["fttp"]))) fttp = true;
    if (isYes(pick(rec, ["ufbb", "ultrafast"]))) ultrafast = true;
    if (isYes(pick(rec, ["sfbb", "superfast"]))) superfast = true;
  });
  // Speed-defined tiers can be inferred from the max predicted speed if flags are absent.
  if (maxDown != null) { if (maxDown >= 300) ultrafast = true; if (maxDown >= 30) superfast = true; }
  return { postcode: pc, addressCount: count || num(data.Count) || null, maxDownMbps: maxDown, maxUpMbps: maxUp, fttp, ultrafast, superfast };
}

async function fetchCoverage(key, postcode) {
  if (typeof fetch !== "function") throw new Error("global fetch unavailable — Node 18+ required");
  if (!key) throw new Error("No Ofcom API key configured");
  const pc = String(postcode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]*$/.test(pc)) throw new Error("Invalid postcode");
  const r = await fetch(OFCOM_BASE + encodeURIComponent(pc), {
    headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
  });
  const text = await r.text();
  let data = {}; try { data = JSON.parse(text); } catch (_) {}
  if (!r.ok) {
    const msg = (data && (data.Error || data.message || data.error)) || ("Ofcom error " + r.status);
    const e = new Error(typeof msg === "string" ? msg : JSON.stringify(msg)); e.status = r.status; throw e;
  }
  return normalize(data, pc);
}

module.exports = { fetchCoverage, normalize };
