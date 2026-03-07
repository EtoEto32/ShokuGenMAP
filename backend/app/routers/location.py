from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/location", tags=["location"])


class LocationBody(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="緯度")
    lng: float = Field(..., ge=-180, le=180, description="経度")


@router.post("/coords")
def receive_coords(body: LocationBody) -> dict:
    """
    緯度経度を受け取るAPI（必要最低限）。
    後続で「現在地から3km以内の店舗」取得などに拡張する想定。
    """
    return {
        "received": True,
        "lat": body.lat,
        "lng": body.lng,
    }
