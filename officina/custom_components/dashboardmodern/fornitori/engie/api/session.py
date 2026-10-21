"""Immutable credentials for explicit persistence; never included in repr."""

import math
import time
from dataclasses import dataclass, field


def credential(value: object) -> str:
    if (
        not isinstance(value, str)
        or not value.strip()
        or any(ord(char) < 33 or ord(char) == 127 for char in value)
    ):
        raise ValueError("Invalid credential configuration")
    return value


@dataclass(frozen=True, slots=True)
class SessionTokens:
    access_token: str = field(repr=False)
    refresh_token: str = field(repr=False)
    expires_at: float

    def __post_init__(self) -> None:
        credential(self.access_token)
        credential(self.refresh_token)
        if (
            isinstance(self.expires_at, bool)
            or not isinstance(self.expires_at, (int, float))
            or not math.isfinite(self.expires_at)
        ):
            raise ValueError("Invalid token expiry")

    @classmethod
    def from_response(cls, payload: dict, previous_refresh: str | None = None):
        lifetime = payload.get("expires_in")
        kind = payload.get("token_type")
        if (
            not isinstance(kind, str)
            or kind.lower() != "bearer"
            or type(lifetime) is not int
            or lifetime <= 0
        ):
            raise ValueError("Invalid token response")
        return cls(
            credential(payload.get("access_token")),
            credential(payload.get("refresh_token", previous_refresh)),
            time.time() + lifetime,
        )

    @classmethod
    def from_storage(cls, data: object):
        if not isinstance(data, dict):
            raise ValueError("Invalid stored session")
        return cls(
            data.get("access_token"), data.get("refresh_token"), data.get("expires_at")
        )

    def as_storage(self) -> dict:
        """For the private credential store only, never diagnostics or log output."""
        return {
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "expires_at": self.expires_at,
        }

    @property
    def remaining_seconds(self) -> int:
        return max(1, int(self.expires_at - time.time()))
