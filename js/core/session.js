// js/core/session.js — session expiry warning.
//
// The session is a flat 30 minutes from sign-in (SESSION_TIMEOUT_MS in api.js).
// It used to end with no warning: a timer fired, an alert appeared and the page
// redirected, taking any half-finished form with it. This watcher puts a modal
// up shortly before that happens so the admin can choose.
//
// ---------------------------------------------------------------------------
// STOPGAP — needs a backend decision. See SESSION_BACKEND.md.
//
// "Stay signed in" currently calls GET /admin/me to prove the token is still
// good, then extends the *local* expiry stamp. That is a UX fix, not a security
// one: the real access token's own lifetime is unchanged, so once the backend
// starts enforcing expiry server-side this will stop working. The proper fix is
// a refresh endpoint that mints a new token — this file has one place to change
// (`renewSession`) when that lands.
// ---------------------------------------------------------------------------

// How long before expiry the warning appears.
const SESSION_WARNING_MS = 2 * 60 * 1000;

let sessionWarningTimer = null;
let sessionExpiryTimer = null;
let sessionCountdownTimer = null;

function sessionWarningEls() {
  return {
    overlay: document.getElementById("sessionWarningOverlay"),
    countdown: document.getElementById("sessionWarningCountdown"),
    stay: document.getElementById("sessionWarningStay"),
    logout: document.getElementById("sessionWarningLogout"),
  };
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins + ":" + String(secs).padStart(2, "0");
}

function hideSessionWarning() {
  const { overlay } = sessionWarningEls();
  if (overlay) overlay.hidden = true;
  clearInterval(sessionCountdownTimer);
  sessionCountdownTimer = null;
}

function showSessionWarning() {
  const { overlay, countdown, stay } = sessionWarningEls();
  if (!overlay) return;

  overlay.hidden = false;
  if (stay) stay.focus();

  const tick = () => {
    const remaining = getSessionExpiry() - Date.now();
    if (countdown) countdown.textContent = formatCountdown(remaining);
    if (remaining <= 0) {
      clearInterval(sessionCountdownTimer);
      sessionCountdownTimer = null;
    }
  };
  tick();
  clearInterval(sessionCountdownTimer);
  sessionCountdownTimer = setInterval(tick, 1000);
}

// Extend the session. Replace the body of this function with a call to the
// refresh endpoint once it exists.
async function renewSession() {
  // Proves the token still works and that the API is reachable; throws (and is
  // handled by the caller) when it doesn't.
  await api.getCurrentAdmin();
  setSessionExpiry();
  scheduleSessionTimers();
}

// (Re)arm the warning and the hard cut-off against the current expiry stamp.
function scheduleSessionTimers() {
  clearTimeout(sessionWarningTimer);
  clearTimeout(sessionExpiryTimer);
  hideSessionWarning();

  const remaining = getSessionExpiry() - Date.now();
  if (remaining <= 0) {
    logoutAndRedirect("Session expired. Please sign in again.");
    return;
  }

  const untilWarning = remaining - SESSION_WARNING_MS;
  if (untilWarning <= 0) {
    showSessionWarning();
  } else {
    sessionWarningTimer = setTimeout(showSessionWarning, untilWarning);
  }

  sessionExpiryTimer = setTimeout(() => {
    hideSessionWarning();
    logoutAndRedirect("Session expired. Please sign in again.");
  }, remaining);
}

function setupSessionWatcher() {
  const { overlay, stay, logout } = sessionWarningEls();
  if (!overlay) return;

  if (stay) {
    stay.addEventListener("click", async () => {
      const original = stay.textContent;
      stay.disabled = true;
      stay.textContent = "Extending...";
      try {
        await renewSession();
        hideSessionWarning();
        if (typeof uiToast === "function") {
          uiToast("Session extended.", "success");
        }
      } catch (error) {
        // The token is already gone or the API is unreachable — signing out is
        // the honest outcome rather than pretending the session is alive.
        logoutAndRedirect("Could not extend the session. Please sign in again.");
      } finally {
        stay.disabled = false;
        stay.textContent = original;
      }
    });
  }

  if (logout) {
    logout.addEventListener("click", () => {
      hideSessionWarning();
      clearSessionStorage();
      window.location.href = "/";
    });
  }

  // A tab left in the background gets its timers throttled, so re-check the
  // real clock whenever the admin comes back to it.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleSessionTimers();
  });

  scheduleSessionTimers();
}
