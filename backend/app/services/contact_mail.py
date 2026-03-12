import os
import json
from email.utils import formataddr
from urllib import error, request


class ContactMailConfigError(Exception):
    pass


class ContactMailDeliveryError(Exception):
    pass


def _get_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ContactMailConfigError(f"Missing env: {name}")
    return value


def send_contact_mail(name: str, email: str, subject: str, message: str) -> None:
    resend_api_key = _get_required_env("RESEND_API_KEY")
    from_email = _get_required_env("CONTACT_FROM_EMAIL")
    to_email = os.getenv("CONTACT_TO_EMAIL", "kainuma0904@gmail.com").strip() or "kainuma0904@gmail.com"
    from_name = os.getenv("CONTACT_FROM_NAME", "食ジャンMAP").strip() or "食ジャンMAP"

    text_body = (
        "\n".join(
            [
                "ShokuGenMAP お問い合わせ",
                "",
                f"お名前: {name}",
                f"メールアドレス: {email}",
                f"お問い合わせ項目: {subject}",
                "",
                "お問い合わせ内容:",
                message,
            ]
        )
    )
    payload = {
        "from": formataddr((from_name, from_email)),
        "to": [to_email],
        "subject": f"[ShokuGenMAPお問い合わせ] {subject}",
        "text": text_body,
        "reply_to": email,
    }
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url="https://api.resend.com/emails",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with request.urlopen(req, timeout=20) as res:
            if res.status >= 400:
                raise ContactMailDeliveryError(f"Resend API returned status {res.status}")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        if exc.code == 403 and "1010" in detail:
            raise ContactMailDeliveryError(
                "Resend access blocked (403/1010). "
                "APIキーの再発行、送信元アドレスの制約、Resend側のアクセス制限設定を確認してください。"
            ) from exc
        raise ContactMailDeliveryError(f"Resend API error ({exc.code}): {detail}") from exc
    except error.URLError as exc:
        raise ContactMailDeliveryError(f"Resend API connection failed: {exc.reason}") from exc
