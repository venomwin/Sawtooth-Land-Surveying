const API_BASE = window.SAWTOOTH_API_URL ? `${window.SAWTOOTH_API_URL}/api` : "/api";
const loginView = document.querySelector("#adminLogin");
const loginForm = document.querySelector("#adminLoginForm");
const loginStatus = document.querySelector("#adminLoginStatus");
const STATUS_OPTIONS = ["submitted", "under_review", "shortlisted", "interview", "accepted", "rejected"];
const STATUS_LABELS = {
  submitted: "Submitted",
  under_review: "Under Review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  accepted: "Accepted",
  rejected: "Rejected"
};

const state = { applications: [], filteredApplications: [], selectedId: null };
const elements = {
  dashboardView: document.querySelector("#dashboardView"),
  detailView: document.querySelector("#detailView"),
  statsGrid: document.querySelector("#statsGrid"),
  applicationList: document.querySelector("#applicationList"),
  listState: document.querySelector("#listState"),
  detailState: document.querySelector("#detailState"),
  applicationDetail: document.querySelector("#applicationDetail"),
  resultCount: document.querySelector("#resultCount"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  refreshButton: document.querySelector("#refreshButton"),
  backButton: document.querySelector("#backButton"),
  healthIndicator: document.querySelector("#healthIndicator"),
  sidebarApiStatus: document.querySelector("#sidebarApiStatus"),
  mobileMenuButton: document.querySelector("#mobileMenuButton"),
  adminSidebar: document.querySelector("#adminSidebar")
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return escapeHtml(value);
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "Size unavailable";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status) { return STATUS_LABELS[status] || "Submitted"; }
function statusClass(status) { return STATUS_OPTIONS.includes(status) ? status : "submitted"; }
function initials(application) { return `${application.first_name?.[0] || ""}${application.last_name?.[0] || ""}`.toUpperCase() || "?"; }

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}) }, ...options });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) {
    if (path === "/auth/session") {
      showLogin(result.message || "Admin authentication is required.");
      throw new Error("Authentication required.");
    }
    throw new Error(result.message || "Authentication failed.");
  }
  if (!response.ok) throw new Error(result.message || `Request failed (${response.status}).`);
  return result;
}

function showLogin(message = "") {
  loginView.hidden = false;
  document.querySelector(".admin-shell").hidden = true;
  loginStatus.textContent = message;
  loginStatus.hidden = !message;
  document.querySelector("#adminPassword").focus();
}

function showAdmin() {
  loginView.hidden = true;
  document.querySelector(".admin-shell").hidden = false;
}

function setHealth(online) {
  elements.healthIndicator.className = `health-indicator ${online ? "is-online" : "is-offline"}`;
  elements.healthIndicator.querySelector("span").textContent = online ? "SYSTEM ONLINE" : "API OFFLINE";
  elements.sidebarApiStatus.textContent = online ? "Online" : "Offline";
}

async function checkHealth() {
  try { await fetchJson("/health"); setHealth(true); } catch (error) { setHealth(false); }
}

function showState(target, title, message, withRetry = false) {
  target.hidden = false;
  target.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>${withRetry ? '<button class="button button-secondary retry-button" type="button">RETRY</button>' : ""}`;
}

function hideState(target) { target.hidden = true; target.textContent = ""; }

function renderStats() {
  const counts = Object.fromEntries(STATUS_OPTIONS.map((status) => [status, 0]));
  state.applications.forEach((application) => { if (counts[application.status] !== undefined) counts[application.status] += 1; });
  const stats = [{ label: "TOTAL APPLICATIONS", value: state.applications.length, className: "is-highlight" }, ...STATUS_OPTIONS.map((status) => ({ label: statusLabel(status).toUpperCase(), value: counts[status], className: "" }))];
  elements.statsGrid.innerHTML = stats.map((stat) => `<article class="stat-card ${stat.className}"><span>${stat.label}</span><strong>${stat.value}</strong></article>`).join("");
}

function applicationSearchText(application) {
  return ["first_name", "middle_name", "last_name", "preferred_name", "email", "phone_number", "country_of_residence", "city", "current_job_title", "current_employer"].map((field) => application[field] || "").join(" ").toLowerCase();
}

function applyFilters() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const selectedStatus = elements.statusFilter.value;
  state.filteredApplications = state.applications.filter((application) => (selectedStatus === "all" || application.status === selectedStatus) && (!query || applicationSearchText(application).includes(query)));
  renderApplicationList();
}

function renderApplicationList() {
  elements.resultCount.textContent = `(${state.filteredApplications.length})`;
  if (!state.filteredApplications.length) {
    elements.applicationList.innerHTML = "";
    showState(elements.listState, state.applications.length ? "NO MATCHES" : "NO APPLICATIONS YET", state.applications.length ? "Try a different search or status filter." : "Applications submitted through the public application form will appear here.");
    return;
  }
  hideState(elements.listState);
  elements.applicationList.innerHTML = state.filteredApplications.map((application) => `<article class="application-row" data-application-id="${escapeHtml(application.id)}">
    <div class="applicant-name"><span class="avatar">${escapeHtml(initials(application))}</span><div><strong>${displayValue(`${application.first_name || ""} ${application.last_name || ""}`.trim())}</strong><small>${displayValue(application.email)}</small></div></div>
    <div><span class="cell-label">POSITION</span><span class="cell-value">—</span></div>
    <div><span class="cell-label">LOCATION</span><span class="cell-value">—</span></div>
    <div><span class="cell-label">STATUS</span><span class="status-badge status-${statusClass(application.status)}">${escapeHtml(statusLabel(application.status))}</span></div>
    <div><span class="cell-label">SUBMITTED</span><span class="cell-value">${formatDate(application.created_at)}</span></div>
    <button class="view-button" type="button" data-view-id="${escapeHtml(application.id)}">VIEW APPLICATION</button>
  </article>`).join("");
}

async function loadApplications() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.innerHTML = "↻ LOADING...";
  showState(elements.listState, "LOADING APPLICATIONS...", "Reading the application register.");
  try {
    const result = await fetchJson("/applications");
    state.applications = Array.isArray(result) ? result.slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))) : [];
    renderStats();
    applyFilters();
  } catch (error) {
    state.applications = [];
    renderStats();
    elements.applicationList.innerHTML = "";
    showState(elements.listState, "Unable to load applications.", "Check that the application server is running.", true);
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.innerHTML = "<span aria-hidden=\"true\">↻</span> REFRESH";
  }
}

function dataItem(label, value, wide = false, multiline = false) {
  return `<div class="data-item ${wide ? "is-wide" : ""}"><dt>${escapeHtml(label)}</dt><dd class="${multiline ? "multiline" : ""}">${value}</dd></div>`;
}

function detailSection(title, content) { return `<section class="detail-section"><h2>${escapeHtml(title)}</h2>${content}</section>`; }
function dataGrid(items) {
  const content = items.map((item) => Array.isArray(item) ? dataItem(...item) : item).join("");
  return `<dl class="data-grid">${content}</dl>`;
}

function renderRecordCards(records, fields, titleField) {
  if (!records.length) return '<p class="empty-record">No records were returned for this section.</p>';
  return `<div class="record-grid">${records.map((record, index) => `<article class="record-card"><h3>${displayValue(record[titleField]) === "—" ? `Record ${index + 1}` : displayValue(record[titleField])}</h3>${dataGrid(fields.map(([label, field, wide, multiline]) => dataItem(label, field === "end_date" && record.currently_employed ? "Current Position" : displayValue(record[field]), wide, multiline)))}</article>`).join("")}</div>`;
}

function documentCanView(document) { return /^application\/pdf$|^image\//i.test(document.mime_type || "") || /^text\//i.test(document.mime_type || ""); }
function renderDocuments(documents) {
  if (!documents.length) return '<p class="empty-record">No documents were returned for this application.</p>';
  return `<div class="document-list">${documents.map((document) => {
    const baseUrl = `${API_BASE}/applications/${encodeURIComponent(document.application_id)}/documents/${encodeURIComponent(document.id)}`;
    const view = documentCanView(document) ? `<a href="${baseUrl}" target="_blank" rel="noopener">VIEW</a>` : '<span class="empty-record">PREVIEW UNAVAILABLE</span>';
    return `<article class="document-row"><div class="document-name"><strong>${displayValue(document.original_filename)}</strong><small>${displayValue(document.document_type)} · ${formatBytes(document.file_size)} · ${formatDate(document.uploaded_at)}</small></div><div class="document-actions">${view}<a href="${baseUrl}?download=1">DOWNLOAD</a></div></article>`;
  }).join("")}</div>`;
}

function renderDetail(payload) {
  const application = payload.application || {};
  const specializations = parseList(application.survey_specializations);
  const title = `${application.first_name || ""} ${application.last_name || ""}`.trim() || "Unnamed applicant";
  const credentials = payload.credentials || [];
  const education = payload.education || [];
  const employment = payload.employment_history || [];
  const documentSection = renderDocuments(payload.documents || []);
  elements.applicationDetail.innerHTML = `<div class="detail-hero"><div><p class="eyebrow">APPLICATION DOSSIER / #${escapeHtml(application.id)}</p><h1 id="detailName">${escapeHtml(title)}</h1><p class="detail-meta">${displayValue(application.current_job_title)} · Submitted ${formatDate(application.created_at)}</p></div><div class="status-control"><label for="applicationStatus">STATUS</label><select id="applicationStatus">${STATUS_OPTIONS.map((status) => `<option value="${status}" ${application.status === status ? "selected" : ""}>${STATUS_LABELS[status]}</option>`).join("")}</select><button id="saveStatusButton" class="button" type="button">SAVE STATUS</button></div></div><div class="detail-sections">
    ${detailSection("PERSONAL INFORMATION", dataGrid([["First name", displayValue(application.first_name)], ["Middle name(s)", displayValue(application.middle_name)], ["Last name", displayValue(application.last_name)], ["Preferred name", displayValue(application.preferred_name)], ["Email", displayValue(application.email)], ["Phone", displayValue(`${application.phone_country_code || ""} ${application.phone_number || ""}`.trim())], ["Alternative phone", displayValue(application.alternative_phone)], ["Preferred contact", displayValue(application.preferred_contact_method)]]))}
    ${detailSection("LOCATION", dataGrid([["Country", displayValue(application.country_of_residence)], ["City", displayValue(application.city)], ["Region", displayValue(application.region)], ["Postal / ZIP", displayValue(application.postal_code)], ["Full address", displayValue(application.full_address), true, true]]))}
    ${detailSection("PROFESSIONAL PROFILE", dataGrid([["Current position", displayValue(application.current_job_title)], ["Current employer", displayValue(application.current_employer)], ["Total experience", application.total_surveying_experience === null || application.total_surveying_experience === undefined || application.total_surveying_experience === "" ? "—" : `${displayValue(application.total_surveying_experience)} years`], ["Senior experience", application.senior_surveying_experience === null || application.senior_surveying_experience === undefined || application.senior_surveying_experience === "" ? "—" : `${displayValue(application.senior_surveying_experience)} years`], ["Field experience", application.field_surveying_experience === null || application.field_surveying_experience === undefined || application.field_surveying_experience === "" ? "—" : `${displayValue(application.field_surveying_experience)} years`], ["Office experience", application.office_surveying_experience === null || application.office_surveying_experience === undefined || application.office_surveying_experience === "" ? "—" : `${displayValue(application.office_surveying_experience)} years`]]))}
    ${detailSection("SURVEYING SPECIALIZATIONS", specializations.length ? `<div class="tag-list">${specializations.map((item) => `<span class="tag">${displayValue(item)}</span>`).join("")}</div>` : '<p class="empty-record">No specializations were returned.</p>')}
    ${detailSection("EDUCATION", renderRecordCards(education, [["Level", "qualification_level"], ["Field of study", "field_of_study"], ["Institution", "institution"], ["Country", "country"], ["City", "city"], ["Completion year", "completion_year"], ["Currently studying", "currently_studying"]], "qualification_title"))}
    ${detailSection("PROFESSIONAL CREDENTIALS", renderRecordCards(credentials, [["Type", "credential_type"], ["Issuing country", "issuing_country"], ["Region", "issuing_region"], ["Issuing authority", "issuing_authority"], ["Registration number", "credential_number"], ["Issue date", "issue_date"], ["Expiry date", "expiry_date"], ["Status", "credential_status"]], "credential_title"))}
    ${detailSection("EMPLOYMENT HISTORY", renderRecordCards(employment, [["Job title", "job_title"], ["Country", "country"], ["City", "city"], ["Region", "region"], ["Employment type", "employment_type"], ["Start date", "start_date"], ["End date", "end_date"], ["Responsibilities", "responsibilities", true, true], ["Major projects", "major_projects", true, true]], "employer"))}
    ${application.resume_text ? detailSection("RESUME TEXT", `<div class="resume-panel">${displayValue(application.resume_text)}</div>`) : ""}
    ${detailSection("DOCUMENTS", documentSection)}
  </div>`;
  document.querySelector("#saveStatusButton").addEventListener("click", () => saveStatus(application.id));
}

async function openApplication(id) {
  state.selectedId = id;
  elements.dashboardView.hidden = true;
  elements.detailView.hidden = false;
  elements.applicationDetail.innerHTML = "";
  showState(elements.detailState, "LOADING APPLICATION...", "Assembling the applicant dossier.");
  try {
    const payload = await fetchJson(`/applications/${encodeURIComponent(id)}`);
    hideState(elements.detailState);
    renderDetail(payload);
  } catch (error) {
    showState(elements.detailState, "Unable to load application.", error.message);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveStatus(id) {
  const select = document.querySelector("#applicationStatus");
  const button = document.querySelector("#saveStatusButton");
  if (!select || !button) return;
  button.disabled = true;
  button.textContent = "SAVING...";
  try {
    await fetchJson(`/applications/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
    await loadApplications();
    await openApplication(id);
  } catch (error) {
    button.disabled = false;
    button.textContent = "SAVE STATUS";
    showState(elements.detailState, "STATUS NOT SAVED", error.message);
  }
}

function showDashboard() {
  elements.detailView.hidden = true;
  elements.dashboardView.hidden = false;
  state.selectedId = null;
  window.location.hash = "applications";
}

elements.searchInput.addEventListener("input", applyFilters);
elements.statusFilter.addEventListener("change", applyFilters);
elements.refreshButton.addEventListener("click", () => { checkHealth(); loadApplications(); });
elements.backButton.addEventListener("click", showDashboard);
elements.applicationList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-id]");
  if (button) openApplication(button.dataset.viewId);
});
elements.listState.addEventListener("click", (event) => { if (event.target.closest(".retry-button")) loadApplications(); });
elements.mobileMenuButton.addEventListener("click", () => {
  const isOpen = elements.adminSidebar.classList.toggle("is-open");
  elements.mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
});
document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => elements.adminSidebar.classList.remove("is-open")));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.hidden = true;
  try {
    await fetchJson("/auth/login", { method: "POST", body: JSON.stringify({ password: loginForm.elements.password.value }) });
    loginForm.reset();
    showAdmin();
    checkHealth();
    loadApplications();
  } catch (error) {
    if (error.message !== "Authentication required.") {
      loginStatus.textContent = error.message;
      loginStatus.hidden = false;
    }
  }
});

fetchJson("/auth/session").then(() => {
  showAdmin();
  checkHealth();
  loadApplications();
}).catch(() => showLogin());
