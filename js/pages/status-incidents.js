// js/pages/status-incidents.js — the incidents shown on ardena.co.ke/status.
// Classic script (not a module): top-level functions and vars are global by design.
//
// The status page measures uptime by itself; an incident is the human part:
// what is wrong, which parts are affected, and what we are doing about it.
// Everything written here is public the moment it is saved, so each incident
// shows exactly the text people will read.
//
// An incident is never edited. It gets updates, newest last, and the latest
// update's status is the incident's status. "Resolved" closes it. Delete is
// only for one posted by mistake.

let statusIncidentComponents = [];

const STATUS_IMPACT = {
  degraded: { label: "Degraded performance", cls: "pending" },
  partial_outage: { label: "Partial outage", cls: "pending" },
  major_outage: { label: "Major outage", cls: "inactive" },
};

const STATUS_STAGES = [
  { value: "investigating", label: "Investigating" },
  { value: "identified", label: "Identified" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
];

// Used when the public status feed can't be read, so an incident can still be
// posted during the kind of outage that takes the feed down.
const STATUS_COMPONENT_FALLBACK = [
  { value: "host_app", label: "Host app" },
  { value: "client_app", label: "Client app" },
  { value: "booking_web", label: "Booking website" },
  { value: "payments", label: "Payments" },
  { value: "business_dashboard", label: "Ardena Business" },
  { value: "website", label: "Website" },
];

function statusStageLabel(value) {
  const stage = STATUS_STAGES.find((s) => s.value === value);
  return stage ? stage.label : value;
}

function statusComponentLabel(key) {
  const component = statusIncidentComponents.find((c) => c.value === key);
  return component ? component.label : key;
}

async function initStatusIncidentsPage() {
  if (!statusIncidentComponents.length) {
    try {
      const feed = await api.getStatusFeed();
      statusIncidentComponents = (feed.components || []).map((c) => ({
        value: c.key,
        label: c.name || c.key,
      }));
    } catch (error) {
      console.warn("Status feed unavailable, using the built-in component list", error);
    }
    if (!statusIncidentComponents.length) {
      statusIncidentComponents = STATUS_COMPONENT_FALLBACK;
    }
  }
  loadStatusIncidents();
}

async function loadStatusIncidents() {
  const content = document.getElementById("statusIncidentsContent");
  if (!content) return;
  try {
    content.innerHTML = '<div class="loading">Loading incidents...</div>';
    const incidents = await api.getStatusIncidents(50);
    if (!incidents.length) {
      content.innerHTML =
        '<div class="empty-state">No incidents have been posted. The status page shows measured uptime only.</div>';
      return;
    }
    content.innerHTML = incidents.map(statusIncidentHtml).join("");
  } catch (error) {
    console.error("Error loading incidents:", error);
    content.innerHTML = `<div class="empty-state">Error loading incidents: ${escapeHtml(error.message)}</div>`;
  }
}

function statusIncidentHtml(incident) {
  const impact = STATUS_IMPACT[incident.impact] || { label: incident.impact, cls: "" };
  const resolved = incident.status === "resolved";
  const components = (incident.components || []).map(statusComponentLabel).join(", ");
  const updates = (incident.updates || [])
    .map(
      (u) => `
            <li>
                <strong>${escapeHtml(statusStageLabel(u.status))}</strong>
                <span class="detail-note" style="display: inline;"> · ${fmtDateTime(u.created_at)}</span>
                <div style="white-space: pre-wrap;">${escapeHtml(u.message)}</div>
            </li>`,
    )
    .join("");
  return `
        <div class="incident-card">
            <div class="incident-head">
                <div>
                    <h3 class="incident-title">${escapeHtml(incident.title)}</h3>
                    <span class="status-badge ${resolved ? "active" : impact.cls}">${resolved ? "Resolved" : escapeHtml(statusStageLabel(incident.status))}</span>
                    <span class="status-badge ${impact.cls}">${escapeHtml(impact.label)}</span>
                    <div class="detail-note">${components ? escapeHtml(components) + " · " : ""}opened ${fmtDateTime(incident.created_at)}${incident.resolved_at ? " · resolved " + fmtDateTime(incident.resolved_at) : ""}</div>
                </div>
                <div>
                    <button class="btn btn-primary btn-small" onclick="postStatusIncidentUpdate(${incident.id}, '${incident.status}')">Post update</button>
                    <button class="btn btn-danger btn-small" onclick="deleteStatusIncident(${incident.id})">Delete</button>
                </div>
            </div>
            <ul class="incident-updates">${updates}</ul>
        </div>`;
}

async function createStatusIncident() {
  const values = await uiForm({
    title: "Post an incident",
    message: "This appears on the public status page as soon as you post it.",
    confirmText: "Post incident",
    fields: [
      { name: "title", label: "Title", required: true, maxLength: 200, placeholder: "M-Pesa payments are failing" },
      {
        name: "impact",
        label: "Impact",
        type: "select",
        value: "degraded",
        options: Object.keys(STATUS_IMPACT).map((key) => ({ value: key, label: STATUS_IMPACT[key].label })),
      },
      { name: "status", label: "Stage", type: "select", value: "investigating", options: STATUS_STAGES },
      {
        name: "components",
        label: "What is affected",
        type: "checkboxes",
        required: true,
        options: statusIncidentComponents,
      },
      {
        name: "message",
        label: "First update",
        type: "textarea",
        required: true,
        rows: 4,
        placeholder: "What people are seeing, and what we are doing about it.",
      },
    ],
  });
  if (!values) return;
  try {
    await api.createStatusIncident(values);
    uiToast("Incident posted to the status page.", "success");
    loadStatusIncidents();
  } catch (error) {
    uiToast(`Couldn't post the incident: ${error.message}`, "error");
  }
}

async function postStatusIncidentUpdate(id, currentStatus) {
  const values = await uiForm({
    title: "Post an update",
    message: "Updates are public and can't be edited afterwards.",
    confirmText: "Post update",
    fields: [
      {
        name: "status",
        label: "Stage",
        type: "select",
        value: currentStatus === "resolved" ? "monitoring" : currentStatus,
        options: STATUS_STAGES,
        hint: "Resolved closes the incident.",
      },
      {
        name: "impact",
        label: "Impact",
        type: "select",
        value: "",
        options: [{ value: "", label: "Unchanged" }].concat(
          Object.keys(STATUS_IMPACT).map((key) => ({ value: key, label: STATUS_IMPACT[key].label })),
        ),
      },
      { name: "message", label: "Update", type: "textarea", required: true, rows: 4 },
    ],
  });
  if (!values) return;
  const body = { status: values.status, message: values.message };
  if (values.impact) body.impact = values.impact;
  try {
    await api.postStatusIncidentUpdate(id, body);
    uiToast("Update posted.", "success");
    loadStatusIncidents();
  } catch (error) {
    uiToast(`Couldn't post the update: ${error.message}`, "error");
  }
}

async function deleteStatusIncident(id) {
  const ok = await uiConfirm(
    "Delete this incident from the status page? Do this only for one posted by mistake. A real incident should be resolved, so its history stays visible.",
    { title: "Delete incident", confirmText: "Delete", danger: true },
  );
  if (!ok) return;
  try {
    await api.deleteStatusIncident(id);
    uiToast("Incident deleted.", "success");
    loadStatusIncidents();
  } catch (error) {
    uiToast(`Couldn't delete the incident: ${error.message}`, "error");
  }
}
