// js/pages/admins.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// ==================== ADMIN MANAGEMENT ====================

// Admin management state
let currentAdminSearch = "";
let currentAdminRoleFilter = "";
let currentAdminStatusFilter = "";
let adminSearchTimeout = null;

// Setup admin search and filters
function setupAdminSearch() {
  const searchInput = document.getElementById("adminSearch");
  const roleFilter = document.getElementById("adminRoleFilter");
  const statusFilter = document.getElementById("adminStatusFilter");

  if (searchInput && !searchInput.oninput) {
    searchInput.oninput = (e) => {
      clearTimeout(adminSearchTimeout);
      adminSearchTimeout = setTimeout(() => {
        currentAdminSearch = e.target.value;
        loadAdmins();
      }, 300);
    };
  }

  if (roleFilter && !roleFilter.onchange) {
    roleFilter.onchange = (e) => {
      currentAdminRoleFilter = e.target.value;
      loadAdmins();
    };
  }

  if (statusFilter && !statusFilter.onchange) {
    statusFilter.onchange = (e) => {
      currentAdminStatusFilter = e.target.value;
      loadAdmins();
    };
  }
}

// Load admins
async function loadAdmins() {
  const content = document.getElementById("adminsContent");

  setupAdminSearch();

  try {
    const params = { limit: 50 };
    if (currentAdminSearch) {
      params.search = currentAdminSearch;
    }
    if (currentAdminRoleFilter) {
      params.role = currentAdminRoleFilter;
    }
    if (currentAdminStatusFilter) {
      params.is_active = currentAdminStatusFilter === "true";
    }

    const data = await api.getAdmins(params);
    if (data.admins && data.admins.length > 0) {
      content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.admins
                              .map(
                                (admin) => `
                                <tr>
                                    <td>${admin.full_name}</td>
                                    <td>${admin.email}</td>
                                    <td>${admin.role}</td>
                                    <td><span class="status-badge ${admin.is_active ? "active" : "inactive"}">${admin.is_active ? "Active" : "Inactive"}</span></td>
                                    <td>${new Date(admin.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-primary btn-small" onclick="viewAdminDetails(${admin.id})">View</button>
                                        ${
                                          admin.is_active
                                            ? `<button class="btn btn-secondary btn-small" onclick="deactivateAdmin(${admin.id})">Deactivate</button>`
                                            : `<button class="btn btn-primary btn-small" onclick="activateAdmin(${admin.id})">Activate</button>`
                                        }
                                        <button class="btn btn-danger btn-small" onclick="deleteAdminConfirm(${admin.id}, '${admin.full_name}')">Delete</button>
                                    </td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
    } else {
      content.innerHTML = '<div class="empty-state">No admins found</div>';
    }
  } catch (error) {
    console.error("Error loading admins:", error);
    if (error.message.includes("super_admin")) {
      content.innerHTML =
        '<div class="empty-state">Only super admins can access this page</div>';
    } else {
      content.innerHTML = '<div class="empty-state">Error loading admins</div>';
    }
  }
}

// Back to admins list
function backToAdminsList() {
  loadPage("admins");
}

// View admin details
async function viewAdminDetails(adminId) {
  document.querySelectorAll(".page-content").forEach((p) => {
    p.style.display = "none";
  });

  const adminDetailPage = document.getElementById("adminDetailPage");
  const adminDetailContent = document.getElementById("adminDetailContent");
  const adminDetailTitle = document.getElementById("adminDetailTitle");

  adminDetailPage.style.display = "block";
  document.getElementById("pageTitle").textContent = "Admin Details";
  adminDetailContent.innerHTML =
    '<div class="loading">Loading admin details...</div>';

  try {
    const admin = await api.getAdmin(adminId);
    adminDetailTitle.textContent = admin.full_name || "Admin Details";

    adminDetailContent.innerHTML = `
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${admin.full_name || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email:</div>
                        <div class="detail-value">${admin.email || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Role:</div>
                        <div class="detail-value">${admin.role || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">
                            <span class="status-badge ${admin.is_active ? "active" : "inactive"}">
                                ${admin.is_active ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="host-detail-section">
                    <h3>Account Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Created:</div>
                        <div class="detail-value">${new Date(admin.created_at).toLocaleString()}</div>
                    </div>
                    ${
                      admin.updated_at
                        ? `
                    <div class="detail-row">
                        <div class="detail-label">Last Updated:</div>
                        <div class="detail-value">${new Date(admin.updated_at).toLocaleString()}</div>
                    </div>
                    `
                        : ""
                    }
                </div>
            </div>
            
            <div class="action-buttons" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
                <button class="btn btn-primary" onclick="showEditAdminForm(${admin.id})">Edit Admin</button>
                <button class="btn btn-secondary" onclick="showChangeAdminPasswordModal(${admin.id})">Change Password</button>
                ${
                  admin.is_active
                    ? `<button class="btn btn-secondary" onclick="deactivateAdmin(${admin.id}, true)">Deactivate</button>`
                    : `<button class="btn btn-primary" onclick="activateAdmin(${admin.id}, true)">Activate</button>`
                }
                <button class="btn btn-danger" onclick="deleteAdminConfirm(${admin.id}, '${admin.full_name}', true)">Delete</button>
            </div>
        `;
  } catch (error) {
    console.error("Error loading admin details:", error);
    adminDetailContent.innerHTML = `<div class="empty-state">Error loading admin details: ${error.message}</div>`;
  }
}

// Show create admin form
function showCreateAdminForm() {
  document.getElementById("adminModalTitle").textContent = "Create Admin";
  document.getElementById("adminFormId").value = "";
  document.getElementById("adminForm").reset();
  document.getElementById("adminPasswordFields").style.display = "block";
  document.getElementById("adminPassword").required = true;
  document.getElementById("adminPasswordConfirm").required = true;
  document.getElementById("adminRole").value = "customer_service";
  document.getElementById("adminIsActive").checked = true;
  document.getElementById("adminFormError").textContent = "";
  document.getElementById("adminModal").style.display = "flex";
}

// Show edit admin form
async function showEditAdminForm(adminId) {
  try {
    const admin = await api.getAdmin(adminId);
    document.getElementById("adminModalTitle").textContent = "Edit Admin";
    document.getElementById("adminFormId").value = adminId;
    document.getElementById("adminFullName").value = admin.full_name || "";
    document.getElementById("adminEmail").value = admin.email || "";
    document.getElementById("adminPasswordFields").style.display = "none";
    document.getElementById("adminPassword").required = false;
    document.getElementById("adminPasswordConfirm").required = false;
    document.getElementById("adminRole").value =
      admin.role || "customer_service";
    document.getElementById("adminIsActive").checked = admin.is_active;
    document.getElementById("adminFormError").textContent = "";
    document.getElementById("adminModal").style.display = "flex";
  } catch (error) {
    alert("Error loading admin: " + error.message);
  }
}

// Save admin (create or update)
async function saveAdmin(event) {
  event.preventDefault();

  const adminId = document.getElementById("adminFormId").value;
  const errorDiv = document.getElementById("adminFormError");
  const saveBtn = document.getElementById("saveAdminBtn");

  const fullName = document.getElementById("adminFullName").value.trim();
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const passwordConfirm = document.getElementById("adminPasswordConfirm").value;
  const role = document.getElementById("adminRole").value;
  const isActive = document.getElementById("adminIsActive").checked;

  errorDiv.textContent = "";

  // Validation
  if (!fullName || !email) {
    errorDiv.textContent = "Please fill in all required fields.";
    return;
  }

  if (!adminId && (!password || password.length < 8)) {
    errorDiv.textContent = "Password must be at least 8 characters.";
    return;
  }

  if (!adminId && password !== passwordConfirm) {
    errorDiv.textContent = "Passwords do not match.";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    if (adminId) {
      // Update admin
      const updateData = {
        full_name: fullName,
        email: email,
        role: role,
        is_active: isActive,
      };
      await api.updateAdmin(adminId, updateData);
      alert("Admin updated successfully");
      closeAdminModal();
      viewAdminDetails(adminId);
    } else {
      // Create admin
      const createData = {
        full_name: fullName,
        email: email,
        password: password,
        password_confirmation: passwordConfirm,
        role: role,
        is_active: isActive,
      };
      await api.createAdmin(createData);
      alert("Admin created successfully");
      closeAdminModal();
      loadAdmins();
    }
  } catch (error) {
    errorDiv.textContent = error.message || "Error saving admin";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}

// Close admin modal
function closeAdminModal() {
  document.getElementById("adminModal").style.display = "none";
}

// Deactivate admin
async function deactivateAdmin(adminId, reloadAfter = false) {
  if (!(await uiConfirm("Are you sure you want to deactivate this admin account?"))) {
    return;
  }

  try {
    await api.deactivateAdmin(adminId);
    alert("Admin deactivated successfully");
    if (reloadAfter) {
      viewAdminDetails(adminId);
    } else {
      loadAdmins();
    }
  } catch (error) {
    alert("Error deactivating admin: " + error.message);
  }
}

// Activate admin
async function activateAdmin(adminId, reloadAfter = false) {
  if (!(await uiConfirm("Are you sure you want to activate this admin account?"))) {
    return;
  }

  try {
    await api.activateAdmin(adminId);
    alert("Admin activated successfully");
    if (reloadAfter) {
      viewAdminDetails(adminId);
    } else {
      loadAdmins();
    }
  } catch (error) {
    alert("Error activating admin: " + error.message);
  }
}

// Delete admin confirmation
async function deleteAdminConfirm(adminId, adminName, reloadAfter = false) {
  if (
    !(await uiConfirm(
      `Are you sure you want to permanently delete admin "${adminName}"? This action cannot be undone.`,
    ))
  ) {
    return;
  }

  deleteAdmin(adminId, reloadAfter);
}

// Delete admin
async function deleteAdmin(adminId, reloadAfter = false) {
  try {
    await api.deleteAdmin(adminId);
    alert("Admin deleted successfully");
    if (reloadAfter) {
      backToAdminsList();
    } else {
      loadAdmins();
    }
  } catch (error) {
    alert("Error deleting admin: " + error.message);
  }
}

// Show change admin password modal
function showChangeAdminPasswordModal(adminId) {
  document.getElementById("passwordModalTitle").textContent =
    "Change Admin Password";
  document.getElementById("passwordFormType").value = "admin";
  document.getElementById("passwordFormAdminId").value = adminId;
  document.getElementById("currentPasswordField").style.display = "none";
  document.getElementById("currentPassword").required = false;
  document.getElementById("passwordForm").reset();
  document.getElementById("passwordFormError").textContent = "";
  document.getElementById("passwordModal").style.display = "flex";
}

// Show change own password modal
function showChangeOwnPasswordModal() {
  document.getElementById("passwordModalTitle").textContent =
    "Change My Password";
  document.getElementById("passwordFormType").value = "own";
  document.getElementById("passwordFormAdminId").value = "";
  document.getElementById("currentPasswordField").style.display = "block";
  document.getElementById("currentPassword").required = true;
  document.getElementById("passwordForm").reset();
  document.getElementById("passwordFormError").textContent = "";
  document.getElementById("passwordModal").style.display = "flex";
}

// Save password
async function savePassword(event) {
  event.preventDefault();

  const formType = document.getElementById("passwordFormType").value;
  const adminId = document.getElementById("passwordFormAdminId").value;
  const errorDiv = document.getElementById("passwordFormError");
  const saveBtn = document.getElementById("savePasswordBtn");

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const newPasswordConfirm =
    document.getElementById("newPasswordConfirm").value;

  errorDiv.textContent = "";

  // Validation
  if (formType === "own" && !currentPassword) {
    errorDiv.textContent = "Please enter your current password.";
    return;
  }

  if (!newPassword || newPassword.length < 8) {
    errorDiv.textContent = "New password must be at least 8 characters.";
    return;
  }

  if (newPassword !== newPasswordConfirm) {
    errorDiv.textContent = "New passwords do not match.";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Changing...";

  try {
    if (formType === "own") {
      const data = {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirm,
      };
      await api.changeOwnPassword(data);
      alert("Password changed successfully");
      closePasswordModal();
    } else {
      const data = {
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirm,
      };
      await api.changeAdminPassword(adminId, data);
      alert("Admin password changed successfully");
      closePasswordModal();
      viewAdminDetails(adminId);
    }
  } catch (error) {
    errorDiv.textContent = error.message || "Error changing password";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Change Password";
  }
}

// Close password modal
function closePasswordModal() {
  document.getElementById("passwordModal").style.display = "none";
}
