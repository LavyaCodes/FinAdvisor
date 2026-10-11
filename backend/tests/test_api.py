import asyncio

import httpx

from backend.app.main import app


def test_health_endpoint_reports_ok() -> None:
    async def request_health() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/health")

    response = asyncio.run(request_health())

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def upload_csv(filename: str, content: bytes) -> httpx.Response:
    async def request_upload() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                "/transactions/upload",
                files={"file": (filename, content, "text/csv")},
            )

    return asyncio.run(request_upload())


def test_upload_summarizes_income_expenses_and_balance() -> None:
    response = upload_csv(
        "transactions.csv",
        b"date,description,amount\n2026-01-01,Salary,2500\n2026-01-02,Groceries,-125.5\n2026-01-03,Refund,25\n",
    )

    assert response.status_code == 200
    assert response.json() == {
        "total_income": 2525.0,
        "total_expenses": 125.5,
        "net_balance": 2399.5,
        "transaction_count": 3,
    }


def test_upload_rejects_non_csv_file() -> None:
    response = upload_csv("transactions.txt", b"date,description,amount\n")

    assert response.status_code == 400
    assert ".csv" in response.json()["detail"]


def test_upload_rejects_empty_file() -> None:
    response = upload_csv("transactions.csv", b"  \n")

    assert response.status_code == 400
    assert "empty" in response.json()["detail"]


def test_upload_rejects_missing_columns() -> None:
    response = upload_csv("transactions.csv", b"date,description\n2026-01-01,Coffee\n")

    assert response.status_code == 422
    assert "amount" in response.json()["detail"]


def test_upload_rejects_invalid_date_and_amount() -> None:
    invalid_date = upload_csv("transactions.csv", b"date,description,amount\nnot-a-date,Coffee,-3\n")
    invalid_amount = upload_csv("transactions.csv", b"date,description,amount\n2026-01-01,Coffee,unknown\n")

    assert invalid_date.status_code == 422
    assert "dates" in invalid_date.json()["detail"]
    assert invalid_amount.status_code == 422
    assert "amounts" in invalid_amount.json()["detail"]


def test_upload_rejects_duplicate_columns() -> None:
    response = upload_csv(
        "transactions.csv",
        b"date,description,amount,amount\n2026-01-01,Coffee,-3,4\n",
    )

    assert response.status_code == 422
    assert "unique" in response.json()["detail"]


def test_upload_enforces_file_and_transaction_limits() -> None:
    oversized_file = upload_csv("transactions.csv", b"x" * (5 * 1024 * 1024 + 1))
    too_many_rows = b"date,description,amount\n" + b"2026-01-01,Coffee,-1\n" * 10_001
    oversized_rows = upload_csv("transactions.csv", too_many_rows)

    assert oversized_file.status_code == 413
    assert oversized_rows.status_code == 413
