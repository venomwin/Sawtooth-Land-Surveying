const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("../database");

const router = express.Router();
const applicationStatuses = new Set(["submitted", "under_review", "shortlisted", "interview", "accepted", "rejected"]);
const uploadDirectories = {
  resume: path.join(__dirname, "../uploads/resumes"),
  license: path.join(__dirname, "../uploads/licenses"),
  qualification: path.join(__dirname, "../uploads/qualifications"),
  portfolio: path.join(__dirname, "../uploads/portfolios")
};
Object.values(uploadDirectories).forEach((directory) => fs.mkdirSync(directory, { recursive: true }));

function safeOriginalName(filename) {
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getDocumentType(fieldname) {
  return { resume: "resume", license_documents: "license", qualification_documents: "qualification", portfolio: "portfolio" }[fieldname];
}

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const directory = { resume: uploadDirectories.resume, license_documents: uploadDirectories.license, qualification_documents: uploadDirectories.qualification, portfolio: uploadDirectories.portfolio }[file.fieldname];
    callback(null, directory);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeOriginalName(path.basename(file.originalname, extension))}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

function parseJsonField(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value) {
  const parsed = Number(value);
  return value === "" || value === undefined || Number.isNaN(parsed) ? null : parsed;
}

function bool(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function onRun(error) { error ? reject(error) : resolve(this); }));
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function cleanupFiles(files) {
  Object.values(files || {}).flat().forEach((file) => {
    fs.rm(file.path, { force: true }, () => {});
  });
}

router.post("/", upload.fields([
  { name: "resume", maxCount: 1 },
  { name: "license_documents", maxCount: 10 },
  { name: "qualification_documents", maxCount: 10 },
  { name: "portfolio", maxCount: 5 }
]), async (req, res) => {
  const files = req.files || {};
  const body = req.body || {};
  const education = parseJsonField(body.education);
  const credentials = parseJsonField(body.credentials);
  const employment = parseJsonField(body.employment_history);
  const projects = parseJsonField(body.projects);
  const references = parseJsonField(body.references);
  const errors = {};
  const required = ["first_name", "last_name", "email", "phone_number", "country_of_residence", "declaration_name"];

  required.forEach((field) => { if (!text(body[field])) errors[field] = "This field is required."; });
  if (text(body.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(body.email))) errors.email = "Enter a valid email address.";
  if (!bool(body.applicant_declaration)) errors.applicant_declaration = "You must confirm the declaration.";
  if (!Array.isArray(education) || education.length === 0) errors.education = "Add at least one education record.";
  if (!files.resume?.length && !text(body.resume_text)) errors.resume = "Upload a resume or paste resume text.";

  if (Object.keys(errors).length) {
    cleanupFiles(files);
    const fieldNames = Object.keys(errors).join(", ");
    return res.status(400).json({ success: false, message: `Please correct these fields: ${fieldNames}.`, errors });
  }

  try {
    await run("BEGIN TRANSACTION");
    const application = await run(`INSERT INTO applications (
      first_name, middle_name, last_name, preferred_name, email, phone_country_code, phone_number,
      alternative_phone, preferred_contact_method, country_of_residence, city, region, postal_code,
      full_address, current_job_title, current_employer, total_surveying_experience,
      senior_surveying_experience, field_surveying_experience, office_surveying_experience,
      survey_specializations, work_authorized, requires_sponsorship, willing_to_relocate,
      available_start_date, supervised_teams, number_supervised, technology_skills, software_skills,
      technical_summary, resume_text, applicant_declaration, declaration_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      text(body.first_name), text(body.middle_name), text(body.last_name), text(body.preferred_name), text(body.email), text(body.phone_country_code), text(body.phone_number), text(body.alternative_phone), text(body.preferred_contact_method), text(body.country_of_residence), text(body.city), text(body.region), text(body.postal_code), text(body.full_address), text(body.current_job_title), text(body.current_employer), numberOrNull(body.total_surveying_experience), numberOrNull(body.senior_surveying_experience), numberOrNull(body.field_surveying_experience), numberOrNull(body.office_surveying_experience), JSON.stringify(parseJsonField(body.survey_specializations)), text(body.work_authorized), text(body.requires_sponsorship), text(body.willing_to_relocate), text(body.available_start_date), text(body.supervised_teams), numberOrNull(body.number_supervised), JSON.stringify(parseJsonField(body.technology_skills)), JSON.stringify(parseJsonField(body.software_skills)), text(body.technical_summary), text(body.resume_text), bool(body.applicant_declaration) ? 1 : 0, text(body.declaration_name)
    ]);
    const applicationId = application.lastID;

    for (const item of education) await run(`INSERT INTO education (application_id, qualification_level, qualification_title, field_of_study, institution, country, city, completion_year, currently_studying) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [applicationId, text(item.qualification_level), text(item.qualification_title), text(item.field_of_study), text(item.institution), text(item.country), text(item.city), text(item.completion_year), bool(item.currently_studying) ? 1 : 0]);
    for (const item of credentials) await run(`INSERT INTO professional_credentials (application_id, credential_type, credential_title, issuing_country, issuing_region, issuing_authority, credential_number, issue_date, expiry_date, credential_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [applicationId, text(item.credential_type), text(item.credential_title), text(item.issuing_country), text(item.issuing_region), text(item.issuing_authority), text(item.credential_number), text(item.issue_date), text(item.expiry_date), text(item.credential_status)]);
    for (const item of employment) await run(`INSERT INTO employment_history (application_id, employer, job_title, country, city, region, employment_type, start_date, end_date, currently_employed, responsibilities, major_projects) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [applicationId, text(item.employer), text(item.job_title), text(item.country), text(item.city), text(item.region), text(item.employment_type), text(item.start_date), text(item.end_date), bool(item.currently_employed) ? 1 : 0, text(item.responsibilities), text(item.major_projects)]);
    for (const item of projects) await run(`INSERT INTO project_experience (application_id, project_name, project_type, country, location, applicant_role, project_duration, equipment_software, project_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [applicationId, text(item.project_name), text(item.project_type), text(item.country), text(item.location), text(item.applicant_role), text(item.project_duration), text(item.equipment_software), text(item.project_description)]);
    for (const item of references) await run(`INSERT INTO applicant_references (application_id, reference_name, organization, job_title, relationship, email, phone, country, permission_to_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [applicationId, text(item.reference_name), text(item.organization), text(item.job_title), text(item.relationship), text(item.email), text(item.phone), text(item.country), bool(item.permission_to_contact) ? 1 : 0]);
    for (const [fieldname, uploaded] of Object.entries(files)) for (const file of uploaded) await run(`INSERT INTO application_documents (application_id, document_type, original_filename, stored_filename, file_path, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)`, [applicationId, getDocumentType(fieldname), file.originalname, file.filename, path.relative(path.join(__dirname, ".."), file.path), file.mimetype, file.size]);

    await run("COMMIT");
    return res.status(201).json({ success: true, message: "Application submitted successfully.", applicationId });
  } catch (error) {
    await run("ROLLBACK").catch(() => {});
    cleanupFiles(files);
    console.error("Application transaction failed:", error.message);
    return res.status(500).json({ success: false, message: "The application could not be saved. Please try again." });
  }
});

router.get("/", async (req, res) => {
  try {
    res.json(await all("SELECT id, first_name, last_name, email, status, created_at FROM applications ORDER BY created_at DESC"));
  } catch (error) {
    res.status(500).json({ success: false, message: "Applications could not be loaded." });
  }
});

router.patch("/:id/status", express.json(), async (req, res) => {
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!applicationStatuses.has(status)) return res.status(400).json({ success: false, message: "Invalid application status." });

  try {
    const application = await get("SELECT id FROM applications WHERE id = ?", [req.params.id]);
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });
    await run("UPDATE applications SET status = ? WHERE id = ?", [status, req.params.id]);
    return res.json({ success: true, message: "Application status updated.", applicationId: application.id, status });
  } catch (error) {
    console.error("Application status update failed:", error.message);
    return res.status(500).json({ success: false, message: "The application status could not be updated." });
  }
});

router.get("/:id/documents/:documentId", async (req, res) => {
  try {
    const document = await get("SELECT * FROM application_documents WHERE id = ? AND application_id = ?", [req.params.documentId, req.params.id]);
    if (!document) return res.status(404).json({ success: false, message: "Document not found." });

    const uploadsRoot = path.resolve(__dirname, "../uploads");
    const filePath = path.resolve(__dirname, "..", document.file_path);
    if (!filePath.startsWith(`${uploadsRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Document file not found." });
    }

    if (req.query.download === "1") res.setHeader("Content-Disposition", `attachment; filename="${safeOriginalName(document.original_filename)}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error("Document delivery failed:", error.message);
    return res.status(500).json({ success: false, message: "The document could not be loaded." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const application = await get("SELECT * FROM applications WHERE id = ?", [req.params.id]);
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });
    const [education, credentials, employment, projects, references, documents] = await Promise.all([
      all("SELECT * FROM education WHERE application_id = ?", [req.params.id]),
      all("SELECT * FROM professional_credentials WHERE application_id = ?", [req.params.id]),
      all("SELECT * FROM employment_history WHERE application_id = ?", [req.params.id]),
      all("SELECT * FROM project_experience WHERE application_id = ?", [req.params.id]),
      all("SELECT * FROM applicant_references WHERE application_id = ?", [req.params.id]),
      all("SELECT * FROM application_documents WHERE application_id = ?", [req.params.id])
    ]);
    res.json({ application, education, credentials, employment_history: employment, projects, references, documents });
  } catch (error) {
    res.status(500).json({ success: false, message: "Application could not be loaded." });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ success: false, message: error.code === "LIMIT_FILE_SIZE" ? "Each uploaded file must be 10 MB or smaller." : error.message });
  next(error);
});

module.exports = router;
