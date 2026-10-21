"""Read and validate the bundled public tariff catalogue without network access."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from importlib.resources import files
from pathlib import Path
from types import MappingProxyType
from urllib.parse import urlsplit

from .models import Utility


@dataclass(frozen=True, slots=True)
class TariffRate:
    unit_price: Decimal
    annual_fee: Decimal
    unit: str
    source_url: str
    source_sha256: str
    offered_from: date
    offered_until: date
    duration_months: int
    network_losses_included: bool | None = None
    reference_pcs_gj_smc: Decimal | None = None


@dataclass(frozen=True, slots=True)
class VerifiedTariff:
    electricity: TariffRate | None = None
    gas: TariffRate | None = None

    def rate(self, utility: Utility) -> TariffRate | None:
        return self.electricity if utility is Utility.ELECTRICITY else self.gas


class CatalogValidationError(ValueError):
    """The catalogue is incomplete, ambiguous or uses an unsupported format."""


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise CatalogValidationError("duplicate JSON key")
        result[key] = value
    return result


def _object(value: object, fields: set[str], context: str) -> dict:
    if not isinstance(value, dict) or set(value) != fields:
        raise CatalogValidationError(f"{context}: missing or unexpected fields")
    return value


def _decimal(value: object, context: str) -> Decimal:
    # Decimal strings preserve the precision printed in the source document.
    if not isinstance(value, str) or not re.fullmatch(
        r"(?:0|[1-9][0-9]*)(?:\.[0-9]+)?", value
    ):
        raise CatalogValidationError(f"{context}: expected non-negative decimal string")
    return Decimal(value)


def _date(value: object, context: str) -> date:
    if isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    raise CatalogValidationError(f"{context}: expected valid YYYY-MM-DD date")


def _source_url(value: object, context: str) -> str:
    valid = False
    if isinstance(value, str) and not any(char.isspace() for char in value):
        try:
            url = urlsplit(value)
            valid = (
                url.scheme == "https"
                and bool(url.hostname)
                and url.username is None
                and url.password is None
            )
        except ValueError:
            pass
    if not valid:
        raise CatalogValidationError(f"{context}: expected HTTPS source URL")
    return value


def _source_digest(value: object, context: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise CatalogValidationError(f"{context}: expected SHA-256 digest")
    return value


def _rate(value: object, utility: Utility, context: str) -> TariffRate:
    electricity = utility is Utility.ELECTRICITY
    extra = "network_losses_included" if electricity else "reference_pcs_gj_smc"
    data = _object(
        value,
        {
            "source_url",
            "source_sha256",
            "offered_from",
            "offered_until",
            "duration_months",
            "unit_price",
            "annual_fee",
            "unit",
            extra,
        },
        context,
    )
    unit = "EUR/kWh" if electricity else "EUR/Smc"
    if data["unit"] != unit:
        raise CatalogValidationError(f"{context}.unit: expected {unit}")
    offered_from = _date(data["offered_from"], f"{context}.offered_from")
    offered_until = _date(data["offered_until"], f"{context}.offered_until")
    if offered_from > offered_until:
        raise CatalogValidationError(f"{context}: reversed subscription dates")
    duration = data["duration_months"]
    if type(duration) is not int or duration <= 0:
        raise CatalogValidationError(
            f"{context}.duration_months: expected positive integer"
        )
    losses, pcs = None, None
    if electricity:
        losses = data[extra]
        if losses is not None and type(losses) is not bool:
            raise CatalogValidationError(f"{context}.{extra}: expected boolean or null")
    else:
        if data[extra] is not None:
            pcs = _decimal(data[extra], f"{context}.{extra}")
            if pcs <= 0:
                raise CatalogValidationError(
                    f"{context}.{extra}: expected positive PCS"
                )
    return TariffRate(
        _decimal(data["unit_price"], f"{context}.unit_price"),
        _decimal(data["annual_fee"], f"{context}.annual_fee"),
        unit,
        _source_url(data["source_url"], f"{context}.source_url"),
        _source_digest(data["source_sha256"], f"{context}.source_sha256"),
        offered_from,
        offered_until,
        duration,
        losses,
        pcs,
    )


def _offer(value: object, context: str) -> VerifiedTariff:
    if (
        not isinstance(value, dict)
        or not value
        or not set(value) <= {"electricity", "gas"}
    ):
        raise CatalogValidationError(
            f"{context}: expected at least one electricity or gas rate"
        )
    return VerifiedTariff(
        _rate(value["electricity"], Utility.ELECTRICITY, f"{context}.electricity")
        if "electricity" in value
        else None,
        _rate(value["gas"], Utility.GAS, f"{context}.gas") if "gas" in value else None,
    )


def parse_tariff_catalog(raw: str) -> MappingProxyType[str, VerifiedTariff]:
    """Validate the entire catalogue before exposing any prices."""
    try:
        data = json.loads(raw, object_pairs_hook=_unique_object)
    except json.JSONDecodeError as err:
        raise CatalogValidationError("invalid JSON") from err
    data = _object(data, {"schema_version", "offers"}, "catalog")
    if type(data["schema_version"]) is not int or data["schema_version"] != 2:
        raise CatalogValidationError("unsupported schema_version; expected 2")
    offers = data["offers"]
    if not isinstance(offers, dict) or not offers:
        raise CatalogValidationError("offers: expected non-empty object")
    result = {}
    for code, value in offers.items():
        if not re.fullmatch(r"[A-Z0-9]{2,16}#[0-9]{5}", code):
            raise CatalogValidationError("offers: invalid full offer code")
        result[code] = _offer(value, f"offers.{code}")
    return MappingProxyType(result)


def load_tariff_catalog() -> MappingProxyType[str, VerifiedTariff]:
    """Read a package resource, also when the client is installed from a wheel."""
    # Anchor on this module: editable installs can expose a namespace package
    # whose search path differs from the module's actual source directory.
    raw = files(__name__).joinpath("data", "tariffs.json").read_text(encoding="utf-8")
    return parse_tariff_catalog(raw)


def main() -> None:
    """Validate bundled data or a proposed catalogue; return nonzero on errors."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "path", nargs="?", type=Path, help="optional catalogue JSON path"
    )
    args = parser.parse_args()
    try:
        catalog = (
            parse_tariff_catalog(args.path.read_text(encoding="utf-8"))
            if args.path
            else load_tariff_catalog()
        )
    except (OSError, ValueError) as err:
        parser.exit(1, f"Invalid tariff catalog: {err}\n")
    print(f"Tariff catalog valid: {len(catalog)} offers")


if __name__ == "__main__":
    main()
