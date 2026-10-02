// js/pages/referral-earnings.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// ==================== REFERRAL EARNINGS ====================
// Earnings paid for referring a host, with a reverse action. Two sources share
// this page: a client who referred a host, and a host who referred a host. They
// are separate ledgers on the server with the same shape, so the page switches
// which one it reads rather than repeating itself. See refferals.md §1.

// "client" | "host": who did the referring.
let referralEarningSource = "client";

const REFERRAL_EARNING_SOURCES = {
  client: {
    list: (params) => api.getClientReferralEarnings(params),
    reverse: (id, reason) => api.reverseClientReferralEarning(id, reason),
    referrerParam: "referrer_client_id",
    referrerIdField: "referrer_client_id",
    referrerLabel: "Referrer (client)",
    referrerPlaceholder: "Referrer client ID...",
  },
  host: {
    list: (params) => api.getReferralEarnings(params),
    reverse: (id, reason) => api.reverseReferralEarning(id, reason),
    referrerParam: "referrer_host_id",
    referrerIdField: "referrer_host_id",
    referrerLabel: "Referrer (host)",
    referrerPlaceholder: "Referrer host ID...",
  },
};

function switchReferralEarningSource(source) {
  if (!REFERRAL_EARNING_SOURCES[source]) return;
  referralEarningSource = source;
  document
    .getElementById("referralEarningClientTab")
    ?.classList.toggle("active", source === "client");
  document
    .getElementById("referralEarningHostTab")
    ?.classList.toggle("active", source === "host");
  // A referrer id means a different account in each ledger.
  currentClientEarningReferrerId = "";
  currentClientEarningPage = 1;
  const referrerFilter = document.getElementById("clientEarningReferrerFilter");
  if (referrerFilter) {
    referrerFilter.value = "";
    referrerFilter.placeholder = REFERRAL_EARNING_SOURCES[source].referrerPlaceholder;
  }
  loadClientReferralEarnings();
}

let currentClientEarningPage = 1;
let currentClientEarningStatus = "";
let currentClientEarningKind = "";
let currentClientEarningReferrerId = "";
let currentClientEarningReferredId = "";
let clientEarningFiltersWired = false;

function setupClientEarningFilters() {
  if (clientEarningFiltersWired) return;
  clientEarningFiltersWired = true;

  const statusFilter = document.getElementById("clientEarningStatusFilter");
  const kindFilter = document.getElementById("clientEarningKindFilter");
  const referrerFilter = document.getElementById("clientEarningReferrerFilter");
  const referredFilter = document.getElementById("clientEarningReferredFilter");

  if (statusFilter) {
    statusFilter.onchange = () => {
      currentClientEarningStatus = statusFilter.value;
      currentClientEarningPage = 1;
      loadClientReferralEarnings();
    };
  }
  if (kindFilter) {
    kindFilter.onchange = () => {
      currentClientEarningKind = kindFilter.value;
      currentClientEarningPage = 1;
      loadClientReferralEarnings();
    };
  }
  let timeout;
  if (referrerFilter) {
    referrerFilter.oninput = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentClientEarningReferrerId = referrerFilter.value.trim();
        currentClientEarningPage = 1;
        loadClientReferralEarnings();
      }, 400);
    };
  }
  if (referredFilter) {
    referredFilter.oninput = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentClientEarningReferredId = referredFilter.value.trim();
        currentClientEarningPage = 1;
        loadClientReferralEarnings();
      }, 400);
    };
  }
}

async function loadClientReferralEarnings() {
  const content = document.getElementById("clientEarningsContent");
  if (!content) return;
  const source = REFERRAL_EARNING_SOURCES[referralEarningSource];
  try {
    content.innerHTML = '<div class="loading">Loading earnings...</div>';
    const params = { page: currentClientEarningPage, limit: 20 };
    if (currentClientEarningStatus) params.status = currentClientEarningStatus;
    if (currentClientEarningKind) params.kind = currentClientEarningKind;
    if (currentClientEarningReferrerId)
      params[source.referrerParam] = parseInt(currentClientEarningReferrerId, 10);
    if (currentClientEarningReferredId)
      params.referred_host_id = parseInt(currentClientEarningReferredId, 10);

    const data = await source.list(params);
    const rows = data.earnings || [];
    if (rows.length === 0) {
      content.innerHTML = '<div class="empty-state">No earnings found</div>';
      document.getElementById("clientEarningsPagination").innerHTML = "";
      return;
    }
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>${source.referrerLabel}</th>
                            <th>Referred (host)</th>
                            <th>Car</th>
                            <th>Kind</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Approved</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows
                          .map((e) => {
                            const reversed = e.status === "reversed";
                            const reverseBtn = reversed
                              ? `<span title="${escapeHtmlAttr(e.reversed_reason || "Reversed")}" style="color:#999;">Reversed</span>`
                              : `<button class="btn btn-small btn-danger" onclick="openReverseEarningModal(${e.id})">Reverse</button>`;
                            return `
                            <tr>
                                <td>${escapeHtmlText(e.referrer_name || "N/A")}<br><small>${escapeHtmlText(e.referrer_email || "")} · #${e[source.referrerIdField]}</small></td>
                                <td>${escapeHtmlText(e.referred_name || "N/A")}<br><small>${escapeHtmlText(e.referred_email || "")} · #${e.referred_host_id}</small></td>
                                <td>${escapeHtmlText(e.car_name || "—")}${e.car_id ? ` <small>#${e.car_id}</small>` : ""}</td>
                                <td>${referralKindBadge(e.kind)}</td>
                                <td>${fmtKes(e.amount_ksh)}</td>
                                <td>${referralStatusBadge(e.status)}</td>
                                <td>${fmtDate(e.created_at)}</td>
                                <td>${fmtDate(e.approved_at)}</td>
                                <td>${reverseBtn}</td>
                            </tr>`;
                          })
                          .join("")}
                    </tbody>
                </table>
            </div>
        `;
    renderClientEarningPagination(data.total, data.limit, data.page);
  } catch (error) {
    console.error("Error loading client referral earnings:", error);
    content.innerHTML = `<div class="empty-state">Error loading earnings: ${error.message}</div>`;
    document.getElementById("clientEarningsPagination").innerHTML = "";
  }
}

function renderClientEarningPagination(total, limit, page) {
  const pagination = document.getElementById("clientEarningsPagination");
  if (!pagination) return;
  const totalPages = Math.ceil((total || 0) / (limit || 20)) || 1;
  const currentPage = page || 1;
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }
  let html = "";
  if (currentPage > 1) {
    html += `<button class="btn btn-secondary" onclick="goToClientEarningPage(${currentPage - 1})">Previous</button>`;
  }
  html += `<span style="padding: 0 15px;">Page ${currentPage} of ${totalPages}</span>`;
  if (currentPage < totalPages) {
    html += `<button class="btn btn-secondary" onclick="goToClientEarningPage(${currentPage + 1})">Next</button>`;
  }
  pagination.innerHTML = html;
}

function goToClientEarningPage(page) {
  currentClientEarningPage = page;
  loadClientReferralEarnings();
}

function openReverseEarningModal(id) {
  const modal = document.getElementById("reverseEarningModal");
  const idInput = document.getElementById("reverseEarningId");
  const summaryEl = document.getElementById("reverseEarningSummary");
  const reasonEl = document.getElementById("reverseEarningReason");
  const errEl = document.getElementById("reverseEarningError");
  if (!modal || !idInput) return;
  idInput.value = id;
  if (summaryEl)
    summaryEl.textContent = `Reverse earning #${id}? It will stop counting toward the referrer's withdrawable balance. This cannot be undone.`;
  if (reasonEl) reasonEl.value = "";
  if (errEl) errEl.textContent = "";
  modal.style.display = "flex";
}

function closeReverseEarningModal() {
  const modal = document.getElementById("reverseEarningModal");
  if (modal) modal.style.display = "none";
}

async function confirmReverseEarning() {
  const id = document.getElementById("reverseEarningId")?.value;
  const reasonEl = document.getElementById("reverseEarningReason");
  const errEl = document.getElementById("reverseEarningError");
  const btn = document.getElementById("reverseEarningConfirmBtn");
  if (!id) return;
  const reason = reasonEl ? reasonEl.value.trim() : "";
  if (reason.length < 3 || reason.length > 500) {
    if (errEl) errEl.textContent = "Reason must be 3–500 characters.";
    return;
  }
  if (errEl) errEl.textContent = "";
  if (btn) btn.disabled = true;
  try {
    await REFERRAL_EARNING_SOURCES[referralEarningSource].reverse(id, reason);
    closeReverseEarningModal();
    loadClientReferralEarnings();
  } catch (error) {
    if (errEl) errEl.textContent = error.message || "Reverse failed";
  } finally {
    if (btn) btn.disabled = false;
  }
}
