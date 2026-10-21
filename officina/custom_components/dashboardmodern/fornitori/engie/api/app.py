"""Shared native application configuration, not an account authorization.

Verified against ENGIE Italia Android 10.1.0. This application-level API key
is distributed with the native client; it cannot read supplies without a
separate, user-authorized access token. The current API expects that token in
both its legacy sessionToken header and the standard Bearer authorization
header. Provider changes may require an update.
"""

DEFAULT_API_KEY = "L7PioCFoLN2WarD8ps3aq2G8lD151bjO5MSVkvo2"
