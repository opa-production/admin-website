// js/core/helpers.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// Host management state
const LIST_PAGE_SIZE = 50;

// Page through a list endpoint and return every row (client-side filtering needs
// the whole dataset, not just one page). Uses a limit we know the backend honors.
async function fetchAllPaged(apiFn, key) {
  const all = [];
  const limit = 50;
  let page = 1;
  while (page <= 200) {
    // hard cap (10k rows) guards against an endpoint that never shrinks a page
    const data = await apiFn({ limit, page });
    const rows = (data && data[key]) || [];
    all.push(...rows);
    if (rows.length < limit) break;
    page++;
  }
  return all;
}

// Generic list pagination renderer (hosts/clients).
// Falls back to a "there may be more" Next button when the backend
// doesn't return a total count: enabled while the page is full.
function renderListPagination(containerId, currentPage, returnedCount, limit, total, goFn) {
  const pagination = document.getElementById(containerId);
  if (!pagination) return;

  const totalPages = total != null && total > 0 ? Math.ceil(total / limit) : null;
  const hasPrev = currentPage > 1;
  const hasNext = totalPages ? currentPage < totalPages : returnedCount === limit;

  if (!hasPrev && !hasNext) {
    pagination.innerHTML = "";
    return;
  }

  let html = "";
  if (hasPrev) {
    html += `<button class="btn btn-secondary" onclick="${goFn}(${currentPage - 1})">Previous</button>`;
  }
  html += `<span style="padding: 0 15px;">Page ${currentPage}${totalPages ? ` of ${totalPages}` : ""}</span>`;
  if (hasNext) {
    html += `<button class="btn btn-secondary" onclick="${goFn}(${currentPage + 1})">Next</button>`;
  }
  pagination.innerHTML = html;
}

// Load hosts
// Map backend KYC status -> UI label + badge class (see kyccheck.md)
const KYC_LABEL = {
    not_started: { label: 'Not Started', cls: 'kyc-not-started' },
    pending:     { label: 'Pending',     cls: 'kyc-pending' },
    approved:    { label: 'Verified',    cls: 'kyc-verified' },
    declined:    { label: 'Failed',      cls: 'kyc-failed' },
};

function kycBadge(status) {
    const meta = KYC_LABEL[status] || KYC_LABEL.not_started;
    return `<span class="status-badge ${meta.cls}">${meta.label}</span>`;
}

// ---- Client detail helpers ----

function fmtDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
}

function fmtDateTime(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleString();
}

const SECONDARY_CONTACT_LABEL = {
  not_started: { label: "Not Started", cls: "inactive" },
  pending: { label: "Pending", cls: "pending" },
  verified: { label: "Verified", cls: "active" },
};

function secondaryContactBadge(status) {
  const meta =
    SECONDARY_CONTACT_LABEL[status] || SECONDARY_CONTACT_LABEL.not_started;
  return `<span class="status-badge ${meta.cls}">${meta.label}</span>`;
}

function verifiedBadge(isVerified) {
  return isVerified
    ? '<span class="status-badge active">Verified</span>'
    : '<span class="status-badge inactive">Unverified</span>';
}
function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

/** Escape for plain text / element text content */
function escapeHtmlText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Normalize car media API payload — backend may use snake_case or camelCase;
 * image_urls might be an array, a single string, or a JSON string.
 */

const REFERRAL_STATUS_LABEL = {
  pending: { label: "Pending", cls: "pending" },
  approved: { label: "Approved", cls: "active" },
  reversed: { label: "Reversed", cls: "inactive" },
};

function referralStatusBadge(status) {
  const meta = REFERRAL_STATUS_LABEL[status] || {
    label: status || "—",
    cls: "kyc-not-started",
  };
  return `<span class="status-badge ${meta.cls}">${meta.label}</span>`;
}

function referralKindBadge(kind) {
  const label =
    kind === "first_booking"
      ? "First booking"
      : kind === "listing"
        ? "Listing"
        : kind || "—";
  return `<span class="status-badge kyc-not-started">${label}</span>`;
}

// Format a KES amount (amounts arrive as *_ksh numbers)
function fmtKes(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(n)) return "KES 0";
  return (
    "KES " +
    n.toLocaleString("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

function notifIconSvg(tone) {
  switch (tone) {
    case "success":
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    case "warning":
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    case "error":
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    default:
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  }
}

function showNotifResult(el, tone, html) {
  if (!el) return;
  el.className = `notif-result notif-result-${tone}`;
  el.innerHTML = html;
}

// ==================== Support Conversations ====================

// Helper functions
function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleString();
  } catch (e) {
    return dateString;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  const palette = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#0ea5e9",
    "#ef4444",
    "#14b8a6",
    "#f97316",
    "#a855f7",
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++)
    hash = (name.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString();
  } catch (e) {
    return "";
  }
}

function formatTimeShort(dateString) {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "";
  }
}

function formatDateLabel(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return "";
  }
}
