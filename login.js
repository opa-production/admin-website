// API_BASE_URL and the session helpers come from api.js, loaded before this.

// If the dashboard bounced us back here, say why rather than dropping the
// admin on a blank form wondering what happened.
(function showLogoutReason() {
  const reason =
    typeof takeLogoutReason === "function" ? takeLogoutReason() : null;
  if (!reason) return;
  const el = document.getElementById("errorMessage");
  if (el) {
    el.textContent = reason;
    el.classList.add("show");
  }
})();

// Password visibility toggle
document.getElementById("passwordToggle").addEventListener("click", () => {
  const passwordInput = document.getElementById("password");
  const toggleBtn = document.getElementById("passwordToggle");
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    toggleBtn.textContent = "Hide";
    toggleBtn.setAttribute("aria-label", "Hide password");
  } else {
    passwordInput.type = "password";
    toggleBtn.textContent = "Show";
    toggleBtn.setAttribute("aria-label", "Show password");
  }
});

// ---------------------------------------------------------------------------
// Sign-in is two steps: password, then a one-time code.
//
// DESIGN-PREVIEW MODE: the OTP endpoints don't exist yet, so `OTP_STUBBED`
// short-circuits verification and any 6 digits are accepted. Flip it to false
// once the backend ships /admin/auth/verify-otp and /admin/auth/resend-otp
// (see OTP_BACKEND.md) — the request code below is already wired up.
// ---------------------------------------------------------------------------
const OTP_STUBBED = true;
const OTP_LENGTH = 6;
const OTP_RESEND_SECONDS = 30;

// Carried between the two steps.
let pendingLogin = null;
let resendTimer = null;

const otpOverlay = document.getElementById("otpOverlay");
const otpForm = document.getElementById("otpForm");
const otpInputsWrap = document.getElementById("otpInputs");
const otpInputs = Array.from(otpInputsWrap.querySelectorAll("input"));
const otpError = document.getElementById("otpError");
const otpVerifyButton = document.getElementById("otpVerifyButton");
const otpResendButton = document.getElementById("otpResend");

// Mask each destination so a shoulder-surfer can't read the full number/address.
function maskDestination(value) {
  if (!value) return "";
  if (value.includes("@")) {
    const parts = value.split("@");
    const name = parts[0];
    const shown = name.slice(0, 2);
    return shown + "•".repeat(Math.max(name.length - 2, 3)) + "@" + parts[1];
  }
  return "•".repeat(Math.max(value.length - 3, 3)) + value.slice(-3);
}

// The code goes to every destination on file — mobile *and* email — so the
// modal lists them all: "•••••345 and ce•••@ardena.co.ke".
function describeDestinations(destinations) {
  const masked = destinations.filter(Boolean).map(maskDestination);
  if (!masked.length) return "your phone and email";
  if (masked.length === 1) return masked[0];
  return masked.slice(0, -1).join(", ") + " and " + masked[masked.length - 1];
}

function setOtpError(message) {
  otpError.textContent = message || "";
  otpError.classList.toggle("show", Boolean(message));
  otpInputsWrap.classList.toggle("invalid", Boolean(message));
  if (message) setTimeout(() => otpInputsWrap.classList.remove("invalid"), 350);
}

function otpValue() {
  return otpInputs.map((i) => i.value).join("");
}

function clearOtpInputs() {
  otpInputs.forEach((i) => {
    i.value = "";
    i.classList.remove("filled");
  });
  otpInputs[0].focus();
}

function startResendCountdown() {
  let remaining = OTP_RESEND_SECONDS;
  clearInterval(resendTimer);
  otpResendButton.disabled = true;
  otpResendButton.textContent = "Resend in " + remaining + "s";
  resendTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(resendTimer);
      otpResendButton.disabled = false;
      otpResendButton.textContent = "Resend code";
      return;
    }
    otpResendButton.textContent = "Resend in " + remaining + "s";
  }, 1000);
}

function openOtpModal(destinations) {
  document.getElementById("otpDestination").textContent =
    describeDestinations(destinations);
  setOtpError("");
  otpOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  startResendCountdown();
  setTimeout(clearOtpInputs, 40);
}

function closeOtpModal() {
  otpOverlay.hidden = true;
  document.body.style.overflow = "";
  clearInterval(resendTimer);
  pendingLogin = null;
  const loginButton = document.querySelector(".login-button");
  loginButton.disabled = false;
  loginButton.textContent = "Sign In";
}

// Persist the session and land on the dashboard.
function completeSignIn(data) {
  localStorage.setItem("admin_token", data.access_token);
  localStorage.setItem("admin_info", JSON.stringify(data.admin));
  localStorage.setItem(
    "admin_session_expiry",
    String(Date.now() + 30 * 60 * 1000),
  );
  window.location.href = "/dashboard";
}

// ---------- Digit boxes: auto-advance, backspace, arrows, paste ----------

otpInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 1);
    input.classList.toggle("filled", Boolean(input.value));
    if (input.value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
    setOtpError("");
    if (otpValue().length === OTP_LENGTH) otpForm.requestSubmit();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      e.preventDefault();
      const prev = otpInputs[index - 1];
      prev.value = "";
      prev.classList.remove("filled");
      prev.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) otpInputs[index - 1].focus();
    if (e.key === "ArrowRight" && index < otpInputs.length - 1)
      otpInputs[index + 1].focus();
  });

  // Pasting the whole code into any box fills the row.
  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const digits = (e.clipboardData.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!digits) return;
    digits.split("").forEach((d, i) => {
      otpInputs[i].value = d;
      otpInputs[i].classList.add("filled");
    });
    otpInputs[Math.min(digits.length, OTP_LENGTH - 1)].focus();
    if (digits.length === OTP_LENGTH) otpForm.requestSubmit();
  });
});

document.getElementById("otpClose").addEventListener("click", closeOtpModal);

// Deliberately NOT closing on a backdrop click: the code has already been sent
// and cancelling here throws the attempt away. The X and Escape still cancel.
otpOverlay.addEventListener("click", (e) => {
  if (e.target === otpOverlay) otpInputs[0].focus();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !otpOverlay.hidden) closeOtpModal();
});

// ---------- Step 1: password ----------

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("errorMessage");
  const loginButton = document.querySelector(".login-button");

  // Clear previous error
  errorMessage.textContent = "";
  errorMessage.classList.remove("show");
  loginButton.disabled = true;
  loginButton.textContent = "Signing in...";

  try {
    const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    let data = {};
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (response.status >= 500)
        throw new Error(
          "Backend unreachable (e.g. 502). Is the API running at " +
            API_BASE_URL +
            "?",
        );
      throw new Error(text || "Server returned non-JSON. Check API URL.");
    }

    if (!response.ok) {
      throw new Error(data.detail || "Login failed");
    }

    // Hold what the second step needs. `otp_token` is what login will return in
    // place of the access token once OTP ships; until then the access token is
    // parked here and only written to storage after the code is verified.
    pendingLogin = {
      email: email,
      otpToken: data.otp_token || null,
      session: data.access_token ? data : null,
    };

    loginButton.textContent = "Code sent";
    // The API returns every destination it sent to; fall back to the address
    // the admin just typed while the endpoint is still being built.
    openOtpModal(data.otp_destinations || [email]);
  } catch (error) {
    errorMessage.textContent =
      error.message || "An error occurred. Please try again.";
    errorMessage.classList.add("show");
    loginButton.disabled = false;
    loginButton.textContent = "Sign In";
  }
});

// ---------- Step 2: one-time code ----------

otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const code = otpValue();
  if (code.length !== OTP_LENGTH) {
    setOtpError("Enter all " + OTP_LENGTH + " digits.");
    return;
  }

  otpVerifyButton.disabled = true;
  otpVerifyButton.textContent = "Verifying...";
  setOtpError("");

  try {
    if (OTP_STUBBED) {
      // Design preview: any 6 digits pass.
      await new Promise((r) => setTimeout(r, 600));
      if (!pendingLogin) {
        throw new Error("That sign-in attempt was cancelled. Start again.");
      }
      if (!pendingLogin.session) {
        // While OTP is stubbed the session still comes from the password step.
        // If the login response carried no access_token there is nothing to
        // sign in with — say so plainly instead of blaming the session.
        console.error(
          "Login response had no access_token; nothing to complete sign-in with.",
        );
        throw new Error(
          "Sign-in did not return a session token. Check the login endpoint.",
        );
      }
      completeSignIn(pendingLogin.session);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/admin/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        otp_token: pendingLogin.otpToken,
        code: code,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || "That code isn't right. Try again.");
    }

    completeSignIn(data);
  } catch (error) {
    setOtpError(error.message || "Verification failed. Try again.");
    clearOtpInputs();
  } finally {
    otpVerifyButton.disabled = false;
    otpVerifyButton.textContent = "Verify & continue";
  }
});

// ---------- Resend ----------

otpResendButton.addEventListener("click", async () => {
  otpResendButton.disabled = true;
  setOtpError("");
  clearOtpInputs();

  try {
    if (!OTP_STUBBED) {
      const response = await fetch(`${API_BASE_URL}/admin/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp_token: pendingLogin.otpToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Could not resend the code.");
      }
      if (data.otp_token) pendingLogin.otpToken = data.otp_token;
    }
    startResendCountdown();
  } catch (error) {
    setOtpError(error.message || "Could not resend the code.");
    otpResendButton.disabled = false;
    otpResendButton.textContent = "Resend code";
  }
});
