import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth import verify_bearer_token
from app.routers.favorites import router as favorites_router
from app.routers.contact import router as contact_router
from app.routers.diagnosis import router as diagnosis_router
from app.routers.location import router as location_router
from app.routers.reports import router as reports_router
from app.routers.shops import router as shops_router
from app.routers.users import router as users_router

app = FastAPI(title="ShokuGenMAP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://0.0.0.0:5173",
    ],
    allow_origin_regex=r"^https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("shokugen.backend")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    共通エラーハンドラ:
    - 想定外の例外は 500 + シンプルな JSON に統一
    """
    logger.exception("Unhandled error: %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


@app.middleware("http")
async def firebase_auth_middleware(request: Request, call_next):
    """
    Authorization: Bearer <Firebase ID Token> があれば検証して request.state に載せる。
    ルート側では必要なエンドポイントだけ 401 を返す（/users/me 等）。
    """
    request.state.auth_user = None

    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.removeprefix("Bearer ").strip()
        try:
            u = verify_bearer_token(token)
            request.state.auth_user = {
                "uid": u.uid,
                "email": u.email,
                "name": u.name,
                "claims": u.claims,
            }
        except Exception:
            # 無効トークンは「未認証扱い」に落とす（必要なAPIが 401 を返す）
            request.state.auth_user = None

    return await call_next(request)


app.include_router(users_router)
app.include_router(location_router)
app.include_router(shops_router)
app.include_router(diagnosis_router)
app.include_router(reports_router)
app.include_router(contact_router)
app.include_router(favorites_router)


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


@app.get("/auth/me")
def auth_me(request: Request) -> dict:
    """
    認証ユーザー取得API（Firebase ID Token が必要）
    """
    if not request.state.auth_user:
        return {"authenticated": False}

    u = request.state.auth_user
    return {
        "authenticated": True,
        "uid": u["uid"],
        "email": u.get("email"),
        "name": u.get("name"),
        "claims": u.get("claims", {}),
    }
