from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from enum import Enum
from pathlib import Path

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


DB_PATH = Path(__file__).with_name("blood_network.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"
DEFAULT_SHELF_LIFE_DAYS = 42


class Base(DeclarativeBase):
    pass


class BloodType(str, Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


class BloodBagStatus(str, Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    TRANSFERRED = "transferred"
    USED = "used"
    EXPIRED = "expired"


class Urgency(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TransferStatus(str, Enum):
    SUGGESTED = "suggested"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COMPLETED = "completed"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    city: Mapped[str] = mapped_column(String(80), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    blood_bags: Mapped[list["BloodBag"]] = relationship(back_populates="hospital")
    stock_snapshots: Mapped[list["StockSnapshot"]] = relationship(back_populates="hospital")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), nullable=False)

    hospital: Mapped[Hospital] = relationship()


class BloodBag(Base):
    __tablename__ = "blood_bags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), nullable=False)
    blood_type: Mapped[BloodType] = mapped_column(SqlEnum(BloodType), nullable=False)
    collection_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[BloodBagStatus] = mapped_column(
        SqlEnum(BloodBagStatus), default=BloodBagStatus.AVAILABLE, nullable=False
    )

    hospital: Mapped[Hospital] = relationship(back_populates="blood_bags")

    def __init__(self, **kwargs):
        shelf_life_days = kwargs.pop("shelf_life_days", DEFAULT_SHELF_LIFE_DAYS)
        super().__init__(**kwargs)
        if self.collection_date and not self.expiry_date:
            self.expiry_date = self.collection_date + timedelta(days=shelf_life_days)


class StockSnapshot(Base):
    __tablename__ = "stock_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), nullable=False)
    blood_type: Mapped[BloodType] = mapped_column(SqlEnum(BloodType), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    hospital: Mapped[Hospital] = relationship(back_populates="stock_snapshots")


class TransferSuggestion(Base):
    __tablename__ = "transfer_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    from_hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), nullable=False)
    to_hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), nullable=False)
    blood_type: Mapped[BloodType] = mapped_column(SqlEnum(BloodType), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    urgency: Mapped[Urgency] = mapped_column(SqlEnum(Urgency), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    status: Mapped[TransferStatus] = mapped_column(
        SqlEnum(TransferStatus), default=TransferStatus.SUGGESTED, nullable=False
    )

    from_hospital: Mapped[Hospital] = relationship(foreign_keys=[from_hospital_id])
    to_hospital: Mapped[Hospital] = relationship(foreign_keys=[to_hospital_id])


def get_engine(database_url: str = DATABASE_URL):
    return create_engine(database_url, future=True)


def get_session_factory(database_url: str = DATABASE_URL):
    return sessionmaker(bind=get_engine(database_url), autoflush=False, future=True)


def create_database(database_url: str = DATABASE_URL, reset: bool = False):
    engine = get_engine(database_url)
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return engine
