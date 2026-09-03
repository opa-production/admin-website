// js/pages/b2b-support.js — the admin side of the Ardena-for-Business support
// thread (support.md §2). Classic script (not a module): top-level functions and
// vars are global by design.
//
// This is NOT the consumer/host inbox in support.js. `b2b_support_messages` has
// no conversation row, so there is no status, assignee, close or reopen — one
// flat thread per business, addressed by business_id, and "who is waiting" is
// the only open/closed signal the table can express (`awaiting_reply`).

const B2B_SUPPORT_PAGE_SIZE = 20;

let b2bSupportSkip = 0;
let b2bSupportBusinessId = null; // business whose thread is open in the right pane
let b2bSupportThread = null; // last loaded thread payload (for the business card)
let b2bSupportSearchInitialized = false;

// Wire the left-pane search and filters (guards against duplicate listeners,
// since initB2BSupportPage runs on every navigation to the page).
function setupB2BSupportFilters() {
  if (b2bSupportSearchInitialized) return;
  b2bSupportSearchInitialized = true;

  const search = document.getElementById("b2bSupportSearch");
  const awaiting = document.getElementById("b2bSupportAwaitingFilter");
  const sort = document.getElementById("b2bSupportSortFilter");
  const businessId = document.getElementById("b2bSupportBusinessIdFilter");

  let searchTimeout;
  const rerun = () => {
    b2bSupportSkip = 0;
    loadB2BSupportThreads();
  };
  const debounced = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(rerun, 400);
  };

  if (search) search.addEventListener("input", debounced);
  if (businessId) businessId.addEventListener("input", debounced);
  if (awaiting) awaiting.addEventListener("change", rerun);
  if (sort) sort.addEventListener("change", rerun);

  // Auto-grow the reply box, capped so the transcript keeps most of the pane.
  const replyTextarea = document.getElementById("b2bSupportReplyMessage");
  if (replyTextarea) {
    replyTextarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });
  }
}

function initB2BSupportPage() {
  setupB2BSupportFilters();
  loadB2BSupportThreads();
  // An open thread survives navigating away and back.
  if (b2bSupportBusinessId != null) {
    viewB2BSupportThread(b2bSupportBusinessId);
  }
}

function refreshB2BSupport() {
  loadB2BSupportThreads();
  if (b2bSupportBusinessId != null) {
    viewB2BSupportThread(b2bSupportBusinessId);
  }
}

// ---------------------------------------------------------------------------
// Left pane: the inbox
// ---------------------------------------------------------------------------

async function loadB2BSupportThreads() {
  const content = document.getElementById("b2bSupportContent");
  const pillEl = document.getElementById("b2bSupportUnansweredPill");
  if (!content) return;

  // Replying changes the backlog, so keep the sidebar badge honest.
  if (typeof refreshNavBadges === "function") refreshNavBadges();

  content.innerHTML = skConversationRows(7);

  try {
    const search = document.getElementById("b2bSupportSearch")?.value.trim();
    const awaiting = document.getElementById(
      "b2bSupportAwaitingFilter",
    )?.value;
    const businessId = document.getElementById(
      "b2bSupportBusinessIdFilter",
    )?.value;
    const sortValue =
      document.getElementById("b2bSupportSortFilter")?.value ||
      "last_message_at:desc";
    const [sortBy, order] = sortValue.split(":");

    const params = {
      skip: b2bSupportSkip,
      limit: B2B_SUPPORT_PAGE_SIZE,
      sort_by: sortBy,
      order: order,
    };
    if (search) params.search = search;
    if (awaiting) params.unanswered_only = true;
    if (businessId) params.business_id = parseInt(businessId, 10);

    const response = await api.getB2BSupportThreads(params);

    // The pill is the WHOLE backlog, not this filter's count — the same number
    // the nav badge shows. A filtered view disagreeing with the nav reads as a
    // bug (support.md §2).
    if (pillEl) {
      const unanswered = response.unanswered_count || 0;
      if (unanswered > 0) {
        pillEl.textContent = `${unanswered} awaiting reply`;
        pillEl.style.display = "inline-block";
      } else {
        pillEl.style.display = "none";
      }
    }

    const threads = response.threads || [];
    if (threads.length === 0) {
      content.innerHTML =
        '<div class="empty-state">No business has messaged support yet</div>';
      renderB2BSupportPagination(response);
      return;
    }

    let html = '<div class="support-conv-list">';
    threads.forEach((t) => {
      const name = t.business_name || `Business #${t.business_id}`;
      const isActive = b2bSupportBusinessId === t.business_id;
      const rowClasses = [
        "support-conv-row",
        t.awaiting_reply ? "unread" : "",
        isActive ? "active" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const sender = t.last_message_from === "support" ? "You" : "Them";
      const previewText = t.last_message_preview || "";
      const preview = previewText
        ? `<strong>${sender}:</strong> ${escapeHtml(previewText.substring(0, 85))}${previewText.length > 85 ? "…" : ""}`
        : '<span style="font-style:italic;color:#b0b8c9;">No messages yet</span>';

      html += `
                <div onclick="viewB2BSupportThread(${t.business_id})" class="${rowClasses}" data-business-id="${t.business_id}">
                    ${b2bSupportAvatarHtml(name, t.logo_url, "support-conv-avatar")}
                    <div class="support-conv-body">
                        <div class="support-conv-top">
                            <span class="support-conv-name">${escapeHtml(name)}</span>
                            <span class="support-conv-time">${formatRelativeTime(t.last_message_at)}</span>
                        </div>
                        <div class="support-conv-preview">${preview}</div>
                        <div class="b2bsup-row-meta">${t.message_count || 0} message${t.message_count === 1 ? "" : "s"}</div>
                    </div>
                    <div class="support-conv-badges">
                        ${t.awaiting_reply ? '<span class="badge-unread">Waiting</span>' : '<span class="badge-status-closed">Answered</span>'}
                        ${t.has_handoff ? '<span class="badge-handoff" title="Escalated by the Ardena assistant">AI</span>' : ""}
                    </div>
                </div>
            `;
    });
    html += "</div>";
    content.innerHTML = html;

    renderB2BSupportPagination(response);
  } catch (error) {
    console.error("Error loading B2B support threads:", error);
    content.innerHTML = `<div class="error">Error loading threads: ${escapeHtml(error.message)}</div>`;
    document.getElementById("b2bSupportPagination").innerHTML = "";
  }
}

// A business has a logo more often than a person has an avatar, so prefer it
// and fall back to initials.
function b2bSupportAvatarHtml(name, logoUrl, className) {
  const initials = `<div class="${className}" style="background:${getAvatarColor(name)};">${escapeHtml(getInitials(name))}</div>`;
  if (logoUrl) {
    // A logo that 404s falls back to initials rather than a broken-image icon.
    return `<img src="${escapeHtmlAttr(logoUrl)}" alt="" class="${className} b2bsup-avatar-img" onerror="b2bSupportAvatarFallback(this)" data-fallback="${escapeHtmlAttr(initials)}">`;
  }
  return initials;
}

function b2bSupportAvatarFallback(img) {
  img.onerror = null;
  img.outerHTML = img.dataset.fallback || "";
}

// skip/limit paging (matching the rest of /admin/b2b/*), rendered as pages.
function renderB2BSupportPagination(response) {
  const el = document.getElementById("b2bSupportPagination");
  if (!el) return;

  const limit = response.limit || B2B_SUPPORT_PAGE_SIZE;
  const total = response.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  const currentPage = Math.floor((response.skip || 0) / limit) + 1;
  el.innerHTML =
    `<button class="btn btn-secondary" ${currentPage === 1 ? "disabled" : ""} onclick="changeB2BSupportPage(${currentPage - 1})">← Previous</button>` +
    `<span class="support-page-info">Page ${currentPage} of ${totalPages} &nbsp;·&nbsp; ${total} total</span>` +
    `<button class="btn btn-secondary" ${currentPage >= totalPages ? "disabled" : ""} onclick="changeB2BSupportPage(${currentPage + 1})">Next →</button>`;
}

function changeB2BSupportPage(page) {
  b2bSupportSkip = Math.max(0, (page - 1) * B2B_SUPPORT_PAGE_SIZE);
  loadB2BSupportThreads();
}

// ---------------------------------------------------------------------------
// Right pane: one business's thread
// ---------------------------------------------------------------------------

async function viewB2BSupportThread(businessId) {
  b2bSupportBusinessId = businessId;

  const inbox = document.getElementById("b2bSupportInbox");
  const emptyState = document.getElementById("b2bSupportEmptyState");
  const pane = document.getElementById("b2bSupportThreadPane");
  if (inbox) inbox.classList.add("conversation-open");
  if (emptyState) emptyState.style.display = "none";
  if (pane) pane.style.display = "flex";

  document.querySelectorAll("#b2bSupportContent .support-conv-row").forEach(
    (row) => {
      row.classList.toggle(
        "active",
        Number(row.dataset.businessId) === businessId,
      );
    },
  );

  const infoEl = document.getElementById("b2bSupportThreadInfo");
  const messagesEl = document.getElementById("b2bSupportMessages");
  const toggleBtn = document.getElementById("b2bSupportBusinessToggleBtn");

  infoEl.innerHTML =
    '<div class="sk-conv-row skeleton" aria-hidden="true">' +
    '<span class="sk-conv-avatar"></span>' +
    '<div class="sk-conv-body"><span class="sk-line" style="width: 40%"></span>' +
    '<span class="sk-line" style="width: 26%; height: 9px"></span></div></div>';
  messagesEl.innerHTML = skMessageBubbles(5);

  try {
    const thread = await api.getB2BSupportThread(businessId);
    b2bSupportThread = thread;

    const business = thread.business || {};
    const name = business.name || `Business #${businessId}`;

    infoEl.innerHTML = `
            ${b2bSupportAvatarHtml(name, business.logo_url, "support-chat-host-avatar")}
            <div class="support-chat-host-details">
                <div class="support-chat-host-name">${escapeHtml(name)}</div>
                <div class="support-chat-host-sub">
                    <span>${escapeHtml(business.email || business.owner_email || "")}</span>
                    <span class="dot">·</span>
                    <span>Business ID: ${business.id != null ? business.id : businessId}</span>
                    <span class="dot">·</span>
                    ${
                      business.is_active === false
                        ? '<span class="badge-status-closed">Inactive</span>'
                        : '<span class="badge-status-open">Active</span>'
                    }
                    ${thread.awaiting_reply ? '<span class="dot">·</span><span class="badge-unread">Waiting</span>' : ""}
                </div>
            </div>
        `;

    if (toggleBtn) toggleBtn.style.display = "flex";
    renderB2BSupportBusinessCard(business);

    const messages = thread.messages || [];
    if (messages.length === 0) {
      // An empty thread is a 200, not a 404 — an admin may be opening it to
      // start the conversation (support.md §2).
      messagesEl.innerHTML =
        '<div class="empty-state">No messages yet — send the first one below.</div>';
      return;
    }

    let html = "";
    let lastDateLabel = "";
    messages.forEach((msg) => {
      const at = msg.at || msg.created_at;
      const isBusiness = msg.from !== "support";
      const handoff = isB2BSupportHandoff(msg);
      const senderName =
        msg.sender_name || (isBusiness ? name : "Ardena Support");

      const dateLabel = formatDateLabel(at);
      if (dateLabel && dateLabel !== lastDateLabel) {
        lastDateLabel = dateLabel;
        html += `<div class="support-day-divider">${escapeHtml(dateLabel)}</div>`;
      }

      // A handoff is the assistant writing on the business's behalf, not a
      // person typing — say so rather than letting it read as staff.
      const avatar = handoff
        ? '<div class="support-msg-avatar-sm b2bsup-ai-avatar" title="Ardena assistant">AI</div>'
        : isBusiness
          ? `<div class="support-msg-avatar-sm" style="background:${getAvatarColor(name)};">${escapeHtml(getInitials(senderName))}</div>`
          : '<div class="support-msg-avatar-sm" style="background:#007ffa;">A</div>';

      const readMark =
        !isBusiness && msg.read === false
          ? '<span class="b2bsup-unread-dot" title="Not yet read by the business">Unread</span>'
          : "";

      html += `
                <div class="support-msg-row ${isBusiness ? "host-row" : "admin-row"}">
                    ${isBusiness ? avatar : ""}
                    <div class="support-msg-bubble-wrap">
                        <div class="support-msg-sender">${escapeHtml(senderName)}${handoff ? ' <span class="b2bsup-handoff-tag">handoff</span>' : ""}</div>
                        <div class="support-msg-bubble ${isBusiness ? "host-bubble" : "admin-bubble"}${handoff ? " b2bsup-handoff-bubble" : ""}">${escapeHtml(msg.text || "").replace(/\n/g, "<br>")}</div>
                        <div class="support-msg-time">${formatDateTime(at)}${readMark}</div>
                    </div>
                    ${!isBusiness ? avatar : ""}
                </div>
            `;
    });

    messagesEl.innerHTML = html;
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  } catch (error) {
    console.error("Error loading B2B support thread:", error);
    infoEl.innerHTML = `<div class="error">Error loading thread: ${escapeHtml(error.message)}</div>`;
    messagesEl.innerHTML = "";
    if (toggleBtn) toggleBtn.style.display = "none";
  }
}

// The assistant escalation writes from_role="user" with a fixed sender name and
// text prefix (app/agent/b2b/escalation.py). Either signal is enough — the
// sender name is the reliable one, the prefix is the belt-and-braces.
const B2B_HANDOFF_SENDER_NAME = "Ardena assistant";
const B2B_HANDOFF_PREFIX = "[Assistant handoff]";

function isB2BSupportHandoff(msg) {
  return (
    msg.sender_name === B2B_HANDOFF_SENDER_NAME ||
    (msg.text || "").startsWith(B2B_HANDOFF_PREFIX)
  );
}

// Business header — so a billing question is answerable without leaving the
// page (support.md §2).
function renderB2BSupportBusinessCard(business) {
  const card = document.getElementById("b2bSupportBusinessCard");
  if (!card) return;

  const rows = [
    ["Owner", business.owner_email],
    ["Email", business.email],
    ["Phone", business.phone],
    ["Location", business.location],
    [
      "Wallet",
      business.wallet_balance != null ? fmtKes(business.wallet_balance) : null,
    ],
    [
      "Verified since",
      business.verified_since ? fmtDate(business.verified_since) : null,
    ],
  ];

  card.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="b2bsup-business-field">
            <span class="b2bsup-business-label">${label}</span>
            <span class="b2bsup-business-value">${value ? escapeHtml(String(value)) : "—"}</span>
        </div>`,
    )
    .join("");
}

function toggleB2BSupportBusinessCard() {
  const card = document.getElementById("b2bSupportBusinessCard");
  const btn = document.getElementById("b2bSupportBusinessToggleBtn");
  if (!card) return;
  const showing = card.style.display !== "none";
  card.style.display = showing ? "none" : "grid";
  if (btn) btn.classList.toggle("active", !showing);
}

// On mobile this collapses the right pane; on desktop it clears the selection
// and shows the empty state.
function backToB2BSupportList() {
  b2bSupportBusinessId = null;
  b2bSupportThread = null;
  const inbox = document.getElementById("b2bSupportInbox");
  const emptyState = document.getElementById("b2bSupportEmptyState");
  const pane = document.getElementById("b2bSupportThreadPane");
  if (inbox) inbox.classList.remove("conversation-open");
  if (pane) pane.style.display = "none";
  if (emptyState) emptyState.style.display = "flex";
  document
    .querySelectorAll("#b2bSupportContent .support-conv-row.active")
    .forEach((row) => row.classList.remove("active"));
}

// ---------------------------------------------------------------------------
// Replying
// ---------------------------------------------------------------------------

async function sendB2BSupportReply(event) {
  event.preventDefault();

  if (b2bSupportBusinessId == null) {
    uiToast("No business selected", "error");
    return;
  }

  const input = document.getElementById("b2bSupportReplyMessage");
  const text = input.value.trim();
  if (!text) return; // blank text is a 422 server-side; don't spend the round trip

  const submitBtn = document.getElementById("b2bSupportSendBtn");
  submitBtn.disabled = true;
  submitBtn.style.opacity = "0.5";

  try {
    await api.replyToB2BSupportThread(b2bSupportBusinessId, text);
    input.value = "";
    input.style.height = "auto";

    // The reply lands unread on their side, which is what raises their badge —
    // and it also drops this thread out of the awaiting-reply backlog, so both
    // panes need refetching.
    await viewB2BSupportThread(b2bSupportBusinessId);
    loadB2BSupportThreads();
  } catch (error) {
    console.error("Error sending B2B support reply:", error);
    uiToast("Error sending reply: " + error.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = "";
  }
}
