// js/pages/affiliates.js — marketers who applied on ardena.co.ke/affiliate.
// Classic script (not a module): top-level functions and vars are global by design.
// Uses the chauffeurs-shared.js helpers (chText, chArg, chBadge, chSmall, fmtNairobi).
//
// Every admin can look. Super/general admins and managers approve (which gives
// the marketer an affiliate code) or reject; rejecting an approved affiliate
// deactivates them and their code stays reserved to them.

const AFF_PAGE_SIZE = 50;
const AFF_DECIDE_ROLES = ["super_admin", "general_admin", "manager"];
const AFF_PAY_ROLES = ["super_admin", "general_admin", "finance"];

let affStatus = "pending";
let affPlatform = "";
let affQuery = "";
let affPage = 1;
let affOpen = null; // the application shown in the modal
let affSearchTimer = null;
let affEarnStatus = "due";
let affEarnPage = 1;

const AFF_STATUS = {
  pending: ["Pending", "warn"],
  approved: ["Approved", "ok"],
  rejected: ["Rejected", "danger"],
};

const AFF_PLATFORM = { tiktok: "TikTok", instagram: "Instagram", x: "X", facebook: "Facebook", linkedin: "LinkedIn" };
// Platforms where people know an account by its @username.
const AFF_AT_PLATFORMS = ["tiktok", "instagram", "x"];

function affRole() {
  return window.currentAdminRole || (currentAdminInfo() || {}).role;
}

function affCanDecide() {
  return AFF_DECIDE_ROLES.includes(affRole());
}

function affCanPay() {
  return AFF_PAY_ROLES.includes(affRole());
}

const AFF_EARN_STATUS = {
  pending: ["Trip not finished", "info"],
  due: ["Due", "warn"],
  paid: ["Paid", "ok"],
  void: ["Cancelled", "muted"],
};

function affEarnBadge(status) {
  const [label, tone] = AFF_EARN_STATUS[status] || [status, "muted"];
  return chBadge(label, tone);
}

function initAffiliatesPage() {
  const status = document.getElementById("affStatusFilter");
  const platform = document.getElementById("affPlatformFilter");
  const search = document.getElementById("affSearch");
  if (status) {
    status.value = affStatus;
    status.onchange = () => {
      affStatus = status.value;
      affPage = 1;
      loadAffiliates();
    };
  }
  if (platform) {
    platform.value = affPlatform;
    platform.onchange = () => {
      affPlatform = platform.value;
      affPage = 1;
      loadAffiliates();
    };
  }
  const earnStatus = document.getElementById("affEarnStatusFilter");
  if (earnStatus) {
    earnStatus.value = affEarnStatus;
    earnStatus.onchange = () => {
      affEarnStatus = earnStatus.value;
      affEarnPage = 1;
      loadAffiliateEarnings();
    };
  }
  if (search) {
    search.value = affQuery;
    search.oninput = () => {
      clearTimeout(affSearchTimer);
      affSearchTimer = setTimeout(() => {
        affQuery = search.value.trim();
        affPage = 1;
        loadAffiliates();
      }, 300);
    };
  }
  loadAffiliates();
}

function affBadge(status) {
  const [label, tone] = AFF_STATUS[status] || [status || "Unknown", "muted"];
  return chBadge(label, tone);
}

function affFollowers(n) {
  return Number(n || 0).toLocaleString("en-KE");
}

// 254712345678 → +254 712 345 678
function affPhone(phone) {
  const p = String(phone || "");
  return p.length === 12 ? `+${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : p;
}

function affPhoneLinks(phone) {
  if (!phone) return "";
  return (
    `<a href="tel:+${escapeHtmlAttr(phone)}">${chText(affPhone(phone))}</a>` +
    ` · <a href="https://wa.me/${escapeHtmlAttr(phone)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
  );
}

function affProfileLink(a) {
  const label = AFF_AT_PLATFORMS.includes(a.platform) ? `@${a.handle}` : a.handle;
  return `<a href="${escapeHtmlAttr(a.profile_url)}" target="_blank" rel="noopener noreferrer">${chText(label)}</a>`;
}

function affCounts(counts) {
  const el = document.getElementById("affCounts");
  if (!el || !counts) return;
  el.innerHTML = ["pending", "approved", "rejected"]
    .map((s) => `${affBadge(s)} <strong>${chText(counts[s] || 0)}</strong>`)
    .join('<span style="padding: 0 10px;"></span>');
}

async function loadAffiliates() {
  if (typeof refreshNavBadges === "function") refreshNavBadges();
  const content = document.getElementById("affContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading applications...</div>';
  try {
    const params = { status: affStatus || "all", page: affPage, limit: AFF_PAGE_SIZE };
    if (affPlatform) params.platform = affPlatform;
    if (affQuery) params.q = affQuery;
    const data = await api.getAffiliateApplications(params);
    affCounts(data.counts);
    if (!data.items.length) {
      content.innerHTML = `<div class="empty-state">${
        affQuery ? "No applications match your search." : affStatus === "pending" ? "No applications waiting for review." : "No applications found."
      }</div>`;
      renderListPagination("affPagination", affPage, 0, AFF_PAGE_SIZE, data.total, "goToAffiliatesPage");
      return;
    }
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Platform</th>
                            <th>Followers</th>
                            <th>Phone</th>
                            <th>Applied</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items
                          .map(
                            (a) => `
                        <tr>
                            <td><strong>${chText(a.full_name)}</strong>${chSmall(chText(a.city))}</td>
                            <td>${chText(AFF_PLATFORM[a.platform] || a.platform)}${chSmall(affProfileLink(a))}</td>
                            <td>${affFollowers(a.followers_count)}</td>
                            <td>${affPhoneLinks(a.phone)}</td>
                            <td>${fmtNairobi(a.created_at)}</td>
                            <td>${affBadge(a.status)}${a.affiliate_code ? chSmall(`Code <strong>${chText(a.affiliate_code)}</strong>`) : ""}</td>
                            <td class="row-actions"><button class="btn btn-primary btn-small" onclick="openAffiliate(${chArg(a.id)})">${a.status === "pending" ? "Review" : "View"}</button></td>
                        </tr>`,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>`;
    renderListPagination("affPagination", affPage, data.items.length, AFF_PAGE_SIZE, data.total, "goToAffiliatesPage");
  } catch (error) {
    console.error("Error loading affiliate applications:", error);
    content.innerHTML = `<div class="empty-state">Couldn't load applications: ${chText(error.message)}</div>`;
  }
}

function goToAffiliatesPage(page) {
  affPage = page;
  loadAffiliates();
}

// ------------------------------------------------------------- Detail ----

async function openAffiliate(id) {
  const modal = document.getElementById("affModal");
  document.getElementById("affModalTitle").textContent = "Affiliate application";
  document.getElementById("affModalBody").innerHTML = '<div class="loading">Loading application...</div>';
  document.getElementById("affModalFooter").innerHTML = "";
  modal.style.display = "flex";
  try {
    affOpen = await api.getAffiliateApplication(id);
    renderAffiliate();
  } catch (error) {
    document.getElementById("affModalBody").innerHTML =
      `<div class="empty-state">Couldn't load the application: ${chText(error.message)}</div>`;
  }
}

function closeAffiliate() {
  document.getElementById("affModal").style.display = "none";
  affOpen = null;
}

function affRow(label, valueHtml) {
  return `<div class="ch-field"><div class="ch-field-label">${label}</div><div class="ch-field-value">${valueHtml || "—"}</div></div>`;
}

function renderAffiliate() {
  const a = affOpen;
  if (!a) return;
  document.getElementById("affModalTitle").textContent = a.full_name;

  const decision =
    a.decided_at
      ? `<div class="detail-note">${a.status === "approved" ? "Approved" : "Rejected"} ${fmtNairobi(a.decided_at)}${
          a.decision_note ? ` · ${chText(a.decision_note)}` : ""
        }</div>`
      : "";

  document.getElementById("affModalBody").innerHTML = `
        <div class="ch-app-status">
            ${affBadge(a.status)}
            <span class="detail-note">Applied ${fmtNairobi(a.created_at)}</span>
        </div>
        ${decision}

        <section class="ch-block">
            <h3>Contact</h3>
            <div class="ch-fields">
                ${affRow("Name", chText(a.full_name))}
                ${affRow("Mobile", affPhoneLinks(a.phone))}
                ${affRow("Email", a.email ? `<a href="mailto:${escapeHtmlAttr(a.email)}">${chText(a.email)}</a>` : "")}
                ${affRow("City", chText(a.city))}
            </div>
        </section>

        <section class="ch-block">
            <h3>Audience</h3>
            <div class="ch-fields">
                ${affRow("Platform", chText(AFF_PLATFORM[a.platform] || a.platform))}
                ${affRow("Profile", affProfileLink(a))}
                ${affRow("Followers (their figure)", affFollowers(a.followers_count))}
                ${affRow("Affiliate code", a.affiliate_code ? `<strong>${chText(a.affiliate_code)}</strong>` : "")}
            </div>
            ${a.about ? `<div class="ch-bio">${chText(a.about)}</div>` : ""}
            <div class="detail-note">Followers are what the applicant typed. Open the profile to check.</div>
        </section>
        ${affEarningsBlock(a)}`;

  const canDecide = affCanDecide();
  let buttons = `<button class="btn btn-secondary" onclick="closeAffiliate()">Close</button>`;
  if (canDecide && a.status === "pending") {
    buttons += `<button class="btn btn-danger" onclick="rejectAffiliate()">Reject</button>`;
  }
  if (canDecide && a.status === "approved") {
    buttons += `<button class="btn btn-danger" onclick="rejectAffiliate()">Deactivate</button>`;
  }
  if (canDecide && a.status !== "approved") {
    buttons += `<button class="btn btn-primary" onclick="approveAffiliate()">Approve</button>`;
  }
  if (affCanPay() && a.earnings && a.earnings.due > 0) {
    buttons += `<button class="btn btn-primary" onclick="payAffiliate()">Mark ${fmtKsh(a.earnings.due)} paid</button>`;
  }
  document.getElementById("affModalFooter").innerHTML = buttons;
}

// ------------------------------------------------------------ Actions ----

async function affAfterAction(id) {
  loadAffiliates();
  try {
    affOpen = await api.getAffiliateApplication(id);
    renderAffiliate();
  } catch (error) {
    closeAffiliate();
  }
}

async function approveAffiliate() {
  const a = affOpen;
  if (!a) return;
  const values = await uiForm({
    title: `Approve ${a.full_name}?`,
    message: a.affiliate_code && /^A/.test(a.affiliate_code)
      ? `They keep their code ${a.affiliate_code} unless you enter a new one.`
      : "They get a promo code to share. Renters get KES 500 off with it; they earn 5% of each completed trip.",
    confirmText: "Approve",
    fields: [
      {
        name: "code",
        label: "Affiliate code",
        placeholder: a.affiliate_code || "Leave blank for one like AKEVIN24",
        maxLength: 20,
        hint: "Starts with A, then letters or numbers (4 to 15 in all), e.g. AKEVIN24.",
      },
      { name: "note", label: "Internal note", type: "textarea", rows: 2, maxLength: 500 },
      {
        name: "notify",
        label: "Email",
        type: "checkboxes",
        value: a.email ? ["yes"] : [],
        options: [{ value: "yes", label: a.email ? `Email their code to ${a.email}` : "No email given" }],
      },
    ],
    validate: (v) =>
      v.code && !/^A[A-Z0-9]{3,14}$/i.test(v.code.replace(/[\s\-_]/g, ""))
        ? "Codes start with A and are 4 to 15 letters or numbers, e.g. AKEVIN24."
        : null,
  });
  if (!values) return;
  try {
    const result = await api.approveAffiliateApplication(a.id, {
      code: values.code || null,
      note: values.note || null,
      notify: values.notify.includes("yes"),
    });
    uiToast(`Approved. Their code is ${result.affiliate_code}.`, "success");
  } catch (error) {
    uiToast(error.message || "Couldn't approve.", error.status === 409 ? "warning" : "error");
  }
  affAfterAction(a.id);
}

async function rejectAffiliate() {
  const a = affOpen;
  if (!a) return;
  const deactivating = a.status === "approved";
  const fields = [{ name: "note", label: "Internal note", type: "textarea", rows: 3, maxLength: 500 }];
  if (!deactivating && a.email) {
    fields.push({
      name: "notify",
      label: "Email",
      type: "checkboxes",
      options: [{ value: "yes", label: `Send ${a.email} a polite "not right now"` }],
    });
  }
  const values = await uiForm({
    title: deactivating ? `Deactivate ${a.full_name}?` : `Reject ${a.full_name}?`,
    message: deactivating
      ? `Their code ${a.affiliate_code} stays reserved to them, so you can approve them again later.`
      : "They can apply again later from the website.",
    confirmText: deactivating ? "Deactivate" : "Reject",
    danger: true,
    fields,
  });
  if (!values) return;
  try {
    await api.rejectAffiliateApplication(a.id, {
      note: values.note || null,
      notify: (values.notify || []).includes("yes"),
    });
    uiToast(deactivating ? "Affiliate deactivated." : "Application rejected.", "success");
  } catch (error) {
    uiToast(error.message || "Couldn't update the application.", error.status === 409 ? "warning" : "error");
  }
  affAfterAction(a.id);
}

// ------------------------------------------------------------ Earnings ----

function affEarningsBlock(a) {
  const e = a.earnings;
  if (!e) return "";
  return `
        <section class="ch-block">
            <h3>Earnings</h3>
            <div class="ch-fields">
                ${affRow("Bookings with their code", chText(e.bookings))}
                ${affRow("Due (trips completed)", fmtKsh(e.due))}
                ${affRow("Trips not finished", fmtKsh(e.pending))}
                ${affRow("Paid out", fmtKsh(e.paid))}
            </div>
            <div class="detail-note">They earn 5% of what the renter paid (deposit excluded). Cancelled bookings earn nothing.</div>
        </section>`;
}

function switchAffiliateTab(tab) {
  document.querySelectorAll("[data-aff-tab]").forEach((b) => b.classList.toggle("active", b.dataset.affTab === tab));
  document.getElementById("affApplicationsView").style.display = tab === "applications" ? "" : "none";
  document.getElementById("affPayoutsView").style.display = tab === "payouts" ? "" : "none";
  if (tab === "payouts") loadAffiliateEarnings();
  else loadAffiliates();
}

async function loadAffiliateEarnings() {
  const content = document.getElementById("affEarnContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading payouts...</div>';
  try {
    const data = await api.getAffiliateEarnings({ status: affEarnStatus, page: affEarnPage, limit: AFF_PAGE_SIZE });
    const totals = document.getElementById("affEarnTotals");
    if (totals) {
      totals.innerHTML = ["due", "pending", "paid"]
        .map((s) => `${affEarnBadge(s)} <strong>${fmtKsh(data.amounts[s] || 0)}</strong>`)
        .join('<span style="padding: 0 10px;"></span>');
    }
    if (!data.items.length) {
      content.innerHTML = `<div class="empty-state">${affEarnStatus === "due" ? "Nothing is due to affiliates right now." : "Nothing here."}</div>`;
      renderListPagination("affEarnPagination", affEarnPage, 0, AFF_PAGE_SIZE, data.total, "goToAffiliateEarningsPage");
      return;
    }
    const canPay = affCanPay();
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Affiliate</th>
                            <th>Booking</th>
                            <th>Renter paid</th>
                            <th>Earning</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items
                          .map(
                            (e) => `
                        <tr>
                            <td><strong>${chText(e.affiliate_name)}</strong>${chSmall(`${chText(e.affiliate_code || "")} · ${affPhoneLinks(e.affiliate_phone)}`)}</td>
                            <td>${chText(e.booking_ref)}${chSmall(chText(e.booking_status))}</td>
                            <td>${fmtKsh(e.basis_amount)}</td>
                            <td><strong>${fmtKsh(e.amount)}</strong></td>
                            <td>${affEarnBadge(e.status)}${e.payout_reference ? chSmall(`Ref ${chText(e.payout_reference)}`) : ""}</td>
                            <td class="row-actions">${
                              canPay && e.status === "due"
                                ? `<button class="btn btn-primary btn-small" onclick="payAffiliateEarning(${chArg(e.id)}, ${chArg(e.amount)}, ${chArg(e.affiliate_name)})">Mark paid</button>`
                                : ""
                            }</td>
                        </tr>`,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>`;
    renderListPagination("affEarnPagination", affEarnPage, data.items.length, AFF_PAGE_SIZE, data.total, "goToAffiliateEarningsPage");
  } catch (error) {
    console.error("Error loading affiliate payouts:", error);
    content.innerHTML = `<div class="empty-state">Couldn't load payouts: ${chText(error.message)}</div>`;
  }
}

function goToAffiliateEarningsPage(page) {
  affEarnPage = page;
  loadAffiliateEarnings();
}

async function affAskReference(title, message) {
  const values = await uiForm({
    title,
    message,
    confirmText: "Mark paid",
    fields: [{ name: "reference", label: "M-Pesa transaction code", required: true, maxLength: 100, placeholder: "e.g. SJK12AB34C" }],
    validate: (v) => (v.reference.length < 3 ? "Enter the M-Pesa transaction code." : null),
  });
  return values ? values.reference : null;
}

async function payAffiliateEarning(id, amount, name) {
  const reference = await affAskReference(
    `Mark ${fmtKsh(amount)} paid to ${name}?`,
    "Send the M-Pesa first. This only records that you paid.",
  );
  if (!reference) return;
  try {
    await api.markAffiliateEarningPaid(id, { reference });
    uiToast("Marked paid.", "success");
  } catch (error) {
    uiToast(error.message || "Couldn't mark it paid.", error.status === 409 ? "warning" : "error");
  }
  loadAffiliateEarnings();
}

async function payAffiliate() {
  const a = affOpen;
  if (!a || !a.earnings) return;
  const reference = await affAskReference(
    `Mark ${fmtKsh(a.earnings.due)} paid to ${a.full_name}?`,
    `Send it to ${affPhone(a.phone)} by M-Pesa first. Every completed trip still owed is marked paid with this code.`,
  );
  if (!reference) return;
  try {
    const result = await api.markAffiliatePaid(a.id, { reference });
    uiToast(`Marked ${result.count} earning${result.count === 1 ? "" : "s"} (${fmtKsh(result.amount)}) paid.`, "success");
  } catch (error) {
    uiToast(error.message || "Couldn't mark it paid.", error.status === 409 ? "warning" : "error");
  }
  affAfterAction(a.id);
}
