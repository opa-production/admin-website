// js/pages/driving-licences.js — renters' driving licences to verify. A verified,
// in-date licence lets a renter skip the licence upload when they apply to
// drive (backend: app/admin/driving_licences.py, CHAUFFEURS_LOCATION_LICENCE_UI.md §4).
// Classic script (not a module): top-level functions and vars are global by design.
// Uses the chauffeurs-shared.js helpers (chText, chArg, chBadge, chSmall, chPagination).

let dlStatus = "unverified";
let dlPage = 1;
let dlRows = [];

function initDrivingLicencesPage() {
  const status = document.getElementById("dlStatusFilter");
  if (status) {
    status.value = dlStatus;
    status.onchange = () => {
      dlStatus = status.value;
      dlPage = 1;
      loadDrivingLicences();
    };
  }
  loadDrivingLicences();
}

function dlBadge(row) {
  if (row.expired) return chBadge("Expired", "danger");
  return row.verified ? chBadge("Verified", "ok") : chBadge("Not verified", "warn");
}

function dlDate(iso) {
  return iso ? fmtNairobi(`${iso}T12:00:00+03:00`, false) : "—";
}

async function loadDrivingLicences() {
  if (typeof refreshNavBadges === "function") refreshNavBadges();
  const content = document.getElementById("dlContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading licences...</div>';
  try {
    const rows = await api.getDrivingLicences({
      status: dlStatus,
      skip: (dlPage - 1) * CHAUFFEUR_PAGE_SIZE,
      limit: CHAUFFEUR_PAGE_SIZE,
    });
    dlRows = Array.isArray(rows) ? rows : [];
    if (!dlRows.length) {
      content.innerHTML = `<div class="empty-state">${
        dlStatus === "unverified" ? "No licences waiting to be verified." : "No licences found."
      }</div>`;
      chPagination("dlPagination", dlPage, 0, "goToDrivingLicencesPage");
      return;
    }
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Renter</th>
                            <th>Licence</th>
                            <th>Valid</th>
                            <th>Photo</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dlRows.map(dlRow).join("")}
                    </tbody>
                </table>
            </div>`;
    chPagination("dlPagination", dlPage, dlRows.length, "goToDrivingLicencesPage");
  } catch (error) {
    console.error("Error loading driving licences:", error);
    content.innerHTML = `<div class="empty-state">Couldn't load licences: ${chText(error.message)}</div>`;
  }
}

function dlRow(r) {
  // The photo link is signed for 15 minutes: reload the list for a fresh one.
  const photo = r.document_url
    ? `<a href="${escapeHtmlAttr(r.document_url)}" target="_blank" rel="noopener noreferrer">Open photo</a>${chSmall("Link works for 15 min")}`
    : `<span style="color: #666;">None uploaded</span>${chSmall("Ask the renter for one")}`;
  let action = "";
  if (r.on_file && !r.expired) {
    action = r.verified
      ? `<button class="btn btn-secondary btn-small" onclick="unverifyDrivingLicence(${chArg(r.client_id)})">Remove verification</button>`
      : `<button class="btn btn-primary btn-small" onclick="verifyDrivingLicence(${chArg(r.client_id)})">Verify</button>`;
  }
  return `
                        <tr>
                            <td><strong>${chText(r.client_name)}</strong>${chSmall(chText(r.client_email))}</td>
                            <td>${chText(r.licence_number) || "—"}${chSmall(r.category ? `Class ${chText(r.category)}` : "")}</td>
                            <td>${dlDate(r.issue_date)} → ${dlDate(r.expiry_date)}</td>
                            <td>${photo}</td>
                            <td>${dlBadge(r)}${chSmall(chText(r.verification_notes))}</td>
                            <td class="row-actions" style="white-space: nowrap;">${action}</td>
                        </tr>`;
}

function goToDrivingLicencesPage(page) {
  dlPage = page;
  loadDrivingLicences();
}

async function dlSet(clientId, isVerified, notes) {
  try {
    await api.setDrivingLicenceVerification(clientId, { is_verified: isVerified, notes: notes || null });
    uiToast(isVerified ? "Licence verified." : "Verification removed.", "success");
    loadDrivingLicences();
  } catch (error) {
    uiToast(`Couldn't save: ${error.message}`, "error");
  }
}

async function verifyDrivingLicence(clientId) {
  const r = dlRows.find((x) => String(x.client_id) === String(clientId));
  const values = await uiForm({
    title: "Verify licence",
    message: r
      ? `${r.client_name} · ${r.licence_number || "no number"}${r.document_url ? "" : " · no photo uploaded"}`
      : "",
    confirmText: "Verify",
    fields: [{ name: "notes", label: "Note", placeholder: "Matches the photo; number checked", maxLength: 500 }],
  });
  if (values) dlSet(clientId, true, values.notes.trim());
}

async function unverifyDrivingLicence(clientId) {
  const values = await uiForm({
    title: "Remove verification",
    message: "The renter will be asked for their licence again when they apply to drive.",
    confirmText: "Remove verification",
    danger: true,
    fields: [{ name: "notes", label: "Why", type: "textarea", required: true, maxLength: 500 }],
    validate: (v) => (v.notes.trim() ? "" : "Say why the verification is removed."),
  });
  if (values) dlSet(clientId, false, values.notes.trim());
}
