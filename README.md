# FinAdvisor

FinAdvisor is a React personal-finance dashboard with a small FastAPI service. CSV statements are validated and summarized in memory, and the dashboard displays their transactions and spending by category. Uploaded data is not persisted by the backend.

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

The health endpoint is `GET http://127.0.0.1:8000/health` and returns `{"status":"ok"}` when the API is running. Upload a statement with `POST /transactions/upload` as multipart form data using the `file` field. CSVs must contain `date`, `description`, and `amount` headers; `category` is optional. Negative amounts count as expenses and positive amounts count as income. Files are limited to 5 MB and 10,000 transactions. Processing is in memory only; uploaded data is not stored by the backend. A successful upload returns the existing `total_income`, `total_expenses`, `net_balance`, and `transaction_count` summary fields, plus a `transactions` array (`date`, `description`, `category`, and signed `amount`) and a `category_expenses` object. Missing or blank categories are labeled `Uncategorized`; category totals include expense amounts only, as positive values. Interactive API documentation is available at `/docs`.

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
- CSV uploads are validated and summarized in memory. The API returns aggregate income, expense, balance, and count values, individual transaction rows, and expense totals by category. The React app keeps the latest upload response in `App` state for the current session so it remains available while navigating between pages; neither the backend nor a database persists it.
- The AI Financial Assistant is a local, deterministic question-and-answer interface. It calculates largest expenses, spending by normalized category, and income/expense/net totals for a specified month or all uploaded transactions from session-held transaction records. It does not use a generative AI model or send transaction data to an external AI provider. Questions that are unsupported or cannot be answered from valid uploaded data receive a clarification or limitation message.

### Synthetic Isolation Forest experiment

The backend Isolation Forest is trained by `python -m backend.scripts.train_isolation_forest` on fixed-seed synthetic expense magnitudes only; its separate synthetic evaluation examples are generated locally. The saved artifact at `backend/model_artifacts/isolation_forest.joblib` is ignored by Git and loaded once per backend process. The optional Anomaly Detection panel sends only finite negative expense magnitudes to `POST /transactions/anomaly/isolation-forest`; descriptions, dates, and categories remain in the browser. The response contains indices only, which the frontend maps back to local transaction details. A flag is experimental and means unusual relative to the synthetic training distribution; it is not evidence of fraud or misconduct. If the artifact is missing or unreadable, the endpoint returns a service-unavailable error and the existing MAD detector remains available.

### AI Financial Assistant privacy and supported questions

Despite its product name, the assistant is rule-based and runs in the frontend; no transaction records are sent to a hosted model, external AI service, or new backend endpoint. It can answer questions about the largest expense, spending for a recognized category, income/expenses/net balance for a month specified as `January 2026` or `2026-01`, and the same totals across all uploaded transactions. It uses valid transaction amounts, considers negative values expenses and positive values income, and normalizes category aliases using the Budget Planner's mapping. Monthly totals use valid dated records only. Missing or invalid amounts and dates are excluded where needed and disclosed; unsupported questions, unknown categories, or months with no dated records receive a clarification or limitation rather than an invented figure. This is a session-only convenience, not professional financial advice.

This application is an educational project, not professional financial advice. No bank credentials or external API keys are requested in this phase.
