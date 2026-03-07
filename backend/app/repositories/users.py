from typing import Any

from psycopg import Connection


def get_user_by_firebase_uid(conn: Connection, firebase_uid: str) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT id, firebase_uid, name, like_categories, created_at, updated_at
        FROM users
        WHERE firebase_uid = %s
        """,
        (firebase_uid,),
    ).fetchone()

    if not row:
        return None

    return {
        "id": row[0],
        "firebase_uid": row[1],
        "name": row[2],
        "like_categories": row[3],
        "created_at": row[4],
        "updated_at": row[5],
    }


def upsert_user_from_auth(
    conn: Connection,
    firebase_uid: str,
    name: str,
) -> dict[str, Any]:
    row = conn.execute(
        """
        INSERT INTO users (firebase_uid, name, like_categories)
        VALUES (%s, %s, %s)
        ON CONFLICT (firebase_uid)
        DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW()
        RETURNING id, firebase_uid, name, like_categories, created_at, updated_at
        """,
        (firebase_uid, name, []),
    ).fetchone()
    conn.commit()

    return {
        "id": row[0],
        "firebase_uid": row[1],
        "name": row[2],
        "like_categories": row[3],
        "created_at": row[4],
        "updated_at": row[5],
    }

