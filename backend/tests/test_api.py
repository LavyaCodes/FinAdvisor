import asyncio

import httpx

from backend.app.main import app


def request_isolation_forest(payload: dict[str, object] | None = None, *, raw_content: bytes | None = None) -> httpx.Response:
    async def send_request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            if raw_content is not None:
                return await client.post(
                    "/transactions/anomaly/isolation-forest",
                    content=raw_content,
                    headers={"content-type": "application/json"},
                )
            return await client.post("/transactions/anomaly/isolation-forest", json=payload)

    return asyncio.run(send_request())


def test_health_endpoint_reports_ok() -> None:
    async def request_health() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/health")

    response = asyncio.run(request_health())

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_isolation_forest_endpoint_returns_flagged_positions(monkeypatch) -> None:
    import backend.app.main as main

    class PredictableModel:
        n_features_in_ = 1

        def predict(self, rows: list[list[float]]) -> list[int]:
            assert rows == [[10.0], [20.0], [30.0], [40.0], [1000.0]]
            return [1, 1, 1, 1, -1]

    monkeypatch.setattr(main, "load_default_isolation_forest", lambda: PredictableModel())
    response = request_isolation_forest({"expense_amounts": [10, 20, 30, 40, 1000]})

    assert response.status_code == 200
    assert response.json() == {
        "anomaly_indices": [4],
        "checked_count": 5,
        "model": "synthetic Isolation Forest experiment",
        "warning": "Flags indicate values unusual relative to synthetic training data, not fraud or misconduct.",
    }


def test_isolation_forest_endpoint_rejects_insufficient_or_invalid_amounts() -> None:
    insufficient = request_isolation_forest({"expense_amounts": [1, 2, 3, 4]})
    invalid = request_isolation_forest({"expense_amounts": [1, 2, 3, 4, -5]})
    non_finite = request_isolation_forest(raw_content=b'{"expense_amounts":[1,2,3,4,1e309]}')
    boolean_amount = request_isolation_forest({"expense_amounts": [1, 2, 3, 4, True]})
    extra_personal_data = request_isolation_forest({
        "expense_amounts": [1, 2, 3, 4, 5],
        "descriptions": ["private description"],
    })

    assert insufficient.status_code == 422
    assert "At least 5" in insufficient.json()["detail"]
    assert invalid.status_code == 422
    assert "non-negative" in invalid.json()["detail"]
    assert non_finite.status_code == 422
    assert boolean_amount.status_code == 422
    assert extra_personal_data.status_code == 422


def test_isolation_forest_endpoint_validates_values_before_loading_model(monkeypatch) -> None:
    import backend.app.main as main

    def unexpected_model_load():
        raise AssertionError("The model must not load for invalid request data.")

    monkeypatch.setattr(main, "load_default_isolation_forest", unexpected_model_load)

    negative = request_isolation_forest({"expense_amounts": [1, 2, 3, 4, -5]})
    non_finite = request_isolation_forest(raw_content=b'{"expense_amounts":[1,2,3,4,1e309]}')

    assert negative.status_code == 422
    assert non_finite.status_code == 422


def test_isolation_forest_endpoint_reports_missing_model_artifact(monkeypatch) -> None:
    import backend.app.main as main

    def missing_model():
        raise FileNotFoundError("missing")

    monkeypatch.setattr(main, "load_default_isolation_forest", missing_model)
    response = request_isolation_forest({"expense_amounts": [1, 2, 3, 4, 1000]})

    assert response.status_code == 503
    assert "model artifact is unavailable" in response.json()["detail"]


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
        b"date,description,amount,category\n2026-01-01,Salary,2500,Income\n2026-01-02,Groceries,-125.5,Food\n2026-01-03,Lunch,-12.25,Food\n2026-01-04,Refund,25,Food\n",
    )

    assert response.status_code == 200
    assert response.json() == {
        "total_income": 2525.0,
        "total_expenses": 137.75,
        "net_balance": 2387.25,
        "transaction_count": 4,
        "transactions": [
            {"date": "2026-01-01", "description": "Salary", "category": "Income", "amount": 2500.0},
            {"date": "2026-01-02", "description": "Groceries", "category": "Food", "amount": -125.5},
            {"date": "2026-01-03", "description": "Lunch", "category": "Food", "amount": -12.25},
            {"date": "2026-01-04", "description": "Refund", "category": "Food", "amount": 25.0},
        ],
        "category_expenses": {"Food": 137.75},
    }


def test_upload_labels_missing_category_as_uncategorized() -> None:
    response = upload_csv(
        "transactions.csv",
        b"date,description,amount\n2026-01-01,Coffee,-4.5\n2026-01-02,Salary,100\n",
    )

    assert response.status_code == 200
    assert response.json()["transactions"] == [
        {"date": "2026-01-01", "description": "Coffee", "category": "Uncategorized", "amount": -4.5},
        {"date": "2026-01-02", "description": "Salary", "category": "Uncategorized", "amount": 100.0},
    ]
    assert response.json()["category_expenses"] == {"Uncategorized": 4.5}


def test_upload_uses_uncategorized_for_blank_category_values() -> None:
    response = upload_csv(
        "transactions.csv",
        b"date,description,amount,category\n2026-01-01,Coffee,-4.5,  \n",
    )

    assert response.status_code == 200
    assert response.json()["transactions"][0]["category"] == "Uncategorized"
    assert response.json()["category_expenses"] == {"Uncategorized": 4.5}


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
