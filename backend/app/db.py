import os
from collections.abc import Generator

import psycopg
from psycopg import Connection


def _database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url


def get_db() -> Generator[Connection, None, None]:
    """
    FastAPI の Depends で使う DB セッション用ジェネレータ。
    Request ごとに 1 コネクションを開いて閉じるシンプル構成。
    """
    with psycopg.connect(_database_url()) as conn:
        yield conn

