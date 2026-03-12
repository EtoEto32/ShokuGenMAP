import os
import json
import base64
import hashlib
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
    try:
        init_firebase_admin()
        decoded = auth.verify_id_token(id_token)
    except Exception:
        # ローカル開発向け: Firebase service account 未設定時のフォールバック。
        # 必ず明示的に opt-in した場合のみ有効化する。
        if os.getenv("ALLOW_UNVERIFIED_AUTH_FOR_DEV", "false").lower() != "true":
            raise
        try:
            parts = id_token.split(".")
            if len(parts) < 2:
                raise ValueError("Invalid JWT format")
            payload = parts[1]
            payload += "=" * ((4 - len(payload) % 4) % 4)
            decoded = json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")).decode("utf-8"))
        except Exception:
            # JWT payload 解析にも失敗した場合の最終フォールバック（開発専用）
            pseudo_uid = f"dev-{hashlib.sha256(id_token.encode('utf-8')).hexdigest()[:24]}"
            decoded = {"uid": pseudo_uid, "email": None, "name": "dev-user"}

    uid = str(decoded.get("uid") or decoded.get("user_id") or "")
    if not uid:
        uid = str(decoded.get("sub") or "")
    if not uid:
        raise ValueError("Token is missing uid")

    return AuthUser(
        uid=uid,
        email=decoded.get("email"),
        name=decoded.get("name"),
        claims=decoded,
    )

