// js/pages/withdrawals.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// ==================== WITHDRAWAL MANAGEMENT ====================

let currentWithdrawalPage = 1;
let currentWithdrawalStatus = "";
let currentWithdrawalHostId = "";

function setupWithdrawalFilters() {
  const statusFilter = document.getElementById("withdrawalStatusFilter");
  const hostIdFilter = document.getElementById("withdrawalHostIdFilter");
  if (statusFilter) {
    statusFilter.onchange = () => {
      currentWithdrawalStatus = statusFilter.value;
      currentWithdrawalPage = 1;
      loadWithdrawals();
    };
  }
  if (hostIdFilter) {
    let timeout;
    hostIdFilter.oninput = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentWithdrawalHostId = hostIdFilter.value;
        currentWithdrawalPage = 1;
        loadWithdrawals();
      }, 400);
    };
  }
}

async function loadWithdrawals() {
  const content = document.getElementById("withdrawalsContent");
  if (!content) return;
  try {
    content.innerHTML = '<div class="loading">Loading withdrawals...</div>';
    const params = {
      skip: (currentWithdrawalPage - 1) * 20,
      limit: 20,
    };
    if (currentWithdrawalStatus) params.status = currentWithdrawalStatus;
    if (currentWithdrawalHostId)
      params.host_id = parseInt(currentWithdrawalHostId, 10);
    const data = await api.getWithdrawals(params);
    if (data.withdrawals && data.withdrawals.length > 0) {
      content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Host</th>
                                <th>Amount</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Requested</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.withdrawals
                              .map((w) => {
                                const details = w.payment_details
                                  ? (() => {
                                      try {
                                        const d = JSON.parse(w.payment_details);
                                        return (
                                          d.mpesa_number ||
                                          d.account_number ||
                                          JSON.stringify(d)
                                        );
                                      } catch {
                                        return w.payment_details;
                                      }
                                    })()
                                  : "—";
                                const statusClass =
                                  w.status === "pending"
                                    ? "inactive"
                                    : w.status === "completed"
                                      ? "active"
                                      : "inactive";
                                let actions = "";
                                if (w.status === "pending") {
                                  actions = `<button class="btn btn-small btn-primary" onclick="openWithdrawalStatusModal(${w.id}, 'completed')">Mark completed</button>
                                        <button class="btn btn-small btn-secondary" onclick="openWithdrawalStatusModal(${w.id}, 'rejected')">Reject</button>
                                        <button class="btn btn-small" onclick="openWithdrawalStatusModal(${w.id}, 'cancelled')">Cancel</button>`;
                                } else {
                                  actions = "—";
                                }
                                return `<tr>
                                    <td>${w.id}</td>
                                    <td>${(w.host_name || "") + (w.host_email ? " (" + w.host_email + ")" : "")} <small>#${w.host_id}</small></td>
                                    <td>KES ${typeof w.amount === "number" ? w.amount.toLocaleString() : w.amount}</td>
                                    <td>${w.payment_method_type}: ${details}</td>
                                    <td><span class="status-badge ${statusClass}">${w.status}</span></td>
                                    <td>${w.created_at ? new Date(w.created_at).toLocaleString() : "—"}</td>
                                    <td>${actions}</td>
                                </tr>`;
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
      renderWithdrawalPagination(data.total, data.limit, data.skip);
    } else {
      content.innerHTML = '<div class="empty-state">No withdrawals found</div>';
      document.getElementById("withdrawalsPagination").innerHTML = "";
    }
  } catch (error) {
    console.error("Error loading withdrawals:", error);
    content.innerHTML = `<div class="empty-state">Error loading withdrawals: ${error.message}</div>`;
  }
}

function renderWithdrawalPagination(total, limit, skip) {
  const pagination = document.getElementById("withdrawalsPagination");
  if (!pagination) return;
  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(skip / limit) + 1;
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }
  let html = "";
  if (currentPage > 1) {
    html += `<button class="btn btn-secondary" onclick="goToWithdrawalPage(${currentPage - 1})">Previous</button>`;
  }
  html += `<span style="padding: 0 15px;">Page ${currentPage} of ${totalPages}</span>`;
  if (currentPage < totalPages) {
    html += `<button class="btn btn-secondary" onclick="goToWithdrawalPage(${currentPage + 1})">Next</button>`;
  }
  pagination.innerHTML = html;
}

function goToWithdrawalPage(page) {
  currentWithdrawalPage = page;
  loadWithdrawals();
}

function openWithdrawalStatusModal(id, action) {
  const modal = document.getElementById("withdrawalStatusModal");
  const idInput = document.getElementById("withdrawalStatusModalId");
  const actionInput = document.getElementById("withdrawalStatusModalAction");
  const titleEl = document.getElementById("withdrawalStatusModalTitle");
  const summaryEl = document.getElementById("withdrawalStatusModalSummary");
  const notesEl = document.getElementById("withdrawalStatusAdminNotes");
  const errEl = document.getElementById("withdrawalStatusFormError");
  if (!modal || !idInput || !actionInput) return;
  idInput.value = id;
  actionInput.value = action;
  if (titleEl)
    titleEl.textContent =
      action === "completed"
        ? "Mark as completed"
        : action === "rejected"
          ? "Reject withdrawal"
          : "Cancel withdrawal";
  if (summaryEl)
    summaryEl.textContent = `Set withdrawal #${id} to "${action}". Add notes below if needed.`;
  if (notesEl) notesEl.value = "";
  if (errEl) errEl.textContent = "";
  modal.style.display = "flex";
}

function closeWithdrawalStatusModal() {
  const modal = document.getElementById("withdrawalStatusModal");
  if (modal) modal.style.display = "none";
}

async function confirmWithdrawalStatusUpdate() {
  const id = document.getElementById("withdrawalStatusModalId")?.value;
  const action = document.getElementById("withdrawalStatusModalAction")?.value;
  const notesEl = document.getElementById("withdrawalStatusAdminNotes");
  const errEl = document.getElementById("withdrawalStatusFormError");
  const btn = document.getElementById("withdrawalStatusConfirmBtn");
  if (!id || !action) return;
  const notes = notesEl ? notesEl.value.trim() : "";
  if (errEl) errEl.textContent = "";
  if (btn) btn.disabled = true;
  try {
    await api.updateWithdrawalStatus(id, {
      status: action,
      admin_notes: notes || undefined,
    });
    closeWithdrawalStatusModal();
    loadWithdrawals();
  } catch (error) {
    if (errEl) errEl.textContent = error.message || "Update failed";
  } finally {
    if (btn) btn.disabled = false;
  }
}
