// js/pages/b2b-testimonials.js — what businesses wrote about Ardena for Business,
// before it goes on the landing page. Backend: app/admin/testimonials.py.
// Classic script (not a module): top-level functions and vars are global by design.
// Uses the chauffeurs-shared.js helpers (chText, chArg, chBadge, chSmall, fmtNairobi).
//
// Super/general admins and managers moderate (the backend answers 403 to anyone
// else). Only approved testimonials from active, verified workspaces are public,
// and an edit by the business sends one back here as pending.

let tstStatus = "pending";
let tstItems = [];

const TST_STATUS = {
  pending: ["Waiting for review", "warn"],
  approved: ["Live", "ok"],
  rejected: ["Rejected", "danger"],
  withdrawn: ["Withdrawn", "muted"],
};

function initB2BTestimonialsPage() {
  const status = document.getElementById("tstStatusFilter");
  if (status) {
    status.value = tstStatus;
    status.onchange = () => {
      tstStatus = status.value;
      loadB2BTestimonials();
    };
  }
  loadB2BTestimonials();
}

function tstBadge(status) {
  const [label, tone] = TST_STATUS[status] || [status || "Unknown", "muted"];
  return chBadge(label, tone);
}

function tstAvatar(t) {
  if (t.avatar_url) {
    return `<img src="${escapeHtmlAttr(t.avatar_url)}" alt="" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
  }
  const initials = String(t.name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
  return `<span style="display: inline-flex; width: 40px; height: 40px; border-radius: 50%; align-items: center; justify-content: center; background: var(--border); font-weight: 600;">${chText(initials)}</span>`;
}

async function loadB2BTestimonials() {
  if (typeof refreshNavBadges === "function") refreshNavBadges();
  const content = document.getElementById("tstContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading testimonials...</div>';
  try {
    const data = await api.getB2BTestimonials({ status: tstStatus });
    tstItems = data.items || [];
    if (!tstItems.length) {
      content.innerHTML = `<div class="empty-state">${
        tstStatus === "pending" ? "No testimonials waiting for review." : "No testimonials found."
      }</div>`;
      return;
    }
    content.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th></th>
                            <th>Person</th>
                            <th>Testimonial</th>
                            <th>Sent</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tstItems.map(tstRow).join("")}
                    </tbody>
                </table>
            </div>`;
  } catch (error) {
    console.error("Error loading testimonials:", error);
    content.innerHTML = `<div class="empty-state">Couldn't load testimonials: ${chText(error.message)}</div>`;
  }
}

function tstRow(t) {
  const who = [t.title, t.business_name].filter(Boolean).map(chText).join(" · ");
  const extra = [
    t.highlight ? `Highlight <strong>${chText(t.highlight)}</strong>` : "",
    t.sort_weight ? `Weight ${chText(t.sort_weight)}` : "",
    t.rejection_note ? `Note: ${chText(t.rejection_note)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const actions = [];
  if (t.status !== "withdrawn") {
    if (t.status !== "approved") {
      actions.push(`<button class="btn btn-primary btn-small" onclick="approveB2BTestimonial(${chArg(t.id)})">Approve</button>`);
    }
    if (t.status !== "rejected") {
      actions.push(`<button class="btn btn-danger btn-small" onclick="rejectB2BTestimonial(${chArg(t.id)})">Reject</button>`);
    }
    actions.push(`<button class="btn btn-secondary btn-small" onclick="editB2BTestimonial(${chArg(t.id)})">Edit</button>`);
  }
  return `
                        <tr>
                            <td>${tstAvatar(t)}</td>
                            <td><strong>${chText(t.name)}</strong>${chSmall(who)}${chSmall(chText(t.submitted_by_email))}</td>
                            <td style="max-width: 420px; white-space: normal;">“${chText(t.quote)}”${chSmall(extra)}</td>
                            <td>${fmtNairobi(t.updated_at || t.created_at)}</td>
                            <td>${tstBadge(t.status)}</td>
                            <td class="row-actions" style="white-space: nowrap;">${actions.join(" ")}</td>
                        </tr>`;
}

function tstFind(id) {
  return tstItems.find((t) => t.id === id);
}

const TST_HIGHLIGHT_HINT =
  "Optional, up to 32 characters, e.g. \"3 tools replaced\". It's a claim we publish: only one the business can back up.";

async function approveB2BTestimonial(id) {
  const t = tstFind(id);
  if (!t) return;
  const values = await uiForm({
    title: "Approve testimonial",
    message: `“${t.quote}” — ${t.name}, ${t.business_name}`,
    confirmText: "Approve and publish",
    fields: [
      { name: "highlight", label: "Highlight", value: t.highlight || "", maxLength: 32, hint: TST_HIGHLIGHT_HINT },
      { name: "sort_weight", label: "Sort weight", type: "number", step: 1, value: t.sort_weight || 0, hint: "Higher shows first on the landing page." },
    ],
  });
  if (!values) return;
  try {
    await api.approveB2BTestimonial(id, {
      highlight: values.highlight.trim() || null,
      sort_weight: Number(values.sort_weight) || 0,
    });
    uiToast("Approved. It's on the landing page if the workspace is active and verified.", "success");
    loadB2BTestimonials();
  } catch (error) {
    uiToast(`Couldn't approve: ${error.message}`, "error");
  }
}

async function rejectB2BTestimonial(id) {
  const t = tstFind(id);
  if (!t) return;
  const values = await uiForm({
    title: "Reject testimonial",
    message: "The business sees this note and can edit and send it again.",
    confirmText: "Reject",
    danger: true,
    fields: [{ name: "note", label: "Note to the business", type: "textarea", required: true, maxLength: 1000, placeholder: "Please drop the competitor's name." }],
    validate: (v) => (v.note.trim() ? "" : "Write a note for the business."),
  });
  if (!values) return;
  try {
    await api.rejectB2BTestimonial(id, { note: values.note.trim() });
    uiToast("Rejected. The business was emailed.", "success");
    loadB2BTestimonials();
  } catch (error) {
    uiToast(`Couldn't reject: ${error.message}`, "error");
  }
}

async function editB2BTestimonial(id) {
  const t = tstFind(id);
  if (!t) return;
  const values = await uiForm({
    title: "Edit testimonial",
    message: "For typos and the highlight. It stays in its current state, no new review.",
    fields: [
      { name: "name", label: "Name", value: t.name, required: true, maxLength: 80 },
      { name: "title", label: "Role", value: t.title || "", maxLength: 80 },
      { name: "quote", label: "Testimonial", type: "textarea", rows: 4, value: t.quote, required: true, hint: "40 to 320 characters." },
      { name: "highlight", label: "Highlight", value: t.highlight || "", maxLength: 32, hint: TST_HIGHLIGHT_HINT },
      { name: "sort_weight", label: "Sort weight", type: "number", step: 1, value: t.sort_weight || 0 },
    ],
    validate: (v) => {
      const quote = v.quote.trim().replace(/\s+/g, " ");
      if (v.name.trim().length < 2) return "The name needs at least 2 characters.";
      if (quote.length < 40 || quote.length > 320) return `The testimonial must be 40 to 320 characters (it is ${quote.length}).`;
      return "";
    },
  });
  if (!values) return;
  try {
    await api.updateB2BTestimonial(id, {
      name: values.name.trim(),
      title: values.title.trim() || null,
      quote: values.quote.trim(),
      highlight: values.highlight.trim() || null,
      sort_weight: Number(values.sort_weight) || 0,
    });
    uiToast("Saved.", "success");
    loadB2BTestimonials();
  } catch (error) {
    uiToast(`Couldn't save: ${error.message}`, "error");
  }
}
