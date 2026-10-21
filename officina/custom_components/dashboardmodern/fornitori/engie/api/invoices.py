"""Read-only invoice metadata from the mobile app schema, never PDF/payment data."""

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from .errors import PayloadError, ServiceError
from .mobile import identifier, iso_date, list_value, object_value, successful_payload


class InvoiceStatus(StrEnum):
    PAID = "paid"
    NOT_PAID = "not_paid"
    EXPIRED = "expired"
    PARTIALLY_PAID = "partially_paid"
    UNKNOWN = "unknown"


def _amount(value: object) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise PayloadError("Invalid invoice amount")
    result = Decimal(str(value))
    if not result.is_finite() or abs(result) > Decimal("1e12"):
        raise PayloadError("Invalid invoice amount")
    return result


def _date(value: object) -> date | None:
    return iso_date(value) if value is not None else None


@dataclass(frozen=True, slots=True, repr=False)
class Invoice:
    reference: str
    amount: Decimal | None
    remaining: Decimal | None
    issued: date | None
    due: date | None
    status: InvoiceStatus

    @property
    def is_open(self) -> bool | None:
        if self.status is InvoiceStatus.UNKNOWN:
            return None
        if self.status is InvoiceStatus.PAID:
            # Conflicting accounting data must not silently clear a debt.
            return None if self.remaining and self.remaining > 0 else False
        if self.remaining is not None and self.remaining < 0:
            return None
        return True


def parse_invoices(payload: object) -> tuple[Invoice, ...]:
    data = successful_payload(payload)
    # This endpoint can return HTTP 200 and code=OK alongside an ENGIE error.
    # In particular, an empty list with 9/9.91 is not verified absence of debt.
    for key in ("engieErrorCode", "engieDetailedErrorCode"):
        value = data.get(key)
        if value is not None and (
            isinstance(value, bool) or not isinstance(value, (int, float, Decimal))
        ):
            raise PayloadError("Invalid invoice service status")
        if value is not None and value != 0:
            code = data.get("engieErrorCode")
            detail = data.get("engieDetailedErrorCode")
            raise ServiceError(
                200,
                code if type(code) is int else None,
                Decimal(str(detail))
                if isinstance(detail, (int, float, Decimal))
                and not isinstance(detail, bool)
                and Decimal(str(detail)).is_finite()
                else None,
            )
    response = object_value(data.get("response"))
    maintenance = response.get("inMaintenance")
    if maintenance is not None and type(maintenance) is not bool:
        raise PayloadError("Invalid invoice maintenance status")
    if maintenance:
        raise ServiceError(503)
    invoices = []
    for raw in list_value(response.get("invoices")):
        row = object_value(raw)
        reference = identifier(row.get("fiscalNumber"))
        if len(reference) > 255:
            raise PayloadError("Invalid invoice reference")
        status = row.get("invoiceStatus")
        try:
            normalized = (
                InvoiceStatus(status.lower())
                if isinstance(status, str)
                else InvoiceStatus.UNKNOWN
            )
        except ValueError:
            normalized = InvoiceStatus.UNKNOWN
        invoices.append(
            Invoice(
                reference=reference,
                amount=_amount(row.get("amount")),
                remaining=_amount(row.get("unpaidRemainingAmount")),
                issued=_date(row.get("emissionDate")),
                due=_date(row.get("expiryDate")),
                status=normalized,
            )
        )
    return merge_invoices(invoices)


def merge_invoices(invoices: Iterable[Invoice]) -> tuple[Invoice, ...]:
    """Deduplicate the same fiscal document, including across contract responses."""
    by_reference = {}
    for invoice in invoices:
        previous = by_reference.get(invoice.reference)
        if previous is not None and previous != invoice:
            raise PayloadError("Conflicting duplicate invoice")
        by_reference[invoice.reference] = invoice
    return tuple(
        sorted(by_reference.values(), key=lambda i: (i.issued or date.min, i.reference))
    )


@dataclass(frozen=True, slots=True)
class InvoiceSnapshot:
    invoices: tuple[Invoice, ...] = field(repr=False)
    fetched_at: datetime = field(repr=False)

    @property
    def latest(self) -> Invoice | None:
        # An undated document might be the latest; do not silently skip it.
        if not self.invoices or any(i.issued is None for i in self.invoices):
            return None
        return max(self.invoices, key=lambda i: (i.issued, i.reference))

    @property
    def open_invoices(self) -> tuple[Invoice, ...] | None:
        if any(i.is_open is None for i in self.invoices):
            return None
        return tuple(i for i in self.invoices if i.is_open)

    @property
    def open_count(self) -> int | None:
        rows = self.open_invoices
        return len(rows) if rows is not None else None

    @property
    def outstanding(self) -> Decimal | None:
        rows = self.open_invoices
        if rows is None or any(i.remaining is None for i in rows):
            return None
        return sum((i.remaining for i in rows), start=Decimal(0))

    def overdue_count(self, today: date) -> int | None:
        rows = self.open_invoices
        if rows is None or any(
            i.due is None and i.status is not InvoiceStatus.EXPIRED for i in rows
        ):
            return None
        return sum(i.status is InvoiceStatus.EXPIRED or i.due < today for i in rows)

    @property
    def earliest_due(self) -> date | None:
        rows = self.open_invoices
        if not rows or any(i.due is None for i in rows):
            return None
        return min(i.due for i in rows)

    def data_status(self, today: date) -> str:
        if not self.invoices:
            return "no_invoices"
        if (
            self.latest is None
            or self.latest.amount is None
            or self.latest.due is None
            or self.outstanding is None
            or self.overdue_count(today) is None
            or (self.open_count and self.earliest_due is None)
        ):
            return "incomplete"
        return "available"
