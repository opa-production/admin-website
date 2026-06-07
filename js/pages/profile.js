// js/pages/profile.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// Load my profile
async function loadMyProfile() {
  document.querySelectorAll(".page-content").forEach((p) => {
    p.style.display = "none";
  });

  const myProfilePage = document.getElementById("myProfilePage");
  const myProfileContent = document.getElementById("myProfileContent");

  myProfilePage.style.display = "block";
  document.getElementById("pageTitle").textContent = "My Profile";
  myProfileContent.innerHTML = '<div class="loading">Loading profile...</div>';

  try {
    const admin = await api.getCurrentAdmin();

    myProfileContent.innerHTML = `
            <div style="max-width: 600px;">
                <div class="host-detail-section">
                    <h3>Profile Photo</h3>
                    <div class="avatar-uploader">
                        <div class="profile-avatar profile-avatar-lg" id="myProfileAvatar"></div>
                        <div class="avatar-uploader-actions">
                            <input type="file" id="myProfileAvatarInput" accept="image/*" style="display:none;" onchange="onAdminAvatarSelected(event)">
                            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                <button type="button" class="btn btn-primary" onclick="triggerAdminAvatarUpload()">Upload photo</button>
                                <button type="button" class="btn btn-secondary" id="myProfileAvatarRemove" onclick="removeAdminAvatarPhoto()">Remove</button>
                            </div>
                            <div class="avatar-uploader-hint">Saved on this device only. Square images look best (max ~5&nbsp;MB).</div>
                            <div id="myProfileAvatarError" style="color:#d32f2f; margin-top:8px;"></div>
                        </div>
                    </div>
                </div>
                <div class="host-detail-section">
                    <h3>Profile Information</h3>
                    <form id="myProfileForm" onsubmit="saveMyProfile(event)">
                        <div class="form-group">
                            <label for="myProfileFullName">Full Name *</label>
                            <input type="text" id="myProfileFullName" value="${admin.full_name || ""}" required maxlength="255">
                        </div>
                        <div class="form-group">
                            <label for="myProfileEmail">Email *</label>
                            <input type="email" id="myProfileEmail" value="${admin.email || ""}" required>
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <div class="detail-value" style="padding: 10px 0;">${roleBadge(admin.role)}</div>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <div style="padding: 10px 0;">
                                <span class="status-badge ${admin.is_active ? "active" : "inactive"}">
                                    ${admin.is_active ? "Active" : "Inactive"}
                                </span>
                            </div>
                        </div>
                        <div id="myProfileError" style="color: #d32f2f; margin-bottom: 15px;"></div>
                        <div class="action-buttons">
                            <button type="submit" class="btn btn-primary">Update Profile</button>
                            <button type="button" class="btn btn-secondary" onclick="showChangeOwnPasswordModal()">Change Password</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

    refreshMyProfileAvatar(admin);
  } catch (error) {
    console.error("Error loading profile:", error);
    myProfileContent.innerHTML = `<div class="empty-state">Error loading profile: ${error.message}</div>`;
  }
}

// Render the My Profile avatar preview and toggle the Remove button.
function refreshMyProfileAvatar(admin) {
  const el = document.getElementById("myProfileAvatar");
  if (!el) return;
  const a = admin || currentAdminInfo();
  renderAdminAvatar(el, a ? a.full_name || a.email : "A", a);
  const removeBtn = document.getElementById("myProfileAvatarRemove");
  if (removeBtn)
    removeBtn.style.display = getStoredAdminAvatar(a) ? "inline-block" : "none";
}

function triggerAdminAvatarUpload() {
  const input = document.getElementById("myProfileAvatarInput");
  if (input) input.click();
}

function onAdminAvatarSelected(event) {
  const errEl = document.getElementById("myProfileAvatarError");
  if (errEl) errEl.textContent = "";
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  processAdminAvatarFile(file, 256, (dataUrl, errMsg) => {
    // Allow re-selecting the same file later.
    event.target.value = "";
    if (!dataUrl) {
      if (errEl) errEl.textContent = errMsg || "Could not use that image.";
      return;
    }
    const admin = currentAdminInfo();
    if (!setStoredAdminAvatar(dataUrl, admin)) {
      if (errEl)
        errEl.textContent =
          "Couldn't save — this browser's storage is full. Try a smaller image.";
      return;
    }
    refreshMyProfileAvatar(admin);
    refreshHeaderAvatar();
  });
}

function removeAdminAvatarPhoto() {
  const admin = currentAdminInfo();
  removeStoredAdminAvatar(admin);
  refreshMyProfileAvatar(admin);
  refreshHeaderAvatar();
}

// Save my profile
async function saveMyProfile(event) {
  event.preventDefault();

  const errorDiv = document.getElementById("myProfileError");
  const saveBtn = event.target.querySelector('button[type="submit"]');

  const fullName = document.getElementById("myProfileFullName").value.trim();
  const email = document.getElementById("myProfileEmail").value.trim();

  if (!fullName || !email) {
    errorDiv.textContent = "Please fill in all required fields.";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Updating...";
  errorDiv.textContent = "";

  try {
    await api.updateOwnProfile({
      full_name: fullName,
      email: email,
    });
    alert("Profile updated successfully");
    await loadAdminInfo();
    loadMyProfile();
  } catch (error) {
    errorDiv.textContent = error.message || "Error updating profile";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Update Profile";
  }
}

// Setup modal close on outside click
document.addEventListener("DOMContentLoaded", () => {
  const adminModal = document.getElementById("adminModal");
  const passwordModal = document.getElementById("passwordModal");

  if (adminModal) {
    adminModal.addEventListener("click", (e) => {
      if (e.target === adminModal) {
        closeAdminModal();
      }
    });
  }

  if (passwordModal) {
    passwordModal.addEventListener("click", (e) => {
      if (e.target === passwordModal) {
        closePasswordModal();
      }
    });
  }
});
