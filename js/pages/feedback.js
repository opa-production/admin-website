// js/pages/feedback.js — what hosts have written to Ardena through the app.
// Classic script (not a module): top-level functions and vars are global by design.
//
// Read, flag for follow-up, and delete. Flagging is the "someone should act on
// this" mark; the Flagged filter is the to-do list it produces.

let feedbackFlagFilter = "";
let feedbackPage = 1;
const FEEDBACK_PAGE_SIZE = 50;

function setFeedbackFlagFilter(value) {
  feedbackFlagFilter = value;
  feedbackPage = 1;
  loadFeedback();
}

function goToFeedbackPage(page) {
  feedbackPage = page;
  loadFeedback();
}

function feedbackToolbarHtml() {
  return `
        <div style="display: flex; gap: 8px; margin-bottom: 20px;">
            <button class="referrals-tab ${feedbackFlagFilter === "" ? "active" : ""}" onclick="setFeedbackFlagFilter('')">All</button>
            <button class="referrals-tab ${feedbackFlagFilter === "true" ? "active" : ""}" onclick="setFeedbackFlagFilter('true')">Flagged</button>
            <button class="referrals-tab ${feedbackFlagFilter === "false" ? "active" : ""}" onclick="setFeedbackFlagFilter('false')">Not flagged</button>
        </div>`;
}

// Load feedback
async function loadFeedback() {
  const content = document.getElementById("feedbackContent");
  if (!content) return;
  try {
    const params = { limit: FEEDBACK_PAGE_SIZE, page: feedbackPage };
    if (feedbackFlagFilter) params.is_flagged = feedbackFlagFilter;
    const data = await api.getFeedback(params);
    const rows = data.feedbacks || [];

    if (!rows.length) {
      content.innerHTML =
        feedbackToolbarHtml() +
        `<div class="empty-state">${feedbackFlagFilter === "true" ? "Nothing is flagged." : "No feedback found"}</div>`;
      return;
    }

    content.innerHTML =
      feedbackToolbarHtml() +
      `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Content</th>
                                <th>Host</th>
                                <th>Flagged</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows
                              .map((feedback) => {
                                const text = feedback.content || "";
                                const preview = text.length > 90 ? text.substring(0, 90) + "..." : text;
                                const flag = feedback.is_flagged
                                  ? uiIconButton("flag", "Remove flag", `setFeedbackFlag(${feedback.id}, false)`, "primary")
                                  : uiIconButton("flag", "Flag for follow-up", `setFeedbackFlag(${feedback.id}, true)`);
                                return `
                                <tr>
                                    <td>${escapeHtml(preview) || "N/A"}</td>
                                    <td>${escapeHtml(feedback.host_name || "N/A")}</td>
                                    <td>${feedback.is_flagged ? '<span class="status-badge pending">Flagged</span>' : "No"}</td>
                                    <td>${new Date(feedback.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div class="row-actions">
                                            ${uiIconButton("message", "Read in full", `viewFeedback(${feedback.id})`, "primary")}
                                            ${flag}
                                            ${uiIconButton("trash", "Delete feedback", `deleteFeedbackItem(${feedback.id})`, "danger")}
                                        </div>
                                    </td>
                                </tr>`;
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>
                <div id="feedbackPagination" style="margin-top: 20px; display: flex; justify-content: center; gap: 10px; align-items: center;"></div>
            `;
    renderListPagination(
      "feedbackPagination",
      data.page || feedbackPage,
      rows.length,
      data.limit || FEEDBACK_PAGE_SIZE,
      data.total,
      "goToFeedbackPage",
    );
  } catch (error) {
    console.error("Error loading feedback:", error);
    content.innerHTML =
      feedbackToolbarHtml() +
      `<div class="empty-state">Error loading feedback: ${escapeHtml(error.message || "")}</div>`;
  }
}

// The whole message, with how to reach the host who wrote it.
async function viewFeedback(id) {
  try {
    const feedback = await api.getFeedbackItem(id);
    const contact = [feedback.host_email, feedback.host_mobile_number].filter(Boolean).join(" · ");
    await uiAlert(feedback.content || "(empty)", {
      title: `${feedback.host_name || "Host"}${contact ? " — " + contact : ""}`,
      confirmText: "Close",
      danger: false,
    });
  } catch (error) {
    uiToast(`Couldn't open that feedback: ${error.message}`, "error");
  }
}

async function setFeedbackFlag(id, flagged) {
  try {
    if (flagged) await api.flagFeedback(id);
    else await api.unflagFeedback(id);
    uiToast(flagged ? "Flagged for follow-up." : "Flag removed.", "success");
    loadFeedback();
  } catch (error) {
    uiToast(`Couldn't update the flag: ${error.message}`, "error");
  }
}

async function deleteFeedbackItem(id) {
  const ok = await uiConfirm("Delete this feedback permanently? This cannot be undone.", {
    title: "Delete feedback",
    confirmText: "Delete",
    danger: true,
  });
  if (!ok) return;
  try {
    await api.deleteFeedback(id);
    uiToast("Feedback deleted.", "success");
    loadFeedback();
  } catch (error) {
    uiToast(`Couldn't delete the feedback: ${error.message}`, "error");
  }
}
