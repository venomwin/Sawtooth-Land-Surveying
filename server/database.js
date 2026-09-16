const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataDirectory = path.join(__dirname, "data");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const databasePath = path.join(dataDirectory, "applications.db");
const db = new sqlite3.Database(databasePath);

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      preferred_name TEXT,
      email TEXT NOT NULL,
      phone_country_code TEXT,
      phone_number TEXT NOT NULL,
      alternative_phone TEXT,
      preferred_contact_method TEXT,
      country_of_residence TEXT NOT NULL,
      city TEXT,
      region TEXT,
      postal_code TEXT,
      full_address TEXT,
      current_job_title TEXT,
      current_employer TEXT,
      total_surveying_experience REAL,
      senior_surveying_experience REAL,
      field_surveying_experience REAL,
      office_surveying_experience REAL,
      survey_specializations TEXT,
      work_authorized TEXT,
      requires_sponsorship TEXT,
      willing_to_relocate TEXT,
      available_start_date TEXT,
      supervised_teams TEXT,
      number_supervised INTEGER,
      technology_skills TEXT,
      software_skills TEXT,
      technical_summary TEXT,
      resume_text TEXT,
      applicant_declaration INTEGER NOT NULL DEFAULT 0,
      declaration_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS education (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      qualification_level TEXT,
      qualification_title TEXT NOT NULL,
      field_of_study TEXT,
      institution TEXT NOT NULL,
      country TEXT NOT NULL,
      city TEXT,
      completion_year TEXT,
      currently_studying INTEGER DEFAULT 0,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS professional_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      credential_type TEXT,
      credential_title TEXT NOT NULL,
      issuing_country TEXT NOT NULL,
      issuing_region TEXT,
      issuing_authority TEXT,
      credential_number TEXT,
      issue_date TEXT,
      expiry_date TEXT,
      credential_status TEXT,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      employer TEXT NOT NULL,
      job_title TEXT NOT NULL,
      country TEXT,
      city TEXT,
      region TEXT,
      employment_type TEXT,
      start_date TEXT,
      end_date TEXT,
      currently_employed INTEGER DEFAULT 0,
      responsibilities TEXT,
      major_projects TEXT,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_experience (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      project_name TEXT,
      project_type TEXT,
      country TEXT,
      location TEXT,
      applicant_role TEXT,
      project_duration TEXT,
      equipment_software TEXT,
      project_description TEXT,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS applicant_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      reference_name TEXT NOT NULL,
      organization TEXT,
      job_title TEXT,
      relationship TEXT,
      email TEXT,
      phone TEXT,
      country TEXT,
      permission_to_contact INTEGER DEFAULT 0,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS application_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
    );
  `);
});

module.exports = db;
