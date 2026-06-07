// js/pages/feedback.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// Load feedback
async function loadFeedback() {
  const content = document.getElementById("feedbackContent");
  try {
    const data = await api.getFeedback({ limit: 50 });
    if (data.feedbacks && data.feedbacks.length > 0) {
      content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Content</th>
                                <th>Host</th>
                                <th>Flagged</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.feedbacks
                              .map(
                                (feedback) => `
                                <tr>
                                    <td>${feedback.content ? feedback.content.substring(0, 50) + (feedback.content.length > 50 ? "..." : "") : "N/A"}</td>
                                    <td>${feedback.host_name || "N/A"}</td>
                                    <td>${feedback.is_flagged ? "Yes" : "No"}</td>
                                    <td>${new Date(feedback.created_at).toLocaleDateString()}</td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
    } else {
      content.innerHTML = '<div class="empty-state">No feedback found</div>';
    }
  } catch (error) {
    console.error("Error loading feedback:", error);
    content.innerHTML = '<div class="empty-state">Error loading feedback</div>';
  }
}
