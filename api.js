const API_BASE_URL = "https://api.ardena.xyz/api/v1";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function getSessionExpiry() {
  return Number(localStorage.getItem("admin_session_expiry") || "0");
}

function setSessionExpiry() {
  localStorage.setItem(
    "admin_session_expiry",
    String(Date.now() + SESSION_TIMEOUT_MS),
  );
}

function clearSessionStorage() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_info");
  localStorage.removeItem("admin_session_expiry");
}

function isSessionExpired() {
  const expiry = getSessionExpiry();
  return expiry > 0 && Date.now() >= expiry;
}

function logoutAndRedirect(message = "Session expired") {
  clearSessionStorage();
  if (message) {
    console.warn(message);
  }
  window.location.href = "index.html";
  throw new Error(message);
}

// Ping the current API to verify connectivity (call on load to confirm backend is reached)
async function checkApiReachable() {
  const url = API_BASE_URL + "/ping";
  try {
    const r = await fetch(url);
    const ok = r.ok;
    const data = ok ? await r.json().catch(() => ({})) : {};
    console.log("[Admin API]", API_BASE_URL, ok ? "OK" : r.status, data);
    return { ok, status: r.status, data };
  } catch (e) {
    console.warn("[Admin API] Cannot reach", url, e.message);
    return { ok: false, status: 0, error: e.message };
  }
}

// Get stored admin token
function getAuthToken() {
  return localStorage.getItem("admin_token");
}

// Get stored admin info
function getAdminInfo() {
  const info = localStorage.getItem("admin_info");
  return info ? JSON.parse(info) : null;
}

// Make authenticated API request
async function apiRequest(endpoint, options = {}) {
  if (isSessionExpired()) {
    logoutAndRedirect("Session expired. Please sign in again.");
  }

  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  console.log(`Making API request to: ${API_BASE_URL}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  console.log(`API response status: ${response.status}`, response.statusText);

  // Handle empty responses (like DELETE)
  let data;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = {};
  }

  if (response.status === 401) {
    // Unauthorized - redirect to login
    clearSessionStorage();
    window.location.href = "index.html";
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }

  return data;
}

// API methods
const api = {
  // Admin
  getCurrentAdmin: () => apiRequest("/admin/me"),
  logout: () => apiRequest("/admin/auth/logout", { method: "POST" }),

  // Dashboard
  getDashboardStats: () => apiRequest("/admin/dashboard/stats"),
  getRecentActivity: () => apiRequest("/admin/dashboard/activity"),
  getVerificationQueueStats: () =>
    apiRequest("/admin/dashboard/verification-queue"),
  getRevenueStats: () => apiRequest("/admin/dashboard/revenue"),
  getKycTrends: () => apiRequest("/admin/dashboard/kyc-trends"),
  getBookingTrends: (days = 14) =>
    apiRequest(`/admin/dashboard/booking-trends?days=${days}`),

  // Hosts
  getHosts: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/hosts${queryString ? "?" + queryString : ""}`);
  },
  getHost: (id) => apiRequest(`/admin/hosts/${id}`),
  updateHost: (id, data) =>
    apiRequest(`/admin/hosts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deactivateHost: (id) =>
    apiRequest(`/admin/hosts/${id}/deactivate`, { method: "PUT" }),
  activateHost: (id) =>
    apiRequest(`/admin/hosts/${id}/activate`, { method: "PUT" }),
  deleteHost: (id) => apiRequest(`/admin/hosts/${id}`, { method: "DELETE" }),
  getHostCars: (id) => apiRequest(`/admin/hosts/${id}/cars`),
  getHostPaymentMethods: (id) =>
    apiRequest(`/admin/hosts/${id}/payment-methods`),
  getHostFeedback: (id) => apiRequest(`/admin/hosts/${id}/feedback`),

  // Clients
  getClients: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/clients${queryString ? "?" + queryString : ""}`);
  },
  getClient: (id) => apiRequest(`/admin/clients/${id}`),
  updateClient: (id, data) =>
    apiRequest(`/admin/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deactivateClient: (id) =>
    apiRequest(`/admin/clients/${id}/deactivate`, { method: "PUT" }),
  activateClient: (id) =>
    apiRequest(`/admin/clients/${id}/activate`, { method: "PUT" }),
  deleteClient: (id) =>
    apiRequest(`/admin/clients/${id}`, { method: "DELETE" }),

  // Cars
  getCars: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/cars${queryString ? "?" + queryString : ""}`);
  },
  getCar: (id) => apiRequest(`/admin/cars/${id}`),
  getCarMedia: (id) => apiRequest(`/admin/cars/${id}/media`),
  approveCar: (id) =>
    apiRequest(`/admin/cars/${id}/approve`, { method: "PUT" }),
  rejectCar: (id, rejectionReason) =>
    apiRequest(`/admin/cars/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    }),
  updateCarStatus: (id, status, rejectionReason = null) => {
    const body = { verification_status: status };
    if (rejectionReason) {
      body.rejection_reason = rejectionReason;
    }
    return apiRequest(`/admin/cars/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  hideCar: (id) => apiRequest(`/admin/cars/${id}/hide`, { method: "PUT" }),
  showCar: (id) => apiRequest(`/admin/cars/${id}/show`, { method: "PUT" }),
  deleteCar: (id) => apiRequest(`/admin/cars/${id}`, { method: "DELETE" }),

  // Feedback
  getFeedback: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/feedback${queryString ? "?" + queryString : ""}`);
  },

  // Notifications
  broadcastToHosts: (data) =>
    apiRequest("/admin/notifications/broadcast-hosts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  broadcastToClients: (data) =>
    apiRequest("/admin/notifications/broadcast-clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  broadcastToClientsByPreferences: (data) =>
    apiRequest("/admin/notifications/broadcast-clients-preferences", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  sendToUser: (data) =>
    apiRequest("/admin/notifications/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Clients
  getClients: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/clients${queryString ? "?" + queryString : ""}`);
  },

  // Admin Management
  getAdmins: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/admins${queryString ? "?" + queryString : ""}`);
  },
  getAdmin: (id) => apiRequest(`/admin/admins/${id}`),
  createAdmin: (data) =>
    apiRequest("/admin/admins", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // Invite flow: server generates a temp password and emails credentials (no password sent). See invite.md
  inviteAdmin: (data) =>
    apiRequest("/admin/admins/invite", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  resendAdminCredentials: (id) =>
    apiRequest(`/admin/admins/${id}/resend-credentials`, { method: "POST" }),
  updateAdmin: (id, data) =>
    apiRequest(`/admin/admins/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAdmin: (id) => apiRequest(`/admin/admins/${id}`, { method: "DELETE" }),
  changeAdminPassword: (id, data) =>
    apiRequest(`/admin/admins/${id}/password`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  activateAdmin: (id) =>
    apiRequest(`/admin/admins/${id}/activate`, { method: "PUT" }),
  deactivateAdmin: (id) =>
    apiRequest(`/admin/admins/${id}/deactivate`, { method: "PUT" }),

  // Own Profile Management
  updateOwnProfile: (data) =>
    apiRequest("/admin/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  changeOwnPassword: (data) =>
    apiRequest("/admin/change-password", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Payment Methods
  getPaymentMethods: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/payment-methods${queryString ? "?" + queryString : ""}`,
    );
  },
  getPaymentMethod: (id) => apiRequest(`/admin/payment-methods/${id}`),
  deletePaymentMethod: (id) =>
    apiRequest(`/admin/payment-methods/${id}`, { method: "DELETE" }),

  // Support Conversations
  getSupportConversations: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/support/conversations${queryString ? "?" + queryString : ""}`,
    );
  },
  getSupportConversation: (id) =>
    apiRequest(`/admin/support/conversations/${id}`),
  respondToSupportConversation: (id, message) =>
    apiRequest(`/admin/support/conversations/${id}/respond`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  closeSupportConversation: (id) =>
    apiRequest(`/admin/support/conversations/${id}/close`, { method: "PUT" }),
  reopenSupportConversation: (id) =>
    apiRequest(`/admin/support/conversations/${id}/reopen`, { method: "PUT" }),

  // Bookings
  getBookings: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/bookings${queryString ? "?" + queryString : ""}`);
  },
  getBooking: (bookingId) => apiRequest(`/admin/bookings/${bookingId}`),
  updateBookingStatus: (bookingId, newStatus, reason = null) => {
    const params = new URLSearchParams({ new_status: newStatus });
    if (reason) params.append("reason", reason);
    return apiRequest(
      `/admin/bookings/${bookingId}/status?${params.toString()}`,
      { method: "PUT" },
    );
  },
  cancelBooking: (bookingId, reason = null) => {
    const params = reason ? new URLSearchParams({ reason }) : "";
    return apiRequest(
      `/admin/bookings/${bookingId}/cancel${params ? "?" + params.toString() : ""}`,
      { method: "POST" },
    );
  },
  confirmBooking: (bookingId) =>
    apiRequest(`/admin/bookings/${bookingId}/confirm`, { method: "POST" }),
  deleteBooking: (bookingId) =>
    apiRequest(`/admin/bookings/${bookingId}`, { method: "DELETE" }),
  getBookingStats: () => apiRequest("/admin/bookings/stats"),

  // Refunds
  getRefunds: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/refunds${queryString ? "?" + queryString : ""}`);
  },
  getRefund: (id) => apiRequest(`/admin/refunds/${id}`),
  createRefund: (data) =>
    apiRequest("/admin/refunds", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRefund: (id, data) =>
    apiRequest(`/admin/refunds/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Withdrawals
  getWithdrawals: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/withdrawals${queryString ? "?" + queryString : ""}`,
    );
  },
  getWithdrawal: (id) => apiRequest(`/admin/withdrawals/${id}`),
  updateWithdrawalStatus: (id, data) =>
    apiRequest(`/admin/withdrawals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Referrers (who referred whom) — see refferals.md
  // Hosts who referred other hosts
  getReferrers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/referrers${queryString ? "?" + queryString : ""}`,
    );
  },
  getReferrer: (hostId) => apiRequest(`/admin/referrers/${hostId}`),
  // Clients who referred hosts (parity)
  getClientReferrers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/client-referrers${queryString ? "?" + queryString : ""}`,
    );
  },
  getClientReferrer: (clientId) =>
    apiRequest(`/admin/client-referrers/${clientId}`),

  // Client referral earnings (client referred a host) — see refferals.md §1
  getClientReferralEarnings: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/client-referral-earnings${queryString ? "?" + queryString : ""}`,
    );
  },
  reverseClientReferralEarning: (id, reason) =>
    apiRequest(`/admin/client-referral-earnings/${id}/reverse`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Subscribers (newsletter)
  getSubscribers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/subscribers${queryString ? "?" + queryString : ""}`,
    );
  },
  getSubscriberCount: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/subscribers/count${queryString ? "?" + queryString : ""}`,
    );
  },
  getSubscriberTrends: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/subscribers/trends${queryString ? "?" + queryString : ""}`,
    );
  },
  sendNewsletter: (data) =>
    apiRequest("/admin/subscribers/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Bulk email service — send a branded email to all clients and/or all hosts.
  // Backend wraps the body in the Ardena template + per-recipient unsubscribe. See emails.md
  sendBulkEmail: (data) =>
    apiRequest("/admin/emails/send", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // Send a single test email to one address using the same template. See test.md
  sendTestEmail: (data) =>
    apiRequest("/admin/emails/test", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Ratings moderation
  getRatings: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/ratings${queryString ? "?" + queryString : ""}`);
  },
  getRatingsStats: () => apiRequest("/admin/ratings/stats"),
  getRating: (ratingType, ratingId) =>
    apiRequest(`/admin/ratings/${ratingType}/${ratingId}`),
  deleteRating: (ratingType, ratingId) =>
    apiRequest(`/admin/ratings/${ratingType}/${ratingId}`, {
      method: "DELETE",
    }),

  // Secondary contacts
  getSecondaryContacts: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/secondary-contacts${queryString ? "?" + queryString : ""}`,
    );
  },
  getSecondaryContactsStats: () =>
    apiRequest("/admin/secondary-contacts/stats"),
  getSecondaryContact: (clientId) =>
    apiRequest(`/admin/secondary-contacts/${clientId}`),
  clearSecondaryContact: (clientId) =>
    apiRequest(`/admin/secondary-contacts/${clientId}`, { method: "DELETE" }),

  // B2B (Ardena for Business) — access requests, workspaces, credentials. See b2b.md
  getB2BAccessRequests: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/b2b/access-requests${queryString ? "?" + queryString : ""}`,
    );
  },
  getB2BAccessRequest: (id) => apiRequest(`/admin/b2b/access-requests/${id}`),
  // Approve: server creates the business + Owner login, emails the credentials
  // and returns them ONCE for manual handover.
  approveB2BAccessRequest: (id, data = {}) =>
    apiRequest(`/admin/b2b/access-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  rejectB2BAccessRequest: (id, reason = null) =>
    apiRequest(`/admin/b2b/access-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  getB2BBusinesses: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/b2b/businesses${queryString ? "?" + queryString : ""}`,
    );
  },
  // Direct creation (sales-led onboarding, no access request)
  createB2BBusiness: (data) =>
    apiRequest("/admin/b2b/businesses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getB2BBusinessUsers: (businessId) =>
    apiRequest(`/admin/b2b/businesses/${businessId}/users`),
  resetB2BUserPassword: (userId) =>
    apiRequest(`/admin/b2b/users/${userId}/reset-password`, {
      method: "POST",
    }),
  activateB2BUser: (userId) =>
    apiRequest(`/admin/b2b/users/${userId}/activate`, { method: "PUT" }),
  deactivateB2BUser: (userId) =>
    apiRequest(`/admin/b2b/users/${userId}/deactivate`, { method: "PUT" }),
  activateB2BBusiness: (businessId) =>
    apiRequest(`/admin/b2b/businesses/${businessId}/activate`, {
      method: "PUT",
    }),
  deactivateB2BBusiness: (businessId) =>
    apiRequest(`/admin/b2b/businesses/${businessId}/deactivate`, {
      method: "PUT",
    }),

  // Permanently deletes a workspace and everything under it. Backend endpoint
  // is specified in b2b.md — not implemented server-side yet.
  deleteB2BBusiness: (businessId) =>
    apiRequest(`/admin/b2b/businesses/${businessId}`, {
      method: "DELETE",
    }),

  // B2B fleet: every vehicle in every business fleet, and how far it has got
  // towards the Ardena consumer app. Rows are keyed on vehicle_id, NOT on the
  // marketplace listing — a vehicle a business has added but never offered has
  // no listing, and those are exactly the rows that used to go missing.
  // Two independent gates decide visibility: the business publishing their
  // listing, and our verification_status. `blocked_by` says which one is
  // holding a car back.
  getB2BFleetCars: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/b2b/fleet/cars${queryString ? "?" + queryString : ""}`,
    );
  },
  getB2BFleetStats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/b2b/fleet/cars/stats${queryString ? "?" + queryString : ""}`,
    );
  },
  getB2BFleetCar: (vehicleId) =>
    apiRequest(`/admin/b2b/fleet/cars/${vehicleId}`),
  // "Make visible in the Ardena app". Returns { car, message } — read the
  // message: approving a car the business has hidden themselves does NOT put it
  // on the app, and the message is what says so.
  approveB2BFleetCar: (vehicleId) =>
    apiRequest(`/admin/b2b/fleet/cars/${vehicleId}/approve`, {
      method: "POST",
    }),
  rejectB2BFleetCar: (vehicleId, reason) =>
    apiRequest(`/admin/b2b/fleet/cars/${vehicleId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Permanently removes a fleet vehicle, its listing and its app car. Backend
  // endpoint is specified in b2b.md — not implemented server-side yet.
  deleteB2BFleetVehicle: (vehicleId) =>
    apiRequest(`/admin/b2b/fleet/cars/${vehicleId}`, {
      method: "DELETE",
    }),

  // B2B support (see support.md §2). Unlike /admin/support/* there is no
  // conversation row: b2b_support_messages is one flat thread per business, so
  // the unit of the inbox is the BUSINESS and a thread is addressed by
  // business_id. Paging is skip/limit like the rest of /admin/b2b/*, not the
  // page/limit of /admin/support/*.
  getB2BSupportThreads: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/b2b/support/threads${queryString ? "?" + queryString : ""}`,
    );
  },
  // Whole thread oldest-first plus the business header. Marks nothing read —
  // `read` is the business's badge, admin-side seen state is not modelled.
  // An empty thread is a 200; only an unknown business_id is a 404.
  getB2BSupportThread: (businessId) =>
    apiRequest(`/admin/b2b/support/threads/${businessId}`),
  // Writes from_role="support", read=false — the false is what raises the
  // unread badge on their dashboard — and sends a B2BNotification.
  replyToB2BSupportThread: (businessId, text) =>
    apiRequest(`/admin/b2b/support/threads/${businessId}/reply`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  // Whole backlog of threads whose newest message is from the business.
  getB2BSupportUnansweredCount: () =>
    apiRequest("/admin/b2b/support/unanswered-count"),

  // Listing reports (moderation queue) — see reports.md
  getListingReports: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(
      `/admin/listing-reports${queryString ? "?" + queryString : ""}`,
    );
  },
  getListingReport: (reportId) =>
    apiRequest(`/admin/listing-reports/${reportId}`),
  updateListingReportStatus: (reportId, status) =>
    apiRequest(`/admin/listing-reports/${reportId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  deleteListingReport: (reportId) =>
    apiRequest(`/admin/listing-reports/${reportId}`, { method: "DELETE" }),
};
