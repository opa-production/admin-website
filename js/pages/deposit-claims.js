// js/pages/deposit-claims.js — hosts asking to keep part of a renter's deposit.
// Classic script (not a module): top-level functions and vars are global by design.
//
// A host files a claim against a booking's security deposit (damage, fuel,
// late return). An admin decides it here:
//   approved  the full requested amount goes to the host
//   partial   an amount between 0 and the request goes to the host
//   rejected  the whole deposit goes back to the renter
// The decision moves money and cannot be changed afterwards, so the claim's
// description and evidence open in the row before the decision form does.

let depositClaimPage = 1;
let depositClaimStatus = "pending";
let depositClaimRows = {};
let depositClaimOpenId = null;
const DEPOSIT_CLAIM_PAGE_SIZE = 20;

const DEPOSIT_CLAIM_STATUS = {
  pending: { label: "Pending", cls: "pending" },
  approved: { label: "Approved", cls: "active" },
  partial: { label: "Partly approved", cls: "active" },
  rejected: { label: "Rejected", cls: "inactive" },
};

function initDepositClaimsPage() {
  const filter = document.getElementById("depositClaimStatusFilter");
  if (filter) {
    filter.value = depositClaimStatus;
    filter.onchange = () => {
      depositClaimStatus = filter.value;
      depositClaimPage = 1;
      loadDepositClaims();
    };
  }
  loadDepositClaims();
}

function depositClaimBadge(status) {
  const meta = DEPOSIT_CLAIM_STATUS[status] || { label: status || "Unknown", cls: "" };
  return `<span class="status-badge ${meta.cls}">${escapeHtml(meta.label)}</span>`;
}

function depositClaimType(type) {
  return escapeHtml(String(type || "other").replace(/_/g, " "));
}

async function loadDepositClaims() {
  const content = document.getElementById("depositClaimsContent");
  if (!content) return;
  try {
    content.innerHTML = '<div class="loading">Loading deposit claims...</div>';
    const params = { page: depositClaimPage, limit: DEPOSIT_CLAIM_PAGE_SIZE };
    if (depositClaimStatus) params.status = depositClaimStatus;
    const data = await api.getDepositClaims(params);
    const rows = data.claims || [];

    depositClaimRows = {};
    rows.forEach((c) => {
      depositClaimRows[c.id] = c;
    });

    if (!rows.length) {
      content.innerHTML = `<div class="empty-state">${depositClaimStatus === "pending" ? "No claims waiting for a decision." : "No deposit claims found."}</div>`;
      document.getElementById("depositClaimsPagination").innerHTML = "";
      return;
    }

    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Claim</th>
                            <th>Booking</th>
                            <th>Host</th>
                            <th>Reason</th>
                            <th>Requested</th>
                            <th>Status</th>
                            <th>Filed</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(depositClaimRowHtml).join("")}
                    </tbody>
                </table>
            </div>`;
    renderListPagination(
      "depositClaimsPagination",
      data.page || depositClaimPage,
      rows.length,
      data.limit || DEPOSIT_CLAIM_PAGE_SIZE,
      data.total,
      "goToDepositClaimPage",
    );
  } catch (error) {
    console.error("Error loading deposit claims:", error);
    content.innerHTML = `<div class="empty-state">Error loading deposit claims: ${escapeHtml(error.message)}</div>`;
  }
}

function depositClaimRowHtml(c) {
  const open = depositClaimOpenId === c.id;
  const decided =
    c.status === "pending"
      ? ""
      : `<div class="detail-note">${c.approved_amount != null ? "Host gets " + fmtKes(c.approved_amount) : ""}${c.reviewed_at ? " · decided " + fmtDate(c.reviewed_at) : ""}</div>`;
  return `
        <tr>
            <td>#${c.id}</td>
            <td>${escapeHtml(c.booking_code || "#" + c.booking_id)}</td>
            <td>#${c.host_id}</td>
            <td>${depositClaimType(c.claim_type)}</td>
            <td><strong>${fmtKes(c.requested_amount)}</strong></td>
            <td>${depositClaimBadge(c.status)}${decided}</td>
            <td>${fmtDate(c.created_at)}</td>
            <td>
                <button class="btn btn-secondary btn-small" onclick="toggleDepositClaim(${c.id})">${open ? "Hide" : "View"}</button>
                ${c.status === "pending" ? `<button class="btn btn-primary btn-small" onclick="decideDepositClaim(${c.id})">Decide</button>` : ""}
            </td>
        </tr>
        ${open ? depositClaimDetailHtml(c) : ""}`;
}

function depositClaimDetailHtml(c) {
  const evidence = (c.evidence_urls || []).filter(Boolean);
  const links = evidence.length
    ? evidence
        .map(
          (url, i) =>
            `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">Evidence ${i + 1}</a>`,
        )
        .join(" · ")
    : "No evidence attached.";
  return `
        <tr>
            <td colspan="8" style="background: var(--surface-2, transparent);">
                <div style="white-space: pre-wrap; margin-bottom: 8px;">${escapeHtml(c.description || "No description given.")}</div>
                <div class="detail-note">${links}</div>
                ${c.admin_note ? `<div class="detail-note">Admin note: ${escapeHtml(c.admin_note)}</div>` : ""}
            </td>
        </tr>`;
}

function toggleDepositClaim(id) {
  depositClaimOpenId = depositClaimOpenId === id ? null : id;
  loadDepositClaims();
}

function goToDepositClaimPage(page) {
  depositClaimPage = page;
  loadDepositClaims();
}

async function decideDepositClaim(id) {
  let claim = depositClaimRows[id];
  try {
    // Re-read it: another admin may have decided it since the list loaded.
    claim = await api.getDepositClaim(id);
  } catch (error) {
    uiToast(`Couldn't load the claim: ${error.message}`, "error");
    return;
  }
  if (claim.status !== "pending") {
    uiToast("That claim has already been decided.", "warning");
    loadDepositClaims();
    return;
  }

  const requested = Number(claim.requested_amount) || 0;
  const values = await uiForm({
    title: `Decide claim #${claim.id}`,
    message: `The host is asking for ${fmtKes(requested)} from the deposit on booking ${claim.booking_code || "#" + claim.booking_id}. This moves money and can't be changed afterwards.`,
    confirmText: "Record decision",
    fields: [
      {
        name: "decision",
        label: "Decision",
        type: "select",
        value: "approved",
        options: [
          { value: "approved", label: `Approve in full (${fmtKes(requested)} to the host)` },
          { value: "partial", label: "Approve part of it" },
          { value: "rejected", label: "Reject (deposit goes back to the renter)" },
        ],
      },
      {
        name: "amount",
        label: "Amount for the host (KES)",
        type: "number",
        min: 0,
        step: "any",
        placeholder: "Only for a part approval",
        hint: `More than 0 and less than ${fmtKes(requested)}.`,
      },
      {
        name: "note",
        label: "Note",
        type: "textarea",
        placeholder: "Why, for the record and for the host and renter",
        maxLength: 1000,
      },
    ],
    validate: (v) => {
      if (v.decision !== "partial") return null;
      const amount = Number(v.amount);
      if (!v.amount || !(amount > 0) || !(amount < requested)) {
        return `A part approval needs an amount above 0 and below ${fmtKes(requested)}.`;
      }
      return null;
    },
  });
  if (!values) return;

  const body = { decision: values.decision, admin_note: values.note || null };
  if (values.decision === "approved") body.approved_amount = requested;
  if (values.decision === "partial") body.approved_amount = Number(values.amount);

  try {
    await api.reviewDepositClaim(id, body);
    uiToast("Decision recorded.", "success");
    depositClaimOpenId = null;
    loadDepositClaims();
  } catch (error) {
    uiToast(`Couldn't record the decision: ${error.message}`, "error");
  }
}
