// js/pages/bookings.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// ==================== BOOKING MANAGEMENT ====================

// Booking management state
let currentBookingPage = 1;
let currentBookingSearch = "";
let currentBookingStatus = "";
let bookingSearchTimeout = null;

// Setup booking search
function setupBookingSearch() {
  const searchInput = document.getElementById("bookingSearch");
  const statusFilter = document.getElementById("bookingStatusFilter");

  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(bookingSearchTimeout);
      bookingSearchTimeout = setTimeout(() => {
        currentBookingSearch = e.target.value;
        currentBookingPage = 1;
        loadBookings();
      }, 300);
    };
  }

  if (statusFilter) {
    statusFilter.onchange = (e) => {
      currentBookingStatus = e.target.value;
      currentBookingPage = 1;
      loadBookings();
    };
  }
}

// Load bookings
async function loadBookings() {
  const content = document.getElementById("bookingsContent");
  if (!content) return;

  setupBookingSearch();

  try {
    content.innerHTML = '<div class="loading">Loading bookings...</div>';

    const params = {
      page: currentBookingPage,
      limit: 20,
    };

    if (currentBookingStatus) {
      params.status = currentBookingStatus;
    }

    if (currentBookingSearch) {
      params.search = currentBookingSearch;
    }

    const data = await api.getBookings(params);

    if (data.bookings && data.bookings.length > 0) {
      content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Booking ID</th>
                                <th>Client</th>
                                <th>Host</th>
                                <th>Car</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Total Price</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.bookings
                              .map(
                                (booking) => `
                                <tr>
                                    <td><strong>${booking.booking_id}</strong></td>
                                    <td>${booking.client_name || "N/A"}</td>
                                    <td>${booking.host_name || "N/A"}</td>
                                    <td>${booking.car_name || booking.car_model || "N/A"}</td>
                                    <td>${new Date(booking.start_date).toLocaleDateString()}</td>
                                    <td>${new Date(booking.end_date).toLocaleDateString()}</td>
                                    <td>KES ${booking.total_price.toLocaleString()}</td>
                                    <td><span class="status-badge ${getBookingStatusClass(booking.status)}">${booking.status}</span></td>
                                    <td class="booking-actions-cell">
                                        <button class="btn btn-small btn-primary" onclick="viewBookingDetails('${booking.booking_id}')">View</button>
                                        ${getBookingActionButtons(booking)}
                                    </td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;

      // Add pagination
      renderBookingPagination(data.total, data.limit, data.skip);
    } else {
      content.innerHTML = '<div class="empty-state">No bookings found</div>';
    }
  } catch (error) {
    console.error("Error loading bookings:", error);
    content.innerHTML = `<div class="empty-state">Error loading bookings: ${error.message}</div>`;
  }
}

// Get booking status CSS class
function getBookingStatusClass(status) {
  const statusMap = {
    pending: "inactive",
    confirmed: "active",
    active: "active",
    completed: "active",
    cancelled: "inactive",
    rejected: "inactive",
  };
  return statusMap[status.toLowerCase()] || "inactive";
}

// Get booking action buttons based on status
function getBookingActionButtons(booking) {
  const status = booking.status.toLowerCase();
  let buttons = "";

  if (status === "pending") {
    buttons += `<button class="btn btn-small btn-primary" onclick="confirmBooking('${booking.booking_id}')">Confirm</button>`;
    buttons += `<button class="btn btn-small btn-danger" onclick="cancelBookingPrompt('${booking.booking_id}')">Cancel</button>`;
  } else if (status === "confirmed") {
    buttons += `<button class="btn btn-small btn-danger" onclick="cancelBookingPrompt('${booking.booking_id}')">Cancel</button>`;
  } else if (status === "active") {
    buttons += `<button class="btn btn-small" onclick="updateBookingStatusPrompt('${booking.booking_id}', 'completed')">Mark Complete</button>`;
  }

  if (status !== "active" && status !== "completed") {
    buttons += `<button class="btn-icon btn-danger" onclick="deleteBookingPrompt('${booking.booking_id}')" title="Delete booking">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>`;
  }

  return buttons;
}

// Render booking pagination
function renderBookingPagination(total, limit, skip) {
  const pagination = document.getElementById("bookingsPagination");
  if (!pagination) return;

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(skip / limit) + 1;

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = "";

  // Previous button
  if (currentPage > 1) {
    html += `<button class="btn btn-secondary" onclick="goToBookingPage(${currentPage - 1})">Previous</button>`;
  }

  // Page numbers
  html += `<span style="padding: 0 15px;">Page ${currentPage} of ${totalPages}</span>`;

  // Next button
  if (currentPage < totalPages) {
    html += `<button class="btn btn-secondary" onclick="goToBookingPage(${currentPage + 1})">Next</button>`;
  }

  pagination.innerHTML = html;
}

// Go to booking page
function goToBookingPage(page) {
  currentBookingPage = page;
  loadBookings();
}

// View booking details
async function viewBookingDetails(bookingId) {
  const detailPage = document.getElementById("bookingDetailPage");
  const listPage = document.getElementById("bookingsPage");
  const content = document.getElementById("bookingDetailContent");
  const title = document.getElementById("bookingDetailTitle");

  if (!detailPage || !content) return;

  try {
    listPage.style.display = "none";
    detailPage.style.display = "block";
    content.innerHTML = '<div class="loading">Loading booking details...</div>';

    if (title) {
      title.textContent = `Booking: ${bookingId}`;
    }

    const booking = await api.getBooking(bookingId);

    content.innerHTML = `
            <div class="host-detail-section">
                <h3>Booking Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Booking ID</div>
                    <div class="detail-value"><strong>${booking.booking_id}</strong></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">
                        <span class="status-badge ${getBookingStatusClass(booking.status)}">${booking.status}</span>
                    </div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Created At</div>
                    <div class="detail-value">${new Date(booking.created_at).toLocaleString()}</div>
                </div>
                ${
                  booking.status_updated_at
                    ? `
                <div class="detail-row">
                    <div class="detail-label">Status Updated At</div>
                    <div class="detail-value">${new Date(booking.status_updated_at).toLocaleString()}</div>
                </div>
                `
                    : ""
                }
            </div>
            
            <div class="host-detail-section">
                <h3>Client Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Client ID</div>
                    <div class="detail-value">${booking.client_id}</div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Car Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Car ID</div>
                    <div class="detail-value">${booking.car_id}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Car Name</div>
                    <div class="detail-value">${booking.car_name || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Model</div>
                    <div class="detail-value">${booking.car_model || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Year</div>
                    <div class="detail-value">${booking.car_year || "N/A"}</div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Host Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Host ID</div>
                    <div class="detail-value">${booking.host_id || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Host Name</div>
                    <div class="detail-value">${booking.host_name || "N/A"}</div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Rental Period</h3>
                <div class="detail-row">
                    <div class="detail-label">Start Date</div>
                    <div class="detail-value">${new Date(booking.start_date).toLocaleString()}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">End Date</div>
                    <div class="detail-value">${new Date(booking.end_date).toLocaleString()}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Rental Days</div>
                    <div class="detail-value">${booking.rental_days} days</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Pickup Time</div>
                    <div class="detail-value">${booking.pickup_time || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Return Time</div>
                    <div class="detail-value">${booking.return_time || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Pickup Location</div>
                    <div class="detail-value">${booking.pickup_location || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Return Location</div>
                    <div class="detail-value">${booking.return_location || "N/A"}</div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Pricing</h3>
                <div class="detail-row">
                    <div class="detail-label">Daily Rate</div>
                    <div class="detail-value">KES ${booking.daily_rate.toLocaleString()}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Base Price</div>
                    <div class="detail-value">KES ${booking.base_price.toLocaleString()}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Damage Waiver</div>
                    <div class="detail-value">${booking.damage_waiver_enabled ? `KES ${booking.damage_waiver_fee.toLocaleString()}` : "Not enabled"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Total Price</div>
                    <div class="detail-value"><strong>KES ${booking.total_price.toLocaleString()}</strong></div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Options</h3>
                <div class="detail-row">
                    <div class="detail-label">Drive Type</div>
                    <div class="detail-value">${booking.drive_type || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Check-in Preference</div>
                    <div class="detail-value">${booking.check_in_preference || "N/A"}</div>
                </div>
                ${
                  booking.special_requirements
                    ? `
                <div class="detail-row">
                    <div class="detail-label">Special Requirements</div>
                    <div class="detail-value">${booking.special_requirements}</div>
                </div>
                `
                    : ""
                }
            </div>
            
            ${
              booking.cancellation_reason
                ? `
            <div class="host-detail-section">
                <h3>Cancellation</h3>
                <div class="detail-row">
                    <div class="detail-label">Reason</div>
                    <div class="detail-value">${booking.cancellation_reason}</div>
                </div>
            </div>
            `
                : ""
            }
            
            <div class="action-buttons">
                ${getBookingDetailActions(booking)}
            </div>
        `;
  } catch (error) {
    console.error("Error loading booking details:", error);
    content.innerHTML = `<div class="empty-state">Error loading booking details: ${error.message}</div>`;
  }
}

// Get booking detail action buttons
function getBookingDetailActions(booking) {
  const status = booking.status.toLowerCase();
  let buttons = "";

  if (status === "pending") {
    buttons += `<button class="btn btn-primary" onclick="confirmBooking('${booking.booking_id}')">Confirm Booking</button>`;
    buttons += `<button class="btn btn-danger" onclick="cancelBookingPrompt('${booking.booking_id}')">Cancel Booking</button>`;
  } else if (status === "confirmed") {
    buttons += `<button class="btn btn-danger" onclick="cancelBookingPrompt('${booking.booking_id}')">Cancel Booking</button>`;
  } else if (status === "active") {
    buttons += `<button class="btn btn-primary" onclick="updateBookingStatusPrompt('${booking.booking_id}', 'completed')">Mark as Completed</button>`;
  }

  if (status !== "active" && status !== "completed") {
    buttons += `<button class="btn btn-danger" onclick="deleteBookingPrompt('${booking.booking_id}')">Delete Booking</button>`;
  }

  return buttons;
}

// Back to bookings list
function backToBookingsList() {
  loadPage("bookings");
}

// Confirm booking
async function confirmBooking(bookingId) {
  if (!confirm("Are you sure you want to confirm this booking?")) {
    return;
  }

  try {
    await api.confirmBooking(bookingId);
    alert("Booking confirmed successfully");
    if (document.getElementById("bookingDetailPage").style.display !== "none") {
      viewBookingDetails(bookingId);
    } else {
      loadBookings();
    }
  } catch (error) {
    alert("Error confirming booking: " + error.message);
  }
}

// Cancel booking prompt
function cancelBookingPrompt(bookingId) {
  const reason = prompt("Enter cancellation reason (optional):");
  if (reason !== null) {
    cancelBooking(bookingId, reason || null);
  }
}

// Cancel booking
async function cancelBooking(bookingId, reason = null) {
  try {
    await api.cancelBooking(bookingId, reason);
    alert("Booking cancelled successfully");
    if (document.getElementById("bookingDetailPage").style.display !== "none") {
      viewBookingDetails(bookingId);
    } else {
      loadBookings();
    }
  } catch (error) {
    alert("Error cancelling booking: " + error.message);
  }
}

// Update booking status prompt
function updateBookingStatusPrompt(bookingId, newStatus) {
  const statusLabels = {
    completed: "completed",
    cancelled: "cancelled",
    rejected: "rejected",
  };

  const label = statusLabels[newStatus] || newStatus;
  const reason = prompt(`Enter reason for marking as ${label} (optional):`);

  if (reason !== null) {
    updateBookingStatus(bookingId, newStatus, reason || null);
  }
}

// Update booking status
async function updateBookingStatus(bookingId, newStatus, reason = null) {
  try {
    await api.updateBookingStatus(bookingId, newStatus, reason);
    alert(`Booking status updated to ${newStatus}`);
    if (document.getElementById("bookingDetailPage").style.display !== "none") {
      viewBookingDetails(bookingId);
    } else {
      loadBookings();
    }
  } catch (error) {
    alert("Error updating booking status: " + error.message);
  }
}

// Delete booking prompt
function deleteBookingPrompt(bookingId) {
  if (
    !confirm(
      "Are you sure you want to permanently delete this booking? This action cannot be undone.",
    )
  ) {
    return;
  }

  deleteBooking(bookingId);
}

// Delete booking
async function deleteBooking(bookingId) {
  try {
    await api.deleteBooking(bookingId);
    alert("Booking deleted successfully");
    backToBookingsList();
  } catch (error) {
    alert("Error deleting booking: " + error.message);
  }
}
