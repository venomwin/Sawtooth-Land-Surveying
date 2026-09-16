const API_URL = `${window.SAWTOOTH_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`}/api/applications`;
const form = document.querySelector("#applicationForm");
const statusBox = document.querySelector("#formStatus");

const repeatableConfig = {
  education: { templateId: "educationTemplate", containerId: "educationContainer", selector: ".education-item" },
  credentials: { templateId: "credentialsTemplate", containerId: "credentialsContainer", selector: ".credential-item" },
  employment: { templateId: "employmentTemplate", containerId: "employmentContainer", selector: ".employment-item" }
};

function addRepeatableItem(type) {
  const config = repeatableConfig[type];
  const template = document.querySelector(`#${config.templateId}`);
  const clone = template.content.cloneNode(true);
  document.querySelector(`#${config.containerId}`).appendChild(clone);
  updateRemoveButtons(type);
}

function updateRemoveButtons(type) {
  const config = repeatableConfig[type];
  const items = [...document.querySelectorAll(`#${config.containerId} ${config.selector}`)];
  items.forEach((item) => {
    item.querySelector(".remove-item-btn").hidden = items.length === 1;
  });
}

function collectItems(type, fields) {
  const config = repeatableConfig[type];
  return [...document.querySelectorAll(`#${config.containerId} ${config.selector}`)].map((item) => {
    const record = {};
    fields.forEach((field) => {
      const input = item.querySelector(`[name="${field}"]`);
      record[field] = input?.type === "checkbox" ? input.checked : input?.value.trim() || "";
    });
    return record;
  }).filter((record) => Object.values(record).some((value) => value === true || value));
}

function selectedValues(groupName) {
  return [...document.querySelectorAll(`[data-group="${groupName}"] input:checked`)].map((input) => input.value);
}

function toggleConditional(targetId, shouldShow) {
  const target = document.querySelector(`#${targetId}`);
  if (target) target.hidden = !shouldShow;
}

function setStatus(message, type = "error") {
  statusBox.hidden = false;
  statusBox.className = `form-status ${type}`;
  statusBox.textContent = message;
  statusBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearStatus() {
  statusBox.hidden = true;
  statusBox.textContent = "";
}

function getFieldLabel(field) {
  const label = field.labels?.[0] || field.closest("label");
  if (!label) return field.name || "this field";
  return label.textContent.replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim();
}

function showInvalidField() {
  const invalidField = [...form.elements].find((field) => !field.disabled && !field.checkValidity());
  if (!invalidField) return false;
  const fieldLabel = getFieldLabel(invalidField);
  invalidField.focus({ preventScroll: true });
  setStatus(`Please complete the required field: ${fieldLabel}.`);
  return true;
}

function showServerErrors(errors) {
  const fieldNames = Object.keys(errors || {});
  if (!fieldNames.length) return false;
  const firstField = fieldNames
    .map((fieldName) => form.elements[fieldName])
    .find((field) => field && !field.disabled);
  if (firstField) {
    firstField.focus({ preventScroll: true });
    setStatus(`Please correct: ${getFieldLabel(firstField)}.`);
  } else {
    setStatus(`Please correct these fields: ${fieldNames.join(", ")}.`);
  }
  return true;
}

Object.keys(repeatableConfig).forEach((type) => addRepeatableItem(type));
document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => addRepeatableItem(button.dataset.add)));
document.addEventListener("click", (event) => {
  if (!event.target.matches(".remove-item-btn")) return;
  const item = event.target.closest(".repeatable-card");
  const type = Object.keys(repeatableConfig).find((key) => item.matches(repeatableConfig[key].selector));
  if (type) {
    item.remove();
    updateRemoveButtons(type);
  }
});

document.querySelectorAll("[data-group] input[type=checkbox]").forEach((input) => input.addEventListener("change", () => {
  const target = input.dataset.otherTarget;
  if (target) toggleConditional(`${target}Wrap`, input.checked);
}));
document.querySelectorAll("input[name=supervised_teams]").forEach((input) => input.addEventListener("change", () => toggleConditional("supervisedNumberWrap", input.value === "Yes" && input.checked)));
document.addEventListener("change", (event) => {
  if (event.target.matches('[name="currently_employed"]')) {
    const endDate = event.target.closest(".employment-item")?.querySelector('[name="end_date"]');
    if (endDate) {
      endDate.disabled = event.target.checked;
      if (event.target.checked) endDate.value = "";
    }
  }
});

const collections = {
  education: ["qualification_level", "qualification_title", "field_of_study", "institution", "education_country", "education_city", "completion_year", "currently_studying"],
  credentials: ["credential_type", "credential_title", "issuing_country", "issuing_region", "issuing_authority", "credential_number", "issue_date", "expiry_date", "credential_status"],
  employment: ["employer", "job_title", "country", "city", "region", "employment_type", "start_date", "end_date", "currently_employed", "responsibilities", "major_projects"]
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();
  if (!form.checkValidity()) {
    showInvalidField();
    return;
  }
  const resumeFile = form.elements.resume.files[0];
  if (!resumeFile && !form.elements.resume_text.value.trim()) {
    setStatus("Upload a resume or paste resume text before submitting.");
    form.elements.resume_text.focus();
    return;
  }

  const submitButton = form.querySelector(".submit-btn");
  submitButton.disabled = true;
  submitButton.textContent = "SUBMITTING APPLICATION...";
  const data = new FormData(form);
  Object.entries(collections).forEach(([key, fields]) => {
    data.set(key === "employment" ? "employment_history" : key, JSON.stringify(collectItems(key, fields)));
  });
  data.set("survey_specializations", JSON.stringify(selectedValues("specializations")));

  try {
    const response = await fetch(API_URL, { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok || !result.success) {
      if (showServerErrors(result.errors)) throw new Error("validation");
      throw new Error(result.message || "The application could not be submitted.");
    }
    window.location.assign(`success.html?id=${encodeURIComponent(result.applicationId)}`);
  } catch (error) {
    if (error.message !== "validation") {
      setStatus(error.message.includes("Failed to fetch") ? "Unable to submit your application right now. Please check that the local application server is running and try again." : error.message);
    }
    submitButton.disabled = false;
    submitButton.textContent = "SUBMIT APPLICATION →";
  }
});
