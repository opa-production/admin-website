// js/core/shell.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.

// ---------------------------------------------------------------------------
// Sidebar shell: the navigation is defined ONCE here and rendered into every
// page, so the sidebar can never diverge between pages (this is what caused the
// old reports page to show a shrunken nav). Add/rename/reorder pages here only.
// ---------------------------------------------------------------------------

// Inline line-icons (20x20, stroke = currentColor) keyed by name.
const NAV_ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect>',
  hosts: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path>',
  clients: '<circle cx="9" cy="8" r="3.2"></circle><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"></path><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1"></path><path d="M17 14.5c2.4.5 4 2.2 4 4.5"></path>',
  cars: '<path d="M3 13l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5"></path><path d="M3 13h18v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1z"></path>',
  feedback: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
  notifications: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path>',
  'payment-methods': '<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>',
  bookings: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
  withdrawals: '<rect x="2" y="5" width="20" height="14" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle>',
  referrals: '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="10.7" x2="15.4" y2="6.3"></line><line x1="8.6" y1="13.3" x2="15.4" y2="17.7"></line>',
  'referral-earnings': '<ellipse cx="12" cy="6" rx="8" ry="3"></ellipse><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"></path><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path>',
  refunds: '<polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-5a4 4 0 0 0-4-4H4"></path>',
  subscribers: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><polyline points="3 7 12 13 21 7"></polyline>',
  revenue: '<line x1="3" y1="21" x2="21" y2="21"></line><polyline points="4 15 9 10 13 14 20 6"></polyline>',
  support: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3.5"></circle><line x1="5.6" y1="5.6" x2="9.5" y2="9.5"></line><line x1="14.5" y1="14.5" x2="18.4" y2="18.4"></line><line x1="18.4" y1="5.6" x2="14.5" y2="9.5"></line><line x1="9.5" y1="14.5" x2="5.6" y2="18.4"></line>',
  moderation: '<path d="M12 3l8 3v5c0 4.5-3.2 8-8 10-4.8-2-8-5.5-8-10V6z"></path>',
  admins: '<circle cx="9" cy="8" r="3.2"></circle><path d="M3 20c0-3.3 2.7-5 6-5 1.2 0 2.3.2 3.2.7"></path><circle cx="17.5" cy="16.5" r="3"></circle><line x1="17.5" y1="11.8" x2="17.5" y2="13.5"></line><line x1="17.5" y1="19.5" x2="17.5" y2="21.2"></line><line x1="21.5" y1="16.5" x2="19.8" y2="16.5"></line><line x1="15.2" y1="16.5" x2="13.5" y2="16.5"></line>',
};

// Single source of truth for the sidebar. Order = display order.
const NAV_ITEMS = [
  { page: "dashboard", label: "Dashboard", icon: "dashboard" },
  { page: "hosts", label: "Hosts", icon: "hosts" },
  { page: "clients", label: "Clients", icon: "clients" },
  { page: "cars", label: "Cars", icon: "cars" },
  { page: "feedback", label: "Feedback", icon: "feedback" },
  { page: "notifications", label: "Notifications", icon: "notifications" },
  { page: "payment-methods", label: "Payment Methods", icon: "payment-methods" },
  { page: "bookings", label: "Bookings", icon: "bookings" },
  { page: "withdrawals", label: "Withdrawals", icon: "withdrawals" },
  { page: "referrals", label: "Referrals", icon: "referrals" },
  { page: "referral-earnings", label: "Referral Earnings", icon: "referral-earnings" },
  { page: "refunds", label: "Refunds", icon: "refunds" },
  { page: "subscribers", label: "Email Service", icon: "subscribers" },
  { page: "revenue", label: "Revenue", icon: "revenue" },
  { page: "support", label: "Support", icon: "support" },
  { page: "moderation", label: "Moderation", icon: "moderation" },
  { page: "admins", label: "Admins", icon: "admins", id: "adminsNavItem", hidden: true },
];

function navIconSvgEl(name) {
  return (
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (NAV_ICONS[name] || "") +
    "</svg>"
  );
}

// Render the sidebar nav from NAV_ITEMS. Must run before setupNavigation()
// (which wires click handlers) and before configureNavigationForRole().
function renderSidebar() {
  const nav = document.getElementById("sidebarNav");
  if (!nav) return;
  nav.innerHTML = NAV_ITEMS.map((item) => {
    const cls = "nav-item" + (item.page === "dashboard" ? " active" : "");
    const idAttr = item.id ? ` id="${item.id}"` : "";
    const styleAttr = item.hidden ? ' style="display: none;"' : "";
    return (
      `<a href="#" class="${cls}" data-page="${item.page}"${idAttr}${styleAttr} title="${item.label}">` +
      `<span class="nav-icon">${navIconSvgEl(item.icon)}</span>` +
      `<span class="nav-label">${item.label}</span>` +
      `<span class="nav-badge" id="navBadge-${item.page}" style="display:none;"></span>` +
      `</a>`
    );
  }).join("");
}

// ---------------------------------------------------------------------------
// Sidebar notification badges: surface work that needs the admin's attention
// (unread support messages, cars awaiting verification) on the nav itself.
// ---------------------------------------------------------------------------
function setNavBadge(page, count) {
  const el = document.getElementById("navBadge-" + page);
  if (!el) return;
  const n = Number(count) || 0;
  if (n > 0) {
    el.textContent = n > 99 ? "99+" : String(n);
    el.style.display = "";
    el.setAttribute("title", n + " need attention");
  } else {
    el.textContent = "";
    el.style.display = "none";
    el.removeAttribute("title");
  }
}

let navBadgeTimer = null;

// Fetch the counts that drive the badges. Each source is guarded so a role
// without access (e.g. finance can't see Support) just skips that badge.
async function refreshNavBadges() {
  if (!localStorage.getItem("admin_token")) return;

  // Cars awaiting verification (neither approved nor rejected yet).
  try {
    const stats = await api.getVerificationQueueStats();
    setNavBadge("cars", stats.cars_awaiting_verification || 0);
  } catch (e) {
    /* no access / offline — leave badge as-is */
  }

  // Unread support conversations needing a reply.
  try {
    const res = await api.getSupportConversations({ page: 1, limit: 1 });
    setNavBadge("support", res.unread_count || 0);
  } catch (e) {
    /* no access / offline */
  }
}

// Poll periodically so the badges self-heal without a page reload.
function startNavBadgePolling() {
  refreshNavBadges();
  if (navBadgeTimer) clearInterval(navBadgeTimer);
  navBadgeTimer = setInterval(refreshNavBadges, 60000);
}

// Collapsible sidebar (desktop): icon-only rail when collapsed, state persisted.
const SIDEBAR_COLLAPSE_KEY = "admin_sidebar_collapsed";

function setupSidebarCollapse() {
  const layout = document.getElementById("dashboardLayout");
  const btn = document.getElementById("sidebarCollapseToggle");
  if (!layout || !btn) return;

  const apply = (collapsed) => {
    layout.classList.toggle("sidebar-collapsed", collapsed);
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    btn.setAttribute("title", collapsed ? "Expand sidebar" : "Collapse sidebar");
  };

  apply(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");

  btn.addEventListener("click", () => {
    const collapsed = !layout.classList.contains("sidebar-collapsed");
    apply(collapsed);
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? "1" : "0");
  });
}

// Mobile sidebar (off-canvas below --admin-mobile-breakpoint)
function setupMobileNav() {
  const layout = document.getElementById("dashboardLayout");
  const toggle = document.getElementById("mobileNavToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!layout || !toggle || !backdrop) {
    return;
  }

  function closeNav() {
    layout.classList.remove("sidebar-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("admin-nav-open");
    backdrop.setAttribute("aria-hidden", "true");
  }

  function openNav() {
    layout.classList.add("sidebar-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    document.body.classList.add("admin-nav-open");
    backdrop.setAttribute("aria-hidden", "false");
  }

  function toggleNav() {
    if (layout.classList.contains("sidebar-open")) {
      closeNav();
    } else {
      openNav();
    }
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNav();
  });

  backdrop.addEventListener("click", () => closeNav());

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && layout.classList.contains("sidebar-open")) {
      closeNav();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      closeNav();
    }
  });

  window.closeAdminMobileNav = closeNav;
}

// Setup profile dropdown
function setupProfileDropdown() {
  const profileButton = document.getElementById("profileButton");
  const profileMenu = document.getElementById("profileMenu");
  const logoutLink = document.getElementById("logoutLink");

  profileButton.addEventListener("click", (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle("show");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!profileButton.contains(e.target) && !profileMenu.contains(e.target)) {
      profileMenu.classList.remove("show");
    }
  });

  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await api.logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_info");
    window.location.href = "index.html";
  });

  // Profile link
  const profileLink = document.getElementById("profileLink");
  if (profileLink) {
    profileLink.addEventListener("click", (e) => {
      e.preventDefault();
      loadMyProfile();
    });
  }

  // Change password link
  const changePasswordLink = document.getElementById("changePasswordLink");
  if (changePasswordLink) {
    changePasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      showChangeOwnPasswordModal();
    });
  }
}
