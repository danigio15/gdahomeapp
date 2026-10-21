"""Allowlisted metadata only, not a sanitizer for arbitrary provider responses."""

from collections.abc import Iterable

from .models import Quality, SupplySnapshot
from .portal import PortalSupply


def portal_summary(supplies: Iterable[PortalSupply]) -> dict:
    """Report verified supply metadata, never raw account or meter fields."""
    return {
        "schema_version": 1,
        "supplies": [
            {"utility": supply.utility.value, "status": supply.status.value}
            for supply in supplies
        ],
    }


def diagnostic_summary(snapshots: Iterable[SupplySnapshot]) -> dict:
    """Exclude identifiers, quantities, timestamps and raw provider payloads."""
    return {
        "schema_version": 1,
        "supplies": [
            {
                "utility": snapshot.utility.value,
                "interval_count": len(snapshot.intervals),
                "missing_value_count": sum(
                    interval.value is None for interval in snapshot.intervals
                ),
                "estimated_value_count": sum(
                    interval.quality is Quality.ESTIMATED and interval.value is not None
                    for interval in snapshot.intervals
                ),
                "units": sorted(
                    {interval.unit.value for interval in snapshot.intervals}
                ),
            }
            for snapshot in snapshots
        ],
    }
