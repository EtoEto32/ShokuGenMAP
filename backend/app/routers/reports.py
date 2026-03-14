from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from psycopg import Connection

from app.db import get_db
from app.repositories.reports import insert_visit_log, list_diagnosis_history, list_visit_history
from app.repositories.users import get_user_by_firebase_uid, upsert_user_from_auth

router = APIRouter(prefix="/reports", tags=["reports"])


class VisitCheckinBody(BaseModel):
    shop_id: int = Field(..., ge=1)
    source: str = Field(default="manual_checkin", min_length=1, max_length=30)


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


@router.get("/my")
def get_my_reports(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    conn: Connection = Depends(get_db),
) -> dict:
    user = _ensure_app_user(request, conn)
    diagnosis_history = list_diagnosis_history(conn, user_id=int(user["id"]), limit=limit)
    visit_history = list_visit_history(conn, user_id=int(user["id"]), limit=limit)
    return {
        "diagnosis_count": len(diagnosis_history),
        "visit_count": len(visit_history),
        "diagnosis_history": diagnosis_history,
        "visit_history": visit_history,
    }


@router.post("/visits/checkin")
def checkin_visit(
    body: VisitCheckinBody,
    request: Request,
    conn: Connection = Depends(get_db),
) -> dict:
    user = _ensure_app_user(request, conn)
    visit = insert_visit_log(
        conn,
        user_id=int(user["id"]),
        shop_id=body.shop_id,
        source=body.source,
    )
    return {"checked_in": True, "visit": visit}
