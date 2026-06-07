// js/pages/hosts.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// Back to hosts list
function backToHostsList() {
  loadPage("hosts");
}

let currentHostSearch = "";
let hostSearchTimeout = null;
let currentHostPage = 1;
let hostsAll = []; // full host list held in memory for client-side search/filter/paginate
let hostFiltersReady = false;

// Setup host search + filters (call once on page load)
function setupHostFilters() {
  if (hostFiltersReady) return;
  const searchInput = document.getElementById("hostSearch");
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(hostSearchTimeout);
      hostSearchTimeout = setTimeout(() => {
        currentHostSearch = e.target.value;
        currentHostPage = 1; // reset to first page on a new search
        renderHosts();
      }, 200);
    };
  }
  const kyc = document.getElementById("hostKycFilter");
  if (kyc) kyc.onchange = () => { currentHostPage = 1; renderHosts(); };
  const cars = document.getElementById("hostCarsFilter");
  if (cars) cars.onchange = () => { currentHostPage = 1; renderHosts(); };
  hostFiltersReady = true;
}

function goToHostPage(page) {
  currentHostPage = page;
  renderHosts();
}

async function loadHosts() {
  const content = document.getElementById("hostsContent");

  // Wire search + filters once
  setupHostFilters();

  try {
    content.innerHTML = '<div class="loading">Loading hosts...</div>';
    hostsAll = await fetchAllPaged(api.getHosts, "hosts");
    renderHosts();
  } catch (error) {
    console.error("Error loading hosts:", error);
    content.innerHTML = '<div class="empty-state">Error loading hosts</div>';
  }
}

// Apply current search + KYC + cars filters to hostsAll, then paginate client-side.
function renderHosts() {
  const content = document.getElementById("hostsContent");
  if (!content) return;

  const search = (currentHostSearch || "").trim().toLowerCase();
  const kyc = document.getElementById("hostKycFilter")?.value || "";
  const cars = document.getElementById("hostCarsFilter")?.value || "";

  const filtered = hostsAll.filter((host) => {
    if (search) {
      const hay = `${host.full_name || ""} ${host.email || ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (kyc && (host.kyc_status || "not_started") !== kyc) return false;
    if (cars === "with" && !(host.cars_count > 0)) return false;
    if (cars === "without" && host.cars_count > 0) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (currentHostPage > totalPages) currentHostPage = totalPages;
  const start = (currentHostPage - 1) * LIST_PAGE_SIZE;
  const pageRows = filtered.slice(start, start + LIST_PAGE_SIZE);

  if (pageRows.length === 0) {
    content.innerHTML = '<div class="empty-state">No hosts match the current filters</div>';
    renderListPagination("hostsPagination", currentHostPage, 0, LIST_PAGE_SIZE, total, "goToHostPage");
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
                                <th>Cars</th>
                                <th>Payment Methods</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pageRows
                              .map(
                                (host) => `
                                <tr>
                                    <td>${host.full_name}</td>
                                    <td>${host.email}</td>
                                    <td><span class="status-badge ${host.is_active ? "active" : "inactive"}">${host.is_active ? "Active" : "Inactive"}</span></td>
                                    <td>${kycBadge(host.kyc_status)}</td>
                                    <td>${host.cars_count || 0}</td>
                                    <td>${host.payment_methods_count || 0}</td>
                                    <td class="row-actions">
                                        <button class="btn btn-primary btn-small" onclick="viewHostDetails(${host.id})">View</button>
                                        ${
                                          host.is_active
                                            ? `<button class="btn btn-secondary btn-small" onclick="deactivateHost(${host.id})">Deactivate</button>`
                                            : `<button class="btn btn-primary btn-small" onclick="activateHost(${host.id})">Activate</button>`
                                        }
                                        <button class="btn btn-danger btn-small" onclick="deleteHostConfirm(${host.id}, '${host.full_name}')">Delete</button>
                                    </td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
  renderListPagination("hostsPagination", currentHostPage, pageRows.length, LIST_PAGE_SIZE, total, "goToHostPage");
}

// View host details
async function viewHostDetails(hostId) {
  // Hide all pages
  document.querySelectorAll(".page-content").forEach((p) => {
    p.style.display = "none";
  });

  // Show host detail page
  const hostDetailPage = document.getElementById("hostDetailPage");
  const hostDetailContent = document.getElementById("hostDetailContent");
  const hostDetailTitle = document.getElementById("hostDetailTitle");

  hostDetailPage.style.display = "block";
  document.getElementById("pageTitle").textContent = "Host Details";
  hostDetailContent.innerHTML =
    '<div class="loading">Loading host details...</div>';

  try {
    const host = await api.getHost(hostId);
    hostDetailTitle.textContent = host.full_name || "Host Details";

    hostDetailContent.innerHTML = `
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${host.full_name || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email:</div>
                        <div class="detail-value">${host.email || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Mobile:</div>
                        <div class="detail-value">${host.mobile_number || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">ID Number:</div>
                        <div class="detail-value">${host.id_number || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">
                            <span class="status-badge ${host.is_active ? "active" : "inactive"}">
                                ${host.is_active ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="host-detail-section">
                    <h3>Statistics</h3>
                    <div class="detail-row">
                        <div class="detail-label">Total Cars:</div>
                        <div class="detail-value">${host.cars_count || 0}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Payment Methods:</div>
                        <div class="detail-value">${host.payment_methods_count || 0}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Feedback Count:</div>
                        <div class="detail-value">${host.feedbacks_count || 0}</div>
                    </div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Bio</h3>
                <div class="detail-value" style="padding: 12px; background-color: #f9f9f9; border-radius: 4px; min-height: 60px;">
                    ${host.bio || "No bio provided"}
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Account Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Account Created:</div>
                    <div class="detail-value">${new Date(host.created_at).toLocaleString()}</div>
                </div>
                ${
                  host.updated_at
                    ? `
                <div class="detail-row">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">${new Date(host.updated_at).toLocaleString()}</div>
                </div>
                `
                    : ""
                }
            </div>
            
            <div class="action-buttons" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
                ${
                  host.is_active
                    ? `<button class="btn btn-secondary" onclick="deactivateHost(${host.id}, true)">Deactivate Account</button>`
                    : `<button class="btn btn-primary" onclick="activateHost(${host.id}, true)">Activate Account</button>`
                }
                <button class="btn btn-danger" onclick="deleteHostConfirm(${host.id}, '${host.full_name}', true)">Delete Account</button>
            </div>
        `;
  } catch (error) {
    console.error("Error loading host details:", error);
    hostDetailContent.innerHTML = `<div class="empty-state">Error loading host details: ${error.message}</div>`;
  }
}

// Deactivate host
async function deactivateHost(hostId, reloadAfter = false) {
  if (!(await uiConfirm("Are you sure you want to deactivate this host account?"))) {
    return;
  }

  try {
    await api.deactivateHost(hostId);
    alert("Host account deactivated successfully");
    if (reloadAfter) {
      // Reload the host details page
      viewHostDetails(hostId);
    } else {
      loadHosts();
    }
  } catch (error) {
    alert("Error deactivating host: " + error.message);
  }
}

// Activate host
async function activateHost(hostId, reloadAfter = false) {
  if (!(await uiConfirm("Are you sure you want to activate this host account?"))) {
    return;
  }

  try {
    await api.activateHost(hostId);
    alert("Host account activated successfully");
    if (reloadAfter) {
      // Reload the host details page
      viewHostDetails(hostId);
    } else {
      loadHosts();
    }
  } catch (error) {
    alert("Error activating host: " + error.message);
  }
}

// Delete host confirmation
async function deleteHostConfirm(hostId, hostName, reloadAfter = false) {
  if (
    !(await uiConfirm(
      `Are you sure you want to permanently delete host "${hostName}"? This action cannot be undone.`,
    ))
  ) {
    return;
  }

  deleteHost(hostId, reloadAfter);
}

// Delete host
async function deleteHost(hostId, reloadAfter = false) {
  try {
    await api.deleteHost(hostId);
    alert("Host deleted successfully");
    if (reloadAfter) {
      // Go back to hosts list after deletion
      backToHostsList();
    } else {
      loadHosts();
    }
  } catch (error) {
    alert("Error deleting host: " + error.message);
  }
}
