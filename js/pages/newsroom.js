// js/pages/newsroom.js — Newsroom: writers and stories for ardena.co.ke/newsroom.
// Classic script: top-level functions are global by design.
//
// Four tabs backed by /admin/newsroom/... (opabackend app/admin/newsroom.py):
//  - Requests: people who asked to write from the website. Approving creates
//    their editor account and emails a one-time link to set a password.
//  - Writers: editor accounts. Publishing on/off, deactivate, resend invite.
//  - Stories: every story incl. drafts. Feature one, unpublish, archive.
//  - Activity: who granted or removed what, and when.
//
// Any admin can look. Only a super admin can change who writes; the API
// refuses anyone else, and the buttons are hidden for them here.

const NEWSROOM_SITE = "https://ardena.co.ke/newsroom/";
let currentNewsroomTab = "requests";
let newsroomRows = {};

const NEWSROOM_FILTERS = {
  requests: [
    ["pending", "Pending"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["", "All"],
  ],
  stories: [
    ["", "All stories"],
    ["published", "Published"],
    ["draft", "Drafts"],
    ["archived", "Archived"],
  ],
};
const newsroomFilterValue = { requests: "pending", stories: "" };

function newsroomCanManageWriters() {
  return canManageAdmins();
}

function newsroomCanManageStories() {
  return canManageAdmins() || window.currentAdminRole === "manager";
}

function initNewsroomPage() {
  const invite = document.getElementById("newsroomInviteBtn");
  if (invite) invite.style.display = newsroomCanManageWriters() ? "inline-flex" : "none";
  const filter = document.getElementById("newsroomFilter");
  if (filter) {
    filter.onchange = () => {
      newsroomFilterValue[currentNewsroomTab] = filter.value;
      loadNewsroomTab();
    };
  }
  switchNewsroomTab(currentNewsroomTab);
}

function switchNewsroomTab(tab) {
  currentNewsroomTab = tab;
  ["requests", "writers", "stories", "activity"].forEach((t) => {
    document.getElementById(`newsroomTab-${t}`)?.classList.toggle("active", t === tab);
  });
  const row = document.getElementById("newsroomFilterRow");
  const filter = document.getElementById("newsroomFilter");
  const options = NEWSROOM_FILTERS[tab];
  if (row) row.style.display = options ? "flex" : "none";
  if (filter && options) {
    filter.innerHTML = options
      .map(([v, label]) => `<option value="${escapeHtmlAttr(v)}">${escapeHtml(label)}</option>`)
      .join("");
    filter.value = newsroomFilterValue[tab];
  }
  const note = document.getElementById("newsroomNote");
  if (note) {
    note.textContent = newsroomCanManageWriters()
      ? ""
      : tab === "requests" || tab === "writers"
        ? "Only a super admin can approve writers or change publishing rights."
        : "";
  }
  loadNewsroomTab();
}

function newsroomDate(value) {
  return value ? escapeHtml(formatDateTime(value)) : "—";
}

function newsroomBadge(text, on) {
  return `<span class="status-badge ${on ? "active" : "inactive"}">${escapeHtml(text)}</span>`;
}

function newsroomEmpty(text) {
  return `<div class="empty-state" style="padding: 32px; text-align: center; color: #64748b;">${escapeHtml(text)}</div>`;
}

async function loadNewsroomTab() {
  const content = document.getElementById("newsroomContent");
  if (!content) return;
  content.innerHTML = '<div class="loading">Loading...</div>';
  try {
    if (currentNewsroomTab === "requests") content.innerHTML = await renderNewsroomRequests();
    else if (currentNewsroomTab === "writers") content.innerHTML = await renderNewsroomWriters();
    else if (currentNewsroomTab === "stories") content.innerHTML = await renderNewsroomStories();
    else content.innerHTML = await renderNewsroomActivity();
  } catch (error) {
    content.innerHTML = `<div class="error-message" style="color: #d32f2f; padding: 16px;">${escapeHtml(error.message || "Couldn't load this.")}</div>`;
  }
}

// ---------- Requests ----------

async function renderNewsroomRequests() {
  // Keep the sidebar badge in step after a decision reloads this list.
  if (typeof refreshNavBadges === "function") refreshNavBadges();
  const rows = await api.getNewsroomRequests(newsroomFilterValue.requests);
  newsroomRows = {};
  rows.forEach((r) => (newsroomRows[r.id] = r));
  if (!rows.length) return newsroomEmpty("No requests here.");
  const manage = newsroomCanManageWriters();
  return `<div class="table-container"><table>
    <thead><tr><th>Name</th><th>Email</th><th>What they'd write</th><th>Work</th><th>Status</th><th>Sent</th><th>Actions</th></tr></thead>
    <tbody>${rows
      .map((r) => {
        const actions =
          r.status === "pending" && manage
            ? `<button class="btn btn-small btn-primary" onclick="openNewsroomDecide(${r.id}, 'approve')">Approve</button>
               <button class="btn btn-small btn-secondary" onclick="openNewsroomDecide(${r.id}, 'reject')">Reject</button>`
            : "—";
        const work = r.portfolio_url && /^https?:\/\//i.test(r.portfolio_url)
          ? `<a href="${escapeHtmlAttr(r.portfolio_url)}" target="_blank" rel="noopener noreferrer">Open</a>`
          : "—";
        return `<tr>
          <td><strong>${escapeHtml(r.full_name)}</strong></td>
          <td>${escapeHtml(r.email)}</td>
          <td style="max-width: 360px; white-space: normal;">${escapeHtml(r.about)}</td>
          <td>${work}</td>
          <td>${newsroomBadge(r.status, r.status === "approved")}</td>
          <td>${newsroomDate(r.created_at)}</td>
          <td style="white-space: nowrap;">${actions}</td>
        </tr>`;
      })
      .join("")}</tbody></table></div>`;
}

function openNewsroomDecide(id, action) {
  const r = newsroomRows[id];
  if (!r) return;
  document.getElementById("newsroomDecideId").value = id;
  document.getElementById("newsroomDecideAction").value = action;
  document.getElementById("newsroomDecideTitle").textContent =
    action === "approve" ? "Approve writer" : "Reject request";
  document.getElementById("newsroomDecideSummary").innerHTML =
    `<strong>${escapeHtml(r.full_name)}</strong> (${escapeHtml(r.email)})<br>` +
    `<span style="color: #475569;">${escapeHtml(r.about)}</span>`;
  document.getElementById("newsroomApproveOptions").style.display = action === "approve" ? "block" : "none";
  document.getElementById("newsroomRejectOptions").style.display = action === "reject" ? "block" : "none";
  document.getElementById("newsroomApprovePublish").checked = true;
  document.getElementById("newsroomRejectNote").value = "";
  document.getElementById("newsroomRejectNotify").checked = false;
  document.getElementById("newsroomDecideError").textContent = "";
  const btn = document.getElementById("newsroomDecideBtn");
  btn.textContent = action === "approve" ? "Approve and send invite" : "Reject";
  btn.className = `btn ${action === "approve" ? "btn-primary" : "btn-danger"}`;
  document.getElementById("newsroomDecideModal").style.display = "flex";
}

async function confirmNewsroomDecision() {
  const id = document.getElementById("newsroomDecideId").value;
  const action = document.getElementById("newsroomDecideAction").value;
  const errEl = document.getElementById("newsroomDecideError");
  const btn = document.getElementById("newsroomDecideBtn");
  errEl.textContent = "";
  btn.disabled = true;
  try {
    if (action === "approve") {
      await api.approveNewsroomRequest(id, document.getElementById("newsroomApprovePublish").checked);
    } else {
      await api.rejectNewsroomRequest(
        id,
        document.getElementById("newsroomRejectNote").value.trim() || null,
        document.getElementById("newsroomRejectNotify").checked,
      );
    }
    closeNewsroomModal("newsroomDecideModal");
    loadNewsroomTab();
  } catch (error) {
    errEl.textContent = error.message || "That didn't work.";
  } finally {
    btn.disabled = false;
  }
}

// ---------- Writers ----------

async function renderNewsroomWriters() {
  const rows = await api.getNewsroomEditors();
  if (!rows.length) return newsroomEmpty("No writers yet. Approve a request or invite someone.");
  const manage = newsroomCanManageWriters();
  return `<div class="table-container"><table>
    <thead><tr><th>Name</th><th>Email</th><th>Publishing</th><th>Account</th><th>Stories</th><th>Last sign-in</th><th>Actions</th></tr></thead>
    <tbody>${rows
      .map((e) => {
        const account = !e.is_active
          ? newsroomBadge("Deactivated", false)
          : e.has_password
            ? newsroomBadge("Active", true)
            : newsroomBadge("Invite sent", false);
        const actions = manage
          ? [
              `<button class="btn btn-small ${e.can_publish ? "btn-secondary" : "btn-primary"}" onclick="toggleNewsroomPublisher(${e.id}, ${!e.can_publish})">${e.can_publish ? "Stop publishing" : "Allow publishing"}</button>`,
              !e.has_password && e.is_active
                ? `<button class="btn btn-small btn-secondary" onclick="resendNewsroomInvite(${e.id})">Resend invite</button>`
                : "",
              `<button class="btn btn-small ${e.is_active ? "btn-danger" : "btn-secondary"}" onclick="toggleNewsroomActive(${e.id}, ${!e.is_active})">${e.is_active ? "Deactivate" : "Reactivate"}</button>`,
              e.avatar_url
                ? `<button class="btn btn-small btn-secondary" onclick="removeNewsroomAvatar(${e.id})">Remove photo</button>`
                : "",
            ].join(" ")
          : "—";
        const photo = /^https:\/\//.test(e.avatar_url || "")
          ? `<img src="${escapeHtmlAttr(e.avatar_url)}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;">`
          : "";
        return `<tr>
          <td>${photo}<strong>${escapeHtml(e.full_name)}</strong></td>
          <td>${escapeHtml(e.email)}</td>
          <td>${newsroomBadge(e.can_publish ? "Can publish" : "Off", e.can_publish)}</td>
          <td>${account}</td>
          <td>${e.stories}</td>
          <td>${newsroomDate(e.last_login_at)}</td>
          <td style="white-space: nowrap;">${actions}</td>
        </tr>`;
      })
      .join("")}</tbody></table></div>`;
}

async function newsroomAct(work) {
  try {
    await work();
  } catch (error) {
    alert(error.message || "That didn't work.");
  }
  loadNewsroomTab();
}

function toggleNewsroomPublisher(id, canPublish) {
  newsroomAct(() => api.setNewsroomPublisher(id, canPublish));
}

function toggleNewsroomActive(id, isActive) {
  if (!isActive && !confirm("Deactivate this writer? They're signed out everywhere and can't sign in until reactivated.")) return;
  newsroomAct(() => api.setNewsroomEditorActive(id, isActive));
}

function resendNewsroomInvite(id) {
  newsroomAct(() => api.resendNewsroomInvite(id));
}

function removeNewsroomAvatar(id) {
  if (!confirm("Remove this writer's photo? It disappears from all their stories.")) return;
  newsroomAct(() => api.removeNewsroomAvatar(id));
}

function openNewsroomInviteModal() {
  document.getElementById("newsroomInviteForm").reset();
  document.getElementById("newsroomInvitePublish").checked = true;
  document.getElementById("newsroomInviteError").textContent = "";
  document.getElementById("newsroomInviteModal").style.display = "flex";
}

async function confirmNewsroomInvite() {
  const errEl = document.getElementById("newsroomInviteError");
  const btn = document.getElementById("newsroomInviteSubmit");
  errEl.textContent = "";
  btn.disabled = true;
  try {
    await api.inviteNewsroomEditor(
      document.getElementById("newsroomInviteName").value.trim(),
      document.getElementById("newsroomInviteEmail").value.trim(),
      document.getElementById("newsroomInvitePublish").checked,
    );
    closeNewsroomModal("newsroomInviteModal");
    currentNewsroomTab = "writers";
    switchNewsroomTab("writers");
  } catch (error) {
    errEl.textContent = error.message || "Couldn't send the invite.";
  } finally {
    btn.disabled = false;
  }
}

// ---------- Stories ----------

async function renderNewsroomStories() {
  const rows = await api.getNewsroomArticles(newsroomFilterValue.stories);
  if (!rows.length) return newsroomEmpty("No stories here yet.");
  const manage = newsroomCanManageStories();
  return `<div class="table-container"><table>
    <thead><tr><th>Title</th><th>Category</th><th>Author</th><th>Status</th><th>Published</th><th>Updated</th><th>Actions</th></tr></thead>
    <tbody>${rows
      .map((a) => {
        // Story ids are UUIDs from our API, but escape for the attribute anyway.
        const id = escapeHtmlAttr(a.id);
        const title = a.status === "published"
          ? `<a href="${NEWSROOM_SITE}${encodeURIComponent(a.slug)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(a.title)}</strong></a>`
          : `<strong>${escapeHtml(a.title)}</strong>`;
        const actions = [];
        if (manage && a.status === "published") {
          actions.push(`<button class="btn btn-small ${a.featured ? "btn-secondary" : "btn-primary"}" onclick="newsroomStory('${id}', {featured: ${!a.featured}})">${a.featured ? "Unfeature" : "Feature"}</button>`);
          actions.push(`<button class="btn btn-small btn-secondary" onclick="newsroomStory('${id}', {status: 'draft'})">Unpublish</button>`);
        }
        if (manage && a.status === "draft" && a.published_at) {
          actions.push(`<button class="btn btn-small btn-primary" onclick="newsroomStory('${id}', {status: 'published'})">Republish</button>`);
        }
        if (manage && a.status !== "archived") {
          actions.push(`<button class="btn btn-small btn-danger" onclick="newsroomArchive('${id}')">Archive</button>`);
        }
        const status = a.featured ? "featured" : a.status;
        return `<tr>
          <td style="max-width: 340px; white-space: normal;">${title}</td>
          <td>${escapeHtml(a.category || "—")}</td>
          <td>${escapeHtml(a.author || "—")}</td>
          <td>${newsroomBadge(status, a.status === "published")}</td>
          <td>${newsroomDate(a.published_at)}</td>
          <td>${newsroomDate(a.updated_at)}</td>
          <td style="white-space: nowrap;">${actions.join(" ") || "—"}</td>
        </tr>`;
      })
      .join("")}</tbody></table></div>`;
}

function newsroomStory(id, changes) {
  newsroomAct(() => api.updateNewsroomArticle(id, changes));
}

function newsroomArchive(id) {
  if (!confirm("Archive this story? It disappears from the website. You can't undo this from the dashboard.")) return;
  newsroomStory(id, { status: "archived" });
}

// ---------- Activity ----------

const NEWSROOM_ACTIONS = {
  approve_request: "Approved a writer",
  reject_request: "Rejected a request",
  invite_editor: "Invited a writer",
  grant_publisher: "Allowed publishing",
  revoke_publisher: "Stopped publishing",
  activate_editor: "Reactivated a writer",
  deactivate_editor: "Deactivated a writer",
  resend_invite: "Resent an invite",
  remove_avatar: "Removed a writer's photo",
  password_changed: "Writer changed their password",
  feature: "Featured a story",
  unfeature: "Unfeatured a story",
  set_status_published: "Republished a story",
  set_status_draft: "Unpublished a story",
  set_status_archived: "Archived a story",
};

async function renderNewsroomActivity() {
  const rows = await api.getNewsroomAudit(150);
  if (!rows.length) return newsroomEmpty("Nothing has happened yet.");
  return `<div class="table-container"><table>
    <thead><tr><th>When</th><th>What</th><th>Admin</th><th>Writer</th><th>Details</th></tr></thead>
    <tbody>${rows
      .map((r) => `<tr>
          <td>${newsroomDate(r.created_at)}</td>
          <td>${escapeHtml(NEWSROOM_ACTIONS[r.action] || r.action)}</td>
          <td>${r.admin_id ? "#" + r.admin_id : "—"}</td>
          <td>${r.editor_id ? "#" + r.editor_id : "—"}</td>
          <td style="max-width: 320px; white-space: normal;">${escapeHtml(r.detail || "")}</td>
        </tr>`)
      .join("")}</tbody></table></div>`;
}

function closeNewsroomModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}
