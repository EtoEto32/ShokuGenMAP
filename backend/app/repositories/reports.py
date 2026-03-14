from psycopg import Connection


def list_diagnosis_history(conn: Connection, *, user_id: int, limit: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            dl.id,
            dl.mood_genre,
            dl.time_level,
            dl.volume_level,
            dl.created_at,
            s.id,
            s.place_id,
            s.name,
            s.address,
            s.lat,
            s.lng,
            s.primary_genre,
            s.rating
        FROM diagnosis_logs dl
        LEFT JOIN shops s ON s.id = dl.recommended_shop_id
        WHERE dl.user_id = %s
        ORDER BY dl.created_at DESC
        LIMIT %s
        """,
        (user_id, limit),
    ).fetchall()

    return [
        {
            "id": row[0],
            "mood_genre": row[1],
            "time_level": row[2],
            "volume_level": row[3],
            "created_at": row[4],
            "recommended_shop": (
                {
                    "id": row[5],
                    "place_id": row[6],
                    "name": row[7],
                    "address": row[8],
                    "lat": row[9],
                    "lng": row[10],
                    "primary_genre": row[11],
                    "rating": row[12],
                }
                if row[5] is not None
                else None
            ),
        }
        for row in rows
    ]


def list_visit_history(conn: Connection, *, user_id: int, limit: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            vl.id,
            vl.source,
            vl.created_at,
            s.id,
            s.place_id,
            s.name,
            s.address,
            s.lat,
            s.lng,
            s.primary_genre,
            s.rating
        FROM visit_logs vl
        JOIN shops s ON s.id = vl.shop_id
        WHERE vl.user_id = %s
        ORDER BY vl.created_at DESC
        LIMIT %s
        """,
        (user_id, limit),
    ).fetchall()

    return [
        {
            "id": row[0],
            "source": row[1],
            "visited_at": row[2],
            "shop": {
                "id": row[3],
                "place_id": row[4],
                "name": row[5],
                "address": row[6],
                "lat": row[7],
                "lng": row[8],
                "primary_genre": row[9],
                "rating": row[10],
            },
        }
        for row in rows
    ]


def insert_visit_log(conn: Connection, *, user_id: int, shop_id: int, source: str) -> dict:
    row = conn.execute(
        """
        INSERT INTO visit_logs (user_id, shop_id, source)
        VALUES (%s, %s, %s)
        RETURNING id, user_id, shop_id, source, created_at
        """,
        (user_id, shop_id, source),
    ).fetchone()
    conn.commit()

    return {
        "id": row[0],
        "user_id": row[1],
        "shop_id": row[2],
        "source": row[3],
        "created_at": row[4],
    }
