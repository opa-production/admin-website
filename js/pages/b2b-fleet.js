// js/pages/b2b-fleet.js — B2B fleet on the Ardena consumer app.
// Classic script (not a module): top-level functions and vars are global by design.
//
// One row per fleet **vehicle**, not per marketplace listing — backed by
// /admin/b2b/fleet/cars. A business that has added twelve cars and listed none
// has zero listings, and listing every one of those vehicles is the point: that
// is what a partner looks like all through onboarding, and it used to show here
// as nothing but a count.
//
// Whether a vehicle is actually rentable in the app comes down to two
// independent gates:
//
//   1. the business's intent  — they published the listing
//   2. Ardena's review        — we approved the car
//
// Only the second is ours to move, and "Make visible" moves it. When a car is
// still not on the app afterwards, `blocked_by` on the row says why, and the
// server's message repeats it — so approving something the business has hidden
// never reads as "it's live now".

// ==================== B2B FLEET ====================

let b2bFleetState = "";
let b2bFleetPage = 1;
let b2bFleetSearch = "";
let b2bFleetStats = null;
// vehicle_id -> row, from the last render. The action handlers read the plate
// from here rather than taking it as an onclick argument: `escapeHtml` (which
// is what the rest of the dashboard uses for these) does not escape quotes, so
// any string interpolated into an inline handler is a quote away from breaking
// the attribute. Passing only the integer id removes that surface entirely.
let b2bFleetRows = {};
const B2B_FLEET_PAGE_SIZE = 20;

// Filter options. "" is All. Order = display order; the count for each comes
// from /stats, whose predicates are the same ones the list filters on, so an
// option reading 4 always shows 4 rows.
const B2B_FLEET_FILTERS = [
  { key: "", label: "All vehicles", count: "total_vehicles" },
  { key: "pending_review", label: "Awaiting our review", count: "pending_review" },
  { key: "live", label: "On the app", count: "live" },
  { key: "hidden_by_business", label: "Hidden by business", count: "hidden_by_business" },
  { key: "rejected", label: "Rejected", count: "rejected" },
  { key: "not_submitted", label: "Listing unfinished", count: "not_submitted" },
  { key: "not_listed", label: "Not offered to the app", count: "not_listed" },
];

const B2B_FLEET_REVIEW_LABEL = {
  approved: "Approved",
  pending_review: "Awaiting review",
  rejected: "Rejected",
  not_submitted: "Listing unfinished",
  not_listed: "Not offered",
};

// Why a car isn't on the app, in words an admin can act on. Keyed on the
// server's `blocked_by`.
const B2B_FLEET_BLOCKED_LABEL = {
  not_listed: "Not offered to the app",
  not_submitted: "Listing unfinished",
  review: "Waiting on our review",
  business: "Business has it hidden",
  admin_hidden: "Hidden manually in Cars",
};

function initB2BFleetPage() {
  const search = document.getElementById("b2bFleetSearch");
  if (search) {
    let t;
    search.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        b2bFleetSearch = search.value.trim();
        b2bFleetPage = 1;
        loadB2BFleet();
      }, 400);
    };
  }
  const filter = document.getElementById("b2bFleetStateFilter");
  if (filter) {
    filter.onchange = () => {
      b2bFleetState = filter.value;
      b2bFleetPage = 1;
      loadB2BFleet();
    };
  }
  loadB2BFleet();
}

function goToB2BFleetPage(page) {
  b2bFleetPage = page;
  loadB2BFleet();
}

async function loadB2BFleet() {
  const content = document.getElementById("b2bFleetContent");
  if (!content) return;

  const params = {
    skip: (b2bFleetPage - 1) * B2B_FLEET_PAGE_SIZE,
    limit: B2B_FLEET_PAGE_SIZE,
  };
  if (b2bFleetState) params.state = b2bFleetState;
  if (b2bFleetSearch) params.search = b2bFleetSearch;

  content.innerHTML = '<div class="loading">Loading fleet listings...</div>';

  // Stats and rows are fetched together: the tab counts and the table are one
  // view of the same data and shouldn't land a second apart.
  let data;
  try {
    const [stats, listing] = await Promise.all([
      api.getB2BFleetStats(),
      api.getB2BFleetCars(params),
    ]);
    b2bFleetStats = stats;
    data = listing;
  } catch (error) {
    console.error("Error loading B2B fleet:", error);
    content.innerHTML = `<div class="empty-state">Error loading fleet listings: ${escapeHtml(error.message)}</div>`;
    return;
  }

  renderB2BFleetStats();
  renderB2BFleetFilter();

  b2bFleetRows = {};
  (data.cars || []).forEach((c) => {
    b2bFleetRows[c.vehicle_id] = c;
  });

  if (!data.cars || data.cars.length === 0) {
    content.innerHTML = `<div class="empty-state">${escapeHtml(b2bFleetEmptyMessage())}</div>`;
    document.getElementById("b2bFleetPagination").innerHTML = "";
    return;
  }

  content.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Vehicle</th>
                        <th>Business</th>
                        <th>Rate</th>
                        <th>Review</th>
                        <th>On the app</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.cars.map(renderB2BFleetRow).join("")}
                </tbody>
            </table>
        </div>
    `;

  renderB2BFleetPagination(data.total, data.limit, data.skip);
}

function b2bFleetEmptyMessage() {
  if (b2bFleetSearch) return `No fleet vehicles match "${b2bFleetSearch}"`;
  if (b2bFleetState === "pending_review") return "Nothing waiting on review — the queue is clear";
  if (b2bFleetState) return "No fleet vehicles in this state";
  return "No business account has added a vehicle yet";
}

function renderB2BFleetStats() {
  const el = document.getElementById("b2bFleetStats");
  if (!el || !b2bFleetStats) return;
  const s = b2bFleetStats;
  const card = (label, value, sub) => `
        <div class="mod-stat-card">
            <div class="mod-stat-label">${label}</div>
            <div class="mod-stat-value">${value}</div>
            ${sub ? `<div class="mod-stat-sub">${sub}</div>` : ""}
        </div>`;
  el.innerHTML = [
    card("On the app", s.live, `of ${s.total_vehicles} fleet vehicle${s.total_vehicles === 1 ? "" : "s"}`),
    card("Awaiting review", s.pending_review, s.pending_review ? "needs a decision" : "queue is clear"),
    card("Hidden by business", s.hidden_by_business, "approved, but they pulled it"),
    card("Not offered", s.not_listed, `never sent to the app · ${s.businesses} business${s.businesses === 1 ? "" : "es"}`),
  ].join("");
}

// Counts live in the option labels, so the dropdown answers "how many are
// waiting on us?" without having to be opened and clicked through.
function renderB2BFleetFilter() {
  const el = document.getElementById("b2bFleetStateFilter");
  if (!el) return;
  el.innerHTML = B2B_FLEET_FILTERS.map((f) => {
    const n = b2bFleetStats ? b2bFleetStats[f.count] : null;
    const badge = n === null || n === undefined ? "" : ` (${n})`;
    return `<option value="${f.key}">${f.label}${badge}</option>`;
  }).join("");
  el.value = b2bFleetState;
}

function renderB2BFleetRow(car) {
  const plate = escapeHtml(car.plate);
  const year = car.year ? `${car.year} ` : "";

  const reviewClass =
    car.review === "approved" ? "active" : car.review === "rejected" ? "inactive" : "pending";
  const reviewLabel = B2B_FLEET_REVIEW_LABEL[car.review] || car.review;
  const reason =
    car.review === "rejected" && car.rejection_reason
      ? `<br><small title="${escapeHtmlAttr(car.rejection_reason)}">${escapeHtml(car.rejection_reason.slice(0, 60))}${car.rejection_reason.length > 60 ? "…" : ""}</small>`
      : "";

  const live = car.is_live
    ? '<span class="status-badge active">Visible</span>'
    : `<span class="status-badge inactive">Hidden</span><br><small>${escapeHtml(B2B_FLEET_BLOCKED_LABEL[car.blocked_by] || "—")}</small>`;

  // No Car row means nothing exists on the app to approve or reject — the
  // buttons would only produce a 400 the admin can't act on. The two reasons
  // need different words: one business hasn't started, the other hasn't finished.
  let actions;
  if (!car.car_id) {
    const why = car.listing_id
      ? "The business is still filling in the listing"
      : "The business hasn't offered this vehicle to the app";
    actions = `<span title="${escapeHtmlAttr(why)}">—</span>`;
  } else {
    const approve =
      car.review === "approved"
        ? ""
        : `<button class="btn btn-small btn-primary" onclick="approveB2BFleetCar(${car.vehicle_id})">Make visible</button> `;
    const reject =
      car.review === "rejected"
        ? ""
        : `<button class="btn btn-small btn-secondary" onclick="rejectB2BFleetCar(${car.vehicle_id})">Remove</button>`;
    actions = approve + reject || "—";
  }

  // The workspace's own standing is worth showing here: an unverified or
  // suspended business shouldn't have cars approved onto the app, and this is
  // where an admin would otherwise approve one without noticing.
  const bizFlags = [];
  if (!car.business_verified) bizFlags.push("KYB pending");
  if (!car.business_active) bizFlags.push("suspended");

  return `<tr>
        <td>
            <strong>${plate}</strong><br>
            <small>${year}${escapeHtml(car.name)} · ${escapeHtml(car.category)}</small>
        </td>
        <td>
            ${escapeHtml(car.business_name)}
            ${bizFlags.length ? `<br><small class="b2b-fleet-warn">${escapeHtml(bizFlags.join(" · "))}</small>` : ""}
        </td>
        <td>${fmtKes(car.daily_rate)}<small>/day</small></td>
        <td><span class="status-badge ${reviewClass}">${reviewLabel}</span>${reason}</td>
        <td>${live}</td>
        <td>${actions}</td>
    </tr>`;
}

function renderB2BFleetPagination(total, limit, skip) {
  const el = document.getElementById("b2bFleetPagination");
  if (!el) return;
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }
  const current = Math.floor(skip / limit) + 1;
  el.innerHTML = `
        <button class="btn btn-small btn-secondary" ${current === 1 ? "disabled" : ""} onclick="goToB2BFleetPage(${current - 1})">Previous</button>
        <span>Page ${current} of ${totalPages} (${total} total)</span>
        <button class="btn btn-small btn-secondary" ${current === totalPages ? "disabled" : ""} onclick="goToB2BFleetPage(${current + 1})">Next</button>
    `;
}

// ---------- Actions ----------

async function approveB2BFleetCar(vehicleId) {
  const plate = (b2bFleetRows[vehicleId] || {}).plate || "this vehicle";
  const ok = await uiConfirm(
    `Approve ${plate} for the Ardena app? Renters will be able to book it as soon as the business has it published.`,
    { title: "Make visible", confirmText: "Make visible", danger: false },
  );
  if (!ok) return;
  try {
    const result = await api.approveB2BFleetCar(vehicleId);
    // The server says whether it actually went live — a car the business has
    // hidden is approved but still not on the app, and the message is the only
    // thing that distinguishes the two outcomes.
    uiToast(result.message, result.car.is_live ? "success" : "info");
    loadB2BFleet();
  } catch (error) {
    uiToast(error.message || "Could not approve this vehicle", "error");
  }
}

async function rejectB2BFleetCar(vehicleId) {
  const plate = (b2bFleetRows[vehicleId] || {}).plate || "this vehicle";
  const reason = await uiPrompt(
    `Why is ${plate} being removed from the Ardena app? The business sees this in their dashboard.`,
    { title: "Remove from app", multiline: true, confirmText: "Remove", placeholder: "e.g. Cover photo doesn't show the vehicle" },
  );
  if (reason === null) return;
  if (!reason.trim()) {
    uiToast("A reason is required — it's what the business sees", "error");
    return;
  }
  try {
    const result = await api.rejectB2BFleetCar(vehicleId, reason.trim());
    uiToast(result.message, "success");
    loadB2BFleet();
  } catch (error) {
    uiToast(error.message || "Could not remove this vehicle", "error");
  }
}
