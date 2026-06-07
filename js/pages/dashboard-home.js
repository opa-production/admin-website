// js/pages/dashboard-home.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// Chart instances storage
let verifiedHostsChart = null;
let verifiedClientsChart = null;
let verificationStatusChart = null;
let bookingOutcomesChart = null;
let bookingsVolumeChart = null;

// Normalize the kyc-trends response (an array of { date, verified, pending })
// into the shape the KYC chart consumes.
function normalizeKycSeries(rows) {
  const safe = Array.isArray(rows) ? rows : [];
  const labels = safe.map((r) => {
    const d = new Date(r.date);
    return isNaN(d)
      ? r.date
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });
  const verified_series = safe.map((r) => r.verified || 0);
  const pending_series = safe.map((r) => r.pending || 0);
  const last = safe[safe.length - 1] || { verified: 0, pending: 0 };
  return {
    labels,
    verified_series,
    pending_series,
    verified_now: last.verified || 0,
    pending_now: last.pending || 0,
  };
}

// Load dashboard
async function loadDashboard() {
  const statsGrid = document.getElementById("statsGrid");

  try {
    const [stats, kyc, bookingTrends] = await Promise.all([
      api.getDashboardStats(),
      api.getKycTrends().catch((err) => {
        console.error("Failed to load KYC trends:", err);
        return { hosts: [], clients: [] };
      }),
      api.getBookingTrends(14).catch((err) => {
        console.error("Failed to load booking trends:", err);
        return null;
      }),
    ]);

    statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Total Hosts</div>
                <div class="stat-value">${stats.total_hosts}</div>
                <div class="stat-subvalue">${stats.active_hosts} active, ${stats.inactive_hosts} inactive</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Clients</div>
                <div class="stat-value">${stats.total_clients}</div>
                <div class="stat-subvalue">${stats.active_clients} active, ${stats.inactive_clients} inactive</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Cars</div>
                <div class="stat-value">${stats.total_cars}</div>
                <div class="stat-subvalue">${stats.visible_cars} visible, ${stats.hidden_cars} hidden</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Awaiting Verification</div>
                <div class="stat-value">${stats.cars_awaiting_verification}</div>
                <div class="stat-subvalue">${stats.verified_cars} verified, ${stats.rejected_cars} rejected</div>
            </div>
        `;

    createVerifiedHostsChart(normalizeKycSeries(kyc.hosts));
    createVerifiedClientsChart(normalizeKycSeries(kyc.clients));
    createVerificationStatusChart(stats);
    if (bookingTrends) {
      createBookingOutcomesChart(normalizeBookingOutcomes(bookingTrends));
      createBookingsVolumeChart(normalizeBookingsTrend(bookingTrends));
    }
  } catch (error) {
    console.error("Error loading dashboard:", error);
    statsGrid.innerHTML =
      '<div class="empty-state">Error loading statistics</div>';
  }
}

// ---------------------------------------------------------------------------
// KYC charts (Verified Hosts / Verified Clients)
// Smooth filled area showing cumulative verified vs pending over time, plus
// a subtitle with the current verified-share percentage.
// ---------------------------------------------------------------------------
function buildKycChart(canvas, data, palette) {
  const ctx = canvas.getContext("2d");
  const height = canvas.height || 200;

  const verifiedGradient = ctx.createLinearGradient(0, 0, 0, height);
  verifiedGradient.addColorStop(0, palette.verifiedTop);
  verifiedGradient.addColorStop(1, palette.verifiedBottom);

  const pendingGradient = ctx.createLinearGradient(0, 0, 0, height);
  pendingGradient.addColorStop(0, palette.pendingTop);
  pendingGradient.addColorStop(1, palette.pendingBottom);

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Verified",
          data: data.verified_series,
          fill: true,
          backgroundColor: verifiedGradient,
          borderColor: palette.verifiedLine,
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: palette.verifiedLine,
          pointHoverBorderColor: "#fff",
          pointHoverBorderWidth: 2,
        },
        {
          label: "Pending KYC",
          data: data.pending_series,
          fill: true,
          backgroundColor: pendingGradient,
          borderColor: palette.pendingLine,
          borderWidth: 2,
          borderDash: [4, 4],
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: palette.pendingLine,
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
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 10,
            usePointStyle: true,
            pointStyle: "rectRounded",
            font: {
              size: 11,
              family:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            },
          },
        },
        tooltip: {
          padding: 10,
          backgroundColor: "rgba(17, 24, 39, 0.92)",
          titleFont: { size: 12, weight: "600" },
          bodyFont: { size: 12 },
          cornerRadius: 6,
          displayColors: true,
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { font: { size: 10 }, color: "#9ca3af" },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(17, 24, 39, 0.05)", drawBorder: false },
          ticks: { font: { size: 10 }, color: "#9ca3af", precision: 0 },
        },
      },
      animation: { duration: 1000, easing: "easeOutQuart" },
    },
  });
}

function createVerifiedHostsChart(data) {
  const canvas = document.getElementById("verifiedHostsChart");
  if (!canvas) return;
  if (verifiedHostsChart) verifiedHostsChart.destroy();

  verifiedHostsChart = buildKycChart(canvas, data, {
    verifiedLine: "rgba(37, 99, 235, 1)",
    verifiedTop: "rgba(37, 99, 235, 0.35)",
    verifiedBottom: "rgba(37, 99, 235, 0.02)",
    pendingLine: "rgba(148, 163, 184, 1)",
    pendingTop: "rgba(148, 163, 184, 0.25)",
    pendingBottom: "rgba(148, 163, 184, 0.02)",
  });

  const subtitle = document.getElementById("verifiedHostsSubtitle");
  if (subtitle) {
    subtitle.textContent = `${data.verified_now.toLocaleString()} verified · ${data.pending_now.toLocaleString()} pending`;
  }
}

function createVerifiedClientsChart(data) {
  const canvas = document.getElementById("verifiedClientsChart");
  if (!canvas) return;
  if (verifiedClientsChart) verifiedClientsChart.destroy();

  verifiedClientsChart = buildKycChart(canvas, data, {
    verifiedLine: "rgba(16, 185, 129, 1)",
    verifiedTop: "rgba(16, 185, 129, 0.35)",
    verifiedBottom: "rgba(16, 185, 129, 0.02)",
    pendingLine: "rgba(148, 163, 184, 1)",
    pendingTop: "rgba(148, 163, 184, 0.25)",
    pendingBottom: "rgba(148, 163, 184, 0.02)",
  });

  const subtitle = document.getElementById("verifiedClientsSubtitle");
  if (subtitle) {
    subtitle.textContent = `${data.verified_now.toLocaleString()} verified · ${data.pending_now.toLocaleString()} pending`;
  }
}

// ---------------------------------------------------------------------------
// Car Verification Status — horizontal stacked bar from real API counts.
// Shows current Verified / Awaiting / Denied at a glance, with counts and
// percentages on hover. Point-in-time, no fabricated history.
// ---------------------------------------------------------------------------
function createVerificationStatusChart(stats) {
  const canvas = document.getElementById("verificationStatusChart");
  if (!canvas) return;
  if (verificationStatusChart) verificationStatusChart.destroy();

  const ctx = canvas.getContext("2d");

  const verified = stats.verified_cars || 0;
  const awaiting = stats.cars_awaiting_verification || 0;
  const denied = stats.rejected_cars || 0;
  const total = verified + awaiting + denied;

  const series = [
    { label: "Verified", value: verified, color: "#10b981" },
    { label: "Awaiting", value: awaiting, color: "#f59e0b" },
    { label: "Denied", value: denied, color: "#ef4444" },
  ];

  verificationStatusChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Cars"],
      datasets: series.map((s) => ({
        label: s.label,
        data: [s.value],
        backgroundColor: s.color,
        borderWidth: 0,
        borderRadius: 4,
        barThickness: 28,
      })),
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
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
          callbacks: {
            label: (c) => {
              const v = c.parsed.x;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return ` ${c.dataset.label}: ${v} car${v === 1 ? "" : "s"} · ${pct}%`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: "rgba(17, 24, 39, 0.06)",
            drawBorder: false,
            borderDash: [3, 3],
          },
          ticks: { font: { size: 11 }, color: "#6b7280", precision: 0 },
        },
        y: {
          stacked: true,
          grid: { display: false, drawBorder: false },
          ticks: { display: false },
        },
      },
      animation: { duration: 800, easing: "easeOutQuart" },
    },
  });

  const legendEl = document.getElementById("verificationLegend");
  if (legendEl) {
    legendEl.innerHTML = series
      .map((s) => {
        const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
        return `<span class="legend-chip"><span class="legend-dot" style="background:${s.color}"></span>${s.label} · ${s.value} (${pct}%)</span>`;
      })
      .join("");
  }
}

// ---------------------------------------------------------------------------
// Booking analytics — backed by GET /admin/dashboard/booking-trends?days=14.
// Response shape: { outcomes: [{date, successful, cancelled_by_host,
// cancelled_by_client}], trend: [{date, bookings}], totals: {...} }
// ---------------------------------------------------------------------------
function formatBookingDateLabel(value) {
  const d = new Date(value);
  if (isNaN(d)) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeBookingOutcomes(resp) {
  const outcomes = Array.isArray(resp?.outcomes) ? resp.outcomes : [];
  const totals = resp?.totals || {};
  return {
    labels: outcomes.map((o) => formatBookingDateLabel(o.date)),
    successful: outcomes.map((o) => o.successful || 0),
    cancelledByHost: outcomes.map((o) => o.cancelled_by_host || 0),
    cancelledByClient: outcomes.map((o) => o.cancelled_by_client || 0),
    totalSuccessful: totals.successful || 0,
    totalCancelledByHost: totals.cancelled_by_host || 0,
    totalCancelledByClient: totals.cancelled_by_client || 0,
    days: resp?.days || outcomes.length,
  };
}

function normalizeBookingsTrend(resp) {
  const trend = Array.isArray(resp?.trend) ? resp.trend : [];
  const totals = resp?.totals || {};
  return {
    labels: trend.map((t) => formatBookingDateLabel(t.date)),
    totals: trend.map((t) => t.bookings || 0),
    totalCreated: totals.bookings_created || 0,
    days: resp?.days || trend.length,
  };
}

function createBookingOutcomesChart(data) {
  const canvas = document.getElementById("bookingOutcomesChart");
  if (!canvas) return;
  if (bookingOutcomesChart) bookingOutcomesChart.destroy();

  const ctx = canvas.getContext("2d");
  const series = [
    {
      label: "Successful",
      data: data.successful,
      color: "rgba(16, 185, 129, 1)",
    },
    {
      label: "Cancelled by host",
      data: data.cancelledByHost,
      color: "rgba(239, 68, 68, 1)",
    },
    {
      label: "Cancelled by client",
      data: data.cancelledByClient,
      color: "rgba(245, 158, 11, 1)",
    },
  ];

  bookingOutcomesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.data,
        borderColor: s.color,
        backgroundColor: "transparent",
        fill: false,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: s.color,
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 10,
          backgroundColor: "rgba(17, 24, 39, 0.92)",
          titleFont: { size: 12, weight: "600" },
          bodyFont: { size: 12 },
          cornerRadius: 6,
          displayColors: true,
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: {
            font: { size: 10 },
            color: "#9ca3af",
            maxRotation: 0,
            autoSkipPadding: 14,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(17, 24, 39, 0.05)", drawBorder: false },
          ticks: { font: { size: 10 }, color: "#9ca3af", precision: 0 },
        },
      },
      animation: { duration: 900, easing: "easeOutQuart" },
    },
  });

  const legendEl = document.getElementById("bookingOutcomesLegend");
  if (legendEl) {
    legendEl.innerHTML = series
      .map(
        (s) =>
          `<span class="legend-chip"><span class="legend-dot" style="background:${s.color}"></span>${s.label}</span>`,
      )
      .join("");
  }

  const subtitle = document.getElementById("bookingOutcomesSubtitle");
  if (subtitle) {
    const days = data.days || data.labels.length;
    const success = data.totalSuccessful || 0;
    const host = data.totalCancelledByHost || 0;
    const client = data.totalCancelledByClient || 0;
    const denom = success + host + client;
    const cancelRate =
      denom > 0 ? Math.round(((host + client) / denom) * 100) : 0;
    subtitle.textContent = `Last ${days} days · ${success.toLocaleString()} successful · ${cancelRate}% cancel rate`;
  }
}

function createBookingsVolumeChart(data) {
  const canvas = document.getElementById("bookingsVolumeChart");
  if (!canvas) return;
  if (bookingsVolumeChart) bookingsVolumeChart.destroy();

  const ctx = canvas.getContext("2d");
  const height = canvas.height || 220;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(37, 99, 235, 0.30)");
  gradient.addColorStop(1, "rgba(37, 99, 235, 0.02)");

  bookingsVolumeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Bookings",
          data: data.totals,
          borderColor: "rgba(37, 99, 235, 1)",
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "rgba(37, 99, 235, 1)",
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
          padding: 10,
          backgroundColor: "rgba(17, 24, 39, 0.92)",
          titleFont: { size: 12, weight: "600" },
          bodyFont: { size: 12 },
          cornerRadius: 6,
          displayColors: false,
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: {
            font: { size: 10 },
            color: "#9ca3af",
            maxRotation: 0,
            autoSkipPadding: 16,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(17, 24, 39, 0.05)", drawBorder: false },
          ticks: { font: { size: 10 }, color: "#9ca3af", precision: 0 },
        },
      },
      animation: { duration: 900, easing: "easeOutQuart" },
    },
  });

  const subtitle = document.getElementById("bookingsVolumeSubtitle");
  if (subtitle) {
    const days = data.days || data.labels.length;
    const last = data.totals[data.totals.length - 1] || 0;
    const total = data.totalCreated || data.totals.reduce((a, b) => a + b, 0);
    subtitle.textContent = `Last ${days} days · ${total.toLocaleString()} total · ${last} today`;
  }
}
