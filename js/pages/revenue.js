// js/pages/revenue.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.

let revenueStreamChart = null;
let moneyFlowChart = null;
let paidBookingsChart = null;
let revenueCompositionChart = null;

// Load revenue page
async function loadRevenue() {
  const statsGrid = document.getElementById("revenueStatsGrid");
  if (!statsGrid) return;

  try {
    statsGrid.innerHTML = '<div class="loading">Loading revenue...</div>';
    const data = await api.getRevenueStats();

    const fmt = (n) =>
      (n || 0).toLocaleString("en-KE", {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 0,
      });

    statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Money In</div>
                <div class="stat-value">${fmt(data.money_in)}</div>
                <div class="stat-subvalue">Total from bookings</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Commission</div>
                <div class="stat-value">${fmt(data.commission)}</div>
                <div class="stat-subvalue">${data.commission_rate * 100}% platform fee</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Host Payout</div>
                <div class="stat-value">${fmt(data.host_payout)}</div>
                <div class="stat-subvalue">To hosts</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Paid Bookings</div>
                <div class="stat-value">${(data.paid_bookings_count || 0).toLocaleString()}</div>
                <div class="stat-subvalue">Confirmed, active, completed</div>
            </div>
        `;

    createRevenueStreamChart(data);
    createMoneyFlowChart(data);
    createPaidBookingsChart(data);
    createRevenueCompositionChart(data);
  } catch (error) {
    console.error("Error loading revenue:", error);
    statsGrid.innerHTML = `<div class="empty-state">Error loading revenue: ${error.message}</div>`;
  }
}

// Revenue Stream: Smooth Area Chart with gradient (not normal bar)
function createRevenueStreamChart(data) {
  const canvas = document.getElementById("revenueStreamChart");
  if (!canvas) return;

  if (revenueStreamChart) revenueStreamChart.destroy();

  const ctx = canvas.getContext("2d");
  const labels = (data.monthly_breakdown || []).map((m) => m.label);
  const values = (data.monthly_breakdown || []).map((m) => m.revenue);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(155, 89, 182, 0.5)");
  gradient.addColorStop(0.5, "rgba(142, 68, 173, 0.2)");
  gradient.addColorStop(1, "rgba(142, 68, 173, 0.02)");

  revenueStreamChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue (KES)",
          data: values,
          fill: true,
          backgroundColor: gradient,
          borderColor: "rgba(155, 89, 182, 1)",
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "rgba(155, 89, 182, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
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
          callbacks: {
            label: (ctx) => `Revenue: KES ${(ctx.raw || 0).toLocaleString()}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: {
            callback: (v) => "KES " + (v >= 1000 ? v / 1000 + "k" : v),
          },
        },
      },
    },
  });
}

// Money Flow: Multiple line graph (Money In, Commission, Host Payout over months)
function createMoneyFlowChart(data) {
  const canvas = document.getElementById("moneyFlowChart");
  if (!canvas) return;

  if (moneyFlowChart) moneyFlowChart.destroy();

  const monthly = data.monthly_breakdown || [];
  const labels = monthly.map((m) => m.label);
  const revenueData = monthly.map((m) => m.revenue || 0);
  const commissionData = monthly.map((m) => (m.revenue || 0) * 0.15);
  const hostPayoutData = monthly.map((m) => (m.revenue || 0) * 0.85);

  const ctx = canvas.getContext("2d");

  moneyFlowChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Money In",
          data: revenueData,
          borderColor: "rgba(52, 211, 153, 1)",
          backgroundColor: "rgba(52, 211, 153, 0.1)",
          fill: false,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Commission",
          data: commissionData,
          borderColor: "rgba(251, 191, 36, 1)",
          backgroundColor: "rgba(251, 191, 36, 0.1)",
          fill: false,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Host Payout",
          data: hostPayoutData,
          borderColor: "rgba(96, 165, 250, 1)",
          backgroundColor: "rgba(96, 165, 250, 0.1)",
          fill: false,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
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
          labels: { usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: KES ${(ctx.raw || 0).toLocaleString()}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: {
            callback: (v) => "KES " + (v >= 1000 ? v / 1000 + "k" : v),
          },
        },
      },
    },
  });
}

// Paid Bookings Over Time: Line chart of booking count per month
function createPaidBookingsChart(data) {
  const canvas = document.getElementById("paidBookingsChart");
  if (!canvas) return;

  if (paidBookingsChart) paidBookingsChart.destroy();

  const monthly = data.monthly_breakdown || [];
  const labels = monthly.map((m) => m.label);
  const counts = monthly.map((m) => m.booking_count || 0);

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(52, 211, 153, 0.4)");
  gradient.addColorStop(1, "rgba(52, 211, 153, 0.02)");

  paidBookingsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Bookings",
          data: counts,
          fill: true,
          backgroundColor: gradient,
          borderColor: "rgba(52, 211, 153, 1)",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "rgba(52, 211, 153, 1)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw || 0} bookings`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          beginAtZero: true,
          stepSize: 1,
          grid: { color: "rgba(0,0,0,0.06)" },
        },
      },
    },
  });
}

// Revenue Composition: Stacked area chart (Commission + Host Payout per month)
function createRevenueCompositionChart(data) {
  const canvas = document.getElementById("revenueCompositionChart");
  if (!canvas) return;

  if (revenueCompositionChart) revenueCompositionChart.destroy();

  const monthly = data.monthly_breakdown || [];
  const labels = monthly.map((m) => m.label);
  const commissionData = monthly.map((m) => (m.revenue || 0) * 0.15);
  const hostPayoutData = monthly.map((m) => (m.revenue || 0) * 0.85);

  const ctx = canvas.getContext("2d");

  revenueCompositionChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Commission",
          data: commissionData,
          fill: true,
          stack: "stack1",
          backgroundColor: "rgba(251, 191, 36, 0.5)",
          borderColor: "rgba(251, 191, 36, 1)",
          borderWidth: 1.5,
          tension: 0.35,
          pointRadius: 2,
        },
        {
          label: "Host Payout",
          data: hostPayoutData,
          fill: true,
          stack: "stack1",
          backgroundColor: "rgba(96, 165, 250, 0.5)",
          borderColor: "rgba(96, 165, 250, 1)",
          borderWidth: 1.5,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: KES ${(ctx.raw || 0).toLocaleString()}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: { callback: (v) => (v >= 1000 ? v / 1000 + "k" : v) },
        },
      },
    },
  });
}
