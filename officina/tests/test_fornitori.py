"""I fornitori di energia: collegarli, leggerne le bollette, scollegarli.

Il fornitore vero non si chiama mai: le librerie copiate (E.ON, ENGIE) si
sostituiscono con finte che rispondono come loro, tenendo pero' le loro
eccezioni e i loro modelli veri, che sono quello su cui il nostro codice
decide. Quello che si prova qui e' nostro: chi puo' chiamare i comandi, che
la password non resta da nessuna parte, che i sensori nascono coi nomi che la
linguetta Bollette sa leggere, e che un fornitore che non rinnova i gettoni
fa dire «da ricollegare» invece di sparire.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import Unauthorized
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import fornitori as modulo
from custom_components.dashboardmodern.const import DOMAIN, OPTION_CHECK_UPDATES

EMAIL = "persona-1@example.invalid"
PASSWORD = "una-password-che-non-deve-restare"
POD_EON = "IT001E12345678"
POD_ENGIE = "IT002E99887766"
OGGI = date.today()


class Connessione:
    """La superficie di ActiveConnection che i comandi usano."""

    def __init__(self, hass: HomeAssistant, *, admin: bool = True) -> None:
        self.hass = hass
        self.user = SimpleNamespace(id="utente-1", is_admin=admin)
        self.risultati: dict[int, Any] = {}
        self.errori: dict[int, tuple[str, str]] = {}

    def send_result(self, message_id: int, result: Any = None) -> None:
        self.risultati[message_id] = result

    def send_error(self, message_id: int, code: str, message: str) -> None:
        self.errori[message_id] = (code, message)

    def async_handle_exception(self, msg: dict[str, Any], err: Exception) -> None:
        # Una prova non deve mai arrivare qui: un comando che cade e' un difetto.
        self.errori[msg["id"]] = ("eccezione", repr(err))


class Comandi:
    """Chiama i comandi registrati, passando per lo schema e per l'admin."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.n = 0

    async def manda(
        self, connessione: Connessione, payload: dict[str, Any]
    ) -> tuple[Any, tuple[str, str] | None]:
        self.n += 1
        handler, schema = self.hass.data[websocket_api.const.DOMAIN][payload["type"]]
        messaggio = {"id": self.n, **payload}
        if schema is not False:
            messaggio = schema(messaggio)
        try:
            handler(self.hass, connessione, messaggio)
        except Unauthorized:
            # Home Assistant lo traduce in «unauthorized» verso chi ha chiamato.
            connessione.send_error(self.n, "unauthorized", "Unauthorized")
        await self.hass.async_block_till_done(wait_background_tasks=True)
        return connessione.risultati.get(self.n), connessione.errori.get(self.n)

    async def bene(self, connessione: Connessione, payload: dict[str, Any]) -> Any:
        risultato, errore = await self.manda(connessione, payload)
        assert errore is None, errore
        return risultato


# ── le finte ────────────────────────────────────────────────────────────────


class FintoClientEon:
    rifiuta = False

    def __init__(
        self, access: str, refresh: str | None = None, token_callback: Any = None
    ) -> None:
        self.access_token = access
        self.refresh_token = refresh
        self._callback = token_callback

    def _controlla(self) -> None:
        if FintoClientEon.rifiuta:
            raise modulo._LIBRERIE["eon"].EonEnergiaAuthError("rifiutato")

    async def get_points_of_delivery(self) -> list[Any]:
        self._controlla()
        return [
            SimpleNamespace(pod_id="PDR-GAS", is_active=True, is_electricity=False),
            SimpleNamespace(pod_id=POD_EON, is_active=True, is_electricity=True),
        ]

    async def get_invoices_for_pod(self, pod: str, start_date: Any = None) -> list:
        self._controlla()
        assert pod == POD_EON
        # Il fornitore rinnova i gettoni mentre si legge.
        if self._callback is not None:
            self._callback("accesso-rinnovato", "rinnovo-rinnovato")
        return [
            SimpleNamespace(
                amount=81.4,
                outstanding=81.4,
                issued_on=OGGI - timedelta(days=5),
                due_on=OGGI + timedelta(days=15),
                period_start=OGGI - timedelta(days=65),
                period_end=OGGI - timedelta(days=5),
                is_paid=False,
            ),
            SimpleNamespace(
                amount=70.0,
                outstanding=0,
                issued_on=OGGI - timedelta(days=65),
                due_on=OGGI - timedelta(days=45),
                period_start=None,
                period_end=None,
                is_paid=True,
            ),
        ]

    async def get_point_of_delivery(self, pod: str) -> Any:
        self._controlla()
        return SimpleNamespace(
            contractual_power=3.0, contract_end=OGGI + timedelta(days=200)
        )

    async def get_daily_consumption(self, **_kwargs: Any) -> list[Any]:
        self._controlla()
        return [
            SimpleNamespace(day=OGGI - timedelta(days=3), total=6.1),
            SimpleNamespace(day=OGGI - timedelta(days=2), total=7.25),
        ]

    async def close(self) -> None:
        return None


class FintoAccessoEon:
    chiesto: list[tuple[str, str]] = []
    risposta = "mfa"

    @staticmethod
    async def login(email: str, password: str) -> dict[str, Any]:
        FintoAccessoEon.chiesto.append((email, password))
        eon = modulo._LIBRERIE["eon"]
        if FintoAccessoEon.risposta == "mfa":
            raise eon.EonEnergiaMfaRequiredError("codice", {"mfa_url": "x"})
        if FintoAccessoEon.risposta == "captcha":
            raise eon.EonEnergiaCaptchaError("captcha")
        if FintoAccessoEon.risposta == "no":
            raise eon.EonEnergiaAuthError("no")
        return {"access_token": "accesso", "refresh_token": "rinnovo"}

    @staticmethod
    async def submit_mfa_code(codice: str, sessione: dict[str, Any]) -> dict:
        if codice != "123456":
            raise modulo._LIBRERIE["eon"].EonEnergiaAuthError("Invalid MFA code")
        return {"access_token": "accesso", "refresh_token": "rinnovo"}

    @staticmethod
    async def exchange_code_for_tokens(codice: str) -> dict[str, Any]:
        return {"access_token": "accesso-browser", "refresh_token": "rinnovo"}


class FintoClientEngie:
    def __init__(self, _session: Any, **kwargs: Any) -> None:
        self.kwargs = kwargs

    async def async_supplies(self) -> list[Any]:
        return [
            SimpleNamespace(
                point_id=POD_ENGIE,
                utility="electricity",
                contracted_power=Decimal("4.5"),
                offer=SimpleNamespace(valid_until=OGGI + timedelta(days=90)),
            )
        ]

    async def async_invoices(self) -> Any:
        fatture = modulo._LIBRERIE["engie.invoices"]
        riga = fatture.Invoice
        return fatture.InvoiceSnapshot(
            (
                riga(
                    "F-1",
                    Decimal("60.00"),
                    Decimal("0"),
                    OGGI - timedelta(days=40),
                    OGGI - timedelta(days=20),
                    fatture.InvoiceStatus.PAID,
                ),
                riga(
                    "F-2",
                    Decimal("55.50"),
                    Decimal("55.50"),
                    OGGI - timedelta(days=3),
                    OGGI + timedelta(days=17),
                    fatture.InvoiceStatus.NOT_PAID,
                ),
            ),
            None,
        )

    def clear_credentials(self) -> None:
        return None


@pytest.fixture
async def comandi(
    hass: HomeAssistant,
    enable_custom_integrations: None,
    monkeypatch: pytest.MonkeyPatch,
) -> Comandi:
    """L'integrazione avviata davvero, coi fornitori finti."""
    import custom_components.dashboardmodern.frontend as frontend_module

    async def niente(*_args: Any, **_kwargs: Any) -> None:
        return None

    monkeypatch.setattr(frontend_module, "async_register_frontend", niente)
    # La sessione HTTP di Home Assistant non serve: i client ENGIE sono finti.
    monkeypatch.setattr(
        "homeassistant.helpers.aiohttp_client.async_get_clientsession",
        lambda _hass: None,
    )

    vere = modulo._importa()
    vere["engie.invoices"] = __import__(
        f"{modulo.__name__}.engie.api.invoices", fromlist=["x"]
    )
    eon = SimpleNamespace(**vars(vere["eon"]))
    eon.EonEnergiaAuth = FintoAccessoEon
    eon.EonEnergiaClient = FintoClientEon

    async def link() -> str:
        return "https://auth.eon-energia.com/authorize?finto=1"

    eon.build_authorization_url = link
    engie_auth = SimpleNamespace(**vars(vere["engie.auth"]))
    sessione = vere["engie.session"]

    async def completa(_session: Any, tentativo: Any, indirizzo: str) -> Any:
        tentativo.validate_callback(indirizzo)
        tentativo.consumed = True
        return "a" * 64, sessione.SessionTokens("acc-engie", "rin-engie", 9e9)

    engie_auth.async_complete_authorization = completa
    finte = {
        **vere,
        "eon": eon,
        "engie.auth": engie_auth,
        "engie.client": SimpleNamespace(EngieMobileClient=FintoClientEngie),
    }
    monkeypatch.setattr(modulo, "_LIBRERIE", finte)
    FintoClientEon.rifiuta = False
    FintoAccessoEon.chiesto = []
    FintoAccessoEon.risposta = "mfa"

    entry = MockConfigEntry(
        domain=DOMAIN,
        entry_id="primaria",
        data={"name": "Plancia", "primary": True},
        options={OPTION_CHECK_UPDATES: False},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return Comandi(hass)


def _file(hass: HomeAssistant) -> str:
    """Quello che finirebbe sul disco, come testo."""
    fornitori = modulo.async_fornitori(hass)
    return json.dumps(fornitori._dati())


# ── chi puo' ────────────────────────────────────────────────────────────────


async def test_chi_non_amministra_non_vede_neanche_l_elenco(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    for payload in (
        {"type": "dashboardmodern/fornitori/stato"},
        {"type": "dashboardmodern/fornitori/inizia", "fornitore": "engie"},
        {
            "type": "dashboardmodern/fornitori/collega",
            "fornitore": "eon",
            "email": EMAIL,
            "password": PASSWORD,
        },
        {"type": "dashboardmodern/fornitori/scollega", "collegamento": "0123456789ab"},
    ):
        risultato, errore = await comandi.manda(Connessione(hass, admin=False), payload)
        assert risultato is None
        assert errore is not None and errore[0] == "unauthorized"
    assert FintoAccessoEon.chiesto == []


async def test_lo_stato_dice_i_fornitori_e_nessun_segreto(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    stato = await comandi.bene(
        Connessione(hass), {"type": "dashboardmodern/fornitori/stato"}
    )
    assert stato["collegati"] == []
    pronti = {f["id"]: f["pronto"] for f in stato["disponibili"]}
    assert pronti == {"eon": True, "engie": True, "enel": False, "octopus": False}


# ── E.ON ────────────────────────────────────────────────────────────────────


async def test_eon_col_codice_sms_si_collega_e_la_password_non_resta(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    io = Connessione(hass)
    passo = await comandi.bene(
        io,
        {
            "type": "dashboardmodern/fornitori/collega",
            "fornitore": "eon",
            "email": EMAIL,
            "password": PASSWORD,
        },
    )
    assert passo == {"serve": "codice"}
    _, errore = await comandi.manda(
        io,
        {
            "type": "dashboardmodern/fornitori/codice",
            "fornitore": "eon",
            "codice": "999999",
        },
    )
    assert errore == ("failed", "codice")
    fatto = await comandi.bene(
        io,
        {
            "type": "dashboardmodern/fornitori/codice",
            "fornitore": "eon",
            "codice": "123456",
        },
    )
    [collegato] = fatto["stato"]["collegati"]
    assert collegato["fornitore"] == "eon"
    assert collegato["stato"] == "ok"
    assert collegato["pod"] == "IT001E••••5678"
    assert collegato["aggiornato"] > 0
    # Niente segreti verso la plancia, niente password sul disco.
    assert "accesso" not in json.dumps(fatto)
    assert PASSWORD not in _file(hass)
    assert EMAIL not in _file(hass)
    # I gettoni rinnovati durante la lettura sono quelli che restano.
    assert "accesso-rinnovato" in _file(hass)

    await hass.async_block_till_done()
    da_pagare = hass.states.get("sensor.eon_unpaid_invoices")
    assert da_pagare is not None and float(da_pagare.state) == 81.4
    assert da_pagare.attributes["unit_of_measurement"] == "EUR"
    assert da_pagare.attributes["quante"] == 1
    assert hass.states.get("sensor.eon_payment_status").state == "unpaid"
    assert float(hass.states.get("sensor.eon_latest_invoice").state) == 81.4
    assert float(hass.states.get("sensor.eon_total_invoiced").state) == 151.4
    assert float(hass.states.get("sensor.eon_contracted_power").state) == 3.0
    assert (
        hass.states.get("sensor.eon_offer_end").state
        == (OGGI + timedelta(days=200)).isoformat()
    )
    assert float(hass.states.get("sensor.eon_daily_consumption").state) == 7.25


async def test_eon_col_captcha_passa_dal_browser(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    FintoAccessoEon.risposta = "captcha"
    io = Connessione(hass)
    passo = await comandi.bene(
        io,
        {
            "type": "dashboardmodern/fornitori/collega",
            "fornitore": "eon",
            "email": EMAIL,
            "password": PASSWORD,
        },
    )
    assert passo["serve"] == "incolla"
    assert passo["perche"] == "captcha"
    assert passo["link"].startswith("https://auth.eon-energia.com/")
    _, errore = await comandi.manda(
        io,
        {
            "type": "dashboardmodern/fornitori/incolla",
            "fornitore": "eon",
            "indirizzo": "https://esempio.invalid/niente",
        },
    )
    assert errore == ("failed", "link")
    fatto = await comandi.bene(
        io,
        {
            "type": "dashboardmodern/fornitori/incolla",
            "fornitore": "eon",
            "indirizzo": "Failed to launch 'com.eon-energia.eon.auth0://x/callback"
            "?code=abcdefghijklmnopqrstuvwxyz' because the scheme…",
        },
    )
    assert fatto["stato"]["collegati"][0]["fornitore"] == "eon"


async def test_eon_con_la_password_sbagliata_dice_credenziali(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    FintoAccessoEon.risposta = "no"
    _, errore = await comandi.manda(
        Connessione(hass),
        {
            "type": "dashboardmodern/fornitori/collega",
            "fornitore": "eon",
            "email": EMAIL,
            "password": PASSWORD,
        },
    )
    assert errore == ("failed", "credenziali")
    assert modulo.async_fornitori(hass).chiavi() == []


async def test_il_codice_senza_un_accesso_a_meta_e_scaduto(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    _, errore = await comandi.manda(
        Connessione(hass),
        {
            "type": "dashboardmodern/fornitori/codice",
            "fornitore": "eon",
            "codice": "123456",
        },
    )
    assert errore == ("failed", "scaduto")


async def test_quando_il_fornitore_rifiuta_i_gettoni_si_ricollega(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    FintoAccessoEon.risposta = "ok"
    io = Connessione(hass)
    fatto = await comandi.bene(
        io,
        {
            "type": "dashboardmodern/fornitori/collega",
            "fornitore": "eon",
            "email": EMAIL,
            "password": PASSWORD,
        },
    )
    chiave = fatto["stato"]["collegati"][0]["id"]
    FintoClientEon.rifiuta = True
    stato = await comandi.bene(
        io, {"type": "dashboardmodern/fornitori/aggiorna", "collegamento": chiave}
    )
    assert stato["stato"]["collegati"][0]["stato"] == "da-ricollegare"
    # I sensori tengono l'ultima bolletta letta.
    assert float(hass.states.get("sensor.eon_unpaid_invoices").state) == 81.4

    # Ricollegarsi rimette tutto a posto, sullo stesso collegamento.
    FintoClientEon.rifiuta = False
    di_nuovo = await comandi.bene(
        io,
        {
            "type": "dashboardmodern/fornitori/collega",
            "fornitore": "eon",
            "email": EMAIL,
            "password": PASSWORD,
        },
    )
    [collegato] = di_nuovo["stato"]["collegati"]
    assert collegato["id"] == chiave
    assert collegato["stato"] == "ok"


# ── ENGIE ───────────────────────────────────────────────────────────────────


async def test_engie_dal_browser_si_collega(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    io = Connessione(hass)
    inizio = await comandi.bene(
        io, {"type": "dashboardmodern/fornitori/inizia", "fornitore": "engie"}
    )
    assert inizio["link"].startswith("https://login.engie.it/authorize?")
    stato = (inizio["link"].split("state=")[1]).split("&")[0]
    _, errore = await comandi.manda(
        io,
        {
            "type": "dashboardmodern/fornitori/incolla",
            "fornitore": "engie",
            "indirizzo": "https://login.engie.it/android/it.engie.appengie/callback"
            "?code=abc&state=sbagliato",
        },
    )
    assert errore == ("failed", "link")
    fatto = await comandi.bene(
        io,
        {
            "type": "dashboardmodern/fornitori/incolla",
            "fornitore": "engie",
            "indirizzo": "https://login.engie.it/android/it.engie.appengie/callback"
            f"?code=abc&state={stato}",
        },
    )
    [collegato] = fatto["stato"]["collegati"]
    assert collegato["fornitore"] == "engie"
    assert collegato["pod"] == "IT002E••••7766"
    await hass.async_block_till_done()
    assert float(hass.states.get("sensor.engie_unpaid_invoices").state) == 55.5
    assert hass.states.get("sensor.engie_payment_status").state == "unpaid"
    assert float(hass.states.get("sensor.engie_latest_invoice").state) == 55.5
    assert float(hass.states.get("sensor.engie_total_invoiced").state) == 115.5
    assert float(hass.states.get("sensor.engie_contracted_power").state) == 4.5
    # ENGIE non da' il consumo del giorno: il sensore non c'e'.
    assert hass.states.get("sensor.engie_daily_consumption") is None


# ── scollegare ──────────────────────────────────────────────────────────────


async def test_scollegare_toglie_gettoni_sensori_e_dispositivo(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    FintoAccessoEon.risposta = "ok"
    io = Connessione(hass)
    fatto = await comandi.bene(
        io,
        {
            "type": "dashboardmodern/fornitori/collega",
            "fornitore": "eon",
            "email": EMAIL,
            "password": PASSWORD,
        },
    )
    chiave = fatto["stato"]["collegati"][0]["id"]
    await hass.async_block_till_done()
    assert er.async_get(hass).async_get("sensor.eon_unpaid_invoices") is not None
    via = await comandi.bene(
        io, {"type": "dashboardmodern/fornitori/scollega", "collegamento": chiave}
    )
    await hass.async_block_till_done()
    assert via["stato"]["collegati"] == []
    assert "accesso" not in _file(hass)
    assert er.async_get(hass).async_get("sensor.eon_unpaid_invoices") is None
    assert (
        dr.async_get(hass).async_get_device(
            identifiers={(DOMAIN, f"fornitore_{chiave}")}
        )
        is None
    )


async def test_dopo_un_riavvio_i_collegamenti_ripartono(
    hass: HomeAssistant, comandi: Comandi
) -> None:
    FintoAccessoEon.risposta = "ok"
    await comandi.bene(
        Connessione(hass),
        {
            "type": "dashboardmodern/fornitori/collega",
            "fornitore": "eon",
            "email": EMAIL,
            "password": PASSWORD,
        },
    )
    [entry] = hass.config_entries.async_entries(DOMAIN)
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    fornitori = modulo.async_fornitori(hass)
    assert len(fornitori.chiavi()) == 1
    assert float(hass.states.get("sensor.eon_unpaid_invoices").state) == 81.4


def test_la_fornitura_si_copre_a_meta() -> None:
    assert modulo.copri("IT001E12345678") == "IT001E••••5678"
    assert modulo.copri("1234") == "1234"
    assert modulo.copri("") == ""
