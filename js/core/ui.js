// js/core/ui.js — custom toasts + confirm/alert dialogs that replace the native
// browser popups. Classic script: all functions are global by design.
//
// - uiToast(msg, type)          → transient corner notification
// - uiConfirm(msg, opts)        → Promise<boolean> modal (OK/Cancel)
// - uiAlert(msg, opts)          → Promise<void> modal (OK)
// - window.alert is overridden  → routes every legacy alert() to a custom toast
//   (type inferred from the message), so existing code gets the new look for free.

// ---------------------------------------------------------------- Toasts ----
function ensureToastContainer() {
  let c = document.getElementById("uiToastContainer");
  if (!c) {
    c = document.createElement("div");
    c.id = "uiToastContainer";
    c.className = "ui-toast-container";
    document.body.appendChild(c);
  }
  return c;
}

function uiToastIcon(type) {
  const icons = {
    success: '<polyline points="20 6 9 17 4 12"></polyline>',
    error:
      '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    warning:
      '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
  };
  return (
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    (icons[type] || icons.info) +
    "</svg>"
  );
}

function uiToast(message, type = "info", opts = {}) {
  const container = ensureToastContainer();
  const el = document.createElement("div");
  el.className = "ui-toast ui-toast-" + type;
  el.setAttribute("role", "status");
  el.innerHTML =
    `<span class="ui-toast-icon">${uiToastIcon(type)}</span>` +
    `<span class="ui-toast-msg"></span>` +
    `<button class="ui-toast-close" aria-label="Dismiss">&times;</button>`;
  el.querySelector(".ui-toast-msg").textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  };
  el.querySelector(".ui-toast-close").addEventListener("click", remove);
  const duration =
    opts.duration != null ? opts.duration : type === "error" ? 6000 : 3500;
  if (duration) setTimeout(remove, duration);
  return el;
}

// ------------------------------------------------------- Confirm / Alert ----
function uiConfirm(message, opts = {}) {
  return uiDialog(message, { ...opts, isConfirm: true });
}

function uiAlert(message, opts = {}) {
  return uiDialog(message, { ...opts, isConfirm: false });
}

// Custom replacement for native prompt(): resolves to the entered string on OK
// (may be ""), or null if cancelled — same contract as window.prompt.
function uiPrompt(message, opts = {}) {
  const multiline = !!opts.multiline;
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ui-dialog-overlay";
    overlay.innerHTML =
      '<div class="ui-dialog" role="dialog" aria-modal="true">' +
      (opts.title ? '<h3 class="ui-dialog-title"></h3>' : "") +
      '<div class="ui-dialog-message"></div>' +
      (multiline
        ? '<textarea class="ui-dialog-input" rows="3"></textarea>'
        : '<input type="text" class="ui-dialog-input">') +
      '<div class="ui-dialog-actions">' +
      '<button type="button" class="btn btn-secondary ui-dialog-cancel"></button>' +
      '<button type="button" class="btn btn-primary ui-dialog-ok"></button>' +
      "</div></div>";

    if (opts.title) overlay.querySelector(".ui-dialog-title").textContent = opts.title;
    overlay.querySelector(".ui-dialog-message").textContent = message;
    const input = overlay.querySelector(".ui-dialog-input");
    if (opts.placeholder) input.placeholder = opts.placeholder;
    if (opts.defaultValue) input.value = opts.defaultValue;
    const okBtn = overlay.querySelector(".ui-dialog-ok");
    okBtn.textContent = opts.confirmText || "OK";
    overlay.querySelector(".ui-dialog-cancel").textContent = opts.cancelText || "Cancel";

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));

    let done = false;
    const onKey = (e) => {
      if (e.key === "Escape") close(null);
      else if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        close(input.value);
      }
    };
    const close = (val) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 150);
      resolve(val);
    };
    okBtn.addEventListener("click", () => close(input.value));
    overlay.querySelector(".ui-dialog-cancel").addEventListener("click", () => close(null));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(null);
    });
    document.addEventListener("keydown", onKey);
    setTimeout(() => input.focus(), 50);
  });
}

function uiDialog(message, opts) {
  const isConfirm = !!opts.isConfirm;
  // Default to a "danger" (red) primary button for destructive prompts.
  const danger =
    opts.danger != null
      ? opts.danger
      : /\bdelete\b|cannot be undone|permanently|remove/i.test(message || "");

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ui-dialog-overlay";
    overlay.innerHTML =
      '<div class="ui-dialog" role="dialog" aria-modal="true">' +
      (opts.title ? '<h3 class="ui-dialog-title"></h3>' : "") +
      '<div class="ui-dialog-message"></div>' +
      '<div class="ui-dialog-actions">' +
      (isConfirm ? '<button type="button" class="btn btn-secondary ui-dialog-cancel"></button>' : "") +
      `<button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"} ui-dialog-ok"></button>` +
      "</div></div>";

    if (opts.title) overlay.querySelector(".ui-dialog-title").textContent = opts.title;
    overlay.querySelector(".ui-dialog-message").textContent = message;
    const okBtn = overlay.querySelector(".ui-dialog-ok");
    okBtn.textContent = opts.confirmText || (isConfirm ? "Confirm" : "OK");
    const cancelBtn = overlay.querySelector(".ui-dialog-cancel");
    if (cancelBtn) cancelBtn.textContent = opts.cancelText || "Cancel";

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));

    let done = false;
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    };
    const close = (val) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 150);
      resolve(val);
    };

    okBtn.addEventListener("click", () => close(true));
    if (cancelBtn) cancelBtn.addEventListener("click", () => close(false));
    overlay.addEventListener("click", (e) => {
      // Clicking the dim backdrop cancels (confirm) / dismisses (alert).
      if (e.target === overlay) close(isConfirm ? false : true);
    });
    document.addEventListener("keydown", onKey);
    setTimeout(() => okBtn.focus(), 50);
  });
}

// ------------------------------------------- Override native alert popup ----
function inferToastType(text) {
  const t = (text || "").toLowerCase();
  if (/error|fail|failed|could not|couldn't|unable|invalid|denied|wrong|not allowed/.test(t))
    return "error";
  if (/success|successfully|updated|sent|saved|created|deleted|approved|removed|cleared|confirmed|reversed|activated|deactivated/.test(t))
    return "success";
  return "info";
}

// Route every legacy alert() through the custom toast.
window.alert = function (message) {
  const text = String(message == null ? "" : message);
  uiToast(text, inferToastType(text));
};
