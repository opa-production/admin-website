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
      `<button type="button" class="btn ${opts.danger ? "btn-danger" : "btn-primary"} ui-dialog-ok"></button>` +
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

// ------------------------------------------------- Custom select (listbox) ----
// Replaces a native <select> with a styled listbox. The markup is:
//
//   <div class="ui-select"><button class="ui-select-trigger">…</button>
//     <ul class="ui-select-menu" role="listbox">
//       <li class="ui-select-option" data-value="x">Label</li> …</ul></div>
//
// The chosen value is mirrored into `hiddenInput` so callers can keep reading
// a plain `.value`, exactly as they did with the <select> it replaced.
function initCustomSelect(root, hiddenInput, onChange) {
  if (!root || root.dataset.wired === "true") return;
  root.dataset.wired = "true";

  const trigger = root.querySelector(".ui-select-trigger");
  const valueEl = root.querySelector(".ui-select-value");
  const menu = root.querySelector(".ui-select-menu");
  const options = Array.from(root.querySelectorAll(".ui-select-option"));
  if (!trigger || !menu || options.length === 0) return;

  const isOpen = () => !menu.hidden;

  const open = () => {
    menu.hidden = false;
    root.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    const active = options.find((o) => o.getAttribute("aria-selected") === "true");
    (active || options[0]).focus();
  };

  const close = (refocus) => {
    menu.hidden = true;
    root.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    if (refocus) trigger.focus();
  };

  const select = (option) => {
    options.forEach((o) => o.setAttribute("aria-selected", String(o === option)));
    if (valueEl) valueEl.textContent = option.textContent.trim();
    if (hiddenInput) hiddenInput.value = option.dataset.value || "";
    close(true);
    if (typeof onChange === "function") onChange(option.dataset.value || "");
  };

  trigger.addEventListener("click", () => (isOpen() ? close(false) : open()));

  options.forEach((option) => {
    option.tabIndex = -1;
    option.addEventListener("click", () => select(option));
  });

  // Roving focus through the options; Enter/Space commits, Escape backs out.
  menu.addEventListener("keydown", (e) => {
    const current = options.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = (current + step + options.length) % options.length;
      options[next].focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (current >= 0) select(options[current]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });

  document.addEventListener("click", (e) => {
    if (isOpen() && !root.contains(e.target)) close(false);
  });
}

// ------------------------------------------------------------ ScaleLoader ----
// Every `<div class="loading">…</div>` in the app renders as a ScaleLoader:
// five bars scaling in a staggered wave. Rather than edit ~50 call sites (and
// every future one), the markup is upgraded in place — the same approach as the
// alert() override above, so existing code gets the new look for free.
const SCALE_LOADER_BARS = 5;

function upgradeLoadingElement(el) {
  if (!el || el.dataset.loaderReady === "true") return;
  el.dataset.loaderReady = "true";

  // Keep whatever message the caller wrote ("Loading hosts...") as a caption.
  const message = el.textContent.trim();
  el.textContent = "";

  const bars = document.createElement("span");
  bars.className = "scale-loader";
  bars.setAttribute("aria-hidden", "true");
  for (let i = 0; i < SCALE_LOADER_BARS; i++) {
    bars.appendChild(document.createElement("span"));
  }
  el.appendChild(bars);

  if (message) {
    const label = document.createElement("span");
    label.className = "loading-text";
    label.textContent = message;
    el.appendChild(label);
  }
  el.setAttribute("role", "status");
}

function upgradeLoadingWithin(node) {
  if (!node || node.nodeType !== 1) return;
  if (node.classList.contains("loading")) upgradeLoadingElement(node);
  node.querySelectorAll(".loading").forEach(upgradeLoadingElement);
}

// Page scripts drop `.loading` blocks in via innerHTML long after load, so watch
// for them rather than upgrading only what exists at startup.
function watchLoadingElements() {
  upgradeLoadingWithin(document.body);
  new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach(upgradeLoadingWithin));
  }).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", watchLoadingElements);
} else {
  watchLoadingElements();
}

// ------------------------------------------------------------- Row icons ----
// Feather-style glyphs for table row actions. Icons keep several actions on one
// line where labelled buttons would wrap and stretch the row.
const UI_ICON_PATHS = {
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M9 3.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.63a4 4 0 0 1 0 7.75"/>',
  deactivate:
    '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  activate:
    '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  trash:
    '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M6 6v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  eye:
    '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a18.5 18.5 0 0 1-3 3.6"/><path d="M6.6 6.6A18.6 18.6 0 0 0 2 12s3.6 6 10 6a9.8 9.8 0 0 0 4.2-.9"/><path d="m3 3 18 18"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
};

// `action` picks the glyph; `label` becomes both the hover title and the
// accessible name, so an icon-only button still says what it does.
function uiIconButton(action, label, onclick, variant) {
  const path = UI_ICON_PATHS[action];
  if (!path) return "";
  const cls = "icon-btn" + (variant ? ` icon-btn--${variant}` : "");
  const safeLabel = escapeHtmlAttr(label);
  return (
    `<button type="button" class="${cls}" onclick="${onclick}" title="${safeLabel}" aria-label="${safeLabel}">` +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    path +
    "</svg></button>"
  );
}

// A bare coloured dot whose meaning shows on hover, for statuses that would
// otherwise need a caption in every row.
function uiStatusDot(label, tone) {
  return `<span class="status-dot status-dot--${tone || "warn"}" title="${escapeHtmlAttr(label)}" role="img" aria-label="${escapeHtmlAttr(label)}"></span>`;
}
