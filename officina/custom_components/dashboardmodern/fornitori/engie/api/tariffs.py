"""Exact offer matching against reviewed public terms; no inferred bill totals."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, timedelta
from types import MappingProxyType
from typing import TYPE_CHECKING

from .models import Utility
from .portal import SupplyStatus
from .tariff_catalog import TariffRate as TariffRate
from .tariff_catalog import VerifiedTariff as VerifiedTariff
from .tariff_catalog import load_tariff_catalog

if TYPE_CHECKING:
    from .mobile import MobileSupply

_LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True, repr=False)
class SupplyOffer:
    code: str
    price_type: str
    contract_type: str
    valid_from: date
    valid_until: date
    duration_months: int
    first_activation: date | None


def _load_verified_tariffs() -> MappingProxyType[str, VerifiedTariff]:
    """A damaged optional catalogue must not prevent account setup."""
    try:
        return load_tariff_catalog()
    except (OSError, ValueError) as err:
        _LOGGER.error("Tariff catalog unavailable; tariff sensors disabled: %s", err)
        return MappingProxyType({})


# Loaded once during integration import; updates take effect after a restart.
VERIFIED_TARIFFS = _load_verified_tariffs()


def parse_supply_offer(
    supply: dict, first_activation: date | None
) -> SupplyOffer | None:
    """Optional malformed offer data must not break consumption retrieval."""
    code = supply.get("prodottoCodiceUnivoco")
    if not isinstance(code, str) or not re.fullmatch(r"[A-Z0-9]{2,16}#[0-9]{5}", code):
        return None
    if supply.get("productCode") != code.split("#")[0]:
        return None
    price_type, contract_type = supply.get("priceType"), supply.get("tipoContratto")
    if not isinstance(price_type, str) or not isinstance(contract_type, str):
        return None
    duration = supply.get("durataCE")
    if type(duration) is not int or duration <= 0:
        return None
    dates = []
    for key in ("inizioCE", "fineCE"):
        value = supply.get(key)
        if not isinstance(value, str) or not re.fullmatch(
            r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value
        ):
            return None
        try:
            dates.append(date.fromisoformat(value))
        except ValueError:
            return None
    if dates[0] > dates[1] or dates[0].year == 9999:
        return None
    return SupplyOffer(
        code, price_type, contract_type, *dates, duration, first_activation
    )


def tariff_status(supply: MobileSupply, today: date) -> str:
    """Conservative first-period support; renewal terms need separate evidence."""
    if supply.status is not SupplyStatus.ACTIVE:
        return "inactive"
    offer = supply.offer
    if offer is None:
        return "missing_metadata"
    verified = VERIFIED_TARIFFS.get(offer.code)
    if verified is None:
        return "unverified_offer"
    rate = verified.rate(supply.utility)
    if rate is None:
        return "unverified_commodity"
    # These domestic labels have been observed in the Italian mobile response.
    domestic_type = (
        "Domestico residente"
        if supply.utility is Utility.ELECTRICITY
        else "A \u2013 Uso Domestico"
    )
    if offer.price_type != "FIXED" or offer.contract_type != domestic_type:
        return "unsupported_terms"
    if offer.first_activation != offer.valid_from:
        return "unverified_renewal"
    target_month = offer.valid_from.month - 1 + rate.duration_months
    target_year = offer.valid_from.year + target_month // 12
    target_month = target_month % 12 + 1
    try:
        anniversary = offer.valid_from.replace(year=target_year, month=target_month)
    except ValueError:
        anniversary = date(target_year, target_month, 28)
    if (
        offer.duration_months != rate.duration_months
        or offer.valid_until != anniversary - timedelta(days=1)
        or offer.valid_from < rate.offered_from
        or supply.activation_date is None
        or not offer.valid_from <= supply.activation_date <= offer.valid_until
    ):
        return "unsupported_terms"
    if today < max(offer.valid_from, supply.activation_date):
        return "not_yet_valid"
    if today > offer.valid_until:
        return "expired"
    return "verified"


def current_tariff(supply: MobileSupply, today: date) -> TariffRate | None:
    if tariff_status(supply, today) != "verified":
        return None
    return catalog_rate(supply)


def catalog_rate(supply: MobileSupply) -> TariffRate | None:
    """Return evidence for this exact code and commodity, regardless of dates."""
    if supply.offer is None:
        return None
    verified = VERIFIED_TARIFFS.get(supply.offer.code)
    return verified.rate(supply.utility) if verified is not None else None
