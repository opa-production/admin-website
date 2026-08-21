// js/core/skeletons.js — shared loading-skeleton builders.
// Classic script: top-level functions are global by design.
//
// Every skeleton mirrors the real layout of the thing it stands in for — the
// table skeletons reuse the page's own <table> markup and column headers, so
// the placeholder occupies exactly the space the loaded content will.
//
// The highlight sweep lives on the .skeleton wrapper, not on each block, so a
// card shimmers as one surface instead of every block pulsing independently.

// One flat grey block. `width` accepts any CSS length/percentage.
function skLine(width, height) {
  const style = [
    width ? `width: ${width}` : "",
    height ? `height: ${height}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  return `<span class="sk-line"${style ? ` style="${style}"` : ""}></span>`;
}

// Varied but fixed widths, so rows look natural without reshuffling on every
// re-render the way Math.random() would.
const SK_CELL_WIDTHS = [
  ["72%", "84%", "56%", "48%", "38%", "64%", "58%"],
  ["58%", "76%", "62%", "54%", "44%", "52%", "58%"],
  ["80%", "68%", "50%", "60%", "36%", "70%", "58%"],
  ["64%", "88%", "58%", "46%", "42%", "58%", "58%"],
  ["76%", "72%", "54%", "56%", "40%", "66%", "58%"],
];

// A table skeleton that reuses the page's own headers, so the column widths
// and paddings match the loaded table exactly.
function skTable(headers, rowCount = 8) {
  const head = headers.map((h) => `<th>${h}</th>`).join("");
  let rows = "";
  for (let r = 0; r < rowCount; r++) {
    const widths = SK_CELL_WIDTHS[r % SK_CELL_WIDTHS.length];
    const cells = headers
      .map((_, c) => `<td>${skLine(widths[c % widths.length])}</td>`)
      .join("");
    rows += `<tr>${cells}</tr>`;
  }
  return `
    <div class="table-container skeleton" aria-hidden="true">
        <table class="sk-table">
            <thead><tr>${head}</tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

// Stat tiles for the overview and revenue grids.
function skStatCards(count = 4) {
  const card = `
    <div class="sk-stat-card skeleton" aria-hidden="true">
        ${skLine("58%", "10px")}
        ${skLine("42%", "22px")}
        ${skLine("76%", "9px")}
    </div>`;
  return card.repeat(count);
}

// Chart placeholder: one flat plot area, sized by the card it sits in. The
// card's real heading stays visible — only the data region is stood in for.
function skChartBody() {
  return `<div class="sk-chart skeleton" aria-hidden="true"><span class="sk-plot"></span></div>`;
}

// Swap every chart canvas inside `root` for a plot placeholder.
function skShowCharts(root) {
  document.querySelectorAll(`${root} .graph-container`).forEach((container) => {
    if (container.querySelector(".sk-chart")) return;
    container.classList.add("is-loading");
    container.setAttribute("aria-busy", "true");
    container.insertAdjacentHTML("beforeend", skChartBody());
  });
}

function skHideCharts(root) {
  document.querySelectorAll(`${root} .graph-container`).forEach((container) => {
    container.classList.remove("is-loading");
    container.removeAttribute("aria-busy");
    container.querySelector(".sk-chart")?.remove();
  });
}

// Support inbox rows: square avatar, name + preview lines, badge.
function skConversationRows(count = 7) {
  let rows = "";
  const nameWidths = ["58%", "44%", "66%", "50%", "60%", "40%", "54%"];
  const previewWidths = ["84%", "72%", "90%", "64%", "78%", "86%", "70%"];
  for (let i = 0; i < count; i++) {
    rows += `
        <div class="sk-conv-row skeleton" aria-hidden="true">
            <span class="sk-conv-avatar"></span>
            <div class="sk-conv-body">
                <div class="sk-conv-top">
                    ${skLine(nameWidths[i % nameWidths.length], "11px")}
                    ${skLine("34px", "9px")}
                </div>
                ${skLine(previewWidths[i % previewWidths.length], "9px")}
            </div>
        </div>`;
  }
  return rows;
}

// Chat transcript: bubbles alternating sides, mirroring .support-msg-row.
function skMessageBubbles(count = 5) {
  const shapes = [
    { side: "host", w: "46%", h: "44px" },
    { side: "admin", w: "38%", h: "32px" },
    { side: "host", w: "54%", h: "56px" },
    { side: "admin", w: "44%", h: "40px" },
    { side: "host", w: "34%", h: "32px" },
  ];
  let out = "";
  for (let i = 0; i < count; i++) {
    const s = shapes[i % shapes.length];
    out += `
        <div class="sk-msg-row sk-msg-${s.side} skeleton" aria-hidden="true">
            <span class="sk-msg-avatar"></span>
            <span class="sk-msg-bubble" style="width: ${s.w}; height: ${s.h};"></span>
        </div>`;
  }
  return out;
}
