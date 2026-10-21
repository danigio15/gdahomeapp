"""Verified mobile supply and electricity schemas; no HTTP or account dumps."""

import re
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from itertools import pairwise
from zoneinfo import ZoneInfo

from .errors import PayloadError, ServiceError
from .models import (
    ConsumptionInterval,
    Quality,
    SupplySnapshot,
    Unit,
    Utility,
    consumption_value,
)
from .portal import SupplyStatus
from .tariffs import SupplyOffer, parse_supply_offer

ROME = ZoneInfo("Europe/Rome")


def object_value(value: object) -> dict:
    if not isinstance(value, dict):
        raise PayloadError("Expected a response object")
    return value


def list_value(value: object) -> list:
    if not isinstance(value, list):
        raise PayloadError("Expected a response list")
    return value


def identifier(value: object) -> str:
    if (
        not isinstance(value, str)
        or not value.strip()
        or any(ord(c) < 32 or ord(c) == 127 for c in value)
    ):
        raise PayloadError("Missing or invalid identifier")
    return value


def iso_date(value: object) -> date:
    if not isinstance(value, str) or not re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value
    ):
        raise PayloadError("Expected an ISO calendar date")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise PayloadError("Invalid calendar date") from None


def service_error(status: int, payload: object) -> ServiceError:
    data = payload if isinstance(payload, dict) else {}
    code = data.get("errorCode")
    if type(code) is not int:
        code = None
    detail = data.get("detailedErrorCode")
    if isinstance(detail, (int, float, Decimal)) and not isinstance(detail, bool):
        detail = Decimal(str(detail))
        if not detail.is_finite():
            detail = None
    else:
        detail = None
    return ServiceError(status, code, detail)


def successful_payload(payload: object) -> dict:
    data = object_value(payload)
    if data.get("code") != "OK":
        if data.get("code") == "KO":
            raise service_error(200, data)
        raise PayloadError("Missing or unrecognized response status")
    for key in ("errorCode", "detailedErrorCode"):
        value = data.get(key)
        if value is not None and (isinstance(value, bool) or value != 0):
            raise service_error(200, data)
    return data


@dataclass(frozen=True, slots=True)
class MobileSupply:
    supply_id: str = field(repr=False)
    contract_id: str = field(repr=False)
    point_id: str = field(repr=False)
    utility: Utility
    status: SupplyStatus
    activation_date: date | None = field(repr=False)
    offer: SupplyOffer | None = field(default=None, repr=False)
    contracted_power: Decimal | None = field(default=None, repr=False)
    available_power: Decimal | None = field(default=None, repr=False)
    self_reading_window_start: date | None = field(default=None, repr=False)
    self_reading_window_end: date | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        for value in (self.supply_id, self.contract_id, self.point_id):
            identifier(value)
        if not isinstance(self.utility, Utility) or not isinstance(
            self.status, SupplyStatus
        ):
            raise PayloadError("Normalized utility and status are required")
        if self.activation_date is not None and type(self.activation_date) is not date:
            raise PayloadError("A calendar activation date is required")


class ServiceStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MIXED = "mixed"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class AccountMetadata:
    next_bill_date: date | None = None
    direct_debit: ServiceStatus = ServiceStatus.UNKNOWN
    digital_bill: ServiceStatus = ServiceStatus.UNKNOWN


def _optional_decimal(value: object) -> Decimal | None:
    try:
        return consumption_value(value)
    except ValueError:
        return None


def _optional_date(value: object) -> date | None:
    try:
        return iso_date(value)
    except PayloadError:
        return None


def _service_status(value: object) -> ServiceStatus:
    return {
        "y": ServiceStatus.ACTIVE,
        "n": ServiceStatus.INACTIVE,
    }.get(value, ServiceStatus.UNKNOWN)


def _aggregate_status(values: list[ServiceStatus]) -> ServiceStatus:
    if not values or ServiceStatus.UNKNOWN in values:
        return ServiceStatus.UNKNOWN
    unique = set(values)
    return next(iter(unique)) if len(unique) == 1 else ServiceStatus.MIXED


def parse_account_metadata(payload: object) -> AccountMetadata:
    """Normalize optional contract services without retaining account details."""
    data = successful_payload(payload)
    next_bills = []
    direct_debit = []
    digital_bill = []
    for raw_contract in list_value(data.get("listaContratti")):
        contract = object_value(raw_contract)
        raw_dates = contract.get("dataProxBol")
        if isinstance(raw_dates, list):
            next_bills.extend(
                parsed
                for value in raw_dates
                if (parsed := _optional_date(value)) is not None
            )
        sdd = contract.get("sdd")
        bol = contract.get("bol")
        direct_debit.append(
            _service_status(sdd.get("stato"))
            if isinstance(sdd, dict)
            else ServiceStatus.UNKNOWN
        )
        digital_bill.append(
            _service_status(bol.get("statoBOL"))
            if isinstance(bol, dict)
            else ServiceStatus.UNKNOWN
        )
    return AccountMetadata(
        min(next_bills) if next_bills else None,
        _aggregate_status(direct_debit),
        _aggregate_status(digital_bill),
    )


def parse_mobile_supplies(payload: object) -> tuple[MobileSupply, ...]:
    data = successful_payload(payload)
    result = []
    seen = set()
    for raw_contract in list_value(data.get("listaContratti")):
        contract = object_value(raw_contract)
        contract_id = identifier(contract.get("codContr"))
        raw_supplies = list_value(contract.get("forniture"))
        activations = [object_value(s).get("dataAttivazione") for s in raw_supplies]
        first_activation = (
            min(iso_date(value) for value in activations)
            if activations and all(value is not None for value in activations)
            else None
        )
        for raw_supply in raw_supplies:
            supply = object_value(raw_supply)
            commodity = supply.get("commodity")
            if commodity not in ("Luce", "Gas"):
                raise PayloadError("Unrecognized supply commodity")
            utility = Utility.ELECTRICITY if commodity == "Luce" else Utility.GAS
            point = object_value(supply.get("punto"))
            self_reading = supply.get("autolettura")
            self_reading = self_reading if isinstance(self_reading, dict) else {}
            window_start = _optional_date(self_reading.get("inizioFinestra"))
            window_end = _optional_date(self_reading.get("fineFinestra"))
            if window_start is None or window_end is None or window_end < window_start:
                window_start = window_end = None
            supply_id = identifier(supply.get("id"))
            if supply_id in seen:
                raise PayloadError("Duplicate supply identifier")
            seen.add(supply_id)
            activation = supply.get("dataAttivazione")
            result.append(
                MobileSupply(
                    supply_id,
                    contract_id,
                    identifier(
                        point.get("pod" if utility is Utility.ELECTRICITY else "pdr")
                    ),
                    utility,
                    SupplyStatus.ACTIVE
                    if supply.get("attiva") == "y"
                    else SupplyStatus.UNKNOWN,
                    iso_date(activation) if activation is not None else None,
                    parse_supply_offer(supply, first_activation),
                    _optional_decimal(point.get("potenzaImpegnata")),
                    _optional_decimal(point.get("potenzaConsumo")),
                    window_start,
                    window_end,
                )
            )
    return tuple(result)


class Granularity(StrEnum):
    DAY = "day"
    HOUR = "hour"


@dataclass(frozen=True, slots=True)
class ElectricityReadings:
    snapshot: SupplySnapshot
    granularity: Granularity
    last_update: date | None
    # Provider totals can be rounded independently; never add these to samples.
    year_totals: tuple[ConsumptionInterval, ...] = ()
    month_totals: tuple[ConsumptionInterval, ...] = ()
    day_total: ConsumptionInterval | None = None


@dataclass(frozen=True, slots=True)
class GasReadings:
    snapshot: SupplySnapshot
    last_update: date | None
    # Provider totals remain independent from the monthly samples.
    year_totals: tuple[ConsumptionInterval, ...] = ()
    month_totals: tuple[ConsumptionInterval, ...] = ()


def _midnight(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=ROME)


def _interval(
    item: dict, start: datetime, end: datetime, unit: Unit = Unit.KWH
) -> ConsumptionInterval:
    kind = item.get("totalType")
    if kind is not None and not isinstance(kind, str):
        raise PayloadError("Invalid measurement quality")
    kind = kind.upper() if kind is not None else None
    quality = {"REAL": Quality.ACTUAL, "ESTIMATED": Quality.ESTIMATED}.get(
        kind, Quality.UNKNOWN
    )
    if kind == "NOT_PROVIDED":
        value = None
    else:
        if "totalValue" not in item:
            raise PayloadError("Missing measurement value")
        try:
            value = consumption_value(item["totalValue"])
        except ValueError:
            raise PayloadError("Invalid measurement value") from None
    return ConsumptionInterval(start, end, value, unit, quality)


def _daily_interval(item: dict, day: date) -> ConsumptionInterval:
    return _interval(item, _midnight(day), _midnight(day + timedelta(days=1)))


def _last_update(data: dict) -> date | None:
    if "lastUpdate" not in data:
        raise PayloadError("Missing data update field")
    return iso_date(data["lastUpdate"]) if data["lastUpdate"] is not None else None


def _ordered(intervals: list[ConsumptionInterval]) -> tuple[ConsumptionInterval, ...]:
    result = sorted(intervals, key=lambda item: item.start.astimezone(UTC))
    for previous, current in pairwise(result):
        if previous.end.astimezone(UTC) > current.start.astimezone(UTC):
            raise PayloadError("Duplicate or overlapping consumption periods")
    return tuple(result)


def _year(value: object) -> int:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}", value):
        raise PayloadError("Invalid consumption year")
    year = int(value)
    if not 1 <= year < 9999:
        raise PayloadError("Invalid consumption year")
    return year


def parse_daily_electricity(
    payload: object,
    *,
    supply_id: str,
    fetched_at: datetime,
) -> ElectricityReadings:
    data = successful_payload(payload)
    series = object_value(data.get("consumptionsList"))
    start_year, end_year = _year(series.get("startYear")), _year(series.get("endYear"))
    if end_year < start_year:
        raise PayloadError("Reversed consumption year range")
    days, months, years = [], [], []
    for raw_year in list_value(series.get("years")):
        year_item = object_value(raw_year)
        year = _year(year_item.get("timeReference"))
        if not start_year <= year <= end_year:
            raise PayloadError("Consumption year outside requested range")
        years.append(
            _interval(
                year_item, _midnight(date(year, 1, 1)), _midnight(date(year + 1, 1, 1))
            )
        )
        for raw_month in list_value(year_item.get("months")):
            month_item = object_value(raw_month)
            reference = month_item.get("timeReference")
            if not isinstance(reference, str) or not re.fullmatch(
                r"[0-9]{4}-[0-9]{2}", reference
            ):
                raise PayloadError("Invalid consumption month")
            month = iso_date(reference + "-01")
            if month.year != year:
                raise PayloadError("Month does not belong to its year")
            next_month = (
                date(year + 1, 1, 1)
                if month.month == 12
                else date(year, month.month + 1, 1)
            )
            months.append(
                _interval(month_item, _midnight(month), _midnight(next_month))
            )
            for raw_day in list_value(month_item.get("days")):
                day_item = object_value(raw_day)
                day = iso_date(day_item.get("timeReference"))
                if (day.year, day.month) != (month.year, month.month):
                    raise PayloadError("Day does not belong to its month")
                days.append(_daily_interval(day_item, day))
    return ElectricityReadings(
        SupplySnapshot(supply_id, Utility.ELECTRICITY, _ordered(days), fetched_at),
        Granularity.DAY,
        _last_update(data),
        _ordered(years),
        _ordered(months),
    )


def parse_gas_last_update(payload: object) -> date | None:
    data = successful_payload(payload)
    if "lastUpdateDate" not in data:
        raise PayloadError("Missing gas data update field")
    value = data["lastUpdateDate"]
    return iso_date(value) if value is not None else None


def parse_monthly_gas(
    payload: object,
    *,
    supply_id: str,
    fetched_at: datetime,
    last_update: date | None,
) -> GasReadings:
    if last_update is not None and type(last_update) is not date:
        raise PayloadError("A calendar gas update date is required")
    data = successful_payload(payload)
    if "lastUpdate" not in data:
        raise PayloadError("Missing embedded gas data update field")
    embedded = data["lastUpdate"]
    if embedded not in (None, ""):
        embedded = iso_date(embedded)
        if last_update is not None and embedded != last_update:
            raise PayloadError("Gas update dates do not match")
        last_update = embedded
    series = object_value(data.get("consumptionsList"))
    start_year, end_year = _year(series.get("startYear")), _year(series.get("endYear"))
    if end_year < start_year:
        raise PayloadError("Reversed consumption year range")
    months, years = [], []
    for raw_year in list_value(series.get("years")):
        year_item = object_value(raw_year)
        year = _year(year_item.get("timeReference"))
        if not start_year <= year <= end_year:
            raise PayloadError("Consumption year outside requested range")
        years.append(
            _interval(
                year_item,
                _midnight(date(year, 1, 1)),
                _midnight(date(year + 1, 1, 1)),
                Unit.STANDARD_CUBIC_METERS,
            )
        )
        for raw_month in list_value(year_item.get("months")):
            month_item = object_value(raw_month)
            reference = month_item.get("timeReference")
            if not isinstance(reference, str) or not re.fullmatch(
                r"[0-9]{4}-[0-9]{2}", reference
            ):
                raise PayloadError("Invalid consumption month")
            month = iso_date(reference + "-01")
            if month.year != year:
                raise PayloadError("Month does not belong to its year")
            next_month = (
                date(year + 1, 1, 1)
                if month.month == 12
                else date(year, month.month + 1, 1)
            )
            months.append(
                _interval(
                    month_item,
                    _midnight(month),
                    _midnight(next_month),
                    Unit.STANDARD_CUBIC_METERS,
                )
            )
    ordered_months = _ordered(months)
    return GasReadings(
        SupplySnapshot(supply_id, Utility.GAS, ordered_months, fetched_at),
        last_update,
        _ordered(years),
        ordered_months,
    )


def _hour_start(day: date, value: object) -> datetime:
    if not isinstance(value, str) or not re.fullmatch(
        r"(?:[01][0-9]|2[0-3]):00", value
    ):
        raise PayloadError("Invalid hourly time reference")
    naive = datetime(day.year, day.month, day.day, int(value[:2]))
    candidates = set()
    for fold in (0, 1):
        utc = naive.replace(tzinfo=ROME, fold=fold).astimezone(UTC)
        if utc.astimezone(ROME).replace(tzinfo=None) == naive:
            candidates.add(utc)
    if len(candidates) != 1:
        raise PayloadError("Ambiguous or nonexistent local hour; offset required")
    return candidates.pop().astimezone(ROME)


def parse_hourly_electricity(
    payload: object,
    *,
    supply_id: str,
    fetched_at: datetime,
) -> ElectricityReadings:
    data = successful_payload(payload)
    series = object_value(data.get("consumptionsList"))
    day_item = object_value(series.get("day"))
    day = iso_date(day_item.get("day"))
    hours = []
    for raw_hour in list_value(day_item.get("consumptions")):
        hour = object_value(raw_hour)
        start = _hour_start(day, hour.get("timeReference"))
        end = (start.astimezone(UTC) + timedelta(hours=1)).astimezone(ROME)
        hours.append(_interval(hour, start, end))
    return ElectricityReadings(
        SupplySnapshot(supply_id, Utility.ELECTRICITY, _ordered(hours), fetched_at),
        Granularity.HOUR,
        _last_update(data),
        day_total=_daily_interval(day_item, day),
    )
