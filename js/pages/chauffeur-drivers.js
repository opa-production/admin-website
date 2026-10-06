// js/pages/chauffeur-drivers.js — approved chauffeurs (chauffer.md §4).
// Classic script (not a module): top-level functions and vars are global by design.
//
// Suspending takes a driver out of search and offline at once; trips they had
// already accepted stay, so the confirm dialog points the admin at Hires.

let chDriverStatus = "";
let chDriverPage = 1;
let chDriverRows = {};

const CH_DRIVER_STATUS = {
  active: ["Active", "ok"],
  suspended: ["Suspended", "danger"],
  deleted: ["Former driver", "muted"],
};

function initChauffeurDriversPage() {
  const filter = document.getElementById("chDriverStatusFilter");
  if (filter) {
    filter.value = chDriverStatus;
    filter.onchange = () => {
      chDriverStatus = filter.value;
      chDriverPage = 1;
      loadChauffeurDrivers();
    };
  }
  loadChauffeurDrivers();
}

async function loadChauffeurDrivers() {
  chauffeurRefreshBadges();
  const content = document.getElementById("chDriverContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading drivers...</div>';
  try {
    const rows = await api.getChauffeurs({
      status: chDriverStatus,
      skip: (chDriverPage - 1) * CHAUFFEUR_PAGE_SIZE,
      limit: CHAUFFEUR_PAGE_SIZE,
    });
    chDriverRows = {};
    rows.forEach((d) => (chDriverRows[d.id] = d));
    if (!rows.length) {
      content.innerHTML = '<div class="empty-state">No drivers found.</div>';
      chPagination("chDriverPagination", chDriverPage, 0, "goToChauffeurDriversPage");
      return;
    }
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th></th>
                            <th>Name</th>
                            <th>Base town</th>
                            <th>Rating</th>
                            <th>Trips</th>
                            <th>Online</th>
                            <th>Status</th>
                            <th>Phone</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows.map(chDriverRowHtml).join("")}</tbody>
                </table>
            </div>`;
    chPagination("chDriverPagination", chDriverPage, rows.length, "goToChauffeurDriversPage");
  } catch (error) {
    console.error("Error loading chauffeurs:", error);
    content.innerHTML = `<div class="empty-state">Couldn't load drivers: ${chText(error.message)}</div>`;
  }
}

function chDriverRowHtml(d) {
  const [label, tone] = CH_DRIVER_STATUS[d.status] || [d.status || "Unknown", "muted"];
  const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || d.display_name || d.id;

  // A driver who deleted their account: no contact details, no actions.
  if (d.status === "deleted") {
    return `
        <tr class="ch-row-muted">
            <td><div class="ch-avatar ch-avatar--empty">?</div></td>
            <td>Former driver${chSmall(chText(d.id))}</td>
            <td>${chText(d.base_town) || "—"}</td>
            <td>${d.rating != null ? chText(d.rating) : "New"}</td>
            <td>${chText(d.trips_count || 0)}</td>
            <td>—</td>
            <td>${chBadge(label, tone)}</td>
            <td>—</td>
            <td></td>
        </tr>`;
  }

  const photo = d.photo_url
    ? `<img class="ch-avatar" src="${escapeHtmlAttr(d.photo_url)}" alt="">`
    : `<div class="ch-avatar ch-avatar--empty">${chText(getInitials(name))}</div>`;
  const rating =
    d.rating != null
      ? `★ ${chText(Number(d.rating).toFixed(1))}${chSmall(`${chText(d.reviews_count || 0)} reviews`)}`
      : "New";
  const action =
    d.status === "active"
      ? `<button class="btn btn-danger btn-small" onclick="suspendChauffeur(${chArg(d.id)})">Suspend</button>`
      : d.status === "suspended"
        ? `<button class="btn btn-primary btn-small" onclick="reinstateChauffeur(${chArg(d.id)})">Reinstate</button>`
        : "";
  return `
        <tr>
            <td>${photo}</td>
            <td><strong>${chText(name)}</strong>${chSmall(chText(d.id))}</td>
            <td>${chText(d.base_town) || "—"}${d.nationwide ? chSmall("Nationwide") : ""}</td>
            <td>${rating}</td>
            <td>${chText(d.trips_count || 0)}</td>
            <td>${d.online ? uiStatusDot("Online", "ok") : uiStatusDot("Offline", "muted")}</td>
            <td>${chBadge(label, tone)}</td>
            <td>${d.phone ? `<a href="tel:${escapeHtmlAttr(d.phone)}">${chText(d.phone)}</a>` : "—"}</td>
            <td class="row-actions">${action}</td>
        </tr>`;
}

function goToChauffeurDriversPage(page) {
  chDriverPage = page;
  loadChauffeurDrivers();
}

function chDriverName(id) {
  const d = chDriverRows[id];
  return (d && (d.display_name || [d.first_name, d.last_name].filter(Boolean).join(" "))) || id;
}

async function suspendChauffeur(id) {
  const values = await uiForm({
    title: `Suspend ${chDriverName(id)}?`,
    message:
      "They leave search and go offline at once, and can't accept or start trips. They can still see their earnings and withdraw. Trips they already accepted stay: check the Hires page for this driver.",
    confirmText: "Suspend",
    danger: true,
    fields: [
      {
        name: "note",
        label: "Note",
        type: "textarea",
        maxLength: 1000,
        placeholder: "e.g. Two no-shows this week",
        hint: "Optional. Kept in the server log, not shown to the driver.",
      },
    ],
  });
  if (!values) return;
  await setChauffeurStatus(id, "suspended", values.note, "Driver suspended.");
}

async function reinstateChauffeur(id) {
  const values = await uiForm({
    title: `Reinstate ${chDriverName(id)}?`,
    message: "They can be found in search and take trips again once they go online.",
    confirmText: "Reinstate",
    fields: [
      { name: "note", label: "Note", type: "textarea", maxLength: 1000, hint: "Optional. Kept in the server log." },
    ],
  });
  if (!values) return;
  await setChauffeurStatus(id, "active", values.note, "Driver reinstated.");
}

async function setChauffeurStatus(id, status, note, done) {
  try {
    await api.updateChauffeurStatus(id, { status, ...(note ? { note } : {}) });
    uiToast(done, "success");
  } catch (error) {
    chauffeurActionFailed(error);
  }
  loadChauffeurDrivers();
}
