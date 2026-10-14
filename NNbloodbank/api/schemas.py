from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


BloodTypeLiteral = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]


class HospitalResponse(BaseModel):
    id: int
    name: str
    city: str
    lat: float
    lng: float


class StockItem(BaseModel):
    blood_type: str
    count: int


class StockHistoryItem(BaseModel):
    date: date
    blood_type: str
    count: int


class StockUpdateRequest(BaseModel):
    hospital_id: int
    blood_type: BloodTypeLiteral
    new_count: int = Field(ge=0)


class StockUpdateResponse(BaseModel):
    hospital_id: int
    blood_type: str
    count: int
    message: str


class InventoryExpiryBuckets(BaseModel):
    days_0_3: int
    days_4_7: int
    days_8_14: int
    days_over_14: int


class InventorySummaryResponse(BaseModel):
    total_units: int
    reserved_units: int
    critical_units: int
    high_units: int
    moderate_units: int
    healthy_units: int
    expiring_within_7_days: int


class InventoryBloodTypeItem(BaseModel):
    blood_type: str
    available_units: int
    reserved_units: int
    expiry_buckets: InventoryExpiryBuckets
    oldest_expiry_date: date | None
    status: Literal["healthy", "warning", "moderate", "high", "critical"]


class InventoryExpiryResponse(BaseModel):
    as_of: date
    summary: InventorySummaryResponse
    items: list[InventoryBloodTypeItem]


class ForecastItem(BaseModel):
    hospital_id: int
    hospital_name: str
    blood_type: str
    status: Literal["ok", "insufficient_data"]
    predicted_critical: bool | None
    confidence: float | None
    threshold_used: int


class NetworkForecastResponse(BaseModel):
    forecasts: list[ForecastItem]


class TransferSuggestionItem(BaseModel):
    rank: int
    suggestion_id: int
    from_hospital_id: int
    from_hospital_name: str
    to_hospital_id: int
    to_hospital_name: str
    blood_type: str
    quantity: int
    urgency: str
    status: str
    predicted_critical_within_48h: bool
    forecast_confidence: float | None
    current_stock: int
    threshold_used: int
    source_surplus_units: int
    earliest_expiry_date: date
    days_to_expiry: int
    reason: str


class TransferSuggestionResponse(BaseModel):
    framing: str
    ranking: list[str]
    count: int
    suggestions: list[TransferSuggestionItem]


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    hospital_id: int


class UserSignupRequest(BaseModel):
    name: str
    email: str
    password: str
    hospital_id: int


class UserLoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    success: bool
    user: UserResponse | None = None
    token: str | None = None
    message: str | None = None


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None


class ProfileUpdateResponse(BaseModel):
    success: bool
    user: UserResponse
    token: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


