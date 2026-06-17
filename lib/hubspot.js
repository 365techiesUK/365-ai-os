// HubSpot lead capture — create/update a contact by email using a Private App token.
// Uses ONLY standard CRM v3 default contact properties (email, firstname, lastname,
// phone, company, message, lifecyclestage, hs_lead_status) — no custom properties
// need to exist in the portal. Built on Node's global fetch (Node 18+); no deps.

const HS_BASE = "https://api.hubapi.com";

// "Jane Smith" -> {firstname:"Jane", lastname:"Smith"}; single token -> firstname only.
function splitName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstname: "", lastname: "" };
  if (parts.length === 1) return { firstname: parts[0], lastname: "" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

// Map a normalised lead to standard HubSpot contact properties.
function buildProperties(lead) {
  const props = {};
  const { firstname, lastname } = splitName(lead.name);
  if (lead.email) props.email = lead.email;
  if (firstname) props.firstname = firstname;
  if (lastname) props.lastname = lastname;
  if (lead.phone) props.phone = lead.phone;
  if (lead.company) props.company = lead.company;
  if (lead.message) props.message = lead.message; // "message" is a default contact property
  props.lifecyclestage = "lead";
  props.hs_lead_status = "NEW";
  return props;
}

// Create-or-update by email in a single idempotent call (batch upsert, idProperty=email).
async function upsertContact(token, lead) {
  if (typeof fetch !== "function") throw new Error("global fetch unavailable — Node 18+ required");
  if (!token) throw new Error("No HubSpot token configured");
  if (!lead || !lead.email) throw new Error("Email is required");

  const body = { inputs: [{ idProperty: "email", id: lead.email, properties: buildProperties(lead) }] };
  const r = await fetch(HS_BASE + "/crm/v3/objects/contacts/batch/upsert", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data = {}; try { data = JSON.parse(text); } catch (_) {}

  if (!r.ok) {
    const msg = (data && (data.message || data.error)) || ("HubSpot error " + r.status);
    const err = new Error(msg); err.status = r.status; err.detail = data; throw err;
  }
  // batch endpoints can return 2xx with per-input errors
  if (data.numErrors && (!data.results || !data.results.length)) {
    const e0 = (data.errors && data.errors[0]) || {};
    const err = new Error(e0.message || "HubSpot rejected the contact"); err.detail = data; throw err;
  }
  const result = (data.results && data.results[0]) || {};
  return { id: result.id || null, properties: result.properties || {}, raw: result };
}

// Submit to HubSpot's PUBLIC Forms API — no token/app/super-admin needed.
// Creates/updates a contact by email and records a form submission. The form must
// already exist in the portal and contain the fields we send (email, firstname,
// lastname, phone, message). portalId + formGuid are NOT secrets.
async function submitForm(portalId, formGuid, lead, context, host) {
  if (typeof fetch !== "function") throw new Error("global fetch unavailable — Node 18+ required");
  if (!portalId || !formGuid) throw new Error("HubSpot portalId and formGuid are required");
  if (!lead || !lead.email) throw new Error("Email is required");
  // Region host: NA = api.hsforms.com, EU = api-eu1.hsforms.com. Whitelisted to avoid SSRF.
  const ALLOWED_HOSTS = { "api.hsforms.com": 1, "api-eu1.hsforms.com": 1 };
  const h = ALLOWED_HOSTS[host] ? host : "api.hsforms.com";

  const { firstname, lastname } = splitName(lead.name);
  const fields = [];
  const add = (name, value) => { if (value) fields.push({ name, value: String(value) }); };
  add("email", lead.email);
  add("firstname", firstname);
  add("lastname", lastname);
  add("phone", lead.phone);
  add("message", lead.message);

  const body = { fields };
  if (context && (context.pageUri || context.pageName)) {
    body.context = {};
    if (context.pageUri) body.context.pageUri = String(context.pageUri).slice(0, 1000);
    if (context.pageName) body.context.pageName = String(context.pageName).slice(0, 255);
  }

  const url = "https://" + h + "/submissions/v3/integration/submit/" +
    encodeURIComponent(portalId) + "/" + encodeURIComponent(formGuid);
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await r.text();
  let data = {}; try { data = JSON.parse(text); } catch (_) {}
  if (!r.ok) {
    const msg = (data && (data.message || (data.errors && data.errors[0] && data.errors[0].message))) || ("HubSpot Forms error " + r.status);
    const err = new Error(msg); err.status = r.status; err.detail = data; throw err;
  }
  return { ok: true, raw: data };
}

module.exports = { upsertContact, submitForm, buildProperties, splitName };
