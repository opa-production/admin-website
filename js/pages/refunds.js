// js/pages/refunds.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// ==================== REFUNDS MANAGEMENT ====================

let currentRefundPage = 1;
let currentRefundStatus = "";
let currentRefundBookingCode = "";
let currentRefundClientEmail = "";

function setupRefundFilters() {
  const statusFilter = document.getElementById("refundStatusFilter");
  const bookingCodeFilter = document.getElementById("refundBookingCodeFilter");
  const clientEmailFilter = document.getElementById("refundClientEmailFilter");

  if (statusFilter) {
    statusFilter.onchange = () => {
      currentRefundStatus = statusFilter.value;
      currentRefundPage = 1;
      loadRefunds();
    };
  }

  let timeout;
  if (bookingCodeFilter) {
    bookingCodeFilter.oninput = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentRefundBookingCode = bookingCodeFilter.value.trim();
        currentRefundPage = 1;
        loadRefunds();
      }, 400);
    };
  }
  if (clientEmailFilter) {
    clientEmailFilter.oninput = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentRefundClientEmail = clientEmailFilter.value.trim();
        currentRefundPage = 1;
        loadRefunds();
      }, 400);
    };
  }
}

async function loadRefunds() {
  const content = document.getElementById("refundsContent");
  if (!content) return;
  try {
    content.innerHTML = '<div class="loading">Loading refunds...</div>';
    const params = {
      page: currentRefundPage,
      limit: 20,
    };
    if (currentRefundStatus) params.status = currentRefundStatus;
    if (currentRefundBookingCode)
      params.booking_code = currentRefundBookingCode;
    if (currentRefundClientEmail)
      params.client_email = currentRefundClientEmail;

    const data = await api.getRefunds(params);
    if (data.refunds && data.refunds.length > 0) {
      content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Booking</th>
                                <th>Client</th>
                                <th>Original</th>
                                <th>Refund</th>
                                <th>%</th>
                                <th>Status</th>
                                <th>Reason</th>
                                <th>Processed</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.refunds
                              .map((r) => {
                                const statusClass =
                                  r.status === "completed"
                                    ? "active"
                                    : r.status === "processing"
                                      ? "pending"
                                      : "inactive";
                                const pct =
                                  typeof r.percentage === "number"
                                    ? (r.percentage * 100).toFixed(1) + "%"
                                    : "—";
                                const canUpdate =
                                  r.status === "pending" ||
                                  r.status === "processing";
                                const actions = canUpdate
                                  ? `
                                        <button class="btn btn-small btn-primary" onclick="updateRefundStatus(${r.id}, 'completed')">Mark completed</button>
                                        ${r.status === "pending" ? `<button class="btn btn-small btn-secondary" onclick="updateRefundStatus(${r.id}, 'processing')">Mark processing</button>` : ""}
                                        <button class="btn btn-small btn-secondary" onclick="updateRefundStatus(${r.id}, 'failed')">Mark failed</button>
                                        <button class="btn btn-small" onclick="updateRefundStatus(${r.id}, 'cancelled')">Cancel</button>
                                      `
                                  : "—";
                                return `
                                    <tr>
                                        <td>${r.id}</td>
                                        <td>
                                            ${r.booking_code || "#" + r.booking_id}
                                            ${r.payment_id ? `<div style="font-size: 12px; color: #666;">Payment #${r.payment_id}</div>` : ""}
                                        </td>
                                        <td>
                                            ${r.client_name || "-"}
                                            ${r.client_email ? `<div style="font-size: 12px; color: #666;">${r.client_email}</div>` : ""}
                                        </td>
                                        <td>KES ${r.amount_original.toLocaleString()}</td>
                                        <td>KES ${r.amount_refund.toLocaleString()}</td>
                                        <td>${pct}</td>
                                        <td><span class="status-badge ${statusClass}">${r.status}</span></td>
                                        <td>
                                            <div style="max-width: 260px; font-size: 12px;">
                                                ${r.reason || "—"}
                                                ${r.internal_note ? `<div style="color: #666;"><strong>Note:</strong> ${r.internal_note}</div>` : ""}
                                            </div>
                                        </td>
                                        <td>
                                            ${r.processed_at ? new Date(r.processed_at).toLocaleString() : "—"}
                                            ${r.external_reference ? `<div style="font-size: 12px; color: #666;">Ref: ${r.external_reference}</div>` : ""}
                                        </td>
                                        <td>${actions}</td>
                                    </tr>
                                `;
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
      renderRefundPagination(data.total, data.limit, data.page);
    } else {
      content.innerHTML = '<div class="empty-state">No refunds found</div>';
      const pag = document.getElementById("refundsPagination");
      if (pag) pag.innerHTML = "";
    }
  } catch (error) {
    console.error("Error loading refunds:", error);
    content.innerHTML = `<div class="empty-state">Error loading refunds: ${error.message}</div>`;
  }
}

function renderRefundPagination(total, limit, page) {
  const pagination = document.getElementById("refundsPagination");
  if (!pagination) return;
  const totalPages = Math.ceil(total / limit) || 1;
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }
  let html = "";
  if (page > 1) {
    html += `<button class="btn btn-secondary" onclick="goToRefundPage(${page - 1})">Previous</button>`;
  }
  html += `<span style="padding: 0 15px;">Page ${page} of ${totalPages}</span>`;
  if (page < totalPages) {
    html += `<button class="btn btn-secondary" onclick="goToRefundPage(${page + 1})">Next</button>`;
  }
  pagination.innerHTML = html;
}

function goToRefundPage(page) {
  currentRefundPage = page;
  loadRefunds();
}

async function updateRefundStatus(id, newStatus) {
  const reasonPrompt =
    newStatus === "completed"
      ? "Optional internal note (e.g. PSP reference, confirmation details):"
      : "Optional internal note for this status change:";
  const note = await uiPrompt(reasonPrompt, {
    title: "Update refund",
    placeholder: "Internal note (optional)",
    multiline: true,
  });
  const ext = await uiPrompt("Optional PSP/Bank refund reference:", {
    title: "Update refund",
    placeholder: "PSP / Bank reference (optional)",
  });
  try {
    await api.updateRefund(id, {
      status: newStatus,
      internal_note: note || undefined,
      external_reference: ext || undefined,
    });
    await loadRefunds();
  } catch (error) {
    console.error("Error updating refund:", error);
    alert("Failed to update refund: " + (error.message || "Unknown error"));
  }
}
