// js/pages/support.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


let currentSupportPage = 1;
let currentSupportConversationId = null;
let supportSearchInitialized = false;

// Setup support search and filters (guards against duplicate listeners)
function setupSupportSearch() {
  if (supportSearchInitialized) return;
  supportSearchInitialized = true;

  const searchInput = document.getElementById("supportSearch");
  const statusFilter = document.getElementById("supportStatusFilter");
  const hostIdFilter = document.getElementById("supportHostIdFilter");

  let searchTimeout;
  const performSearch = () => {
    currentSupportPage = 1;
    loadSupportConversations();
  };

  if (searchInput)
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(performSearch, 400);
    });
  if (statusFilter) statusFilter.addEventListener("change", performSearch);
  if (hostIdFilter)
    hostIdFilter.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(performSearch, 400);
    });
}

// Load support conversations
async function loadSupportConversations() {
  const content = document.getElementById("supportContent");
  const unreadCountEl = document.getElementById("unreadCount");

  if (!content) return;

  content.innerHTML = '<div class="loading">Loading conversations...</div>';

  try {
    const statusFilter =
      document.getElementById("supportStatusFilter")?.value || "";
    const hostIdFilter =
      document.getElementById("supportHostIdFilter")?.value || "";
    const search = document.getElementById("supportSearch")?.value || "";

    const params = {
      page: currentSupportPage,
      limit: 20,
    };

    if (statusFilter) params.status_filter = statusFilter;
    if (hostIdFilter) params.host_id = parseInt(hostIdFilter);
    if (search) params.search = search;

    const response = await api.getSupportConversations(params);

    // Update unread count pill
    if (unreadCountEl) {
      if (response.unread_count > 0) {
        unreadCountEl.textContent = `${response.unread_count} unread`;
        unreadCountEl.style.display = "inline-block";
      } else {
        unreadCountEl.style.display = "none";
      }
    }

    if (!response.conversations || response.conversations.length === 0) {
      content.innerHTML =
        '<div class="empty-state">No conversations found</div>';
      document.getElementById("supportPagination").innerHTML = "";
      return;
    }

    let html = '<div class="support-conv-list">';

    response.conversations.forEach((conv) => {
      const lastMessage =
        conv.messages && conv.messages.length > 0
          ? conv.messages[conv.messages.length - 1]
          : null;
      const hostName = conv.host_name || "Unknown Host";
      const initials = getInitials(hostName);
      const avatarColor = getAvatarColor(hostName);
      const isUnread = !conv.is_read_by_admin;

      const statusBadge =
        conv.status === "closed"
          ? '<span class="badge-status-closed">Closed</span>'
          : '<span class="badge-status-open">Open</span>';
      const unreadBadge = isUnread
        ? '<span class="badge-unread">New</span>'
        : "";

      let previewHtml =
        '<span style="font-style:italic;color:#b0b8c9;">No messages yet</span>';
      if (lastMessage) {
        const sender = lastMessage.sender_type === "host" ? "Host" : "You";
        const preview = escapeHtml(lastMessage.message.substring(0, 85));
        previewHtml = `<strong>${sender}:</strong> ${preview}${lastMessage.message.length > 85 ? "…" : ""}`;
      }

      const isActive = currentSupportConversationId === conv.id;
      const rowClasses = [
        "support-conv-row",
        isUnread ? "unread" : "",
        isActive ? "active" : "",
      ]
        .filter(Boolean)
        .join(" ");

      html += `
                <div onclick="viewSupportConversation(${conv.id})" class="${rowClasses}" data-conv-id="${conv.id}">
                    <div class="support-conv-avatar" style="background:${avatarColor};">${escapeHtml(initials)}</div>
                    <div class="support-conv-body">
                        <div class="support-conv-top">
                            <span class="support-conv-name">${escapeHtml(hostName)}</span>
                            <span class="support-conv-time">${formatRelativeTime(lastMessage ? lastMessage.created_at : conv.created_at)}</span>
                        </div>
                        <div class="support-conv-preview">${previewHtml}</div>
                    </div>
                    <div class="support-conv-badges">${unreadBadge}${statusBadge}</div>
                </div>
            `;
    });

    html += "</div>";
    content.innerHTML = html;

    // Pagination
    renderSupportPagination(response);
  } catch (error) {
    console.error("Error loading conversations:", error);
    content.innerHTML = `<div class="error">Error loading conversations: ${error.message}</div>`;
  }
}

// Render pagination for support conversations
function renderSupportPagination(response) {
  const paginationEl = document.getElementById("supportPagination");
  if (!paginationEl || response.total_pages <= 1) {
    if (paginationEl) paginationEl.innerHTML = "";
    return;
  }

  let html = "";
  html += `<button class="btn btn-secondary" ${currentSupportPage === 1 ? "disabled" : ""} onclick="changeSupportPage(${currentSupportPage - 1})">← Previous</button>`;
  html += `<span class="support-page-info">Page ${currentSupportPage} of ${response.total_pages} &nbsp;·&nbsp; ${response.total} total</span>`;
  html += `<button class="btn btn-secondary" ${currentSupportPage >= response.total_pages ? "disabled" : ""} onclick="changeSupportPage(${currentSupportPage + 1})">Next →</button>`;
  paginationEl.innerHTML = html;
}

// Change support page
function changeSupportPage(page) {
  currentSupportPage = page;
  loadSupportConversations();
}

// View support conversation details
async function viewSupportConversation(conversationId) {
  currentSupportConversationId = conversationId;

  // Two-pane layout: show conversation in the right pane, mark row active
  const inbox = document.getElementById("supportInbox");
  const emptyState = document.getElementById("supportEmptyState");
  const convPane = document.getElementById("supportConversationPane");
  if (inbox) inbox.classList.add("conversation-open");
  if (emptyState) emptyState.style.display = "none";
  if (convPane) convPane.style.display = "flex";

  document.querySelectorAll(".support-conv-row").forEach((row) => {
    row.classList.toggle(
      "active",
      Number(row.dataset.convId) === conversationId,
    );
  });

  const infoEl = document.getElementById("supportConversationInfo");
  const messagesEl = document.getElementById("supportMessages");
  const replyForm = document.getElementById("supportReplyForm");

  infoEl.innerHTML = '<div class="loading">Loading conversation...</div>';
  messagesEl.innerHTML = '<div class="loading">Loading messages...</div>';

  try {
    const conversation = await api.getSupportConversation(conversationId);

    // Render header info
    const hostName = conversation.host_name || "Unknown Host";
    const initials = getInitials(hostName);
    const avatarColor = getAvatarColor(hostName);
    const statusBadge =
      conversation.status === "closed"
        ? '<span class="badge-status-closed">Closed</span>'
        : '<span class="badge-status-open">Open</span>';

    infoEl.innerHTML = `
            <div class="support-chat-host-avatar" style="background:${avatarColor};">${escapeHtml(initials)}</div>
            <div class="support-chat-host-details">
                <div class="support-chat-host-name">${escapeHtml(hostName)}</div>
                <div class="support-chat-host-sub">
                    <span>${escapeHtml(conversation.host_email || "")}</span>
                    <span class="dot">·</span>
                    <span>ID: ${conversation.host_id}</span>
                    <span class="dot">·</span>
                    ${statusBadge}
                </div>
            </div>
        `;

    // Show/hide close/reopen buttons and reply form
    const closeBtn = document.getElementById("closeConversationBtn");
    const reopenBtn = document.getElementById("reopenConversationBtn");
    const existingBanner = document.getElementById("supportClosedBanner");
    if (existingBanner) existingBanner.remove();

    if (conversation.status === "open") {
      closeBtn.style.display = "flex";
      reopenBtn.style.display = "none";
      replyForm.style.display = "block";
    } else {
      closeBtn.style.display = "none";
      reopenBtn.style.display = "flex";
      replyForm.style.display = "none";
      const banner = document.createElement("div");
      banner.id = "supportClosedBanner";
      banner.className = "support-closed-banner";
      banner.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                This conversation is closed.
                <button class="support-closed-reopen-btn" onclick="reopenSupportConversation()">Reopen</button>
            `;
      replyForm.parentNode.insertBefore(banner, replyForm);
    }

    // Render messages with day dividers
    if (!conversation.messages || conversation.messages.length === 0) {
      messagesEl.innerHTML = '<div class="empty-state">No messages yet</div>';
    } else {
      let messagesHtml = "";
      let lastDateLabel = "";

      conversation.messages.forEach((msg) => {
        const isHost = msg.sender_type === "host";
        const senderName = escapeHtml(
          msg.sender_name || (isHost ? hostName : "Admin"),
        );
        const msgInitials = isHost ? escapeHtml(initials) : "A";
        const msgAvatarColor = isHost ? avatarColor : "#007ffa";
        const dateLabel = formatDateLabel(msg.created_at);

        if (dateLabel && dateLabel !== lastDateLabel) {
          lastDateLabel = dateLabel;
          messagesHtml += `<div class="support-day-divider">${escapeHtml(dateLabel)}</div>`;
        }

        messagesHtml += `
                    <div class="support-msg-row ${isHost ? "host-row" : "admin-row"}">
                        ${isHost ? `<div class="support-msg-avatar-sm" style="background:${msgAvatarColor};">${msgInitials}</div>` : ""}
                        <div class="support-msg-bubble-wrap">
                            <div class="support-msg-sender">${senderName}</div>
                            <div class="support-msg-bubble ${isHost ? "host-bubble" : "admin-bubble"}">${escapeHtml(msg.message).replace(/\n/g, "<br>")}</div>
                            <div class="support-msg-time">${formatDateTime(msg.created_at)}</div>
                        </div>
                        ${!isHost ? `<div class="support-msg-avatar-sm" style="background:#007ffa;">A</div>` : ""}
                    </div>
                `;
      });

      messagesEl.innerHTML = messagesHtml;
      requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }
  } catch (error) {
    console.error("Error loading conversation:", error);
    infoEl.innerHTML = `<div class="error">Error loading conversation: ${error.message}</div>`;
    messagesEl.innerHTML = "";
  }
}

// Back to support list — on mobile this collapses the right pane; on desktop
// it just clears the active selection and shows the empty state.
function backToSupportList() {
  currentSupportConversationId = null;
  const inbox = document.getElementById("supportInbox");
  const emptyState = document.getElementById("supportEmptyState");
  const convPane = document.getElementById("supportConversationPane");
  if (inbox) inbox.classList.remove("conversation-open");
  if (convPane) convPane.style.display = "none";
  if (emptyState) emptyState.style.display = "flex";
  document
    .querySelectorAll(".support-conv-row.active")
    .forEach((row) => row.classList.remove("active"));
}

// Auto-resize textarea
document.addEventListener("DOMContentLoaded", () => {
  const replyTextarea = document.getElementById("supportReplyMessage");
  if (replyTextarea) {
    replyTextarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });
  }
});

// Send support reply
async function sendSupportReply(event) {
  event.preventDefault();

  if (!currentSupportConversationId) {
    alert("No conversation selected");
    return;
  }

  const messageInput = document.getElementById("supportReplyMessage");
  const message = messageInput.value.trim();

  if (!message) {
    return;
  }

  if (message.length > 2000) {
    alert("Message must be 2000 characters or less");
    return;
  }

  // Disable form while sending
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.style.opacity = "0.5";

  try {
    await api.respondToSupportConversation(
      currentSupportConversationId,
      message,
    );
    messageInput.value = "";
    messageInput.style.height = "auto";

    // Reload conversation to show new message
    await viewSupportConversation(currentSupportConversationId);
  } catch (error) {
    alert("Error sending reply: " + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.style.opacity = "";
  }
}

// Close support conversation
async function closeSupportConversation() {
  if (!currentSupportConversationId) {
    alert("No conversation selected");
    return;
  }

  if (
    !confirm(
      "Are you sure you want to close this conversation? The host will not be able to send new messages until it is reopened.",
    )
  ) {
    return;
  }

  try {
    await api.closeSupportConversation(currentSupportConversationId);
    await viewSupportConversation(currentSupportConversationId);
    alert("Conversation closed successfully");
  } catch (error) {
    alert("Error closing conversation: " + error.message);
  }
}

// Reopen support conversation
async function reopenSupportConversation() {
  if (!currentSupportConversationId) {
    alert("No conversation selected");
    return;
  }

  try {
    await api.reopenSupportConversation(currentSupportConversationId);
    await viewSupportConversation(currentSupportConversationId);
    alert("Conversation reopened successfully");
  } catch (error) {
    alert("Error reopening conversation: " + error.message);
  }
}
