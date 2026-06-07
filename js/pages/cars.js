// js/pages/cars.js — extracted from dashboard.js during the per-page refactor.
// Classic script (not a module): top-level functions and vars are global by design.


// Car management state
let currentCarSearch = "";
let currentCarStatusFilter = "";
let carSearchTimeout = null;

/** Escape for use inside HTML attribute values */
function normalizeCarImageUrls(mediaData) {
  if (!mediaData || typeof mediaData !== "object") return [];
  const raw =
    mediaData.image_urls ??
    mediaData.imageUrls ??
    mediaData.urls ??
    mediaData.images;
  if (Array.isArray(raw)) {
    return raw.filter((u) => typeof u === "string" && u.trim());
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((u) => typeof u === "string" && u.trim());
      }
    } catch (_) {
      /* not JSON */
    }
    return [raw.trim()];
  }
  return [];
}

function normalizeCarVideoUrls(mediaData) {
  if (!mediaData || typeof mediaData !== "object") return [];
  const raw = mediaData.video_urls ?? mediaData.videoUrls ?? mediaData.videos;
  if (Array.isArray(raw)) {
    return raw.filter((u) => typeof u === "string" && u.trim());
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

function buildCarMediaLists(mediaData) {
  let images = normalizeCarImageUrls(mediaData);
  const videos = normalizeCarVideoUrls(mediaData);
  const cover = mediaData.cover_image_url ?? mediaData.coverImageUrl ?? null;
  if (cover && typeof cover === "string" && cover.trim()) {
    const c = cover.trim();
    if (!images.includes(c)) {
      images = [c, ...images];
    }
  }
  // Dedupe while preserving order
  images = [...new Set(images)];
  return { images, videos };
}

function renderCarMediaLoadingHtml() {
  return `
        <div class="host-detail-section car-media-section">
            <h3>Car Media <span class="car-media-count">(loading...)</span></h3>
            <div class="car-media-grid">
                <div class="car-media-skeleton"></div>
                <div class="car-media-skeleton"></div>
                <div class="car-media-skeleton"></div>
                <div class="car-media-skeleton"></div>
            </div>
        </div>
    `;
}

function renderCarMediaHtml(mediaData) {
  const { images: mediaImages, videos: mediaVideos } = buildCarMediaLists(
    mediaData || {},
  );
  return `
        <div class="host-detail-section car-media-section">
            <h3>Car Media <span class="car-media-count">(${mediaImages.length} photo${mediaImages.length === 1 ? "" : "s"})</span></h3>
            ${
              mediaImages.length > 0
                ? `
                <div class="car-media-grid" style="margin-bottom: ${mediaVideos.length > 0 ? "16px" : "0"};">
                    ${mediaImages
                      .map((url, index) => {
                        const safe = escapeHtmlAttr(url);
                        return `
                        <a href="${safe}" target="_blank" rel="noopener noreferrer" title="Open image ${index + 1}">
                            <img
                                src="${safe}"
                                alt="Car image ${index + 1}"
                                class="car-media-thumb"
                                style="width: 100%; height: 130px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; background: #f5f5f5; display: block;"
                                loading="lazy"
                            />
                        </a>`;
                      })
                      .join("")}
                </div>
            `
                : '<div class="detail-value" style="color: #666;">No car images found.</div>'
            }
            ${
              mediaVideos.length > 0
                ? `
                <div style="display: grid; gap: 12px;">
                    ${mediaVideos
                      .map((url, index) => {
                        const safe = escapeHtmlAttr(url);
                        return `
                        <div>
                            <div class="detail-label" style="margin-bottom: 6px;">Video ${index + 1}</div>
                            <video controls preload="metadata" style="width: 100%; max-width: 520px; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <source src="${safe}" />
                                Your browser does not support the video tag.
                            </video>
                        </div>`;
                      })
                      .join("")}
                </div>
            `
                : ""
            }
        </div>
    `;
}

async function loadCarMediaSection(carId) {
  const mediaContainer = document.getElementById("carMediaContainer");
  if (!mediaContainer) return;
  try {
    const mediaData = await api.getCarMedia(carId);
    mediaContainer.innerHTML = renderCarMediaHtml(mediaData);
  } catch (error) {
    console.warn("Unable to load car media from Supabase:", error);
    mediaContainer.innerHTML = `
            <div class="host-detail-section car-media-section">
                <h3>Car Media</h3>
                <div class="detail-value" style="color: #666;">Unable to load car media right now.</div>
            </div>
        `;
  }
}

// Setup car search and filter
function setupCarSearch() {
  const searchInput = document.getElementById("carSearch");
  const statusFilter = document.getElementById("carStatusFilter");

  if (searchInput && !searchInput.oninput) {
    searchInput.oninput = (e) => {
      clearTimeout(carSearchTimeout);
      carSearchTimeout = setTimeout(() => {
        currentCarSearch = e.target.value;
        loadCars();
      }, 300);
    };
  }

  if (statusFilter && !statusFilter.onchange) {
    statusFilter.onchange = (e) => {
      currentCarStatusFilter = e.target.value;
      loadCars();
    };
  }
}

// Load cars
async function loadCars() {
  const content = document.getElementById("carsContent");

  // Setup search and filter if not already done
  setupCarSearch();

  try {
    const params = { limit: 50 };
    if (currentCarSearch) {
      params.search = currentCarSearch;
    }
    if (currentCarStatusFilter) {
      params.status = currentCarStatusFilter;
    }

    const data = await api.getCars(params);
    if (data.cars && data.cars.length > 0) {
      content.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Model</th>
                                <th>Year</th>
                                <th>Status</th>
                                <th>Host</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.cars
                              .map(
                                (car) => `
                                <tr>
                                    <td>${car.name || "N/A"}</td>
                                    <td>${car.model || "N/A"}</td>
                                    <td>${car.year || "N/A"}</td>
                                    <td>
                                        <span class="status-badge ${car.verification_status === "verified" ? "active" : car.verification_status === "denied" ? "inactive" : ""}">
                                            ${car.verification_status || "N/A"}
                                        </span>
                                    </td>
                                    <td>${car.host_name || "N/A"}</td>
                                    <td>
                                        <button class="btn btn-primary btn-small" onclick="viewCarDetails(${car.id})">View</button>
                                        ${
                                          car.verification_status === "awaiting"
                                            ? `
                                            <button class="btn btn-primary btn-small" onclick="approveCar(${car.id})">Approve</button>
                                            <button class="btn btn-secondary btn-small" onclick="rejectCarPrompt(${car.id})">Reject</button>
                                        `
                                            : ""
                                        }
                                        ${
                                          car.is_hidden
                                            ? `<button class="btn btn-primary btn-small" onclick="showCar(${car.id})">Show</button>`
                                            : `<button class="btn btn-secondary btn-small" onclick="hideCar(${car.id})">Hide</button>`
                                        }
                                        <button class="btn btn-danger btn-small" onclick="deleteCarConfirm(${car.id}, '${car.name || car.model || "Car"}')">Delete</button>
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
      content.innerHTML = '<div class="empty-state">No cars found</div>';
    }
  } catch (error) {
    console.error("Error loading cars:", error);
    content.innerHTML = '<div class="empty-state">Error loading cars</div>';
  }
}

// Back to cars list
function backToCarsList() {
  loadPage("cars");
}

// View car details
async function viewCarDetails(carId) {
  // Hide all pages
  document.querySelectorAll(".page-content").forEach((p) => {
    p.style.display = "none";
  });

  // Show car detail page
  const carDetailPage = document.getElementById("carDetailPage");
  const carDetailContent = document.getElementById("carDetailContent");
  const carDetailTitle = document.getElementById("carDetailTitle");

  carDetailPage.style.display = "block";
  document.getElementById("pageTitle").textContent = "Car Details";
  carDetailContent.innerHTML =
    '<div class="loading">Loading car details...</div>';

  try {
    const car = await api.getCar(carId);
    carDetailTitle.textContent = car.name || car.model || "Car Details";

    carDetailContent.innerHTML = `
            <div id="carMediaContainer">${renderCarMediaLoadingHtml()}</div>
            
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${car.name || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Model:</div>
                        <div class="detail-value">${car.model || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Year:</div>
                        <div class="detail-value">${car.year || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Body Type:</div>
                        <div class="detail-value">${car.body_type || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Color:</div>
                        <div class="detail-value">${car.color || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Status:</div>
                        <div class="detail-value">
                            <span class="status-badge ${car.verification_status === "verified" ? "active" : car.verification_status === "denied" ? "inactive" : ""}">
                                ${car.verification_status || "N/A"}
                            </span>
                        </div>
                    </div>
                    ${
                      car.rejection_reason
                        ? `
                    <div class="detail-row">
                        <div class="detail-label">Rejection Reason:</div>
                        <div class="detail-value" style="color: #d32f2f;">${car.rejection_reason}</div>
                    </div>
                    `
                        : ""
                    }
                </div>
                
                <div class="host-detail-section">
                    <h3>Host Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Host Name:</div>
                        <div class="detail-value">${car.host_name || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Host Email:</div>
                        <div class="detail-value">${car.host_email || "N/A"}</div>
                    </div>
                </div>
            </div>
            
            <div class="responsive-detail-grid">
                <div class="host-detail-section">
                    <h3>Specifications</h3>
                    <div class="detail-row">
                        <div class="detail-label">Seats:</div>
                        <div class="detail-value">${car.seats || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Fuel Type:</div>
                        <div class="detail-value">${car.fuel_type || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Transmission:</div>
                        <div class="detail-value">${car.transmission || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Mileage:</div>
                        <div class="detail-value">${car.mileage ? car.mileage.toLocaleString() + " km" : "N/A"}</div>
                    </div>
                    ${
                      car.features && car.features.length > 0
                        ? `
                    <div class="detail-row">
                        <div class="detail-label">Features:</div>
                        <div class="detail-value">${car.features.join(", ")}</div>
                    </div>
                    `
                        : ""
                    }
                </div>
                
                <div class="host-detail-section">
                    <h3>Pricing</h3>
                    <div class="detail-row">
                        <div class="detail-label">Daily Rate:</div>
                        <div class="detail-value">${car.daily_rate ? "ksh " + car.daily_rate.toFixed(2) : "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Weekly Rate:</div>
                        <div class="detail-value">${car.weekly_rate ? "ksh " + car.weekly_rate.toFixed(2) : "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Monthly Rate:</div>
                        <div class="detail-value">${car.monthly_rate ? "ksh " + car.monthly_rate.toFixed(2) : "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Min Rental Days:</div>
                        <div class="detail-value">${car.min_rental_days || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Max Rental Days:</div>
                        <div class="detail-value">${car.max_rental_days || "N/A"}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Min Age:</div>
                        <div class="detail-value">${car.min_age_requirement ? car.min_age_requirement + " years" : "N/A"}</div>
                    </div>
                </div>
            </div>
            
            <div class="host-detail-section">
                <h3>Description</h3>
                <div class="detail-value" style="padding: 12px; background-color: #f9f9f9; border-radius: 4px; min-height: 60px;">
                    ${car.description || "No description provided"}
                </div>
            </div>
            
            ${
              car.rules
                ? `
            <div class="host-detail-section">
                <h3>Rules</h3>
                <div class="detail-value" style="padding: 12px; background-color: #f9f9f9; border-radius: 4px; min-height: 60px;">
                    ${car.rules}
                </div>
            </div>
            `
                : ""
            }
            
            ${
              car.location_name
                ? `
            <div class="host-detail-section">
                <h3>Location</h3>
                <div class="detail-row">
                    <div class="detail-label">Location:</div>
                    <div class="detail-value">${car.location_name}</div>
                </div>
                ${
                  car.latitude && car.longitude
                    ? `
                <div class="detail-row">
                    <div class="detail-label">Coordinates:</div>
                    <div class="detail-value">${car.latitude}, ${car.longitude}</div>
                </div>
                `
                    : ""
                }
            </div>
            `
                : ""
            }
            
            <div class="host-detail-section">
                <h3>Account Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Listing Created:</div>
                    <div class="detail-value">${new Date(car.created_at).toLocaleString()}</div>
                </div>
                ${
                  car.updated_at
                    ? `
                <div class="detail-row">
                    <div class="detail-label">Last Updated:</div>
                    <div class="detail-value">${new Date(car.updated_at).toLocaleString()}</div>
                </div>
                `
                    : ""
                }
                <div class="detail-row">
                    <div class="detail-label">Complete:</div>
                    <div class="detail-value">${car.is_complete ? "Yes" : "No"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Hidden:</div>
                    <div class="detail-value">${car.is_hidden ? "Yes" : "No"}</div>
                </div>
            </div>
            
            <div class="action-buttons" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
                ${
                  car.verification_status === "awaiting"
                    ? `
                    <button class="btn btn-primary" onclick="approveCar(${car.id}, true)">Approve</button>
                    <button class="btn btn-secondary" onclick="rejectCarPrompt(${car.id}, true)">Reject</button>
                `
                    : car.verification_status === "denied"
                      ? `
                    <button class="btn btn-primary" onclick="approveCar(${car.id}, true)">Approve</button>
                `
                      : ""
                }
                ${
                  car.is_hidden
                    ? `<button class="btn btn-primary" onclick="showCar(${car.id}, true)">Show Car</button>`
                    : `<button class="btn btn-secondary" onclick="hideCar(${car.id}, true)">Hide Car</button>`
                }
                <button class="btn btn-danger" onclick="deleteCarConfirm(${car.id}, '${car.name || car.model || "Car"}', true)">Delete Car</button>
            </div>
        `;

    loadCarMediaSection(carId);
  } catch (error) {
    console.error("Error loading car details:", error);
    carDetailContent.innerHTML = `<div class="empty-state">Error loading car details: ${error.message}</div>`;
  }
}

// Approve car
async function approveCar(carId, reloadAfter = false) {
  if (!confirm("Are you sure you want to approve this car listing?")) {
    return;
  }

  try {
    await api.approveCar(carId);
    alert("Car approved successfully");
    if (reloadAfter) {
      viewCarDetails(carId);
    } else {
      loadCars();
    }
  } catch (error) {
    alert("Error approving car: " + error.message);
  }
}

// Reject car prompt
function rejectCarPrompt(carId, reloadAfter = false) {
  const reason = prompt("Please provide a reason for rejection:");
  if (reason && reason.trim()) {
    rejectCar(carId, reason.trim(), reloadAfter);
  } else if (reason !== null) {
    alert("Rejection reason is required");
  }
}

// Reject car
async function rejectCar(carId, rejectionReason, reloadAfter = false) {
  try {
    await api.rejectCar(carId, rejectionReason);
    alert("Car rejected successfully");
    if (reloadAfter) {
      viewCarDetails(carId);
    } else {
      loadCars();
    }
  } catch (error) {
    alert("Error rejecting car: " + error.message);
  }
}

// Hide car
async function hideCar(carId, reloadAfter = false) {
  if (!confirm("Are you sure you want to hide this car from public listing?")) {
    return;
  }

  try {
    await api.hideCar(carId);
    alert("Car hidden successfully");
    if (reloadAfter) {
      viewCarDetails(carId);
    } else {
      loadCars();
    }
  } catch (error) {
    alert("Error hiding car: " + error.message);
  }
}

// Show car
async function showCar(carId, reloadAfter = false) {
  try {
    await api.showCar(carId);
    alert("Car shown successfully");
    if (reloadAfter) {
      viewCarDetails(carId);
    } else {
      loadCars();
    }
  } catch (error) {
    alert("Error showing car: " + error.message);
  }
}

// Delete car confirmation
function deleteCarConfirm(carId, carName, reloadAfter = false) {
  if (
    !confirm(
      `Are you sure you want to permanently delete car "${carName}"? This action cannot be undone.`,
    )
  ) {
    return;
  }

  deleteCar(carId, reloadAfter);
}

// Delete car
async function deleteCar(carId, reloadAfter = false) {
  try {
    await api.deleteCar(carId);
    alert("Car deleted successfully");
    if (reloadAfter) {
      backToCarsList();
    } else {
      loadCars();
    }
  } catch (error) {
    alert("Error deleting car: " + error.message);
  }
}
