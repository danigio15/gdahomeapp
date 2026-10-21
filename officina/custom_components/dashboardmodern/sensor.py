"""Le bollette dei fornitori di energia collegati, come sensori.

Un dispositivo per collegamento — «E.ON Energia», «ENGIE» — e sotto le voci
della bolletta. I nomi sono quelli delle integrazioni originali, cosi' la
linguetta Bollette della plancia li trova da sola e chi scrive un'automazione
(«avvisami quando c'e' una bolletta da pagare») li riconosce.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfEnergy, UnitOfPower
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntryType
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .fornitori import NOMI, Fornitori, async_fornitori

#: Come si presenta ogni voce: classe, unita', icona.
ASPETTO: dict[str, dict[str, Any]] = {
    "unpaid_invoices": {
        "classe": SensorDeviceClass.MONETARY,
        "unita": "EUR",
        "icona": "mdi:cash-clock",
    },
    "payment_status": {
        "classe": SensorDeviceClass.ENUM,
        "opzioni": ["paid", "unpaid"],
        "icona": "mdi:receipt-text-check",
    },
    "latest_invoice": {
        "classe": SensorDeviceClass.MONETARY,
        "unita": "EUR",
        "icona": "mdi:receipt-text",
    },
    "total_invoiced": {
        "classe": SensorDeviceClass.MONETARY,
        "unita": "EUR",
        "icona": "mdi:cash-multiple",
    },
    "contracted_power": {
        "classe": SensorDeviceClass.POWER,
        "unita": UnitOfPower.KILO_WATT,
        "icona": "mdi:flash",
    },
    "offer_end": {"classe": SensorDeviceClass.DATE, "icona": "mdi:calendar-end"},
    "daily_consumption": {
        "classe": SensorDeviceClass.ENERGY,
        "unita": UnitOfEnergy.KILO_WATT_HOUR,
        "icona": "mdi:lightning-bolt",
    },
}


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """I sensori dei collegamenti di adesso, e di quelli che verranno."""
    fornitori = async_fornitori(hass)
    if fornitori is None:
        return

    @callback
    def aggiungi(chiavi: list[str]) -> None:
        async_add_entities(
            VoceDellaBolletta(fornitori, chiave, voce)
            for chiave in chiavi
            if chiave in fornitori.giri
            for voce in fornitori.voci(chiave)
        )

    fornitori.aggiungi_sensori = aggiungi
    aggiungi(fornitori.chiavi())


class VoceDellaBolletta(CoordinatorEntity, SensorEntity):
    """Una voce della bolletta di un fornitore collegato."""

    _attr_has_entity_name = True

    def __init__(self, fornitori: Fornitori, chiave: str, voce: str) -> None:
        super().__init__(fornitori.giri[chiave])
        collegamento = fornitori.collegamento(chiave) or {}
        fornitore = str(collegamento.get("fornitore") or "")
        aspetto = ASPETTO[voce]
        self._voce = voce
        self._attr_unique_id = f"{DOMAIN}_fornitore_{chiave}_{voce}"
        # Il nome dell'entita' come quello delle integrazioni originali:
        # `sensor.eon_unpaid_invoices`. Se ce n'e' gia' uno, Home Assistant ci
        # mette un `_2`.
        self.entity_id = f"sensor.{fornitore}_{voce}"
        self._attr_translation_key = voce
        self._attr_device_class = aspetto["classe"]
        self._attr_native_unit_of_measurement = aspetto.get("unita")
        self._attr_icon = aspetto["icona"]
        if "opzioni" in aspetto:
            self._attr_options = aspetto["opzioni"]
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"fornitore_{chiave}")},
            "name": NOMI.get(fornitore, fornitore),
            "manufacturer": NOMI.get(fornitore, fornitore),
            "model": "Fornitura",
            "entry_type": DeviceEntryType.SERVICE,
        }

    @property
    def native_value(self) -> Any:
        """Il valore dell'ultimo giro, o niente se il fornitore non l'ha detto."""
        valore = (self.coordinator.data or {}).get(self._voce)
        if self._voce == "offer_end" and not isinstance(valore, date):
            return None
        return valore

    @property
    def available(self) -> bool:
        """Disponibile finche' c'e' un giro riuscito da mostrare."""
        return bool(self.coordinator.data)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """I dettagli della voce: scadenza, periodo, bollette aperte."""
        return (self.coordinator.data or {}).get(f"{self._voce}_attr")
