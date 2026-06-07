// js/pages/moderation.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


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
let moderationActiveTab = "ratings";

const ratingsState = {
  page: 1,
  type: "",
  rating: "",
  order: "desc",
  search: "",
  searchTimer: null,
};

const contactsState = {
  page: 1,
  status: "",
  hasContact: "",
  order: "desc",
  search: "",
  searchTimer: null,
};

let modDrawerContext = null;

function initModerationPage() {
  if (!moderationInited) {
    bindModerationFilters();
    bindListingReportFilters(); // defined in js/pages/listing-reports.js
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

  document
    .getElementById("ratingsTypeFilter")
    .addEventListener("change", (e) => {
      ratingsState.type = e.target.value;
      ratingsState.page = 1;
      loadRatings();
      loadRatingsStats();
    });
  document
    .getElementById("ratingsStarsFilter")
    .addEventListener("change", (e) => {
      ratingsState.rating = e.target.value;
      ratingsState.page = 1;
      loadRatings();
    });
  document
    .getElementById("ratingsOrderFilter")
    .addEventListener("change", (e) => {
      ratingsState.order = e.target.value;
      ratingsState.page = 1;
      loadRatings();
    });
  document
    .getElementById("ratingsSearchInput")
    .addEventListener("input", (e) => {
      ratingsState.search = e.target.value.trim();
      debounced(ratingsState, loadRatings)();
    });

  document
    .getElementById("contactsStatusFilter")
    .addEventListener("change", (e) => {
      contactsState.status = e.target.value;
      contactsState.page = 1;
      loadSecondaryContacts();
      loadSecondaryContactsStats();
    });
  document
    .getElementById("contactsHasContactFilter")
    .addEventListener("change", (e) => {
      contactsState.hasContact = e.target.value;
      contactsState.page = 1;
      loadSecondaryContacts();
    });
  document
    .getElementById("contactsOrderFilter")
    .addEventListener("change", (e) => {
      contactsState.order = e.target.value;
      contactsState.page = 1;
      loadSecondaryContacts();
    });
  document
    .getElementById("contactsSearchInput")
    .addEventListener("input", (e) => {
      contactsState.search = e.target.value.trim();
      debounced(contactsState, loadSecondaryContacts)();
    });
}

function switchModerationTab(tab) {
  moderationActiveTab = tab;
  document.querySelectorAll(".moderation-tab").forEach((btn) => {
    const active = btn.getAttribute("data-mod-tab") === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.getElementById("moderationRatingsPane").style.display =
    tab === "ratings" ? "block" : "none";
  document.getElementById("moderationContactsPane").style.display =
    tab === "contacts" ? "block" : "none";
  document.getElementById("moderationReportsPane").style.display =
    tab === "reports" ? "block" : "none";

  if (tab === "ratings") {
    loadRatingsStats();
    loadRatings();
  } else if (tab === "contacts") {
    loadSecondaryContactsStats();
    loadSecondaryContacts();
  } else if (tab === "reports") {
    // defined in js/pages/listing-reports.js
    loadListingReportStats();
    loadListingReports();
  }
}

// ─── Ratings tab ──────────────────────────────────────────────────────────
async function loadRatingsStats() {
  const row = document.getElementById("ratingsStatsRow");
  if (!row) return;
  try {
    const stats = await api.getRatingsStats();
    const total =
      (stats.car_count || 0) +
      (stats.host_count || 0) +
      (stats.client_count || 0);
    const fmtAvg = (v) => (v == null ? "—" : Number(v).toFixed(2));
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
  const container = document.getElementById("ratingsContent");
  const paginationEl = document.getElementById("ratingsPagination");
  if (!container || !paginationEl) return;
  container.innerHTML = '<div class="loading">Loading ratings...</div>';
  paginationEl.innerHTML = "";

  const params = {
    page: ratingsState.page,
    limit: MOD_PAGE_SIZE,
    order: ratingsState.order,
  };
  if (ratingsState.type) params.type = ratingsState.type;
  if (ratingsState.rating) params.rating_value = ratingsState.rating;
  if (ratingsState.search) params.search = ratingsState.search;

  try {
    const data = await api.getRatings(params);
    const items = data.items || data.ratings || [];
    const total = data.total || 0;
    const totalPages =
      data.total_pages || Math.max(1, Math.ceil(total / MOD_PAGE_SIZE));

    if (items.length === 0) {
      const filtered = !!(
        ratingsState.type ||
        ratingsState.rating ||
        ratingsState.search
      );
      container.innerHTML = `<div class="mod-empty">${filtered ? "No ratings match these filters." : "No ratings have been submitted yet."}</div>`;
      return;
    }

    const rows = items
      .map(
        (item) => `
            <tr onclick="openRatingDetail('${escapeModAttr(item.type)}', ${Number(item.id)})">
                <td class="mod-cell-muted">${formatModDate(item.created_at)}</td>
                <td><span class="mod-badge type-${escapeModAttr(item.type)}">${escapeModText(item.type)}</span></td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(item.author_name || "—")}</div>
                    <div class="mod-cell-muted">${escapeModText(item.author_type || "")}${item.author_id ? ` · #${item.author_id}` : ""}</div>
                </td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(item.subject_name || "—")}</div>
                    <div class="mod-cell-muted">${escapeModText(item.subject_type || "")}${item.subject_id ? ` · #${item.subject_id}` : ""}</div>
                </td>
                <td>${renderStars(item.rating)}</td>
                <td><div class="mod-cell-review">${escapeModText(item.review || "—")}</div></td>
            </tr>
        `,
      )
      .join("");

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
    renderModPagination(
      paginationEl,
      ratingsState.page,
      totalPages,
      total,
      (p) => {
        ratingsState.page = p;
        loadRatings();
      },
    );
  } catch (err) {
    container.innerHTML = `<div class="mod-empty">Error loading ratings: ${escapeModText(err.message)}</div>`;
  }
}

async function openRatingDetail(ratingType, ratingId) {
  modDrawerContext = { kind: "rating", ratingType, ratingId };
  showModerationDrawer(
    "Rating detail",
    '<div class="loading">Loading...</div>',
    "",
  );
  try {
    const item = await api.getRating(ratingType, ratingId);
    const body = `
            <div class="mod-field">
                <div class="mod-field-label">Rating</div>
                <div class="mod-field-value">${renderStars(item.rating)} <span class="mod-cell-muted">(${item.rating ?? "—"}/5)</span></div>
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
                <div class="mod-field-value">${escapeModText(item.author_name || "—")} <span class="mod-cell-muted">· ${escapeModText(item.author_type || "")}${item.author_id ? ` #${item.author_id}` : ""}</span></div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Subject</div>
                <div class="mod-field-value">${escapeModText(item.subject_name || "—")} <span class="mod-cell-muted">· ${escapeModText(item.subject_type || "")}${item.subject_id ? ` #${item.subject_id}` : ""}</span></div>
            </div>
            ${
              item.booking_id
                ? `
            <div class="mod-field">
                <div class="mod-field-label">Booking</div>
                <div class="mod-field-value">#${Number(item.booking_id)}</div>
            </div>`
                : ""
            }
            <div class="mod-field">
                <div class="mod-field-label">Review</div>
                <div class="mod-field-value review-text">${escapeModText(item.review || "— No review text —")}</div>
            </div>
        `;
    const footer = `<button class="btn-danger" onclick="deleteRatingFromDrawer()">Delete rating</button>`;
    showModerationDrawer("Rating detail", body, footer);
  } catch (err) {
    showModerationDrawer(
      "Rating detail",
      `<div class="mod-empty">Could not load: ${escapeModText(err.message)}</div>`,
      "",
    );
  }
}

async function deleteRatingFromDrawer() {
  if (!modDrawerContext || modDrawerContext.kind !== "rating") return;
  if (!(await uiConfirm("Delete this rating? This cannot be undone."))) return;
  const footer = document.getElementById("modDrawerFooter");
  const btn = footer ? footer.querySelector("button") : null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Deleting…";
  }
  try {
    await api.deleteRating(
      modDrawerContext.ratingType,
      modDrawerContext.ratingId,
    );
    closeModerationDrawer();
    loadRatings();
    loadRatingsStats();
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Delete rating";
    }
    alert("Error deleting rating: " + err.message);
  }
}

// ─── Secondary contacts tab ──────────────────────────────────────────────
async function loadSecondaryContactsStats() {
  const row = document.getElementById("contactsStatsRow");
  if (!row) return;
  try {
    const stats = await api.getSecondaryContactsStats();
    const verified = stats.verified || 0;
    const otpSent = stats.otp_sent || 0;
    const notStarted = stats.not_started || 0;
    const total = stats.total_clients ?? verified + otpSent + notStarted;
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
  const container = document.getElementById("contactsContent");
  const paginationEl = document.getElementById("contactsPagination");
  if (!container || !paginationEl) return;
  container.innerHTML = '<div class="loading">Loading clients...</div>';
  paginationEl.innerHTML = "";

  const params = {
    page: contactsState.page,
    limit: MOD_PAGE_SIZE,
    order: contactsState.order,
  };
  if (contactsState.status) params.status_filter = contactsState.status;
  if (contactsState.hasContact) params.has_contact = contactsState.hasContact;
  if (contactsState.search) params.search = contactsState.search;

  try {
    const data = await api.getSecondaryContacts(params);
    const items = data.items || data.contacts || [];
    const total = data.total || 0;
    const totalPages =
      data.total_pages || Math.max(1, Math.ceil(total / MOD_PAGE_SIZE));

    if (items.length === 0) {
      const filtered = !!(
        contactsState.status ||
        contactsState.hasContact ||
        contactsState.search
      );
      container.innerHTML = `<div class="mod-empty">${filtered ? "No clients match these filters." : "No clients to show."}</div>`;
      return;
    }

    const rows = items
      .map(
        (item) => `
            <tr onclick="openSecondaryContactDetail(${Number(item.client_id)})">
                <td class="mod-cell-muted">#${Number(item.client_id)}</td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(item.client_name || "—")}</div>
                    <div class="mod-cell-muted">${escapeModText(item.client_email || "")}</div>
                </td>
                <td class="mod-cell-muted">${escapeModText(item.client_phone || "—")}</td>
                <td>
                    <div class="mod-cell-strong">${escapeModText(item.secondary_contact_names || "—")}</div>
                    <div class="mod-cell-muted">${escapeModText(item.secondary_contact_phone || "")}</div>
                </td>
                <td><span class="mod-badge status-${escapeModAttr(item.status || "not_started")}">${escapeModText(formatContactStatus(item.status))}</span></td>
                <td class="mod-cell-muted">${item.verified_at ? formatModDate(item.verified_at) : "—"}</td>
            </tr>
        `,
      )
      .join("");

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
    renderModPagination(
      paginationEl,
      contactsState.page,
      totalPages,
      total,
      (p) => {
        contactsState.page = p;
        loadSecondaryContacts();
      },
    );
  } catch (err) {
    container.innerHTML = `<div class="mod-empty">Error loading clients: ${escapeModText(err.message)}</div>`;
  }
}

async function openSecondaryContactDetail(clientId) {
  modDrawerContext = { kind: "contact", clientId };
  showModerationDrawer(
    "Secondary contact",
    '<div class="loading">Loading...</div>',
    "",
  );
  try {
    const item = await api.getSecondaryContact(clientId);
    const body = `
            <div class="mod-field">
                <div class="mod-field-label">Client</div>
                <div class="mod-field-value">${escapeModText(item.client_name || "—")} <span class="mod-cell-muted">· #${Number(item.client_id)}</span></div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Client email</div>
                <div class="mod-field-value">${escapeModText(item.client_email || "—")}</div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Client phone</div>
                <div class="mod-field-value">${escapeModText(item.client_phone || "—")}</div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Status</div>
                <div class="mod-field-value"><span class="mod-badge status-${escapeModAttr(item.status || "not_started")}">${escapeModText(formatContactStatus(item.status))}</span></div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Secondary contact name</div>
                <div class="mod-field-value">${escapeModText(item.secondary_contact_names || "—")}</div>
            </div>
            <div class="mod-field">
                <div class="mod-field-label">Secondary contact phone</div>
                <div class="mod-field-value">${escapeModText(item.secondary_contact_phone || "—")}</div>
            </div>
            ${
              item.verified_at
                ? `
            <div class="mod-field">
                <div class="mod-field-label">Verified at</div>
                <div class="mod-field-value">${formatModDate(item.verified_at, true)}</div>
            </div>`
                : ""
            }
            ${
              item.otp_expires_at
                ? `
            <div class="mod-field">
                <div class="mod-field-label">OTP expires at</div>
                <div class="mod-field-value">${formatModDate(item.otp_expires_at, true)}</div>
            </div>`
                : ""
            }
        `;
    const footer = `<button class="btn-danger" onclick="clearSecondaryContactFromDrawer()">Clear &amp; force restart</button>`;
    showModerationDrawer("Secondary contact", body, footer);
  } catch (err) {
    showModerationDrawer(
      "Secondary contact",
      `<div class="mod-empty">Could not load: ${escapeModText(err.message)}</div>`,
      "",
    );
  }
}

async function clearSecondaryContactFromDrawer() {
  if (!modDrawerContext || modDrawerContext.kind !== "contact") return;
  if (
    !(await uiConfirm(
      "Clear this secondary contact? The client will need to start the OTP flow again.",
    ))
  )
    return;
  const footer = document.getElementById("modDrawerFooter");
  const btn = footer ? footer.querySelector("button") : null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Clearing…";
  }
  try {
    await api.clearSecondaryContact(modDrawerContext.clientId);
    closeModerationDrawer();
    loadSecondaryContacts();
    loadSecondaryContactsStats();
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Clear & force restart";
    }
    alert("Error clearing contact: " + err.message);
  }
}

// ─── Shared drawer + helpers ─────────────────────────────────────────────
function showModerationDrawer(title, bodyHtml, footerHtml) {
  const drawer = document.getElementById("moderationDrawer");
  if (!drawer) return;
  document.getElementById("modDrawerTitle").textContent = title;
  document.getElementById("modDrawerBody").innerHTML = bodyHtml;
  document.getElementById("modDrawerFooter").innerHTML = footerHtml || "";
  drawer.style.display = "flex";
  drawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModerationDrawer() {
  const drawer = document.getElementById("moderationDrawer");
  if (!drawer) return;
  drawer.style.display = "none";
  drawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  modDrawerContext = null;
}

function renderModPagination(el, page, totalPages, total, onChange) {
  if (totalPages <= 1) {
    el.innerHTML = `<span class="mod-pagination-info">${total.toLocaleString()} ${total === 1 ? "result" : "results"}</span>`;
    return;
  }
  const prevDisabled = page <= 1 ? "disabled" : "";
  const nextDisabled = page >= totalPages ? "disabled" : "";
  el.innerHTML = `
        <button class="btn btn-secondary" ${prevDisabled} data-act="prev">Previous</button>
        <span class="mod-pagination-info">Page ${page} of ${totalPages} · ${total.toLocaleString()} total</span>
        <button class="btn btn-secondary" ${nextDisabled} data-act="next">Next</button>
    `;
  const [prevBtn, , nextBtn] = el.children;
  if (prevBtn && page > 1)
    prevBtn.addEventListener("click", () => onChange(page - 1));
  if (nextBtn && page < totalPages)
    nextBtn.addEventListener("click", () => onChange(page + 1));
}

function renderStars(value) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return `<span class="mod-stars">${"★".repeat(v)}<span class="empty">${"★".repeat(5 - v)}</span></span>`;
}

function formatContactStatus(status) {
  if (!status) return "Not started";
  const map = {
    not_started: "Not started",
    otp_sent: "OTP sent",
    verified: "Verified",
  };
  return map[status] || status;
}

function formatModDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d)) return value;
  return withTime
    ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function escapeModText(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeModAttr(value) {
  return escapeModText(value).replace(/`/g, "&#96;");
}

