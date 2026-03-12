from psycopg import Connection


def add_favorite(conn: Connection, *, user_id: int, shop_id: int) -> dict:
    row = conn.execute(
        """
        INSERT INTO favorites (user_id, shop_id)
        VALUES (%s, %s)
        ON CONFLICT (user_id, shop_id) DO UPDATE
        SET user_id = EXCLUDED.user_id
        RETURNING id, user_id, shop_id, created_at
        """,
        (user_id, shop_id),
    ).fetchone()
    conn.commit()
    return {
        "id": row[0],
        "user_id": row[1],
        "shop_id": row[2],
        "created_at": row[3],
    }


def remove_favorite(conn: Connection, *, user_id: int, shop_id: int) -> bool:
    row = conn.execute(
        """
        DELETE FROM favorites
        WHERE user_id = %s AND shop_id = %s
        RETURNING id
        """,
        (user_id, shop_id),
    ).fetchone()
    conn.commit()
    return row is not None


def list_favorite_shops(conn: Connection, *, user_id: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            s.id,
            s.place_id,
            s.name,
            s.address,
            s.lat,
            s.lng,
            s.primary_genre,
            s.google_types,
            s.rating,
            s.review_count,
            s.price_level,
            s.is_chain,
            s.last_fetched_at,
            s.created_at,
            s.updated_at
        FROM favorites f
        JOIN shops s ON s.id = f.shop_id
        WHERE f.user_id = %s
        ORDER BY f.created_at DESC
        """,
        (user_id,),
    ).fetchall()

    return [
        {
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
        for row in rows
    ]
