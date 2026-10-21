"""Interactive OAuth/PKCE only; passwords and OTP never enter this module."""

import base64
import hashlib
import json
import secrets
import time
from dataclasses import dataclass, field
from urllib.parse import parse_qs, urlencode, urlsplit

import aiohttp
import jwt

from .errors import (
    AuthenticationError,
    AuthorizationError,
    AuthorizationFailure,
    PayloadError,
    TransportError,
)
from .session import SessionTokens, credential

ISSUER = "https://login.engie.it/"
CALLBACK = ISSUER + "android/it.engie.appengie/callback"
AUDIENCE = "https://mobileapp.jwt"
ATTEMPT_LIFETIME = 600


@dataclass(slots=True)
class AuthorizationAttempt:
    client_id: str = field(repr=False)
    verifier: str = field(default_factory=lambda: secrets.token_urlsafe(64), repr=False)
    state: str = field(default_factory=lambda: secrets.token_urlsafe(32), repr=False)
    nonce: str = field(default_factory=lambda: secrets.token_urlsafe(32), repr=False)
    created_at: float = field(default_factory=time.monotonic)
    consumed: bool = False

    @property
    def authorization_url(self) -> str:
        credential(self.client_id)
        challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(self.verifier.encode()).digest())
            .decode()
            .rstrip("=")
        )
        return (
            ISSUER
            + "authorize?"
            + urlencode(
                {
                    "client_id": self.client_id,
                    "response_type": "code",
                    "redirect_uri": CALLBACK,
                    "scope": "openid profile email offline_access",
                    "audience": AUDIENCE,
                    "code_challenge": challenge,
                    "code_challenge_method": "S256",
                    "state": self.state,
                    "nonce": self.nonce,
                    "ui_locales": "it",
                    "prompt": "login",
                }
            )
        )

    @property
    def expired(self) -> bool:
        return time.monotonic() - self.created_at > ATTEMPT_LIFETIME

    def validate_callback(self, value: str) -> str:
        if self.consumed:
            raise AuthorizationError(AuthorizationFailure.USED)
        if self.expired:
            raise AuthorizationError(AuthorizationFailure.EXPIRED)
        try:
            if not isinstance(value, str) or len(value) > 8192:
                raise ValueError
            url = urlsplit(value.strip())
            query = parse_qs(url.query, keep_blank_values=True, max_num_fields=12)
            if (
                url.scheme != "https"
                or url.netloc != "login.engie.it"
                or url.path != "/android/it.engie.appengie/callback"
                or url.fragment
            ):
                raise ValueError
            if len(query.get("state", [])) != 1:
                raise ValueError
            if not secrets.compare_digest(query["state"][0], self.state):
                raise AuthorizationError(AuthorizationFailure.STATE_MISMATCH)
            if "error" in query:
                raise AuthorizationError(AuthorizationFailure.DENIED)
            if len(query.get("code", [])) != 1:
                raise ValueError
            code = credential(query["code"][0])
        except (ValueError, TypeError, AttributeError):
            raise AuthorizationError(AuthorizationFailure.INVALID_CALLBACK) from None
        return code

    def consume_callback(self, value: str) -> str:
        code = self.validate_callback(value)
        self.consumed = True
        return code


async def _json_request(session, method: str, path: str, **kwargs) -> dict:
    try:
        async with session.request(
            method,
            ISSUER + path,
            timeout=aiohttp.ClientTimeout(total=20),
            allow_redirects=False,
            raise_for_status=False,
            **kwargs,
        ) as response:
            if response.status != 200:
                if response.status in (400, 401, 403):
                    raise AuthenticationError("ENGIE authorization failed")
                raise TransportError("ENGIE authorization service unavailable")
            chunks, size = [], 0
            async for chunk in response.content.iter_chunked(65536):
                size += len(chunk)
                if size > 1024 * 1024:
                    raise PayloadError("Authorization response exceeds size limit")
                chunks.append(chunk)
            data = json.loads(b"".join(chunks))
            if not isinstance(data, dict):
                raise ValueError
            return data
    except (aiohttp.ClientError, TimeoutError):
        raise TransportError("ENGIE authorization transport failed") from None
    except (ValueError, UnicodeError):
        raise PayloadError("Invalid authorization response") from None


async def async_complete_authorization(
    session: aiohttp.ClientSession,
    attempt: AuthorizationAttempt,
    callback_url: str,
) -> tuple[str, SessionTokens]:
    attempt.validate_callback(callback_url)
    # Fetch keys before consuming the one-use authorization code at the server.
    jwks = await _json_request(session, "GET", ".well-known/jwks.json")
    code = attempt.consume_callback(callback_url)
    try:
        payload = await _json_request(
            session,
            "POST",
            "oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": attempt.client_id,
                "code": code,
                "code_verifier": attempt.verifier,
                "redirect_uri": CALLBACK,
            },
        )
    except AuthenticationError:
        raise AuthorizationError(AuthorizationFailure.TOKEN_EXCHANGE) from None
    finally:
        # A failed exchange may still have consumed the one-use server code.
        attempt.verifier = ""
    try:
        token = credential(payload.get("id_token"))
        key_id = jwt.get_unverified_header(token)["kid"]
        key = next(
            item.key
            for item in jwt.PyJWKSet.from_dict(jwks).keys
            if item.key_id == key_id
        )
        identity = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=attempt.client_id,
            issuer=ISSUER,
            leeway=30,
            options={"require": ["exp", "iat", "sub", "nonce"]},
        )
        if not isinstance(identity["nonce"], str) or not secrets.compare_digest(
            identity["nonce"], attempt.nonce
        ):
            raise ValueError
        subject = credential(identity["sub"])
        account_key = hashlib.sha256((ISSUER + subject).encode()).hexdigest()
    except (jwt.PyJWTError, ValueError, TypeError, KeyError, StopIteration):
        raise AuthorizationError(AuthorizationFailure.IDENTITY) from None
    try:
        tokens = SessionTokens.from_response(payload)
    except ValueError:
        raise AuthorizationError(AuthorizationFailure.SESSION) from None
    return account_key, tokens
