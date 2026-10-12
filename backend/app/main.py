import csv
from io import BytesIO, StringIO
from math import isfinite

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pandas.errors import EmptyDataError, ParserError

app = FastAPI(title="FinAdvisor API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_TRANSACTIONS = 10_000


@app.get("/health")
def health_check() -> dict[str, str]:
    """Report that the API process is ready to receive requests."""
    return {"status": "ok"}


@app.post("/transactions/upload")
async def upload_transactions(file: UploadFile = File(...)) -> dict[str, object]:
    """Validate a CSV statement and return its summary and rows without retaining them."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a file with a .csv extension.")

    content = await file.read(MAX_FILE_SIZE + 1)
    await file.close()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="CSV file exceeds the 5 MB limit.")
    if not content.strip():
        raise HTTPException(status_code=400, detail="The uploaded CSV file is empty.")

    try:
        headers = next(csv.reader(StringIO(content.decode("utf-8-sig")), strict=True))
    except (UnicodeDecodeError, csv.Error, StopIteration):
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable CSV.") from None
    normalized_headers = [header.strip().lower() for header in headers]
    if len(normalized_headers) != len(set(normalized_headers)):
        raise HTTPException(status_code=422, detail="CSV column names must be unique.")

    try:
        transactions = pd.read_csv(BytesIO(content))
    except (EmptyDataError, ParserError, UnicodeDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable CSV.") from None

    transactions.columns = [str(column).strip().lower() for column in transactions.columns]
    missing_columns = {"date", "description", "amount"} - set(transactions.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing required column(s): {missing}.",
        )
    if transactions.empty:
        raise HTTPException(status_code=400, detail="The CSV contains no transactions.")
    if len(transactions) > MAX_TRANSACTIONS:
        raise HTTPException(
            status_code=413,
            detail=f"CSV exceeds the {MAX_TRANSACTIONS:,}-transaction limit.",
        )

    dates = pd.to_datetime(transactions["date"], errors="coerce", format="mixed")
    if dates.isna().any():
        raise HTTPException(status_code=422, detail="One or more transaction dates are invalid.")

    amounts = pd.to_numeric(transactions["amount"], errors="coerce")
    if amounts.isna().any() or not amounts.map(isfinite).all():
        raise HTTPException(status_code=422, detail="One or more transaction amounts are invalid.")

    total_income = float(amounts[amounts > 0].sum())
    total_expenses = float(-amounts[amounts < 0].sum())
    if not isfinite(total_income) or not isfinite(total_expenses):
        raise HTTPException(status_code=422, detail="Transaction totals exceed the supported numeric range.")

    # Categories are optional in uploaded CSVs, so give missing or blank ones a
    # predictable label that the dashboard can display and aggregate.
    if "category" in transactions.columns:
        categories = transactions["category"].fillna("").astype(str).str.strip()
        categories = categories.where(categories != "", "Uncategorized")
    else:
        categories = pd.Series("Uncategorized", index=transactions.index)

    descriptions = transactions["description"].fillna("").astype(str).str.strip()
    transaction_records = []
    category_expenses: dict[str, float] = {}
    for transaction_date, description, category, amount in zip(dates, descriptions, categories, amounts):
        amount_value = float(amount)
        category_name = str(category)
        transaction_records.append(
            {
                "date": transaction_date.strftime("%Y-%m-%d"),
                "description": description,
                "category": category_name,
                "amount": amount_value,
            }
        )
        if amount_value < 0:
            category_expenses[category_name] = category_expenses.get(category_name, 0.0) - amount_value

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net_balance": round(total_income - total_expenses, 2),
        "transaction_count": int(len(transactions)),
        "transactions": transaction_records,
        "category_expenses": {
            category: round(expense_total, 2)
            for category, expense_total in sorted(category_expenses.items())
        },
    }
