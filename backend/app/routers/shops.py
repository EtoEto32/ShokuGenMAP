import os
from urllib.parse import urlencode
from urllib.request import urlopen
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg import Connection

from app.db import get_db
from app.repositories.shops import get_cached_nearby_shops, upsert_shop

router = APIRouter(prefix="/shops", tags=["shops"])
NEARBY_RADIUS_METERS = 3000
CACHE_TTL_DAYS = 30

# アプリ内ジャンル -> Google Places 検索条件（暫定）
# keyword は日本語検索のヒット率を上げるために使う
GENRE_MAPPING: dict[str, dict[str, str]] = {
    "ご飯物": {"keyword": "定食 丼 ご飯もの", "type": "restaurant"},
    "ラーメン": {"keyword": "ラーメン", "type": "restaurant"},
    "うどん": {"keyword": "うどん", "type": "restaurant"},
    "そば": {"keyword": "そば", "type": "restaurant"},
}


def _places_api_key() -> str:
    # 優先: GOOGLE_PLACES_API_KEY, fallback: GOOGLE_MAPS_API_KEY
    key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Places API key is not configured",
        )
    return key


def _is_chain_shop(name: str) -> bool:
    normalized = name.lower()
    chain_keywords = [
        "マクドナルド",
        "すき家",
        "松屋",
        "吉野家",
        "サイゼリヤ",
        "ガスト",
        "くら寿司",
        "はま寿司",
        "ココス",
        "kfc",
        "mcdonald",
        "starbucks",
        "burger king",
        "ドトール",
        "タリーズ",
        "コメダ",
        "サンマルク",
        "日高屋",
    ]
    return any(k in normalized for k in chain_keywords)


@router.get("/nearby")
def get_nearby_shops(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    genre: str | None = Query(None),
    exclude_chain: bool = Query(False),
    conn: Connection = Depends(get_db),
) -> dict:
    """
    Google Places Nearby Search を叩いて、shops テーブルに place_id ベースで UPSERT する。
    """
    genre_rule = GENRE_MAPPING.get(genre) if genre else None

    cached = get_cached_nearby_shops(
        conn,
        lat=lat,
        lng=lng,
        radius_m=NEARBY_RADIUS_METERS,
        genre=genre,
        exclude_chain=exclude_chain,
        cache_ttl_days=CACHE_TTL_DAYS,
    )
    if cached:
        return {
            "source": "cache",
            "cache_ttl_days": CACHE_TTL_DAYS,
            "radius_m": NEARBY_RADIUS_METERS,
            "requested_genre": genre,
            "exclude_chain": exclude_chain,
            "count": len(cached),
            "shops": cached,
        }

    params = {
        "location": f"{lat},{lng}",
        # P0要件: 現在地3km以内
        "radius": NEARBY_RADIUS_METERS,
        "type": (genre_rule or {}).get("type", "restaurant"),
        "language": "ja",
        "key": _places_api_key(),
    }
    if genre:
        params["keyword"] = (genre_rule or {}).get("keyword", genre)

    url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?{urlencode(params)}"
    try:
        with urlopen(url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch Google Places nearby search",
        ) from exc

    places_status = payload.get("status")
    if places_status not in {"OK", "ZERO_RESULTS"}:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Places API error: {places_status}",
        )

    results = payload.get("results", [])
    saved: list[dict] = []

    for r in results:
        geometry = (r.get("geometry") or {}).get("location") or {}
        shop_data = {
            "place_id": r.get("place_id"),
            "name": r.get("name") or "unknown",
            "address": r.get("vicinity"),
            "lat": geometry.get("lat"),
            "lng": geometry.get("lng"),
            "primary_genre": genre,
            "google_types": r.get("types", []),
            "rating": r.get("rating"),
            "review_count": r.get("user_ratings_total"),
            "price_level": r.get("price_level"),
            "is_chain": _is_chain_shop(r.get("name") or ""),
        }

        if not shop_data["place_id"] or shop_data["lat"] is None or shop_data["lng"] is None:
            continue

        saved.append(upsert_shop(conn, shop_data))

    conn.commit()

    filtered = [s for s in saved if not (exclude_chain and s.get("is_chain"))]

    return {
        "source": "google_places",
        "cache_ttl_days": CACHE_TTL_DAYS,
        "radius_m": NEARBY_RADIUS_METERS,
        "requested_genre": genre,
        "exclude_chain": exclude_chain,
        "count": len(filtered),
        "shops": filtered,
    }

