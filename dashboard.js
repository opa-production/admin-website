// Check authentication on load
window.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Load admin info
    await loadAdminInfo();
    
    // Setup navigation
    setupNavigation();

    setupMobileNav();
    
    // Setup profile dropdown
    setupProfileDropdown();
    
    // Load dashboard by default
    loadDashboard();
});

// Load admin info
async function loadAdminInfo() {
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileAvatar = document.getElementById('profileAvatar');
    
    if (!profileName || !profileEmail || !profileAvatar) {
        console.error('Profile elements not found');
        return;
    }
    
    try {
        // Try to fetch from API first (most up-to-date)
        console.log('Fetching admin info from API...');
        const admin = await api.getCurrentAdmin();
        console.log('Admin data received:', admin);
        
        if (admin && (admin.full_name || admin.email)) {
            localStorage.setItem('admin_info', JSON.stringify(admin));
            profileName.textContent = admin.full_name || 'Admin';
            profileEmail.textContent = admin.email || '';
            const initials = (admin.full_name || admin.email || 'A').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            profileAvatar.textContent = initials;
            console.log('Admin profile loaded successfully');

            // Cache role globally for access control
            window.currentAdminRole = admin.role;
            configureNavigationForRole(admin.role);

            return;
        }
    } catch (error) {
        console.error('Error fetching admin from API:', error);
        // Fallback to localStorage if API fails
        try {
            const adminInfo = api.getAdminInfo();
            console.log('Admin info from localStorage:', adminInfo);
            if (adminInfo && (adminInfo.full_name || adminInfo.email)) {
                profileName.textContent = adminInfo.full_name || 'Admin';
                profileEmail.textContent = adminInfo.email || '';
                const initials = (adminInfo.full_name || adminInfo.email || 'A').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                profileAvatar.textContent = initials;
                console.log('Admin profile loaded from localStorage');

                // Cache role globally for access control
                window.currentAdminRole = adminInfo.role;
                configureNavigationForRole(adminInfo.role);

                return;
            }
        } catch (localError) {
            console.error('Error reading from localStorage:', localError);
        }
    }
    
    // If both fail, show error
    console.error('Failed to load admin profile');
    profileName.textContent = 'Error';
    profileEmail.textContent = 'Unable to load profile';
    profileAvatar.textContent = '?';
}

// Mobile sidebar (off-canvas below --admin-mobile-breakpoint)
function setupMobileNav() {
    const layout = document.getElementById('dashboardLayout');
    const toggle = document.getElementById('mobileNavToggle');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!layout || !toggle || !backdrop) {
        return;
    }

    function closeNav() {
        layout.classList.remove('sidebar-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
        document.body.classList.remove('admin-nav-open');
        backdrop.setAttribute('aria-hidden', 'true');
    }

    function openNav() {
        layout.classList.add('sidebar-open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close menu');
        document.body.classList.add('admin-nav-open');
        backdrop.setAttribute('aria-hidden', 'false');
    }

    function toggleNav() {
        if (layout.classList.contains('sidebar-open')) {
            closeNav();
        } else {
            openNav();
        }
    }

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNav();
    });

    backdrop.addEventListener('click', () => closeNav());

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && layout.classList.contains('sidebar-open')) {
            closeNav();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            closeNav();
        }
    });

    window.closeAdminMobileNav = closeNav;
}

// Setup navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Load page
            loadPage(page);
            if (typeof window.closeAdminMobileNav === 'function') {
                window.closeAdminMobileNav();
            }
        });
    });
}

// Configure sidebar/navigation visibility based on admin role
function configureNavigationForRole(role) {
    const adminsNavItem = document.getElementById('adminsNavItem');
    if (adminsNavItem) {
        adminsNavItem.style.display = role === 'super_admin' ? 'block' : 'none';
    }

    const hideForCustomerService = ['revenue', 'withdrawals', 'payment-methods', 'refunds'];
    const hideForFinance = ['subscribers', 'notifications', 'feedback', 'support', 'moderation'];

    document.querySelectorAll('.nav-item').forEach(item => {
        const page = item.getAttribute('data-page');
        if (role === 'customer_service' && hideForCustomerService.includes(page)) {
            item.style.display = 'none';
        } else if (role === 'finance' && hideForFinance.includes(page)) {
            item.style.display = 'none';
        }
    });
}

// Setup profile dropdown
function setupProfileDropdown() {
    const profileButton = document.getElementById('profileButton');
    const profileMenu = document.getElementById('profileMenu');
    const logoutLink = document.getElementById('logoutLink');

    profileButton.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!profileButton.contains(e.target) && !profileMenu.contains(e.target)) {
            profileMenu.classList.remove('show');
        }
    });

    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await api.logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_info');
        window.location.href = 'index.html';
    });

    // Profile link
    const profileLink = document.getElementById('profileLink');
    if (profileLink) {
        profileLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadMyProfile();
        });
    }

    // Change password link
    const changePasswordLink = document.getElementById('changePasswordLink');
    if (changePasswordLink) {
        changePasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showChangeOwnPasswordModal();
        });
    }
}

// Load page content
function loadPage(page) {
    // Enforce role-based access control for pages
    const role = window.currentAdminRole || (function() {
        try {
            const info = api.getAdminInfo();
            return info?.role;
        } catch {
            return undefined;
        }
    })();

    if (role && !isPageAllowedForRole(page, role)) {
        alert('You do not have access to this section.');
        page = 'dashboard';
    }
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });

    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        hosts: 'Hosts',
        clients: 'Clients',
        cars: 'Cars',
        feedback: 'Feedback',
        notifications: 'Notifications',
        'payment-methods': 'Payment Methods',
        bookings: 'Bookings',
        withdrawals: 'Withdrawals',
        subscribers: 'Subscribers',
        revenue: 'Revenue',
        support: 'Support',
        moderation: 'Moderation',
        admins: 'Admins'
    };
    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

    // Show selected page
    // Convert page name with hyphens to camelCase for element ID
    const pageId = page.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Page';
    const pageElement = document.getElementById(pageId);
    if (pageElement) {
        pageElement.style.display = 'block';
    }

    // Load page-specific content
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'hosts':
            setupHostSearch();
            loadHosts();
            break;
        case 'clients':
            loadClients();
            break;
        case 'cars':
            setupCarSearch();
            loadCars();
            break;
        case 'feedback':
            loadFeedback();
            break;
        case 'notifications':
            switchNotificationTab('host');
            loadHostsForNotifications();
            setupNotificationsInteractions();
            updateNotifPreview();
            break;
        case 'admins':
            setupAdminSearch();
            loadAdmins();
            break;
        case 'payment-methods':
            setupPaymentMethodSearch();
            loadPaymentMethods();
            break;
        case 'bookings':
            setupBookingSearch();
            loadBookings();
            break;
        case 'revenue':
            loadRevenue();
            break;
        case 'support':
            setupSupportSearch();
            loadSupportConversations();
            break;
        case 'withdrawals':
            setupWithdrawalFilters();
            loadWithdrawals();
            break;
        case 'refunds':
            setupRefundFilters();
            loadRefunds();
            break;
        case 'subscribers':
            loadSubscribers();
            break;
        case 'moderation':
            initModerationPage();
            break;
    }
}

// Check if a page is allowed for a given admin role
function isPageAllowedForRole(page, role) {
    if (role === 'super_admin') {
        return true;
    }

    // Restrictions should mirror configureNavigationForRole
    const restrictedForCustomerService = new Set(['revenue', 'withdrawals', 'payment-methods', 'refunds', 'admins']);
    const restrictedForFinance = new Set(['subscribers', 'notifications', 'feedback', 'support', 'moderation', 'admins']);

    if (role === 'customer_service') {
        return !restrictedForCustomerService.has(page);
    }
    if (role === 'finance') {
        return !restrictedForFinance.has(page);
    }

    // Fallback: unknown roles get default access (same as current behavior)
    return true;
}

// Back to hosts list
function backToHostsList() {
    loadPage('hosts');
}

// Chart instances storage
let verifiedHostsChart = null;
let verifiedClientsChart = null;
let verificationStatusChart = null;
let bookingOutcomesChart = null;
let bookingsVolumeChart = null;
let revenueStreamChart = null;
let moneyFlowChart = null;
let paidBookingsChart = null;
let revenueCompositionChart = null;

// Normalize the kyc-trends response (an array of { date, verified, pending })
// into the shape the KYC chart consumes.
function normalizeKycSeries(rows) {
    const safe = Array.isArray(rows) ? rows : [];
    const labels = safe.map(r => {
        const d = new Date(r.date);
        return isNaN(d) ? r.date : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    const verified_series = safe.map(r => r.verified || 0);
    const pending_series = safe.map(r => r.pending || 0);
    const last = safe[safe.length - 1] || { verified: 0, pending: 0 };
    return {
        labels,
        verified_series,
        pending_series,
        verified_now: last.verified || 0,
        pending_now: last.pending || 0,
    };
}

// Load dashboard
async function loadDashboard() {
    const statsGrid = document.getElementById('statsGrid');

    try {
        const [stats, kyc, bookingTrends] = await Promise.all([
            api.getDashboardStats(),
            api.getKycTrends().catch(err => {
                console.error('Failed to load KYC trends:', err);
                return { hosts: [], clients: [] };
            }),
            api.getBookingTrends(14).catch(err => {
                console.error('Failed to load booking trends:', err);
                return null;
            }),
        ]);

        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Total Hosts</div>
                <div class="stat-value">${stats.total_hosts}</div>
                <div class="stat-subvalue">${stats.active_hosts} active, ${stats.inactive_hosts} inactive</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Clients</div>
                <div class="stat-value">${stats.total_clients}</div>
                <div class="stat-subvalue">${stats.active_clients} active, ${stats.inactive_clients} inactive</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Cars</div>
                <div class="stat-value">${stats.total_cars}</div>
                <div class="stat-subvalue">${stats.visible_cars} visible, ${stats.hidden_cars} hidden</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Awaiting Verification</div>
                <div class="stat-value">${stats.cars_awaiting_verification}</div>
                <div class="stat-subvalue">${stats.verified_cars} verified, ${stats.rejected_cars} rejected</div>
            </div>
        `;

        createVerifiedHostsChart(normalizeKycSeries(kyc.hosts));
        createVerifiedClientsChart(normalizeKycSeries(kyc.clients));
        createVerificationStatusChart(stats);
        if (bookingTrends) {
            createBookingOutcomesChart(normalizeBookingOutcomes(bookingTrends));
            createBookingsVolumeChart(normalizeBookingsTrend(bookingTrends));
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        statsGrid.innerHTML = '<div class="empty-state">Error loading statistics</div>';
    }
}

// ---------------------------------------------------------------------------
// KYC charts (Verified Hosts / Verified Clients)
// Smooth filled area showing cumulative verified vs pending over time, plus
// a subtitle with the current verified-share percentage.
// ---------------------------------------------------------------------------
function buildKycChart(canvas, data, palette) {
    const ctx = canvas.getContext('2d');
    const height = canvas.height || 200;

    const verifiedGradient = ctx.createLinearGradient(0, 0, 0, height);
    verifiedGradient.addColorStop(0, palette.verifiedTop);
    verifiedGradient.addColorStop(1, palette.verifiedBottom);

    const pendingGradient = ctx.createLinearGradient(0, 0, 0, height);
    pendingGradient.addColorStop(0, palette.pendingTop);
    pendingGradient.addColorStop(1, palette.pendingBottom);

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Verified',
                    data: data.verified_series,
                    fill: true,
                    backgroundColor: verifiedGradient,
                    borderColor: palette.verifiedLine,
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: palette.verifiedLine,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                },
                {
                    label: 'Pending KYC',
                    data: data.pending_series,
                    fill: true,
                    backgroundColor: pendingGradient,
                    borderColor: palette.pendingLine,
                    borderWidth: 2,
                    borderDash: [4, 4],
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: palette.pendingLine,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 10,
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        font: { size: 11, family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
                    },
                },
                tooltip: {
                    padding: 10,
                    backgroundColor: 'rgba(17, 24, 39, 0.92)',
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12 },
                    cornerRadius: 6,
                    displayColors: true,
                },
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { font: { size: 10 }, color: '#9ca3af' },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(17, 24, 39, 0.05)', drawBorder: false },
                    ticks: { font: { size: 10 }, color: '#9ca3af', precision: 0 },
                },
            },
            animation: { duration: 1000, easing: 'easeOutQuart' },
        },
    });
}

function createVerifiedHostsChart(data) {
    const canvas = document.getElementById('verifiedHostsChart');
    if (!canvas) return;
    if (verifiedHostsChart) verifiedHostsChart.destroy();

    verifiedHostsChart = buildKycChart(canvas, data, {
        verifiedLine: 'rgba(37, 99, 235, 1)',
        verifiedTop: 'rgba(37, 99, 235, 0.35)',
        verifiedBottom: 'rgba(37, 99, 235, 0.02)',
        pendingLine: 'rgba(148, 163, 184, 1)',
        pendingTop: 'rgba(148, 163, 184, 0.25)',
        pendingBottom: 'rgba(148, 163, 184, 0.02)',
    });

    const subtitle = document.getElementById('verifiedHostsSubtitle');
    if (subtitle) {
        subtitle.textContent = `${data.verified_now.toLocaleString()} verified · ${data.pending_now.toLocaleString()} pending`;
    }
}

function createVerifiedClientsChart(data) {
    const canvas = document.getElementById('verifiedClientsChart');
    if (!canvas) return;
    if (verifiedClientsChart) verifiedClientsChart.destroy();

    verifiedClientsChart = buildKycChart(canvas, data, {
        verifiedLine: 'rgba(16, 185, 129, 1)',
        verifiedTop: 'rgba(16, 185, 129, 0.35)',
        verifiedBottom: 'rgba(16, 185, 129, 0.02)',
        pendingLine: 'rgba(148, 163, 184, 1)',
        pendingTop: 'rgba(148, 163, 184, 0.25)',
        pendingBottom: 'rgba(148, 163, 184, 0.02)',
    });

    const subtitle = document.getElementById('verifiedClientsSubtitle');
    if (subtitle) {
        subtitle.textContent = `${data.verified_now.toLocaleString()} verified · ${data.pending_now.toLocaleString()} pending`;
    }
}

// ---------------------------------------------------------------------------
// Car Verification Status — horizontal stacked bar from real API counts.
// Shows current Verified / Awaiting / Denied at a glance, with counts and
// percentages on hover. Point-in-time, no fabricated history.
// ---------------------------------------------------------------------------
function createVerificationStatusChart(stats) {
    const canvas = document.getElementById('verificationStatusChart');
    if (!canvas) return;
    if (verificationStatusChart) verificationStatusChart.destroy();

    const ctx = canvas.getContext('2d');

    const verified = stats.verified_cars || 0;
    const awaiting = stats.cars_awaiting_verification || 0;
    const denied = stats.rejected_cars || 0;
    const total = verified + awaiting + denied;

    const series = [
        { label: 'Verified', value: verified, color: '#10b981' },
        { label: 'Awaiting', value: awaiting, color: '#f59e0b' },
        { label: 'Denied',   value: denied,   color: '#ef4444' },
    ];

    verificationStatusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Cars'],
            datasets: series.map(s => ({
                label: s.label,
                data: [s.value],
                backgroundColor: s.color,
                borderWidth: 0,
                borderRadius: 4,
                barThickness: 28,
            })),
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 12,
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    cornerRadius: 8,
                    displayColors: true,
                    boxPadding: 4,
                    callbacks: {
                        label: c => {
                            const v = c.parsed.x;
                            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                            return ` ${c.dataset.label}: ${v} car${v === 1 ? '' : 's'} · ${pct}%`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: 'rgba(17, 24, 39, 0.06)', drawBorder: false, borderDash: [3, 3] },
                    ticks: { font: { size: 11 }, color: '#6b7280', precision: 0 },
                },
                y: {
                    stacked: true,
                    grid: { display: false, drawBorder: false },
                    ticks: { display: false },
                },
            },
            animation: { duration: 800, easing: 'easeOutQuart' },
        },
    });

    const legendEl = document.getElementById('verificationLegend');
    if (legendEl) {
        legendEl.innerHTML = series
            .map(s => {
                const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                return `<span class="legend-chip"><span class="legend-dot" style="background:${s.color}"></span>${s.label} · ${s.value} (${pct}%)</span>`;
            })
            .join('');
    }
}

// ---------------------------------------------------------------------------
// Booking analytics — backed by GET /admin/dashboard/booking-trends?days=14.
// Response shape: { outcomes: [{date, successful, cancelled_by_host,
// cancelled_by_client}], trend: [{date, bookings}], totals: {...} }
// ---------------------------------------------------------------------------
function formatBookingDateLabel(value) {
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function normalizeBookingOutcomes(resp) {
    const outcomes = Array.isArray(resp?.outcomes) ? resp.outcomes : [];
    const totals = resp?.totals || {};
    return {
        labels: outcomes.map(o => formatBookingDateLabel(o.date)),
        successful: outcomes.map(o => o.successful || 0),
        cancelledByHost: outcomes.map(o => o.cancelled_by_host || 0),
        cancelledByClient: outcomes.map(o => o.cancelled_by_client || 0),
        totalSuccessful: totals.successful || 0,
        totalCancelledByHost: totals.cancelled_by_host || 0,
        totalCancelledByClient: totals.cancelled_by_client || 0,
        days: resp?.days || outcomes.length,
    };
}

function normalizeBookingsTrend(resp) {
    const trend = Array.isArray(resp?.trend) ? resp.trend : [];
    const totals = resp?.totals || {};
    return {
        labels: trend.map(t => formatBookingDateLabel(t.date)),
        totals: trend.map(t => t.bookings || 0),
        totalCreated: totals.bookings_created || 0,
        days: resp?.days || trend.length,
    };
}

function createBookingOutcomesChart(data) {
    const canvas = document.getElementById('bookingOutcomesChart');
    if (!canvas) return;
    if (bookingOutcomesChart) bookingOutcomesChart.destroy();

    const ctx = canvas.getContext('2d');
    const series = [
        { label: 'Successful', data: data.successful, color: 'rgba(16, 185, 129, 1)' },
        { label: 'Cancelled by host', data: data.cancelledByHost, color: 'rgba(239, 68, 68, 1)' },
        { label: 'Cancelled by client', data: data.cancelledByClient, color: 'rgba(245, 158, 11, 1)' },
    ];

    bookingOutcomesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: series.map(s => ({
                label: s.label,
                data: s.data,
                borderColor: s.color,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: s.color,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 10,
                    backgroundColor: 'rgba(17, 24, 39, 0.92)',
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12 },
                    cornerRadius: 6,
                    displayColors: true,
                },
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { font: { size: 10 }, color: '#9ca3af', maxRotation: 0, autoSkipPadding: 14 } },
                y: { beginAtZero: true, grid: { color: 'rgba(17, 24, 39, 0.05)', drawBorder: false }, ticks: { font: { size: 10 }, color: '#9ca3af', precision: 0 } },
            },
            animation: { duration: 900, easing: 'easeOutQuart' },
        },
    });

    const legendEl = document.getElementById('bookingOutcomesLegend');
    if (legendEl) {
        legendEl.innerHTML = series
            .map(s => `<span class="legend-chip"><span class="legend-dot" style="background:${s.color}"></span>${s.label}</span>`)
            .join('');
    }

    const subtitle = document.getElementById('bookingOutcomesSubtitle');
    if (subtitle) {
        const days = data.days || data.labels.length;
        const success = data.totalSuccessful || 0;
        const host = data.totalCancelledByHost || 0;
        const client = data.totalCancelledByClient || 0;
        const denom = success + host + client;
        const cancelRate = denom > 0 ? Math.round(((host + client) / denom) * 100) : 0;
        subtitle.textContent = `Last ${days} days · ${success.toLocaleString()} successful · ${cancelRate}% cancel rate`;
    }
}

function createBookingsVolumeChart(data) {
    const canvas = document.getElementById('bookingsVolumeChart');
    if (!canvas) return;
    if (bookingsVolumeChart) bookingsVolumeChart.destroy();

    const ctx = canvas.getContext('2d');
    const height = canvas.height || 220;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.30)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.02)');

    bookingsVolumeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Bookings',
                data: data.totals,
                borderColor: 'rgba(37, 99, 235, 1)',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: 'rgba(37, 99, 235, 1)',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 10,
                    backgroundColor: 'rgba(17, 24, 39, 0.92)',
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 12 },
                    cornerRadius: 6,
                    displayColors: false,
                },
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { font: { size: 10 }, color: '#9ca3af', maxRotation: 0, autoSkipPadding: 16 } },
                y: { beginAtZero: true, grid: { color: 'rgba(17, 24, 39, 0.05)', drawBorder: false }, ticks: { font: { size: 10 }, color: '#9ca3af', precision: 0 } },
            },
            animation: { duration: 900, easing: 'easeOutQuart' },
        },
    });

    const subtitle = document.getElementById('bookingsVolumeSubtitle');
    if (subtitle) {
        const days = data.days || data.labels.length;
        const last = data.totals[data.totals.length - 1] || 0;
        const total = data.totalCreated || data.totals.reduce((a, b) => a + b, 0);
        subtitle.textContent = `Last ${days} days · ${total.toLocaleString()} total · ${last} today`;
    }
}

// Load revenue page
async function loadRevenue() {
    const statsGrid = document.getElementById('revenueStatsGrid');
    if (!statsGrid) return;

    try {
        statsGrid.innerHTML = '<div class="loading">Loading revenue...</div>';
        const data = await api.getRevenueStats();

        const fmt = (n) => (n || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 });

        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Money In</div>
                <div class="stat-value">${fmt(data.money_in)}</div>
                <div class="stat-subvalue">Total from bookings</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Commission</div>
                <div class="stat-value">${fmt(data.commission)}</div>
                <div class="stat-subvalue">${(data.commission_rate * 100)}% platform fee</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Host Payout</div>
                <div class="stat-value">${fmt(data.host_payout)}</div>
                <div class="stat-subvalue">To hosts</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Paid Bookings</div>
                <div class="stat-value">${(data.paid_bookings_count || 0).toLocaleString()}</div>
                <div class="stat-subvalue">Confirmed, active, completed</div>
            </div>
        `;

        createRevenueStreamChart(data);
        createMoneyFlowChart(data);
        createPaidBookingsChart(data);
        createRevenueCompositionChart(data);
    } catch (error) {
        console.error('Error loading revenue:', error);
        statsGrid.innerHTML = `<div class="empty-state">Error loading revenue: ${error.message}</div>`;
    }
}

// Revenue Stream: Smooth Area Chart with gradient (not normal bar)
function createRevenueStreamChart(data) {
    const canvas = document.getElementById('revenueStreamChart');
    if (!canvas) return;

    if (revenueStreamChart) revenueStreamChart.destroy();

    const ctx = canvas.getContext('2d');
    const labels = (data.monthly_breakdown || []).map(m => m.label);
    const values = (data.monthly_breakdown || []).map(m => m.revenue);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(155, 89, 182, 0.5)');
    gradient.addColorStop(0.5, 'rgba(142, 68, 173, 0.2)');
    gradient.addColorStop(1, 'rgba(142, 68, 173, 0.02)');

    revenueStreamChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenue (KES)',
                data: values,
                fill: true,
                backgroundColor: gradient,
                borderColor: 'rgba(155, 89, 182, 1)',
                borderWidth: 2.5,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: 'rgba(155, 89, 182, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Revenue: KES ${(ctx.raw || 0).toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: {
                        callback: (v) => 'KES ' + (v >= 1000 ? (v/1000) + 'k' : v)
                    }
                }
            }
        }
    });
}

// Money Flow: Multiple line graph (Money In, Commission, Host Payout over months)
function createMoneyFlowChart(data) {
    const canvas = document.getElementById('moneyFlowChart');
    if (!canvas) return;

    if (moneyFlowChart) moneyFlowChart.destroy();

    const monthly = data.monthly_breakdown || [];
    const labels = monthly.map(m => m.label);
    const revenueData = monthly.map(m => m.revenue || 0);
    const commissionData = monthly.map(m => (m.revenue || 0) * 0.15);
    const hostPayoutData = monthly.map(m => (m.revenue || 0) * 0.85);

    const ctx = canvas.getContext('2d');

    moneyFlowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Money In',
                    data: revenueData,
                    borderColor: 'rgba(52, 211, 153, 1)',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    fill: false,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: 'Commission',
                    data: commissionData,
                    borderColor: 'rgba(251, 191, 36, 1)',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    fill: false,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: 'Host Payout',
                    data: hostPayoutData,
                    borderColor: 'rgba(96, 165, 250, 1)',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    fill: false,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: KES ${(ctx.raw || 0).toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: {
                        callback: (v) => 'KES ' + (v >= 1000 ? (v/1000) + 'k' : v)
                    }
                }
            }
        }
    });
}

// Paid Bookings Over Time: Line chart of booking count per month
function createPaidBookingsChart(data) {
    const canvas = document.getElementById('paidBookingsChart');
    if (!canvas) return;

    if (paidBookingsChart) paidBookingsChart.destroy();

    const monthly = data.monthly_breakdown || [];
    const labels = monthly.map(m => m.label);
    const counts = monthly.map(m => m.booking_count || 0);

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(52, 211, 153, 0.4)');
    gradient.addColorStop(1, 'rgba(52, 211, 153, 0.02)');

    paidBookingsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Bookings',
                data: counts,
                fill: true,
                backgroundColor: gradient,
                borderColor: 'rgba(52, 211, 153, 1)',
                borderWidth: 2,
                tension: 0.35,
                pointRadius: 4,
                pointBackgroundColor: 'rgba(52, 211, 153, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.raw || 0} bookings`
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                y: {
                    beginAtZero: true,
                    stepSize: 1,
                    grid: { color: 'rgba(0,0,0,0.06)' }
                }
            }
        }
    });
}

// Revenue Composition: Stacked area chart (Commission + Host Payout per month)
function createRevenueCompositionChart(data) {
    const canvas = document.getElementById('revenueCompositionChart');
    if (!canvas) return;

    if (revenueCompositionChart) revenueCompositionChart.destroy();

    const monthly = data.monthly_breakdown || [];
    const labels = monthly.map(m => m.label);
    const commissionData = monthly.map(m => (m.revenue || 0) * 0.15);
    const hostPayoutData = monthly.map(m => (m.revenue || 0) * 0.85);

    const ctx = canvas.getContext('2d');

    revenueCompositionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Commission',
                    data: commissionData,
                    fill: true,
                    stack: 'stack1',
                    backgroundColor: 'rgba(251, 191, 36, 0.5)',
                    borderColor: 'rgba(251, 191, 36, 1)',
                    borderWidth: 1.5,
                    tension: 0.35,
                    pointRadius: 2
                },
                {
                    label: 'Host Payout',
                    data: hostPayoutData,
                    fill: true,
                    stack: 'stack1',
                    backgroundColor: 'rgba(96, 165, 250, 0.5)',
                    borderColor: 'rgba(96, 165, 250, 1)',
                    borderWidth: 1.5,
                    tension: 0.35,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: KES ${(ctx.raw || 0).toLocaleString()}`
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: { callback: (v) => v >= 1000 ? (v/1000) + 'k' : v }
                }
            }
        }
    });
}

// Host management state
let currentHostSearch = '';
let hostSearchTimeout = null;

// Setup host search (call once on page load)
function setupHostSearch() {
    const searchInput = document.getElementById('hostSearch');
    if (searchInput) {
        searchInput.oninput = (e) => {
            clearTimeout(hostSearchTimeout);
            hostSearchTimeout = setTimeout(() => {
                currentHostSearch = e.target.value;
                loadHosts();
            }, 300);
        };
    }
}

// Load hosts
async function loadHosts() {
    const content = document.getElementById('hostsContent');
    
    // Setup search if not already done
    setupHostSearch();
    
    try {
        const params = { limit: 50 };
        if (currentHostSearch) {
            params.search = currentHostSearch;
        }
        
        const data = await api.getHosts(params);
        if (data.hosts && data.hosts.length > 0) {
            content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Cars</th>
                                <th>Payment Methods</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.hosts.map(host => `
                                <tr>
                                    <td>${host.full_name}</td>
                                    <td>${host.email}</td>
                                    <td><span class="status-badge ${host.is_active ? 'active' : 'inactive'}">${host.is_active ? 'Active' : 'Inactive'}</span></td>
                                    <td>${host.cars_count || 0}</td>
                                    <td>${host.payment_methods_count || 0}</td>
                                    <td>
                                        <button class="btn btn-primary btn-small" onclick="viewHostDetails(${host.id})">View</button>
                                        ${host.is_active 
                                            ? `<button class="btn btn-secondary btn-small" onclick="deactivateHost(${host.id})">Deactivate</button>`
                                            : `<button class="btn btn-primary btn-small" onclick="activateHost(${host.id})">Activate</button>`
                                        }
                                        <button class="btn btn-danger btn-small" onclick="deleteHostConfirm(${host.id}, '${host.full_name}')">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            content.innerHTML = '<div class="empty-state">No hosts found</div>';
        }
    } catch (error) {
        console.error('Error loading hosts:', error);
        content.innerHTML = '<div class="empty-state">Error loading hosts</div>';
    }
}

// View host details
async function viewHostDetails(hostId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });
    
    // Show host detail page
    const hostDetailPage = document.getElementById('hostDetailPage');
    const hostDetailContent = document.getElementById('hostDetailContent');
    const hostDetailTitle = document.getElementById('hostDetailTitle');
    
    hostDetailPage.style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Host Details';
    hostDetailContent.innerHTML = '<div class="loading">Loading host details...</div>';
    
    try {
        const host = await api.getHost(hostId);
        hostDetailTitle.textContent = host.full_name || 'Host Details';
        
        hostDetailContent.innerHTML = `
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${host.full_name || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email:</div>
                        <div class="detail-value">${host.email || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Mobile:</div>
                        <div class="detail-value">${host.mobile_number || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">ID Number:</div>
                        <div class="detail-value">${host.id_number || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">
                            <span class="status-badge ${host.is_active ? 'active' : 'inactive'}">
                                ${host.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="host-detail-section">
                    <h3>Statistics</h3>
                    <div class="detail-row">
                        <div class="detail-label">Total Cars:</div>
                        <div class="detail-value">${host.cars_count || 0}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Payment Methods:</div>
                        <div class="detail-value">${host.payment_methods_count || 0}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Feedback Count:</div>
                        <div class="detail-value">${host.feedbacks_count || 0}</div>
                    </div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Bio</h3>
                <div class="detail-value" style="padding: 12px; background-color: #f9f9f9; border-radius: 4px; min-height: 60px;">
                    ${host.bio || 'No bio provided'}
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Account Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Account Created:</div>
                    <div class="detail-value">${new Date(host.created_at).toLocaleString()}</div>
                </div>
                ${host.updated_at ? `
                <div class="detail-row">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">${new Date(host.updated_at).toLocaleString()}</div>
                </div>
                ` : ''}
            </div>
            
            <div class="action-buttons" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
                ${host.is_active 
                    ? `<button class="btn btn-secondary" onclick="deactivateHost(${host.id}, true)">Deactivate Account</button>`
                    : `<button class="btn btn-primary" onclick="activateHost(${host.id}, true)">Activate Account</button>`
                }
                <button class="btn btn-danger" onclick="deleteHostConfirm(${host.id}, '${host.full_name}', true)">Delete Account</button>
            </div>
        `;
    } catch (error) {
        console.error('Error loading host details:', error);
        hostDetailContent.innerHTML = `<div class="empty-state">Error loading host details: ${error.message}</div>`;
    }
}


// Deactivate host
async function deactivateHost(hostId, reloadAfter = false) {
    if (!confirm('Are you sure you want to deactivate this host account?')) {
        return;
    }
    
    try {
        await api.deactivateHost(hostId);
        alert('Host account deactivated successfully');
        if (reloadAfter) {
            // Reload the host details page
            viewHostDetails(hostId);
        } else {
            loadHosts();
        }
    } catch (error) {
        alert('Error deactivating host: ' + error.message);
    }
}

// Activate host
async function activateHost(hostId, reloadAfter = false) {
    if (!confirm('Are you sure you want to activate this host account?')) {
        return;
    }
    
    try {
        await api.activateHost(hostId);
        alert('Host account activated successfully');
        if (reloadAfter) {
            // Reload the host details page
            viewHostDetails(hostId);
        } else {
            loadHosts();
        }
    } catch (error) {
        alert('Error activating host: ' + error.message);
    }
}

// Delete host confirmation
function deleteHostConfirm(hostId, hostName, reloadAfter = false) {
    if (!confirm(`Are you sure you want to permanently delete host "${hostName}"? This action cannot be undone.`)) {
        return;
    }
    
    deleteHost(hostId, reloadAfter);
}

// Delete host
async function deleteHost(hostId, reloadAfter = false) {
    try {
        await api.deleteHost(hostId);
        alert('Host deleted successfully');
        if (reloadAfter) {
            // Go back to hosts list after deletion
            backToHostsList();
        } else {
            loadHosts();
        }
    } catch (error) {
        alert('Error deleting host: ' + error.message);
    }
}

// Load clients
async function loadClients() {
    const content = document.getElementById('clientsContent');
    try {
        const data = await api.getClients({ limit: 50 });
        console.log('Clients data:', data);
        if (data.clients && data.clients.length > 0) {
            content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.clients.map(client => `
                                <tr>
                                    <td>${client.full_name}</td>
                                    <td>${client.email}</td>
                                    <td><span class="status-badge ${client.is_active ? 'active' : 'inactive'}">${client.is_active ? 'Active' : 'Inactive'}</span></td>
                                    <td>
                                        <button class="btn btn-primary btn-small" onclick="viewClientDetails(${client.id})">View</button>
                                        ${client.is_active 
                                            ? `<button class="btn btn-secondary btn-small" onclick="deactivateClient(${client.id})">Deactivate</button>`
                                            : `<button class="btn btn-primary btn-small" onclick="activateClient(${client.id})">Activate</button>`
                                        }
                                        <button class="btn btn-danger btn-small" onclick="deleteClientConfirm(${client.id}, '${client.full_name.replace(/'/g, "\\'")}')">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            content.innerHTML = '<div class="empty-state">No clients found</div>';
        }
    } catch (error) {
        console.error('Error loading clients:', error);
        content.innerHTML = '<div class="empty-state">Error loading clients</div>';
    }
}

// View client details
async function viewClientDetails(clientId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });
    
    // Show client detail page (reuse host detail page structure or create new)
    const hostDetailPage = document.getElementById('hostDetailPage');
    const hostDetailContent = document.getElementById('hostDetailContent');
    const hostDetailTitle = document.getElementById('hostDetailTitle');
    
    hostDetailPage.style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Client Details';
    hostDetailContent.innerHTML = '<div class="loading">Loading client details...</div>';
    
    try {
        const client = await api.getClient(clientId);
        hostDetailTitle.textContent = client.full_name || 'Client Details';
        
        hostDetailContent.innerHTML = `
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${client.full_name || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email:</div>
                        <div class="detail-value">${client.email || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Mobile Number:</div>
                        <div class="detail-value">${client.mobile_number || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">ID Number:</div>
                        <div class="detail-value">${client.id_number || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">
                            <span class="status-badge ${client.is_active ? 'active' : 'inactive'}">
                                ${client.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="host-detail-section">
                    <h3>Additional Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Bio:</div>
                        <div class="detail-value">${client.bio || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Fun Fact:</div>
                        <div class="detail-value">${client.fun_fact || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Created At:</div>
                        <div class="detail-value">${new Date(client.created_at).toLocaleString()}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Last Updated:</div>
                        <div class="detail-value">${client.updated_at ? new Date(client.updated_at).toLocaleString() : 'N/A'}</div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 24px; display: flex; gap: 12px;">
                ${client.is_active 
                    ? `<button class="btn btn-secondary" onclick="deactivateClient(${client.id}, true)">Deactivate Account</button>`
                    : `<button class="btn btn-primary" onclick="activateClient(${client.id}, true)">Activate Account</button>`
                }
                <button class="btn btn-danger" onclick="deleteClientConfirm(${client.id}, '${client.full_name.replace(/'/g, "\\'")}', true)">Delete Account</button>
                <button class="btn btn-secondary" onclick="backToClientsList()">Back to Clients</button>
            </div>
        `;
    } catch (error) {
        console.error('Error loading client details:', error);
        hostDetailContent.innerHTML = `<div class="error-state">Error loading client details: ${error.message}</div>`;
    }
}

// Back to clients list
function backToClientsList() {
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });
    document.getElementById('clientsContent').parentElement.style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Clients';
    loadClients();
}

// Activate client
async function activateClient(clientId, reloadAfter = false) {
    try {
        await api.activateClient(clientId);
        alert('Client account activated successfully');
        if (reloadAfter) {
            viewClientDetails(clientId);
        } else {
            loadClients();
        }
    } catch (error) {
        alert('Error activating client: ' + error.message);
    }
}

// Deactivate client
async function deactivateClient(clientId, reloadAfter = false) {
    if (!confirm('Are you sure you want to deactivate this client account?')) {
        return;
    }
    
    try {
        await api.deactivateClient(clientId);
        alert('Client account deactivated successfully');
        if (reloadAfter) {
            viewClientDetails(clientId);
        } else {
            loadClients();
        }
    } catch (error) {
        alert('Error deactivating client: ' + error.message);
    }
}

// Delete client confirmation
function deleteClientConfirm(clientId, clientName, reloadAfter = false) {
    if (!confirm(`Are you sure you want to permanently delete client "${clientName}"? This action cannot be undone.`)) {
        return;
    }
    
    deleteClient(clientId, reloadAfter);
}

// Delete client
async function deleteClient(clientId, reloadAfter = false) {
    try {
        await api.deleteClient(clientId);
        alert('Client deleted successfully');
        if (reloadAfter) {
            backToClientsList();
        } else {
            loadClients();
        }
    } catch (error) {
        alert('Error deleting client: ' + error.message);
    }
}

// Car management state
let currentCarSearch = '';
let currentCarStatusFilter = '';
let carSearchTimeout = null;

/** Escape for use inside HTML attribute values */
function escapeHtmlAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;');
}

/** Escape for plain text / element text content */
function escapeHtmlText(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Normalize car media API payload — backend may use snake_case or camelCase;
 * image_urls might be an array, a single string, or a JSON string.
 */
function normalizeCarImageUrls(mediaData) {
    if (!mediaData || typeof mediaData !== 'object') return [];
    const raw =
        mediaData.image_urls ??
        mediaData.imageUrls ??
        mediaData.urls ??
        mediaData.images;
    if (Array.isArray(raw)) {
        return raw.filter((u) => typeof u === 'string' && u.trim());
    }
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.filter((u) => typeof u === 'string' && u.trim());
            }
        } catch (_) {
            /* not JSON */
        }
        return [raw.trim()];
    }
    return [];
}

function normalizeCarVideoUrls(mediaData) {
    if (!mediaData || typeof mediaData !== 'object') return [];
    const raw = mediaData.video_urls ?? mediaData.videoUrls ?? mediaData.videos;
    if (Array.isArray(raw)) {
        return raw.filter((u) => typeof u === 'string' && u.trim());
    }
    if (typeof raw === 'string' && raw.trim()) {
        return [raw.trim()];
    }
    return [];
}

function buildCarMediaLists(mediaData) {
    let images = normalizeCarImageUrls(mediaData);
    const videos = normalizeCarVideoUrls(mediaData);
    const cover =
        mediaData.cover_image_url ??
        mediaData.coverImageUrl ??
        null;
    if (cover && typeof cover === 'string' && cover.trim()) {
        const c = cover.trim();
        if (!images.includes(c)) {
            images = [c, ...images];
        }
    }
    // Dedupe while preserving order
    images = [...new Set(images)];
    return { images, videos };
}

function renderCarMediaLoadingHtml() {
    return `
        <div class="host-detail-section car-media-section">
            <h3>Car Media <span class="car-media-count">(loading...)</span></h3>
            <div class="car-media-grid">
                <div class="car-media-skeleton"></div>
                <div class="car-media-skeleton"></div>
                <div class="car-media-skeleton"></div>
                <div class="car-media-skeleton"></div>
            </div>
        </div>
    `;
}

function renderCarMediaHtml(mediaData) {
    const { images: mediaImages, videos: mediaVideos } = buildCarMediaLists(mediaData || {});
    return `
        <div class="host-detail-section car-media-section">
            <h3>Car Media <span class="car-media-count">(${mediaImages.length} photo${mediaImages.length === 1 ? '' : 's'})</span></h3>
            ${mediaImages.length > 0 ? `
                <div class="car-media-grid" style="margin-bottom: ${mediaVideos.length > 0 ? '16px' : '0'};">
                    ${mediaImages.map((url, index) => {
                        const safe = escapeHtmlAttr(url);
                        return `
                        <a href="${safe}" target="_blank" rel="noopener noreferrer" title="Open image ${index + 1}">
                            <img
                                src="${safe}"
                                alt="Car image ${index + 1}"
                                class="car-media-thumb"
                                style="width: 100%; height: 130px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; background: #f5f5f5; display: block;"
                                loading="lazy"
                            />
                        </a>`;
                    }).join('')}
                </div>
            ` : '<div class="detail-value" style="color: #666;">No car images found.</div>'}
            ${mediaVideos.length > 0 ? `
                <div style="display: grid; gap: 12px;">
                    ${mediaVideos.map((url, index) => {
                        const safe = escapeHtmlAttr(url);
                        return `
                        <div>
                            <div class="detail-label" style="margin-bottom: 6px;">Video ${index + 1}</div>
                            <video controls preload="metadata" style="width: 100%; max-width: 520px; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <source src="${safe}" />
                                Your browser does not support the video tag.
                            </video>
                        </div>`;
                    }).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

async function loadCarMediaSection(carId) {
    const mediaContainer = document.getElementById('carMediaContainer');
    if (!mediaContainer) return;
    try {
        const mediaData = await api.getCarMedia(carId);
        mediaContainer.innerHTML = renderCarMediaHtml(mediaData);
    } catch (error) {
        console.warn('Unable to load car media from Supabase:', error);
        mediaContainer.innerHTML = `
            <div class="host-detail-section car-media-section">
                <h3>Car Media</h3>
                <div class="detail-value" style="color: #666;">Unable to load car media right now.</div>
            </div>
        `;
    }
}

// Setup car search and filter
function setupCarSearch() {
    const searchInput = document.getElementById('carSearch');
    const statusFilter = document.getElementById('carStatusFilter');
    
    if (searchInput && !searchInput.oninput) {
        searchInput.oninput = (e) => {
            clearTimeout(carSearchTimeout);
            carSearchTimeout = setTimeout(() => {
                currentCarSearch = e.target.value;
                loadCars();
            }, 300);
        };
    }
    
    if (statusFilter && !statusFilter.onchange) {
        statusFilter.onchange = (e) => {
            currentCarStatusFilter = e.target.value;
            loadCars();
        };
    }
}

// Load cars
async function loadCars() {
    const content = document.getElementById('carsContent');
    
    // Setup search and filter if not already done
    setupCarSearch();
    
    try {
        const params = { limit: 50 };
        if (currentCarSearch) {
            params.search = currentCarSearch;
        }
        if (currentCarStatusFilter) {
            params.status = currentCarStatusFilter;
        }
        
        const data = await api.getCars(params);
        if (data.cars && data.cars.length > 0) {
            content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Model</th>
                                <th>Year</th>
                                <th>Status</th>
                                <th>Host</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.cars.map(car => `
                                <tr>
                                    <td>${car.name || 'N/A'}</td>
                                    <td>${car.model || 'N/A'}</td>
                                    <td>${car.year || 'N/A'}</td>
                                    <td>
                                        <span class="status-badge ${car.verification_status === 'verified' ? 'active' : car.verification_status === 'denied' ? 'inactive' : ''}">
                                            ${car.verification_status || 'N/A'}
                                        </span>
                                    </td>
                                    <td>${car.host_name || 'N/A'}</td>
                                    <td>
                                        <button class="btn btn-primary btn-small" onclick="viewCarDetails(${car.id})">View</button>
                                        ${car.verification_status === 'awaiting' ? `
                                            <button class="btn btn-primary btn-small" onclick="approveCar(${car.id})">Approve</button>
                                            <button class="btn btn-secondary btn-small" onclick="rejectCarPrompt(${car.id})">Reject</button>
                                        ` : ''}
                                        ${car.is_hidden 
                                            ? `<button class="btn btn-primary btn-small" onclick="showCar(${car.id})">Show</button>`
                                            : `<button class="btn btn-secondary btn-small" onclick="hideCar(${car.id})">Hide</button>`
                                        }
                                        <button class="btn btn-danger btn-small" onclick="deleteCarConfirm(${car.id}, '${car.name || car.model || 'Car'}')">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            content.innerHTML = '<div class="empty-state">No cars found</div>';
        }
    } catch (error) {
        console.error('Error loading cars:', error);
        content.innerHTML = '<div class="empty-state">Error loading cars</div>';
    }
}

// Back to cars list
function backToCarsList() {
    loadPage('cars');
}

// View car details
async function viewCarDetails(carId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });
    
    // Show car detail page
    const carDetailPage = document.getElementById('carDetailPage');
    const carDetailContent = document.getElementById('carDetailContent');
    const carDetailTitle = document.getElementById('carDetailTitle');
    
    carDetailPage.style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Car Details';
    carDetailContent.innerHTML = '<div class="loading">Loading car details...</div>';
    
    try {
        const car = await api.getCar(carId);
        carDetailTitle.textContent = car.name || car.model || 'Car Details';
        
        carDetailContent.innerHTML = `
            <div id="carMediaContainer">${renderCarMediaLoadingHtml()}</div>
            
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${car.name || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Model:</div>
                        <div class="detail-value">${car.model || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Year:</div>
                        <div class="detail-value">${car.year || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Body Type:</div>
                        <div class="detail-value">${car.body_type || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Color:</div>
                        <div class="detail-value">${car.color || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">
                            <span class="status-badge ${car.verification_status === 'verified' ? 'active' : car.verification_status === 'denied' ? 'inactive' : ''}">
                                ${car.verification_status || 'N/A'}
                            </span>
                        </div>
                    </div>
                    ${car.rejection_reason ? `
                    <div class="detail-row">
                        <div class="detail-label">Rejection Reason:</div>
                        <div class="detail-value" style="color: #d32f2f;">${car.rejection_reason}</div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="host-detail-section">
                    <h3>Host Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Host Name:</div>
                        <div class="detail-value">${car.host_name || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Host Email:</div>
                        <div class="detail-value">${car.host_email || 'N/A'}</div>
                    </div>
                </div>
            </div>
            
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Specifications</h3>
                    <div class="detail-row">
                        <div class="detail-label">Seats:</div>
                        <div class="detail-value">${car.seats || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Fuel Type:</div>
                        <div class="detail-value">${car.fuel_type || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Transmission:</div>
                        <div class="detail-value">${car.transmission || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Mileage:</div>
                        <div class="detail-value">${car.mileage ? car.mileage.toLocaleString() + ' km' : 'N/A'}</div>
                    </div>
                    ${car.features && car.features.length > 0 ? `
                    <div class="detail-row">
                        <div class="detail-label">Features:</div>
                        <div class="detail-value">${car.features.join(', ')}</div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="host-detail-section">
                    <h3>Pricing</h3>
                    <div class="detail-row">
                        <div class="detail-label">Daily Rate:</div>
                        <div class="detail-value">${car.daily_rate ? 'ksh ' + car.daily_rate.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Weekly Rate:</div>
                        <div class="detail-value">${car.weekly_rate ? 'ksh ' + car.weekly_rate.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Monthly Rate:</div>
                        <div class="detail-value">${car.monthly_rate ? 'ksh ' + car.monthly_rate.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Min Rental Days:</div>
                        <div class="detail-value">${car.min_rental_days || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Max Rental Days:</div>
                        <div class="detail-value">${car.max_rental_days || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Min Age:</div>
                        <div class="detail-value">${car.min_age_requirement ? car.min_age_requirement + ' years' : 'N/A'}</div>
                    </div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Description</h3>
                <div class="detail-value" style="padding: 12px; background-color: #f9f9f9; border-radius: 4px; min-height: 60px;">
                    ${car.description || 'No description provided'}
                </div>
            </div>
            
            ${car.rules ? `
            <div class="host-detail-section">
                <h3>Rules</h3>
                <div class="detail-value" style="padding: 12px; background-color: #f9f9f9; border-radius: 4px; min-height: 60px;">
                    ${car.rules}
                </div>
            </div>
            ` : ''}
            
            ${car.location_name ? `
            <div class="host-detail-section">
                <h3>Location</h3>
                <div class="detail-row">
                    <div class="detail-label">Location:</div>
                    <div class="detail-value">${car.location_name}</div>
                </div>
                ${car.latitude && car.longitude ? `
                <div class="detail-row">
                    <div class="detail-label">Coordinates:</div>
                    <div class="detail-value">${car.latitude}, ${car.longitude}</div>
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            <div class="host-detail-section">
                <h3>Account Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Listing Created:</div>
                    <div class="detail-value">${new Date(car.created_at).toLocaleString()}</div>
                </div>
                ${car.updated_at ? `
                <div class="detail-row">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">${new Date(car.updated_at).toLocaleString()}</div>
                </div>
                ` : ''}
                <div class="detail-row">
                    <div class="detail-label">Complete:</div>
                    <div class="detail-value">${car.is_complete ? 'Yes' : 'No'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Hidden:</div>
                    <div class="detail-value">${car.is_hidden ? 'Yes' : 'No'}</div>
                </div>
            </div>
            
            <div class="action-buttons" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
                ${car.verification_status === 'awaiting' ? `
                    <button class="btn btn-primary" onclick="approveCar(${car.id}, true)">Approve</button>
                    <button class="btn btn-secondary" onclick="rejectCarPrompt(${car.id}, true)">Reject</button>
                ` : car.verification_status === 'denied' ? `
                    <button class="btn btn-primary" onclick="approveCar(${car.id}, true)">Approve</button>
                ` : ''}
                ${car.is_hidden 
                    ? `<button class="btn btn-primary" onclick="showCar(${car.id}, true)">Show Car</button>`
                    : `<button class="btn btn-secondary" onclick="hideCar(${car.id}, true)">Hide Car</button>`
                }
                <button class="btn btn-danger" onclick="deleteCarConfirm(${car.id}, '${car.name || car.model || 'Car'}', true)">Delete Car</button>
            </div>
        `;

        loadCarMediaSection(carId);
    } catch (error) {
        console.error('Error loading car details:', error);
        carDetailContent.innerHTML = `<div class="empty-state">Error loading car details: ${error.message}</div>`;
    }
}

// Approve car
async function approveCar(carId, reloadAfter = false) {
    if (!confirm('Are you sure you want to approve this car listing?')) {
        return;
    }
    
    try {
        await api.approveCar(carId);
        alert('Car approved successfully');
        if (reloadAfter) {
            viewCarDetails(carId);
        } else {
            loadCars();
        }
    } catch (error) {
        alert('Error approving car: ' + error.message);
    }
}

// Reject car prompt
function rejectCarPrompt(carId, reloadAfter = false) {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason && reason.trim()) {
        rejectCar(carId, reason.trim(), reloadAfter);
    } else if (reason !== null) {
        alert('Rejection reason is required');
    }
}

// Reject car
async function rejectCar(carId, rejectionReason, reloadAfter = false) {
    try {
        await api.rejectCar(carId, rejectionReason);
        alert('Car rejected successfully');
        if (reloadAfter) {
            viewCarDetails(carId);
        } else {
            loadCars();
        }
    } catch (error) {
        alert('Error rejecting car: ' + error.message);
    }
}

// Hide car
async function hideCar(carId, reloadAfter = false) {
    if (!confirm('Are you sure you want to hide this car from public listing?')) {
        return;
    }
    
    try {
        await api.hideCar(carId);
        alert('Car hidden successfully');
        if (reloadAfter) {
            viewCarDetails(carId);
        } else {
            loadCars();
        }
    } catch (error) {
        alert('Error hiding car: ' + error.message);
    }
}

// Show car
async function showCar(carId, reloadAfter = false) {
    try {
        await api.showCar(carId);
        alert('Car shown successfully');
        if (reloadAfter) {
            viewCarDetails(carId);
        } else {
            loadCars();
        }
    } catch (error) {
        alert('Error showing car: ' + error.message);
    }
}

// Delete car confirmation
function deleteCarConfirm(carId, carName, reloadAfter = false) {
    if (!confirm(`Are you sure you want to permanently delete car "${carName}"? This action cannot be undone.`)) {
        return;
    }
    
    deleteCar(carId, reloadAfter);
}

// Delete car
async function deleteCar(carId, reloadAfter = false) {
    try {
        await api.deleteCar(carId);
        alert('Car deleted successfully');
        if (reloadAfter) {
            backToCarsList();
        } else {
            loadCars();
        }
    } catch (error) {
        alert('Error deleting car: ' + error.message);
    }
}

// ==================== BOOKING MANAGEMENT ====================

// Booking management state
let currentBookingPage = 1;
let currentBookingSearch = '';
let currentBookingStatus = '';
let bookingSearchTimeout = null;

// Setup booking search
function setupBookingSearch() {
    const searchInput = document.getElementById('bookingSearch');
    const statusFilter = document.getElementById('bookingStatusFilter');
    
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
    const content = document.getElementById('bookingsContent');
    if (!content) return;
    
    setupBookingSearch();
    
    try {
        content.innerHTML = '<div class="loading">Loading bookings...</div>';
        
        const params = {
            page: currentBookingPage,
            limit: 20
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
                            ${data.bookings.map(booking => `
                                <tr>
                                    <td><strong>${booking.booking_id}</strong></td>
                                    <td>Client #${booking.client_id}</td>
                                    <td>${booking.host_name || 'N/A'}</td>
                                    <td>${booking.car_name || booking.car_model || 'N/A'}</td>
                                    <td>${new Date(booking.start_date).toLocaleDateString()}</td>
                                    <td>${new Date(booking.end_date).toLocaleDateString()}</td>
                                    <td>KES ${booking.total_price.toLocaleString()}</td>
                                    <td><span class="status-badge ${getBookingStatusClass(booking.status)}">${booking.status}</span></td>
                                    <td class="booking-actions-cell">
                                        <button class="btn btn-small btn-primary" onclick="viewBookingDetails('${booking.booking_id}')">View</button>
                                        ${getBookingActionButtons(booking)}
                                    </td>
                                </tr>
                            `).join('')}
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
        console.error('Error loading bookings:', error);
        content.innerHTML = `<div class="empty-state">Error loading bookings: ${error.message}</div>`;
    }
}

// Get booking status CSS class
function getBookingStatusClass(status) {
    const statusMap = {
        'pending': 'inactive',
        'confirmed': 'active',
        'active': 'active',
        'completed': 'active',
        'cancelled': 'inactive',
        'rejected': 'inactive'
    };
    return statusMap[status.toLowerCase()] || 'inactive';
}

// Get booking action buttons based on status
function getBookingActionButtons(booking) {
    const status = booking.status.toLowerCase();
    let buttons = '';
    
    if (status === 'pending') {
        buttons += `<button class="btn btn-small btn-primary" onclick="confirmBooking('${booking.booking_id}')">Confirm</button>`;
        buttons += `<button class="btn btn-small btn-danger" onclick="cancelBookingPrompt('${booking.booking_id}')">Cancel</button>`;
    } else if (status === 'confirmed') {
        buttons += `<button class="btn btn-small btn-danger" onclick="cancelBookingPrompt('${booking.booking_id}')">Cancel</button>`;
    } else if (status === 'active') {
        buttons += `<button class="btn btn-small" onclick="updateBookingStatusPrompt('${booking.booking_id}', 'completed')">Mark Complete</button>`;
    }
    
    if (status !== 'active' && status !== 'completed') {
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
    const pagination = document.getElementById('bookingsPagination');
    if (!pagination) return;
    
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(skip / limit) + 1;
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
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

// ==================== WITHDRAWAL MANAGEMENT ====================

let currentWithdrawalPage = 1;
let currentWithdrawalStatus = '';
let currentWithdrawalHostId = '';

function setupWithdrawalFilters() {
    const statusFilter = document.getElementById('withdrawalStatusFilter');
    const hostIdFilter = document.getElementById('withdrawalHostIdFilter');
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
    const content = document.getElementById('withdrawalsContent');
    if (!content) return;
    try {
        content.innerHTML = '<div class="loading">Loading withdrawals...</div>';
        const params = {
            skip: (currentWithdrawalPage - 1) * 20,
            limit: 20
        };
        if (currentWithdrawalStatus) params.status = currentWithdrawalStatus;
        if (currentWithdrawalHostId) params.host_id = parseInt(currentWithdrawalHostId, 10);
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
                            ${data.withdrawals.map(w => {
                                const details = w.payment_details ? (() => { try { const d = JSON.parse(w.payment_details); return d.mpesa_number || d.account_number || JSON.stringify(d); } catch { return w.payment_details; } })() : '—';
                                const statusClass = w.status === 'pending' ? 'inactive' : (w.status === 'completed' ? 'active' : 'inactive');
                                let actions = '';
                                if (w.status === 'pending') {
                                    actions = `<button class="btn btn-small btn-primary" onclick="openWithdrawalStatusModal(${w.id}, 'completed')">Mark completed</button>
                                        <button class="btn btn-small btn-secondary" onclick="openWithdrawalStatusModal(${w.id}, 'rejected')">Reject</button>
                                        <button class="btn btn-small" onclick="openWithdrawalStatusModal(${w.id}, 'cancelled')">Cancel</button>`;
                                } else {
                                    actions = '—';
                                }
                                return `<tr>
                                    <td>${w.id}</td>
                                    <td>${(w.host_name || '') + (w.host_email ? ' (' + w.host_email + ')' : '')} <small>#${w.host_id}</small></td>
                                    <td>KES ${typeof w.amount === 'number' ? w.amount.toLocaleString() : w.amount}</td>
                                    <td>${w.payment_method_type}: ${details}</td>
                                    <td><span class="status-badge ${statusClass}">${w.status}</span></td>
                                    <td>${w.created_at ? new Date(w.created_at).toLocaleString() : '—'}</td>
                                    <td>${actions}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            renderWithdrawalPagination(data.total, data.limit, data.skip);
        } else {
            content.innerHTML = '<div class="empty-state">No withdrawals found</div>';
            document.getElementById('withdrawalsPagination').innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading withdrawals:', error);
        content.innerHTML = `<div class="empty-state">Error loading withdrawals: ${error.message}</div>`;
    }
}

function renderWithdrawalPagination(total, limit, skip) {
    const pagination = document.getElementById('withdrawalsPagination');
    if (!pagination) return;
    const totalPages = Math.ceil(total / limit) || 1;
    const currentPage = Math.floor(skip / limit) + 1;
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    let html = '';
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
    const modal = document.getElementById('withdrawalStatusModal');
    const idInput = document.getElementById('withdrawalStatusModalId');
    const actionInput = document.getElementById('withdrawalStatusModalAction');
    const titleEl = document.getElementById('withdrawalStatusModalTitle');
    const summaryEl = document.getElementById('withdrawalStatusModalSummary');
    const notesEl = document.getElementById('withdrawalStatusAdminNotes');
    const errEl = document.getElementById('withdrawalStatusFormError');
    if (!modal || !idInput || !actionInput) return;
    idInput.value = id;
    actionInput.value = action;
    if (titleEl) titleEl.textContent = action === 'completed' ? 'Mark as completed' : (action === 'rejected' ? 'Reject withdrawal' : 'Cancel withdrawal');
    if (summaryEl) summaryEl.textContent = `Set withdrawal #${id} to "${action}". Add notes below if needed.`;
    if (notesEl) notesEl.value = '';
    if (errEl) errEl.textContent = '';
    modal.style.display = 'flex';
}

// ==================== REFUNDS MANAGEMENT ====================

let currentRefundPage = 1;
let currentRefundStatus = '';
let currentRefundBookingCode = '';
let currentRefundClientEmail = '';

function setupRefundFilters() {
    const statusFilter = document.getElementById('refundStatusFilter');
    const bookingCodeFilter = document.getElementById('refundBookingCodeFilter');
    const clientEmailFilter = document.getElementById('refundClientEmailFilter');

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
    const content = document.getElementById('refundsContent');
    if (!content) return;
    try {
        content.innerHTML = '<div class="loading">Loading refunds...</div>';
        const params = {
            page: currentRefundPage,
            limit: 20
        };
        if (currentRefundStatus) params.status = currentRefundStatus;
        if (currentRefundBookingCode) params.booking_code = currentRefundBookingCode;
        if (currentRefundClientEmail) params.client_email = currentRefundClientEmail;

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
                            ${data.refunds.map(r => {
                                const statusClass =
                                    r.status === 'completed' ? 'active'
                                    : r.status === 'processing' ? 'pending'
                                    : 'inactive';
                                const pct = typeof r.percentage === 'number'
                                    ? (r.percentage * 100).toFixed(1) + '%'
                                    : '—';
                                const canUpdate = r.status === 'pending' || r.status === 'processing';
                                const actions = canUpdate
                                    ? `
                                        <button class="btn btn-small btn-primary" onclick="updateRefundStatus(${r.id}, 'completed')">Mark completed</button>
                                        ${r.status === 'pending' ? `<button class="btn btn-small btn-secondary" onclick="updateRefundStatus(${r.id}, 'processing')">Mark processing</button>` : ''}
                                        <button class="btn btn-small btn-secondary" onclick="updateRefundStatus(${r.id}, 'failed')">Mark failed</button>
                                        <button class="btn btn-small" onclick="updateRefundStatus(${r.id}, 'cancelled')">Cancel</button>
                                      `
                                    : '—';
                                return `
                                    <tr>
                                        <td>${r.id}</td>
                                        <td>
                                            ${r.booking_code || ('#' + r.booking_id)}
                                            ${r.payment_id ? `<div style="font-size: 12px; color: #666;">Payment #${r.payment_id}</div>` : ''}
                                        </td>
                                        <td>
                                            ${r.client_name || '-'}
                                            ${r.client_email ? `<div style="font-size: 12px; color: #666;">${r.client_email}</div>` : ''}
                                        </td>
                                        <td>KES ${r.amount_original.toLocaleString()}</td>
                                        <td>KES ${r.amount_refund.toLocaleString()}</td>
                                        <td>${pct}</td>
                                        <td><span class="status-badge ${statusClass}">${r.status}</span></td>
                                        <td>
                                            <div style="max-width: 260px; font-size: 12px;">
                                                ${r.reason || '—'}
                                                ${r.internal_note ? `<div style="color: #666;"><strong>Note:</strong> ${r.internal_note}</div>` : ''}
                                            </div>
                                        </td>
                                        <td>
                                            ${r.processed_at ? new Date(r.processed_at).toLocaleString() : '—'}
                                            ${r.external_reference ? `<div style="font-size: 12px; color: #666;">Ref: ${r.external_reference}</div>` : ''}
                                        </td>
                                        <td>${actions}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            renderRefundPagination(data.total, data.limit, data.page);
        } else {
            content.innerHTML = '<div class="empty-state">No refunds found</div>';
            const pag = document.getElementById('refundsPagination');
            if (pag) pag.innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading refunds:', error);
        content.innerHTML = `<div class="empty-state">Error loading refunds: ${error.message}</div>`;
    }
}

function renderRefundPagination(total, limit, page) {
    const pagination = document.getElementById('refundsPagination');
    if (!pagination) return;
    const totalPages = Math.ceil(total / limit) || 1;
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    let html = '';
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
        newStatus === 'completed'
            ? 'Optional internal note (e.g. PSP reference, confirmation details):'
            : 'Optional internal note for this status change:';
    const note = window.prompt(reasonPrompt, '');
    const ext = window.prompt('Optional PSP/Bank refund reference:', '');
    try {
        await api.updateRefund(id, {
            status: newStatus,
            internal_note: note || undefined,
            external_reference: ext || undefined
        });
        await loadRefunds();
    } catch (error) {
        console.error('Error updating refund:', error);
        alert('Failed to update refund: ' + (error.message || 'Unknown error'));
    }
}

function closeWithdrawalStatusModal() {
    const modal = document.getElementById('withdrawalStatusModal');
    if (modal) modal.style.display = 'none';
}

async function confirmWithdrawalStatusUpdate() {
    const id = document.getElementById('withdrawalStatusModalId')?.value;
    const action = document.getElementById('withdrawalStatusModalAction')?.value;
    const notesEl = document.getElementById('withdrawalStatusAdminNotes');
    const errEl = document.getElementById('withdrawalStatusFormError');
    const btn = document.getElementById('withdrawalStatusConfirmBtn');
    if (!id || !action) return;
    const notes = notesEl ? notesEl.value.trim() : '';
    if (errEl) errEl.textContent = '';
    if (btn) btn.disabled = true;
    try {
        await api.updateWithdrawalStatus(id, { status: action, admin_notes: notes || undefined });
        closeWithdrawalStatusModal();
        loadWithdrawals();
    } catch (error) {
        if (errEl) errEl.textContent = error.message || 'Update failed';
    } finally {
        if (btn) btn.disabled = false;
    }
}

// View booking details
async function viewBookingDetails(bookingId) {
    const detailPage = document.getElementById('bookingDetailPage');
    const listPage = document.getElementById('bookingsPage');
    const content = document.getElementById('bookingDetailContent');
    const title = document.getElementById('bookingDetailTitle');
    
    if (!detailPage || !content) return;
    
    try {
        listPage.style.display = 'none';
        detailPage.style.display = 'block';
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
                ${booking.status_updated_at ? `
                <div class="detail-row">
                    <div class="detail-label">Status Updated At</div>
                    <div class="detail-value">${new Date(booking.status_updated_at).toLocaleString()}</div>
                </div>
                ` : ''}
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
                    <div class="detail-value">${booking.car_name || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Model</div>
                    <div class="detail-value">${booking.car_model || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Year</div>
                    <div class="detail-value">${booking.car_year || 'N/A'}</div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Host Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Host ID</div>
                    <div class="detail-value">${booking.host_id || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Host Name</div>
                    <div class="detail-value">${booking.host_name || 'N/A'}</div>
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
                    <div class="detail-value">${booking.pickup_time || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Return Time</div>
                    <div class="detail-value">${booking.return_time || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Pickup Location</div>
                    <div class="detail-value">${booking.pickup_location || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Return Location</div>
                    <div class="detail-value">${booking.return_location || 'N/A'}</div>
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
                    <div class="detail-value">${booking.damage_waiver_enabled ? `KES ${booking.damage_waiver_fee.toLocaleString()}` : 'Not enabled'}</div>
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
                    <div class="detail-value">${booking.drive_type || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Check-in Preference</div>
                    <div class="detail-value">${booking.check_in_preference || 'N/A'}</div>
                </div>
                ${booking.special_requirements ? `
                <div class="detail-row">
                    <div class="detail-label">Special Requirements</div>
                    <div class="detail-value">${booking.special_requirements}</div>
                </div>
                ` : ''}
            </div>
            
            ${booking.cancellation_reason ? `
            <div class="host-detail-section">
                <h3>Cancellation</h3>
                <div class="detail-row">
                    <div class="detail-label">Reason</div>
                    <div class="detail-value">${booking.cancellation_reason}</div>
                </div>
            </div>
            ` : ''}
            
            <div class="action-buttons">
                ${getBookingDetailActions(booking)}
            </div>
        `;
    } catch (error) {
        console.error('Error loading booking details:', error);
        content.innerHTML = `<div class="empty-state">Error loading booking details: ${error.message}</div>`;
    }
}

// Get booking detail action buttons
function getBookingDetailActions(booking) {
    const status = booking.status.toLowerCase();
    let buttons = '';
    
    if (status === 'pending') {
        buttons += `<button class="btn btn-primary" onclick="confirmBooking('${booking.booking_id}')">Confirm Booking</button>`;
        buttons += `<button class="btn btn-danger" onclick="cancelBookingPrompt('${booking.booking_id}')">Cancel Booking</button>`;
    } else if (status === 'confirmed') {
        buttons += `<button class="btn btn-danger" onclick="cancelBookingPrompt('${booking.booking_id}')">Cancel Booking</button>`;
    } else if (status === 'active') {
        buttons += `<button class="btn btn-primary" onclick="updateBookingStatusPrompt('${booking.booking_id}', 'completed')">Mark as Completed</button>`;
    }
    
    if (status !== 'active' && status !== 'completed') {
        buttons += `<button class="btn btn-danger" onclick="deleteBookingPrompt('${booking.booking_id}')">Delete Booking</button>`;
    }
    
    return buttons;
}

// Back to bookings list
function backToBookingsList() {
    loadPage('bookings');
}

// Confirm booking
async function confirmBooking(bookingId) {
    if (!confirm('Are you sure you want to confirm this booking?')) {
        return;
    }
    
    try {
        await api.confirmBooking(bookingId);
        alert('Booking confirmed successfully');
        if (document.getElementById('bookingDetailPage').style.display !== 'none') {
            viewBookingDetails(bookingId);
        } else {
            loadBookings();
        }
    } catch (error) {
        alert('Error confirming booking: ' + error.message);
    }
}

// Cancel booking prompt
function cancelBookingPrompt(bookingId) {
    const reason = prompt('Enter cancellation reason (optional):');
    if (reason !== null) {
        cancelBooking(bookingId, reason || null);
    }
}

// Cancel booking
async function cancelBooking(bookingId, reason = null) {
    try {
        await api.cancelBooking(bookingId, reason);
        alert('Booking cancelled successfully');
        if (document.getElementById('bookingDetailPage').style.display !== 'none') {
            viewBookingDetails(bookingId);
        } else {
            loadBookings();
        }
    } catch (error) {
        alert('Error cancelling booking: ' + error.message);
    }
}

// Update booking status prompt
function updateBookingStatusPrompt(bookingId, newStatus) {
    const statusLabels = {
        'completed': 'completed',
        'cancelled': 'cancelled',
        'rejected': 'rejected'
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
        if (document.getElementById('bookingDetailPage').style.display !== 'none') {
            viewBookingDetails(bookingId);
        } else {
            loadBookings();
        }
    } catch (error) {
        alert('Error updating booking status: ' + error.message);
    }
}

// Delete booking prompt
function deleteBookingPrompt(bookingId) {
    if (!confirm('Are you sure you want to permanently delete this booking? This action cannot be undone.')) {
        return;
    }
    
    deleteBooking(bookingId);
}

// Delete booking
async function deleteBooking(bookingId) {
    try {
        await api.deleteBooking(bookingId);
        alert('Booking deleted successfully');
        backToBookingsList();
    } catch (error) {
        alert('Error deleting booking: ' + error.message);
    }
}

// Toggle host selection dropdown visibility
function toggleHostSelection() {
    const recipientType = document.querySelector('input[name="recipientType"]:checked')?.value;
    const hostSelectionGroup = document.getElementById('hostSelectionGroup');
    const hostSelect = document.getElementById('notificationHostSelect');
    
    if (recipientType === 'specific') {
        hostSelectionGroup.style.display = 'block';
        if (hostSelect.options.length <= 1) {
            loadHostsForNotifications();
        }
    } else {
        hostSelectionGroup.style.display = 'none';
        hostSelect.value = '';
    }
}

// Load hosts for notification dropdown
async function loadHostsForNotifications() {
    const hostSelect = document.getElementById('notificationHostSelect');
    if (!hostSelect) return;
    
    try {
        hostSelect.innerHTML = '<option value="">Loading hosts...</option>';
        const data = await api.getHosts({ limit: 100 });
        
        if (data.hosts && data.hosts.length > 0) {
            // Filter to only active hosts
            const activeHosts = data.hosts.filter(host => host.is_active === true);
            
            if (activeHosts.length > 0) {
                hostSelect.innerHTML = '<option value="">Select a host...</option>';
                activeHosts.forEach(host => {
                    const option = document.createElement('option');
                    option.value = host.id;
                    option.textContent = `${host.full_name} (${host.email})`;
                    hostSelect.appendChild(option);
                });
            } else {
                hostSelect.innerHTML = '<option value="">No active hosts found</option>';
            }
        } else {
            hostSelect.innerHTML = '<option value="">No hosts found</option>';
        }
    } catch (error) {
        console.error('Error loading hosts:', error);
        hostSelect.innerHTML = '<option value="">Error loading hosts</option>';
    }
}

// Send notification
async function sendNotification(event) {
    event.preventDefault();
    
    const form = document.getElementById('notificationForm');
    const resultDiv = document.getElementById('notificationResult');
    const sendBtn = document.getElementById('sendNotificationBtn');
    
    const title = document.getElementById('notificationTitle').value.trim();
    const message = document.getElementById('notificationMessage').value.trim();
    const type = document.getElementById('notificationType').value;
    const recipientType = document.querySelector('input[name="recipientType"]:checked').value;

    if (!title || !message) {
        showNotifResult(resultDiv, 'error', 'Please fill in both title and message.');
        return;
    }

    // Disable button
    sendBtn.disabled = true;
    const originalBtnHtml = sendBtn.innerHTML;
    sendBtn.innerHTML = '<span class="notif-spinner"></span> Sending…';
    showNotifResult(resultDiv, '', '');
    
    try {
        const notificationData = {
            title: title,
            message: message,
            type: type
        };
        
        console.log('Sending notification:', notificationData);
        console.log('Recipient type:', recipientType);
        
        let response;
        if (recipientType === 'all') {
            response = await api.broadcastToHosts(notificationData);
        } else if (recipientType === 'specific') {
            const hostId = document.getElementById('notificationHostSelect').value;
            if (!hostId) {
                showNotifResult(resultDiv, 'error', 'Please pick a host first.');
                sendBtn.disabled = false;
                sendBtn.innerHTML = originalBtnHtml;
                return;
            }
            response = await api.sendToUser({
                user_type: 'host',
                user_id: parseInt(hostId),
                title, message, type,
            });
        } else {
            showNotifResult(resultDiv, 'error', 'Invalid recipient selected.');
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnHtml;
            return;
        }

        if (response.sent_count && response.sent_count > 0) {
            const detail = recipientType === 'specific' && response.user_id
                ? `Sent to host #${response.user_id}.`
                : `Sent to ${response.sent_count} recipient${response.sent_count === 1 ? '' : 's'}.`;
            showNotifResult(resultDiv, 'success', `<strong>Sent.</strong> ${detail}`);
        } else {
            showNotifResult(resultDiv, 'warning', response.message || 'No active recipients found.');
        }

        form.reset();
        document.getElementById('notificationType').value = 'info';
        document.querySelectorAll('#hostNotificationForm .notif-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
        document.querySelector('input[name="recipientType"][value="all"]').checked = true;
        document.querySelectorAll('input[name="recipientType"]').forEach(r => {
            const opt = r.closest('.notif-audience-opt');
            if (opt) opt.classList.toggle('active', r.checked);
        });
        document.getElementById('notificationHostSelect').value = '';
        toggleHostSelection();
        const counter = document.getElementById('hostMessageCounter');
        if (counter) counter.textContent = '0 / 1000';
        updateNotifPreview();
    } catch (error) {
        console.error('Error sending notification:', error);
        showNotifResult(resultDiv, 'error', `<strong>Error.</strong> ${error.message}`);
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalBtnHtml;
    }
}

// Switch notification tab
function switchNotificationTab(tab) {
    const hostTab = document.getElementById('hostNotificationTab');
    const clientTab = document.getElementById('clientNotificationTab');
    const hostForm = document.getElementById('hostNotificationForm');
    const clientForm = document.getElementById('clientNotificationForm');
    const isHost = tab === 'host';

    if (hostTab) { hostTab.classList.toggle('active', isHost); hostTab.setAttribute('aria-selected', String(isHost)); }
    if (clientTab) { clientTab.classList.toggle('active', !isHost); clientTab.setAttribute('aria-selected', String(!isHost)); }
    if (hostForm) hostForm.style.display = isHost ? 'block' : 'none';
    if (clientForm) clientForm.style.display = isHost ? 'none' : 'block';

    setupNotificationsInteractions();
    updateNotifPreview();
    if (!isHost) loadClientsForNotifications();
}

// ---- Notifications UI wiring (chips, counters, audience cards, preview) ----
let notificationsInteractionsBound = false;

function setupNotificationsInteractions() {
    if (notificationsInteractionsBound) return;
    notificationsInteractionsBound = true;

    // Type chips (host + client)
    document.querySelectorAll('.notif-chips').forEach(group => {
        const targetId = group.dataset.target;
        const select = document.getElementById(targetId);
        group.querySelectorAll('.notif-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                group.querySelectorAll('.notif-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                if (select) select.value = chip.dataset.value;
                updateNotifPreview();
            });
        });
    });

    // Audience option cards — toggle .active visual on the parent label.
    document.querySelectorAll('input[name="recipientType"], input[name="clientRecipientType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const group = radio.getAttribute('name');
            document.querySelectorAll(`input[name="${group}"]`).forEach(r => {
                const opt = r.closest('.notif-audience-opt');
                if (opt) opt.classList.toggle('active', r.checked);
            });
            updateNotifPreview();
        });
    });

    // Char counter + live preview on title/message
    const wireField = (id, counterId, max) => {
        const input = document.getElementById(id);
        const counter = counterId ? document.getElementById(counterId) : null;
        if (!input) return;
        const update = () => {
            if (counter) counter.textContent = `${input.value.length} / ${max}`;
            updateNotifPreview();
        };
        input.addEventListener('input', update);
        update();
    };
    wireField('notificationTitle');
    wireField('notificationMessage', 'hostMessageCounter', 1000);
    wireField('clientNotificationTitle');
    wireField('clientNotificationMessage', 'clientMessageCounter', 1000);

    // Specific-user select changes refresh preview audience line
    ['notificationHostSelect', 'notificationClientSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateNotifPreview);
    });
}

function updateNotifPreview() {
    const isClient = document.getElementById('clientNotificationForm')?.style.display !== 'none';
    const titleEl = document.getElementById(isClient ? 'clientNotificationTitle' : 'notificationTitle');
    const msgEl = document.getElementById(isClient ? 'clientNotificationMessage' : 'notificationMessage');
    const typeEl = document.getElementById(isClient ? 'clientNotificationType' : 'notificationType');
    const recipientType = document.querySelector(`input[name="${isClient ? 'clientRecipientType' : 'recipientType'}"]:checked`)?.value || 'all';

    const previewToast = document.getElementById('notifPreviewToast');
    const previewIcon = document.getElementById('notifPreviewIcon');
    const previewTitle = document.getElementById('notifPreviewTitle');
    const previewMessage = document.getElementById('notifPreviewMessage');
    const previewAudience = document.getElementById('notifPreviewAudience');
    if (!previewToast) return;

    const tone = (typeEl && typeEl.value) || 'info';
    previewToast.dataset.tone = tone;
    if (previewIcon) previewIcon.innerHTML = notifIconSvg(tone);

    previewTitle.textContent = (titleEl?.value || '').trim() || 'Notification title';
    previewMessage.textContent = (msgEl?.value || '').trim() || 'Your message will appear here as you type.';

    let audienceLabel;
    if (recipientType === 'all') {
        audienceLabel = isClient ? 'Clients · everyone' : 'Hosts · everyone';
    } else {
        const sel = document.getElementById(isClient ? 'notificationClientSelect' : 'notificationHostSelect');
        const text = sel && sel.value ? (sel.options[sel.selectedIndex]?.textContent || '').trim() : '';
        audienceLabel = text
            ? `${isClient ? 'Client' : 'Host'} · ${text}`
            : `${isClient ? 'Client' : 'Host'} · pick one`;
    }
    previewAudience.textContent = audienceLabel;
}

function notifIconSvg(tone) {
    switch (tone) {
        case 'success':
            return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
        case 'warning':
            return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        case 'error':
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

// Toggle client selection
function toggleClientSelection() {
    const clientSelectionGroup = document.getElementById('clientSelectionGroup');
    const clientSelect = document.getElementById('notificationClientSelect');
    const recipientType = document.querySelector('input[name="clientRecipientType"]:checked').value;
    
    if (recipientType === 'specific') {
        clientSelectionGroup.style.display = 'block';
        if (clientSelect.options.length <= 1) {
            loadClientsForNotifications();
        }
    } else {
        clientSelectionGroup.style.display = 'none';
        clientSelect.value = '';
    }
}

// Load clients for notification dropdown
async function loadClientsForNotifications() {
    const clientSelect = document.getElementById('notificationClientSelect');
    if (!clientSelect) return;
    
    try {
        clientSelect.innerHTML = '<option value="">Loading clients...</option>';
        const data = await api.getClients({ limit: 100 });
        
        if (data.clients && data.clients.length > 0) {
            // Filter to only active clients
            const activeClients = data.clients.filter(client => client.is_active === true);
            
            if (activeClients.length > 0) {
                clientSelect.innerHTML = '<option value="">Select a client...</option>';
                activeClients.forEach(client => {
                    const option = document.createElement('option');
                    option.value = client.id;
                    option.textContent = `${client.full_name} (${client.email})`;
                    clientSelect.appendChild(option);
                });
            } else {
                clientSelect.innerHTML = '<option value="">No active clients found</option>';
            }
        } else {
            clientSelect.innerHTML = '<option value="">No clients found</option>';
        }
    } catch (error) {
        console.error('Error loading clients:', error);
        clientSelect.innerHTML = '<option value="">Error loading clients</option>';
    }
}

// Send client notification
async function sendClientNotification(event) {
    event.preventDefault();
    
    const form = (event && event.target && typeof event.target.reset === 'function')
        ? event.target
        : document.getElementById('clientNotificationFormEl');
    const resultDiv = document.getElementById('clientNotificationResult');
    const sendBtn = document.getElementById('sendClientNotificationBtn');
    
    const title = document.getElementById('clientNotificationTitle').value.trim();
    const message = document.getElementById('clientNotificationMessage').value.trim();
    const type = document.getElementById('clientNotificationType').value;
    const emailSubject = (document.getElementById('clientNotificationEmailSubject').value || '').trim();
    const emailBodyHtml = (document.getElementById('clientNotificationEmailBody').value || '').trim();
    const recipientType = document.querySelector('input[name="clientRecipientType"]:checked').value;

    if (!title || !message) {
        showNotifResult(resultDiv, 'error', 'Please fill in both title and message.');
        return;
    }

    // Disable button
    sendBtn.disabled = true;
    const originalBtnHtml = sendBtn.innerHTML;
    sendBtn.innerHTML = '<span class="notif-spinner"></span> Sending…';
    showNotifResult(resultDiv, '', '');
    
    try {
        const notificationData = {
            title: title,
            message: message,
            type: type,
            // Optional email fields for preferences-based broadcast
            email_subject: emailSubject || undefined,
            email_body_html: emailBodyHtml || undefined
        };
        
        console.log('Sending client notification:', notificationData);
        console.log('Recipient type:', recipientType);
        
        let response;
        if (recipientType === 'all') {
            response = await api.broadcastToClientsByPreferences(notificationData);
        } else if (recipientType === 'specific') {
            const clientId = document.getElementById('notificationClientSelect').value;
            if (!clientId) {
                showNotifResult(resultDiv, 'error', 'Please pick a client first.');
                sendBtn.disabled = false;
                sendBtn.innerHTML = originalBtnHtml;
                return;
            }
            response = await api.sendToUser({
                user_type: 'client',
                user_id: parseInt(clientId),
                title, message, type,
            });
        } else {
            showNotifResult(resultDiv, 'error', 'Invalid recipient selected.');
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnHtml;
            return;
        }

        const sentCount = response.sent_count || 0;
        if (sentCount > 0) {
            const detail = recipientType === 'specific' && response.user_id
                ? `Sent to client #${response.user_id}.`
                : `Sent to ${sentCount} recipient${sentCount === 1 ? '' : 's'}.`;
            showNotifResult(resultDiv, 'success', `<strong>Sent.</strong> ${detail}`);
        } else {
            showNotifResult(resultDiv, 'warning', response.message || 'No active recipients found.');
        }

        form.reset();
        document.getElementById('clientNotificationType').value = 'info';
        document.querySelectorAll('#clientNotificationForm .notif-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
        document.querySelector('input[name="clientRecipientType"][value="all"]').checked = true;
        document.querySelectorAll('input[name="clientRecipientType"]').forEach(r => {
            const opt = r.closest('.notif-audience-opt');
            if (opt) opt.classList.toggle('active', r.checked);
        });
        document.getElementById('notificationClientSelect').value = '';
        toggleClientSelection();
        const counter = document.getElementById('clientMessageCounter');
        if (counter) counter.textContent = '0 / 1000';
        updateNotifPreview();
    } catch (error) {
        console.error('Error sending client notification:', error);
        showNotifResult(resultDiv, 'error', `<strong>Error.</strong> ${error.message}`);
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalBtnHtml;
    }
}

// Load feedback
async function loadFeedback() {
    const content = document.getElementById('feedbackContent');
    try {
        const data = await api.getFeedback({ limit: 50 });
        if (data.feedbacks && data.feedbacks.length > 0) {
            content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Content</th>
                                <th>Host</th>
                                <th>Flagged</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.feedbacks.map(feedback => `
                                <tr>
                                    <td>${feedback.content ? feedback.content.substring(0, 50) + (feedback.content.length > 50 ? '...' : '') : 'N/A'}</td>
                                    <td>${feedback.host_name || 'N/A'}</td>
                                    <td>${feedback.is_flagged ? 'Yes' : 'No'}</td>
                                    <td>${new Date(feedback.created_at).toLocaleDateString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            content.innerHTML = '<div class="empty-state">No feedback found</div>';
        }
    } catch (error) {
        console.error('Error loading feedback:', error);
        content.innerHTML = '<div class="empty-state">Error loading feedback</div>';
    }
}

// ==================== SUBSCRIBERS (NEWSLETTER) ====================

let subscribersCurrentPage = 1;
const subscribersLimit = 20;
let subscribersHandlersAttached = false;
let subscribersTrendChart = null;

function attachSubscribersHandlers() {
    if (subscribersHandlersAttached) return;
    subscribersHandlersAttached = true;
    const seeBtn = document.getElementById('seeSubscribersBtn');
    const filterEl = document.getElementById('subscribersFilter');
    const sendBtn = document.getElementById('sendNewsletterBtn');

    // Write / Preview tab toggle
    const writeTab = document.getElementById('newsletterWriteTab');
    const previewTab = document.getElementById('newsletterPreviewTab');
    const bodyEl = document.getElementById('newsletterBody');
    const previewEl = document.getElementById('newsletterPreview');
    if (writeTab && previewTab && bodyEl && previewEl) {
        writeTab.addEventListener('click', () => setNewsletterMode('write'));
        previewTab.addEventListener('click', () => setNewsletterMode('preview'));
    }
    if (seeBtn) {
        seeBtn.addEventListener('click', () => {
            const section = document.getElementById('subscribersListSection');
            if (!section) return;
            if (section.style.display === 'none') {
                section.style.display = 'block';
                seeBtn.textContent = 'Hide subscribers';
                loadSubscribersList(1);
            } else {
                section.style.display = 'none';
                seeBtn.textContent = 'See subscribers';
            }
        });
    }
    if (filterEl) filterEl.addEventListener('change', () => loadSubscribersList(1));
    if (sendBtn) sendBtn.addEventListener('click', sendNewsletterToSubscribers);
}

function createSubscribersTrendChart(labels, subscriptions, unsubscriptions) {
    const canvas = document.getElementById('subscribersTrendChart');
    if (!canvas) return;
    if (subscribersTrendChart) subscribersTrendChart.destroy();

    const ctx = canvas.getContext('2d');
    const height = canvas.height || 280;

    const subGradient = ctx.createLinearGradient(0, 0, 0, height);
    subGradient.addColorStop(0, 'rgba(37, 99, 235, 0.28)');
    subGradient.addColorStop(1, 'rgba(37, 99, 235, 0.02)');

    const unsubGradient = ctx.createLinearGradient(0, 0, 0, height);
    unsubGradient.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
    unsubGradient.addColorStop(1, 'rgba(239, 68, 68, 0.02)');

    subscribersTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => {
                const d = new Date(l);
                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            }),
            datasets: [
                {
                    label: 'Subscribed',
                    data: subscriptions,
                    borderColor: 'rgba(37, 99, 235, 1)',
                    backgroundColor: subGradient,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: 'rgba(37, 99, 235, 1)',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                },
                {
                    label: 'Unsubscribed',
                    data: unsubscriptions,
                    borderColor: 'rgba(239, 68, 68, 1)',
                    backgroundColor: unsubGradient,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: 'rgba(239, 68, 68, 1)',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 12,
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    cornerRadius: 8,
                    displayColors: true,
                    boxPadding: 4,
                },
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { maxRotation: 0, autoSkipPadding: 18, font: { size: 11 }, color: '#6b7280' },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(17, 24, 39, 0.05)', drawBorder: false, borderDash: [3, 3] },
                    ticks: { precision: 0, font: { size: 11 }, color: '#6b7280' },
                },
            },
            animation: { duration: 1000, easing: 'easeOutQuart' },
        },
    });
}

async function loadSubscribersList(page) {
    const tbody = document.getElementById('subscribersTableBody');
    const paginationEl = document.getElementById('subscribersPagination');
    if (!tbody || !paginationEl) return;
    subscribersCurrentPage = page;
    const filterEl = document.getElementById('subscribersFilter');
    const subscribedOnly = filterEl && filterEl.value === 'true';
    tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; color: #666; text-align: center;">Loading...</td></tr>';
    try {
        const data = await api.getSubscribers({
            page: page,
            limit: subscribersLimit,
            subscribed_only: subscribedOnly
        });
        const list = data.subscribers || [];
        const total = data.total || 0;
        const totalPages = data.total_pages || 1;
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; color: #666; text-align: center;">No subscribers found.</td></tr>';
        } else {
            tbody.innerHTML = list.map(s => `
                <tr>
                    <td>${escapeHtml(s.email)}</td>
                    <td>${s.is_subscribed ? 'Subscribed' : 'Unsubscribed'}</td>
                    <td>${s.created_at ? new Date(s.created_at).toLocaleString() : '—'}</td>
                </tr>
            `).join('');
        }
        paginationEl.innerHTML = '';
        if (totalPages > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn btn-secondary';
            prevBtn.textContent = 'Previous';
            prevBtn.disabled = page <= 1;
            prevBtn.onclick = () => loadSubscribersList(page - 1);
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-secondary';
            nextBtn.textContent = 'Next';
            nextBtn.disabled = page >= totalPages;
            nextBtn.onclick = () => loadSubscribersList(page + 1);
            const span = document.createElement('span');
            span.textContent = `Page ${page} of ${totalPages} (${total} total)`;
            span.style.marginLeft = '8px';
            paginationEl.appendChild(prevBtn);
            paginationEl.appendChild(nextBtn);
            paginationEl.appendChild(span);
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; color: #c62828; text-align: center;">Error loading subscribers. ' + (e.message || '') + '</td></tr>';
    }
}

// Render markdown → HTML (sanitized-ish: marked already escapes raw HTML when
// configured, but admins author this, so we keep things permissive).
function renderNewsletterMarkdown(md) {
    if (typeof marked === 'undefined') return md;
    try {
        return marked.parse(md, { gfm: true, breaks: true });
    } catch (e) {
        console.error('Markdown render failed:', e);
        return md;
    }
}

// Wrap rendered HTML in a minimal email template so every send looks consistent.
function wrapNewsletterEmail(innerHtml, subject) {
    const safeSubject = (subject || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#f6f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f8fb;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #eef2f7;border-radius:10px;">
          <tr>
            <td style="padding:32px 32px 24px;line-height:1.6;font-size:15px;color:#1f2937;">
              ${innerHtml}
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">
          You're receiving this because you subscribed to our newsletter.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function setNewsletterMode(mode) {
    const writeTab = document.getElementById('newsletterWriteTab');
    const previewTab = document.getElementById('newsletterPreviewTab');
    const bodyEl = document.getElementById('newsletterBody');
    const previewEl = document.getElementById('newsletterPreview');
    if (!writeTab || !previewTab || !bodyEl || !previewEl) return;

    const showPreview = mode === 'preview';
    writeTab.classList.toggle('active', !showPreview);
    previewTab.classList.toggle('active', showPreview);
    writeTab.setAttribute('aria-selected', String(!showPreview));
    previewTab.setAttribute('aria-selected', String(showPreview));

    if (showPreview) {
        const html = renderNewsletterMarkdown(bodyEl.value.trim());
        previewEl.innerHTML = html || '<p style="color:#9ca3af;">Nothing to preview yet — write some Markdown first.</p>';
        previewEl.hidden = false;
        bodyEl.hidden = true;
    } else {
        previewEl.hidden = true;
        bodyEl.hidden = false;
    }
}

async function sendNewsletterToSubscribers() {
    const subjectEl = document.getElementById('newsletterSubject');
    const bodyEl = document.getElementById('newsletterBody');
    const resultEl = document.getElementById('newsletterResult');
    const sendBtn = document.getElementById('sendNewsletterBtn');
    if (!subjectEl || !bodyEl || !resultEl || !sendBtn) return;
    const subject = subjectEl.value.trim();
    const markdown = bodyEl.value.trim();
    if (!subject || !markdown) {
        resultEl.className = 'form-result error';
        resultEl.textContent = 'Please enter subject and body.';
        return;
    }
    sendBtn.disabled = true;
    resultEl.className = 'form-result';
    resultEl.textContent = 'Sending…';
    try {
        const inner = renderNewsletterMarkdown(markdown);
        const wrapped = wrapNewsletterEmail(inner, subject);
        const data = await api.sendNewsletter({ subject, body_html: wrapped });
        resultEl.className = 'form-result success';
        resultEl.textContent = data.message || `Sent: ${data.sent || 0}, Failed: ${data.failed || 0}`;
    } catch (e) {
        resultEl.className = 'form-result error';
        resultEl.textContent = e.message || 'Failed to send';
    }
    sendBtn.disabled = false;
}

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function loadSubscribers() {
    attachSubscribersHandlers();
    const countEl = document.getElementById('subscribersCountDisplay');
    try {
        const [countData, trendsData] = await Promise.all([
            api.getSubscriberCount({ subscribed_only: 'true' }),
            api.getSubscriberTrends({ days: 30 })
        ]);
        if (countEl) countEl.textContent = countData.count != null ? countData.count : '—';
        const labels = trendsData.labels || [];
        const subscriptions = trendsData.subscriptions || [];
        const unsubscriptions = trendsData.unsubscriptions || [];
        createSubscribersTrendChart(labels, subscriptions, unsubscriptions);
    } catch (e) {
        if (countEl) countEl.textContent = '—';
        console.error('Error loading subscribers:', e);
    }
    const section = document.getElementById('subscribersListSection');
    const seeBtn = document.getElementById('seeSubscribersBtn');
    if (section) section.style.display = 'none';
    if (seeBtn) seeBtn.textContent = 'See subscribers';
}

// ==================== ADMIN MANAGEMENT ====================

// Admin management state
let currentAdminSearch = '';
let currentAdminRoleFilter = '';
let currentAdminStatusFilter = '';
let adminSearchTimeout = null;

// Setup admin search and filters
function setupAdminSearch() {
    const searchInput = document.getElementById('adminSearch');
    const roleFilter = document.getElementById('adminRoleFilter');
    const statusFilter = document.getElementById('adminStatusFilter');
    
    if (searchInput && !searchInput.oninput) {
        searchInput.oninput = (e) => {
            clearTimeout(adminSearchTimeout);
            adminSearchTimeout = setTimeout(() => {
                currentAdminSearch = e.target.value;
                loadAdmins();
            }, 300);
        };
    }
    
    if (roleFilter && !roleFilter.onchange) {
        roleFilter.onchange = (e) => {
            currentAdminRoleFilter = e.target.value;
            loadAdmins();
        };
    }
    
    if (statusFilter && !statusFilter.onchange) {
        statusFilter.onchange = (e) => {
            currentAdminStatusFilter = e.target.value;
            loadAdmins();
        };
    }
}

// Load admins
async function loadAdmins() {
    const content = document.getElementById('adminsContent');
    
    setupAdminSearch();
    
    try {
        const params = { limit: 50 };
        if (currentAdminSearch) {
            params.search = currentAdminSearch;
        }
        if (currentAdminRoleFilter) {
            params.role = currentAdminRoleFilter;
        }
        if (currentAdminStatusFilter) {
            params.is_active = currentAdminStatusFilter === 'true';
        }
        
        const data = await api.getAdmins(params);
        if (data.admins && data.admins.length > 0) {
            content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.admins.map(admin => `
                                <tr>
                                    <td>${admin.full_name}</td>
                                    <td>${admin.email}</td>
                                    <td>${admin.role}</td>
                                    <td><span class="status-badge ${admin.is_active ? 'active' : 'inactive'}">${admin.is_active ? 'Active' : 'Inactive'}</span></td>
                                    <td>${new Date(admin.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-primary btn-small" onclick="viewAdminDetails(${admin.id})">View</button>
                                        ${admin.is_active 
                                            ? `<button class="btn btn-secondary btn-small" onclick="deactivateAdmin(${admin.id})">Deactivate</button>`
                                            : `<button class="btn btn-primary btn-small" onclick="activateAdmin(${admin.id})">Activate</button>`
                                        }
                                        <button class="btn btn-danger btn-small" onclick="deleteAdminConfirm(${admin.id}, '${admin.full_name}')">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            content.innerHTML = '<div class="empty-state">No admins found</div>';
        }
    } catch (error) {
        console.error('Error loading admins:', error);
        if (error.message.includes('super_admin')) {
            content.innerHTML = '<div class="empty-state">Only super admins can access this page</div>';
        } else {
            content.innerHTML = '<div class="empty-state">Error loading admins</div>';
        }
    }
}

// Back to admins list
function backToAdminsList() {
    loadPage('admins');
}

// View admin details
async function viewAdminDetails(adminId) {
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });
    
    const adminDetailPage = document.getElementById('adminDetailPage');
    const adminDetailContent = document.getElementById('adminDetailContent');
    const adminDetailTitle = document.getElementById('adminDetailTitle');
    
    adminDetailPage.style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Admin Details';
    adminDetailContent.innerHTML = '<div class="loading">Loading admin details...</div>';
    
    try {
        const admin = await api.getAdmin(adminId);
        adminDetailTitle.textContent = admin.full_name || 'Admin Details';
        
        adminDetailContent.innerHTML = `
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${admin.full_name || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email:</div>
                        <div class="detail-value">${admin.email || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Role:</div>
                        <div class="detail-value">${admin.role || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">
                            <span class="status-badge ${admin.is_active ? 'active' : 'inactive'}">
                                ${admin.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="host-detail-section">
                    <h3>Account Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Created:</div>
                        <div class="detail-value">${new Date(admin.created_at).toLocaleString()}</div>
                    </div>
                    ${admin.updated_at ? `
                    <div class="detail-row">
                        <div class="detail-label">Last Updated:</div>
                        <div class="detail-value">${new Date(admin.updated_at).toLocaleString()}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="action-buttons" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
                <button class="btn btn-primary" onclick="showEditAdminForm(${admin.id})">Edit Admin</button>
                <button class="btn btn-secondary" onclick="showChangeAdminPasswordModal(${admin.id})">Change Password</button>
                ${admin.is_active 
                    ? `<button class="btn btn-secondary" onclick="deactivateAdmin(${admin.id}, true)">Deactivate</button>`
                    : `<button class="btn btn-primary" onclick="activateAdmin(${admin.id}, true)">Activate</button>`
                }
                <button class="btn btn-danger" onclick="deleteAdminConfirm(${admin.id}, '${admin.full_name}', true)">Delete</button>
            </div>
        `;
    } catch (error) {
        console.error('Error loading admin details:', error);
        adminDetailContent.innerHTML = `<div class="empty-state">Error loading admin details: ${error.message}</div>`;
    }
}

// Show create admin form
function showCreateAdminForm() {
    document.getElementById('adminModalTitle').textContent = 'Create Admin';
    document.getElementById('adminFormId').value = '';
    document.getElementById('adminForm').reset();
    document.getElementById('adminPasswordFields').style.display = 'block';
    document.getElementById('adminPassword').required = true;
    document.getElementById('adminPasswordConfirm').required = true;
    document.getElementById('adminRole').value = 'customer_service';
    document.getElementById('adminIsActive').checked = true;
    document.getElementById('adminFormError').textContent = '';
    document.getElementById('adminModal').style.display = 'flex';
}

// Show edit admin form
async function showEditAdminForm(adminId) {
    try {
        const admin = await api.getAdmin(adminId);
        document.getElementById('adminModalTitle').textContent = 'Edit Admin';
        document.getElementById('adminFormId').value = adminId;
        document.getElementById('adminFullName').value = admin.full_name || '';
        document.getElementById('adminEmail').value = admin.email || '';
        document.getElementById('adminPasswordFields').style.display = 'none';
        document.getElementById('adminPassword').required = false;
        document.getElementById('adminPasswordConfirm').required = false;
        document.getElementById('adminRole').value = admin.role || 'customer_service';
        document.getElementById('adminIsActive').checked = admin.is_active;
        document.getElementById('adminFormError').textContent = '';
        document.getElementById('adminModal').style.display = 'flex';
    } catch (error) {
        alert('Error loading admin: ' + error.message);
    }
}

// Save admin (create or update)
async function saveAdmin(event) {
    event.preventDefault();
    
    const adminId = document.getElementById('adminFormId').value;
    const errorDiv = document.getElementById('adminFormError');
    const saveBtn = document.getElementById('saveAdminBtn');
    
    const fullName = document.getElementById('adminFullName').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const passwordConfirm = document.getElementById('adminPasswordConfirm').value;
    const role = document.getElementById('adminRole').value;
    const isActive = document.getElementById('adminIsActive').checked;
    
    errorDiv.textContent = '';
    
    // Validation
    if (!fullName || !email) {
        errorDiv.textContent = 'Please fill in all required fields.';
        return;
    }
    
    if (!adminId && (!password || password.length < 8)) {
        errorDiv.textContent = 'Password must be at least 8 characters.';
        return;
    }
    
    if (!adminId && password !== passwordConfirm) {
        errorDiv.textContent = 'Passwords do not match.';
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        if (adminId) {
            // Update admin
            const updateData = {
                full_name: fullName,
                email: email,
                role: role,
                is_active: isActive
            };
            await api.updateAdmin(adminId, updateData);
            alert('Admin updated successfully');
            closeAdminModal();
            viewAdminDetails(adminId);
        } else {
            // Create admin
            const createData = {
                full_name: fullName,
                email: email,
                password: password,
                password_confirmation: passwordConfirm,
                role: role,
                is_active: isActive
            };
            await api.createAdmin(createData);
            alert('Admin created successfully');
            closeAdminModal();
            loadAdmins();
        }
    } catch (error) {
        errorDiv.textContent = error.message || 'Error saving admin';
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

// Close admin modal
function closeAdminModal() {
    document.getElementById('adminModal').style.display = 'none';
}

// Deactivate admin
async function deactivateAdmin(adminId, reloadAfter = false) {
    if (!confirm('Are you sure you want to deactivate this admin account?')) {
        return;
    }
    
    try {
        await api.deactivateAdmin(adminId);
        alert('Admin deactivated successfully');
        if (reloadAfter) {
            viewAdminDetails(adminId);
        } else {
            loadAdmins();
        }
    } catch (error) {
        alert('Error deactivating admin: ' + error.message);
    }
}

// Activate admin
async function activateAdmin(adminId, reloadAfter = false) {
    if (!confirm('Are you sure you want to activate this admin account?')) {
        return;
    }
    
    try {
        await api.activateAdmin(adminId);
        alert('Admin activated successfully');
        if (reloadAfter) {
            viewAdminDetails(adminId);
        } else {
            loadAdmins();
        }
    } catch (error) {
        alert('Error activating admin: ' + error.message);
    }
}

// Delete admin confirmation
function deleteAdminConfirm(adminId, adminName, reloadAfter = false) {
    if (!confirm(`Are you sure you want to permanently delete admin "${adminName}"? This action cannot be undone.`)) {
        return;
    }
    
    deleteAdmin(adminId, reloadAfter);
}

// Delete admin
async function deleteAdmin(adminId, reloadAfter = false) {
    try {
        await api.deleteAdmin(adminId);
        alert('Admin deleted successfully');
        if (reloadAfter) {
            backToAdminsList();
        } else {
            loadAdmins();
        }
    } catch (error) {
        alert('Error deleting admin: ' + error.message);
    }
}

// Show change admin password modal
function showChangeAdminPasswordModal(adminId) {
    document.getElementById('passwordModalTitle').textContent = 'Change Admin Password';
    document.getElementById('passwordFormType').value = 'admin';
    document.getElementById('passwordFormAdminId').value = adminId;
    document.getElementById('currentPasswordField').style.display = 'none';
    document.getElementById('currentPassword').required = false;
    document.getElementById('passwordForm').reset();
    document.getElementById('passwordFormError').textContent = '';
    document.getElementById('passwordModal').style.display = 'flex';
}

// Show change own password modal
function showChangeOwnPasswordModal() {
    document.getElementById('passwordModalTitle').textContent = 'Change My Password';
    document.getElementById('passwordFormType').value = 'own';
    document.getElementById('passwordFormAdminId').value = '';
    document.getElementById('currentPasswordField').style.display = 'block';
    document.getElementById('currentPassword').required = true;
    document.getElementById('passwordForm').reset();
    document.getElementById('passwordFormError').textContent = '';
    document.getElementById('passwordModal').style.display = 'flex';
}

// Save password
async function savePassword(event) {
    event.preventDefault();
    
    const formType = document.getElementById('passwordFormType').value;
    const adminId = document.getElementById('passwordFormAdminId').value;
    const errorDiv = document.getElementById('passwordFormError');
    const saveBtn = document.getElementById('savePasswordBtn');
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const newPasswordConfirm = document.getElementById('newPasswordConfirm').value;
    
    errorDiv.textContent = '';
    
    // Validation
    if (formType === 'own' && !currentPassword) {
        errorDiv.textContent = 'Please enter your current password.';
        return;
    }
    
    if (!newPassword || newPassword.length < 8) {
        errorDiv.textContent = 'New password must be at least 8 characters.';
        return;
    }
    
    if (newPassword !== newPasswordConfirm) {
        errorDiv.textContent = 'New passwords do not match.';
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Changing...';
    
    try {
        if (formType === 'own') {
            const data = {
                current_password: currentPassword,
                new_password: newPassword,
                new_password_confirmation: newPasswordConfirm
            };
            await api.changeOwnPassword(data);
            alert('Password changed successfully');
            closePasswordModal();
        } else {
            const data = {
                new_password: newPassword,
                new_password_confirmation: newPasswordConfirm
            };
            await api.changeAdminPassword(adminId, data);
            alert('Admin password changed successfully');
            closePasswordModal();
            viewAdminDetails(adminId);
        }
    } catch (error) {
        errorDiv.textContent = error.message || 'Error changing password';
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Change Password';
    }
}

// Close password modal
function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
}

// Load my profile
async function loadMyProfile() {
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });
    
    const myProfilePage = document.getElementById('myProfilePage');
    const myProfileContent = document.getElementById('myProfileContent');
    
    myProfilePage.style.display = 'block';
    document.getElementById('pageTitle').textContent = 'My Profile';
    myProfileContent.innerHTML = '<div class="loading">Loading profile...</div>';
    
    try {
        const admin = await api.getCurrentAdmin();
        
        myProfileContent.innerHTML = `
            <div style="max-width: 600px;">
                <div class="host-detail-section">
                    <h3>Profile Information</h3>
                    <form id="myProfileForm" onsubmit="saveMyProfile(event)">
                        <div class="form-group">
                            <label for="myProfileFullName">Full Name *</label>
                            <input type="text" id="myProfileFullName" value="${admin.full_name || ''}" required maxlength="255">
                        </div>
                        <div class="form-group">
                            <label for="myProfileEmail">Email *</label>
                            <input type="email" id="myProfileEmail" value="${admin.email || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <div class="detail-value" style="padding: 10px 0;">${admin.role || 'N/A'}</div>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <div style="padding: 10px 0;">
                                <span class="status-badge ${admin.is_active ? 'active' : 'inactive'}">
                                    ${admin.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                        <div id="myProfileError" style="color: #d32f2f; margin-bottom: 15px;"></div>
                        <div class="action-buttons">
                            <button type="submit" class="btn btn-primary">Update Profile</button>
                            <button type="button" class="btn btn-secondary" onclick="showChangeOwnPasswordModal()">Change Password</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading profile:', error);
        myProfileContent.innerHTML = `<div class="empty-state">Error loading profile: ${error.message}</div>`;
    }
}

// Save my profile
async function saveMyProfile(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('myProfileError');
    const saveBtn = event.target.querySelector('button[type="submit"]');
    
    const fullName = document.getElementById('myProfileFullName').value.trim();
    const email = document.getElementById('myProfileEmail').value.trim();
    
    if (!fullName || !email) {
        errorDiv.textContent = 'Please fill in all required fields.';
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Updating...';
    errorDiv.textContent = '';
    
    try {
        await api.updateOwnProfile({
            full_name: fullName,
            email: email
        });
        alert('Profile updated successfully');
        await loadAdminInfo();
        loadMyProfile();
    } catch (error) {
        errorDiv.textContent = error.message || 'Error updating profile';
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Update Profile';
    }
}

// Setup modal close on outside click
document.addEventListener('DOMContentLoaded', () => {
    const adminModal = document.getElementById('adminModal');
    const passwordModal = document.getElementById('passwordModal');
    
    if (adminModal) {
        adminModal.addEventListener('click', (e) => {
            if (e.target === adminModal) {
                closeAdminModal();
            }
        });
    }
    
    if (passwordModal) {
        passwordModal.addEventListener('click', (e) => {
            if (e.target === passwordModal) {
                closePasswordModal();
            }
        });
    }
});

// ==================== PAYMENT METHODS MANAGEMENT ====================

// Payment method management state
let currentPaymentMethodSearch = '';
let currentPaymentMethodTypeFilter = '';
let currentPaymentMethodHostFilter = '';
let paymentMethodSearchTimeout = null;

// Setup payment method search and filters
function setupPaymentMethodSearch() {
    const searchInput = document.getElementById('paymentMethodSearch');
    const typeFilter = document.getElementById('paymentMethodTypeFilter');
    const hostFilter = document.getElementById('paymentMethodHostFilter');
    
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
    const content = document.getElementById('paymentMethodsContent');
    
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
                            ${data.payment_methods.map(pm => `
                                <tr>
                                    <td>${pm.name || 'N/A'}</td>
                                    <td>${pm.method_type || 'N/A'}</td>
                                    <td>
                                        <div>${pm.host_name || 'N/A'}</div>
                                        <div style="font-size: 12px; color: #666;">${pm.host_email || ''}</div>
                                    </td>
                                    <td>
                                        ${pm.method_type === 'mpesa' 
                                            ? `<div>${pm.mpesa_number || 'N/A'}</div>`
                                            : pm.method_type === 'visa' || pm.method_type === 'mastercard'
                                            ? `<div>****${pm.card_last_four || '****'}</div>
                                               <div style="font-size: 12px; color: #666;">${pm.expiry_date || 'N/A'}</div>`
                                            : 'N/A'
                                        }
                                    </td>
                                    <td>${pm.is_default ? '<span class="status-badge active">Yes</span>' : '<span class="status-badge inactive">No</span>'}</td>
                                    <td>${new Date(pm.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-primary btn-small" onclick="viewPaymentMethodDetails(${pm.id})">View</button>
                                        <button class="btn btn-danger btn-small" onclick="deletePaymentMethodConfirm(${pm.id}, '${pm.name}')">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            content.innerHTML = '<div class="empty-state">No payment methods found</div>';
        }
    } catch (error) {
        console.error('Error loading payment methods:', error);
        content.innerHTML = '<div class="empty-state">Error loading payment methods</div>';
    }
}

// Back to payment methods list
function backToPaymentMethodsList() {
    loadPage('payment-methods');
}

// View payment method details
async function viewPaymentMethodDetails(paymentMethodId) {
    document.querySelectorAll('.page-content').forEach(p => {
        p.style.display = 'none';
    });
    
    const paymentMethodDetailPage = document.getElementById('paymentMethodDetailPage');
    const paymentMethodDetailContent = document.getElementById('paymentMethodDetailContent');
    const paymentMethodDetailTitle = document.getElementById('paymentMethodDetailTitle');
    
    paymentMethodDetailPage.style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Payment Method Details';
    paymentMethodDetailContent.innerHTML = '<div class="loading">Loading payment method details...</div>';
    
    try {
        const pm = await api.getPaymentMethod(paymentMethodId);
        paymentMethodDetailTitle.textContent = pm.name || 'Payment Method Details';
        
        paymentMethodDetailContent.innerHTML = `
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Payment Method Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${pm.name || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Type:</div>
                        <div class="detail-value">${pm.method_type || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Default:</div>
                        <div class="detail-value">
                            <span class="status-badge ${pm.is_default ? 'active' : 'inactive'}">
                                ${pm.is_default ? 'Yes' : 'No'}
                            </span>
                        </div>
                    </div>
                    ${pm.method_type === 'mpesa' ? `
                    <div class="detail-row">
                        <div class="detail-label">M-Pesa Number:</div>
                        <div class="detail-value">${pm.mpesa_number || 'N/A'}</div>
                    </div>
                    ` : ''}
                    ${pm.method_type === 'visa' || pm.method_type === 'mastercard' ? `
                    <div class="detail-row">
                        <div class="detail-label">Card Number:</div>
                        <div class="detail-value">****${pm.card_last_four || '****'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Card Type:</div>
                        <div class="detail-value">${pm.card_type || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Expiry Date:</div>
                        <div class="detail-value">${pm.expiry_date || 'N/A'}</div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="host-detail-section">
                    <h3>Host Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Host Name:</div>
                        <div class="detail-value">${pm.host_name || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Host Email:</div>
                        <div class="detail-value">${pm.host_email || 'N/A'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Host ID:</div>
                        <div class="detail-value">${pm.host_id || 'N/A'}</div>
                    </div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Account Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Created:</div>
                    <div class="detail-value">${new Date(pm.created_at).toLocaleString()}</div>
                </div>
                ${pm.updated_at ? `
                <div class="detail-row">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">${new Date(pm.updated_at).toLocaleString()}</div>
                </div>
                ` : ''}
            </div>
            
            <div class="action-buttons" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
                <button class="btn btn-danger" onclick="deletePaymentMethodConfirm(${pm.id}, '${pm.name}', true)">Delete Payment Method</button>
            </div>
        `;
    } catch (error) {
        console.error('Error loading payment method details:', error);
        paymentMethodDetailContent.innerHTML = `<div class="empty-state">Error loading payment method details: ${error.message}</div>`;
    }
}

// Delete payment method confirmation
function deletePaymentMethodConfirm(paymentMethodId, paymentMethodName, reloadAfter = false) {
    if (!confirm(`Are you sure you want to permanently delete payment method "${paymentMethodName}"? This action cannot be undone.`)) {
        return;
    }
    
    deletePaymentMethod(paymentMethodId, reloadAfter);
}

// Delete payment method
async function deletePaymentMethod(paymentMethodId, reloadAfter = false) {
    try {
        await api.deletePaymentMethod(paymentMethodId);
        alert('Payment method deleted successfully');
        if (reloadAfter) {
            backToPaymentMethodsList();
        } else {
            loadPaymentMethods();
        }
    } catch (error) {
        alert('Error deleting payment method: ' + error.message);
    }
}

// ==================== Support Conversations ====================

// Helper functions
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString();
    } catch (e) {
        return dateString;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
}

function getAvatarColor(name) {
    const palette = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#0ea5e9','#ef4444','#14b8a6','#f97316','#a855f7'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash)) | 0;
    return palette[Math.abs(hash) % palette.length];
}

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    try {
        const diff = Date.now() - new Date(dateString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(diff / 3600000);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(diff / 86400000);
        if (days < 7) return `${days}d ago`;
        return new Date(dateString).toLocaleDateString();
    } catch (e) { return ''; }
}

function formatTimeShort(dateString) {
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
}

function formatDateLabel(dateString) {
    if (!dateString) return '';
    try {
        const d = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return ''; }
}

let currentSupportPage = 1;
let currentSupportConversationId = null;
let supportSearchInitialized = false;

// Setup support search and filters (guards against duplicate listeners)
function setupSupportSearch() {
    if (supportSearchInitialized) return;
    supportSearchInitialized = true;

    const searchInput = document.getElementById('supportSearch');
    const statusFilter = document.getElementById('supportStatusFilter');
    const hostIdFilter = document.getElementById('supportHostIdFilter');

    let searchTimeout;
    const performSearch = () => { currentSupportPage = 1; loadSupportConversations(); };

    if (searchInput) searchInput.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(performSearch, 400); });
    if (statusFilter) statusFilter.addEventListener('change', performSearch);
    if (hostIdFilter) hostIdFilter.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(performSearch, 400); });
}

// Load support conversations
async function loadSupportConversations() {
    const content = document.getElementById('supportContent');
    const unreadCountEl = document.getElementById('unreadCount');
    
    if (!content) return;
    
    content.innerHTML = '<div class="loading">Loading conversations...</div>';
    
    try {
        const statusFilter = document.getElementById('supportStatusFilter')?.value || '';
        const hostIdFilter = document.getElementById('supportHostIdFilter')?.value || '';
        const search = document.getElementById('supportSearch')?.value || '';
        
        const params = {
            page: currentSupportPage,
            limit: 20
        };
        
        if (statusFilter) params.status_filter = statusFilter;
        if (hostIdFilter) params.host_id = parseInt(hostIdFilter);
        if (search) params.search = search;
        
        const response = await api.getSupportConversations(params);
        
        // Update unread count pill
        if (unreadCountEl) {
            if (response.unread_count > 0) {
                unreadCountEl.textContent = `${response.unread_count} unread`;
                unreadCountEl.style.display = 'inline-block';
            } else {
                unreadCountEl.style.display = 'none';
            }
        }

        if (!response.conversations || response.conversations.length === 0) {
            content.innerHTML = '<div class="empty-state">No conversations found</div>';
            document.getElementById('supportPagination').innerHTML = '';
            return;
        }

        let html = '<div class="support-conv-list">';

        response.conversations.forEach(conv => {
            const lastMessage = conv.messages && conv.messages.length > 0
                ? conv.messages[conv.messages.length - 1]
                : null;
            const hostName = conv.host_name || 'Unknown Host';
            const initials = getInitials(hostName);
            const avatarColor = getAvatarColor(hostName);
            const isUnread = !conv.is_read_by_admin;

            const statusBadge = conv.status === 'closed'
                ? '<span class="badge-status-closed">Closed</span>'
                : '<span class="badge-status-open">Open</span>';
            const unreadBadge = isUnread ? '<span class="badge-unread">New</span>' : '';

            let previewHtml = '<span style="font-style:italic;color:#b0b8c9;">No messages yet</span>';
            if (lastMessage) {
                const sender = lastMessage.sender_type === 'host' ? 'Host' : 'You';
                const preview = escapeHtml(lastMessage.message.substring(0, 85));
                previewHtml = `<strong>${sender}:</strong> ${preview}${lastMessage.message.length > 85 ? '…' : ''}`;
            }

            const isActive = currentSupportConversationId === conv.id;
            const rowClasses = [
                'support-conv-row',
                isUnread ? 'unread' : '',
                isActive ? 'active' : '',
            ].filter(Boolean).join(' ');

            html += `
                <div onclick="viewSupportConversation(${conv.id})" class="${rowClasses}" data-conv-id="${conv.id}">
                    <div class="support-conv-avatar" style="background:${avatarColor};">${escapeHtml(initials)}</div>
                    <div class="support-conv-body">
                        <div class="support-conv-top">
                            <span class="support-conv-name">${escapeHtml(hostName)}</span>
                            <span class="support-conv-time">${formatRelativeTime(lastMessage ? lastMessage.created_at : conv.created_at)}</span>
                        </div>
                        <div class="support-conv-preview">${previewHtml}</div>
                    </div>
                    <div class="support-conv-badges">${unreadBadge}${statusBadge}</div>
                </div>
            `;
        });

        html += '</div>';
        content.innerHTML = html;
        
        // Pagination
        renderSupportPagination(response);
        
    } catch (error) {
        console.error('Error loading conversations:', error);
        content.innerHTML = `<div class="error">Error loading conversations: ${error.message}</div>`;
    }
}

// Render pagination for support conversations
function renderSupportPagination(response) {
    const paginationEl = document.getElementById('supportPagination');
    if (!paginationEl || response.total_pages <= 1) {
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }
    
    let html = '';
    html += `<button class="btn btn-secondary" ${currentSupportPage === 1 ? 'disabled' : ''} onclick="changeSupportPage(${currentSupportPage - 1})">← Previous</button>`;
    html += `<span class="support-page-info">Page ${currentSupportPage} of ${response.total_pages} &nbsp;·&nbsp; ${response.total} total</span>`;
    html += `<button class="btn btn-secondary" ${currentSupportPage >= response.total_pages ? 'disabled' : ''} onclick="changeSupportPage(${currentSupportPage + 1})">Next →</button>`;
    paginationEl.innerHTML = html;
}

// Change support page
function changeSupportPage(page) {
    currentSupportPage = page;
    loadSupportConversations();
}

// View support conversation details
async function viewSupportConversation(conversationId) {
    currentSupportConversationId = conversationId;

    // Two-pane layout: show conversation in the right pane, mark row active
    const inbox = document.getElementById('supportInbox');
    const emptyState = document.getElementById('supportEmptyState');
    const convPane = document.getElementById('supportConversationPane');
    if (inbox) inbox.classList.add('conversation-open');
    if (emptyState) emptyState.style.display = 'none';
    if (convPane) convPane.style.display = 'flex';

    document.querySelectorAll('.support-conv-row').forEach(row => {
        row.classList.toggle('active', Number(row.dataset.convId) === conversationId);
    });

    const infoEl = document.getElementById('supportConversationInfo');
    const messagesEl = document.getElementById('supportMessages');
    const replyForm = document.getElementById('supportReplyForm');
    
    infoEl.innerHTML = '<div class="loading">Loading conversation...</div>';
    messagesEl.innerHTML = '<div class="loading">Loading messages...</div>';
    
    try {
        const conversation = await api.getSupportConversation(conversationId);

        // Render header info
        const hostName = conversation.host_name || 'Unknown Host';
        const initials = getInitials(hostName);
        const avatarColor = getAvatarColor(hostName);
        const statusBadge = conversation.status === 'closed'
            ? '<span class="badge-status-closed">Closed</span>'
            : '<span class="badge-status-open">Open</span>';

        infoEl.innerHTML = `
            <div class="support-chat-host-avatar" style="background:${avatarColor};">${escapeHtml(initials)}</div>
            <div class="support-chat-host-details">
                <div class="support-chat-host-name">${escapeHtml(hostName)}</div>
                <div class="support-chat-host-sub">
                    <span>${escapeHtml(conversation.host_email || '')}</span>
                    <span class="dot">·</span>
                    <span>ID: ${conversation.host_id}</span>
                    <span class="dot">·</span>
                    ${statusBadge}
                </div>
            </div>
        `;

        // Show/hide close/reopen buttons and reply form
        const closeBtn = document.getElementById('closeConversationBtn');
        const reopenBtn = document.getElementById('reopenConversationBtn');
        const existingBanner = document.getElementById('supportClosedBanner');
        if (existingBanner) existingBanner.remove();

        if (conversation.status === 'open') {
            closeBtn.style.display = 'flex';
            reopenBtn.style.display = 'none';
            replyForm.style.display = 'block';
        } else {
            closeBtn.style.display = 'none';
            reopenBtn.style.display = 'flex';
            replyForm.style.display = 'none';
            const banner = document.createElement('div');
            banner.id = 'supportClosedBanner';
            banner.className = 'support-closed-banner';
            banner.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                This conversation is closed.
                <button class="support-closed-reopen-btn" onclick="reopenSupportConversation()">Reopen</button>
            `;
            replyForm.parentNode.insertBefore(banner, replyForm);
        }

        // Render messages with day dividers
        if (!conversation.messages || conversation.messages.length === 0) {
            messagesEl.innerHTML = '<div class="empty-state">No messages yet</div>';
        } else {
            let messagesHtml = '';
            let lastDateLabel = '';

            conversation.messages.forEach(msg => {
                const isHost = msg.sender_type === 'host';
                const senderName = escapeHtml(msg.sender_name || (isHost ? hostName : 'Admin'));
                const msgInitials = isHost ? escapeHtml(initials) : 'A';
                const msgAvatarColor = isHost ? avatarColor : '#007ffa';
                const dateLabel = formatDateLabel(msg.created_at);

                if (dateLabel && dateLabel !== lastDateLabel) {
                    lastDateLabel = dateLabel;
                    messagesHtml += `<div class="support-day-divider">${escapeHtml(dateLabel)}</div>`;
                }

                messagesHtml += `
                    <div class="support-msg-row ${isHost ? 'host-row' : 'admin-row'}">
                        ${isHost ? `<div class="support-msg-avatar-sm" style="background:${msgAvatarColor};">${msgInitials}</div>` : ''}
                        <div class="support-msg-bubble-wrap">
                            <div class="support-msg-sender">${senderName}</div>
                            <div class="support-msg-bubble ${isHost ? 'host-bubble' : 'admin-bubble'}">${escapeHtml(msg.message).replace(/\n/g, '<br>')}</div>
                            <div class="support-msg-time">${formatDateTime(msg.created_at)}</div>
                        </div>
                        ${!isHost ? `<div class="support-msg-avatar-sm" style="background:#007ffa;">A</div>` : ''}
                    </div>
                `;
            });

            messagesEl.innerHTML = messagesHtml;
            requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
        }

    } catch (error) {
        console.error('Error loading conversation:', error);
        infoEl.innerHTML = `<div class="error">Error loading conversation: ${error.message}</div>`;
        messagesEl.innerHTML = '';
    }
}

// Back to support list — on mobile this collapses the right pane; on desktop
// it just clears the active selection and shows the empty state.
function backToSupportList() {
    currentSupportConversationId = null;
    const inbox = document.getElementById('supportInbox');
    const emptyState = document.getElementById('supportEmptyState');
    const convPane = document.getElementById('supportConversationPane');
    if (inbox) inbox.classList.remove('conversation-open');
    if (convPane) convPane.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    document.querySelectorAll('.support-conv-row.active').forEach(row => row.classList.remove('active'));
}

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', () => {
    const replyTextarea = document.getElementById('supportReplyMessage');
    if (replyTextarea) {
        replyTextarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }
});

// Send support reply
async function sendSupportReply(event) {
    event.preventDefault();
    
    if (!currentSupportConversationId) {
        alert('No conversation selected');
        return;
    }
    
    const messageInput = document.getElementById('supportReplyMessage');
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }
    
    if (message.length > 2000) {
        alert('Message must be 2000 characters or less');
        return;
    }
    
    // Disable form while sending
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';

    try {
        await api.respondToSupportConversation(currentSupportConversationId, message);
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Reload conversation to show new message
        await viewSupportConversation(currentSupportConversationId);

    } catch (error) {
        alert('Error sending reply: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '';
    }
}

// Close support conversation
async function closeSupportConversation() {
    if (!currentSupportConversationId) {
        alert('No conversation selected');
        return;
    }
    
    if (!confirm('Are you sure you want to close this conversation? The host will not be able to send new messages until it is reopened.')) {
        return;
    }
    
    try {
        await api.closeSupportConversation(currentSupportConversationId);
        await viewSupportConversation(currentSupportConversationId);
        alert('Conversation closed successfully');
    } catch (error) {
        alert('Error closing conversation: ' + error.message);
    }
}

// Reopen support conversation
async function reopenSupportConversation() {
    if (!currentSupportConversationId) {
        alert('No conversation selected');
        return;
    }
    
    try {
        await api.reopenSupportConversation(currentSupportConversationId);
        await viewSupportConversation(currentSupportConversationId);
        alert('Conversation reopened successfully');
    } catch (error) {
        alert('Error reopening conversation: ' + error.message);
    }
}

// ─── Moderation page ───────────────────────────────────────────────────────
// Two tabs over admin-only endpoints:
//   • Ratings        — /admin/ratings        (car/host/client unified feed)
//   • Secondary      — /admin/secondary-contacts
//
// Each tab keeps its own filter+pagination state. The detail drawer is shared
// between them; the current item type drives which API to read and which
// action to expose (delete rating vs. clear secondary contact).
// ───────────────────────────────────────────────────────────────────────────
const MOD_PAGE_SIZE = 20;
let moderationInited = false;
let moderationActiveTab = 'ratings';

const ratingsState = {
    page: 1,
    type: '',
    rating: '',
    order: 'desc',
    search: '',
    searchTimer: null,
};

const contactsState = {
    page: 1,
    status: '',
    hasContact: '',
    order: 'desc',
    search: '',
    searchTimer: null,
};

let modDrawerContext = null;

function initModerationPage() {
    if (!moderationInited) {
        bindModerationFilters();
        moderationInited = true;
    }
    switchModerationTab(moderationActiveTab);
}

function bindModerationFilters() {
    const debounced = (state, loader) => {
        return () => {
            clearTimeout(state.searchTimer);
            state.searchTimer = setTimeout(() => {
                state.page = 1;
                loader();
            }, 300);
        };
    };

    document.getElementById('ratingsTypeFilter').addEventListener('change', e => {
        ratingsState.type = e.target.value;
        ratingsState.page = 1;
        loadRatings();
        loadRatingsStats();
    });
    document.getElementById('ratingsStarsFilter').addEventListener('change', e => {
        ratingsState.rating = e.target.value;
        ratingsState.page = 1;
        loadRatings();
    });
    document.getElementById('ratingsOrderFilter').addEventListener('change', e => {
        ratingsState.order = e.target.value;
        ratingsState.page = 1;
        loadRatings();
    });
    document.getElementById('ratingsSearchInput').addEventListener('input', e => {
        ratingsState.search = e.target.value.trim();
        debounced(ratingsState, loadRatings)();
    });

    document.getElementById('contactsStatusFilter').addEventListener('change', e => {
        contactsState.status = e.target.value;
        contactsState.page = 1;
        loadSecondaryContacts();
        loadSecondaryContactsStats();
    });
    document.getElementById('contactsHasContactFilter').addEventListener('change', e => {
        contactsState.hasContact = e.target.value;
        contactsState.page = 1;
        loadSecondaryContacts();
    });
    document.getElementById('contactsOrderFilter').addEventListener('change', e => {
        contactsState.order = e.target.value;
        contactsState.page = 1;
        loadSecondaryContacts();
    });
    document.getElementById('contactsSearchInput').addEventListener('input', e => {
        contactsState.search = e.target.value.trim();
        debounced(contactsState, loadSecondaryContacts)();
    });
}

function switchModerationTab(tab) {
    moderationActiveTab = tab;
    document.querySelectorAll('.moderation-tab').forEach(btn => {
        const active = btn.getAttribute('data-mod-tab') === tab;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.getElementById('moderationRatingsPane').style.display = tab === 'ratings' ? 'block' : 'none';
    document.getElementById('moderationContactsPane').style.display = tab === 'contacts' ? 'block' : 'none';

    if (tab === 'ratings') {
        loadRatingsStats();
        loadRatings();
    } else {
        loadSecondaryContactsStats();
        loadSecondaryContacts();
    }
}

// ─── Ratings tab ──────────────────────────────────────────────────────────
async function loadRatingsStats() {
    const row = document.getElementById('ratingsStatsRow');
    if (!row) return;
    try {
        const stats = await api.getRatingsStats();
        const total = (stats.car_count || 0) + (stats.host_count || 0) + (stats.client_count || 0);
        const fmtAvg = v => (v == null ? '—' : Number(v).toFixed(2));
        row.innerHTML = `
            <div class="mod-stat-card">
                <div class="mod-stat-label">Total ratings</div>
                <div class="mod-stat-value">${total.toLocaleString()}</div>
                <div class="mod-stat-sub">Across cars, hosts, clients</div>
            </div>
            <div class="mod-stat-card">
                <div class="mod-stat-label">Cars</div>
                <div class="mod-stat-value">${(stats.car_count || 0).toLocaleString()}</div>
                <div class="mod-stat-sub">Avg ${fmtAvg(stats.car_average)} ★</div>
            </div>
            <div class="mod-stat-card">
                <div class="mod-stat-label">Hosts</div>
                <div class="mod-stat-value">${(stats.host_count || 0).toLocaleString()}</div>
                <div class="mod-stat-sub">Avg ${fmtAvg(stats.host_average)} ★</div>
            </div>
            <div class="mod-stat-card">
                <div class="mod-stat-label">Clients</div>
                <div class="mod-stat-value">${(stats.client_count || 0).toLocaleString()}</div>
                <div class="mod-stat-sub">Avg ${fmtAvg(stats.client_average)} ★</div>
            </div>
        `;
    } catch (err) {
        row.innerHTML = `<div class="mod-empty">Could not load stats: ${escapeModText(err.message)}</div>`;
    }
}

async function loadRatings() {
    const container = document.getElementById('ratingsContent');
    const paginationEl = document.getElementById('ratingsPagination');
    if (!container || !paginationEl) return;
    container.innerHTML = '<div class="loading">Loading ratings...</div>';
    paginationEl.innerHTML = '';

    const params = { page: ratingsState.page, limit: MOD_PAGE_SIZE, order: ratingsState.order };
    if (ratingsState.type) params.type = ratingsState.type;
    if (ratingsState.rating) params.rating_value = ratingsState.rating;
    if (ratingsState.search) params.search = ratingsState.search;

    try {
        const data = await api.getRatings(params);
        const items = data.items || data.ratings || [];
        const total = data.total || 0;
        const totalPages = data.total_pages || Math.max(1, Math.ceil(total / MOD_PAGE_SIZE));

        if (items.length === 0) {
            const filtered = !!(ratingsState.type || ratingsState.rating || ratingsState.search);
            container.innerHTML = `<div class="mod-empty">${filtered ? 'No ratings match these filters.' : 'No ratings have been submitted yet.'}</div>`;
            return;
        }

        const rows = items.map(item => `
            <tr onclick="openRatingDetail('${escapeModAttr(item.type)}', ${Number(item.id)})">
                <td class="mod-cell-muted">${formatModDate(item.created_at)}</td>
                <td><span class="mod-badge type-${escapeModAttr(item.type)}">${escapeModText(item.type)}</span></td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(item.author_name || '—')}</div>
                    <div class="mod-cell-muted">${escapeModText(item.author_type || '')}${item.author_id ? ` · #${item.author_id}` : ''}</div>
                </td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(item.subject_name || '—')}</div>
                    <div class="mod-cell-muted">${escapeModText(item.subject_type || '')}${item.subject_id ? ` · #${item.subject_id}` : ''}</div>
                </td>
                <td>${renderStars(item.rating)}</td>
                <td><div class="mod-cell-review">${escapeModText(item.review || '—')}</div></td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="table-container">
                <table class="mod-table">
                    <thead>
                        <tr>
                            <th>When</th>
                            <th>Type</th>
                            <th>Author</th>
                            <th>Subject</th>
                            <th>Rating</th>
                            <th>Review</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        renderModPagination(paginationEl, ratingsState.page, totalPages, total, p => {
            ratingsState.page = p;
            loadRatings();
        });
    } catch (err) {
        container.innerHTML = `<div class="mod-empty">Error loading ratings: ${escapeModText(err.message)}</div>`;
    }
}

async function openRatingDetail(ratingType, ratingId) {
    modDrawerContext = { kind: 'rating', ratingType, ratingId };
    showModerationDrawer('Rating detail', '<div class="loading">Loading...</div>', '');
    try {
        const item = await api.getRating(ratingType, ratingId);
        const body = `
            <div class="mod-field">
                <div class="mod-field-label">Rating</div>
                <div class="mod-field-value">${renderStars(item.rating)} <span class="mod-cell-muted">(${item.rating ?? '—'}/5)</span></div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Type</div>
                <div class="mod-field-value"><span class="mod-badge type-${escapeModAttr(item.type)}">${escapeModText(item.type)}</span></div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Created</div>
                <div class="mod-field-value">${formatModDate(item.created_at, true)}</div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Author</div>
                <div class="mod-field-value">${escapeModText(item.author_name || '—')} <span class="mod-cell-muted">· ${escapeModText(item.author_type || '')}${item.author_id ? ` #${item.author_id}` : ''}</span></div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Subject</div>
                <div class="mod-field-value">${escapeModText(item.subject_name || '—')} <span class="mod-cell-muted">· ${escapeModText(item.subject_type || '')}${item.subject_id ? ` #${item.subject_id}` : ''}</span></div>
            </div>
            ${item.booking_id ? `
            <div class="mod-field">
                <div class="mod-field-label">Booking</div>
                <div class="mod-field-value">#${Number(item.booking_id)}</div>
            </div>` : ''}
            <div class="mod-field">
                <div class="mod-field-label">Review</div>
                <div class="mod-field-value review-text">${escapeModText(item.review || '— No review text —')}</div>
            </div>
        `;
        const footer = `<button class="btn-danger" onclick="deleteRatingFromDrawer()">Delete rating</button>`;
        showModerationDrawer('Rating detail', body, footer);
    } catch (err) {
        showModerationDrawer('Rating detail', `<div class="mod-empty">Could not load: ${escapeModText(err.message)}</div>`, '');
    }
}

async function deleteRatingFromDrawer() {
    if (!modDrawerContext || modDrawerContext.kind !== 'rating') return;
    if (!confirm('Delete this rating? This cannot be undone.')) return;
    const footer = document.getElementById('modDrawerFooter');
    const btn = footer ? footer.querySelector('button') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
    try {
        await api.deleteRating(modDrawerContext.ratingType, modDrawerContext.ratingId);
        closeModerationDrawer();
        loadRatings();
        loadRatingsStats();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Delete rating'; }
        alert('Error deleting rating: ' + err.message);
    }
}

// ─── Secondary contacts tab ──────────────────────────────────────────────
async function loadSecondaryContactsStats() {
    const row = document.getElementById('contactsStatsRow');
    if (!row) return;
    try {
        const stats = await api.getSecondaryContactsStats();
        const verified = stats.verified || 0;
        const otpSent = stats.otp_sent || 0;
        const notStarted = stats.not_started || 0;
        const total = stats.total_clients ?? (verified + otpSent + notStarted);
        row.innerHTML = `
            <div class="mod-stat-card">
                <div class="mod-stat-label">Total clients</div>
                <div class="mod-stat-value">${Number(total).toLocaleString()}</div>
                <div class="mod-stat-sub">All client accounts</div>
            </div>
            <div class="mod-stat-card">
                <div class="mod-stat-label">Verified</div>
                <div class="mod-stat-value">${verified.toLocaleString()}</div>
                <div class="mod-stat-sub">Completed OTP verification</div>
            </div>
            <div class="mod-stat-card">
                <div class="mod-stat-label">OTP sent</div>
                <div class="mod-stat-value">${otpSent.toLocaleString()}</div>
                <div class="mod-stat-sub">Awaiting verification</div>
            </div>
            <div class="mod-stat-card">
                <div class="mod-stat-label">Not started</div>
                <div class="mod-stat-value">${notStarted.toLocaleString()}</div>
                <div class="mod-stat-sub">No contact captured</div>
            </div>
        `;
    } catch (err) {
        row.innerHTML = `<div class="mod-empty">Could not load stats: ${escapeModText(err.message)}</div>`;
    }
}

async function loadSecondaryContacts() {
    const container = document.getElementById('contactsContent');
    const paginationEl = document.getElementById('contactsPagination');
    if (!container || !paginationEl) return;
    container.innerHTML = '<div class="loading">Loading clients...</div>';
    paginationEl.innerHTML = '';

    const params = { page: contactsState.page, limit: MOD_PAGE_SIZE, order: contactsState.order };
    if (contactsState.status) params.status_filter = contactsState.status;
    if (contactsState.hasContact) params.has_contact = contactsState.hasContact;
    if (contactsState.search) params.search = contactsState.search;

    try {
        const data = await api.getSecondaryContacts(params);
        const items = data.items || data.contacts || [];
        const total = data.total || 0;
        const totalPages = data.total_pages || Math.max(1, Math.ceil(total / MOD_PAGE_SIZE));

        if (items.length === 0) {
            const filtered = !!(contactsState.status || contactsState.hasContact || contactsState.search);
            container.innerHTML = `<div class="mod-empty">${filtered ? 'No clients match these filters.' : 'No clients to show.'}</div>`;
            return;
        }

        const rows = items.map(item => `
            <tr onclick="openSecondaryContactDetail(${Number(item.client_id)})">
                <td class="mod-cell-muted">#${Number(item.client_id)}</td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(item.client_name || '—')}</div>
                    <div class="mod-cell-muted">${escapeModText(item.client_email || '')}</div>
                </td>
                <td class="mod-cell-muted">${escapeModText(item.client_phone || '—')}</td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(item.secondary_contact_names || '—')}</div>
                    <div class="mod-cell-muted">${escapeModText(item.secondary_contact_phone || '')}</div>
                </td>
                <td><span class="mod-badge status-${escapeModAttr(item.status || 'not_started')}">${escapeModText(formatContactStatus(item.status))}</span></td>
                <td class="mod-cell-muted">${item.verified_at ? formatModDate(item.verified_at) : '—'}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="table-container">
                <table class="mod-table">
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Name / Email</th>
                            <th>Phone</th>
                            <th>Secondary contact</th>
                            <th>Status</th>
                            <th>Verified</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        renderModPagination(paginationEl, contactsState.page, totalPages, total, p => {
            contactsState.page = p;
            loadSecondaryContacts();
        });
    } catch (err) {
        container.innerHTML = `<div class="mod-empty">Error loading clients: ${escapeModText(err.message)}</div>`;
    }
}

async function openSecondaryContactDetail(clientId) {
    modDrawerContext = { kind: 'contact', clientId };
    showModerationDrawer('Secondary contact', '<div class="loading">Loading...</div>', '');
    try {
        const item = await api.getSecondaryContact(clientId);
        const body = `
            <div class="mod-field">
                <div class="mod-field-label">Client</div>
                <div class="mod-field-value">${escapeModText(item.client_name || '—')} <span class="mod-cell-muted">· #${Number(item.client_id)}</span></div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Client email</div>
                <div class="mod-field-value">${escapeModText(item.client_email || '—')}</div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Client phone</div>
                <div class="mod-field-value">${escapeModText(item.client_phone || '—')}</div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Status</div>
                <div class="mod-field-value"><span class="mod-badge status-${escapeModAttr(item.status || 'not_started')}">${escapeModText(formatContactStatus(item.status))}</span></div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Secondary contact name</div>
                <div class="mod-field-value">${escapeModText(item.secondary_contact_names || '—')}</div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Secondary contact phone</div>
                <div class="mod-field-value">${escapeModText(item.secondary_contact_phone || '—')}</div>
            </div>
            ${item.verified_at ? `
            <div class="mod-field">
                <div class="mod-field-label">Verified at</div>
                <div class="mod-field-value">${formatModDate(item.verified_at, true)}</div>
            </div>` : ''}
            ${item.otp_expires_at ? `
            <div class="mod-field">
                <div class="mod-field-label">OTP expires at</div>
                <div class="mod-field-value">${formatModDate(item.otp_expires_at, true)}</div>
            </div>` : ''}
        `;
        const footer = `<button class="btn-danger" onclick="clearSecondaryContactFromDrawer()">Clear &amp; force restart</button>`;
        showModerationDrawer('Secondary contact', body, footer);
    } catch (err) {
        showModerationDrawer('Secondary contact', `<div class="mod-empty">Could not load: ${escapeModText(err.message)}</div>`, '');
    }
}

async function clearSecondaryContactFromDrawer() {
    if (!modDrawerContext || modDrawerContext.kind !== 'contact') return;
    if (!confirm('Clear this secondary contact? The client will need to start the OTP flow again.')) return;
    const footer = document.getElementById('modDrawerFooter');
    const btn = footer ? footer.querySelector('button') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Clearing…'; }
    try {
        await api.clearSecondaryContact(modDrawerContext.clientId);
        closeModerationDrawer();
        loadSecondaryContacts();
        loadSecondaryContactsStats();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Clear & force restart'; }
        alert('Error clearing contact: ' + err.message);
    }
}

// ─── Shared drawer + helpers ─────────────────────────────────────────────
function showModerationDrawer(title, bodyHtml, footerHtml) {
    const drawer = document.getElementById('moderationDrawer');
    if (!drawer) return;
    document.getElementById('modDrawerTitle').textContent = title;
    document.getElementById('modDrawerBody').innerHTML = bodyHtml;
    document.getElementById('modDrawerFooter').innerHTML = footerHtml || '';
    drawer.style.display = 'flex';
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeModerationDrawer() {
    const drawer = document.getElementById('moderationDrawer');
    if (!drawer) return;
    drawer.style.display = 'none';
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    modDrawerContext = null;
}

function renderModPagination(el, page, totalPages, total, onChange) {
    if (totalPages <= 1) {
        el.innerHTML = `<span class="mod-pagination-info">${total.toLocaleString()} ${total === 1 ? 'result' : 'results'}</span>`;
        return;
    }
    const prevDisabled = page <= 1 ? 'disabled' : '';
    const nextDisabled = page >= totalPages ? 'disabled' : '';
    el.innerHTML = `
        <button class="btn btn-secondary" ${prevDisabled} data-act="prev">Previous</button>
        <span class="mod-pagination-info">Page ${page} of ${totalPages} · ${total.toLocaleString()} total</span>
        <button class="btn btn-secondary" ${nextDisabled} data-act="next">Next</button>
    `;
    const [prevBtn, , nextBtn] = el.children;
    if (prevBtn && page > 1) prevBtn.addEventListener('click', () => onChange(page - 1));
    if (nextBtn && page < totalPages) nextBtn.addEventListener('click', () => onChange(page + 1));
}

function renderStars(value) {
    const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return `<span class="mod-stars">${'★'.repeat(v)}<span class="empty">${'★'.repeat(5 - v)}</span></span>`;
}

function formatContactStatus(status) {
    if (!status) return 'Not started';
    const map = { not_started: 'Not started', otp_sent: 'OTP sent', verified: 'Verified' };
    return map[status] || status;
}

function formatModDate(value, withTime = false) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return value;
    return withTime
        ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeModText(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeModAttr(value) {
    return escapeModText(value).replace(/`/g, '&#96;');
}
