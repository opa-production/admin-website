const API_BASE_URL = "https://api.ardena.xyz/api/v1";

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

    // Store token, admin info, and expiry timestamp
    localStorage.setItem("admin_token", data.access_token);
    localStorage.setItem("admin_info", JSON.stringify(data.admin));
    localStorage.setItem(
      "admin_session_expiry",
      String(Date.now() + 30 * 60 * 1000),
    );

    // Redirect to dashboard
    window.location.href = "dashboard.html";
  } catch (error) {
    errorMessage.textContent =
      error.message || "An error occurred. Please try again.";
    errorMessage.classList.add("show");
    loginButton.disabled = false;
    loginButton.textContent = "Sign In";
  }
});
