from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.contact_mail import (
    ContactMailConfigError,
    ContactMailDeliveryError,
    send_contact_mail,
)

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactSendBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=320)
    subject: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1, max_length=4000)


@router.post("/send")
def send_contact(body: ContactSendBody) -> dict[str, bool]:
    if "@" not in body.email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email format")

    try:
        send_contact_mail(
            name=body.name.strip(),
            email=body.email.strip(),
            subject=body.subject.strip(),
            message=body.message.strip(),
        )
    except ContactMailConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Mail config error: {exc}",
        ) from exc
    except ContactMailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send contact email",
        ) from exc

    return {"sent": True}
