from fastapi import FastAPI

app = FastAPI(title="FinAdvisor API", version="0.1.0")


@app.get("/health")
def health_check() -> dict[str, str]:
    """Report that the API process is ready to receive requests."""
    return {"status": "ok"}
