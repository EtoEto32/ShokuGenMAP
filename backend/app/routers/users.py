from fastapi import APIRouter, Depends, HTTPException, Request, status
from psycopg import Connection

from app.db import get_db
from app.repositories.users import get_user_by_firebase_uid, upsert_user_from_auth

router = APIRouter(prefix="/users", tags=["users"])


def _require_auth_user(request: Request) -> dict:
    user = getattr(request.state, "auth_user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return user


@router.get("/me")
def get_me(
    request: Request,
    conn: Connection = Depends(get_db),
) -> dict:
    auth_user = _require_auth_user(request)
    user = get_user_by_firebase_uid(conn, auth_user["uid"])

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Call POST /users/me on first login.",
        )

    return user


@router.post("/me")
def upsert_me(
    request: Request,
    conn: Connection = Depends(get_db),
) -> dict:
    """
    初回ログイン時: users を作成
    2回目以降: updated_at を更新しつつ返す
    """
    auth_user = _require_auth_user(request)

    # name は Firebase の claims から拾う。なければ email の手前 or "user"
    name = auth_user.get("name")
    if not name:
        email = auth_user.get("email") or ""
        name = email.split("@")[0] if "@" in email else "user"

    return upsert_user_from_auth(conn, auth_user["uid"], name)

