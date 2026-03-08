import math

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from psycopg import Connection

from app.db import get_db
from app.repositories.diagnosis_logs import insert_diagnosis_log
from app.repositories.users import get_user_by_firebase_uid, upsert_user_from_auth
from app.routers.shops import get_nearby_shops

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])


class DiagnosisRunBody(BaseModel):
    mood_genre: str = Field(..., min_length=1, description="Q1: 今の気分ジャンル")
    time_level: str = Field(..., min_length=1, description="Q2: 時間レベル")
    volume_level: str = Field(..., min_length=1, description="Q3: 量レベル")
    lat: float = Field(..., ge=-90, le=90, description="現在地緯度")
    lng: float = Field(..., ge=-180, le=180, description="現在地経度")


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _max_distance_by_time_level(time_level: str) -> float:
    # Q2: 時間回答に応じた距離制限（km）
    return {"すぐ": 1.0, "少し": 2.0, "余裕": 3.0}.get(time_level, 2.0)


def _genre_match_weight(mood_genre: str, shop: dict) -> float:
    # Q1: ジャンル一致重み（暫定）
    if not mood_genre:
        return 0.0

    primary_genre = str(shop.get("primary_genre") or "")
    if primary_genre == mood_genre:
        return 3.0

    name = str(shop.get("name") or "")
    google_types = [str(t) for t in (shop.get("google_types") or [])]
    joined = f"{name} {' '.join(google_types)}"
    if mood_genre in joined:
        return 1.5
    return 0.0


def _volume_price_bonus(volume_level: str, price_level: int | None) -> float:
    if price_level is None:
        return 0.0

    # 暫定ロジック:
    # 少なめ -> 安めを優先
    # 多め   -> 中〜高価格を少し優先
    if volume_level == "少なめ":
        return 1.5 if price_level <= 1 else -0.5
    if volume_level == "多め":
        return 1.0 if price_level >= 2 else -0.5
    return 0.0


def _time_distance_penalty(time_level: str, distance_km: float) -> float:
    # 暫定ロジック:
    # すぐ -> 距離ペナルティ強
    # 余裕 -> 距離ペナルティ弱
    weight = {"すぐ": 2.0, "少し": 1.2, "余裕": 0.6}.get(time_level, 1.0)
    return weight * distance_km


def _get_auth_user(request: Request) -> dict | None:
    return getattr(request.state, "auth_user", None)


@router.post("/run")
def run_diagnosis(
    body: DiagnosisRunBody,
    request: Request,
    conn: Connection = Depends(get_db),
) -> dict:
    """
    5秒飯診断:
    - 入力を受信
    - 近傍店舗を取得
    - 暫定スコアで TOP1 推薦
    """
    nearby = get_nearby_shops(
        lat=body.lat,
        lng=body.lng,
        genre=body.mood_genre,
        exclude_chain=False,
        conn=conn,
    )
    shops = nearby.get("shops", [])
    if not shops:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No shops found")

    max_distance_km = _max_distance_by_time_level(body.time_level)
    ranked: list[dict] = []
    for s in shops:
        dist_km = _distance_km(body.lat, body.lng, float(s["lat"]), float(s["lng"]))
        # Q2: 距離制限（超過は候補から除外）
        if dist_km > max_distance_km:
            continue

        rating = float(s.get("rating") or 0.0)
        review_count = int(s.get("review_count") or 0)
        price_level = s.get("price_level")
        if price_level is not None:
            price_level = int(price_level)

        # 基本スコア:
        # score = rating_weight + distance_weight + genre_match + price_adjust
        rating_weight = rating * 2.0 + math.log(review_count + 1) * 0.6
        distance_weight = -_time_distance_penalty(body.time_level, dist_km)
        genre_match = _genre_match_weight(body.mood_genre, s)
        price_adjust = _volume_price_bonus(body.volume_level, price_level)
        score = rating_weight + distance_weight + genre_match + price_adjust

        ranked.append(
            {
                "shop": s,
                "distance_km": round(dist_km, 3),
                "score": round(score, 3),
                "score_breakdown": {
                    "rating_weight": round(rating_weight, 3),
                    "distance_weight": round(distance_weight, 3),
                    "genre_match": round(genre_match, 3),
                    "price_adjust": round(price_adjust, 3),
                },
            }
        )

    if not ranked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No shops found within distance limit ({max_distance_km}km)",
        )

    ranked.sort(key=lambda x: x["score"], reverse=True)
    top1 = ranked[0]
    recommended_shop = top1["shop"]

    # ログ保存（認証が取れた場合のみ）
    log = None
    auth_user = _get_auth_user(request)
    if auth_user:
        user = get_user_by_firebase_uid(conn, auth_user["uid"])
        if not user:
            display_name = auth_user.get("name")
            if not display_name:
                email = auth_user.get("email") or ""
                display_name = email.split("@")[0] if "@" in email else "user"
            user = upsert_user_from_auth(conn, auth_user["uid"], display_name)

        log = insert_diagnosis_log(
            conn,
            user_id=int(user["id"]),
            mood_genre=body.mood_genre,
            time_level=body.time_level,
            volume_level=body.volume_level,
            recommended_shop_id=int(recommended_shop["id"]) if recommended_shop.get("id") else None,
        )

    return {
        "received": True,
        "input": {
            "mood_genre": body.mood_genre,
            "time_level": body.time_level,
            "volume_level": body.volume_level,
            "lat": body.lat,
            "lng": body.lng,
        },
        "max_distance_km": max_distance_km,
        "recommended_shop": recommended_shop,
        "distance_km": top1["distance_km"],
        "score": top1["score"],
        "score_breakdown": top1["score_breakdown"],
        "diagnosis_log": log,
        "log_saved": log is not None,
    }
