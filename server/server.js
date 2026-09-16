const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const applicationRoutes = require("./routes/applications");

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:8000";
const sessions = new Map();

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  return token;
}

function readCookie(request, name) {
  const cookies = request.headers.cookie?.split(";").map((cookie) => cookie.trim()) || [];
  const value = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : "";
}

function requireAdmin(request, response, next) {
  const token = readCookie(request, "admin_session");
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    sessions.delete(token);
    return response.status(401).json({ success: false, message: "Admin authentication is required." });
  }
  return next();
}

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.post("/api/auth/login", (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ success: false, message: "Admin authentication is not configured." });
  if (typeof req.body?.password !== "string" || req.body.password.length === 0 || req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Incorrect admin password." });
  }
  const token = createSession();
  res.setHeader("Set-Cookie", `admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return res.json({ success: true });
});

app.post("/api/auth/logout", requireAdmin, (req, res) => {
  const token = readCookie(req, "admin_session");
  sessions.delete(token);
  res.setHeader("Set-Cookie", "admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  return res.json({ success: true });
});

app.get("/api/auth/session", requireAdmin, (req, res) => res.json({ success: true }));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Sawtooth Land Surveying application API is running" });
});

app.use("/api/applications", (req, res, next) => req.method === "POST" ? next() : requireAdmin(req, res, next), applicationRoutes);

app.listen(PORT, () => {
  console.log(`Sawtooth Land Surveying application API running at http://localhost:${PORT}`);
});
