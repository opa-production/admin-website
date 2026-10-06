// js/core/shell.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.

// ---------------------------------------------------------------------------
// Sidebar shell: the navigation is defined ONCE here and rendered into every
// page, so the sidebar can never diverge between pages (this is what caused the
// old reports page to show a shrunken nav). Add/rename/reorder pages here only.
// ---------------------------------------------------------------------------

// Inline line-icons (20x20, stroke = currentColor) keyed by name.
const NAV_ICONS = {
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect>',
  hosts:
    '<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path>',
  clients:
    '<circle cx="9" cy="8" r="3.2"></circle><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"></path><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1"></path><path d="M17 14.5c2.4.5 4 2.2 4 4.5"></path>',
  cars: '<path d="M3 13l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5"></path><path d="M3 13h18v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1z"></path>',
  feedback:
    '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
  notifications:
    '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path>',
  "payment-methods":
    '<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>',
  bookings:
    '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
  withdrawals:
    '<rect x="2" y="5" width="20" height="14" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle>',
  referrals:
    '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="10.7" x2="15.4" y2="6.3"></line><line x1="8.6" y1="13.3" x2="15.4" y2="17.7"></line>',
  "referral-earnings":
    '<ellipse cx="12" cy="6" rx="8" ry="3"></ellipse><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"></path><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path>',
  refunds:
    '<polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-5a4 4 0 0 0-4-4H4"></path>',
  subscribers:
    '<rect x="3" y="5" width="18" height="14" rx="2"></rect><polyline points="3 7 12 13 21 7"></polyline>',
  revenue:
    '<line x1="3" y1="21" x2="21" y2="21"></line><polyline points="4 15 9 10 13 14 20 6"></polyline>',
  support:
    '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3.5"></circle><line x1="5.6" y1="5.6" x2="9.5" y2="9.5"></line><line x1="14.5" y1="14.5" x2="18.4" y2="18.4"></line><line x1="18.4" y1="5.6" x2="14.5" y2="9.5"></line><line x1="9.5" y1="14.5" x2="5.6" y2="18.4"></line>',
  moderation:
    '<path d="M12 3l8 3v5c0 4.5-3.2 8-8 10-4.8-2-8-5.5-8-10V6z"></path>',
  verifications:
    '<path d="M12 3l7.5 2.8v5.4c0 4.3-3 7.7-7.5 9.5-4.5-1.8-7.5-5.2-7.5-9.5V5.8z"></path><polyline points="9 12 11 14 15 9.8"></polyline>',
  admins:
    '<circle cx="9" cy="8" r="3.2"></circle><path d="M3 20c0-3.3 2.7-5 6-5 1.2 0 2.3.2 3.2.7"></path><circle cx="17.5" cy="16.5" r="3"></circle><line x1="17.5" y1="11.8" x2="17.5" y2="13.5"></line><line x1="17.5" y1="19.5" x2="17.5" y2="21.2"></line><line x1="21.5" y1="16.5" x2="19.8" y2="16.5"></line><line x1="15.2" y1="16.5" x2="13.5" y2="16.5"></line>',
  b2b: '<path d="M3 21h18"></path><path d="M5 21V7l7-4 7 4v14"></path><path d="M9 9h1.5M9 12h1.5M9 15h1.5M13.5 9H15M13.5 12H15M13.5 15H15"></path>',
  "b2b-support":
    '<path d="M4 18V8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8z"></path><path d="M17 10h1a2 2 0 0 1 2 2v9l-3-3h-6a2 2 0 0 1-2-2"></path>',
  "deposit-claims":
    '<path d="M12 3l8 3v5c0 4.5-3.2 8-8 10-4.8-2-8-5.5-8-10V6z"></path><path d="M12 8v5"></path><circle cx="12" cy="16" r="0.6"></circle>',
  "status-incidents":
    '<polyline points="3 12 7 12 10 5 14 19 17 12 21 12"></polyline>',
  "b2b-revenue":
    '<path d="M3 21h18"></path><path d="M5 21V10l5-3v14"></path><path d="M10 21V4l9 4v13"></path><path d="M14 11v6"></path><path d="M12.6 12.4c.3-.9 2.8-.9 2.8.3 0 1.3-2.8.9-2.8 2.2 0 1.2 2.5 1.2 2.8.3"></path>',
  newsroom:
    '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"></path><path d="M17 8h3v9a2 2 0 0 1-2 2"></path><line x1="7.5" y1="9" x2="13.5" y2="9"></line><line x1="7.5" y1="12.5" x2="13.5" y2="12.5"></line><line x1="7.5" y1="16" x2="11" y2="16"></line>',
  "b2b-fleet":
    '<path d="M5 17h14"></path><path d="M4 17v-4l2-5h12l2 5v4"></path><circle cx="7.5" cy="17.5" r="1.8"></circle><circle cx="16.5" cy="17.5" r="1.8"></circle><polyline points="9 6 11 8 15 4"></polyline>',
  "chauffeur-applications":
    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="14 3 14 9 20 9"></polyline><polyline points="9 15 11 17 15 13"></polyline>',
  "chauffeur-drivers":
    '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2"></circle><path d="M3.5 10.5c5.5-1.5 11.5-1.5 17 0"></path><path d="M10.5 13.8 7 20.2"></path><path d="M13.5 13.8 17 20.2"></path>',
  "chauffeur-hires":
    '<circle cx="12" cy="10" r="3"></circle><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"></path>',
};

// Single source of truth for the sidebar. Order = display order.
const NAV_ITEMS = [
  { page: "dashboard", label: "Dashboard", icon: "dashboard" },
  { page: "hosts", label: "Hosts", icon: "hosts" },
  { page: "clients", label: "Clients", icon: "clients" },
  { page: "cars", label: "Cars", icon: "cars" },
  { page: "verifications", label: "Verifications", icon: "verifications" },
  // Feedback is hidden for now (the page itself still works at #feedback).
  // Drop `hidden: true` to put it back in the sidebar.
  { page: "feedback", label: "Feedback", icon: "feedback", hidden: true },
  { page: "notifications", label: "Notifications", icon: "notifications" },
  {
    page: "payment-methods",
    label: "Payment Methods",
    icon: "payment-methods",
  },
  { page: "bookings", label: "Bookings", icon: "bookings" },
  { page: "withdrawals", label: "Withdrawals", icon: "withdrawals" },
  { page: "referrals", label: "Referrals", icon: "referrals" },
  {
    page: "referral-earnings",
    label: "Referral Earnings",
    icon: "referral-earnings",
  },
  { page: "refunds", label: "Refunds", icon: "refunds" },
  { page: "deposit-claims", label: "Deposit Claims", icon: "deposit-claims" },
  { page: "subscribers", label: "Email Service", icon: "subscribers" },
  { page: "revenue", label: "Revenue", icon: "revenue" },
  { page: "support", label: "Support", icon: "support" },
  { page: "moderation", label: "Moderation", icon: "moderation" },
  { page: "b2b", label: "B2B Businesses", icon: "b2b" },
  { page: "b2b-fleet", label: "B2B Fleet", icon: "b2b-fleet" },
  { page: "b2b-support", label: "B2B Support", icon: "b2b-support" },
  { page: "b2b-revenue", label: "B2B Revenue", icon: "b2b-revenue" },
  { page: "newsroom", label: "Newsroom", icon: "newsroom" },
  { page: "status-incidents", label: "Status Page", icon: "status-incidents" },
  // Chauffeurs (chauffer.md). `group` draws a heading above the first item.
  { page: "chauffeur-applications", label: "Applications", icon: "chauffeur-applications", group: "Chauffeurs" },
  { page: "chauffeur-drivers", label: "Drivers", icon: "chauffeur-drivers", group: "Chauffeurs" },
  { page: "chauffeur-hires", label: "Hires", icon: "chauffeur-hires", group: "Chauffeurs" },
  { page: "chauffeur-withdrawals", label: "Withdrawals", icon: "withdrawals", group: "Chauffeurs" },
  { page: "chauffeur-refunds", label: "Refunds", icon: "refunds", group: "Chauffeurs" },
  {
    page: "admins",
    label: "Admins",
    icon: "admins",
    id: "adminsNavItem",
    hidden: true,
  },
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
  let lastGroup = null;
  nav.innerHTML = NAV_ITEMS.map((item) => {
    const heading =
      item.group && item.group !== lastGroup
        ? `<div class="nav-group-label" data-group="${item.group}">${item.group}</div>`
        : "";
    lastGroup = item.group || null;
    const cls = "nav-item" + (item.page === "dashboard" ? " active" : "");
    const idAttr = item.id ? ` id="${item.id}"` : "";
    const styleAttr = item.hidden ? ' style="display: none;"' : "";
    const groupAttr = item.group ? ` data-group="${item.group}"` : "";
    return (
      heading +
      `<a href="#" class="${cls}" data-page="${item.page}"${idAttr}${styleAttr}${groupAttr} title="${item.label}">` +
      `<span class="nav-icon">${navIconSvgEl(item.icon)}</span>` +
      `<span class="nav-label">${item.label}</span>` +
      `<span class="nav-badge" id="navBadge-${item.page}" style="display:none;"></span>` +
      `</a>`
    );
  }).join("");
}

// ---------------------------------------------------------------------------
// Sidebar notification badges: surface work that needs the admin's attention
// (unread support, cars to verify, payouts, requests to approve) on the nav itself.
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

// A list endpoint's total for one status, read off a limit=1 page. Background,
// so a role that can't reach the endpoint skips its badge instead of being
// signed out.
async function navQueueTotal(path, params) {
  const qs = new URLSearchParams({ limit: 1, ...params }).toString();
  const res = await apiRequest(`${path}?${qs}`, { background: true });
  return res.total || 0;
}

// Every badge: the page it sits on and how many items are waiting on an
// admin there. Each source is fetched on its own, so one failing (no access,
// endpoint not deployed, offline) leaves the others — and its own last
// value — alone.
const NAV_BADGE_SOURCES = [
  // Cars awaiting verification (neither approved nor rejected yet).
  ["cars", async () =>
    (await api.getVerificationQueueStats({ background: true })).cars_awaiting_verification],
  // Unread support conversations needing a reply.
  ["support", async () =>
    (await api.getSupportConversations({ page: 1, limit: 1 }, { background: true })).unread_count],
  // B2B threads whose newest message is from the business (support.md §2).
  // Its own endpoint rather than a field off the inbox list, so the badge is
  // the whole backlog and never disagrees with a filtered view of the page.
  ["b2b-support", async () =>
    (await api.getB2BSupportUnansweredCount({ background: true })).count],
  // Payouts a host asked for that nobody has paid or rejected.
  ["withdrawals", () => navQueueTotal("/admin/withdrawals", { status: "pending" })],
  ["refunds", () => navQueueTotal("/admin/refunds", { status: "pending" })],
  ["deposit-claims", () => navQueueTotal("/admin/deposit-claims", { status: "pending" })],
  // Listing reports nobody has resolved: received + reviewing.
  ["moderation", async () => {
    const [received, reviewing] = await Promise.all([
      navQueueTotal("/admin/listing-reports", { status: "received" }),
      navQueueTotal("/admin/listing-reports", { status: "reviewing" }),
    ]);
    return received + reviewing;
  }],
  // Businesses that applied for access and are waiting for an answer.
  ["b2b", () => navQueueTotal("/admin/b2b/access-requests", { status: "pending" })],
  // Business cars published to the app that only our review is holding back.
  ["b2b-fleet", async () =>
    (await apiRequest("/admin/b2b/fleet/cars/stats", { background: true })).pending_review],
  // People who asked to write for the newsroom. Only a super admin can
  // approve them, so nobody else is shown a count they can't act on.
  ["newsroom", async () => {
    if (typeof canManageAdmins === "function" && !canManageAdmins()) return 0;
    const rows = await apiRequest("/admin/newsroom/requests?status=pending", { background: true });
    return Array.isArray(rows) ? rows.length : 0;
  }],
];

// The four Chauffeurs badges come from one summary call (chauffer.md §2).
const CHAUFFEUR_SUMMARY_BADGES = [
  ["chauffeur-applications", "applications_pending"],
  ["chauffeur-withdrawals", "payouts_processing"],
  ["chauffeur-refunds", "refunds_pending"],
  ["chauffeur-hires", "stuck_trips"],
];

async function refreshChauffeurBadges() {
  try {
    const summary = await api.getChauffeurSummary({ background: true });
    CHAUFFEUR_SUMMARY_BADGES.forEach(([page, field]) =>
      setNavBadge(page, summary[field]),
    );
  } catch (e) {
    /* no access / not deployed — leave badges as-is */
  }
}

// Fetch the counts that drive the badges.
async function refreshNavBadges() {
  if (!localStorage.getItem("admin_token")) return;
  await Promise.all([
    ...NAV_BADGE_SOURCES.map(async ([page, count]) => {
      try {
        setNavBadge(page, (await count()) || 0);
      } catch (e) {
        /* no access / offline — leave badge as-is */
      }
    }),
    refreshChauffeurBadges(),
  ]);
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
    btn.setAttribute(
      "aria-label",
      collapsed ? "Expand sidebar" : "Collapse sidebar",
    );
    btn.setAttribute(
      "title",
      collapsed ? "Expand sidebar" : "Collapse sidebar",
    );
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

// Wire the Dark mode switch in the profile menu. The theme itself is applied
// by js/core/theme.js (which runs in <head>); this only reflects and flips it.
function initThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle || !window.adminTheme) return;

  const sync = () => {
    toggle.setAttribute(
      "aria-checked",
      window.adminTheme.current() === "dark" ? "true" : "false",
    );
  };

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.adminTheme.toggle();
    sync();
  });

  // Keeps the switch honest when the OS theme changes underneath us.
  window.addEventListener("adminthemechange", sync);
  sync();
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
    localStorage.removeItem("admin_session_expiry");
    window.location.href = "/";
  });

  // Profile link
  const profileLink = document.getElementById("profileLink");
  if (profileLink) {
    profileLink.addEventListener("click", (e) => {
      e.preventDefault();
      profileMenu.classList.remove("show");
      // Route through loadPage so the URL hash records the profile page and a
      // refresh stays on it.
      loadPage("my-profile");
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
