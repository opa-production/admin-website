// js/pages/notifications.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// Toggle host selection dropdown visibility
function toggleHostSelection() {
  const recipientType = document.querySelector(
    'input[name="recipientType"]:checked',
  )?.value;
  const hostSelectionGroup = document.getElementById("hostSelectionGroup");
  const hostSelect = document.getElementById("notificationHostSelect");

  if (recipientType === "specific") {
    hostSelectionGroup.style.display = "block";
    if (hostSelect.options.length <= 1) {
      loadHostsForNotifications();
    }
  } else {
    hostSelectionGroup.style.display = "none";
    hostSelect.value = "";
  }
}

// Load hosts for notification dropdown
async function loadHostsForNotifications() {
  const hostSelect = document.getElementById("notificationHostSelect");
  if (!hostSelect) return;

  try {
    hostSelect.innerHTML = '<option value="">Loading hosts...</option>';
    const data = await api.getHosts({ limit: 100 });

    if (data.hosts && data.hosts.length > 0) {
      // Filter to only active hosts
      const activeHosts = data.hosts.filter((host) => host.is_active === true);

      if (activeHosts.length > 0) {
        hostSelect.innerHTML = '<option value="">Select a host...</option>';
        activeHosts.forEach((host) => {
          const option = document.createElement("option");
          option.value = host.id;
          option.textContent = `${host.full_name} (${host.email})`;
          hostSelect.appendChild(option);
        });
      } else {
        hostSelect.innerHTML =
          '<option value="">No active hosts found</option>';
      }
    } else {
      hostSelect.innerHTML = '<option value="">No hosts found</option>';
    }
  } catch (error) {
    console.error("Error loading hosts:", error);
    hostSelect.innerHTML = '<option value="">Error loading hosts</option>';
  }
}

// Send notification
async function sendNotification(event) {
  event.preventDefault();

  const form = document.getElementById("notificationForm");
  const resultDiv = document.getElementById("notificationResult");
  const sendBtn = document.getElementById("sendNotificationBtn");

  const title = document.getElementById("notificationTitle").value.trim();
  const message = document.getElementById("notificationMessage").value.trim();
  const type = document.getElementById("notificationType").value;
  const recipientType = document.querySelector(
    'input[name="recipientType"]:checked',
  ).value;

  if (!title || !message) {
    showNotifResult(
      resultDiv,
      "error",
      "Please fill in both title and message.",
    );
    return;
  }

  // Disable button
  sendBtn.disabled = true;
  const originalBtnHtml = sendBtn.innerHTML;
  sendBtn.innerHTML = '<span class="notif-spinner"></span> Sending…';
  showNotifResult(resultDiv, "", "");

  try {
    const notificationData = {
      title: title,
      message: message,
      type: type,
    };

    console.log("Sending notification:", notificationData);
    console.log("Recipient type:", recipientType);

    let response;
    if (recipientType === "all") {
      response = await api.broadcastToHosts(notificationData);
    } else if (recipientType === "specific") {
      const hostId = document.getElementById("notificationHostSelect").value;
      if (!hostId) {
        showNotifResult(resultDiv, "error", "Please pick a host first.");
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalBtnHtml;
        return;
      }
      response = await api.sendToUser({
        user_type: "host",
        user_id: parseInt(hostId),
        title,
        message,
        type,
      });
    } else {
      showNotifResult(resultDiv, "error", "Invalid recipient selected.");
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalBtnHtml;
      return;
    }

    if (response.sent_count && response.sent_count > 0) {
      const detail =
        recipientType === "specific" && response.user_id
          ? `Sent to host #${response.user_id}.`
          : `Sent to ${response.sent_count} recipient${response.sent_count === 1 ? "" : "s"}.`;
      showNotifResult(resultDiv, "success", `<strong>Sent.</strong> ${detail}`);
    } else {
      showNotifResult(
        resultDiv,
        "warning",
        response.message || "No active recipients found.",
      );
    }

    form.reset();
    document.getElementById("notificationType").value = "info";
    document
      .querySelectorAll("#hostNotificationForm .notif-chip")
      .forEach((c, i) => c.classList.toggle("active", i === 0));
    document.querySelector('input[name="recipientType"][value="all"]').checked =
      true;
    document.querySelectorAll('input[name="recipientType"]').forEach((r) => {
      const opt = r.closest(".notif-audience-opt");
      if (opt) opt.classList.toggle("active", r.checked);
    });
    document.getElementById("notificationHostSelect").value = "";
    toggleHostSelection();
    const counter = document.getElementById("hostMessageCounter");
    if (counter) counter.textContent = "0 / 1000";
    updateNotifPreview();
  } catch (error) {
    console.error("Error sending notification:", error);
    showNotifResult(
      resultDiv,
      "error",
      `<strong>Error.</strong> ${error.message}`,
    );
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = originalBtnHtml;
  }
}

// Switch notification tab
function switchNotificationTab(tab) {
  const hostTab = document.getElementById("hostNotificationTab");
  const clientTab = document.getElementById("clientNotificationTab");
  const hostForm = document.getElementById("hostNotificationForm");
  const clientForm = document.getElementById("clientNotificationForm");
  const isHost = tab === "host";

  if (hostTab) {
    hostTab.classList.toggle("active", isHost);
    hostTab.setAttribute("aria-selected", String(isHost));
  }
  if (clientTab) {
    clientTab.classList.toggle("active", !isHost);
    clientTab.setAttribute("aria-selected", String(!isHost));
  }
  if (hostForm) hostForm.style.display = isHost ? "block" : "none";
  if (clientForm) clientForm.style.display = isHost ? "none" : "block";

  setupNotificationsInteractions();
  updateNotifPreview();
  if (!isHost) loadClientsForNotifications();
}

// ---- Notifications UI wiring (chips, counters, audience cards, preview) ----
let notificationsInteractionsBound = false;

function setupNotificationsInteractions() {
  if (notificationsInteractionsBound) return;
  notificationsInteractionsBound = true;

  // Type chips (host + client)
  document.querySelectorAll(".notif-chips").forEach((group) => {
    const targetId = group.dataset.target;
    const select = document.getElementById(targetId);
    group.querySelectorAll(".notif-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        group
          .querySelectorAll(".notif-chip")
          .forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        if (select) select.value = chip.dataset.value;
        updateNotifPreview();
      });
    });
  });

  // Audience option cards — toggle .active visual on the parent label.
  document
    .querySelectorAll(
      'input[name="recipientType"], input[name="clientRecipientType"]',
    )
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        const group = radio.getAttribute("name");
        document.querySelectorAll(`input[name="${group}"]`).forEach((r) => {
          const opt = r.closest(".notif-audience-opt");
          if (opt) opt.classList.toggle("active", r.checked);
        });
        updateNotifPreview();
      });
    });

  // Char counter + live preview on title/message
  const wireField = (id, counterId, max) => {
    const input = document.getElementById(id);
    const counter = counterId ? document.getElementById(counterId) : null;
    if (!input) return;
    const update = () => {
      if (counter) counter.textContent = `${input.value.length} / ${max}`;
      updateNotifPreview();
    };
    input.addEventListener("input", update);
    update();
  };
  wireField("notificationTitle");
  wireField("notificationMessage", "hostMessageCounter", 1000);
  wireField("clientNotificationTitle");
  wireField("clientNotificationMessage", "clientMessageCounter", 1000);

  // Specific-user select changes refresh preview audience line
  ["notificationHostSelect", "notificationClientSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", updateNotifPreview);
  });
}

function updateNotifPreview() {
  const isClient =
    document.getElementById("clientNotificationForm")?.style.display !== "none";
  const titleEl = document.getElementById(
    isClient ? "clientNotificationTitle" : "notificationTitle",
  );
  const msgEl = document.getElementById(
    isClient ? "clientNotificationMessage" : "notificationMessage",
  );
  const typeEl = document.getElementById(
    isClient ? "clientNotificationType" : "notificationType",
  );
  const recipientType =
    document.querySelector(
      `input[name="${isClient ? "clientRecipientType" : "recipientType"}"]:checked`,
    )?.value || "all";

  const previewToast = document.getElementById("notifPreviewToast");
  const previewIcon = document.getElementById("notifPreviewIcon");
  const previewTitle = document.getElementById("notifPreviewTitle");
  const previewMessage = document.getElementById("notifPreviewMessage");
  const previewAudience = document.getElementById("notifPreviewAudience");
  if (!previewToast) return;

  const tone = (typeEl && typeEl.value) || "info";
  previewToast.dataset.tone = tone;
  if (previewIcon) previewIcon.innerHTML = notifIconSvg(tone);

  previewTitle.textContent =
    (titleEl?.value || "").trim() || "Notification title";
  previewMessage.textContent =
    (msgEl?.value || "").trim() || "Your message will appear here as you type.";

  let audienceLabel;
  if (recipientType === "all") {
    audienceLabel = isClient ? "Clients · everyone" : "Hosts · everyone";
  } else {
    const sel = document.getElementById(
      isClient ? "notificationClientSelect" : "notificationHostSelect",
    );
    const text =
      sel && sel.value
        ? (sel.options[sel.selectedIndex]?.textContent || "").trim()
        : "";
    audienceLabel = text
      ? `${isClient ? "Client" : "Host"} · ${text}`
      : `${isClient ? "Client" : "Host"} · pick one`;
  }
  previewAudience.textContent = audienceLabel;
}

// Toggle client selection
function toggleClientSelection() {
  const clientSelectionGroup = document.getElementById("clientSelectionGroup");
  const clientSelect = document.getElementById("notificationClientSelect");
  const recipientType = document.querySelector(
    'input[name="clientRecipientType"]:checked',
  ).value;

  if (recipientType === "specific") {
    clientSelectionGroup.style.display = "block";
    if (clientSelect.options.length <= 1) {
      loadClientsForNotifications();
    }
  } else {
    clientSelectionGroup.style.display = "none";
    clientSelect.value = "";
  }
}

// Load clients for notification dropdown
async function loadClientsForNotifications() {
  const clientSelect = document.getElementById("notificationClientSelect");
  if (!clientSelect) return;

  try {
    clientSelect.innerHTML = '<option value="">Loading clients...</option>';
    const data = await api.getClients({ limit: 100 });

    if (data.clients && data.clients.length > 0) {
      // Filter to only active clients
      const activeClients = data.clients.filter(
        (client) => client.is_active === true,
      );

      if (activeClients.length > 0) {
        clientSelect.innerHTML = '<option value="">Select a client...</option>';
        activeClients.forEach((client) => {
          const option = document.createElement("option");
          option.value = client.id;
          option.textContent = `${client.full_name} (${client.email})`;
          clientSelect.appendChild(option);
        });
      } else {
        clientSelect.innerHTML =
          '<option value="">No active clients found</option>';
      }
    } else {
      clientSelect.innerHTML = '<option value="">No clients found</option>';
    }
  } catch (error) {
    console.error("Error loading clients:", error);
    clientSelect.innerHTML = '<option value="">Error loading clients</option>';
  }
}

// Send client notification
async function sendClientNotification(event) {
  event.preventDefault();

  const form =
    event && event.target && typeof event.target.reset === "function"
      ? event.target
      : document.getElementById("clientNotificationFormEl");
  const resultDiv = document.getElementById("clientNotificationResult");
  const sendBtn = document.getElementById("sendClientNotificationBtn");

  const title = document.getElementById("clientNotificationTitle").value.trim();
  const message = document
    .getElementById("clientNotificationMessage")
    .value.trim();
  const type = document.getElementById("clientNotificationType").value;
  const emailSubject = (
    document.getElementById("clientNotificationEmailSubject").value || ""
  ).trim();
  const emailBodyHtml = (
    document.getElementById("clientNotificationEmailBody").value || ""
  ).trim();
  const recipientType = document.querySelector(
    'input[name="clientRecipientType"]:checked',
  ).value;

  if (!title || !message) {
    showNotifResult(
      resultDiv,
      "error",
      "Please fill in both title and message.",
    );
    return;
  }

  // Disable button
  sendBtn.disabled = true;
  const originalBtnHtml = sendBtn.innerHTML;
  sendBtn.innerHTML = '<span class="notif-spinner"></span> Sending…';
  showNotifResult(resultDiv, "", "");

  try {
    const notificationData = {
      title: title,
      message: message,
      type: type,
      // Optional email fields for preferences-based broadcast
      email_subject: emailSubject || undefined,
      email_body_html: emailBodyHtml || undefined,
    };

    console.log("Sending client notification:", notificationData);
    console.log("Recipient type:", recipientType);

    let response;
    if (recipientType === "all") {
      response = await api.broadcastToClientsByPreferences(notificationData);
    } else if (recipientType === "specific") {
      const clientId = document.getElementById(
        "notificationClientSelect",
      ).value;
      if (!clientId) {
        showNotifResult(resultDiv, "error", "Please pick a client first.");
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalBtnHtml;
        return;
      }
      response = await api.sendToUser({
        user_type: "client",
        user_id: parseInt(clientId),
        title,
        message,
        type,
      });
    } else {
      showNotifResult(resultDiv, "error", "Invalid recipient selected.");
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalBtnHtml;
      return;
    }

    const sentCount = response.sent_count || 0;
    if (sentCount > 0) {
      const detail =
        recipientType === "specific" && response.user_id
          ? `Sent to client #${response.user_id}.`
          : `Sent to ${sentCount} recipient${sentCount === 1 ? "" : "s"}.`;
      showNotifResult(resultDiv, "success", `<strong>Sent.</strong> ${detail}`);
    } else {
      showNotifResult(
        resultDiv,
        "warning",
        response.message || "No active recipients found.",
      );
    }

    form.reset();
    document.getElementById("clientNotificationType").value = "info";
    document
      .querySelectorAll("#clientNotificationForm .notif-chip")
      .forEach((c, i) => c.classList.toggle("active", i === 0));
    document.querySelector(
      'input[name="clientRecipientType"][value="all"]',
    ).checked = true;
    document
      .querySelectorAll('input[name="clientRecipientType"]')
      .forEach((r) => {
        const opt = r.closest(".notif-audience-opt");
        if (opt) opt.classList.toggle("active", r.checked);
      });
    document.getElementById("notificationClientSelect").value = "";
    toggleClientSelection();
    const counter = document.getElementById("clientMessageCounter");
    if (counter) counter.textContent = "0 / 1000";
    updateNotifPreview();
  } catch (error) {
    console.error("Error sending client notification:", error);
    showNotifResult(
      resultDiv,
      "error",
      `<strong>Error.</strong> ${error.message}`,
    );
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = originalBtnHtml;
  }
}
