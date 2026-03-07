import os
from dataclasses import dataclass
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials


@dataclass(frozen=True)
class AuthUser:
    uid: str
    email: str | None
    name: str | None
    claims: dict[str, Any]


def init_firebase_admin() -> None:
    """
    Firebase Admin SDK を初期化する。

    - 本番/開発ともに service account JSON を使う想定
      (GOOGLE_APPLICATION_CREDENTIALS でパスを渡す)
    """
    if firebase_admin._apps:
        return

    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        raise RuntimeError(
            "GOOGLE_APPLICATION_CREDENTIALS is not set. "
            "Set it to your Firebase service account JSON path."
        )

    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)


def verify_bearer_token(id_token: str) -> AuthUser:
    init_firebase_admin()
    decoded = auth.verify_id_token(id_token)

    uid = str(decoded.get("uid") or decoded.get("user_id") or "")
    if not uid:
        raise ValueError("Token is missing uid")

    return AuthUser(
        uid=uid,
        email=decoded.get("email"),
        name=decoded.get("name"),
        claims=decoded,
    )

