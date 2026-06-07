// js/pages/payment-methods.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// ==================== PAYMENT METHODS MANAGEMENT ====================

// Payment method management state
let currentPaymentMethodSearch = "";
let currentPaymentMethodTypeFilter = "";
let currentPaymentMethodHostFilter = "";
let paymentMethodSearchTimeout = null;

// Setup payment method search and filters
function setupPaymentMethodSearch() {
  const searchInput = document.getElementById("paymentMethodSearch");
  const typeFilter = document.getElementById("paymentMethodTypeFilter");
  const hostFilter = document.getElementById("paymentMethodHostFilter");

  if (searchInput && !searchInput.oninput) {
    searchInput.oninput = (e) => {
      clearTimeout(paymentMethodSearchTimeout);
      paymentMethodSearchTimeout = setTimeout(() => {
        currentPaymentMethodSearch = e.target.value;
        loadPaymentMethods();
      }, 300);
    };
  }

  if (typeFilter && !typeFilter.onchange) {
    typeFilter.onchange = (e) => {
      currentPaymentMethodTypeFilter = e.target.value;
      loadPaymentMethods();
    };
  }

  if (hostFilter && !hostFilter.oninput) {
    hostFilter.oninput = (e) => {
      clearTimeout(paymentMethodSearchTimeout);
      paymentMethodSearchTimeout = setTimeout(() => {
        currentPaymentMethodHostFilter = e.target.value;
        loadPaymentMethods();
      }, 300);
    };
  }
}

// Load payment methods
async function loadPaymentMethods() {
  const content = document.getElementById("paymentMethodsContent");

  setupPaymentMethodSearch();

  try {
    const params = { limit: 50 };
    if (currentPaymentMethodSearch) {
      params.search = currentPaymentMethodSearch;
    }
    if (currentPaymentMethodTypeFilter) {
      params.method_type = currentPaymentMethodTypeFilter;
    }
    if (currentPaymentMethodHostFilter) {
      params.host_id = parseInt(currentPaymentMethodHostFilter);
    }

    const data = await api.getPaymentMethods(params);
    if (data.payment_methods && data.payment_methods.length > 0) {
      content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Host</th>
                                <th>Details</th>
                                <th>Default</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.payment_methods
                              .map(
                                (pm) => `
                                <tr>
                                    <td>${pm.name || "N/A"}</td>
                                    <td>${pm.method_type || "N/A"}</td>
                                    <td>
                                        <div>${pm.host_name || "N/A"}</div>
                                        <div style="font-size: 12px; color: #666;">${pm.host_email || ""}</div>
                                    </td>
                                    <td>
                                        ${
                                          pm.method_type === "mpesa"
                                            ? `<div>${pm.mpesa_number || "N/A"}</div>`
                                            : pm.method_type === "visa" ||
                                                pm.method_type === "mastercard"
                                              ? `<div>****${pm.card_last_four || "****"}</div>
                                               <div style="font-size: 12px; color: #666;">${pm.expiry_date || "N/A"}</div>`
                                              : "N/A"
                                        }
                                    </td>
                                    <td>${pm.is_default ? '<span class="status-badge active">Yes</span>' : '<span class="status-badge inactive">No</span>'}</td>
                                    <td>${new Date(pm.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-primary btn-small" onclick="viewPaymentMethodDetails(${pm.id})">View</button>
                                        <button class="btn btn-danger btn-small" onclick="deletePaymentMethodConfirm(${pm.id}, '${pm.name}')">Delete</button>
                                    </td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
    } else {
      content.innerHTML =
        '<div class="empty-state">No payment methods found</div>';
    }
  } catch (error) {
    console.error("Error loading payment methods:", error);
    content.innerHTML =
      '<div class="empty-state">Error loading payment methods</div>';
  }
}

// Back to payment methods list
function backToPaymentMethodsList() {
  loadPage("payment-methods");
}

// View payment method details
async function viewPaymentMethodDetails(paymentMethodId) {
  document.querySelectorAll(".page-content").forEach((p) => {
    p.style.display = "none";
  });

  const paymentMethodDetailPage = document.getElementById(
    "paymentMethodDetailPage",
  );
  const paymentMethodDetailContent = document.getElementById(
    "paymentMethodDetailContent",
  );
  const paymentMethodDetailTitle = document.getElementById(
    "paymentMethodDetailTitle",
  );

  paymentMethodDetailPage.style.display = "block";
  document.getElementById("pageTitle").textContent = "Payment Method Details";
  paymentMethodDetailContent.innerHTML =
    '<div class="loading">Loading payment method details...</div>';

  try {
    const pm = await api.getPaymentMethod(paymentMethodId);
    paymentMethodDetailTitle.textContent = pm.name || "Payment Method Details";

    paymentMethodDetailContent.innerHTML = `
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Payment Method Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${pm.name || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Type:</div>
                        <div class="detail-value">${pm.method_type || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Default:</div>
                        <div class="detail-value">
                            <span class="status-badge ${pm.is_default ? "active" : "inactive"}">
                                ${pm.is_default ? "Yes" : "No"}
                            </span>
                        </div>
                    </div>
                    ${
                      pm.method_type === "mpesa"
                        ? `
                    <div class="detail-row">
                        <div class="detail-label">M-Pesa Number:</div>
                        <div class="detail-value">${pm.mpesa_number || "N/A"}</div>
                    </div>
                    `
                        : ""
                    }
                    ${
                      pm.method_type === "visa" ||
                      pm.method_type === "mastercard"
                        ? `
                    <div class="detail-row">
                        <div class="detail-label">Card Number:</div>
                        <div class="detail-value">****${pm.card_last_four || "****"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Card Type:</div>
                        <div class="detail-value">${pm.card_type || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Expiry Date:</div>
                        <div class="detail-value">${pm.expiry_date || "N/A"}</div>
                    </div>
                    `
                        : ""
                    }
                </div>
                
                <div class="host-detail-section">
                    <h3>Host Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Host Name:</div>
                        <div class="detail-value">${pm.host_name || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Host Email:</div>
                        <div class="detail-value">${pm.host_email || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Host ID:</div>
                        <div class="detail-value">${pm.host_id || "N/A"}</div>
                    </div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Account Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Created:</div>
                    <div class="detail-value">${new Date(pm.created_at).toLocaleString()}</div>
                </div>
                ${
                  pm.updated_at
                    ? `
                <div class="detail-row">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">${new Date(pm.updated_at).toLocaleString()}</div>
                </div>
                `
                    : ""
                }
            </div>
            
            <div class="action-buttons" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
                <button class="btn btn-danger" onclick="deletePaymentMethodConfirm(${pm.id}, '${pm.name}', true)">Delete Payment Method</button>
            </div>
        `;
  } catch (error) {
    console.error("Error loading payment method details:", error);
    paymentMethodDetailContent.innerHTML = `<div class="empty-state">Error loading payment method details: ${error.message}</div>`;
  }
}

// Delete payment method confirmation
async function deletePaymentMethodConfirm(
  paymentMethodId,
  paymentMethodName,
  reloadAfter = false,
) {
  if (
    !(await uiConfirm(
      `Are you sure you want to permanently delete payment method "${paymentMethodName}"? This action cannot be undone.`,
    ))
  ) {
    return;
  }

  deletePaymentMethod(paymentMethodId, reloadAfter);
}

// Delete payment method
async function deletePaymentMethod(paymentMethodId, reloadAfter = false) {
  try {
    await api.deletePaymentMethod(paymentMethodId);
    alert("Payment method deleted successfully");
    if (reloadAfter) {
      backToPaymentMethodsList();
    } else {
      loadPaymentMethods();
    }
  } catch (error) {
    alert("Error deleting payment method: " + error.message);
  }
}
