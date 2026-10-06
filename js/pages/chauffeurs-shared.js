// js/pages/chauffeurs-shared.js — helpers shared by the five Chauffeurs pages
// (applications, drivers, hires, withdrawals, refunds). See chauffer.md.
// Classic script (not a module): top-level functions and vars are global by design.

const CHAUFFEUR_PAGE_SIZE = 50;

// Money arrives as whole Kenyan shillings: "KSh 7,500".
function fmtKsh(value) {
  const n = Number(value);
  return "KSh " + (isFinite(n) ? Math.round(n) : 0).toLocaleString("en-KE");
}

// The API speaks Nairobi time; show it as Nairobi time whatever the admin's
// own clock says.
function fmtNairobi(value, withTime = true) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

// Escape for text, keeping 0 (escapeHtml drops falsy values).
function chText(value) {
  return value == null || value === "" ? "" : escapeHtml(String(value));
}

// An id as a quoted JS string inside an onclick="…" attribute.
function chArg(value) {
  return escapeHtmlAttr(JSON.stringify(String(value)));
}

// "label" in the badge colour named by tone: ok | warn | danger | info | muted.
function chBadge(label, tone) {
  return `<span class="status-badge ch-tone-${tone || "muted"}">${chText(label)}</span>`;
}

function chSmall(html) {
  return html ? `<div class="detail-note">${html}</div>` : "";
}

// Skip/limit paging: the list endpoints return a bare array with no total, so
// Next is offered while a page comes back full.
function chPagination(containerId, page, returned, goFn) {
  renderListPagination(containerId, page, returned, CHAUFFEUR_PAGE_SIZE, null, goFn);
}

// A failed action: show the server's sentence as it is. A 409 means someone
// else got there first, so the caller's list is reloaded to show what changed.
function chauffeurActionFailed(error, reload) {
  uiToast(error.message || "Something went wrong.", error.status === 409 ? "warning" : "error");
  if (error.status === 409 && reload) reload();
}

// Every action reloads its list; the list loaders refresh the badges too.
function chauffeurRefreshBadges() {
  if (typeof refreshNavBadges === "function") refreshNavBadges();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    uiToast(`Copied ${text}`, "success", { duration: 1800 });
  } catch (e) {
    uiToast("Couldn't copy. Select the number and copy it by hand.", "warning");
  }
}
