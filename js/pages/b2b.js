// js/pages/b2b.js — B2B (Ardena for Business) onboarding & credential management.
// Classic script (not a module): top-level functions and vars are global by design.
//
// Three tabs backed by /admin/b2b/... (see b2b.md §1):
//  - Access Requests: review the public "Request access" form submissions;
//    approving one creates the business workspace + Owner login and emails the
//    credentials (also shown once in a modal for manual handover).
//  - Businesses: workspaces, their users, password resets, (de)activation,
//    plan, KYB and permanent deletion.
//  - Funnel: where workspaces stall between applying and taking app bookings.

// ==================== B2B MANAGEMENT ====================

let currentB2BTab = "requests";
let currentB2BRequestPage = 1;
let currentB2BRequestStatus = "pending";
let currentB2BRequestSearch = "";
// Last rendered businesses, by id — the delete flow needs the name and counts
// without threading them through inline onclick attributes.
let b2bBusinessRows = {};
let currentB2BBusinessPage = 1;
let currentB2BBusinessSearch = "";
const B2B_PAGE_SIZE = 20;

function initB2BPage() {
  const statusFilter = document.getElementById("b2bRequestStatusFilter");
  if (statusFilter) {
    statusFilter.value = currentB2BRequestStatus;
    statusFilter.onchange = () => {
      currentB2BRequestStatus = statusFilter.value;
      currentB2BRequestPage = 1;
      loadB2BRequests();
    };
  }
  const requestSearch = document.getElementById("b2bRequestSearch");
  if (requestSearch) {
    let t;
    requestSearch.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        currentB2BRequestSearch = requestSearch.value.trim();
        currentB2BRequestPage = 1;
        loadB2BRequests();
      }, 400);
    };
  }
  const businessSearch = document.getElementById("b2bBusinessSearch");
  if (businessSearch) {
    let t;
    businessSearch.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        currentB2BBusinessSearch = businessSearch.value.trim();
        currentB2BBusinessPage = 1;
        loadB2BBusinesses();
      }, 400);
    };
  }
  switchB2BTab(currentB2BTab);
}

function switchB2BTab(tab) {
  currentB2BTab = tab;
  const requestsTab = document.getElementById("b2bRequestsTab");
  const businessesTab = document.getElementById("b2bBusinessesTab");
  const funnelTab = document.getElementById("b2bFunnelTab");
  const requestsPanel = document.getElementById("b2bRequestsPanel");
  const businessesPanel = document.getElementById("b2bBusinessesPanel");
  const funnelPanel = document.getElementById("b2bFunnelPanel");
  if (!requestsPanel || !businessesPanel) return;
  requestsTab.classList.toggle("active", tab === "requests");
  businessesTab.classList.toggle("active", tab === "businesses");
  if (funnelTab) funnelTab.classList.toggle("active", tab === "funnel");
  requestsPanel.style.display = tab === "requests" ? "block" : "none";
  businessesPanel.style.display = tab === "businesses" ? "block" : "none";
  if (funnelPanel) funnelPanel.style.display = tab === "funnel" ? "block" : "none";
  if (tab === "requests") {
    loadB2BRequests();
  } else if (tab === "funnel") {
    loadB2BFunnel();
  } else {
    loadB2BBusinesses();
  }
}

// ---------- Access requests ----------

async function loadB2BRequests() {
  const content = document.getElementById("b2bRequestsContent");
  if (!content) return;
  try {
    content.innerHTML = '<div class="loading">Loading access requests...</div>';
    const params = {
      skip: (currentB2BRequestPage - 1) * B2B_PAGE_SIZE,
      limit: B2B_PAGE_SIZE,
    };
    if (currentB2BRequestStatus) params.status = currentB2BRequestStatus;
    if (currentB2BRequestSearch) params.search = currentB2BRequestSearch;
    const data = await api.getB2BAccessRequests(params);

    if (data.requests && data.requests.length > 0) {
      content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Reference</th>
                                <th>Business</th>
                                <th>Contact</th>
                                <th>Fleet</th>
                                <th>Status</th>
                                <th>Submitted</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.requests
                              .map((r) => {
                                const statusClass =
                                  r.status === "approved"
                                    ? "active"
                                    : "inactive";
                                let actions = "—";
                                if (r.status === "pending") {
                                  actions = `<button class="btn btn-small btn-primary" onclick="openB2BApproveModal(${r.id}, '${escapeHtml(r.reference)}', '${escapeHtml(r.business_name)}', '${escapeHtml(r.email)}')">Approve</button>
                                        <button class="btn btn-small btn-secondary" onclick="openB2BRejectModal(${r.id}, '${escapeHtml(r.reference)}')">Reject</button>`;
                                } else if (r.status === "rejected" && r.rejection_reason) {
                                  actions = `<span title="${escapeHtml(r.rejection_reason)}">Reason ℹ</span>`;
                                }
                                return `<tr>
                                    <td><strong>${escapeHtml(r.reference)}</strong></td>
                                    <td>${escapeHtml(r.business_name)}</td>
                                    <td>${escapeHtml(r.contact_name)}<br><small>${escapeHtml(r.email)} · ${escapeHtml(r.phone)}</small></td>
                                    <td>${escapeHtml(r.fleet_size)}</td>
                                    <td><span class="status-badge ${statusClass}">${r.status}</span></td>
                                    <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                                    <td>${actions}</td>
                                </tr>`;
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
      renderB2BPagination("b2bRequestsPagination", data.total, data.limit, data.skip, "goToB2BRequestPage");
    } else {
      content.innerHTML = '<div class="empty-state">No access requests found</div>';
      document.getElementById("b2bRequestsPagination").innerHTML = "";
    }
  } catch (error) {
    console.error("Error loading B2B access requests:", error);
    content.innerHTML = `<div class="empty-state">Error loading access requests: ${error.message}</div>`;
  }
}

function goToB2BRequestPage(page) {
  currentB2BRequestPage = page;
  loadB2BRequests();
}

// ---------- Businesses ----------

async function loadB2BBusinesses() {
  const content = document.getElementById("b2bBusinessesContent");
  if (!content) return;
  try {
    content.innerHTML = '<div class="loading">Loading businesses...</div>';
    const params = {
      skip: (currentB2BBusinessPage - 1) * B2B_PAGE_SIZE,
      limit: B2B_PAGE_SIZE,
    };
    if (currentB2BBusinessSearch) params.search = currentB2BBusinessSearch;
    const data = await api.getB2BBusinesses(params);

    b2bBusinessRows = {};
    (data.businesses || []).forEach((b) => {
      b2bBusinessRows[b.id] = b;
    });

    if (data.businesses && data.businesses.length > 0) {
      content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Owner Email</th>
                                <th>Users</th>
                                <th>Cars</th>
                                <th>Plan</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.businesses
                              .map((b) => {
                                const toggle = b.is_active
                                  ? uiIconButton("deactivate", "Deactivate business", `toggleB2BBusiness(${b.id}, false)`)
                                  : uiIconButton("activate", "Activate business", `toggleB2BBusiness(${b.id}, true)`, "primary");
                                return `<tr>
                                    <td>${b.id}</td>
                                    <td><strong>${escapeHtml(b.name)}</strong></td>
                                    <td>${escapeHtml(b.owner_email || "—")}</td>
                                    <td>${b.users_count}</td>
                                    <td>${b2bBusinessFleetCell(b)}</td>
                                    <td>${b2bBusinessPlanCell(b)}</td>
                                    <td>${escapeHtml(b.location || "—")}</td>
                                    <td><span class="status-badge ${b.is_active ? "active" : "inactive"}">${b.is_active ? "Active" : "Inactive"}</span>${b.verified_since ? "" : '<br><small class="b2b-fleet-warn">KYB not verified</small>'}</td>
                                    <td>${b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}</td>
                                    <td>
                                        <div class="row-actions">
                                            ${uiIconButton("users", "Manage users", `openB2BUsersModal(${b.id}, '${escapeHtml(b.name)}')`, "primary")}
                                            ${canManageB2BCredentials() ? uiIconButton("key", "Reset owner password", `resetB2BBusinessOwner(${b.id}, '${escapeHtml(b.name)}')`) : ""}
                                            ${canManageB2BCredentials() ? uiIconButton("plan", "Set plan", `editB2BBusinessPlan(${b.id})`) : ""}
                                            ${canManageB2BCredentials() ? (b.verified_since ? uiIconButton("shieldOff", "Remove KYB verification", `toggleB2BBusinessVerified(${b.id}, false)`) : uiIconButton("shield", "Mark KYB verified", `toggleB2BBusinessVerified(${b.id}, true)`, "primary")) : ""}
                                            ${toggle}
                                            ${canManageAdmins() ? uiIconButton("trash", "Delete business", `deleteB2BBusiness(${b.id})`, "danger") : ""}
                                        </div>
                                    </td>
                                </tr>`;
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
      renderB2BPagination("b2bBusinessesPagination", data.total, data.limit, data.skip, "goToB2BBusinessPage");
    } else {
      content.innerHTML = '<div class="empty-state">No businesses yet — approve an access request or create one directly.</div>';
      document.getElementById("b2bBusinessesPagination").innerHTML = "";
    }
  } catch (error) {
    console.error("Error loading B2B businesses:", error);
    content.innerHTML = `<div class="empty-state">Error loading businesses: ${error.message}</div>`;
  }
}

// Fleet size, and how much of it renters can actually see. Both numbers, because
// either alone misleads: 12 cars sounds like a working partner until you see 0
// of them are on the app, and "0 live" sounds like a dead account until you see
// they have not added anything yet.
//
// `live_on_app_count` is counted off Car.is_hidden — what the consumer queries
// actually filter on — not off the listing status, so a car the business
// published but we have not approved is correctly not counted as live.
function b2bBusinessFleetCell(b) {
  const total = b.vehicles_count || 0;
  if (total === 0) return '<span title="No vehicles added yet">0</span>';
  const live = b.live_on_app_count || 0;
  const sub =
    live === 0
      ? '<small class="b2b-fleet-warn">none on the app</small>'
      : `<small>${live} on the app</small>`;
  return `<strong>${total}</strong><br>${sub}`;
}

// The plan in effect, and until when. "Free period" is full Fleet access a
// workspace isn't paying for: an old founding trial or goodwill set here.
const B2B_PLAN_CELL = {
  paid: { label: "Fleet", cls: "active" },
  custom: { label: "Enterprise", cls: "active" },
  trial: { label: "Free period", cls: "pending" },
  free: { label: "Starter", cls: "inactive" },
};

function b2bBusinessPlanCell(b) {
  const meta = B2B_PLAN_CELL[b.plan_source] || B2B_PLAN_CELL.free;
  const until = b.plan_until
    ? `<br><small>until ${new Date(b.plan_until).toLocaleDateString()}</small>`
    : "";
  return `<span class="status-badge ${meta.cls}">${meta.label}</span>${until}`;
}

// A date picked in the form means "through the end of that day" in Nairobi.
function b2bEndOfDayIso(dateValue) {
  return dateValue ? `${dateValue}T23:59:59+03:00` : null;
}

// Enterprise terms, a paid-until date or a free period, set by hand. Nothing
// is charged here; a wallet is only ever debited by the business's own upgrade.
async function editB2BBusinessPlan(id) {
  const business = b2bBusinessRows[id] || {};
  const current = (B2B_PLAN_CELL[business.plan_source] || B2B_PLAN_CELL.free).label;
  const values = await uiForm({
    title: `Plan for ${business.name || "this business"}`,
    message: `Currently on ${current}${business.plan_until ? " until " + new Date(business.plan_until).toLocaleDateString() : ""}. Nothing is charged from here. Leave a field empty to keep it as it is.`,
    confirmText: "Save plan",
    fields: [
      {
        name: "plan",
        label: "Plan",
        type: "select",
        value: "",
        options: [
          { value: "", label: "Keep as it is" },
          { value: "starter", label: "Starter (free, 3 cars)" },
          { value: "fleet", label: "Fleet" },
          { value: "enterprise", label: "Enterprise (custom terms)" },
        ],
      },
      {
        name: "paid_until",
        label: "Paid until",
        type: "date",
        hint: "End of a Fleet or Enterprise period given without a wallet charge. Fleet needs a date to take effect.",
      },
      {
        name: "free_until",
        label: "Free period until",
        type: "date",
        hint: "Full Fleet access without paying, as goodwill. It never turns into a charge.",
      },
      {
        name: "clear",
        label: "Remove",
        type: "checkboxes",
        options: [
          { value: "paid", label: "Paid-until date" },
          { value: "free", label: "Free period" },
        ],
      },
      {
        name: "note",
        label: "Why",
        type: "textarea",
        required: true,
        maxLength: 300,
        placeholder: "Recorded with your name, e.g. Enterprise terms agreed with the owner",
      },
    ],
    validate: (v) => {
      if (v.note.length < 3) return "Say why in at least 3 characters.";
      if (!v.plan && !v.paid_until && !v.free_until && !v.clear.length) {
        return "Nothing to change yet.";
      }
      if (v.paid_until && v.clear.includes("paid")) return "Set a paid-until date or remove it, not both.";
      if (v.free_until && v.clear.includes("free")) return "Set a free period or remove it, not both.";
      return null;
    },
  });
  if (!values) return;

  const body = { note: values.note };
  if (values.plan) body.plan = values.plan;
  if (values.paid_until) body.paid_until = b2bEndOfDayIso(values.paid_until);
  if (values.clear.includes("paid")) body.paid_until = null;
  if (values.free_until) body.trial_ends_at = b2bEndOfDayIso(values.free_until);
  if (values.clear.includes("free")) body.trial_ends_at = null;

  try {
    const result = await api.setB2BBusinessPlan(id, body);
    const label = (B2B_PLAN_CELL[result.source] || B2B_PLAN_CELL.free).label;
    uiToast(`${business.name || "Business"} is now on ${label}.`, "success");
    loadB2BBusinesses();
  } catch (error) {
    uiToast(`Couldn't set the plan: ${error.message}`, "error");
  }
}

// KYB. Approving a workspace already verifies it; this is for taking that
// back (it stops the business listing on the app and takes down its trust
// page) and for restoring it.
async function toggleB2BBusinessVerified(id, verify) {
  const name = (b2bBusinessRows[id] || {}).name || "this business";
  if (!verify) {
    const ok = await uiConfirm(
      `Remove KYB verification from ${name}? Its public trust page goes offline and it can't publish cars to the Ardena app until it is verified again.`,
      { title: "Remove verification", confirmText: "Remove verification", danger: true },
    );
    if (!ok) return;
  }
  try {
    if (verify) await api.verifyB2BBusiness(id);
    else await api.unverifyB2BBusiness(id);
    uiToast(`${name} is ${verify ? "now KYB verified" : "no longer verified"}.`, "success");
    loadB2BBusinesses();
  } catch (error) {
    uiToast(`Couldn't update verification: ${error.message}`, "error");
  }
}

function goToB2BBusinessPage(page) {
  currentB2BBusinessPage = page;
  loadB2BBusinesses();
}

async function toggleB2BBusiness(id, activate) {
  const verb = activate ? "activate" : "deactivate";
  const name = (b2bBusinessRows[id] || {}).name || "this business";

  if (!activate) {
    const ok = await uiConfirm(
      `Deactivate ${name}? All its users lose dashboard access immediately.`,
      { title: "Deactivate business", confirmText: "Deactivate", danger: true },
    );
    if (!ok) return;
  }

  try {
    if (activate) {
      await api.activateB2BBusiness(id);
    } else {
      await api.deactivateB2BBusiness(id);
    }
    uiToast(`Business ${activate ? "activated" : "deactivated"}.`, "success");
    loadB2BBusinesses();
  } catch (error) {
    uiToast(`Failed to ${verb} business: ${error.message}`, "error");
  }
}

// Permanent removal of a workspace, its users and its fleet. Deactivate is the
// reversible option; this one is not, so it asks for the business name to be
// typed rather than settling for an OK/Cancel an admin can click through.
async function deleteB2BBusiness(id) {
  const business = b2bBusinessRows[id] || {};
  const name = business.name || "";

  const typed = await uiPrompt(
    `This permanently deletes ${name || "this business"}, its ${business.users_count ?? 0} user login(s) and its ${business.vehicles_count ?? 0} vehicle(s). This cannot be undone.\n\nType the business name to confirm.`,
    {
      title: "Delete business",
      confirmText: "Delete permanently",
      placeholder: name,
      danger: true,
    },
  );
  if (typed === null) return;

  if (typed.trim() !== name) {
    uiToast("The name didn't match — nothing was deleted.", "error");
    return;
  }

  try {
    await api.deleteB2BBusiness(id);
    uiToast(`${name} was deleted.`, "success");
    loadB2BBusinesses();
  } catch (error) {
    uiToast(`Failed to delete business: ${error.message}`, "error");
  }
}

// ---------- Shared pagination ----------

function renderB2BPagination(elementId, total, limit, skip, goFnName) {
  const pagination = document.getElementById(elementId);
  if (!pagination) return;
  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(skip / limit) + 1;
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }
  let html = "";
  if (currentPage > 1) {
    html += `<button class="btn btn-secondary" onclick="${goFnName}(${currentPage - 1})">Previous</button>`;
  }
  html += `<span style="padding: 0 15px;">Page ${currentPage} of ${totalPages}</span>`;
  if (currentPage < totalPages) {
    html += `<button class="btn btn-secondary" onclick="${goFnName}(${currentPage + 1})">Next</button>`;
  }
  pagination.innerHTML = html;
}

// ---------- Approve modal ----------

function openB2BApproveModal(id, reference, businessName, email) {
  const modal = document.getElementById("b2bApproveModal");
  if (!modal) return;
  document.getElementById("b2bApproveRequestId").value = id;
  document.getElementById("b2bApproveSummary").innerHTML =
    `Approve <strong>${escapeHtml(reference)}</strong> — this creates the <strong>${escapeHtml(businessName)}</strong> workspace with an Owner login for <strong>${escapeHtml(email)}</strong>. A temporary password is generated and emailed automatically.`;
  document.getElementById("b2bApproveError").textContent = "";
  modal.style.display = "flex";
}

function closeB2BApproveModal() {
  const modal = document.getElementById("b2bApproveModal");
  if (modal) modal.style.display = "none";
}

async function confirmB2BApprove() {
  const id = document.getElementById("b2bApproveRequestId")?.value;
  const errEl = document.getElementById("b2bApproveError");
  const btn = document.getElementById("b2bApproveConfirmBtn");
  if (!id) return;
  if (errEl) errEl.textContent = "";
  if (btn) btn.disabled = true;
  try {
    const result = await api.approveB2BAccessRequest(id, {});
    closeB2BApproveModal();
    showB2BCredentialsModal(result);
    loadB2BRequests();
  } catch (error) {
    if (errEl) errEl.textContent = error.message || "Approval failed";
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- Reject modal ----------

function openB2BRejectModal(id, reference) {
  const modal = document.getElementById("b2bRejectModal");
  if (!modal) return;
  document.getElementById("b2bRejectRequestId").value = id;
  document.getElementById("b2bRejectSummary").innerHTML =
    `Reject <strong>${escapeHtml(reference)}</strong>. The reason is kept for internal records.`;
  document.getElementById("b2bRejectReason").value = "";
  document.getElementById("b2bRejectError").textContent = "";
  modal.style.display = "flex";
}

function closeB2BRejectModal() {
  const modal = document.getElementById("b2bRejectModal");
  if (modal) modal.style.display = "none";
}

async function confirmB2BReject() {
  const id = document.getElementById("b2bRejectRequestId")?.value;
  const reason = document.getElementById("b2bRejectReason")?.value.trim();
  const errEl = document.getElementById("b2bRejectError");
  const btn = document.getElementById("b2bRejectConfirmBtn");
  if (!id) return;
  if (errEl) errEl.textContent = "";
  if (btn) btn.disabled = true;
  try {
    await api.rejectB2BAccessRequest(id, reason || null);
    closeB2BRejectModal();
    loadB2BRequests();
  } catch (error) {
    if (errEl) errEl.textContent = error.message || "Rejection failed";
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- Create business modal ----------

function showCreateB2BBusinessModal() {
  const modal = document.getElementById("b2bCreateModal");
  if (!modal) return;
  document.getElementById("b2bCreateForm").reset();
  document.getElementById("b2bCreateError").textContent = "";
  modal.style.display = "flex";
}

function closeB2BCreateModal() {
  const modal = document.getElementById("b2bCreateModal");
  if (modal) modal.style.display = "none";
}

async function saveB2BBusiness(event) {
  event.preventDefault();
  const errEl = document.getElementById("b2bCreateError");
  const btn = document.getElementById("b2bCreateSaveBtn");
  if (errEl) errEl.textContent = "";
  if (btn) btn.disabled = true;
  try {
    const result = await api.createB2BBusiness({
      business_name: document.getElementById("b2bCreateName").value.trim(),
      location: document.getElementById("b2bCreateLocation").value.trim() || null,
      owner_name: document.getElementById("b2bCreateOwnerName").value.trim(),
      owner_email: document.getElementById("b2bCreateOwnerEmail").value.trim(),
    });
    closeB2BCreateModal();
    showB2BCredentialsModal(result);
    if (currentB2BTab === "businesses") loadB2BBusinesses();
  } catch (error) {
    if (errEl) errEl.textContent = error.message || "Creation failed";
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- Credentials modal (shown once after approve/create/reset) ----------

function showB2BCredentialsModal(result) {
  const modal = document.getElementById("b2bCredentialsModal");
  if (!modal) return;
  const emailBadge = result.email_sent
    ? '<span class="status-badge active">Email sent</span>'
    : '<span class="status-badge inactive">Email failed — share manually</span>';
  document.getElementById("b2bCredentialsBody").innerHTML = `
        <p style="margin-bottom: 12px;">${escapeHtml(result.message)} ${emailBadge}</p>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 8px;">
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Business</strong></td><td>${escapeHtml(result.business.name)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Login email</strong></td><td>${escapeHtml(result.user.email)}</td></tr>
            <tr><td style="padding: 6px 12px 6px 0;"><strong>Temporary password</strong></td>
                <td><code id="b2bTempPassword" style="background:#f2f2f2;padding:4px 8px;border-radius: 0;font-size:15px;">${escapeHtml(result.temp_password)}</code>
                    <button class="btn btn-small btn-secondary" style="margin-left:8px;" onclick="copyB2BTempPassword()">Copy</button></td></tr>
        </table>
        <p style="font-size: 13px; color: #666;">This password is shown only once and is not stored in plaintext. The owner should change it after first sign-in.</p>
    `;
  modal.style.display = "flex";
}

function closeB2BCredentialsModal() {
  const modal = document.getElementById("b2bCredentialsModal");
  if (!modal) return;
  modal.style.display = "none";
  // Don't leave the password sitting in the DOM after the modal is dismissed.
  const body = document.getElementById("b2bCredentialsBody");
  if (body) body.innerHTML = "";
}

function copyB2BTempPassword() {
  const el = document.getElementById("b2bTempPassword");
  if (!el) return;
  navigator.clipboard
    .writeText(el.textContent)
    .then(() => uiToast("Password copied to clipboard", "success"))
    .catch(() => uiToast("Could not copy — select and copy manually", "error"));
}

// ---------- Business users modal ----------

async function openB2BUsersModal(businessId, businessName) {
  const modal = document.getElementById("b2bUsersModal");
  if (!modal) return;
  document.getElementById("b2bUsersModalTitle").textContent = `Users — ${businessName}`;
  const body = document.getElementById("b2bUsersModalBody");
  body.innerHTML = '<div class="loading">Loading users...</div>';
  modal.style.display = "flex";
  try {
    const users = await api.getB2BBusinessUsers(businessId);
    if (!users.length) {
      body.innerHTML = '<div class="empty-state">No users</div>';
      return;
    }
    body.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last active</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${users
                          .map((u) => {
                            const toggle = u.is_active
                              ? `<button class="btn btn-small btn-secondary" onclick="toggleB2BUser(${u.id}, false, ${businessId}, '${escapeHtml(businessName)}')">Deactivate</button>`
                              : `<button class="btn btn-small btn-primary" onclick="toggleB2BUser(${u.id}, true, ${businessId}, '${escapeHtml(businessName)}')">Activate</button>`;
                            return `<tr>
                                <td>${escapeHtml(u.name)}</td>
                                <td>${escapeHtml(u.email)}</td>
                                <td>${escapeHtml(u.role)}</td>
                                <td><span class="status-badge ${u.is_active ? "active" : "inactive"}">${u.is_active ? "Active" : "Inactive"}</span></td>
                                <td>${u.last_active_at ? new Date(u.last_active_at).toLocaleString() : "Never"}</td>
                                <td>
                                    <button class="btn btn-small btn-primary" onclick="resetB2BUserPassword(${u.id})">Reset password</button>
                                    ${toggle}
                                </td>
                            </tr>`;
                          })
                          .join("")}
                    </tbody>
                </table>
            </div>
        `;
  } catch (error) {
    body.innerHTML = `<div class="empty-state">Error loading users: ${error.message}</div>`;
  }
}

function closeB2BUsersModal() {
  const modal = document.getElementById("b2bUsersModal");
  if (modal) modal.style.display = "none";
}

async function resetB2BUserPassword(userId) {
  const ok = await uiConfirm(
    "Reset this user's password? A new temporary password is generated, emailed to them, and shown to you once.",
    { title: "Reset password", confirmText: "Reset password", danger: false },
  );
  if (!ok) return;
  try {
    const result = await api.resetB2BUserPassword(userId);
    closeB2BUsersModal();
    showB2BCredentialsModal(result);
  } catch (error) {
    uiToast(`Password reset failed: ${error.message}`, "error");
  }
}

// The businesses table lists workspaces, not the logins inside them. Without
// this, "reset this business's password" means opening the users modal and
// picking a row — which is the moment someone resets the booking agent instead
// of the owner. The endpoint resolves the Owner login itself.
async function resetB2BBusinessOwner(businessId, businessName) {
  const ok = await uiConfirm(
    `Send a new password to the owner of ${businessName}? Their current password stops working immediately.`,
    { title: "Reset owner password", confirmText: "Reset password", danger: false },
  );
  if (!ok) return;

  try {
    showB2BCredentialsModal(await api.resetB2BBusinessOwnerPassword(businessId));
  } catch (error) {
    uiToast(error.message, "error");
    // "This business has no Owner login. Reset a specific user instead." is an
    // instruction, so follow it — open the modal the admin was told to use.
    if (/no Owner login/i.test(error.message || "")) {
      openB2BUsersModal(businessId, businessName);
    }
  }
}

async function toggleB2BUser(userId, activate, businessId, businessName) {
  try {
    if (activate) {
      await api.activateB2BUser(userId);
    } else {
      await api.deactivateB2BUser(userId);
    }
    openB2BUsersModal(businessId, businessName);
  } catch (error) {
    uiToast(`Update failed: ${error.message}`, "error");
  }
}

// ---------- Funnel ----------

const B2B_FUNNEL_STAGE_LABELS = {
  access_requests: "Applied for access",
  approved: "Approved",
  workspaces_active: "Workspace active",
  workspaces_verified: "KYB verified",
  workspaces_with_a_vehicle: "Added a vehicle",
  workspaces_with_a_listing: "Started an app listing",
  workspaces_with_a_live_listing: "Has a car live on the app",
  workspaces_with_a_marketplace_booking: "Took an app booking",
};

function b2bFunnelStageLabel(stage) {
  return B2B_FUNNEL_STAGE_LABELS[stage] || String(stage || "").replace(/_/g, " ");
}

async function loadB2BFunnel() {
  const content = document.getElementById("b2bFunnelContent");
  if (!content) return;
  const windowSelect = document.getElementById("b2bFunnelWindow");
  if (windowSelect && !windowSelect.onchange) windowSelect.onchange = loadB2BFunnel;

  try {
    content.innerHTML = '<div class="loading">Loading funnel...</div>';
    const params = {};
    if (windowSelect && windowSelect.value) params.window_days = windowSelect.value;
    const [funnel, businesses] = await Promise.all([
      api.getB2BFunnel(params),
      api.getB2BFunnelBusinesses({ limit: 100 }),
    ]);

    const stages = funnel.stages || [];
    const top = stages.length ? stages[0].count || 0 : 0;
    const stageRows = stages
      .map((stage) => {
        const share = top ? Math.round(((stage.count || 0) / top) * 100) : 0;
        const step =
          stage.conversion_from_previous == null
            ? "—"
            : Math.round(stage.conversion_from_previous * 100) + "%";
        return `<tr>
                    <td>${escapeHtml(b2bFunnelStageLabel(stage.stage))}</td>
                    <td><strong>${(stage.count || 0).toLocaleString()}</strong></td>
                    <td>${step}</td>
                    <td>${share}%</td>
                </tr>`;
      })
      .join("");

    const businessRows = (businesses || [])
      .map(
        (b) => `<tr>
                    <td><strong>${escapeHtml(b.name)}</strong></td>
                    <td>${b.verified ? "Yes" : '<span class="b2b-fleet-warn">No</span>'}</td>
                    <td>${b.vehicles}</td>
                    <td>${b.listings}</td>
                    <td>${b.live_listings}</td>
                    <td>${b.marketplace_bookings}</td>
                    <td>${fmtKes(b.marketplace_gross)}</td>
                    <td>${b.host_linked ? "Linked" : "—"}</td>
                    <td>${b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}</td>
                </tr>`,
      )
      .join("");

    content.innerHTML = `
            <div class="table-container" style="margin-bottom: 24px;">
                <table>
                    <thead>
                        <tr>
                            <th>Stage</th>
                            <th>Workspaces</th>
                            <th>From the stage before</th>
                            <th>Of all who applied</th>
                        </tr>
                    </thead>
                    <tbody>${stageRows || '<tr><td colspan="4">No data yet.</td></tr>'}</tbody>
                </table>
            </div>
            <p style="font-size: 14px; margin-bottom: 20px;">
                <strong>${(funnel.marketplace_bookings || 0).toLocaleString()}</strong> app bookings worth
                <strong>${fmtKes(funnel.marketplace_gross)}</strong> ·
                <strong>${(funnel.host_accounts_linked || 0).toLocaleString()}</strong> host accounts linked ·
                <strong>${(funnel.vehicles_awaiting_real_plate || 0).toLocaleString()}</strong> imported vehicles still need a real plate
            </p>
            <h3 style="margin: 0 0 12px; font-size: 16px;">By workspace</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Business</th>
                            <th>KYB</th>
                            <th>Vehicles</th>
                            <th>Listings</th>
                            <th>Live</th>
                            <th>App bookings</th>
                            <th>App gross</th>
                            <th>Host account</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>${businessRows || '<tr><td colspan="9">No workspaces yet.</td></tr>'}</tbody>
                </table>
            </div>`;
  } catch (error) {
    console.error("Error loading B2B funnel:", error);
    content.innerHTML = `<div class="empty-state">Error loading funnel: ${escapeHtml(error.message)}</div>`;
  }
}
