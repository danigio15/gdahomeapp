"""``/local`` si pubblica anche se ``www`` e' nata dopo l'avvio (#285).

Dal campo: «non carica le foto, da errore». Home Assistant pubblica ``/local``
all'avvio solo se ``config/www`` c'era gia'; la cartella la crea il primo
caricamento della plancia, e l'indirizzo della foto restava un 404 fino al
riavvio. Dopo un caricamento ``/local`` deve esserci.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from custom_components.dashboardmodern.websocket_api import _assicura_local


class _Http:
    def __init__(self, canoniche: list[str]) -> None:
        risorse = [SimpleNamespace(canonical=c) for c in canoniche]
        self.app = SimpleNamespace(router=SimpleNamespace(resources=lambda: risorse))
        self.pubblicate: list = []

    async def async_register_static_paths(self, configs: list) -> None:
        self.pubblicate.extend(configs)


def _casa(canoniche: list[str]) -> SimpleNamespace:
    return SimpleNamespace(
        http=_Http(canoniche),
        config=SimpleNamespace(path=lambda nome: f"/config/{nome}"),
    )


async def test_senza_local_lo_si_pubblica_sulla_cartella_www() -> None:
    casa = _casa(["/api", "/dashboardmodern_static"])
    await _assicura_local(casa)
    assert [(c.url_path, c.path, c.cache_headers) for c in casa.http.pubblicate] == [
        ("/local", "/config/www", False)
    ]


async def test_con_local_gia_pubblicato_non_si_tocca_niente() -> None:
    casa = _casa(["/api", "/local"])
    await _assicura_local(casa)
    assert casa.http.pubblicate == []
