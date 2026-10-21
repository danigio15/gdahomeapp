"""I fornitori di energia, collegati dentro GdAHome.

«Userei le integrazioni in essere su Home Assistant tramite HACS, inglobandole
nella nostra.» Le integrazioni di E.ON Energia Italia e di ENGIE Italia sono
MIT, e il loro codice che parla col fornitore sta qui accanto, copiato com'e'
(`eon/pyeonenergia`, `engie/api`). Quello che c'e' in questo file e' nostro:
chi e' collegato, dove si tengono i gettoni, come si legge una bolletta.

Tre regole, e stanno tutte su questo confine.

* **La password non si salva.** Serve per entrare, una volta, e poi se ne va:
  restano i gettoni d'accesso del fornitore, nel file privato di Home
  Assistant (`.storage/dashboardmodern.fornitori`, come i gettoni GitHub).
  Quando il fornitore non li rinnova piu', il collegamento si segna «da
  ricollegare» e si rientra dalla scheda.
* **Solo chi amministra.** Vedere chi e' collegato, collegare, scollegare: i
  comandi `dashboardmodern/fornitori/*` li puo' chiamare solo un utente
  amministratore di Home Assistant, e il ponte non li inoltra affatto
  (`ponte/src/commissioni.js` non li conosce). Le bollette arrivano a tutti
  come sensori, e quelle si leggono come ogni altro sensore.
* **Niente torna indietro.** Dal comando `stato` escono il nome del
  fornitore, la fornitura con le cifre di mezzo coperte e com'e' andato
  l'ultimo giro. Mai un gettone, mai un'email.

I sensori si chiamano come quelli delle integrazioni originali (`unpaid_
invoices`, `latest_invoice`, `payment_status`…), cosi' la linguetta Bollette
li trova da sola, senza scegliere niente.
"""

from __future__ import annotations

import asyncio
import importlib
import logging
import secrets
import time
from collections.abc import Callable
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Any

from ..const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.fornitori"
STORAGE_VERSION = 1
DATA_FORNITORI = "fornitori"
SEGNALE_NUOVO = f"{DOMAIN}_fornitore_nuovo"

#: Ogni quanto si richiede al fornitore. Le bollette arrivano una volta al
#: mese e i consumi con due giorni di ritardo: sei ore bastano e avanzano.
OGNI = timedelta(hours=6)
#: Quanto vive un accesso a meta' (il codice SMS, l'indirizzo da incollare).
DURATA_DEL_PASSO = 600

#: I fornitori che la scheda mostra. Enel non ha un'integrazione da cui
#: partire; Octopus Italia non ne ha una che si possa copiare.
CATALOGO: tuple[dict[str, Any], ...] = (
    {"id": "eon", "nome": "E.ON Energia", "modo": "password", "cosa": "luce"},
    {"id": "engie", "nome": "ENGIE", "modo": "link", "cosa": "luce-gas"},
    {
        "id": "enel",
        "nome": "Enel Energia",
        "modo": "password",
        "pronto": False,
        "perche": "nessuna-integrazione",
    },
    {
        "id": "octopus",
        "nome": "Octopus Energy",
        "modo": "password",
        "pronto": False,
        "perche": "presto",
    },
)
FORNITORI_PRONTI = frozenset(
    voce["id"] for voce in CATALOGO if voce.get("pronto", True)
)
NOMI = {voce["id"]: voce["nome"] for voce in CATALOGO}

#: L'identificativo pubblico dell'app ENGIE (non e' un segreto: e' quello
#: dell'app nativa), da `engie_italia/const.py` dell'integrazione originale.
ENGIE_CLIENT_ID = "vevw1dcH7a8Dheq4zWDDkoNwqtKWWlYF"

#: Le voci della bolletta, coi nomi dei sensori delle integrazioni originali.
VOCI_EON = (
    "unpaid_invoices",
    "payment_status",
    "latest_invoice",
    "total_invoiced",
    "contracted_power",
    "offer_end",
    "daily_consumption",
)
VOCI_ENGIE = (
    "unpaid_invoices",
    "payment_status",
    "latest_invoice",
    "total_invoiced",
    "contracted_power",
    "offer_end",
)


class ErroreDelFornitore(Exception):
    """Un no che la scheda sa spiegare: il messaggio e' la parola del perche'.

    `credenziali`, `codice`, `captcha`, `link`, `scaduto`, `fornitore`: la
    plancia le traduce, e nessun testo del fornitore arriva fin la'.
    """


def copri(fornitura: str) -> str:
    """La fornitura con le cifre di mezzo coperte: «IT001E••••4668»."""
    testo = str(fornitura or "")
    if len(testo) <= 8:
        return testo
    return f"{testo[:6]}••••{testo[-4:]}"


def _numero(valore: Any) -> float | None:
    try:
        n = float(valore)
    except (TypeError, ValueError):
        return None
    return round(n, 2) if n == n else None


def _giorno(valore: Any) -> str | None:
    return valore.isoformat() if isinstance(valore, date) else None


# ── le librerie ─────────────────────────────────────────────────────────────


_LIBRERIE: dict[str, Any] = {}


def _importa() -> dict[str, Any]:
    """Le librerie dei fornitori, importate una volta, fuori dal loop.

    Si importano qui, nell'executor, perche' all'importazione leggono il disco:
    ENGIE il catalogo delle tariffe, E.ON il fuso orario di Roma. Fatto nel
    loop, Home Assistant lo segnala come chiamata bloccante — e ha ragione.
    """
    if not _LIBRERIE:
        base = __name__
        _LIBRERIE["eon"] = importlib.import_module(f"{base}.eon.pyeonenergia")
        for nome in ("app", "auth", "client", "errors", "session"):
            _LIBRERIE[f"engie.{nome}"] = importlib.import_module(
                f"{base}.engie.api.{nome}"
            )
    return _LIBRERIE


async def async_librerie(hass: HomeAssistant) -> dict[str, Any]:
    """Le librerie, caricate al primo bisogno."""
    if _LIBRERIE:
        return _LIBRERIE
    return await hass.async_add_executor_job(_importa)


# ── chi legge: un fornitore per volta ──────────────────────────────────────


class _Lettore:
    """Come si chiede la bolletta a un fornitore. Uno per collegamento."""

    voci: tuple[str, ...] = ()

    async def async_leggi(self) -> dict[str, Any]:  # pragma: no cover - astratto
        raise NotImplementedError

    async def async_chiudi(self) -> None:
        """Lascia andare quello che tiene aperto."""


class _LettoreEon(_Lettore):
    voci = VOCI_EON

    def __init__(
        self, lib: dict[str, Any], voce: dict[str, Any], salva: Callable[[], None]
    ) -> None:
        eon = lib["eon"]
        self._eon = eon
        self._voce = voce
        self._pod = str(voce.get("pod") or "")
        segreti = voce.get("segreti") or {}

        def rinnovati(accesso: str, rinnovo: str | None) -> None:
            # E.ON rinnova i gettoni ogni due ore: quelli nuovi si scrivono
            # subito, o al prossimo riavvio resterebbero quelli scaduti.
            voce["segreti"] = {
                "access_token": accesso,
                "refresh_token": rinnovo or segreti.get("refresh_token"),
            }
            salva()

        # Senza email e password: se il rinnovo non va, si ricollega a mano.
        self._client = eon.EonEnergiaClient(
            segreti.get("access_token") or "",
            segreti.get("refresh_token"),
            token_callback=rinnovati,
        )

    async def async_leggi(self) -> dict[str, Any]:
        eon = self._eon
        dati: dict[str, Any] = {}
        oggi = datetime.now()
        try:
            fatture = await self._client.get_invoices_for_pod(
                self._pod, start_date=oggi - timedelta(days=400)
            )
        except (eon.EonEnergiaAuthError, eon.EonEnergiaTokenRefreshError) as err:
            raise ErroreDelFornitore("credenziali") from err
        dati.update(_bollette_eon(fatture, oggi.date()))
        # Il contratto e i consumi sono un di piu': se non rispondono, le
        # bollette restano buone.
        try:
            fornitura = await self._client.get_point_of_delivery(self._pod)
            dati["contracted_power"] = _numero(fornitura.contractual_power)
            dati["offer_end"] = fornitura.contract_end
        except eon.EonEnergiaAuthError as err:
            raise ErroreDelFornitore("credenziali") from err
        except eon.EonEnergiaError:
            _LOGGER.debug("E.ON: il contratto non risponde")
        try:
            letture = await self._client.get_daily_consumption(
                pod=self._pod,
                start_date=oggi - timedelta(days=7),
                end_date=oggi - timedelta(days=2),
            )
            giorni = [x for x in letture if x.day is not None]
            if giorni:
                ultima = max(giorni, key=lambda x: x.day)
                dati["daily_consumption"] = _numero(ultima.total)
                dati["daily_consumption_attr"] = {"giorno": _giorno(ultima.day)}
        except eon.EonEnergiaAuthError as err:
            raise ErroreDelFornitore("credenziali") from err
        except eon.EonEnergiaError:
            _LOGGER.debug("E.ON: i consumi non rispondono")
        return dati

    async def async_chiudi(self) -> None:
        await self._client.close()


def _bollette_eon(fatture: list[Any], oggi: date) -> dict[str, Any]:
    """Quanto resta da pagare, l'ultima, e il totale dell'ultimo anno."""
    dati: dict[str, Any] = {}
    da_pagare = 0.0
    aperte = []
    for fattura in fatture:
        resta = _numero(fattura.outstanding) or 0.0
        if resta > 0:
            da_pagare += resta
            aperte.append(
                {"scadenza": _giorno(fattura.due_on), "importo": round(resta, 2)}
            )
    dati["unpaid_invoices"] = round(da_pagare, 2)
    dati["unpaid_invoices_attr"] = {"quante": len(aperte), "aperte": aperte[:12]}
    datate = [f for f in fatture if f.issued_on]
    if datate:
        ultima = max(datate, key=lambda f: f.issued_on)
        dati["latest_invoice"] = _numero(ultima.amount)
        dati["latest_invoice_attr"] = {
            "emessa": _giorno(ultima.issued_on),
            "scadenza": _giorno(ultima.due_on),
            "dal": _giorno(ultima.period_start),
            "al": _giorno(ultima.period_end),
        }
        dati["payment_status"] = "paid" if ultima.is_paid else "unpaid"
        anno = oggi - timedelta(days=365)
        dati["total_invoiced"] = round(
            sum(_numero(f.amount) or 0.0 for f in datate if f.issued_on >= anno), 2
        )
        dati["total_invoiced_attr"] = {"dal": _giorno(anno)}
    elif not fatture:
        dati["payment_status"] = "paid"
    return dati


class _LettoreEngie(_Lettore):
    voci = VOCI_ENGIE

    def __init__(
        self,
        hass: HomeAssistant,
        lib: dict[str, Any],
        voce: dict[str, Any],
        salva: Callable[[], None],
    ) -> None:
        from homeassistant.helpers.aiohttp_client import async_get_clientsession

        session = lib["engie.session"]
        self._errori = lib["engie.errors"]
        segreti = voce.get("segreti") or {}
        gettoni = session.SessionTokens.from_storage(segreti.get("tokens"))
        self._voce = voce
        self._pod = str(voce.get("pod") or "")

        async def rinnovati(nuovi: Any) -> None:
            voce["segreti"] = {**segreti, "tokens": nuovi.as_storage()}
            salva()

        self._client = lib["engie.client"].EngieMobileClient(
            async_get_clientsession(hass),
            api_key=segreti.get("api_key"),
            client_id=segreti.get("client_id"),
            access_token=gettoni.access_token,
            refresh_token=gettoni.refresh_token,
            expires_in=gettoni.remaining_seconds,
            token_updated=rinnovati,
        )

    async def async_leggi(self) -> dict[str, Any]:
        errori = self._errori
        try:
            forniture = await self._client.async_supplies()
            fatture = await self._client.async_invoices()
        except errori.AuthenticationError as err:
            raise ErroreDelFornitore("credenziali") from err
        dati = _bollette_engie(fatture, datetime.now().date())
        fornitura = next(
            (f for f in forniture if f.point_id == self._pod),
            forniture[0] if forniture else None,
        )
        if fornitura is not None:
            dati["contracted_power"] = _numero(fornitura.contracted_power)
            offerta = getattr(fornitura, "offer", None)
            dati["offer_end"] = getattr(offerta, "valid_until", None)
        return dati

    async def async_chiudi(self) -> None:
        # La sessione e' quella condivisa di Home Assistant: non si chiude.
        self._client.clear_credentials()


def _bollette_engie(istantanea: Any, oggi: date) -> dict[str, Any]:
    """Le stesse voci di E.ON, dai conti di ENGIE.

    ENGIE dice «non si sa» quando i suoi dati non tornano (una fattura pagata
    con un residuo, per dirne una): li' il sensore resta senza valore, invece
    di dire che e' tutto pagato.
    """
    dati: dict[str, Any] = {}
    resta = istantanea.outstanding
    dati["unpaid_invoices"] = _numero(resta) if resta is not None else None
    aperte = istantanea.open_invoices
    if aperte is not None:
        dati["unpaid_invoices_attr"] = {
            "quante": len(aperte),
            "aperte": [
                {"scadenza": _giorno(f.due), "importo": _numero(f.remaining)}
                for f in aperte[:12]
            ],
        }
        dati["payment_status"] = "unpaid" if aperte else "paid"
    ultima = istantanea.latest
    if ultima is not None:
        dati["latest_invoice"] = _numero(ultima.amount)
        dati["latest_invoice_attr"] = {
            "emessa": _giorno(ultima.issued),
            "scadenza": _giorno(ultima.due),
        }
    anno = oggi - timedelta(days=365)
    datate = [f for f in istantanea.invoices if f.issued and f.issued >= anno]
    if datate:
        dati["total_invoiced"] = round(sum(_numero(f.amount) or 0.0 for f in datate), 2)
        dati["total_invoiced_attr"] = {"dal": _giorno(anno)}
    return dati


# ── i collegamenti ──────────────────────────────────────────────────────────


class Fornitori:
    """Chi e' collegato, e i giri che ne leggono le bollette."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Aggancia il file privato a quello di Home Assistant."""
        from homeassistant.helpers.storage import Store

        self.hass = hass
        self.entry = entry
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, STORAGE_KEY, private=True, atomic_writes=True
        )
        self._collegati: dict[str, dict[str, Any]] = {}
        self.giri: dict[str, Any] = {}
        self._lettori: dict[str, _Lettore] = {}
        #: Gli accessi a meta', uno per utente: `{utente: {fornitore, tipo,
        #: dati, alle}}`. Solo in memoria: un riavvio li butta, ed e' giusto.
        self._passi: dict[str, dict[str, Any]] = {}
        self._lucchetto = asyncio.Lock()
        self.aggiungi_sensori: Callable[[list[Any]], None] | None = None

    # ── il file ──

    async def async_load(self) -> None:
        """Leggi chi era collegato e rimetti in moto i giri."""
        letti = await self._store.async_load()
        collegati = letti.get("collegati") if isinstance(letti, dict) else None
        if isinstance(collegati, dict):
            self._collegati = {
                str(chiave): voce
                for chiave, voce in collegati.items()
                if isinstance(voce, dict) and voce.get("fornitore") in FORNITORI_PRONTI
            }
        for chiave in list(self._collegati):
            await self._async_avvia(chiave, subito=False)

    def _dati(self) -> dict[str, Any]:
        return {"collegati": self._collegati}

    def _salva_presto(self) -> None:
        self._store.async_delay_save(self._dati, 1)

    async def _async_salva(self) -> None:
        await self._store.async_save(self._dati())

    # ── quello che la scheda vede ──

    def stato(self) -> dict[str, Any]:
        """Chi e' collegato e chi si puo' collegare. Niente segreti."""
        collegati = []
        for chiave, voce in self._collegati.items():
            collegati.append(
                {
                    "id": chiave,
                    "fornitore": voce.get("fornitore"),
                    "nome": NOMI.get(voce.get("fornitore"), voce.get("fornitore")),
                    "pod": copri(voce.get("pod")),
                    "stato": voce.get("stato") or "ok",
                    "aggiornato": voce.get("aggiornato") or 0,
                }
            )
        disponibili = [{"pronto": True, **voce} for voce in CATALOGO]
        return {"collegati": collegati, "disponibili": disponibili}

    def collegamento(self, chiave: str) -> dict[str, Any] | None:
        """La voce di un collegamento, per i sensori."""
        return self._collegati.get(chiave)

    def voci(self, chiave: str) -> tuple[str, ...]:
        """Quali sensori porta questo collegamento."""
        voce = self._collegati.get(chiave) or {}
        return VOCI_EON if voce.get("fornitore") == "eon" else VOCI_ENGIE

    def chiavi(self) -> list[str]:
        """I collegamenti, nell'ordine in cui sono nati."""
        return list(self._collegati)

    # ── i giri ──

    def _nuovo_lettore(self, voce: dict[str, Any], lib: dict[str, Any]) -> _Lettore:
        if voce["fornitore"] == "eon":
            return _LettoreEon(lib, voce, self._salva_presto)
        return _LettoreEngie(self.hass, lib, voce, self._salva_presto)

    async def _async_avvia(self, chiave: str, *, subito: bool) -> None:
        """Il lettore nuovo, e il giro: quello di prima se c'era.

        Il giro resta lo stesso anche quando ci si ricollega, perche' i sensori
        gli sono attaccati: cambiarlo vorrebbe dire sensori che guardano un
        giro fermo. Cambia solo chi legge, coi gettoni nuovi.
        """
        from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

        voce = self._collegati[chiave]
        vecchio = self._lettori.pop(chiave, None)
        if vecchio is not None:
            await vecchio.async_chiudi()
        lib = await async_librerie(self.hass)
        try:
            self._lettori[chiave] = self._nuovo_lettore(voce, lib)
        except (ValueError, TypeError, KeyError):
            # Gettoni rovinati: il collegamento resta, e chiede di ricollegarsi.
            voce["stato"] = "da-ricollegare"
        giro = self.giri.get(chiave)
        if giro is None:

            async def leggi() -> dict[str, Any]:
                return await self._async_leggi(chiave)

            giro = DataUpdateCoordinator(
                self.hass,
                _LOGGER,
                config_entry=self.entry,
                name=f"{DOMAIN} {voce['fornitore']}",
                update_method=leggi,
                update_interval=OGNI,
            )
            self.giri[chiave] = giro
        if subito:
            await giro.async_refresh()
        else:
            # All'avvio non si aspetta il fornitore: la casa parte comunque.
            self.entry.async_create_background_task(
                self.hass, giro.async_refresh(), f"{DOMAIN} fornitore {chiave}"
            )

    async def _async_leggi(self, chiave: str) -> dict[str, Any]:
        from homeassistant.helpers.update_coordinator import UpdateFailed

        voce = self._collegati.get(chiave)
        lettore = self._lettori.get(chiave)
        if voce is None or lettore is None:
            raise UpdateFailed("il fornitore chiede di ricollegarsi")
        try:
            dati = await lettore.async_leggi()
        except ErroreDelFornitore as err:
            voce["stato"] = "da-ricollegare"
            self._salva_presto()
            raise UpdateFailed("il fornitore chiede di ricollegarsi") from err
        except Exception as err:
            # Il fornitore non risponde: i sensori tengono l'ultimo valore e
            # si riprova al giro dopo. Nel registro va solo il tipo
            # dell'errore: il testo del fornitore potrebbe dire troppo.
            _LOGGER.warning(
                "%s non risponde (%s)",
                NOMI.get(voce["fornitore"]),
                type(err).__name__,
            )
            raise UpdateFailed("il fornitore non risponde") from err
        voce["stato"] = "ok"
        voce["aggiornato"] = int(time.time() * 1000)
        self._salva_presto()
        return dati

    async def async_aggiorna(self, chiave: str) -> None:
        """Rileggi adesso, per chi ha toccato 🔄."""
        giro = self.giri.get(chiave)
        if giro is None:
            raise ErroreDelFornitore("scaduto")
        await giro.async_refresh()

    async def _async_ferma(self, chiave: str) -> None:
        giro = self.giri.pop(chiave, None)
        if giro is not None:
            await giro.async_shutdown()
        lettore = self._lettori.pop(chiave, None)
        if lettore is not None:
            await lettore.async_chiudi()

    async def async_shutdown(self) -> None:
        """La plancia primaria si scarica: si fermano i giri, il file resta."""
        for chiave in list(self.giri):
            await self._async_ferma(chiave)
        await self._store.async_save(self._dati())

    # ── collegare ──

    async def _async_nuovo(
        self, fornitore: str, pod: str, segreti: dict[str, Any], account: str = ""
    ) -> None:
        """Un collegamento nuovo, o quello di prima coi gettoni nuovi."""
        chiave = next(
            (
                k
                for k, v in self._collegati.items()
                if v.get("fornitore") == fornitore
                and (v.get("pod") == pod or (account and v.get("account") == account))
            ),
            None,
        )
        nuovo = chiave is None
        if nuovo:
            chiave = secrets.token_hex(6)
        self._collegati[chiave] = {
            "fornitore": fornitore,
            "pod": pod,
            "account": account,
            "segreti": segreti,
            "stato": "ok",
            "aggiornato": 0,
        }
        await self._async_salva()
        await self._async_avvia(chiave, subito=True)
        if nuovo and self.aggiungi_sensori is not None:
            self.aggiungi_sensori([chiave])

    def _passo(self, utente: str, fornitore: str) -> dict[str, Any]:
        passo = self._passi.get(utente)
        if (
            not passo
            or passo.get("fornitore") != fornitore
            or time.monotonic() - passo.get("alle", 0) > DURATA_DEL_PASSO
        ):
            self._passi.pop(utente, None)
            raise ErroreDelFornitore("scaduto")
        return passo

    def annulla(self, utente: str) -> None:
        """Butta l'accesso a meta' di questo utente."""
        self._passi.pop(utente, None)

    async def async_collega(
        self, utente: str, fornitore: str, email: str, password: str
    ) -> dict[str, Any]:
        """E.ON: email e password. Poi, forse, il codice o il browser."""
        if fornitore != "eon":
            raise ErroreDelFornitore("fornitore")
        lib = await async_librerie(self.hass)
        eon = lib["eon"]
        async with self._lucchetto:
            try:
                gettoni = await eon.EonEnergiaAuth.login(email, password)
            except eon.EonEnergiaMfaRequiredError as err:
                self._passi[utente] = {
                    "fornitore": "eon",
                    "tipo": "codice",
                    "dati": err.session_data,
                    "alle": time.monotonic(),
                }
                return {"serve": "codice"}
            except eon.EonEnergiaCaptchaError:
                return await self._async_eon_dal_browser(utente, "captcha")
            except eon.EonEnergiaAuthError as err:
                raise ErroreDelFornitore("credenziali") from err
            except Exception as err:
                raise ErroreDelFornitore("fornitore") from err
        return await self._async_eon_fatto(gettoni)

    async def _async_eon_dal_browser(self, utente: str, perche: str) -> dict[str, Any]:
        eon = (await async_librerie(self.hass))["eon"]
        try:
            link = await eon.build_authorization_url()
        except Exception as err:
            raise ErroreDelFornitore("fornitore") from err
        self._passi[utente] = {
            "fornitore": "eon",
            "tipo": "incolla",
            "dati": None,
            "alle": time.monotonic(),
        }
        return {"serve": "incolla", "link": link, "perche": perche}

    async def async_codice(
        self, utente: str, fornitore: str, codice: str
    ) -> dict[str, Any]:
        """E.ON: il codice SMS che chiude l'accesso."""
        passo = self._passo(utente, fornitore)
        if passo.get("tipo") != "codice":
            raise ErroreDelFornitore("scaduto")
        eon = (await async_librerie(self.hass))["eon"]
        try:
            gettoni = await eon.EonEnergiaAuth.submit_mfa_code(codice, passo["dati"])
        except eon.EonEnergiaAuthError as err:
            raise ErroreDelFornitore("codice") from err
        except Exception as err:
            raise ErroreDelFornitore("fornitore") from err
        self._passi.pop(utente, None)
        return await self._async_eon_fatto(gettoni)

    async def _async_eon_fatto(self, gettoni: dict[str, Any]) -> dict[str, Any]:
        """I gettoni ci sono: si sceglie la fornitura e si comincia."""
        eon = (await async_librerie(self.hass))["eon"]
        segreti = {
            "access_token": gettoni.get("access_token"),
            "refresh_token": gettoni.get("refresh_token"),
        }
        client = eon.EonEnergiaClient(
            segreti["access_token"] or "", segreti["refresh_token"]
        )
        try:
            forniture = await client.get_points_of_delivery()
        except Exception as err:
            raise ErroreDelFornitore("fornitore") from err
        finally:
            await client.close()
        if client.access_token != segreti["access_token"]:
            segreti = {
                "access_token": client.access_token,
                "refresh_token": client.refresh_token,
            }
        scelta = next(
            (f for f in forniture if f.pod_id and f.is_active and f.is_electricity),
            next((f for f in forniture if f.pod_id), None),
        )
        if scelta is None:
            raise ErroreDelFornitore("fornitore")
        await self._async_nuovo("eon", str(scelta.pod_id), segreti)
        return {"stato": self.stato()}

    async def async_inizia(self, utente: str, fornitore: str) -> dict[str, Any]:
        """L'accesso dal browser: il link da aprire."""
        if fornitore == "eon":
            return await self._async_eon_dal_browser(utente, "")
        if fornitore != "engie":
            raise ErroreDelFornitore("fornitore")
        lib = await async_librerie(self.hass)
        tentativo = lib["engie.auth"].AuthorizationAttempt(ENGIE_CLIENT_ID)
        self._passi[utente] = {
            "fornitore": "engie",
            "tipo": "incolla",
            "dati": tentativo,
            "alle": time.monotonic(),
        }
        return {"link": tentativo.authorization_url}

    async def async_incolla(
        self, utente: str, fornitore: str, indirizzo: str
    ) -> dict[str, Any]:
        """L'indirizzo dove il browser e' arrivato dopo l'accesso."""
        passo = self._passo(utente, fornitore)
        if passo.get("tipo") != "incolla":
            raise ErroreDelFornitore("scaduto")
        lib = await async_librerie(self.hass)
        if fornitore == "eon":
            eon = lib["eon"]
            codice = eon.extract_code_from_callback(indirizzo)
            if not codice:
                raise ErroreDelFornitore("link")
            try:
                gettoni = await eon.EonEnergiaAuth.exchange_code_for_tokens(codice)
            except eon.EonEnergiaAuthError as err:
                raise ErroreDelFornitore("link") from err
            except Exception as err:
                raise ErroreDelFornitore("fornitore") from err
            self._passi.pop(utente, None)
            return await self._async_eon_fatto(gettoni)
        return await self._async_engie_fatto(utente, lib, passo, indirizzo)

    async def _async_engie_fatto(
        self, utente: str, lib: dict[str, Any], passo: dict[str, Any], indirizzo: str
    ) -> dict[str, Any]:
        from homeassistant.helpers.aiohttp_client import async_get_clientsession

        errori = lib["engie.errors"]
        tentativo = passo["dati"]
        try:
            account, gettoni = await lib["engie.auth"].async_complete_authorization(
                async_get_clientsession(self.hass), tentativo, indirizzo
            )
        except errori.AuthorizationError as err:
            if tentativo.consumed or tentativo.expired:
                self._passi.pop(utente, None)
            raise ErroreDelFornitore("link") from err
        except errori.EngieError as err:
            raise ErroreDelFornitore("fornitore") from err
        self._passi.pop(utente, None)
        segreti = {
            "api_key": lib["engie.app"].DEFAULT_API_KEY,
            "client_id": ENGIE_CLIENT_ID,
            "tokens": gettoni.as_storage(),
        }
        client = lib["engie.client"].EngieMobileClient(
            async_get_clientsession(self.hass),
            api_key=segreti["api_key"],
            client_id=ENGIE_CLIENT_ID,
            access_token=gettoni.access_token,
            refresh_token=gettoni.refresh_token,
            expires_in=gettoni.remaining_seconds,
        )
        try:
            forniture = await client.async_supplies()
        except errori.EngieError as err:
            raise ErroreDelFornitore("fornitore") from err
        finally:
            client.clear_credentials()
        luce = next(
            (f for f in forniture if str(f.utility) == "electricity"),
            forniture[0] if forniture else None,
        )
        pod = str(luce.point_id) if luce is not None else ""
        await self._async_nuovo("engie", pod, segreti, account=account)
        return {"stato": self.stato()}

    # ── scollegare ──

    async def async_scollega(self, chiave: str) -> None:
        """Via il collegamento, i suoi gettoni, i suoi sensori."""
        if chiave not in self._collegati:
            raise ErroreDelFornitore("scaduto")
        await self._async_ferma(chiave)
        self._collegati.pop(chiave, None)
        await self._async_salva()
        from homeassistant.helpers import device_registry as dr

        registro = dr.async_get(self.hass)
        dispositivo = registro.async_get_device(
            identifiers={(DOMAIN, f"fornitore_{chiave}")}
        )
        if dispositivo is not None:
            # Togliere il dispositivo toglie anche le sue entita'.
            registro.async_remove_device(dispositivo.id)


def async_fornitori(hass: HomeAssistant) -> Fornitori | None:
    """I fornitori dell'installazione, se la plancia primaria li ha avviati."""
    return hass.data.get(DOMAIN, {}).get(DATA_FORNITORI)


async def async_setup_fornitori(hass: HomeAssistant, entry: ConfigEntry) -> Fornitori:
    """Avviati dalla plancia primaria, come le segnalazioni."""
    fornitori = Fornitori(hass, entry)
    await fornitori.async_load()
    hass.data.setdefault(DOMAIN, {})[DATA_FORNITORI] = fornitori
    return fornitori


async def async_unload_fornitori(hass: HomeAssistant) -> None:
    """La plancia primaria se ne va: i giri si fermano."""
    fornitori = hass.data.get(DOMAIN, {}).pop(DATA_FORNITORI, None)
    if fornitori is not None:
        await fornitori.async_shutdown()
