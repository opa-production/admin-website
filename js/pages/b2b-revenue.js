// js/pages/b2b-revenue.js — what Ardena earns from Ardena for Business subscriptions.
// Classic script (not a module): top-level functions and vars are global by design.
//
// One request (GET /admin/b2b/revenue) drives the whole page:
//   - four tiles: all-time, this month, run rate, paying workspaces
//   - one chart: plan payments collected per month
//   - a plan mix line, the per-workspace table and the latest payments
//
// Every amount is what a wallet was actually charged (after Ardena app
// commission was credited), so the tiles and the chart reconcile with the
// payments table. The run rate is the exception and says so: it is list price.
// Reuses revFmt / revShort / revTooltip / REV_COLORS from revenue.js.

let b2bRevenueChart = null;
let b2bRevenueTab = "workspaces";
let b2bRevenueData = null;

const B2B_PLAN_SOURCE = {
  paid: { label: "Fleet", cls: "active" },
  custom: { label: "Enterprise", cls: "active" },
  trial: { label: "Free period", cls: "pending" },
  free: { label: "Starter", cls: "inactive" },
};

function showB2BRevenueSkeleton() {
  const statsGrid = document.getElementById("b2bRevenueStatsGrid");
  if (statsGrid) {
    statsGrid.setAttribute("aria-busy", "true");
    statsGrid.innerHTML = skStatCards(4);
  }
  skShowCharts("#b2bRevenuePage");
  const content = document.getElementById("b2bRevenueContent");
  if (content) {
    content.innerHTML = skTable(["Business", "Plan", "Cars", "Fleet price", "Paid", "Last payment"], 6);
  }
}

function hideB2BRevenueSkeleton() {
  document.getElementById("b2bRevenueStatsGrid")?.removeAttribute("aria-busy");
  skHideCharts("#b2bRevenuePage");
}

async function loadB2BRevenue() {
  const statsGrid = document.getElementById("b2bRevenueStatsGrid");
  if (!statsGrid) return;

  showB2BRevenueSkeleton();

  try {
    const data = await api.getB2BRevenue({ months: 12, payments_limit: 100 });
    b2bRevenueData = data;
    const t = data.totals || {};
    const subs = data.subscribers || {};

    statsGrid.innerHTML = `
            <div class="stat-card stat-card--revenue">
                <div class="stat-label">Subscription Revenue</div>
                <div class="stat-value">${revFmt(t.all_time)}</div>
                <div class="stat-subvalue">${(t.payments || 0).toLocaleString()} plan payment${t.payments === 1 ? "" : "s"}, all time</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">This Month</div>
                <div class="stat-value">${revFmt(t.this_month)}</div>
                <div class="stat-subvalue">Last month ${revFmt(t.last_month)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Monthly Run Rate</div>
                <div class="stat-value">${revFmt(data.mrr)}</div>
                <div class="stat-subvalue">Paid Fleet workspaces at list price</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Paying Workspaces</div>
                <div class="stat-value">${(subs.fleet_paid || 0).toLocaleString()}</div>
                <div class="stat-subvalue">of ${(subs.active_workspaces || 0).toLocaleString()} active · ${(t.paying_businesses || 0).toLocaleString()} have ever paid</div>
            </div>
        `;

    const mix = document.getElementById("b2bRevenuePlanMix");
    if (mix) {
      mix.innerHTML = [
        ["Fleet (paid)", subs.fleet_paid],
        ["Enterprise", subs.enterprise],
        ["Free period", subs.free_period],
        ["Starter", subs.starter],
      ]
        .map(
          ([label, n]) =>
            `<span style="margin-right: 18px;"><strong>${(n || 0).toLocaleString()}</strong> ${label}</span>`,
        )
        .join("");
    }

    hideB2BRevenueSkeleton();
    createB2BRevenueChart(data);
    switchB2BRevenueTab(b2bRevenueTab);
  } catch (error) {
    console.error("Error loading B2B revenue:", error);
    hideB2BRevenueSkeleton();
    statsGrid.innerHTML = `<div class="empty-state">Error loading B2B revenue: ${escapeHtml(error.message)}</div>`;
    const content = document.getElementById("b2bRevenueContent");
    if (content) content.innerHTML = "";
  }
}

// Plan payments collected per month. One series, so no legend: the card's
// heading names it.
function createB2BRevenueChart(data) {
  const canvas = document.getElementById("b2bRevenueChart");
  if (!canvas) return;
  if (b2bRevenueChart) b2bRevenueChart.destroy();

  const ctx = canvas.getContext("2d");
  const monthly = data.monthly || [];

  b2bRevenueChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: monthly.map((m) => m.label),
      datasets: [
        {
          label: "Subscription revenue",
          data: monthly.map((m) => m.amount || 0),
          backgroundColor: REV_COLORS.commission,
          borderRadius: 6,
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
            label: (c) => `Collected: ${revFmt(c.raw)}`,
            afterLabel: (c) => {
              const m = monthly[c.dataIndex] || {};
              return `${m.payments || 0} payment${m.payments === 1 ? "" : "s"} from ${m.businesses || 0} workspace${m.businesses === 1 ? "" : "s"}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: chartAxisColor(), font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: chartGridColor() },
          border: { display: false },
          ticks: {
            color: chartAxisColor(),
            font: { size: 11 },
            maxTicksLimit: 5,
            callback: (v) => "KES " + revShort(v),
          },
        },
      },
    },
  });
}

function switchB2BRevenueTab(tab) {
  b2bRevenueTab = tab;
  document
    .getElementById("b2bRevenueWorkspacesTab")
    ?.classList.toggle("active", tab === "workspaces");
  document
    .getElementById("b2bRevenuePaymentsTab")
    ?.classList.toggle("active", tab === "payments");
  if (!b2bRevenueData) return;
  if (tab === "payments") renderB2BRevenuePayments(b2bRevenueData.recent_payments || []);
  else renderB2BRevenueWorkspaces(b2bRevenueData.businesses || []);
}

function b2bPlanBadge(row) {
  const meta = B2B_PLAN_SOURCE[row.source] || B2B_PLAN_SOURCE.free;
  return `<span class="status-badge ${meta.cls}">${meta.label}</span>`;
}

function b2bPlanUntil(row) {
  if (row.source === "paid") {
    return `Paid to ${fmtDate(row.until)}${row.auto_renew ? ", renews" : ", not renewing"}`;
  }
  if (row.source === "trial") return `Free to ${fmtDate(row.until)}`;
  if (row.source === "custom") return row.until ? `To ${fmtDate(row.until)}` : "Open-ended";
  return "Lapsed or never upgraded";
}

function renderB2BRevenueWorkspaces(rows) {
  const content = document.getElementById("b2bRevenueContent");
  if (!content) return;
  if (!rows.length) {
    content.innerHTML =
      '<div class="empty-state">No workspace has paid for a plan yet. Workspaces on Fleet, Enterprise or a free period will show here.</div>';
    return;
  }
  content.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Business</th>
                        <th>Plan</th>
                        <th>Cars</th>
                        <th>Fleet price / month</th>
                        <th>Paid to date</th>
                        <th>Last payment</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows
                      .map(
                        (r) => `
                        <tr>
                            <td>${escapeHtml(r.name)}${r.is_active ? "" : ' <span class="status-badge inactive">Suspended</span>'}</td>
                            <td>${b2bPlanBadge(r)}<div style="font-size: 12px; color: #888; margin-top: 4px;">${b2bPlanUntil(r)}</div></td>
                            <td>${(r.cars || 0).toLocaleString()}</td>
                            <td>${revFmt(r.monthly_fee)}</td>
                            <td><strong>${revFmt(r.total_paid)}</strong><div style="font-size: 12px; color: #888; margin-top: 4px;">${r.payments || 0} payment${r.payments === 1 ? "" : "s"}</div></td>
                            <td>${r.last_paid_at ? fmtDate(r.last_paid_at) : "Never"}</td>
                        </tr>`,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>`;
}

function renderB2BRevenuePayments(rows) {
  const content = document.getElementById("b2bRevenueContent");
  if (!content) return;
  if (!rows.length) {
    content.innerHTML = '<div class="empty-state">No plan payments yet.</div>';
    return;
  }
  content.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Paid</th>
                        <th>Business</th>
                        <th>For</th>
                        <th>Amount</th>
                        <th>Receipt</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows
                      .map(
                        (p) => `
                        <tr>
                            <td>${fmtDateTime(p.paid_at)}</td>
                            <td>${escapeHtml(p.business_name)}</td>
                            <td>${escapeHtml(p.title)}${p.detail ? `<div style="font-size: 12px; color: #888; margin-top: 4px;">${escapeHtml(p.detail)}</div>` : ""}</td>
                            <td><strong>${revFmt(p.amount)}</strong></td>
                            <td>${escapeHtml(p.ref)}</td>
                        </tr>`,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>`;
}
