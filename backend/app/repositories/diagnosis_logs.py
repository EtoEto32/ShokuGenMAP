from psycopg import Connection


def insert_diagnosis_log(
    conn: Connection,
    *,
    user_id: int,
    mood_genre: str,
    time_level: str,
    volume_level: str,
    recommended_shop_id: int | None,
) -> dict:
    row = conn.execute(
        """
        INSERT INTO diagnosis_logs (
            user_id,
            mood_genre,
            time_level,
            volume_level,
            recommended_shop_id
        )
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, created_at
        """,
        (user_id, mood_genre, time_level, volume_level, recommended_shop_id),
    ).fetchone()
    conn.commit()

    return {
        "id": row[0],
        "created_at": row[1],
    }
