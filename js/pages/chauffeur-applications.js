// js/pages/chauffeur-applications.js — people applying to drive (chauffer.md §3).
// Classic script (not a module): top-level functions and vars are global by design.
//
// An admin opens an application, checks the person, their documents and their
// work details, then approves it or sends it back with a reason the applicant
// reads word for word. Licence, ID and good-conduct photos are signed links
// that expire after 15 minutes: they are only ever held in memory for the open
// application, and a thumbnail that fails to load re-fetches the detail once.

let chAppStatus = "pending";
let chAppPage = 1;
let chAppOpen = null; // the application shown in the modal
let chAppRefetched = false; // one fresh-link retry per opened application

const CH_APP_STATUS = {
  pending: ["Pending", "warn"],
  approved: ["Approved", "ok"],
  rejected: ["Sent back", "danger"],
};

const CH_SERVICE_TYPE = {
  driver_only: "Driver only",
  car_and_driver: "Brings own car",
};

// What the applicant must change; each box sends every field it lists.
const CH_FIX_FIELDS = [
  ["Profile photo", ["photo"]],
  ["Driving licence photo", ["licence_photo"]],
  ["Licence number", ["licence_number"]],
  ["ID photo", ["id_photo"]],
  ["Certificate of good conduct", ["good_conduct_photo"]],
  ["Name / phone", ["first_name", "last_name", "phone"]],
  ["Experience, languages, bio", ["years_experience", "languages", "bio"]],
  ["Where they drive", ["base_town", "areas_served", "nationwide"]],
  ["Cars they drive", ["car_types", "transmissions", "service_type"]],
  ["Working days and hours", ["days", "start", "end"]],
  ["Rates", ["price_per_day", "price_per_hour"]],
  ["References", ["references"]],
];

function initChauffeurApplicationsPage() {
  const filter = document.getElementById("chAppStatusFilter");
  if (filter) {
    filter.value = chAppStatus;
    filter.onchange = () => {
      chAppStatus = filter.value;
      chAppPage = 1;
      loadChauffeurApplications();
    };
  }
  loadChauffeurApplications();
}

function chAppBadge(status) {
  const [label, tone] = CH_APP_STATUS[status] || [status || "Unknown", "muted"];
  return chBadge(label, tone);
}

async function loadChauffeurApplications() {
  chauffeurRefreshBadges();
  const content = document.getElementById("chAppContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading applications...</div>';
  try {
    const rows = await api.getChauffeurApplications({
      status: chAppStatus,
      skip: (chAppPage - 1) * CHAUFFEUR_PAGE_SIZE,
      limit: CHAUFFEUR_PAGE_SIZE,
    });
    if (!rows.length) {
      content.innerHTML = `<div class="empty-state">${chAppStatus === "pending" ? "No applications waiting for review." : "No applications found."}</div>`;
      chPagination("chAppPagination", chAppPage, 0, "goToChauffeurApplicationsPage");
      return;
    }
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Base town</th>
                            <th>Submitted</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows
                          .map(
                            (a) => `
                        <tr>
                            <td><strong>${chText(a.name) || "—"}</strong></td>
                            <td>${chText(a.client_email) || "—"}</td>
                            <td>${chText(a.base_town) || "—"}</td>
                            <td>${fmtNairobi(a.submitted_at)}</td>
                            <td>${chAppBadge(a.status)}${a.reviewed_at ? chSmall("Reviewed " + fmtNairobi(a.reviewed_at, false)) : ""}</td>
                            <td class="row-actions"><button class="btn btn-primary btn-small" onclick="openChauffeurApplication(${chArg(a.id)})">Review</button></td>
                        </tr>`,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>`;
    chPagination("chAppPagination", chAppPage, rows.length, "goToChauffeurApplicationsPage");
  } catch (error) {
    console.error("Error loading chauffeur applications:", error);
    content.innerHTML = `<div class="empty-state">Couldn't load applications: ${chText(error.message)}</div>`;
  }
}

function goToChauffeurApplicationsPage(page) {
  chAppPage = page;
  loadChauffeurApplications();
}

// ------------------------------------------------------------- Detail ----

async function openChauffeurApplication(id) {
  const modal = document.getElementById("chAppModal");
  const body = document.getElementById("chAppModalBody");
  const footer = document.getElementById("chAppModalFooter");
  document.getElementById("chAppModalTitle").textContent = "Application";
  body.innerHTML = '<div class="loading">Loading application...</div>';
  footer.innerHTML = "";
  modal.style.display = "flex";
  chAppRefetched = false;
  try {
    chAppOpen = await api.getChauffeurApplication(id);
    renderChauffeurApplication();
  } catch (error) {
    body.innerHTML = `<div class="empty-state">Couldn't load the application: ${chText(error.message)}</div>`;
  }
}

function closeChauffeurApplication() {
  document.getElementById("chAppModal").style.display = "none";
  // Drop the signed document links with the view.
  chAppOpen = null;
  document.getElementById("chAppModalBody").innerHTML = "";
}

function chAppRow(label, valueHtml) {
  return `<div class="ch-field"><div class="ch-field-label">${label}</div><div class="ch-field-value">${valueHtml || "—"}</div></div>`;
}

function chAppList(items) {
  return Array.isArray(items) && items.length ? items.map(chText).join(", ") : "";
}

// A document thumbnail that opens full size in a new tab. A failed load means
// the signed link most likely expired, so ask for fresh links.
function chAppDoc(label, doc) {
  if (!doc || !doc.url) {
    return `<div class="ch-doc ch-doc--missing"><div class="ch-doc-empty">Not provided</div><div class="ch-doc-label">${label}</div></div>`;
  }
  const url = escapeHtmlAttr(doc.url);
  return `
        <a class="ch-doc" href="${url}" target="_blank" rel="noopener noreferrer" title="Open full size">
            <img src="${url}" alt="${escapeHtmlAttr(label)}" referrerpolicy="no-referrer" onerror="chauffeurDocFailed(this)">
            <div class="ch-doc-label">${label}</div>
        </a>`;
}

async function chauffeurDocFailed(img) {
  img.onerror = null;
  if (!chAppOpen) return;
  if (chAppRefetched) {
    img.replaceWith(Object.assign(document.createElement("div"), {
      className: "ch-doc-empty",
      textContent: "Couldn't load",
    }));
    return;
  }
  chAppRefetched = true;
  try {
    chAppOpen = await api.getChauffeurApplication(chAppOpen.id);
    renderChauffeurApplication();
  } catch (error) {
    uiToast(`Couldn't refresh the document links: ${error.message}`, "error");
  }
}

function renderChauffeurApplication() {
  const a = chAppOpen;
  if (!a) return;
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || a.client_name || "Applicant";
  document.getElementById("chAppModalTitle").textContent = name;

  const photo = a.photo && a.photo.url
    ? `<a href="${escapeHtmlAttr(a.photo.url)}" target="_blank" rel="noopener noreferrer"><img class="ch-avatar ch-avatar--lg" src="${escapeHtmlAttr(a.photo.url)}" alt=""></a>`
    : `<div class="ch-avatar ch-avatar--lg ch-avatar--empty">${chText(getInitials(name))}</div>`;

  const phoneLink = (phone) =>
    phone ? `<a href="tel:${escapeHtmlAttr(phone)}">${chText(phone)}</a>` : "";

  const references = (a.references || []).length
    ? `<ul class="ch-refs">${a.references
        .map((r) => `<li><strong>${chText(r.name) || "—"}</strong> · ${phoneLink(r.phone) || "no phone"}</li>`)
        .join("")}</ul>`
    : '<div class="detail-note">No references given.</div>';

  const reviewNote =
    a.status === "rejected" && a.reason
      ? `<div class="ch-callout ch-callout--danger"><strong>Sent back:</strong> ${chText(a.reason)}${
          (a.fix_fields || []).length ? `<div class="detail-note">To fix: ${chText(a.fix_fields.join(", "))}</div>` : ""
        }</div>`
      : "";

  document.getElementById("chAppModalBody").innerHTML = `
        <div class="ch-app-status">
            ${chAppBadge(a.status)}
            <span class="detail-note">Submitted ${fmtNairobi(a.submitted_at)}${a.reviewed_at ? " · reviewed " + fmtNairobi(a.reviewed_at) : ""}</span>
        </div>
        ${reviewNote}

        <section class="ch-block">
            <h3>Person</h3>
            <div class="ch-person">
                ${photo}
                <div class="ch-fields">
                    ${chAppRow("Name", chText(name))}
                    ${chAppRow("Phone", phoneLink(a.phone))}
                    ${chAppRow("Email", a.client_email ? `<a href="mailto:${escapeHtmlAttr(a.client_email)}">${chText(a.client_email)}</a>` : "")}
                    ${chAppRow("Experience", a.years_experience != null ? `${chText(a.years_experience)} year${a.years_experience === 1 ? "" : "s"}` : "")}
                    ${chAppRow("Languages", chAppList(a.languages))}
                </div>
            </div>
            ${a.bio ? `<div class="ch-bio">${chText(a.bio)}</div>` : ""}
        </section>

        <section class="ch-block">
            <h3>Licence and ID</h3>
            <div class="ch-fields">
                ${chAppRow("Licence number", chText(a.licence_number))}
                ${chAppRow("Background check", a.background_verified ? chBadge("Verified", "ok") : chBadge("Not verified", "muted"))}
            </div>
            <div class="ch-docs">
                ${chAppDoc("Driving licence", a.licence_photo)}
                ${chAppDoc("ID", a.id_photo)}
                ${chAppDoc("Certificate of good conduct", a.good_conduct_photo)}
            </div>
            <div class="detail-note">Document links expire after 15 minutes. Reopen the application for fresh ones.</div>
        </section>

        <section class="ch-block">
            <h3>Work</h3>
            <div class="ch-fields">
                ${chAppRow("Base town", chText(a.base_town))}
                ${chAppRow("Areas served", a.nationwide ? "Nationwide" : chAppList(a.areas_served))}
                ${chAppRow("Car types", chAppList(a.car_types))}
                ${chAppRow("Transmissions", chAppList(a.transmissions))}
                ${chAppRow("Service", chText(CH_SERVICE_TYPE[a.service_type] || a.service_type))}
                ${chAppRow("Days", chAppList(a.days))}
                ${chAppRow("Hours", a.start && a.end ? `${chText(a.start)} – ${chText(a.end)}` : "")}
                ${chAppRow("Daily rate", a.price_per_day != null ? fmtKsh(a.price_per_day) : "")}
                ${chAppRow("Hourly rate", a.price_per_hour != null ? fmtKsh(a.price_per_hour) : "")}
            </div>
        </section>

        <section class="ch-block">
            <h3>References</h3>
            ${references}
        </section>`;

  const footer = document.getElementById("chAppModalFooter");
  const canApprove = a.status === "pending" || a.status === "rejected";
  footer.innerHTML =
    `<button class="btn btn-secondary" onclick="closeChauffeurApplication()">Close</button>` +
    (a.status === "pending"
      ? `<button class="btn btn-danger" onclick="sendBackChauffeurApplication()">Send back</button>`
      : "") +
    (canApprove
      ? `<button class="btn btn-primary" onclick="approveChauffeurApplication()">Approve</button>`
      : "");
}

// ------------------------------------------------------------ Actions ----

// After an action: show the new state (or reload on a 409) and refresh the
// list and badges behind the modal.
async function chAppAfterAction(id) {
  loadChauffeurApplications();
  try {
    chAppOpen = await api.getChauffeurApplication(id);
    chAppRefetched = false;
    renderChauffeurApplication();
  } catch (error) {
    closeChauffeurApplication();
  }
}

async function approveChauffeurApplication() {
  const a = chAppOpen;
  if (!a) return;
  const hasCertificate = !!(a.good_conduct_photo && a.good_conduct_photo.url);
  const values = await uiForm({
    title: "Approve this driver?",
    message:
      "This creates their public driver profile (offline, unrated, no trips) and tells them they can switch to Chauffeur Mode.",
    confirmText: "Approve",
    fields: hasCertificate
      ? [
          {
            name: "checks",
            label: "Background",
            type: "checkboxes",
            options: [{ value: "background", label: "Certificate of good conduct checked?" }],
          },
        ]
      : [],
  });
  if (!values) return;
  try {
    const result = await api.approveChauffeurApplication(a.id, {
      background_verified: hasCertificate && (values.checks || []).includes("background"),
    });
    uiToast(`Approved${result && result.chauffeur_id ? ` as ${result.chauffeur_id}` : ""}.`, "success");
  } catch (error) {
    uiToast(error.message || "Couldn't approve.", error.status === 409 ? "warning" : "error");
  }
  chAppAfterAction(a.id);
}

async function sendBackChauffeurApplication() {
  const a = chAppOpen;
  if (!a) return;
  const values = await uiForm({
    title: "Send back for fixes",
    confirmText: "Send back",
    danger: true,
    fields: [
      {
        name: "reason",
        label: "Reason",
        type: "textarea",
        rows: 4,
        required: true,
        maxLength: 1000,
        placeholder: "e.g. Your driving licence photo is blurry and the number can't be read.",
        hint: "The applicant reads this word for word. 5 to 1,000 characters.",
      },
      {
        name: "fix",
        label: "What they need to change",
        type: "checkboxes",
        options: CH_FIX_FIELDS.map(([label], i) => ({ value: String(i), label })),
      },
    ],
    validate: (v) =>
      v.reason.length < 5 ? "The reason needs at least 5 characters." : null,
  });
  if (!values) return;
  const fixFields = values.fix.flatMap((i) => CH_FIX_FIELDS[Number(i)][1]);
  try {
    await api.rejectChauffeurApplication(a.id, { reason: values.reason, fix_fields: fixFields });
    uiToast("Sent back to the applicant.", "success");
  } catch (error) {
    uiToast(error.message || "Couldn't send it back.", error.status === 409 ? "warning" : "error");
  }
  chAppAfterAction(a.id);
}
