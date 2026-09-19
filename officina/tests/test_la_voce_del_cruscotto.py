"""La voce «Cruscotto» nella barra laterale di chi installa.

Chi monta gdahome in quaranta case un Home Assistant ce l'ha **suo**, e da li'
vuole vedere i suoi impianti. La voce la accende il ponte — l'interruttore sta
nella scheda dell'add-on — e non una pagina: due posti dove dirlo vorrebbero
dire due posti da tenere d'accordo.

Le cose che qui si provano, in ordine di quanto farebbero male:

 1. **che non la appenda chiunque.** Una voce nella barra laterale la vedono
    tutti quelli che entrano in quella casa, e porta agli impianti dei clienti
    di qualcuno. La puo' appendere chi amministra, o l'add-on — che per Home
    Assistant e' un utente generato dal sistema — e nessun altro;
 2. **che si spenga sul serio.** Spegnere l'interruttore deve far sparire la
    voce subito, non al prossimo riavvio;
 3. **che non si riregistri identica.** Il ponte lo ridice a ogni avvio, e
    riregistrare un pannello vuol dire farlo ricaricare sotto le mani di chi
    lo sta guardando;
 4. **che non si passino a Home Assistant parole che non conosce.** E' lo
    stesso controllo di `test_pannello_vero.py`, e non e' pignoleria: quella
    riga di troppo e' costata un'installazione che «non parte» su ogni casa
    ferma a una versione precedente.
"""

from __future__ import annotations

import ast
import inspect
import textwrap
from typing import Any

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.components import frontend
from homeassistant.core import HomeAssistant

from custom_components.dashboardmodern import frontend as frontend_module
from custom_components.dashboardmodern import websocket_api as ws
from custom_components.dashboardmodern.const import DOMAIN

DOVE = "https://quadro.gdahome.org/console/"


class Utente:
    def __init__(
        self, *, is_admin: bool = False, system_generated: bool = False
    ) -> None:
        self.is_admin = is_admin
        self.system_generated = system_generated


class Collegamento:
    """Il minimo che serve: chi chiama, e cosa gli si risponde."""

    def __init__(self, user: Any) -> None:
        self.user = user
        self.risultati: list[Any] = []
        self.errori: list[tuple[str, str]] = []

    def send_result(self, _id: int, result: Any = None) -> None:
        self.risultati.append(result)

    def send_error(self, _id: int, code: str, message: str) -> None:
        self.errori.append((code, message))


async def _chiedi(hass: HomeAssistant, collegamento: Collegamento, **msg: Any) -> None:
    """`async_response` avvolge il comando in una funzione sincrona che lo
    accoda al collegamento: `__wrapped__` e' quella vera, ed e' la stessa via
    che prendono le altre prove dei comandi qui dentro."""
    await ws.async_cruscotto_set.__wrapped__(hass, collegamento, {"id": 1, **msg})


@pytest.mark.asyncio
async def test_la_voce_compare_e_porta_al_quadro(hass: HomeAssistant) -> None:
    c = Collegamento(Utente(is_admin=True))
    await _chiedi(hass, c, installatore=True, dove=DOVE)

    assert not c.errori
    assert c.risultati == [{"mostrata": True, "cambiato": True}]
    pannello = hass.data["frontend_panels"][frontend_module.CRUSCOTTO_URL_PATH]
    assert pannello.sidebar_title == "Cruscotto"
    assert pannello.component_name == "custom"
    assert pannello.config["dove"] == DOVE
    # Non la vede chi entra in questa casa senza amministrarla.
    assert pannello.require_admin is True


@pytest.mark.asyncio
async def test_ridirlo_uguale_non_la_rifa(hass: HomeAssistant) -> None:
    """Il ponte lo dice a ogni avvio: rifarlo ricaricherebbe la pagina aperta."""
    c = Collegamento(Utente(is_admin=True))
    await _chiedi(hass, c, installatore=True, dove=DOVE)
    await _chiedi(hass, c, installatore=True, dove=DOVE)

    assert c.risultati[-1] == {"mostrata": True, "cambiato": False}


@pytest.mark.asyncio
async def test_cambiare_indirizzo_la_rifa(hass: HomeAssistant) -> None:
    c = Collegamento(Utente(is_admin=True))
    await _chiedi(hass, c, installatore=True, dove=DOVE)
    await _chiedi(hass, c, installatore=True, dove="https://altro.example/console/")

    assert c.risultati[-1] == {"mostrata": True, "cambiato": True}
    pannello = hass.data["frontend_panels"][frontend_module.CRUSCOTTO_URL_PATH]
    assert pannello.config["dove"] == "https://altro.example/console/"


@pytest.mark.asyncio
async def test_spegnere_l_interruttore_toglie_la_voce(hass: HomeAssistant) -> None:
    c = Collegamento(Utente(is_admin=True))
    await _chiedi(hass, c, installatore=True, dove=DOVE)
    await _chiedi(hass, c, installatore=False)

    assert c.risultati[-1] == {"mostrata": False, "cambiato": True}
    assert frontend_module.CRUSCOTTO_URL_PATH not in hass.data.get(
        "frontend_panels", {}
    )
    # E ridirlo non si lamenta: non c'era piu' niente da togliere.
    await _chiedi(hass, c, installatore=False)
    assert c.risultati[-1] == {"mostrata": False, "cambiato": False}


@pytest.mark.asyncio
async def test_l_add_on_puo_appenderla(hass: HomeAssistant) -> None:
    """Il ponte non e' amministratore: e' un utente generato dal sistema."""
    c = Collegamento(Utente(system_generated=True))
    await _chiedi(hass, c, installatore=True, dove=DOVE)

    assert not c.errori
    assert frontend_module.CRUSCOTTO_URL_PATH in hass.data["frontend_panels"]


@pytest.mark.asyncio
async def test_un_utente_qualunque_non_la_appende(hass: HomeAssistant) -> None:
    """La riga che conta: quella voce porta ai clienti di qualcuno."""
    c = Collegamento(Utente())
    await _chiedi(hass, c, installatore=True, dove=DOVE)

    assert c.errori and c.errori[0][0] == "unauthorized"
    assert frontend_module.CRUSCOTTO_URL_PATH not in hass.data.get(
        "frontend_panels", {}
    )


@pytest.mark.asyncio
async def test_senza_utente_non_si_appende_niente(hass: HomeAssistant) -> None:
    c = Collegamento(None)
    await _chiedi(hass, c, installatore=True, dove=DOVE)

    assert c.errori and c.errori[0][0] == "unauthorized"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "storto",
    [
        "",
        "   ",
        "http://quadro.gdahome.org/console/",
        "quadro.gdahome.org",
        "javascript:alert(1)",
    ],
)
async def test_un_indirizzo_che_non_e_https_non_passa(
    hass: HomeAssistant, storto: str
) -> None:
    """In chiaro viaggerebbe in chiaro anche la chiave della flotta."""
    c = Collegamento(Utente(is_admin=True))
    await _chiedi(hass, c, installatore=True, dove=storto)

    assert c.errori and c.errori[0][0] == "invalid_format"
    assert frontend_module.CRUSCOTTO_URL_PATH not in hass.data.get(
        "frontend_panels", {}
    )


def test_il_modulo_del_pannello_si_serve() -> None:
    """La voce senza il suo modulo e' una pagina bianca con un nome."""
    assert "cruscotto.js" in frontend_module.RUNTIME_ROOT_FILES
    assert (frontend_module.FRONTEND_DIR / "cruscotto.js").is_file()


def test_non_si_passano_argomenti_che_home_assistant_non_ha() -> None:
    """Ogni parola che diciamo a Home Assistant, Home Assistant la conosce.

    Gemella di quella in `test_pannello_vero.py`: la registrazione e' un'altra
    chiamata, e una firma la si sbaglia una volta per chiamata.
    """
    albero = ast.parse(
        textwrap.dedent(inspect.getsource(frontend_module.async_mostra_il_cruscotto))
    )
    nostri: set[str] = set()
    for nodo in ast.walk(albero):
        if isinstance(nodo, ast.Call) and ast.unparse(nodo.func).endswith(
            "async_register_built_in_panel"
        ):
            nostri = {parola.arg for parola in nodo.keywords if parola.arg}
    assert nostri, "la chiamata non si trova piu': la ricerca e' rotta"

    conosciuti = set(
        inspect.signature(frontend.async_register_built_in_panel).parameters
    )
    sconosciuti = sorted(nostri - conosciuti)
    assert not sconosciuti, (
        "Home Assistant non conosce questi argomenti, e il setup della voce "
        f"fallirebbe con TypeError: {', '.join(sconosciuti)}"
    )


def test_il_comando_e_registrato() -> None:
    """Un comando che nessuno registra e' un comando che nessuno puo' chiamare."""
    sorgente = inspect.getsource(ws.async_register_websocket_api)
    assert "async_cruscotto_set" in sorgente
    assert f"{DOMAIN}/cruscotto/set" == ws.TYPE_CRUSCOTTO_SET
