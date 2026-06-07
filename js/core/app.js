// js/core/app.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.

// Check authentication on load
window.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // Render the sidebar from the single NAV_ITEMS config before anything reads
  // or wires the .nav-item elements.
  renderSidebar();

  // Load admin info (also applies role-based nav visibility)
  await loadAdminInfo();

  // Setup navigation
  setupNavigation();

  setupMobileNav();

  // Collapsible (icon-only) sidebar toggle
  setupSidebarCollapse();

  // Setup profile dropdown
  setupProfileDropdown();

  // Surface attention-needed counts (support, cars) on the sidebar and keep
  // them fresh.
  startNavBadgePolling();

  // Load dashboard by default
  loadDashboard();
});

// Load admin info
async function loadAdminInfo() {
  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const profileAvatar = document.getElementById("profileAvatar");

  if (!profileName || !profileEmail || !profileAvatar) {
    console.error("Profile elements not found");
    return;
  }

  try {
    // Try to fetch from API first (most up-to-date)
    console.log("Fetching admin info from API...");
    const admin = await api.getCurrentAdmin();
    console.log("Admin data received:", admin);

    if (admin && (admin.full_name || admin.email)) {
      localStorage.setItem("admin_info", JSON.stringify(admin));
      profileName.textContent = admin.full_name || "Admin";
      profileEmail.textContent = admin.email || "";
      renderAdminAvatar(profileAvatar, admin.full_name || admin.email, admin);
      console.log("Admin profile loaded successfully");

      // Cache role globally for access control
      window.currentAdminRole = admin.role;
      configureNavigationForRole(admin.role);

      return;
    }
  } catch (error) {
    console.error("Error fetching admin from API:", error);
    // Fallback to localStorage if API fails
    try {
      const adminInfo = api.getAdminInfo();
      console.log("Admin info from localStorage:", adminInfo);
      if (adminInfo && (adminInfo.full_name || adminInfo.email)) {
        profileName.textContent = adminInfo.full_name || "Admin";
        profileEmail.textContent = adminInfo.email || "";
        renderAdminAvatar(
          profileAvatar,
          adminInfo.full_name || adminInfo.email,
          adminInfo,
        );
        console.log("Admin profile loaded from localStorage");

        // Cache role globally for access control
        window.currentAdminRole = adminInfo.role;
        configureNavigationForRole(adminInfo.role);

        return;
      }
    } catch (localError) {
      console.error("Error reading from localStorage:", localError);
    }
  }

  // If both fail, show error
  console.error("Failed to load admin profile");
  profileName.textContent = "Error";
  profileEmail.textContent = "Unable to load profile";
  profileAvatar.textContent = "?";
}

// Setup navigation
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const page = item.getAttribute("data-page");

      // Update active state
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // Load page
      loadPage(page);
      if (typeof window.closeAdminMobileNav === "function") {
        window.closeAdminMobileNav();
      }
    });
  });
}

// Configure sidebar/navigation visibility based on admin role
function configureNavigationForRole(role) {
  const adminsNavItem = document.getElementById("adminsNavItem");
  if (adminsNavItem) {
    adminsNavItem.style.display = role === "super_admin" ? "block" : "none";
  }

  const hideForCustomerService = [
    "revenue",
    "withdrawals",
    "referrals",
    "referral-earnings",
    "payment-methods",
    "refunds",
  ];
  const hideForFinance = [
    "subscribers",
    "notifications",
    "feedback",
    "support",
    "moderation",
  ];

  document.querySelectorAll(".nav-item").forEach((item) => {
    const page = item.getAttribute("data-page");
    if (role === "customer_service" && hideForCustomerService.includes(page)) {
      item.style.display = "none";
    } else if (role === "finance" && hideForFinance.includes(page)) {
      item.style.display = "none";
    }
  });
}

// Load page content
function loadPage(page) {
  // Enforce role-based access control for pages
  const role =
    window.currentAdminRole ||
    (function () {
      try {
        const info = api.getAdminInfo();
        return info?.role;
      } catch {
        return undefined;
      }
    })();

  if (role && !isPageAllowedForRole(page, role)) {
    alert("You do not have access to this section.");
    page = "dashboard";
  }
  // Hide all pages
  document.querySelectorAll(".page-content").forEach((p) => {
    p.style.display = "none";
  });

  // Update page title
  const titles = {
    dashboard: "Dashboard",
    hosts: "Hosts",
    clients: "Clients",
    cars: "Cars",
    feedback: "Feedback",
    notifications: "Notifications",
    "payment-methods": "Payment Methods",
    bookings: "Bookings",
    withdrawals: "Withdrawals",
    referrals: "Referrals",
    "referral-earnings": "Referral Earnings",
    subscribers: "Subscribers",
    revenue: "Revenue",
    support: "Support",
    moderation: "Moderation",
    admins: "Admins",
  };
  document.getElementById("pageTitle").textContent =
    titles[page] || "Dashboard";

  // Show selected page
  // Convert page name with hyphens to camelCase for element ID
  const pageId = page.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + "Page";
  const pageElement = document.getElementById(pageId);
  if (pageElement) {
    pageElement.style.display = "block";
  }

  // Load page-specific content
  switch (page) {
    case "dashboard":
      loadDashboard();
      break;
    case "hosts":
      loadHosts();
      break;
    case "clients":
      loadClients();
      break;
    case "cars":
      setupCarSearch();
      loadCars();
      break;
    case "feedback":
      loadFeedback();
      break;
    case "notifications":
      switchNotificationTab("host");
      loadHostsForNotifications();
      setupNotificationsInteractions();
      updateNotifPreview();
      break;
    case "admins":
      setupAdminSearch();
      loadAdmins();
      break;
    case "payment-methods":
      setupPaymentMethodSearch();
      loadPaymentMethods();
      break;
    case "bookings":
      setupBookingSearch();
      loadBookings();
      break;
    case "revenue":
      loadRevenue();
      break;
    case "support":
      setupSupportSearch();
      loadSupportConversations();
      break;
    case "withdrawals":
      setupWithdrawalFilters();
      loadWithdrawals();
      break;
    case "referrals":
      setupReferrerSearch();
      switchReferralTab(currentReferralTab);
      break;
    case "referral-earnings":
      setupClientEarningFilters();
      loadClientReferralEarnings();
      break;
    case "refunds":
      setupRefundFilters();
      loadRefunds();
      break;
    case "subscribers":
      loadSubscribers();
      break;
    case "moderation":
      initModerationPage();
      break;
  }
}

// Check if a page is allowed for a given admin role
function isPageAllowedForRole(page, role) {
  if (role === "super_admin") {
    return true;
  }

  // Restrictions should mirror configureNavigationForRole
  const restrictedForCustomerService = new Set([
    "revenue",
    "withdrawals",
    "referrals",
    "referral-earnings",
    "payment-methods",
    "refunds",
    "admins",
  ]);
  const restrictedForFinance = new Set([
    "subscribers",
    "notifications",
    "feedback",
    "support",
    "moderation",
    "admins",
  ]);

  if (role === "customer_service") {
    return !restrictedForCustomerService.has(page);
  }
  if (role === "finance") {
    return !restrictedForFinance.has(page);
  }

  // Fallback: unknown roles get default access (same as current behavior)
  return true;
}
