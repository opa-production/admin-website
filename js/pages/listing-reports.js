// js/pages/listing-reports.js — "Listing Reports" tab of the Moderation page.
// Classic script (not a module): top-level functions and vars are global by design.
//
// Clients report car listings; admins triage them here. Backend contract is in
// reports.md. This tab reuses the shared moderation drawer + pagination defined
// in js/pages/moderation.js (showModerationDrawer, renderModPagination,
// formatModDate, escapeModText/Attr, modDrawerContext, MOD_PAGE_SIZE).

const REPORT_OPEN_STATUSES = ["received", "reviewing"];
const REPORT_RESOLVED_STATUSES = ["actioned", "dismissed"];
const REPORT_ALL_STATUSES = [
  ...REPORT_OPEN_STATUSES,
  ...REPORT_RESOLVED_STATUSES,
];
// Per-status fetch cap. Moderation volume is low; a status above this is flagged
// rather than silently truncated.
const REPORT_FETCH_LIMIT = 100;

const reportsState = {
  // status filter is one of: 'open' | 'resolved' | a concrete status | '' (all)
  status: "open",
  order: "desc",
  carId: "",
  clientId: "",
  page: 1,
  rows: [],
  truncated: false,
  filtersBound: false,
};

// Map the dropdown selection to the concrete API statuses to fetch.
function reportStatusesForFilter() {
  switch (reportsState.status) {
    case "open":
      return REPORT_OPEN_STATUSES;
    case "resolved":
      return REPORT_RESOLVED_STATUSES;
    case "":
      return REPORT_ALL_STATUSES;
    default:
      return [reportsState.status];
  }
}

function bindListingReportFilters() {
  if (reportsState.filtersBound) return;
  const statusEl = document.getElementById("reportsStatusFilter");
  const orderEl = document.getElementById("reportsOrderFilter");
  const carEl = document.getElementById("reportsCarIdFilter");
  const clientEl = document.getElementById("reportsClientIdFilter");
  if (!statusEl) return; // pane not in DOM

  statusEl.addEventListener("change", (e) => {
    reportsState.status = e.target.value;
    reportsState.page = 1;
    loadListingReports();
  });
  orderEl.addEventListener("change", (e) => {
    reportsState.order = e.target.value;
    reportsState.page = 1;
    loadListingReports();
  });
  const onIdInput = (key, el) => {
    let timer = null;
    el.addEventListener("input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        reportsState[key] = e.target.value.trim();
        reportsState.page = 1;
        loadListingReports();
      }, 300);
    });
  };
  onIdInput("carId", carEl);
  onIdInput("clientId", clientEl);
  reportsState.filtersBound = true;
}

async function loadListingReportStats() {
  const row = document.getElementById("reportsStatsRow");
  if (!row) return;
  try {
    // Cheap limit=1 calls per status just to read totals.
    const [received, reviewing, actioned, dismissed] = await Promise.all(
      REPORT_ALL_STATUSES.map((s) =>
        api.getListingReports({ status: s, limit: 1 }),
      ),
    );
    const n = (r) => r.total || 0;
    const open = n(received) + n(reviewing);
    const resolved = n(actioned) + n(dismissed);
    row.innerHTML = `
            <div class="mod-stat-card">
                <div class="mod-stat-label">Open</div>
                <div class="mod-stat-value">${open.toLocaleString()}</div>
                <div class="mod-stat-sub">Received + reviewing</div>
            </div>
            <div class="mod-stat-card">
                <div class="mod-stat-label">Received</div>
                <div class="mod-stat-value">${n(received).toLocaleString()}</div>
                <div class="mod-stat-sub">New, untriaged</div>
            </div>
            <div class="mod-stat-card">
                <div class="mod-stat-label">Reviewing</div>
                <div class="mod-stat-value">${n(reviewing).toLocaleString()}</div>
                <div class="mod-stat-sub">In progress</div>
            </div>
            <div class="mod-stat-card">
                <div class="mod-stat-label">Resolved</div>
                <div class="mod-stat-value">${resolved.toLocaleString()}</div>
                <div class="mod-stat-sub">Actioned + dismissed</div>
            </div>
        `;
  } catch (err) {
    row.innerHTML = `<div class="mod-empty">Could not load stats: ${escapeModText(err.message)}</div>`;
  }
}

async function loadListingReports() {
  const container = document.getElementById("reportsContent");
  const paginationEl = document.getElementById("reportsPagination");
  if (!container || !paginationEl) return;
  container.innerHTML = '<div class="loading">Loading reports...</div>';
  paginationEl.innerHTML = "";

  const statuses = reportStatusesForFilter();
  const base = {
    limit: REPORT_FETCH_LIMIT,
    sort_by: "created_at",
    order: reportsState.order,
  };
  if (reportsState.carId) base.car_id = reportsState.carId;
  if (reportsState.clientId) base.client_id = reportsState.clientId;

  try {
    const responses = await Promise.all(
      statuses.map((s) => api.getListingReports({ ...base, status: s })),
    );
    reportsState.truncated = responses.some(
      (r) => (r.total || 0) > REPORT_FETCH_LIMIT,
    );
    const merged = responses.flatMap((r) => r.reports || []);
    merged.sort((a, b) => {
      const d = new Date(a.created_at) - new Date(b.created_at);
      return reportsState.order === "asc" ? d : -d;
    });
    reportsState.rows = merged;
    renderListingReportsPage();
  } catch (err) {
    container.innerHTML = `<div class="mod-empty">Error loading reports: ${escapeModText(err.message)}</div>`;
  }
}

function renderListingReportsPage() {
  const container = document.getElementById("reportsContent");
  const paginationEl = document.getElementById("reportsPagination");
  if (!container || !paginationEl) return;

  const rows = reportsState.rows;
  if (!rows.length) {
    container.innerHTML = `<div class="mod-empty">No reports in this view.</div>`;
    paginationEl.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / MOD_PAGE_SIZE));
  if (reportsState.page > totalPages) reportsState.page = totalPages;
  const start = (reportsState.page - 1) * MOD_PAGE_SIZE;
  const pageRows = rows.slice(start, start + MOD_PAGE_SIZE);

  const body = pageRows
    .map(
      (r) => `
            <tr onclick="openListingReportDetail(${Number(r.id)})">
                <td class="mod-cell-muted">${formatModDate(r.created_at)}</td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(r.car_name || "Car #" + r.car_id)}</div>
                    <div class="mod-cell-muted">#${Number(r.car_id)}</div>
                </td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(r.client_name || "—")}</div>
                    <div class="mod-cell-muted">${escapeModText(r.client_email || "")}</div>
                </td>
                <td><div class="mod-cell-review">${escapeModText(r.reason || "—")}</div></td>
                <td>${reportStatusBadge(r.status)}</td>
            </tr>
        `,
    )
    .join("");

  const note = reportsState.truncated
    ? `<div class="mod-cell-muted" style="margin:8px 0 0;">Showing the first ${REPORT_FETCH_LIMIT} per status — narrow with the Car/Client filters.</div>`
    : "";

  container.innerHTML = `
        <div class="table-container">
            <table class="mod-table">
                <thead>
                    <tr>
                        <th>When</th>
                        <th>Car</th>
                        <th>Reporter</th>
                        <th>Reason</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        </div>${note}
    `;

  renderModPagination(
    paginationEl,
    reportsState.page,
    totalPages,
    rows.length,
    (p) => {
      reportsState.page = p;
      renderListingReportsPage();
    },
  );
}

async function openListingReportDetail(reportId) {
  modDrawerContext = { kind: "report", reportId, status: null };
  showModerationDrawer(
    "Listing report",
    '<div class="loading">Loading...</div>',
    "",
  );
  try {
    const r = await api.getListingReport(reportId);
    modDrawerContext = { kind: "report", reportId, status: r.status };
    showModerationDrawer(
      "Listing report",
      renderListingReportDetail(r),
      renderListingReportActions(r),
    );
  } catch (err) {
    showModerationDrawer(
      "Listing report",
      `<div class="mod-empty">Could not load: ${escapeModText(err.message)}</div>`,
      "",
    );
  }
}

function renderListingReportDetail(r) {
  const field = (label, value) => `
            <div class="mod-field">
                <div class="mod-field-label">${label}</div>
                <div class="mod-field-value">${value}</div>
            </div>`;
  const hostLine =
    r.host_id != null
      ? `${escapeModText(r.host_name || "Host #" + r.host_id)} <span class="mod-cell-muted">· #${Number(r.host_id)}</span>`
      : "—";
  return (
    field("Status", reportStatusBadge(r.status)) +
    field("Reason", escapeModText(r.reason || "—")) +
    field(
      "Car",
      `${escapeModText(r.car_name || "Car #" + r.car_id)} <span class="mod-cell-muted">· #${Number(r.car_id)}</span>`,
    ) +
    field("Host", hostLine) +
    field(
      "Reporter",
      `${escapeModText(r.client_name || "—")} <span class="mod-cell-muted">· #${Number(r.client_id)}</span>`,
    ) +
    field(
      "Email",
      r.client_email
        ? `<a href="mailto:${escapeModAttr(r.client_email)}">${escapeModText(r.client_email)}</a>`
        : "—",
    ) +
    field("Mobile", escapeModText(r.client_mobile_number || "—")) +
    field("Reported", formatModDate(r.created_at, true)) +
    field("Last updated", r.updated_at ? formatModDate(r.updated_at, true) : "—") +
    field(
      "Details",
      `<div class="review-text">${escapeModText(r.details || "— No additional details —")}</div>`,
    )
  );
}

function renderListingReportActions(r) {
  const btn = (status, label, cls) =>
    `<button class="${cls}" ${r.status === status ? "disabled" : ""} onclick="setListingReportStatus(${Number(r.id)}, '${status}')">${label}</button>`;
  return (
    btn("reviewing", "Start review", "btn btn-secondary") +
    btn("actioned", "Mark actioned", "btn btn-primary") +
    btn("dismissed", "Dismiss", "btn btn-secondary") +
    `<button class="btn-danger" style="margin-left:auto;" onclick="deleteListingReportFromDrawer(${Number(r.id)})">Delete</button>`
  );
}

async function setListingReportStatus(reportId, status) {
  const footer = document.getElementById("modDrawerFooter");
  if (footer)
    footer.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    const updated = await api.updateListingReportStatus(reportId, status);
    modDrawerContext = { kind: "report", reportId, status: updated.status };
    showModerationDrawer(
      "Listing report",
      renderListingReportDetail(updated),
      renderListingReportActions(updated),
    );
    loadListingReports();
    loadListingReportStats();
  } catch (err) {
    if (footer)
      footer.querySelectorAll("button").forEach((b) => (b.disabled = false));
    const msg = /status/i.test(err.message || "")
      ? "Invalid status"
      : err.message || "Update failed";
    alert("Error updating report: " + msg);
  }
}

async function deleteListingReportFromDrawer(reportId) {
  if (
    !confirm(
      `Permanently delete report #${reportId}? This cannot be undone — prefer "Dismiss" to keep the record.`,
    )
  )
    return;
  const footer = document.getElementById("modDrawerFooter");
  const delBtn = footer ? footer.querySelector(".btn-danger") : null;
  if (delBtn) {
    delBtn.disabled = true;
    delBtn.textContent = "Deleting…";
  }
  try {
    await api.deleteListingReport(reportId);
    closeModerationDrawer();
    loadListingReports();
    loadListingReportStats();
  } catch (err) {
    if (delBtn) {
      delBtn.disabled = false;
      delBtn.textContent = "Delete";
    }
    alert("Error deleting report: " + err.message);
  }
}

function reportStatusBadge(status) {
  const s = (status || "unknown").toLowerCase();
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return `<span class="mod-badge report-${escapeModAttr(s)}">${escapeModText(label)}</span>`;
}
