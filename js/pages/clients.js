// js/pages/clients.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


let currentClientSearch = "";
let clientSearchTimeout = null;
let currentClientPage = 1;
let clientsAll = []; // full client list held in memory
let clientFiltersReady = false;

// Setup client search + filters (call once on page load)
function setupClientFilters() {
  if (clientFiltersReady) return;
  const searchInput = document.getElementById("clientSearch");
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(clientSearchTimeout);
      clientSearchTimeout = setTimeout(() => {
        currentClientSearch = e.target.value;
        currentClientPage = 1;
        renderClients();
      }, 200);
    };
  }
  const kyc = document.getElementById("clientKycFilter");
  if (kyc) kyc.onchange = () => { currentClientPage = 1; renderClients(); };
  clientFiltersReady = true;
}

function goToClientPage(page) {
  currentClientPage = page;
  renderClients();
}

// Load clients
async function loadClients() {
  const content = document.getElementById("clientsContent");

  // Wire search + filters once
  setupClientFilters();

  try {
    content.innerHTML = '<div class="loading">Loading clients...</div>';
    clientsAll = await fetchAllPaged(api.getClients, "clients");
    renderClients();
  } catch (error) {
    console.error("Error loading clients:", error);
    content.innerHTML = '<div class="empty-state">Error loading clients</div>';
  }
}

// Apply current search + KYC filter to clientsAll, then paginate client-side.
function renderClients() {
  const content = document.getElementById("clientsContent");
  if (!content) return;

  const search = (currentClientSearch || "").trim().toLowerCase();
  const kyc = document.getElementById("clientKycFilter")?.value || "";

  const filtered = clientsAll.filter((client) => {
    if (search) {
      const hay = `${client.full_name || ""} ${client.email || ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (kyc && (client.kyc_status || "not_started") !== kyc) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (currentClientPage > totalPages) currentClientPage = totalPages;
  const start = (currentClientPage - 1) * LIST_PAGE_SIZE;
  const pageRows = filtered.slice(start, start + LIST_PAGE_SIZE);

  if (pageRows.length === 0) {
    content.innerHTML = '<div class="empty-state">No clients match the current filters</div>';
    renderListPagination("clientsPagination", currentClientPage, 0, LIST_PAGE_SIZE, total, "goToClientPage");
    return;
  }

  content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>KYC</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pageRows
                              .map(
                                (client) => `
                                <tr>
                                    <td>${client.full_name}</td>
                                    <td>${client.email}</td>
                                    <td><span class="status-badge ${client.is_active ? "active" : "inactive"}">${client.is_active ? "Active" : "Inactive"}</span></td>
                                    <td>${kycBadge(client.kyc_status)}</td>
                                    <td>
                                        <button class="btn btn-primary btn-small" onclick="viewClientDetails(${client.id})">View</button>
                                        ${
                                          client.is_active
                                            ? `<button class="btn btn-secondary btn-small" onclick="deactivateClient(${client.id})">Deactivate</button>`
                                            : `<button class="btn btn-primary btn-small" onclick="activateClient(${client.id})">Activate</button>`
                                        }
                                        <button class="btn btn-danger btn-small" onclick="deleteClientConfirm(${client.id}, '${client.full_name.replace(/'/g, "\\'")}')">Delete</button>
                                    </td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
  renderListPagination("clientsPagination", currentClientPage, pageRows.length, LIST_PAGE_SIZE, total, "goToClientPage");
}

function clientText(value) {
  return value === null || value === undefined || value === ""
    ? "N/A"
    : escapeHtmlText(value);
}

function faceMatchPct(score) {
  if (score === null || score === undefined) return "N/A";
  return `${Math.round(score * 100)}%`;
}

// Render a single document thumbnail (or a placeholder when the URL is absent)
function clientDocThumb(label, url) {
  const placeholderStyle =
    "width: 100%; height: 140px; border-radius: 8px; border: 1px dashed #d1d5db; background: #f9fafb; color: #9ca3af; display: flex; align-items: center; justify-content: center; font-size: 13px; text-align: center; padding: 0 8px;";
  const inner = url
    ? (() => {
        const safe = escapeHtmlAttr(url);
        // referrerpolicy="no-referrer" so Supabase/CDN hotlink protection doesn't
        // block the inline request; onerror swaps in a placeholder if it still fails.
        const onerror = `this.onerror=null;this.style.display='none';this.insertAdjacentHTML('afterend','<div style=&quot;${placeholderStyle}&quot;>Preview unavailable — open ${label}</div>');`;
        return `
          <a href="${safe}" target="_blank" rel="noopener noreferrer" title="Open ${label}">
            <img src="${safe}" alt="${label}" loading="lazy" referrerpolicy="no-referrer"
              onerror="${onerror}"
              style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; background: #f5f5f5; display: block;" />
          </a>`;
      })()
    : `<div style="${placeholderStyle}">Not provided</div>`;
  return `
    <div class="client-doc">
      <div class="detail-label" style="margin-bottom: 6px;">${label}</div>
      ${inner}
    </div>`;
}

// Render the detail rows for a single KYC record (reused by latest + history)
function clientKycRecordRows(kyc) {
  return `
    <div class="detail-row"><div class="detail-label">Status:</div><div class="detail-value">${kycBadge(kyc.status)}</div></div>
    <div class="detail-row"><div class="detail-label">Document Type:</div><div class="detail-value">${clientText(kyc.document_type)}</div></div>
    <div class="detail-row"><div class="detail-label">Verified Name:</div><div class="detail-value">${clientText(kyc.verified_name)}</div></div>
    <div class="detail-row"><div class="detail-label">Verified DOB:</div><div class="detail-value">${fmtDate(kyc.verified_dob)}</div></div>
    <div class="detail-row"><div class="detail-label">Verified Gender:</div><div class="detail-value">${clientText(kyc.verified_gender)}</div></div>
    <div class="detail-row"><div class="detail-label">Face Match Score:</div><div class="detail-value">${faceMatchPct(kyc.face_match_score)}</div></div>
    <div class="detail-row"><div class="detail-label">Decision Reason:</div><div class="detail-value">${clientText(kyc.decision_reason)}</div></div>
    <div class="detail-row"><div class="detail-label">Verified At:</div><div class="detail-value">${fmtDateTime(kyc.verified_at)}</div></div>
    <div class="detail-row"><div class="detail-label">Dojah Reference:</div><div class="detail-value">${clientText(kyc.dojah_reference_id)}</div></div>`;
}

// View client details
async function viewClientDetails(clientId) {
  // Hide all pages
  document.querySelectorAll(".page-content").forEach((p) => {
    p.style.display = "none";
  });

  // Show client detail page (reuse host detail page structure or create new)
  const hostDetailPage = document.getElementById("hostDetailPage");
  const hostDetailContent = document.getElementById("hostDetailContent");
  const hostDetailTitle = document.getElementById("hostDetailTitle");

  hostDetailPage.style.display = "block";
  document.getElementById("pageTitle").textContent = "Client Details";
  hostDetailContent.innerHTML =
    '<div class="loading">Loading client details...</div>';

  try {
    const client = await api.getClient(clientId);
    hostDetailTitle.textContent = client.full_name || "Client Details";

    const license = client.driving_license;
    const kyc = client.kyc_latest;
    const kycHistory = Array.isArray(client.kyc_history)
      ? client.kyc_history
      : [];

    hostDetailContent.innerHTML = `
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${clientText(client.full_name)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email:</div>
                        <div class="detail-value">${clientText(client.email)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Mobile Number:</div>
                        <div class="detail-value">${clientText(client.mobile_number)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">ID Number:</div>
                        <div class="detail-value">${clientText(client.id_number)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Date of Birth:</div>
                        <div class="detail-value">${fmtDate(client.date_of_birth)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Gender:</div>
                        <div class="detail-value">${clientText(client.gender)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">
                            <span class="status-badge ${client.is_active ? "active" : "inactive"}">
                                ${client.is_active ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="host-detail-section">
                    <h3>Secondary Contact</h3>
                    <div class="detail-row">
                        <div class="detail-label">Names:</div>
                        <div class="detail-value">${clientText(client.secondary_contact_names)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Phone:</div>
                        <div class="detail-value">${clientText(client.secondary_contact_phone)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">${secondaryContactBadge(client.secondary_contact_status)}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Verified At:</div>
                        <div class="detail-value">${fmtDateTime(client.secondary_contact_verified_at)}</div>
                    </div>
                </div>
            </div>

            <div class="host-detail-section">
                <h3>Documents</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;">
                    ${clientDocThumb("Avatar", client.avatar_url)}
                    ${clientDocThumb("ID Document", client.id_document_url)}
                    ${clientDocThumb("License Document", client.license_document_url)}
                </div>
            </div>

            <div class="host-detail-section">
                <h3>Driving License</h3>
                ${
                  license
                    ? `
                    <div class="detail-row"><div class="detail-label">License Number:</div><div class="detail-value">${clientText(license.license_number)}</div></div>
                    <div class="detail-row"><div class="detail-label">Category:</div><div class="detail-value">${clientText(license.category)}</div></div>
                    <div class="detail-row"><div class="detail-label">Issue Date:</div><div class="detail-value">${fmtDate(license.issue_date)}</div></div>
                    <div class="detail-row"><div class="detail-label">Expiry Date:</div><div class="detail-value">${fmtDate(license.expiry_date)}</div></div>
                    <div class="detail-row"><div class="detail-label">Verification:</div><div class="detail-value">${verifiedBadge(license.is_verified)}</div></div>
                    <div class="detail-row"><div class="detail-label">Notes:</div><div class="detail-value">${clientText(license.verification_notes)}</div></div>
                    `
                    : '<div class="detail-value" style="color: #666;">No driving license on file.</div>'
                }
            </div>

            <div class="host-detail-section">
                <h3>KYC Verification ${kycBadge(client.kyc_status)}</h3>
                ${
                  kyc
                    ? clientKycRecordRows(kyc)
                    : '<div class="detail-value" style="color: #666;">No KYC records on file.</div>'
                }
                ${
                  kycHistory.length > 1
                    ? `
                    <details style="margin-top: 16px;">
                        <summary style="cursor: pointer; font-weight: 500;">View KYC history (${kycHistory.length})</summary>
                        ${kycHistory
                          .map(
                            (rec, i) => `
                            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee;">
                                <div class="detail-label" style="margin-bottom: 6px;">Attempt ${i + 1} · ${fmtDateTime(rec.created_at)}</div>
                                ${clientKycRecordRows(rec)}
                            </div>`,
                          )
                          .join("")}
                    </details>`
                    : ""
                }
            </div>

            <div class="host-detail-section">
                <h3>Account</h3>
                <div class="detail-row">
                    <div class="detail-label">Created At:</div>
                    <div class="detail-value">${fmtDateTime(client.created_at)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">${fmtDateTime(client.updated_at)}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Terms Accepted At:</div>
                    <div class="detail-value">${fmtDateTime(client.terms_accepted_at)}</div>
                </div>
            </div>

            <div style="margin-top: 24px; display: flex; gap: 12px;">
                ${
                  client.is_active
                    ? `<button class="btn btn-secondary" onclick="deactivateClient(${client.id}, true)">Deactivate Account</button>`
                    : `<button class="btn btn-primary" onclick="activateClient(${client.id}, true)">Activate Account</button>`
                }
                <button class="btn btn-danger" onclick="deleteClientConfirm(${client.id}, '${client.full_name.replace(/'/g, "\\'")}', true)">Delete Account</button>
                <button class="btn btn-secondary" onclick="backToClientsList()">Back to Clients</button>
            </div>
        `;
  } catch (error) {
    console.error("Error loading client details:", error);
    hostDetailContent.innerHTML = `<div class="error-state">Error loading client details: ${error.message}</div>`;
  }
}

// Back to clients list
function backToClientsList() {
  document.querySelectorAll(".page-content").forEach((p) => {
    p.style.display = "none";
  });
  document.getElementById("clientsContent").parentElement.style.display =
    "block";
  document.getElementById("pageTitle").textContent = "Clients";
  loadClients();
}

// Activate client
async function activateClient(clientId, reloadAfter = false) {
  try {
    await api.activateClient(clientId);
    alert("Client account activated successfully");
    if (reloadAfter) {
      viewClientDetails(clientId);
    } else {
      loadClients();
    }
  } catch (error) {
    alert("Error activating client: " + error.message);
  }
}

// Deactivate client
async function deactivateClient(clientId, reloadAfter = false) {
  if (!(await uiConfirm("Are you sure you want to deactivate this client account?"))) {
    return;
  }

  try {
    await api.deactivateClient(clientId);
    alert("Client account deactivated successfully");
    if (reloadAfter) {
      viewClientDetails(clientId);
    } else {
      loadClients();
    }
  } catch (error) {
    alert("Error deactivating client: " + error.message);
  }
}

// Delete client confirmation
async function deleteClientConfirm(clientId, clientName, reloadAfter = false) {
  if (
    !(await uiConfirm(
      `Are you sure you want to permanently delete client "${clientName}"? This action cannot be undone.`,
    ))
  ) {
    return;
  }

  deleteClient(clientId, reloadAfter);
}

// Delete client
async function deleteClient(clientId, reloadAfter = false) {
  try {
    await api.deleteClient(clientId);
    alert("Client deleted successfully");
    if (reloadAfter) {
      backToClientsList();
    } else {
      loadClients();
    }
  } catch (error) {
    alert("Error deleting client: " + error.message);
  }
}
