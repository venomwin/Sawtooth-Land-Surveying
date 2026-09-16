const express = require("express");
const cors = require("cors");
const path = require("path");

require("./database");
const applicationRoutes = require("./routes/applications");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Sawtooth Land Surveying application API is running" });
});

app.use("/api/applications", applicationRoutes);

app.listen(PORT, () => {
  console.log(`Sawtooth Land Surveying application API running at http://localhost:${PORT}`);
});
