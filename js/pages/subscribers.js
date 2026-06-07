// js/pages/subscribers.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// ==================== SUBSCRIBERS (NEWSLETTER) ====================

let subscribersCurrentPage = 1;
const subscribersLimit = 20;
let subscribersHandlersAttached = false;
let subscribersTrendChart = null;

function attachSubscribersHandlers() {
  if (subscribersHandlersAttached) return;
  subscribersHandlersAttached = true;
  const seeBtn = document.getElementById("seeSubscribersBtn");
  const filterEl = document.getElementById("subscribersFilter");
  const sendBtn = document.getElementById("sendNewsletterBtn");

  // Write / Preview tab toggle
  const writeTab = document.getElementById("newsletterWriteTab");
  const previewTab = document.getElementById("newsletterPreviewTab");
  const bodyEl = document.getElementById("newsletterBody");
  const previewEl = document.getElementById("newsletterPreview");
  if (writeTab && previewTab && bodyEl && previewEl) {
    writeTab.addEventListener("click", () => setNewsletterMode("write"));
    previewTab.addEventListener("click", () => setNewsletterMode("preview"));
  }
  if (seeBtn) {
    seeBtn.addEventListener("click", () => {
      const section = document.getElementById("subscribersListSection");
      if (!section) return;
      if (section.style.display === "none") {
        section.style.display = "block";
        seeBtn.textContent = "Hide subscribers";
        loadSubscribersList(1);
      } else {
        section.style.display = "none";
        seeBtn.textContent = "See subscribers";
      }
    });
  }
  if (filterEl)
    filterEl.addEventListener("change", () => loadSubscribersList(1));
  if (sendBtn) sendBtn.addEventListener("click", sendNewsletterToSubscribers);
}

function createSubscribersTrendChart(labels, subscriptions, unsubscriptions) {
  const canvas = document.getElementById("subscribersTrendChart");
  if (!canvas) return;
  if (subscribersTrendChart) subscribersTrendChart.destroy();

  const ctx = canvas.getContext("2d");
  const height = canvas.height || 280;

  const subGradient = ctx.createLinearGradient(0, 0, 0, height);
  subGradient.addColorStop(0, "rgba(37, 99, 235, 0.28)");
  subGradient.addColorStop(1, "rgba(37, 99, 235, 0.02)");

  const unsubGradient = ctx.createLinearGradient(0, 0, 0, height);
  unsubGradient.addColorStop(0, "rgba(239, 68, 68, 0.22)");
  unsubGradient.addColorStop(1, "rgba(239, 68, 68, 0.02)");

  subscribersTrendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels.map((l) => {
        const d = new Date(l);
        return d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
      }),
      datasets: [
        {
          label: "Subscribed",
          data: subscriptions,
          borderColor: "rgba(37, 99, 235, 1)",
          backgroundColor: subGradient,
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "rgba(37, 99, 235, 1)",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
        },
        {
          label: "Unsubscribed",
          data: unsubscriptions,
          borderColor: "rgba(239, 68, 68, 1)",
          backgroundColor: unsubGradient,
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "rgba(239, 68, 68, 1)",
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12,
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          titleFont: { size: 13, weight: "600" },
          bodyFont: { size: 12 },
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 4,
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: {
            maxRotation: 0,
            autoSkipPadding: 18,
            font: { size: 11 },
            color: "#6b7280",
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(17, 24, 39, 0.05)",
            drawBorder: false,
            borderDash: [3, 3],
          },
          ticks: { precision: 0, font: { size: 11 }, color: "#6b7280" },
        },
      },
      animation: { duration: 1000, easing: "easeOutQuart" },
    },
  });
}

async function loadSubscribersList(page) {
  const tbody = document.getElementById("subscribersTableBody");
  const paginationEl = document.getElementById("subscribersPagination");
  if (!tbody || !paginationEl) return;
  subscribersCurrentPage = page;
  const filterEl = document.getElementById("subscribersFilter");
  const subscribedOnly = filterEl && filterEl.value === "true";
  tbody.innerHTML =
    '<tr><td colspan="3" style="padding: 20px; color: #666; text-align: center;">Loading...</td></tr>';
  try {
    const data = await api.getSubscribers({
      page: page,
      limit: subscribersLimit,
      subscribed_only: subscribedOnly,
    });
    const list = data.subscribers || [];
    const total = data.total || 0;
    const totalPages = data.total_pages || 1;
    if (list.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" style="padding: 20px; color: #666; text-align: center;">No subscribers found.</td></tr>';
    } else {
      tbody.innerHTML = list
        .map(
          (s) => `
                <tr>
                    <td>${escapeHtml(s.email)}</td>
                    <td>${s.is_subscribed ? "Subscribed" : "Unsubscribed"}</td>
                    <td>${s.created_at ? new Date(s.created_at).toLocaleString() : "—"}</td>
                </tr>
            `,
        )
        .join("");
    }
    paginationEl.innerHTML = "";
    if (totalPages > 1) {
      const prevBtn = document.createElement("button");
      prevBtn.className = "btn btn-secondary";
      prevBtn.textContent = "Previous";
      prevBtn.disabled = page <= 1;
      prevBtn.onclick = () => loadSubscribersList(page - 1);
      const nextBtn = document.createElement("button");
      nextBtn.className = "btn btn-secondary";
      nextBtn.textContent = "Next";
      nextBtn.disabled = page >= totalPages;
      nextBtn.onclick = () => loadSubscribersList(page + 1);
      const span = document.createElement("span");
      span.textContent = `Page ${page} of ${totalPages} (${total} total)`;
      span.style.marginLeft = "8px";
      paginationEl.appendChild(prevBtn);
      paginationEl.appendChild(nextBtn);
      paginationEl.appendChild(span);
    }
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="3" style="padding: 20px; color: #c62828; text-align: center;">Error loading subscribers. ' +
      (e.message || "") +
      "</td></tr>";
  }
}

// Render markdown → HTML (sanitized-ish: marked already escapes raw HTML when
// configured, but admins author this, so we keep things permissive).
function renderNewsletterMarkdown(md) {
  if (typeof marked === "undefined") return md;
  try {
    return marked.parse(md, { gfm: true, breaks: true });
  } catch (e) {
    console.error("Markdown render failed:", e);
    return md;
  }
}

// Wrap rendered HTML in a minimal email template so every send looks consistent.
function wrapNewsletterEmail(innerHtml, subject) {
  const safeSubject = (subject || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#f6f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f8fb;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #eef2f7;border-radius:10px;">
          <tr>
            <td style="padding:32px 32px 24px;line-height:1.6;font-size:15px;color:#1f2937;">
              ${innerHtml}
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">
          You're receiving this because you subscribed to our newsletter.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function setNewsletterMode(mode) {
  const writeTab = document.getElementById("newsletterWriteTab");
  const previewTab = document.getElementById("newsletterPreviewTab");
  const bodyEl = document.getElementById("newsletterBody");
  const previewEl = document.getElementById("newsletterPreview");
  if (!writeTab || !previewTab || !bodyEl || !previewEl) return;

  const showPreview = mode === "preview";
  writeTab.classList.toggle("active", !showPreview);
  previewTab.classList.toggle("active", showPreview);
  writeTab.setAttribute("aria-selected", String(!showPreview));
  previewTab.setAttribute("aria-selected", String(showPreview));

  if (showPreview) {
    const html = renderNewsletterMarkdown(bodyEl.value.trim());
    previewEl.innerHTML =
      html ||
      '<p style="color:#9ca3af;">Nothing to preview yet — write some Markdown first.</p>';
    previewEl.hidden = false;
    bodyEl.hidden = true;
  } else {
    previewEl.hidden = true;
    bodyEl.hidden = false;
  }
}

async function sendNewsletterToSubscribers() {
  const subjectEl = document.getElementById("newsletterSubject");
  const bodyEl = document.getElementById("newsletterBody");
  const resultEl = document.getElementById("newsletterResult");
  const sendBtn = document.getElementById("sendNewsletterBtn");
  if (!subjectEl || !bodyEl || !resultEl || !sendBtn) return;
  const subject = subjectEl.value.trim();
  const markdown = bodyEl.value.trim();
  if (!subject || !markdown) {
    resultEl.className = "form-result error";
    resultEl.textContent = "Please enter subject and body.";
    return;
  }
  sendBtn.disabled = true;
  resultEl.className = "form-result";
  resultEl.textContent = "Sending…";
  try {
    const inner = renderNewsletterMarkdown(markdown);
    const wrapped = wrapNewsletterEmail(inner, subject);
    const data = await api.sendNewsletter({ subject, body_html: wrapped });
    resultEl.className = "form-result success";
    resultEl.textContent =
      data.message || `Sent: ${data.sent || 0}, Failed: ${data.failed || 0}`;
  } catch (e) {
    resultEl.className = "form-result error";
    resultEl.textContent = e.message || "Failed to send";
  }
  sendBtn.disabled = false;
}

async function loadSubscribers() {
  attachSubscribersHandlers();
  const countEl = document.getElementById("subscribersCountDisplay");
  try {
    const [countData, trendsData] = await Promise.all([
      api.getSubscriberCount({ subscribed_only: "true" }),
      api.getSubscriberTrends({ days: 30 }),
    ]);
    if (countEl)
      countEl.textContent = countData.count != null ? countData.count : "—";
    const labels = trendsData.labels || [];
    const subscriptions = trendsData.subscriptions || [];
    const unsubscriptions = trendsData.unsubscriptions || [];
    createSubscribersTrendChart(labels, subscriptions, unsubscriptions);
  } catch (e) {
    if (countEl) countEl.textContent = "—";
    console.error("Error loading subscribers:", e);
  }
  const section = document.getElementById("subscribersListSection");
  const seeBtn = document.getElementById("seeSubscribersBtn");
  if (section) section.style.display = "none";
  if (seeBtn) seeBtn.textContent = "See subscribers";
}
