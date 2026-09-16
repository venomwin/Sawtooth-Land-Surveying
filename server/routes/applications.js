const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const supabase = require("../supabase");

const router = express.Router();
const applicationStatuses = new Set(["submitted", "under_review", "shortlisted", "interview", "accepted", "rejected"]);
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "application-documents";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function safeOriginalName(filename) {
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getDocumentType(fieldname) {
  return { resume: "resume", license_documents: "license", qualification_documents: "qualification", portfolio: "portfolio" }[fieldname];
}

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

function ensureSupabase(res) {
  if (supabase) return true;
  res.status(503).json({ success: false, message: "Supabase is not configured on the application server." });
  return false;
}

async function cleanupFiles(paths) {
  if (supabase && paths.length) await supabase.storage.from(storageBucket).remove(paths).catch(() => {});
}

function recordRows(applicationId, body) {
  return {
    education: parseJsonField(body.education).map((item) => ({ application_id: applicationId, qualification_level: text(item.qualification_level), qualification_title: text(item.qualification_title), field_of_study: text(item.field_of_study), institution: text(item.institution), country: text(item.country), city: text(item.city), completion_year: text(item.completion_year), currently_studying: bool(item.currently_studying) })),
    professional_credentials: parseJsonField(body.credentials).map((item) => ({ application_id: applicationId, credential_type: text(item.credential_type), credential_title: text(item.credential_title), issuing_country: text(item.issuing_country), issuing_region: text(item.issuing_region), issuing_authority: text(item.issuing_authority), credential_number: text(item.credential_number), issue_date: text(item.issue_date) || null, expiry_date: text(item.expiry_date) || null, credential_status: text(item.credential_status) })),
    employment_history: parseJsonField(body.employment_history).map((item) => ({ application_id: applicationId, employer: text(item.employer), job_title: text(item.job_title), country: text(item.country), city: text(item.city), region: text(item.region), employment_type: text(item.employment_type), start_date: text(item.start_date) || null, end_date: text(item.end_date) || null, currently_employed: bool(item.currently_employed), responsibilities: text(item.responsibilities), major_projects: text(item.major_projects) }))
  };
}

router.post("/", upload.fields([
  { name: "resume", maxCount: 1 },
  { name: "license_documents", maxCount: 10 },
  { name: "qualification_documents", maxCount: 10 },
  { name: "portfolio", maxCount: 5 }
]), async (req, res) => {
  if (!ensureSupabase(res)) return;
  const files = req.files || {};
  const body = req.body || {};
    const uploadedPaths = [];
    try {
      const applicationPayload = {
        first_name: text(body.first_name), middle_name: text(body.middle_name), last_name: text(body.last_name), preferred_name: text(body.preferred_name), email: text(body.email), phone_country_code: text(body.phone_country_code), phone_number: text(body.phone_number), alternative_phone: text(body.alternative_phone), preferred_contact_method: text(body.preferred_contact_method), country_of_residence: text(body.country_of_residence), city: text(body.city), region: text(body.region), postal_code: text(body.postal_code), full_address: text(body.full_address), current_job_title: text(body.current_job_title), current_employer: text(body.current_employer), total_surveying_experience: numberOrNull(body.total_surveying_experience), senior_surveying_experience: numberOrNull(body.senior_surveying_experience), field_surveying_experience: numberOrNull(body.field_surveying_experience), office_surveying_experience: numberOrNull(body.office_surveying_experience), survey_specializations: parseJsonField(body.survey_specializations), work_authorized: text(body.work_authorized), requires_sponsorship: text(body.requires_sponsorship), willing_to_relocate: text(body.willing_to_relocate), available_start_date: text(body.available_start_date) || null, supervised_teams: text(body.supervised_teams), number_supervised: numberOrNull(body.number_supervised), technology_skills: parseJsonField(body.technology_skills), software_skills: parseJsonField(body.software_skills), technical_summary: text(body.technical_summary), resume_text: text(body.resume_text), applicant_declaration: bool(body.applicant_declaration), declaration_name: text(body.declaration_name)
      };
      const inserted = await supabase.from("applications").insert(applicationPayload).select("id").single();
      if (inserted.error) throw inserted.error;
      const applicationId = inserted.data.id;
      for (const [table, records] of Object.entries(recordRows(applicationId, body))) {
        if (records.length) { const result = await supabase.from(table).insert(records); if (result.error) throw result.error; }
      }
      const documentRows = [];
      for (const [fieldname, uploaded] of Object.entries(files)) for (const file of uploaded) {
        const storagePath = `${applicationId}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeOriginalName(file.originalname)}`;
        const result = await supabase.storage.from(storageBucket).upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
        if (result.error) throw result.error;
        uploadedPaths.push(storagePath);
        documentRows.push({ application_id: applicationId, document_type: getDocumentType(fieldname), original_filename: file.originalname, storage_path: storagePath, mime_type: file.mimetype, file_size: file.size });
      }
      if (documentRows.length) { const result = await supabase.from("application_documents").insert(documentRows); if (result.error) throw result.error; }
      return res.status(201).json({ success: true, message: "Application submitted successfully.", applicationId });
    } catch (error) {
      await cleanupFiles(uploadedPaths);
      console.error("Application save failed:", error.message);
      return res.status(500).json({ success: false, message: "The application could not be saved. Please try again." });
    }
});

router.get("/", async (req, res) => {
  if (!ensureSupabase(res)) return;
  const result = await supabase.from("applications").select("id, first_name, last_name, email, status, created_at").order("created_at", { ascending: false });
  if (result.error) return res.status(500).json({ success: false, message: "Applications could not be loaded." });
  return res.json(result.data);
});

router.patch("/:id/status", express.json(), async (req, res) => {
  if (!ensureSupabase(res)) return;
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!applicationStatuses.has(status)) return res.status(400).json({ success: false, message: "Invalid application status." });

  try {
    const result = await supabase.from("applications").update({ status }).eq("id", req.params.id).select("id").single();
    if (result.error?.code === "PGRST116") return res.status(404).json({ success: false, message: "Application not found." });
    if (result.error) throw result.error;
    return res.json({ success: true, message: "Application status updated.", applicationId: result.data.id, status });
  } catch (error) {
    console.error("Application status update failed:", error.message);
    return res.status(500).json({ success: false, message: "The application status could not be updated." });
  }
});

router.get("/:id/documents/:documentId", async (req, res) => {
  if (!ensureSupabase(res)) return;
  try {
    const document = await supabase.from("application_documents").select("storage_path, original_filename").eq("id", req.params.documentId).eq("application_id", req.params.id).single();
    if (document.error) return res.status(404).json({ success: false, message: "Document not found." });
    const signed = await supabase.storage.from(storageBucket).createSignedUrl(document.data.storage_path, 600, { download: req.query.download === "1" ? document.data.original_filename : false });
    if (signed.error) return res.status(404).json({ success: false, message: "Document file not found." });
    return res.redirect(signed.data.signedUrl);
  } catch (error) {
    console.error("Document delivery failed:", error.message);
    return res.status(500).json({ success: false, message: "The document could not be loaded." });
  }
});

router.get("/:id", async (req, res) => {
  if (!ensureSupabase(res)) return;
  try {
    const [application, education, credentials, employment, projects, references, documents] = await Promise.all([
      supabase.from("applications").select("*").eq("id", req.params.id).single(), supabase.from("education").select("*").eq("application_id", req.params.id), supabase.from("professional_credentials").select("*").eq("application_id", req.params.id), supabase.from("employment_history").select("*").eq("application_id", req.params.id), supabase.from("project_experience").select("*").eq("application_id", req.params.id), supabase.from("applicant_references").select("*").eq("application_id", req.params.id), supabase.from("application_documents").select("*").eq("application_id", req.params.id)
    ]);
    if (application.error?.code === "PGRST116") return res.status(404).json({ success: false, message: "Application not found." });
    if (application.error || education.error || credentials.error || employment.error || projects.error || references.error || documents.error) return res.status(500).json({ success: false, message: "Application could not be loaded." });
    return res.json({ application: application.data, education: education.data, credentials: credentials.data, employment_history: employment.data, projects: projects.data, references: references.data, documents: documents.data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Application could not be loaded." });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ success: false, message: error.code === "LIMIT_FILE_SIZE" ? "Each uploaded file must be 10 MB or smaller." : error.message });
  next(error);
});

module.exports = router;
