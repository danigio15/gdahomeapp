"""Normalized data contract, independent of unverified provider payloads."""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from enum import StrEnum


class Utility(StrEnum):
    ELECTRICITY = "electricity"
    GAS = "gas"


class Unit(StrEnum):
    KWH = "kWh"
    CUBIC_METERS = "m3"
    STANDARD_CUBIC_METERS = "Smc"


class Quality(StrEnum):
    ACTUAL = "actual"
    ESTIMATED = "estimated"
    UNKNOWN = "unknown"


def consumption_value(value: object) -> Decimal | None:
    """Accept machine-readable nonnegative values; never guess localized formats."""
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise ValueError("Unsupported consumption value type")
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        raise ValueError("Invalid consumption value") from None
    if not number.is_finite() or number < 0:
        raise ValueError("Consumption must be finite and nonnegative")
    return number


def _utc(value: datetime) -> datetime:
    if not isinstance(value, datetime) or value.utcoffset() is None:
        raise ValueError("A timezone-aware timestamp is required")
    return value.astimezone(UTC)


@dataclass(frozen=True, slots=True)
class ConsumptionInterval:
    start: datetime
    end: datetime
    value: Decimal | None
    unit: Unit
    quality: Quality = Quality.UNKNOWN

    def __post_init__(self) -> None:
        if _utc(self.end) <= _utc(self.start):
            raise ValueError("Consumption period must have positive duration")
        if not isinstance(self.unit, Unit) or not isinstance(self.quality, Quality):
            raise ValueError("Explicit unit and quality enums are required")
        if self.value is not None:
            if not isinstance(self.value, Decimal):
                raise ValueError(
                    "Normalize consumption values before creating intervals"
                )
            consumption_value(self.value)

    @property
    def duration(self) -> timedelta:
        return _utc(self.end) - _utc(self.start)


@dataclass(frozen=True, slots=True)
class SupplySnapshot:
    # Identifiers may contain personal data and must not enter diagnostic output.
    supply_id: str = field(repr=False)
    utility: Utility
    intervals: tuple[ConsumptionInterval, ...]
    fetched_at: datetime

    def __post_init__(self) -> None:
        if not isinstance(self.supply_id, str) or not self.supply_id.strip():
            raise ValueError("A supply identifier is required")
        if not isinstance(self.utility, Utility):
            raise ValueError("An explicit utility enum is required")
        if not isinstance(self.intervals, tuple) or any(
            not isinstance(interval, ConsumptionInterval) for interval in self.intervals
        ):
            raise ValueError(
                "Intervals must be an immutable tuple of validated samples"
            )
        _utc(self.fetched_at)
        allowed = (
            {Unit.KWH}
            if self.utility is Utility.ELECTRICITY
            else {Unit.CUBIC_METERS, Unit.STANDARD_CUBIC_METERS}
        )
        if any(interval.unit not in allowed for interval in self.intervals):
            raise ValueError("Consumption unit does not match the utility")
