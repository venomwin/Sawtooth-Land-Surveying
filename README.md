# Sawtooth Land Surveying Application System

## Run locally

Start the API:

```powershell
cd server
npm install
npm run dev
```

In a second terminal, serve the project root so root-relative images resolve:

```powershell
npx serve .
```

Open `http://localhost:3000/forms.html` using the port printed by the static server. The API health endpoint is `http://localhost:3001/api/health`.

The form submits `multipart/form-data` with browser-generated boundaries to `POST http://localhost:3001/api/applications`. Repeatable records are serialized as JSON fields and stored in their relational SQLite tables. Uploaded documents are stored under `server/uploads/`, and the database is created at `server/data/applications.db`.

Useful API routes:

- `GET /api/health`
- `POST /api/applications`
- `GET /api/applications`
- `GET /api/applications/:id`
