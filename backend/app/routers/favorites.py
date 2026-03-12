from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from psycopg import Connection

from app.db import get_db
from app.repositories.favorites import add_favorite, list_favorite_shops, remove_favorite
from app.repositories.users import get_user_by_firebase_uid, upsert_user_from_auth

router = APIRouter(prefix="/favorites", tags=["favorites"])


class FavoriteUpsertBody(BaseModel):
    shop_id: int = Field(..., ge=1)


def _ensure_app_user(request: Request, conn: Connection) -> dict:
    auth_user = getattr(request.state, "auth_user", None)
    if not auth_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    user = get_user_by_firebase_uid(conn, auth_user["uid"])
    if user:
        return user

    name = auth_user.get("name")
    if not name:
        email = auth_user.get("email") or ""
        name = email.split("@")[0] if "@" in email else "user"
    return upsert_user_from_auth(conn, auth_user["uid"], name)


@router.get("")
def get_favorites(
    request: Request,
    conn: Connection = Depends(get_db),
) -> dict:
    user = _ensure_app_user(request, conn)
    shops = list_favorite_shops(conn, user_id=int(user["id"]))
    return {"count": len(shops), "shops": shops}


@router.post("")
def create_favorite(
    body: FavoriteUpsertBody,
    request: Request,
    conn: Connection = Depends(get_db),
) -> dict:
    user = _ensure_app_user(request, conn)
    favorite = add_favorite(conn, user_id=int(user["id"]), shop_id=body.shop_id)
    return {"saved": True, "favorite": favorite}


@router.delete("/{shop_id}")
def delete_favorite(
    shop_id: int,
    request: Request,
    conn: Connection = Depends(get_db),
) -> dict:
    user = _ensure_app_user(request, conn)
    removed = remove_favorite(conn, user_id=int(user["id"]), shop_id=shop_id)
    return {"removed": removed}
