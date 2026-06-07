// Listing Reports — moderation queue page.
// Talks to the /admin/listing-reports endpoints via the shared api.js helper.
// See reports.md for the backend contract.

const OPEN_STATUSES = ['received', 'reviewing'];
const RESOLVED_STATUSES = ['actioned', 'dismissed'];
const ALL_STATUSES = [...OPEN_STATUSES, ...RESOLVED_STATUSES];
const PAGE_SIZE = 20;
// Per-status fetch cap. Moderation volume is low; if a status exceeds this we
// flag it so the admin knows to narrow with filters rather than silently hiding rows.
const FETCH_LIMIT = 100;

const state = {
    tab: 'open',          // 'open' | 'resolved'
    statusFilter: '',     // specific status overrides the tab's status set
    carId: '',
    clientId: '',
    page: 1,              // client-side page over the merged result set
    rows: [],             // merged, sorted reports for the active view
    truncated: false      // true if any status hit FETCH_LIMIT
};

// ---- Auth gate -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    loadAdminInfo();
    setupChrome();
    setupControls();
    populateStatusFilter();
    loadOpenCount();
    loadReports();
});

async function loadAdminInfo() {
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.getElementById('profileAvatar');
    // Use cached info first for instant paint, then refresh from API.
    const cached = getAdminInfo();
    if (cached) applyAdminInfo(cached, nameEl, emailEl, avatarEl);
    try {
        const admin = await api.getCurrentAdmin();
        if (admin) {
            localStorage.setItem('admin_info', JSON.stringify(admin));
            applyAdminInfo(admin, nameEl, emailEl, avatarEl);
        }
    } catch (e) {
        // 401 already redirects inside apiRequest; ignore other failures here.
    }
}

function applyAdminInfo(admin, nameEl, emailEl, avatarEl) {
    nameEl.textContent = admin.full_name || 'Admin';
    emailEl.textContent = admin.email || '';
    const initials = (admin.full_name || admin.email || 'A')
        .split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    avatarEl.textContent = initials;
}

// ---- Header / nav chrome ---------------------------------------------------
function setupChrome() {
    const profileBtn = document.getElementById('profileButton');
    const profileMenu = document.getElementById('profileMenu');
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => profileMenu.classList.remove('show'));

    document.getElementById('logoutLink').addEventListener('click', async (e) => {
        e.preventDefault();
        try { await api.logout(); } catch (_) {}
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_info');
        window.location.href = 'index.html';
    });

    const toggle = document.getElementById('mobileNavToggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (toggle && sidebar) {
        const close = () => {
            sidebar.classList.remove('open');
            backdrop.classList.remove('show');
            toggle.setAttribute('aria-expanded', 'false');
        };
        toggle.addEventListener('click', () => {
            const open = sidebar.classList.toggle('open');
            backdrop.classList.toggle('show', open);
            toggle.setAttribute('aria-expanded', String(open));
        });
        backdrop.addEventListener('click', close);
    }
}

// ---- Controls --------------------------------------------------------------
function setupControls() {
    document.querySelectorAll('.reports-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.reports-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.tab = btn.dataset.tab;
            state.statusFilter = '';
            state.page = 1;
            populateStatusFilter();
            loadReports();
        });
    });

    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('refreshBtn').addEventListener('click', () => { loadOpenCount(); loadReports(); });
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    ['carIdFilter', 'clientIdFilter'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); });
    });

    document.getElementById('detailClose').addEventListener('click', closeDetail);
    document.getElementById('detailModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailModal') closeDetail();
    });
}

function applyFilters() {
    state.statusFilter = document.getElementById('statusFilter').value;
    state.carId = document.getElementById('carIdFilter').value.trim();
    state.clientId = document.getElementById('clientIdFilter').value.trim();
    state.page = 1;
    loadReports();
}

function populateStatusFilter() {
    const sel = document.getElementById('statusFilter');
    const statuses = state.tab === 'open' ? OPEN_STATUSES : RESOLVED_STATUSES;
    const label = state.tab === 'open' ? 'All open' : 'All resolved';
    sel.innerHTML = `<option value="">${label}</option>` +
        statuses.map(s => `<option value="${s}">${cap(s)}</option>`).join('');
}

// ---- Data load -------------------------------------------------------------
async function loadOpenCount() {
    const pill = document.getElementById('openCountPill');
    try {
        // Sum the totals of the two open statuses (cheap limit=1 calls).
        const results = await Promise.all(
            OPEN_STATUSES.map(s => api.getListingReports({ status: s, limit: 1 }))
        );
        const total = results.reduce((sum, r) => sum + (r.total || 0), 0);
        pill.textContent = total;
        pill.style.display = total > 0 ? 'inline-block' : 'none';
    } catch (e) {
        pill.style.display = 'none';
    }
}

async function loadReports() {
    const tbody = document.getElementById('reportsTableBody');
    tbody.innerHTML = '<tr><td colspan="6"><div class="loading">Loading reports...</div></td></tr>';

    // Which statuses make up the current view.
    let statuses;
    if (state.statusFilter) statuses = [state.statusFilter];
    else statuses = state.tab === 'open' ? OPEN_STATUSES : RESOLVED_STATUSES;

    const baseParams = { limit: FETCH_LIMIT, sort_by: 'created_at', order: 'desc' };
    if (state.carId) baseParams.car_id = state.carId;
    if (state.clientId) baseParams.client_id = state.clientId;

    try {
        const responses = await Promise.all(
            statuses.map(s => api.getListingReports({ ...baseParams, status: s }))
        );
        state.truncated = responses.some(r => (r.total || 0) > FETCH_LIMIT);
        const merged = responses.flatMap(r => r.reports || []);
        merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        state.rows = merged;
        renderTable();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Failed to load reports: ${escapeHtml(e.message || 'error')}</div></td></tr>`;
        document.getElementById('reportsPagination').innerHTML = '';
    }
}

// ---- Render ----------------------------------------------------------------
function renderTable() {
    const tbody = document.getElementById('reportsTableBody');
    const rows = state.rows;

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No reports in this view.</div></td></tr>';
        document.getElementById('reportsPagination').innerHTML = '';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageRows.map(r => `
        <tr>
            <td title="${escapeHtml(r.created_at || '')}">${fmtDate(r.created_at)}</td>
            <td>
                <div>${escapeHtml(r.car_name || ('Car #' + r.car_id))}</div>
                <div style="color:#999;font-size:12px;">#${r.car_id}</div>
            </td>
            <td>
                <div>${escapeHtml(r.client_name || '—')}</div>
                <div style="color:#999;font-size:12px;">${escapeHtml(r.client_email || '')}</div>
            </td>
            <td class="reason-cell">${escapeHtml(r.reason || '')}</td>
            <td>${statusBadge(r.status)}</td>
            <td><button type="button" class="btn btn-primary btn-small" onclick="openDetail(${r.id})">Review</button></td>
        </tr>
    `).join('');

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const el = document.getElementById('reportsPagination');
    const note = state.truncated
        ? `<span style="color:#b97400;font-size:12px;">Showing first ${FETCH_LIMIT} per status — narrow with filters</span>`
        : '';
    el.innerHTML = `
        <button type="button" class="btn btn-secondary btn-small" ${state.page <= 1 ? 'disabled' : ''} onclick="goPage(${state.page - 1})">Previous</button>
        <span style="font-size:14px;color:#555;">Page ${state.page} of ${totalPages} (${state.rows.length} total)</span>
        <button type="button" class="btn btn-secondary btn-small" ${state.page >= totalPages ? 'disabled' : ''} onclick="goPage(${state.page + 1})">Next</button>
        ${note}
    `;
}

function goPage(p) {
    state.page = p;
    renderTable();
}

// ---- Detail modal ----------------------------------------------------------
async function openDetail(reportId) {
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailBody');
    modal.style.display = 'flex';
    body.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const r = await api.getListingReport(reportId);
        body.innerHTML = renderDetail(r);
    } catch (e) {
        body.innerHTML = `<div class="empty-state">Failed to load report: ${escapeHtml(e.message || 'error')}</div>`;
    }
}

function renderDetail(r) {
    const carLink = `dashboard.html#cars?car_id=${r.car_id}`;
    const hostLink = r.host_id != null ? `dashboard.html#hosts?host_id=${r.host_id}` : null;
    return `
        <div class="detail-grid">
            <div class="label">Report ID</div><div class="value">#${r.id}</div>
            <div class="label">Status</div><div class="value">${statusBadge(r.status)}</div>
            <div class="label">Reason</div><div class="value">${escapeHtml(r.reason || '—')}</div>
            <div class="label">Car</div><div class="value"><a href="${carLink}">${escapeHtml(r.car_name || ('Car #' + r.car_id))}</a> (#${r.car_id})</div>
            <div class="label">Host</div><div class="value">${hostLink ? `<a href="${hostLink}">${escapeHtml(r.host_name || ('Host #' + r.host_id))}</a> (#${r.host_id})` : '—'}</div>
            <div class="label">Reporter</div><div class="value">${escapeHtml(r.client_name || '—')} (#${r.client_id})</div>
            <div class="label">Email</div><div class="value">${r.client_email ? `<a href="mailto:${escapeHtml(r.client_email)}">${escapeHtml(r.client_email)}</a>` : '—'}</div>
            <div class="label">Mobile</div><div class="value">${escapeHtml(r.client_mobile_number || '—')}</div>
            <div class="label">Reported</div><div class="value">${fmtDate(r.created_at)} <span style="color:#999;">${escapeHtml(r.created_at || '')}</span></div>
            <div class="label">Last updated</div><div class="value">${r.updated_at ? fmtDate(r.updated_at) : '—'}</div>
        </div>
        <div class="details-box">${escapeHtml(r.details || 'No additional details provided.')}</div>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick="setStatus(${r.id}, 'reviewing')" ${r.status === 'reviewing' ? 'disabled' : ''}>Start review</button>
            <button type="button" class="btn btn-primary" onclick="setStatus(${r.id}, 'actioned')" ${r.status === 'actioned' ? 'disabled' : ''}>Mark actioned</button>
            <button type="button" class="btn btn-secondary" onclick="setStatus(${r.id}, 'dismissed')" ${r.status === 'dismissed' ? 'disabled' : ''}>Dismiss</button>
            <button type="button" class="btn btn-danger" style="margin-left:auto;" onclick="deleteReport(${r.id})">Delete</button>
        </div>
    `;
}

function closeDetail() {
    document.getElementById('detailModal').style.display = 'none';
}

async function setStatus(reportId, status) {
    try {
        const updated = await api.updateListingReportStatus(reportId, status);
        document.getElementById('detailBody').innerHTML = renderDetail(updated);
        toast(`Report #${reportId} marked ${status}.`, 'ok');
        loadOpenCount();
        loadReports();
    } catch (e) {
        const msg = (e.message || '').toLowerCase().includes('status') ? 'Invalid status' : (e.message || 'Update failed');
        toast(msg, 'err');
    }
}

async function deleteReport(reportId) {
    if (!confirm(`Permanently delete report #${reportId}? This cannot be undone. Prefer "Dismiss" to keep the record.`)) return;
    try {
        await api.deleteListingReport(reportId);
        toast(`Report #${reportId} deleted.`, 'ok');
        closeDetail();
        loadOpenCount();
        loadReports();
    } catch (e) {
        toast(e.message || 'Delete failed', 'err');
    }
}

// ---- Helpers ---------------------------------------------------------------
function statusBadge(status) {
    const s = (status || '').toLowerCase();
    return `<span class="report-badge ${s}">${cap(s || 'unknown')}</span>`;
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let toastTimer = null;
function toast(message, kind) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = `toast show ${kind || ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 3000);
}
