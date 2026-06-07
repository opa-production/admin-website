// js/pages/subscribers.js — Email Service page (page key stays "subscribers").
// Classic script: top-level functions are global by design.
//
// Compose a branded Ardena email and send it to all clients and/or all hosts.
// The admin only writes the body (Markdown); the Ardena header + unsubscribe
// footer are applied by the backend per the contract in emails.md. The live
// preview here renders that exact template so it's WYSIWYG.

const EMAIL_DOMAIN = "ardena.co.ke";
const EMAIL_ALIASES = ["noreply", "info", "hello", "kelvin", "mokaya", "ceo"];

let emailServiceWired = false;
let emailReachCounts = { clients: null, hosts: null };

function emailAddressFor(alias) {
  return `${alias}@${EMAIL_DOMAIN}`;
}

function markdownToHtml(md) {
  if (typeof marked === "undefined") return escapeHtml(md || "").replace(/\n/g, "<br>");
  try {
    return marked.parse(md || "", { gfm: true, breaks: true });
  } catch (e) {
    return escapeHtml(md || "");
  }
}

// The branded email template. This is the SAME template the backend must
// produce (see emails.md) — keep them in sync. `unsubscribeUrl` is a placeholder
// in the preview; the backend personalises it per recipient.
function buildBrandedEmailHtml(innerHtml, subject, opts = {}) {
  const logo = opts.logoUrl || "/js/assets/logo.png";
  // Points at the public brand domain (never the admin/API host). The branded
  // page for this route is shipped as unsubscribe.html — deploy it there.
  const unsub = opts.unsubscribeUrl || "https://ardena.co.ke/unsubscribe";
  const safeSubject = escapeHtml(subject || "");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7ebf2;">
        <tr><td style="background:#0066cc;padding:24px 28px;text-align:center;">
          <img src="${logo}" alt="Ardena" height="52" style="height:52px;display:inline-block;border:0;filter:brightness(0) invert(1);">
        </td></tr>
        <tr><td style="padding:30px 32px;font-size:15px;line-height:1.65;color:#1f2937;">
          ${innerHtml || '<p style="color:#9ca3af;">Your email body will appear here as you type.</p>'}
        </td></tr>
        <tr><td style="padding:0 32px 30px;">
          <div style="text-align:center;padding-top:22px;border-top:1px solid #eef2f7;">
            <a href="${unsub}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:#f1f5f9;color:#475569;text-decoration:none;font-size:13px;font-weight:600;">Unsubscribe</a>
            <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">You received this because you have an Ardena account.<br>&copy; Ardena · Nairobi, Kenya</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function selectedEmailAudiences() {
  const audiences = [];
  if (document.getElementById("emailToClients")?.checked) audiences.push("clients");
  if (document.getElementById("emailToHosts")?.checked) audiences.push("hosts");
  return audiences;
}

function updateEmailPreview() {
  const subject = document.getElementById("emailSubject")?.value || "";
  const body = document.getElementById("emailBody")?.value || "";
  const alias = document.getElementById("emailFromAlias")?.value || "noreply";
  const frame = document.getElementById("emailPreviewFrame");
  const meta = document.getElementById("emailPreviewMeta");

  if (frame) {
    frame.srcdoc = buildBrandedEmailHtml(markdownToHtml(body), subject);
  }
  if (meta) {
    const aud = selectedEmailAudiences();
    const audLabel =
      aud.length === 2
        ? "Clients + Hosts"
        : aud.length === 1
          ? aud[0] === "clients"
            ? "Clients"
            : "Hosts"
          : "no audience";
    meta.textContent = `From ${emailAddressFor(alias)} · ${audLabel}`;
  }
}

async function updateEmailReach() {
  const el = document.getElementById("emailReachValue");
  if (!el) return;
  // Lazily fetch the totals once, then recompute from the checkboxes.
  try {
    if (emailReachCounts.clients == null) {
      const c = await api.getClients({ page: 1, limit: 1 });
      emailReachCounts.clients = c.total || 0;
    }
    if (emailReachCounts.hosts == null) {
      const h = await api.getHosts({ page: 1, limit: 1 });
      emailReachCounts.hosts = h.total || 0;
    }
  } catch (e) {
    /* leave as-is */
  }
  const aud = selectedEmailAudiences();
  let total = 0;
  if (aud.includes("clients")) total += emailReachCounts.clients || 0;
  if (aud.includes("hosts")) total += emailReachCounts.hosts || 0;
  el.textContent = total ? `≈ ${total.toLocaleString()}` : "—";
}

function wireEmailService() {
  if (emailServiceWired) return;
  emailServiceWired = true;

  ["emailSubject", "emailBody", "emailFromAlias"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateEmailPreview);
    if (el) el.addEventListener("change", updateEmailPreview);
  });
  ["emailToClients", "emailToHosts"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener("change", () => {
        updateEmailPreview();
        updateEmailReach();
      });
  });
  const sendBtn = document.getElementById("sendEmailBtn");
  if (sendBtn) sendBtn.addEventListener("click", sendBulkEmailCampaign);
  const testBtn = document.getElementById("sendTestEmailBtn");
  if (testBtn) testBtn.addEventListener("click", sendTestEmailCampaign);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Send a single test email to one address using the current composer draft.
async function sendTestEmailCampaign() {
  const resultEl = document.getElementById("emailResult");
  const testBtn = document.getElementById("sendTestEmailBtn");
  const testEmail = (document.getElementById("emailTestAddress").value || "").trim();
  const alias = document.getElementById("emailFromAlias").value;
  const subject = document.getElementById("emailSubject").value.trim();
  const body = document.getElementById("emailBody").value.trim();

  const fail = (msg) => {
    if (resultEl) {
      resultEl.className = "form-result error";
      resultEl.textContent = msg;
    }
  };

  if (!isValidEmail(testEmail)) return fail("Enter a valid email address to test with.");
  if (!subject) return fail("Please enter a subject first.");
  if (!body) return fail("Please write the email body first.");

  testBtn.disabled = true;
  const original = testBtn.textContent;
  testBtn.textContent = "Sending…";
  try {
    const res = await api.sendTestEmail({
      test_email: testEmail,
      from_alias: alias,
      subject,
      body_html: markdownToHtml(body),
    });
    const ok = res.email_sent !== false;
    uiToast(
      res.message || (ok ? `Test email sent to ${testEmail}.` : "Test email failed to send."),
      ok ? "success" : "error",
    );
    if (resultEl) {
      resultEl.className = "form-result " + (ok ? "success" : "error");
      resultEl.textContent =
        res.message || (ok ? `Test sent to ${testEmail}.` : "Test failed.");
    }
  } catch (e) {
    fail(e.message || "Failed to send test email.");
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = original;
  }
}

async function sendBulkEmailCampaign() {
  const resultEl = document.getElementById("emailResult");
  const sendBtn = document.getElementById("sendEmailBtn");
  const alias = document.getElementById("emailFromAlias").value;
  const subject = document.getElementById("emailSubject").value.trim();
  const body = document.getElementById("emailBody").value.trim();
  const audiences = selectedEmailAudiences();

  const fail = (msg) => {
    if (resultEl) {
      resultEl.className = "form-result error";
      resultEl.textContent = msg;
    }
  };

  if (audiences.length === 0) return fail("Pick at least one audience (Clients or Hosts).");
  if (!subject) return fail("Please enter a subject.");
  if (!body) return fail("Please write the email body.");

  const who =
    audiences.length === 2
      ? "all clients and hosts"
      : audiences[0] === "clients"
        ? "all clients"
        : "all hosts";
  if (
    !(await uiConfirm(
      `Send this email to ${who} from ${emailAddressFor(alias)}? Opted-out recipients are skipped.`,
      { title: "Send email", confirmText: "Send email" },
    ))
  ) {
    return;
  }

  sendBtn.disabled = true;
  const original = sendBtn.textContent;
  sendBtn.textContent = "Sending…";
  if (resultEl) {
    resultEl.className = "form-result";
    resultEl.textContent = "Sending…";
  }

  try {
    const res = await api.sendBulkEmail({
      audiences,
      from_alias: alias,
      subject,
      body_html: markdownToHtml(body),
    });
    if (resultEl) {
      resultEl.className = "form-result success";
      resultEl.textContent =
        res.message ||
        `Queued for ${res.recipients ?? "selected"} recipient${res.recipients === 1 ? "" : "s"}.`;
    }
    uiToast(res.message || "Email queued for delivery.", "success");
  } catch (e) {
    fail(e.message || "Failed to send email.");
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = original;
  }
}

// Entry point (loadPage case "subscribers").
function loadSubscribers() {
  wireEmailService();
  updateEmailPreview();
  updateEmailReach();
}
