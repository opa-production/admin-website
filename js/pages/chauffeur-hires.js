// js/pages/chauffeur-hires.js — chauffeur hires (chauffer.md §5).
// Classic script (not a module): top-level functions and vars are global by design.
//
// Two tabs: every hire (filterable by status), and "Needs attention", the
// accepted or in-progress trips 6+ hours past their end that nobody closed.
// An admin can cancel an open hire, refunding the renter or not.

let chHireTab = "all"; // "all" | "stuck"
let chHireStatus = "";
let chHirePage = 1;
let chHireRows = {};

const CH_HIRE_STATUS = {
  pending: ["Pending", "muted"],
  accepted: ["Accepted", "info"],
  in_progress: ["In progress", "warn"],
  completed: ["Completed", "ok"],
  declined: ["Declined", "danger"],
  cancelled: ["Cancelled", "danger"],
};

const CH_PAYMENT_STATUS = {
  unpaid: ["Unpaid", "muted"],
  paid: ["Paid", "ok"],
  refunded: ["Refunded", "info"],
  cash_due: ["Cash due", "warn"],
  cash_collected: ["Cash collected", "ok"],
};

const CH_CANCELLED_BY = {
  renter: "by the renter",
  expired: "no answer from the driver",
  car_cancelled: "car booking cancelled",
  replaced: "replaced",
  admin: "by an admin",
};

function initChauffeurHiresPage() {
  const filter = document.getElementById("chHireStatusFilter");
  if (filter) {
    filter.value = chHireStatus;
    filter.onchange = () => {
      chHireStatus = filter.value;
      chHirePage = 1;
      loadChauffeurHires();
    };
  }
  switchChauffeurHireTab(chHireTab);
}

function switchChauffeurHireTab(tab) {
  chHireTab = tab;
  chHirePage = 1;
  document.querySelectorAll("[data-ch-hire-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-ch-hire-tab") === tab);
  });
  // "Needs attention" is its own filter; a status on top of it would only confuse.
  // (The wrapper, not the select: the select is swapped for a custom widget.)
  const filterWrap = document.getElementById("chHireStatusFilterWrap");
  if (filterWrap) filterWrap.style.display = tab === "stuck" ? "none" : "";
  loadChauffeurHires();
}

async function loadChauffeurHires() {
  chauffeurRefreshBadges();
  const content = document.getElementById("chHireContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading hires...</div>';
  try {
    const params = {
      skip: (chHirePage - 1) * CHAUFFEUR_PAGE_SIZE,
      limit: CHAUFFEUR_PAGE_SIZE,
    };
    if (chHireTab === "stuck") params.stuck = "true";
    else params.status = chHireStatus;
    const rows = await api.getChauffeurBookings(params);
    chHireRows = {};
    rows.forEach((b) => (chHireRows[b.id] = b));
    if (!rows.length) {
      content.innerHTML = `<div class="empty-state">${chHireTab === "stuck" ? "No stuck trips. Every trip past its end has been closed." : "No hires found."}</div>`;
      chPagination("chHirePagination", chHirePage, 0, "goToChauffeurHiresPage");
      return;
    }
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Hire</th>
                            <th>Renter</th>
                            <th>Driver</th>
                            <th>When</th>
                            <th>Pickup</th>
                            <th>Fare</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th>Refund</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows.map(chHireRowHtml).join("")}</tbody>
                </table>
            </div>`;
    chPagination("chHirePagination", chHirePage, rows.length, "goToChauffeurHiresPage");
  } catch (error) {
    console.error("Error loading chauffeur hires:", error);
    content.innerHTML = `<div class="empty-state">Couldn't load hires: ${chText(error.message)}</div>`;
  }
}

function chHireDuration(b) {
  if (b.mode === "hours" && b.hours != null) return `${b.hours} hour${Number(b.hours) === 1 ? "" : "s"}`;
  if (b.mode === "days" && b.days != null) return `${b.days} day${Number(b.days) === 1 ? "" : "s"}`;
  return b.mode || "";
}

function chHireRowHtml(b) {
  const [statusLabel, statusTone] = CH_HIRE_STATUS[b.status] || [b.status || "Unknown", "muted"];
  const [payLabel, payTone] = CH_PAYMENT_STATUS[b.payment_status] || [b.payment_status || "—", "muted"];
  const cancelledBy =
    b.status === "cancelled" && b.cancelled_by ? chSmall(chText(CH_CANCELLED_BY[b.cancelled_by] || b.cancelled_by)) : "";
  const canCancel = ["pending", "accepted", "in_progress"].includes(b.status);
  return `
        <tr>
            <td><code class="ch-code">${chText(b.id)}</code></td>
            <td>${chText(b.client_name) || "—"}${b.client_phone ? chSmall(`<a href="tel:${escapeHtmlAttr(b.client_phone)}">${chText(b.client_phone)}</a>`) : ""}</td>
            <td>${chText(b.chauffeur && b.chauffeur.display_name) || "—"}</td>
            <td class="ch-nowrap">${fmtNairobi(b.start)}<br>→ ${fmtNairobi(b.end)}${chSmall(chText(chHireDuration(b)))}</td>
            <td><div class="ch-clamp">${chText(b.pickup_location) || "—"}</div></td>
            <td><strong>${fmtKsh(b.total)}</strong></td>
            <td>${b.payment_method === "cash" ? "Cash" : "Pay now"}${chSmall(chBadge(payLabel, payTone))}</td>
            <td>${chBadge(statusLabel, statusTone)}${cancelledBy}</td>
            <td>${Number(b.refund_amount) > 0 ? fmtKsh(b.refund_amount) : "—"}</td>
            <td class="row-actions">${canCancel ? `<button class="btn btn-danger btn-small" onclick="cancelChauffeurHire(${chArg(b.id)})">Cancel</button>` : ""}</td>
        </tr>`;
}

function goToChauffeurHiresPage(page) {
  chHirePage = page;
  loadChauffeurHires();
}

// What the renter paid in the app, i.e. what a refund would send back. Cash
// hires and unpaid ones have nothing to refund.
function chHirePaidInApp(b) {
  if (b.amount_paid != null) return Number(b.amount_paid) || 0;
  return b.payment_method === "pay_now" && b.payment_status === "paid" ? Number(b.total) || 0 : 0;
}

async function cancelChauffeurHire(id) {
  const b = chHireRows[id];
  if (!b) return;
  const paid = chHirePaidInApp(b);
  const values = await uiForm({
    title: `Cancel hire ${id}?`,
    message:
      "For a no-show, a dispute, or a trip nobody closed. The renter and the driver both get a notification.",
    confirmText: "Cancel hire",
    cancelText: "Keep it",
    danger: true,
    fields: [
      {
        name: "reason",
        label: "Reason",
        type: "textarea",
        required: true,
        maxLength: 200,
        placeholder: "e.g. Driver no-show, renter called support",
        hint: "3 to 200 characters. Stored on the hire.",
      },
      {
        name: "refund",
        label: "Refund",
        type: "checkboxes",
        value: ["refund"],
        options: [
          {
            value: "refund",
            label: paid > 0
              ? `Refund ${fmtKsh(paid)} to the renter`
              : "Refund the renter (nothing has been paid in the app)",
          },
        ],
        hint: "Untick when the trip happened and the driver just forgot to end it. A refund appears on the Refunds page for finance.",
      },
    ],
    validate: (v) => (v.reason.length < 3 ? "The reason needs at least 3 characters." : null),
  });
  if (!values) return;
  try {
    await api.cancelChauffeurBooking(id, {
      reason: values.reason,
      refund: values.refund.includes("refund"),
    });
    uiToast("Hire cancelled.", "success");
  } catch (error) {
    chauffeurActionFailed(error);
  }
  loadChauffeurHires();
}
