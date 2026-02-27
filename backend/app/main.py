import os

from fastapi import FastAPI

app = FastAPI(title="ShokuGenMAP API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    database_url = os.getenv("DATABASE_URL", "not-configured")
    return {
        "message": "ShokuGenMAP backend is running",
        "database_url": database_url,
    }
