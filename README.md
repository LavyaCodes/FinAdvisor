# FinAdvisor

FinAdvisor is a React personal-finance dashboard with a small FastAPI service. This Phase 1 setup makes the existing frontend runnable and exposes a backend health check. It does not yet process or store transaction data.

## Requirements

- Node.js 20.19+ or 22.12+ with npm (required by Vite 7)
- Python 3.10+

## Run the frontend

From the project root:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production bundle, run `npm run build`.

## Run the backend

From the project root, create and activate a virtual environment, then install the API requirements:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn app.main:app --reload --app-dir backend
```

The health endpoint is `GET http://127.0.0.1:8000/health` and returns `{"status":"ok"}` when the API is running. Upload a statement with `POST /transactions/upload` as multipart form data using the `file` field. CSVs must contain `date`, `description`, and `amount` headers; `category` is optional. Negative amounts count as expenses and positive amounts count as income. Files are limited to 5 MB and 10,000 transactions. Processing is in memory only; uploaded data is not stored. Interactive API documentation is available at `/docs`.

## Tests

Frontend tests use Vitest, jsdom, and Testing Library:

```powershell
npm test
```

Backend test dependencies are isolated from runtime requirements:

```powershell
python -m pip install -r backend\requirements-dev.txt
python -m pytest backend\tests
```

## Current architecture and scope

- `index.html` loads `src/main.jsx`, which mounts the existing `FinAdvisor.jsx` React app.
- `FinAdvisor-App.css` remains the stylesheet for the existing light-and-purple interface.
- `backend/app/main.py` contains the FastAPI app and health endpoint.
- CSV uploads are validated and summarized in memory. Only aggregate income, expense, balance, and count values are returned; transaction rows are not stored.

This application is an educational project, not professional financial advice. No bank credentials or external API keys are requested in this phase.
