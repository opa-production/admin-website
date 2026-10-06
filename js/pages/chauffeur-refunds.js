// js/pages/chauffeur-refunds.js — refunds owed to chauffeur renters (chauffer.md §7).
// Classic script (not a module): top-level functions and vars are global by design.
//
// Refunds are created by the backend (declines, cancellations, duplicate or
// late payments, admin cancellations). Finance pays the renter back on the
// rail they paid with and records the result here.

let chRefundStatus = "pending";
let chRefundRows = {};

const CH_REFUND_STATUS = {
  pending: ["Pending", "warn"],
  completed: ["Refunded", "ok"],
  failed: ["Failed", "danger"],
  cancelled: ["Cancelled", "muted"],
};

const CH_PAID_WITH = {
  mpesa: ["M-Pesa", ""],
  card: ["Card", "Paystack"],
  ardena_pay: ["Ardena Pay", "Stellar: contact the renter for an address"],
};

function initChauffeurRefundsPage() {
  const filter = document.getElementById("chRefundStatusFilter");
  if (filter) {
    filter.value = chRefundStatus;
    filter.onchange = () => {
      chRefundStatus = filter.value;
      loadChauffeurRefunds();
    };
  }
  loadChauffeurRefunds();
}

async function loadChauffeurRefunds() {
  chauffeurRefreshBadges();
  const content = document.getElementById("chRefundContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading refunds...</div>';
  try {
    const rows = await api.getChauffeurRefunds({ status: chRefundStatus });
    chRefundRows = {};
    rows.forEach((r) => (chRefundRows[r.id] = r));
    if (!rows.length) {
      content.innerHTML = `<div class="empty-state">${chRefundStatus === "pending" ? "No renters waiting for a refund." : "No refunds found."}</div>`;
      return;
    }
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Created</th>
                            <th>Hire</th>
                            <th>Renter</th>
                            <th>Amount</th>
                            <th>Paid with</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows.map(chRefundRowHtml).join("")}</tbody>
                </table>
            </div>`;
  } catch (error) {
    console.error("Error loading chauffeur refunds:", error);
    content.innerHTML = `<div class="empty-state">Couldn't load refunds: ${chText(error.message)}</div>`;
  }
}

function chRefundRowHtml(r) {
  const [label, tone] = CH_REFUND_STATUS[r.status] || [r.status || "Unknown", "muted"];
  const [rail, railNote] = CH_PAID_WITH[r.paid_with] || [r.paid_with || "—", ""];
  const renter =
    r.client_email || r.client_phone
      ? `${chText(r.client_email) || "—"}${r.client_phone ? chSmall(`<a href="tel:${escapeHtmlAttr(r.client_phone)}">${chText(r.client_phone)}</a>`) : ""}`
      : '<span class="detail-note">Account deleted</span>';
  const result = [
    r.processed_at ? fmtNairobi(r.processed_at) : "",
    r.external_reference ? "Ref " + chText(r.external_reference) : "",
    r.note ? chText(r.note) : "",
  ].filter(Boolean).join(" · ");
  const actions =
    r.status === "pending"
      ? `<button class="btn btn-primary btn-small" onclick="markChauffeurRefund(${chArg(r.id)}, 'completed')">Mark refunded</button>
         <button class="btn btn-secondary btn-small" onclick="markChauffeurRefund(${chArg(r.id)}, 'failed')">Failed</button>
         <button class="btn btn-secondary btn-small" onclick="markChauffeurRefund(${chArg(r.id)}, 'cancelled')">Cancel</button>`
      : "";
  return `
        <tr>
            <td class="ch-nowrap">${fmtNairobi(r.created_at)}</td>
            <td><code class="ch-code">${chText(r.booking_id) || "—"}</code></td>
            <td>${renter}</td>
            <td><strong>${fmtKsh(r.amount)}</strong></td>
            <td>${chText(rail)}${chSmall(chText(railNote))}</td>
            <td><div class="ch-clamp">${chText(r.reason) || "—"}</div></td>
            <td>${chBadge(label, tone)}${chSmall(result)}</td>
            <td class="row-actions">${actions}</td>
        </tr>`;
}

const CH_REFUND_ACTIONS = {
  completed: {
    title: "Mark refunded",
    confirmText: "Mark refunded",
    message: (r, rail) => `Record that you sent ${fmtKsh(r.amount)} back to the renter by ${rail}.`,
    noteRequired: false,
    done: "Marked refunded.",
  },
  failed: {
    title: "Refund failed",
    confirmText: "Mark failed",
    message: (r) => `The ${fmtKsh(r.amount)} refund was tried and didn't go through.`,
    noteRequired: true,
    done: "Marked failed.",
  },
  cancelled: {
    title: "Cancel refund",
    confirmText: "Cancel refund",
    message: (r) => `Close this ${fmtKsh(r.amount)} refund without paying it (e.g. it was settled another way).`,
    noteRequired: true,
    done: "Refund cancelled.",
  },
};

async function markChauffeurRefund(id, status) {
  const r = chRefundRows[id];
  const action = CH_REFUND_ACTIONS[status];
  if (!r || !action) return;
  const rail = (CH_PAID_WITH[r.paid_with] || [r.paid_with || "the original method"])[0];
  const values = await uiForm({
    title: action.title,
    message: action.message(r, rail),
    confirmText: action.confirmText,
    cancelText: "Back",
    danger: status === "cancelled",
    fields: [
      {
        name: "reference",
        label: "Reference",
        maxLength: 255,
        placeholder: "M-Pesa, Paystack or Stellar reference",
        hint: status === "completed" ? "The reference from the payment you sent." : "Optional.",
      },
      {
        name: "note",
        label: "Note",
        type: "textarea",
        required: action.noteRequired,
        maxLength: 1000,
        hint: action.noteRequired ? "Why, for the record." : "Optional.",
      },
    ],
  });
  if (!values) return;
  try {
    await api.updateChauffeurRefund(id, {
      status,
      external_reference: values.reference || null,
      note: values.note || null,
    });
    uiToast(action.done, "success");
  } catch (error) {
    chauffeurActionFailed(error);
  }
  loadChauffeurRefunds();
}
