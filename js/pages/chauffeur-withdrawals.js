// js/pages/chauffeur-withdrawals.js — chauffeur payouts (chauffer.md §6).
// Classic script (not a module): top-level functions and vars are global by design.
//
// Drivers ask to withdraw in the app; finance sends the M-Pesa by hand and
// records the result here. The queue is oldest first, so the longest wait is
// on top. Marking a payout failed puts the money back on the driver's balance.

let chPayoutStatus = "processing";
let chPayoutRows = {};

const CH_PAYOUT_STATUS = {
  processing: ["Waiting", "warn"],
  paid: ["Paid", "ok"],
  failed: ["Failed", "danger"],
};

function initChauffeurWithdrawalsPage() {
  const filter = document.getElementById("chPayoutStatusFilter");
  if (filter) {
    filter.value = chPayoutStatus;
    filter.onchange = () => {
      chPayoutStatus = filter.value;
      loadChauffeurWithdrawals();
    };
  }
  loadChauffeurWithdrawals();
}

async function loadChauffeurWithdrawals() {
  chauffeurRefreshBadges();
  const content = document.getElementById("chPayoutContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading withdrawals...</div>';
  try {
    // Always send status: without it the server returns the queue, so "All"
    // is an explicit `status=`.
    const rows = await api.getChauffeurPayouts({ status: chPayoutStatus });
    chPayoutRows = {};
    rows.forEach((p) => (chPayoutRows[p.id] = p));
    if (!rows.length) {
      content.innerHTML = `<div class="empty-state">${chPayoutStatus === "processing" ? "No drivers waiting for their money." : "No withdrawals found."}</div>`;
      return;
    }
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Requested</th>
                            <th>Driver</th>
                            <th>Amount</th>
                            <th>M-Pesa number</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows.map(chPayoutRowHtml).join("")}</tbody>
                </table>
            </div>`;
  } catch (error) {
    console.error("Error loading chauffeur payouts:", error);
    content.innerHTML = `<div class="empty-state">Couldn't load withdrawals: ${chText(error.message)}</div>`;
  }
}

function chPayoutRowHtml(p) {
  const [label, tone] = CH_PAYOUT_STATUS[p.status] || [p.status || "Unknown", "muted"];
  const result = [
    p.processed_at ? fmtNairobi(p.processed_at) : "",
    p.mpesa_receipt_number ? "Receipt " + chText(p.mpesa_receipt_number) : "",
    p.note ? chText(p.note) : "",
  ].filter(Boolean).join(" · ");
  const actions =
    p.status === "processing"
      ? `<button class="btn btn-primary btn-small" onclick="markChauffeurPayoutPaid(${chArg(p.id)})">Mark paid</button>
         <button class="btn btn-secondary btn-small" onclick="markChauffeurPayoutFailed(${chArg(p.id)})">Mark failed</button>`
      : "";
  return `
        <tr>
            <td class="ch-nowrap">${fmtNairobi(p.created_at)}${chSmall(`<code class="ch-code">${chText(p.id)}</code>`)}</td>
            <td>${chText(p.chauffeur) || "—"}${chSmall(chText(p.chauffeur_id))}</td>
            <td><strong>${fmtKsh(p.amount)}</strong></td>
            <td class="ch-nowrap">${p.phone
              ? `${chText(p.phone)} <button type="button" class="ch-copy" onclick="copyToClipboard(${chArg(p.phone)})" title="Copy number" aria-label="Copy number">Copy</button>`
              : "—"}</td>
            <td>${chBadge(label, tone)}${chSmall(result)}</td>
            <td class="row-actions">${actions}</td>
        </tr>`;
}

function chPayoutSummary(id) {
  const p = chPayoutRows[id];
  return p ? `${fmtKsh(p.amount)} to ${p.chauffeur || p.chauffeur_id} on ${p.phone || "no number"}` : id;
}

async function markChauffeurPayoutPaid(id) {
  const values = await uiForm({
    title: "Mark paid",
    message: `Record that you sent ${chPayoutSummary(id)}.`,
    confirmText: "Mark paid",
    fields: [
      {
        name: "receipt",
        label: "M-Pesa receipt number",
        required: true,
        maxLength: 64,
        placeholder: "e.g. QX12AB34CD",
      },
      { name: "note", label: "Note", type: "textarea", maxLength: 1000, hint: "Optional." },
    ],
  });
  if (!values) return;
  await updateChauffeurPayout(id, {
    status: "paid",
    mpesa_receipt_number: values.receipt.toUpperCase(),
    note: values.note || null,
  }, "Marked paid. The driver has been told.");
}

async function markChauffeurPayoutFailed(id) {
  const values = await uiForm({
    title: "Mark failed",
    message: `The money for ${chPayoutSummary(id)} goes straight back to the driver's balance.`,
    confirmText: "Mark failed",
    danger: true,
    fields: [
      {
        name: "note",
        label: "What went wrong",
        type: "textarea",
        required: true,
        maxLength: 1000,
        placeholder: "e.g. Number not registered",
      },
    ],
  });
  if (!values) return;
  await updateChauffeurPayout(id, { status: "failed", note: values.note }, "Marked failed. The money is back on the driver's balance.");
}

async function updateChauffeurPayout(id, body, done) {
  try {
    await api.updateChauffeurPayout(id, body);
    uiToast(done, "success");
  } catch (error) {
    chauffeurActionFailed(error);
  }
  loadChauffeurWithdrawals();
}
