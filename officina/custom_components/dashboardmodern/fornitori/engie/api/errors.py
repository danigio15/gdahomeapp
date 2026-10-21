"""Errors contain only fixed messages and allowlisted numeric metadata."""

from decimal import Decimal
from enum import StrEnum


class EngieError(Exception):
    """Base error for the read-only client."""


class PayloadError(EngieError, ValueError):
    """A response does not match the verified data contract."""


class AuthenticationError(EngieError):
    """An interactive login is required."""


class AuthorizationFailure(StrEnum):
    INVALID_CALLBACK = "invalid_callback"
    STATE_MISMATCH = "callback_mismatch"
    EXPIRED = "authorization_expired"
    USED = "authorization_used"
    DENIED = "authorization_denied"
    TOKEN_EXCHANGE = "token_exchange_failed"
    IDENTITY = "invalid_identity"
    SESSION = "invalid_session"


class AuthorizationError(AuthenticationError):
    """A fixed, translatable OAuth failure; never includes provider payloads."""

    def __init__(self, reason: AuthorizationFailure):
        self.reason = AuthorizationFailure(reason)
        super().__init__(self.reason.value)


class TransportError(EngieError):
    """The service could not be reached."""


class TokenPersistenceError(EngieError):
    """A rotated session must be saved before any further network requests."""


class ServiceError(EngieError):
    def __init__(
        self,
        status: int,
        error_code: int | None = None,
        detailed_code: Decimal | None = None,
    ) -> None:
        super().__init__(f"ENGIE request failed (HTTP {status})")
        self.status = status
        self.error_code = error_code
        self.detailed_code = detailed_code


class RateLimitError(EngieError):
    def __init__(self, retry_after: float) -> None:
        super().__init__("ENGIE rate limit reached; wait before retrying")
        self.retry_after = retry_after
