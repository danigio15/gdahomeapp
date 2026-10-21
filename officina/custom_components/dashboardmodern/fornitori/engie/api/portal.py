"""Parse the observed dashboard supply schema, without retaining account data."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum

from .models import Utility


class PortalPayloadError(ValueError):
    """Unexpected provider schema; messages must not include payload values."""


class SupplyStatus(StrEnum):
    ACTIVE = "active"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class PortalSupply:
    supply_id: str = field(repr=False)
    utility: Utility
    status: SupplyStatus

    def __post_init__(self) -> None:
        if not isinstance(self.supply_id, str) or not self.supply_id.strip():
            raise PortalPayloadError("Missing supply identifier")
        if not isinstance(self.utility, Utility):
            raise PortalPayloadError("Unsupported supply utility")
        if not isinstance(self.status, SupplyStatus):
            raise PortalPayloadError("Unsupported supply status")


def parse_dashboard_supplies(payload: object) -> tuple[PortalSupply, ...]:
    """Read contractChains/forniture from decoded window.__data__.

    A supply record is not a consumption series. Deliberately discard profile,
    payment, address, POD/PDR and bill data, as well as unverified meter values.
    """
    if not isinstance(payload, Mapping):
        raise PortalPayloadError("Expected a dashboard object")
    chains = payload.get("contractChains")
    if not isinstance(chains, Mapping):
        raise PortalPayloadError("Missing or invalid contract chains")

    supplies = []
    identifiers: set[str] = set()
    utilities = {"Luce": Utility.ELECTRICITY, "Gas": Utility.GAS}
    for chain in chains.values():
        if not isinstance(chain, Mapping) or not isinstance(
            chain.get("forniture"), list
        ):
            raise PortalPayloadError("Missing or invalid supply list")
        for raw in chain["forniture"]:
            if not isinstance(raw, Mapping):
                raise PortalPayloadError("Expected a supply object")
            commodity = raw.get("commodity")
            if not isinstance(commodity, str) or commodity not in utilities:
                raise PortalPayloadError("Unsupported supply utility")
            supply = PortalSupply(
                supply_id=raw.get("id"),
                utility=utilities[commodity],
                status=(
                    SupplyStatus.ACTIVE
                    if raw.get("statoCalc") == "attiva"
                    else SupplyStatus.UNKNOWN
                ),
            )
            if supply.supply_id in identifiers:
                raise PortalPayloadError("Duplicate supply identifier")
            identifiers.add(supply.supply_id)
            supplies.append(supply)
    return tuple(supplies)
