"""I comandi della scheda «Fornitori di energia».

Tutti e otto chiedono un amministratore di Home Assistant: vedere quali
fornitori sono collegati e' gia' sapere qualcosa della casa, e collegarne uno
vuol dire dare a Home Assistant le chiavi dell'area clienti. Chi non
amministra le bollette le vede lo stesso — sono sensori — ma la scheda non la
apre.

Il collegamento si chiama `collegamento` e non `id`: `id` e' il numero del
messaggio, e Home Assistant lo vuole suo.

Gli errori escono con una parola sola nel messaggio (`credenziali`, `codice`,
`captcha`, `link`, `scaduto`, `fornitore`): e' quella che la plancia traduce.
Il testo del fornitore non arriva mai fin la'.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any

import voluptuous as vol
from homeassistant.components import websocket_api

from ..const import DOMAIN
from . import FORNITORI_PRONTI, ErroreDelFornitore, Fornitori, async_fornitori

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

TYPE_STATO = f"{DOMAIN}/fornitori/stato"
TYPE_INIZIA = f"{DOMAIN}/fornitori/inizia"
TYPE_COLLEGA = f"{DOMAIN}/fornitori/collega"
TYPE_CODICE = f"{DOMAIN}/fornitori/codice"
TYPE_INCOLLA = f"{DOMAIN}/fornitori/incolla"
TYPE_ANNULLA = f"{DOMAIN}/fornitori/annulla"
TYPE_AGGIORNA = f"{DOMAIN}/fornitori/aggiorna"
TYPE_SCOLLEGA = f"{DOMAIN}/fornitori/scollega"

_FORNITORE = vol.In(sorted(FORNITORI_PRONTI))
_ID = vol.All(str, vol.Match(r"^[0-9a-f]{12}$"))


def _utente(connection: Any) -> str:
    return str(getattr(getattr(connection, "user", None), "id", "") or "")


async def _rispondi(
    hass: HomeAssistant,
    connection: Any,
    msg: dict[str, Any],
    fare: Callable[[Fornitori], Awaitable[dict[str, Any]]],
) -> None:
    """Fai, e rispondi col risultato o con la parola del perche'."""
    fornitori = async_fornitori(hass)
    if fornitori is None:
        connection.send_error(msg["id"], "not_ready", "fornitore")
        return
    try:
        risultato = await fare(fornitori)
    except ErroreDelFornitore as err:
        connection.send_error(msg["id"], "failed", str(err))
        return
    connection.send_result(msg["id"], risultato)


@websocket_api.websocket_command({vol.Required("type"): TYPE_STATO})
@websocket_api.require_admin
@websocket_api.async_response
async def async_stato(
    hass: HomeAssistant, connection: Any, msg: dict[str, Any]
) -> None:
    """Chi e' collegato e chi si puo' collegare."""

    async def fare(fornitori: Fornitori) -> dict[str, Any]:
        return fornitori.stato()

    await _rispondi(hass, connection, msg, fare)


@websocket_api.websocket_command(
    {vol.Required("type"): TYPE_INIZIA, vol.Required("fornitore"): _FORNITORE}
)
@websocket_api.require_admin
@websocket_api.async_response
async def async_inizia(
    hass: HomeAssistant, connection: Any, msg: dict[str, Any]
) -> None:
    """L'accesso dal browser: il link del fornitore da aprire."""

    async def fare(fornitori: Fornitori) -> dict[str, Any]:
        return await fornitori.async_inizia(_utente(connection), msg["fornitore"])

    await _rispondi(hass, connection, msg, fare)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_COLLEGA,
        vol.Required("fornitore"): _FORNITORE,
        vol.Required("email"): vol.All(str, vol.Length(min=3, max=254)),
        vol.Required("password"): vol.All(str, vol.Length(min=1, max=256)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def async_collega(
    hass: HomeAssistant, connection: Any, msg: dict[str, Any]
) -> None:
    """Email e password: entrano una volta, e non si salvano."""

    async def fare(fornitori: Fornitori) -> dict[str, Any]:
        return await fornitori.async_collega(
            _utente(connection), msg["fornitore"], msg["email"], msg["password"]
        )

    await _rispondi(hass, connection, msg, fare)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_CODICE,
        vol.Required("fornitore"): _FORNITORE,
        vol.Required("codice"): vol.All(str, vol.Match(r"^[0-9]{4,10}$")),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def async_codice(
    hass: HomeAssistant, connection: Any, msg: dict[str, Any]
) -> None:
    """Il codice che il fornitore ha mandato per SMS."""

    async def fare(fornitori: Fornitori) -> dict[str, Any]:
        return await fornitori.async_codice(
            _utente(connection), msg["fornitore"], msg["codice"]
        )

    await _rispondi(hass, connection, msg, fare)


@websocket_api.websocket_command(
    {
        vol.Required("type"): TYPE_INCOLLA,
        vol.Required("fornitore"): _FORNITORE,
        vol.Required("indirizzo"): vol.All(str, vol.Length(min=8, max=8192)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def async_incolla(
    hass: HomeAssistant, connection: Any, msg: dict[str, Any]
) -> None:
    """L'indirizzo della pagina dove il browser e' arrivato dopo l'accesso."""

    async def fare(fornitori: Fornitori) -> dict[str, Any]:
        return await fornitori.async_incolla(
            _utente(connection), msg["fornitore"], msg["indirizzo"]
        )

    await _rispondi(hass, connection, msg, fare)


@websocket_api.websocket_command({vol.Required("type"): TYPE_ANNULLA})
@websocket_api.require_admin
@websocket_api.async_response
async def async_annulla(
    hass: HomeAssistant, connection: Any, msg: dict[str, Any]
) -> None:
    """L'accesso a meta' si butta."""

    async def fare(fornitori: Fornitori) -> dict[str, Any]:
        fornitori.annulla(_utente(connection))
        return {}

    await _rispondi(hass, connection, msg, fare)


@websocket_api.websocket_command(
    {vol.Required("type"): TYPE_AGGIORNA, vol.Required("collegamento"): _ID}
)
@websocket_api.require_admin
@websocket_api.async_response
async def async_aggiorna(
    hass: HomeAssistant, connection: Any, msg: dict[str, Any]
) -> None:
    """Rileggi adesso le bollette di un fornitore."""

    async def fare(fornitori: Fornitori) -> dict[str, Any]:
        await fornitori.async_aggiorna(msg["collegamento"])
        return {"stato": fornitori.stato()}

    await _rispondi(hass, connection, msg, fare)


@websocket_api.websocket_command(
    {vol.Required("type"): TYPE_SCOLLEGA, vol.Required("collegamento"): _ID}
)
@websocket_api.require_admin
@websocket_api.async_response
async def async_scollega(
    hass: HomeAssistant, connection: Any, msg: dict[str, Any]
) -> None:
    """Via il fornitore, i suoi gettoni e i suoi sensori."""

    async def fare(fornitori: Fornitori) -> dict[str, Any]:
        await fornitori.async_scollega(msg["collegamento"])
        return {"stato": fornitori.stato()}

    await _rispondi(hass, connection, msg, fare)


COMANDI = (
    async_stato,
    async_inizia,
    async_collega,
    async_codice,
    async_incolla,
    async_annulla,
    async_aggiorna,
    async_scollega,
)
