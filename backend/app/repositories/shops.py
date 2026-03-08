import math
from typing import Any

from psycopg import Connection


def _row_to_shop(row) -> dict[str, Any]:
    return {
        "id": row[0],
        "place_id": row[1],
        "name": row[2],
        "address": row[3],
        "lat": row[4],
        "lng": row[5],
        "primary_genre": row[6],
        "google_types": row[7],
        "rating": row[8],
        "review_count": row[9],
        "price_level": row[10],
        "is_chain": row[11],
        "last_fetched_at": row[12],
        "created_at": row[13],
        "updated_at": row[14],
    }


def get_cached_nearby_shops(
    conn: Connection,
    *,
    lat: float,
    lng: float,
    radius_m: int,
    genre: str | None,
    exclude_chain: bool,
    cache_ttl_days: int,
) -> list[dict[str, Any]]:
    # まず矩形（lat/lng）で絞ってから、ハバーサインで正確な円判定を行う。
    # これで (lat, lng) インデックスを使いやすくする。
    lat_delta = radius_m / 111_320.0
    cos_lat = max(abs(math.cos(math.radians(lat))), 1e-6)
    lng_delta = radius_m / (111_320.0 * cos_lat)

    where_clauses = [
        "lat BETWEEN %(min_lat)s AND %(max_lat)s",
        "lng BETWEEN %(min_lng)s AND %(max_lng)s",
        "last_fetched_at >= NOW() - (%(ttl)s * INTERVAL '1 day')",
        """
        (
            6371000 * 2 * ASIN(
                SQRT(
                    POWER(SIN(RADIANS((lat - %(lat)s) / 2)), 2)
                    + COS(RADIANS(%(lat)s)) * COS(RADIANS(lat))
                    * POWER(SIN(RADIANS((lng - %(lng)s) / 2)), 2)
                )
            )
        ) <= %(radius_m)s
        """,
    ]
    if genre is not None:
        where_clauses.append("primary_genre = %(genre)s")
    if exclude_chain:
        where_clauses.append("is_chain = FALSE")

    query = f"""
        SELECT
            id, place_id, name, address, lat, lng,
            primary_genre, google_types, rating, review_count,
            price_level, is_chain, last_fetched_at, created_at, updated_at
        FROM shops
        WHERE {" AND ".join(where_clauses)}
        ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
        LIMIT 60
    """

    rowset = conn.execute(
        query,
        {
            "lat": lat,
            "lng": lng,
            "radius_m": radius_m,
            "min_lat": lat - lat_delta,
            "max_lat": lat + lat_delta,
            "min_lng": lng - lng_delta,
            "max_lng": lng + lng_delta,
            "genre": genre,
            "ttl": cache_ttl_days,
        },
    ).fetchall()

    return [_row_to_shop(r) for r in rowset]


def upsert_shop(conn: Connection, shop: dict[str, Any]) -> dict[str, Any]:
    row = conn.execute(
        """
        INSERT INTO shops (
            place_id,
            name,
            address,
            lat,
            lng,
            primary_genre,
            google_types,
            rating,
            review_count,
            price_level,
            is_chain
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (place_id)
        DO UPDATE SET
            name = EXCLUDED.name,
            address = EXCLUDED.address,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            primary_genre = EXCLUDED.primary_genre,
            google_types = EXCLUDED.google_types,
            rating = EXCLUDED.rating,
            review_count = EXCLUDED.review_count,
            price_level = EXCLUDED.price_level,
            is_chain = EXCLUDED.is_chain,
            last_fetched_at = NOW(),
            updated_at = NOW()
        RETURNING
            id, place_id, name, address, lat, lng,
            primary_genre, google_types, rating, review_count,
            price_level, is_chain, last_fetched_at, created_at, updated_at
        """,
        (
            shop["place_id"],
            shop["name"],
            shop.get("address"),
            shop["lat"],
            shop["lng"],
            shop.get("primary_genre"),
            shop.get("google_types", []),
            shop.get("rating"),
            shop.get("review_count"),
            shop.get("price_level"),
            shop.get("is_chain", False),
        ),
    ).fetchone()

    return _row_to_shop(row)

