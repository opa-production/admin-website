// js/pages/referrals.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// ==================== REFERRALS MONITORING ====================
// Read-only admin view of the referral programme: hosts/clients who have
// referred hosts, with per-referrer drill-down. See refferals.md.

let currentReferralTab = "host"; // "host" | "client"
let currentReferrerPage = 1;
let currentReferrerSearch = "";
let referrerSearchWired = false;

function setupReferrerSearch() {
  const input = document.getElementById("referrerSearch");
  if (!input || referrerSearchWired) return;
  referrerSearchWired = true;
  let timeout;
  input.oninput = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      currentReferrerSearch = input.value.trim();
      currentReferrerPage = 1;
      loadReferrers();
    }, 400);
  };
}

function switchReferralTab(tab) {
  currentReferralTab = tab;
  currentReferrerPage = 1;
  document.querySelectorAll(".referrals-tab").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-rtab") === tab);
  });
  const hint = document.getElementById("referralsHint");
  if (hint) {
    hint.textContent =
      tab === "client"
        ? "Clients who referred hosts. Click a row to see referred hosts and earnings."
        : "Hosts who referred other hosts. Click a row to see referred hosts and earnings.";
  }
  loadReferrers();
}

async function loadReferrers() {
  const content = document.getElementById("referrersContent");
  if (!content) return;
  const isClient = currentReferralTab === "client";
  try {
    content.innerHTML = '<div class="loading">Loading referrers...</div>';
    const params = { page: currentReferrerPage, limit: 20 };
    if (currentReferrerSearch) params.search = currentReferrerSearch;
    const data = isClient
      ? await api.getClientReferrers(params)
      : await api.getReferrers(params);
    const rows = data.referrers || [];
    if (rows.length === 0) {
      content.innerHTML = '<div class="empty-state">No referrers found</div>';
      document.getElementById("referrersPagination").innerHTML = "";
      return;
    }
    const idKey = isClient ? "client_id" : "host_id";
    const refLabel = isClient ? "Client" : "Host";
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>${refLabel} (referrer)</th>
                            <th>Referral code</th>
                            <th># Referred</th>
                            <th>Approved</th>
                            <th>Pending</th>
                            <th>Reversed</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows
                          .map(
                            (r) => `
                            <tr>
                                <td>${escapeHtmlText(r.full_name || "N/A")}<br><small>${escapeHtmlText(r.email || "")} · #${r[idKey]}</small></td>
                                <td><code>${escapeHtmlText(r.referral_code || "—")}</code></td>
                                <td>${r.total_referred ?? 0}</td>
                                <td>${fmtKes(r.total_approved_ksh)}</td>
                                <td>${fmtKes(r.total_pending_ksh)}</td>
                                <td>${fmtKes(r.total_reversed_ksh)}</td>
                                <td>${fmtDate(r.created_at)}</td>
                                <td><button class="btn btn-small btn-primary" onclick="viewReferrerDetails(${r[idKey]})">View</button></td>
                            </tr>`,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        `;
    renderReferrerPagination(data.total, data.limit, data.page);
  } catch (error) {
    console.error("Error loading referrers:", error);
    content.innerHTML = `<div class="empty-state">Error loading referrers: ${error.message}</div>`;
    document.getElementById("referrersPagination").innerHTML = "";
  }
}

function renderReferrerPagination(total, limit, page) {
  const pagination = document.getElementById("referrersPagination");
  if (!pagination) return;
  const totalPages = Math.ceil((total || 0) / (limit || 20)) || 1;
  const currentPage = page || 1;
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }
  let html = "";
  if (currentPage > 1) {
    html += `<button class="btn btn-secondary" onclick="goToReferrerPage(${currentPage - 1})">Previous</button>`;
  }
  html += `<span style="padding: 0 15px;">Page ${currentPage} of ${totalPages}</span>`;
  if (currentPage < totalPages) {
    html += `<button class="btn btn-secondary" onclick="goToReferrerPage(${currentPage + 1})">Next</button>`;
  }
  pagination.innerHTML = html;
}

function goToReferrerPage(page) {
  currentReferrerPage = page;
  loadReferrers();
}

// Drill-down: one referrer's referred hosts + earnings
async function viewReferrerDetails(id) {
  const isClient = currentReferralTab === "client";
  document.querySelectorAll(".page-content").forEach((p) => {
    p.style.display = "none";
  });
  const page = document.getElementById("referralDetailPage");
  const titleEl = document.getElementById("referralDetailTitle");
  const content = document.getElementById("referralDetailContent");
  page.style.display = "block";
  document.getElementById("pageTitle").textContent = "Referrer Details";
  content.innerHTML =
    '<div class="loading">Loading referrer details...</div>';

  try {
    const data = isClient
      ? await api.getClientReferrer(id)
      : await api.getReferrer(id);
    titleEl.textContent = data.full_name || "Referrer Details";
    const referred = data.referred_hosts || [];
    const earnings = data.earnings || [];
    const refLabel = isClient ? "Client" : "Host";

    content.innerHTML = `
            <div class="responsive-detail-grid" style="margin-bottom: 24px;">
                <div class="host-detail-section">
                    <h3>${refLabel} (referrer)</h3>
                    <div class="detail-row"><div class="detail-label">Name:</div><div class="detail-value">${clientText(data.full_name)}</div></div>
                    <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${clientText(data.email)}</div></div>
                    <div class="detail-row"><div class="detail-label">Referral Code:</div><div class="detail-value"><code>${clientText(data.referral_code)}</code></div></div>
                    <div class="detail-row"><div class="detail-label">Total Referred:</div><div class="detail-value">${data.total_referred ?? 0}</div></div>
                </div>
                <div class="host-detail-section">
                    <h3>Earnings Totals</h3>
                    <div class="detail-row"><div class="detail-label">Approved:</div><div class="detail-value">${fmtKes(data.total_approved_ksh)}</div></div>
                    <div class="detail-row"><div class="detail-label">Pending:</div><div class="detail-value">${fmtKes(data.total_pending_ksh)}</div></div>
                    <div class="detail-row"><div class="detail-label">Reversed:</div><div class="detail-value">${fmtKes(data.total_reversed_ksh)}</div></div>
                </div>
            </div>

            <div class="host-detail-section">
                <h3>Referred Hosts (${referred.length})</h3>
                ${
                  referred.length
                    ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr><th>Host</th><th>Joined</th><th>Cars Published</th><th>KYC</th><th>Earnings From Them</th></tr>
                            </thead>
                            <tbody>
                                ${referred
                                  .map(
                                    (h) => `
                                    <tr>
                                        <td>${escapeHtmlText(h.full_name || "N/A")} <small>#${h.host_id}</small></td>
                                        <td>${fmtDate(h.joined_at)}</td>
                                        <td>${h.cars_published ?? 0}</td>
                                        <td>${h.kyc_verified ? '<span class="status-badge kyc-verified">Verified</span>' : '<span class="status-badge kyc-not-started">Unverified</span>'}</td>
                                        <td>${fmtKes(h.earnings_from_this_host_ksh)}</td>
                                    </tr>`,
                                  )
                                  .join("")}
                            </tbody>
                        </table>
                    </div>`
                    : '<div class="detail-value" style="color: #666;">No referred hosts yet.</div>'
                }
            </div>

            <div class="host-detail-section">
                <h3>Earnings (${earnings.length})</h3>
                ${
                  earnings.length
                    ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr><th>Referred</th><th>Car</th><th>Kind</th><th>Amount</th><th>Status</th><th>Created</th><th>Approved</th></tr>
                            </thead>
                            <tbody>
                                ${earnings
                                  .map(
                                    (e) => `
                                    <tr>
                                        <td>${escapeHtmlText(e.referred_name || "N/A")}${e.referred_host_id ? ` <small>#${e.referred_host_id}</small>` : ""}</td>
                                        <td>${escapeHtmlText(e.car_name || "—")}</td>
                                        <td>${referralKindBadge(e.kind)}</td>
                                        <td>${fmtKes(e.amount_ksh)}</td>
                                        <td>${referralStatusBadge(e.status)}</td>
                                        <td>${fmtDate(e.created_at)}</td>
                                        <td>${fmtDate(e.approved_at)}</td>
                                    </tr>`,
                                  )
                                  .join("")}
                            </tbody>
                        </table>
                    </div>`
                    : '<div class="detail-value" style="color: #666;">No earnings yet.</div>'
                }
            </div>
        `;
  } catch (error) {
    console.error("Error loading referrer details:", error);
    content.innerHTML = `<div class="empty-state">Error loading referrer details: ${error.message}</div>`;
  }
}

function backToReferralsList() {
  loadPage("referrals");
}
