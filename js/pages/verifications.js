// js/pages/verifications.js — the Verifications overview.
//
// Everything the dashboard knows about who and what has been vetted, in one
// place: KPI tiles across the top, a stepped running total, per-day bars, the
// listing-decision meter, and the live queue of cars awaiting a decision.
//
// The chart styling deliberately diverges from the overview page — stepped
// lines and thin vertical bars rather than that page's smooth gradient areas —
// so the two don't read as the same screen twice.
//
// Classic script (not a module): top-level functions are global by design.

let verificationRange = 30; // days shown in the trend charts
let verCumulativeChart = null;
let verDailyChart = null;

const VERIFICATION_RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All time" },
];

// ---------------------------------------------------------------------------
// Data shaping
// ---------------------------------------------------------------------------

// The trend endpoint returns the full history; the range control trims it
// client-side rather than round-tripping for every toggle.
function trimSeries(series, days) {
  if (!days || series.labels.length <= days) return series;
  const cut = series.labels.length - days;
  return {
    labels: series.labels.slice(cut),
    verified_series: series.verified_series.slice(cut),
    pending_series: series.pending_series.slice(cut),
    verified_now: series.verified_now,
    pending_now: series.pending_now,
  };
}

// The endpoint returns running totals; the per-day chart wants the increments.
// A negative step (a record being revoked) is floored at zero rather than drawn
// as a negative bar.
function dailyFromCumulative(values) {
  return values.map((v, i) => (i === 0 ? 0 : Math.max(0, v - values[i - 1])));
}

// Change across the visible window, so a KPI can say "+12 this period".
function seriesDelta(series) {
  const values = series.verified_series;
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

function verDeltaHtml(delta, suffix) {
  if (!delta) {
    return `<div class="ver-kpi-delta is-flat">No change ${escapeHtml(suffix)}</div>`;
  }
  const up = delta > 0;
  const arrow = up ? "&uarr;" : "&darr;";
  return `<div class="ver-kpi-delta ${up ? "is-up" : "is-down"}">${arrow} ${Math.abs(delta)} ${escapeHtml(suffix)}</div>`;
}

function verPct(part, whole) {
  if (!whole) return "0%";
  return Math.round((part / whole) * 100) + "%";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

async function loadVerifications() {
  const content = document.getElementById("verificationsContent");
  if (!content) return;

  content.innerHTML = '<div class="loading">Loading verifications...</div>';

  try {
    const [stats, kyc, queue] = await Promise.all([
      api.getDashboardStats(),
      api.getKycTrends().catch(() => ({ hosts: [], clients: [] })),
      api.getCars({ status: "awaiting", limit: 8 }).catch(() => ({ cars: [] })),
    ]);

    const hosts = normalizeKycSeries(kyc.hosts);
    const clients = normalizeKycSeries(kyc.clients);

    content.innerHTML = renderVerificationsPage(stats, hosts, clients, queue);
    wireVerificationRange();
    drawVerificationCharts(stats, hosts, clients);
  } catch (error) {
    console.error("Error loading verifications:", error);
    content.innerHTML = `<div class="empty-state">Error loading verifications: ${escapeHtml(error.message || "")}</div>`;
  }
}

function renderVerificationsPage(stats, hosts, clients, queue) {
  const awaiting = stats.cars_awaiting_verification || 0;
  const verifiedCars = stats.verified_cars || 0;
  const rejectedCars = stats.rejected_cars || 0;
  const decided = verifiedCars + rejectedCars;
  const suffix = verificationRange ? `in ${verificationRange} days` : "overall";

  return `
    <div class="ver-toolbar">
      <div class="ver-range" role="group" aria-label="Time range">
        ${VERIFICATION_RANGES.map(
          (r) => `
          <button type="button" class="ver-range-btn ${r.days === verificationRange ? "is-active" : ""}" data-days="${r.days}">
            ${r.label}
          </button>`,
        ).join("")}
      </div>
    </div>

    <div class="ver-kpis">
      <div class="ver-kpi">
        <div class="ver-kpi-label">Hosts verified</div>
        <div class="ver-kpi-value">${hosts.verified_now}</div>
        ${verDeltaHtml(seriesDelta(trimSeries(hosts, verificationRange)), suffix)}
        <div class="ver-kpi-foot">${hosts.pending_now} still pending KYC</div>
      </div>
      <div class="ver-kpi">
        <div class="ver-kpi-label">Clients verified</div>
        <div class="ver-kpi-value">${clients.verified_now}</div>
        ${verDeltaHtml(seriesDelta(trimSeries(clients, verificationRange)), suffix)}
        <div class="ver-kpi-foot">${clients.pending_now} still pending KYC</div>
      </div>
      <div class="ver-kpi ${awaiting > 0 ? "is-attention" : ""}">
        <div class="ver-kpi-label">Cars awaiting review</div>
        <div class="ver-kpi-value">${awaiting}</div>
        <div class="ver-kpi-foot">${verPct(awaiting, stats.total_cars || 0)} of all listings</div>
      </div>
      <div class="ver-kpi">
        <div class="ver-kpi-label">Approval rate</div>
        <div class="ver-kpi-value">${verPct(verifiedCars, decided)}</div>
        <div class="ver-kpi-foot">${verifiedCars} approved, ${rejectedCars} denied</div>
      </div>
    </div>

    <div class="ver-grid">
      <div class="ver-card ver-card-wide">
        <div class="ver-card-head">
          <div>
            <div class="ver-card-title">Verified accounts, running total</div>
            <div class="ver-card-value">${hosts.verified_now + clients.verified_now}</div>
          </div>
          <div class="ver-card-note">${hosts.verified_now} hosts &middot; ${clients.verified_now} clients</div>
        </div>
        <div class="ver-chart"><canvas id="verCumulativeChart"></canvas></div>
      </div>

      <div class="ver-card ver-card-wide">
        <div class="ver-card-head">
          <div>
            <div class="ver-card-title">New verifications per day</div>
            <div class="ver-card-value">${verDailyTotal(hosts, clients)}</div>
          </div>
          <div class="ver-card-note">${suffix}</div>
        </div>
        <div class="ver-chart"><canvas id="verDailyChart"></canvas></div>
      </div>

      <div class="ver-card">
        <div class="ver-card-head">
          <div>
            <div class="ver-card-title">Listing decisions</div>
            <div class="ver-card-value">${decided}</div>
          </div>
          <div class="ver-card-note">decided so far</div>
        </div>
        ${renderDecisionMeter(stats)}
      </div>

      <div class="ver-card">
        <div class="ver-card-head">
          <div>
            <div class="ver-card-title">Awaiting review</div>
            <div class="ver-card-value">${awaiting}</div>
          </div>
          <button type="button" class="ver-card-link" onclick="loadPage('cars')">View all</button>
        </div>
        ${renderVerificationQueue(queue)}
      </div>
    </div>
  `;
}

// Total new verifications across the visible window.
function verDailyTotal(hosts, clients) {
  const h = dailyFromCumulative(trimSeries(hosts, verificationRange).verified_series);
  const c = dailyFromCumulative(trimSeries(clients, verificationRange).verified_series);
  return h.concat(c).reduce((sum, n) => sum + n, 0);
}

// A plain segmented meter rather than a third chart — three numbers don't need
// a canvas, and it keeps this card visually quiet next to the two graphs.
function renderDecisionMeter(stats) {
  const rows = [
    { label: "Verified", value: stats.verified_cars || 0, tone: "ok" },
    { label: "Denied", value: stats.rejected_cars || 0, tone: "danger" },
    { label: "Awaiting", value: stats.cars_awaiting_verification || 0, tone: "warn" },
  ];
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  if (!total) {
    return '<div class="ver-queue-empty">No listings to report on yet.</div>';
  }

  return `
    <div class="ver-meter" role="img" aria-label="${rows.map((r) => r.value + " " + r.label.toLowerCase()).join(", ")}">
      ${rows
        .filter((r) => r.value > 0)
        .map(
          (r) =>
            `<span class="ver-meter-seg is-${r.tone}" style="flex-grow:${r.value};"></span>`,
        )
        .join("")}
    </div>
    <ul class="ver-legend">
      ${rows
        .map(
          (r) => `
        <li class="ver-legend-row">
          <span class="ver-legend-dot is-${r.tone}" aria-hidden="true"></span>
          <span class="ver-legend-label">${r.label}</span>
          <span class="ver-legend-value">${r.value}</span>
          <span class="ver-legend-pct">${verPct(r.value, total)}</span>
        </li>`,
        )
        .join("")}
    </ul>`;
}

function renderVerificationQueue(queue) {
  const cars = (queue && queue.cars) || [];
  if (!cars.length) {
    return '<div class="ver-queue-empty">Nothing waiting — the queue is clear.</div>';
  }
  return `
    <ul class="ver-queue">
      ${cars
        .map(
          (car) => `
        <li class="ver-queue-row">
          <div class="ver-queue-main">
            <div class="ver-queue-name">${escapeHtml(car.name || car.model || "Untitled listing")}</div>
            <div class="ver-queue-sub">${escapeHtml(car.host_name || "Unknown host")}${car.year ? " &middot; " + escapeHtml(String(car.year)) : ""}</div>
          </div>
          <button type="button" class="ver-queue-action" onclick="viewCarDetails(${car.id})">Review</button>
        </li>`,
        )
        .join("")}
    </ul>`;
}

function wireVerificationRange() {
  document.querySelectorAll(".ver-range-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const days = Number(btn.dataset.days);
      if (days === verificationRange) return;
      verificationRange = days;
      // Re-render rather than patch: the KPI deltas depend on the range too.
      loadVerifications();
    });
  });
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

// Deliberately not the dashboard's smooth gradient areas: a stepped line reads
// as "a count that changes in discrete jumps", which is what a verification
// total is, and gives this page its own silhouette.
function verStepChart(hosts, clients) {
  const canvas = document.getElementById("verCumulativeChart");
  if (!canvas || typeof Chart === "undefined") return null;

  const series = (data, colour) => ({
    data: data.verified_series,
    borderColor: colour,
    backgroundColor: "transparent",
    borderWidth: 2,
    stepped: "after",
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHoverBackgroundColor: colour,
  });

  return new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: hosts.labels,
      datasets: [
        Object.assign({ label: "Hosts" }, series(hosts, "#2563eb")),
        Object.assign({ label: "Clients" }, series(clients, "#7c3aed")),
      ],
    },
    options: verChartOptions({ yTitle: null }),
  });
}

// Thin vertical bars for the daily increments — the dashboard has no chart of
// this shape (its only bar is a single horizontal stacked one).
function verDailyChartBuild(hosts, clients) {
  const canvas = document.getElementById("verDailyChart");
  if (!canvas || typeof Chart === "undefined") return null;

  return new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: hosts.labels,
      datasets: [
        {
          label: "Hosts",
          data: dailyFromCumulative(hosts.verified_series),
          backgroundColor: "#2563eb",
          borderWidth: 0,
          maxBarThickness: 10,
        },
        {
          label: "Clients",
          data: dailyFromCumulative(clients.verified_series),
          backgroundColor: "#7c3aed",
          borderWidth: 0,
          maxBarThickness: 10,
        },
      ],
    },
    options: verChartOptions({ stacked: true }),
  });
}

// Shared axis/legend treatment: no vertical grid, a hairline horizontal one,
// legend at the top-left rather than centred underneath.
function verChartOptions(opts) {
  const o = opts || {};
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: {
        position: "top",
        align: "start",
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          padding: 16,
          usePointStyle: true,
          font: { size: 11 },
          color: chartAxisColor(),
        },
      },
      tooltip: {
        padding: 10,
        backgroundColor: "rgba(17, 24, 39, 0.92)",
        titleFont: { size: 12, weight: "600" },
        bodyFont: { size: 12 },
        cornerRadius: 6,
      },
    },
    scales: {
      x: {
        stacked: Boolean(o.stacked),
        grid: { display: false, drawBorder: false },
        ticks: {
          font: { size: 10 },
          color: chartAxisColor(),
          maxTicksLimit: 8,
          autoSkip: true,
        },
      },
      y: {
        stacked: Boolean(o.stacked),
        beginAtZero: true,
        border: { display: false },
        grid: { color: chartGridColor(), drawBorder: false },
        ticks: { font: { size: 10 }, color: chartAxisColor(), precision: 0 },
      },
    },
  };
}

function drawVerificationCharts(stats, hosts, clients) {
  if (verCumulativeChart) verCumulativeChart.destroy();
  if (verDailyChart) verDailyChart.destroy();

  const h = trimSeries(hosts, verificationRange);
  const c = trimSeries(clients, verificationRange);

  verCumulativeChart = verStepChart(h, c);
  verDailyChart = verDailyChartBuild(h, c);
}
