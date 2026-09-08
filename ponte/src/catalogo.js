/* Il catalogo di integrazioni, dispositivi ed entita' di Home Assistant.
 *
 * Un elettrodomestico moderno arriva in Home Assistant da un'integrazione —
 * hOn per Hoover, Candy e Haier, Home Connect per Bosch e Siemens, Miele, LG
 * ThinQ — come un *dispositivo* con dentro venti o trenta entita': il
 * programma, la fase, il tempo che manca, l'energia del ciclo, l'oblo'. Lo
 * stesso vale per un'auto o per un robot. La plancia li sceglie da un menu
 * — l'integrazione, il dispositivo, e dentro le sue entita' — e quel menu lo
 * costruiva l'integrazione di Home Assistant leggendo i registri. Qui lo
 * costruisce il ponte, allo stesso modo e con la stessa forma: la pagina non
 * deve accorgersi della differenza.
 *
 * Il ponte non ha i registri in mano come li aveva l'integrazione: li chiede
 * a Home Assistant sul suo filo — `config/device_registry/list`,
 * `config/entity_registry/list`, `config/area_registry/list`,
 * `config_entries/get`, `manifest/list` — e li tiene per mezzo minuto, perche'
 * il menu li chiede piu' volte di seguito e i registri non cambiano a ogni
 * tocco. Legge e basta: non scrive niente.
 *
 * Le entita' si chiedono per dispositivo e non tutte insieme: una casa grande
 * ne ha migliaia, e il menu ne vuole vedere venti alla volta.
 */

/* Piu' di cosi' non e' un menu: e' un'esportazione. */
export const DISPOSITIVI_MASSIMI = 200;

/* Le entita' della plancia stessa non sono di nessun elettrodomestico. */
const DOMINIO_DELLA_PLANCIA = "dashboardmodern";

const testo = (valore) => (valore == null ? "" : String(valore).trim());

/* Il nome dell'entita' senza quello del dispositivo davanti.
 *
 * Un'integrazione moderna compone «Lavatrice Tempo rimanente» dal nome del
 * dispositivo e da quello suo: nel menu del dispositivo la prima meta' e'
 * gia' scritta in cima, e ripeterla venti volte non aiuta a leggere. */
function nomeDellEntita(voce, stato, nomeDelDispositivo) {
  const proprio = testo(voce.name) || testo(voce.original_name);
  if (proprio) return proprio;
  const amichevole = testo(stato?.attributes?.friendly_name);
  if (
    amichevole &&
    nomeDelDispositivo &&
    amichevole.toLowerCase().startsWith(nomeDelDispositivo.toLowerCase())
  ) {
    const resto = amichevole.slice(nomeDelDispositivo.length).replace(/^[\s\-:·]+|[\s\-:·]+$/g, "");
    if (resto) return resto;
  }
  if (amichevole) return amichevole;
  return String(voce.entity_id || "")
    .split(".")
    .slice(1)
    .join(".")
    .replace(/_/g, " ");
}

/* Una riga del catalogo per un'entita'. */
function rigaDellEntita(voce, stato, nomeDelDispositivo) {
  const attributi = stato?.attributes || {};
  return {
    entity_id: voce.entity_id,
    device_id: voce.device_id || "",
    platform: voce.platform,
    name: nomeDellEntita(voce, stato, nomeDelDispositivo),
    translation_key: testo(voce.translation_key),
    device_class:
      testo(voce.device_class) ||
      testo(voce.original_device_class) ||
      testo(attributi.device_class),
    unit: testo(voce.unit_of_measurement) || testo(attributi.unit_of_measurement),
    state_class: testo(attributi.state_class),
    category: testo(voce.entity_category),
    disabled: voce.disabled_by != null,
    hidden: voce.hidden_by != null,
  };
}

/* Una riga del catalogo per un'integrazione.
 *
 * `custom` e' vero per un'integrazione che sta in `custom_components` — da
 * HACS o copiata a mano — falso per una di Home Assistant, e `null` quando
 * il manifesto non si trova piu': le sue entita' restano nei registri anche
 * dopo che qualcuno l'ha tolta. */
function rigaDellIntegrazione(dominio, manifesto, voci) {
  return {
    domain: dominio,
    name: (manifesto && testo(manifesto.name)) || dominio,
    custom: manifesto ? manifesto.is_built_in !== true : null,
    entries: voci.map((voce) => ({
      entry_id: voce.entry_id,
      title: testo(voce.title),
      state: testo(voce.state),
    })),
    devices: 0,
  };
}

const perNome = (uno, altro) => {
  const a = uno.name.toLowerCase();
  const b = altro.name.toLowerCase();
  if (a < b) return -1;
  if (a > b) return 1;
  return uno.id < altro.id ? -1 : uno.id > altro.id ? 1 : 0;
};

const elenco = (valore) => (Array.isArray(valore) ? valore : []);

/* Integrazioni, dispositivi e — per i dispositivi chiesti — le entita'.
 *
 * Un dispositivo senza entita' non compare: non c'e' niente da mostrare. E'
 * una funzione pura dei registri, e si prova cosi'. */
export function costruisciIlCatalogo({
  dispositivi,
  entita,
  aree,
  voci,
  stati,
  manifesti,
  deviceIds = null,
} = {}) {
  const perDispositivo = new Map();
  for (const voce of elenco(entita)) {
    if (!voce || voce.platform === DOMINIO_DELLA_PLANCIA || !voce.device_id) continue;
    if (!perDispositivo.has(voce.device_id)) perDispositivo.set(voce.device_id, []);
    perDispositivo.get(voce.device_id).push(voce);
  }

  const dominioDellaVoce = new Map();
  for (const voce of elenco(voci)) {
    if (voce?.entry_id && voce.domain) dominioDellaVoce.set(voce.entry_id, voce.domain);
  }
  const nomeDellArea = new Map();
  for (const area of elenco(aree)) {
    if (area?.area_id) nomeDellArea.set(area.area_id, testo(area.name));
  }

  const devices = [];
  const domini = new Set();
  for (const dispositivo of elenco(dispositivi)) {
    const sue = perDispositivo.get(dispositivo?.id);
    if (!sue) continue;
    const piattaforme = new Map();
    for (const voce of sue)
      piattaforme.set(voce.platform, (piattaforme.get(voce.platform) || 0) + 1);
    let principale = "";
    if (dispositivo.primary_config_entry)
      principale = dominioDellaVoce.get(dispositivo.primary_config_entry) || "";
    if (!principale) {
      principale = [...piattaforme.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    const integrazioni = [
      ...new Set([
        ...piattaforme.keys(),
        ...elenco(dispositivo.config_entries)
          .filter((entryId) => dominioDellaVoce.has(entryId))
          .map((entryId) => dominioDellaVoce.get(entryId)),
      ]),
    ]
      .filter((dominio) => dominio && dominio !== DOMINIO_DELLA_PLANCIA)
      .sort();
    if (!integrazioni.length) continue;
    if (!integrazioni.includes(principale)) principale = integrazioni[0];
    for (const dominio of integrazioni) domini.add(dominio);
    devices.push({
      id: dispositivo.id,
      name: testo(dispositivo.name_by_user) || testo(dispositivo.name),
      manufacturer: testo(dispositivo.manufacturer),
      model: testo(dispositivo.model) || testo(dispositivo.model_id),
      integration: principale,
      integrations: integrazioni,
      area_id: dispositivo.area_id || "",
      area: dispositivo.area_id ? nomeDellArea.get(dispositivo.area_id) || "" : "",
      entities: sue.filter((voce) => voce.disabled_by == null).length,
      disabled: dispositivo.disabled_by != null,
    });
  }
  devices.sort(perNome);

  const perDominio = new Map();
  for (const manifesto of elenco(manifesti)) {
    if (manifesto?.domain) perDominio.set(manifesto.domain, manifesto);
  }
  const integrations = [...domini].sort().map((dominio) =>
    rigaDellIntegrazione(
      dominio,
      perDominio.get(dominio) || null,
      elenco(voci).filter((voce) => voce?.domain === dominio),
    ),
  );
  const conteggio = new Map();
  for (const device of devices) {
    conteggio.set(device.integration, (conteggio.get(device.integration) || 0) + 1);
  }
  for (const integrazione of integrations) {
    integrazione.devices = conteggio.get(integrazione.domain) || 0;
  }
  integrations.sort((a, b) => {
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  });

  const entities = [];
  if (Array.isArray(deviceIds) && deviceIds.length) {
    const statoDi = new Map();
    for (const stato of elenco(stati)) if (stato?.entity_id) statoDi.set(stato.entity_id, stato);
    const nomi = new Map(devices.map((device) => [device.id, device.name]));
    for (const deviceId of deviceIds.slice(0, DISPOSITIVI_MASSIMI)) {
      const sue = [...(perDispositivo.get(deviceId) || [])].sort((a, b) =>
        a.entity_id < b.entity_id ? -1 : a.entity_id > b.entity_id ? 1 : 0,
      );
      for (const voce of sue) {
        entities.push(rigaDellEntita(voce, statoDi.get(voce.entity_id), nomi.get(deviceId) || ""));
      }
    }
  }

  return { integrations, devices, entities };
}

/* Quanto si tengono i registri prima di richiederli. */
const QUANTO_DURANO = 30_000;

export class Catalogo {
  constructor({ casa, registro, adesso = () => Date.now(), quantoDurano = QUANTO_DURANO } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.quantoDurano = quantoDurano;
    this._registri = null;
    this._registriLettiIl = 0;
    this._stati = null;
    this._statiLettiIl = 0;
  }

  /* Il catalogo, nella forma che la pagina si aspetta. Solleva se Home
   * Assistant non risponde alle domande che non possono mancare. */
  async chiedi({ deviceIds = null } = {}) {
    const registri = await this._iRegistri();
    const stati = Array.isArray(deviceIds) && deviceIds.length ? await this._gliStati() : [];
    return costruisciIlCatalogo({ ...registri, stati, deviceIds });
  }

  async _iRegistri() {
    const ora = this.adesso();
    if (this._registri && ora - this._registriLettiIl < this.quantoDurano) return this._registri;
    const [dispositivi, entita, aree, voci, manifesti] = await Promise.all([
      this.casa.chiedi({ type: "config/device_registry/list" }),
      this.casa.chiedi({ type: "config/entity_registry/list" }),
      this._facoltativa({ type: "config/area_registry/list" }),
      /* Le voci di configurazione e i manifesti vogliono un amministratore, e
       * il segno del Supervisor lo e'; se un giorno non lo fosse, il catalogo
       * esce lo stesso, con i nomi delle integrazioni al posto dei nomi belli. */
      this._facoltativa({ type: "config_entries/get" }),
      this._facoltativa({ type: "manifest/list" }),
    ]);
    this._registri = {
      dispositivi: elenco(dispositivi),
      entita: elenco(entita),
      aree: elenco(aree),
      voci: elenco(voci),
      manifesti: elenco(manifesti),
    };
    this._registriLettiIl = this.adesso();
    return this._registri;
  }

  async _gliStati() {
    const ora = this.adesso();
    if (this._stati && ora - this._statiLettiIl < this.quantoDurano) return this._stati;
    this._stati = elenco(await this._facoltativa({ type: "get_states" }));
    this._statiLettiIl = this.adesso();
    return this._stati;
  }

  async _facoltativa(comando) {
    try {
      return await this.casa.chiedi(comando);
    } catch (errore) {
      this.registro.attenzione(`${comando.type} non ha risposto: ${errore?.message || errore}`);
      return [];
    }
  }
}
