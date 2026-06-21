// js/pages/revenue.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.
//
// The four charts are intentionally distinct (no two show the same series):
//   1. revenueTrendChart   — area: OUR revenue (commission) per month
//   2. cashFlowChart       — stacked bars: processed cash split into commission + host payout
//   3. bookingVolumeChart  — bars: paid bookings per month
//   4. revenueSplitChart   — doughnut: all-time commission vs host payout (with centre total)
//
// All numbers come straight from the ledger via the backend (no hardcoded
// commission rate), so every chart reconciles with the KPI cards above.

let revenueTrendChart = null;
let cashFlowChart = null;
let bookingVolumeChart = null;
let revenueSplitChart = null;

// Premium palette
const REV_COLORS = {
  commission: "#10b981", // emerald — our revenue
  commissionSoft: "rgba(16, 185, 129, 0.14)",
  hostPayout: "#6366f1", // indigo — paid to hosts
  hostPayoutSoft: "rgba(99, 102, 241, 0.14)",
  bookings: "#a855f7", // violet — booking volume
  bookingsSoft: "rgba(168, 85, 247, 0.14)",
  grid: "rgba(17, 24, 39, 0.05)",
  axis: "#94a3b8",
};

// Shared currency formatter (KES, no decimals)
const revFmt = (n) =>
  (n || 0).toLocaleString("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  });

const revShort = (v) =>
  v >= 1000000
    ? (v / 1000000).toFixed(v % 1000000 ? 1 : 0) + "M"
    : v >= 1000
    ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k"
    : "" + v;

// Premium tooltip styling reused across charts
const revTooltip = {
  backgroundColor: "rgba(17, 24, 39, 0.92)",
  titleColor: "#f9fafb",
  bodyColor: "#e5e7eb",
  padding: 12,
  cornerRadius: 8,
  displayColors: true,
  usePointStyle: true,
  boxPadding: 6,
  titleFont: { size: 12, weight: "600" },
  bodyFont: { size: 12 },
};

// Doughnut centre-text plugin (renders total in the hole)
const doughnutCenterText = {
  id: "doughnutCenterText",
  afterDraw(chart) {
    const opts = chart.config.options.plugins?.centerText;
    if (!opts || !opts.text) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#9ca3af";
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillText(opts.label || "", cx, cy - 14);
    ctx.fillStyle = "#111827";
    ctx.font = "700 20px Inter, system-ui, sans-serif";
    ctx.fillText(opts.text, cx, cy + 6);
    ctx.restore();
  },
};

// Load revenue page
async function loadRevenue() {
  const statsGrid = document.getElementById("revenueStatsGrid");
  if (!statsGrid) return;

  try {
    statsGrid.innerHTML = '<div class="loading">Loading revenue...</div>';
    const data = await api.getRevenueStats();

    const ratePct = ((data.commission_rate || 0) * 100).toFixed(
      (data.commission_rate || 0) * 100 % 1 ? 1 : 0
    );

    statsGrid.innerHTML = `
            <div class="stat-card stat-card--muted">
                <div class="stat-label">Processed Cash</div>
                <div class="stat-value">${revFmt(data.money_in)}</div>
                <div class="stat-subvalue">Total handled — not revenue</div>
            </div>
            <div class="stat-card stat-card--revenue">
                <div class="stat-label">Revenue</div>
                <div class="stat-value">${revFmt(data.commission)}</div>
                <div class="stat-subvalue">Commission · ${ratePct}% platform fee</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Host Payout</div>
                <div class="stat-value">${revFmt(data.host_payout)}</div>
                <div class="stat-subvalue">Paid out to hosts</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Paid Bookings</div>
                <div class="stat-value">${(data.paid_bookings_count || 0).toLocaleString()}</div>
                <div class="stat-subvalue">Confirmed, active, completed</div>
            </div>
        `;

    createRevenueTrendChart(data);
    createCashFlowChart(data);
    createBookingVolumeChart(data);
    createRevenueSplitChart(data);
  } catch (error) {
    console.error("Error loading revenue:", error);
    statsGrid.innerHTML = `<div class="empty-state">Error loading revenue: ${error.message}</div>`;
  }
}

// 1. Revenue Trend — smooth gradient area of OUR revenue (commission) per month
function createRevenueTrendChart(data) {
  const canvas = document.getElementById("revenueTrendChart");
  if (!canvas) return;
  if (revenueTrendChart) revenueTrendChart.destroy();

  const ctx = canvas.getContext("2d");
  const monthly = data.monthly_breakdown || [];
  const labels = monthly.map((m) => m.label);
  const values = monthly.map((m) => m.commission || 0);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 240);
  gradient.addColorStop(0, "rgba(16, 185, 129, 0.32)");
  gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");

  revenueTrendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue",
          data: values,
          fill: true,
          backgroundColor: gradient,
          borderColor: REV_COLORS.commission,
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: REV_COLORS.commission,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
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
          ...revTooltip,
          callbacks: { label: (c) => `Revenue: ${revFmt(c.raw)}` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: REV_COLORS.axis, font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: REV_COLORS.grid },
          border: { display: false },
          ticks: {
            color: REV_COLORS.axis,
            font: { size: 11 },
            maxTicksLimit: 5,
            callback: (v) => "KES " + revShort(v),
          },
        },
      },
    },
  });
}

// 2. Cash Flow — stacked bars: processed cash = host payout + commission, per month
function createCashFlowChart(data) {
  const canvas = document.getElementById("cashFlowChart");
  if (!canvas) return;
  if (cashFlowChart) cashFlowChart.destroy();

  const ctx = canvas.getContext("2d");
  const monthly = data.monthly_breakdown || [];
  const labels = monthly.map((m) => m.label);
  const hostData = monthly.map((m) => m.host_payout || 0);
  const commissionData = monthly.map((m) => m.commission || 0);

  cashFlowChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Host Payout",
          data: hostData,
          backgroundColor: REV_COLORS.hostPayout,
          borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 6, bottomRight: 6 },
          borderSkipped: false,
          stack: "cash",
          maxBarThickness: 38,
        },
        {
          label: "Revenue (Commission)",
          data: commissionData,
          backgroundColor: REV_COLORS.commission,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          stack: "cash",
          maxBarThickness: 38,
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
          labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 16, color: "#64748b", font: { size: 11 } },
        },
        tooltip: {
          ...revTooltip,
          callbacks: {
            label: (c) => `${c.dataset.label}: ${revFmt(c.raw)}`,
            footer: (items) => {
              const total = items.reduce((s, i) => s + (i.raw || 0), 0);
              return `Processed: ${revFmt(total)}`;
            },
          },
          footerColor: "#f9fafb",
          footerFont: { size: 11, weight: "600" },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          border: { display: false },
          ticks: { color: REV_COLORS.axis, font: { size: 11 } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: REV_COLORS.grid },
          border: { display: false },
          ticks: {
            color: REV_COLORS.axis,
            font: { size: 11 },
            maxTicksLimit: 5,
            callback: (v) => "KES " + revShort(v),
          },
        },
      },
    },
  });
}

// 3. Booking Volume — rounded bars of paid bookings per month
function createBookingVolumeChart(data) {
  const canvas = document.getElementById("bookingVolumeChart");
  if (!canvas) return;
  if (bookingVolumeChart) bookingVolumeChart.destroy();

  const ctx = canvas.getContext("2d");
  const monthly = data.monthly_breakdown || [];
  const labels = monthly.map((m) => m.label);
  const counts = monthly.map((m) => m.booking_count || 0);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 240);
  gradient.addColorStop(0, REV_COLORS.bookings);
  gradient.addColorStop(1, "rgba(168, 85, 247, 0.45)");

  bookingVolumeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Bookings",
          data: counts,
          backgroundColor: gradient,
          hoverBackgroundColor: REV_COLORS.bookings,
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 38,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...revTooltip,
          callbacks: {
            label: (c) => `${c.raw} booking${c.raw === 1 ? "" : "s"}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: REV_COLORS.axis, font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: REV_COLORS.grid },
          border: { display: false },
          ticks: {
            color: REV_COLORS.axis,
            font: { size: 11 },
            precision: 0,
            maxTicksLimit: 5,
          },
        },
      },
    },
  });
}

// 4. Revenue Split — doughnut of all-time commission vs host payout, total in centre
function createRevenueSplitChart(data) {
  const canvas = document.getElementById("revenueSplitChart");
  if (!canvas) return;
  if (revenueSplitChart) revenueSplitChart.destroy();

  const ctx = canvas.getContext("2d");
  const commission = data.commission || 0;
  const hostPayout = data.host_payout || 0;
  const total = commission + hostPayout;

  revenueSplitChart = new Chart(ctx, {
    type: "doughnut",
    plugins: [doughnutCenterText],
    data: {
      labels: ["Revenue (Commission)", "Host Payout"],
      datasets: [
        {
          data: [commission, hostPayout],
          backgroundColor: [REV_COLORS.commission, REV_COLORS.hostPayout],
          hoverOffset: 6,
          borderColor: "#fff",
          borderWidth: 3,
          spacing: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        centerText: { label: "Net Cash", text: "KES " + revShort(total) },
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 16, color: "#64748b", font: { size: 11 } },
        },
        tooltip: {
          ...revTooltip,
          callbacks: {
            label: (c) => {
              const pct = total ? ((c.raw / total) * 100).toFixed(1) : 0;
              return ` ${c.label}: ${revFmt(c.raw)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}
