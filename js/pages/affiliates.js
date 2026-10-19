// js/pages/affiliates.js — marketers who applied on ardena.co.ke/affiliate.
// Classic script (not a module): top-level functions and vars are global by design.
// Uses the chauffeurs-shared.js helpers (chText, chArg, chBadge, chSmall, fmtNairobi).
//
// Every admin can look. Super/general admins and managers approve (which gives
// the marketer an affiliate code) or reject; rejecting an approved affiliate
// deactivates them and their code stays reserved to them.

const AFF_PAGE_SIZE = 50;
const AFF_DECIDE_ROLES = ["super_admin", "general_admin", "manager"];

let affStatus = "pending";
let affPlatform = "";
let affQuery = "";
let affPage = 1;
let affOpen = null; // the application shown in the modal
let affSearchTimer = null;

const AFF_STATUS = {
  pending: ["Pending", "warn"],
  approved: ["Approved", "ok"],
  rejected: ["Rejected", "danger"],
};

const AFF_PLATFORM = { x: "X", tiktok: "TikTok", instagram: "Instagram" };

function affCanDecide() {
  return AFF_DECIDE_ROLES.includes(window.currentAdminRole || (currentAdminInfo() || {}).role);
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
  return `<a href="${escapeHtmlAttr(a.profile_url)}" target="_blank" rel="noopener noreferrer">@${chText(a.handle)}</a>`;
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
        </section>`;

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
    message: a.affiliate_code
      ? `They keep their code ${a.affiliate_code} unless you enter a new one.`
      : "They get an affiliate code to share with their followers.",
    confirmText: "Approve",
    fields: [
      {
        name: "code",
        label: "Affiliate code",
        placeholder: a.affiliate_code || "Leave blank to make one from their handle",
        maxLength: 15,
        hint: "4 to 15 letters or numbers, e.g. KEVO10.",
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
      v.code && !/^[A-Za-z0-9]{4,15}$/.test(v.code) ? "Codes are 4 to 15 letters or numbers, no spaces." : null,
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
