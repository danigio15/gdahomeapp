/* L'Amazfit: si abbina da se', come un telefono in piu', e con la sua chiave
 * chiede solo la fotografia e i comandi (`il-polso.js`).
 *
 * Qui la presa e' finta come nelle prove del portiere, la Home Assistant e'
 * un oggetto che risponde a `get_states` e si segna i servizi chiamati, e i
 * dispositivi sono quelli veri, su una cartella buttata via alla fine.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Abbinamento } from "../src/abbinamento.js";
import {
  aperturaNuova,
  Busta,
  chiaveDiSessione,
  coppiaEffimera,
  improntaDellaStretta,
  VERSIONE,
  VERSIONE_DEL_LEGAME,
  VERSIONE_DELL_ABBINAMENTO,
} from "../src/cifra.js";
import { Dispositivi, POLSO_ZEPP } from "../src/dispositivi.js";
import { fotografaPerIlPolso, IlPolso } from "../src/il-polso.js";
import { Portiere } from "../src/portiere.js";

const giro = () => new Promise((ok) => setTimeout(ok, 5));

/* ─── La casa d'esempio, con nomi di nessuno ─────────────────────────────── */

const VALORI = {
  cd_luci: JSON.stringify({ "light.soggiorno": "Faretti soggiorno", "light.cucina": "Cucina" }),
  cd_security_doors: JSON.stringify([
    { name: "Cancello", entity: "cover.cancello" },
    { name: "Portone", entity: "lock.portone" },
  ]),
  cd_prese: JSON.stringify([{ name: "Lavatrice", entity: "switch.lavatrice" }]),
  cd_quick_actions: JSON.stringify([
    { name: "Buonanotte", type: "script", entity: "script.buonanotte" },
    { name: "Inserisci l'allarme", type: "entity", entity: "alarm_control_panel.casa" },
    { name: "Apri il portone", type: "entity", entity: "lock.portone" },
  ]),
  cd_entity_overrides: JSON.stringify({ "dm.energy_potenza_fotovoltaico": "sensor.solare" }),
};

const STATI = [
  {
    entity_id: "light.soggiorno",
    state: "on",
    attributes: { brightness: 191, supported_color_modes: ["brightness"] },
  },
  { entity_id: "light.cucina", state: "off", attributes: { supported_color_modes: ["onoff"] } },
  { entity_id: "cover.cancello", state: "closed", attributes: {} },
  { entity_id: "lock.portone", state: "locked", attributes: {} },
  { entity_id: "switch.lavatrice", state: "off", attributes: {} },
  { entity_id: "script.buonanotte", state: "off", attributes: {} },
  { entity_id: "alarm_control_panel.casa", state: "disarmed", attributes: {} },
  { entity_id: "sensor.solare", state: "3240", attributes: { unit_of_measurement: "W" } },
];

function homeAssistantFinta() {
  const chiamati = [];
  const stati = STATI.map((uno) => structuredClone(uno));
  return {
    chiamati,
    stati,
    async chiedi(comando) {
      if (comando.type === "get_states") return structuredClone(stati);
      if (comando.type === "get_config") return { location_name: "Casa" };
      if (comando.type === "call_service") {
        chiamati.push(comando);
        for (const id of comando.service_data.entity_id) {
          const stato = stati.find((uno) => uno.entity_id === id);
          if (stato && comando.service === "toggle")
            stato.state = stato.state === "on" ? "off" : "on";
        }
        return null;
      }
      throw new Error(`domanda inattesa: ${comando.type}`);
    },
  };
}

const configurazioneFinta = (valori = VALORI) => ({
  leggi: () => ({ snapshot: { values: valori } }),
});

/* ─── La fotografia ──────────────────────────────────────────────────────── */

test("la fotografia del polso ha le luci, i cancelli e le prese, e mai serrature e antifurto", () => {
  const { foto, ricette } = fotografaPerIlPolso({
    valori: VALORI,
    stati: STATI,
    casa: "Casa",
    adesso: 1000,
  });
  const ids = foto.dispositivi.map((uno) => uno.id);
  assert.ok(ids.includes("light.soggiorno"));
  assert.ok(ids.includes("light.cucina"), "al polso anche le luci spente");
  assert.ok(ids.includes("cover.cancello"));
  assert.ok(ids.includes("switch.lavatrice"));
  assert.equal(ids.includes("lock.portone"), false, "la serratura non va al polso");

  const soggiorno = foto.dispositivi.find((uno) => uno.id === "light.soggiorno");
  assert.equal(soggiorno.luminosita, 75);
  assert.equal(soggiorno.stato, "Accesa");
  const cucina = foto.dispositivi.find((uno) => uno.id === "light.cucina");
  assert.equal("luminosita" in cucina, false, "una luce che non si abbassa non ha il dimmer");

  const buonanotte = foto.azioni.find((uno) => uno.nome === "Buonanotte");
  assert.equal(buonanotte.subito, true);
  const allarme = foto.azioni.find((uno) => uno.nome === "Inserisci l'allarme");
  assert.equal(allarme.subito, false, "l'antifurto si vede ma dal polso non parte");
  assert.equal(ricette.has(allarme.id), false);
  for (const ricetta of ricette.values()) {
    for (const id of ricetta.entita.split(",")) {
      assert.equal(/^(lock|alarm_control_panel)\./.test(id), false, id);
    }
  }
  assert.deepEqual(foto.misure, [{ nome: "Produzione", valore: "3,2 kW" }]);
  assert.equal(JSON.stringify(foto).includes("ricetta"), false, "le ricette non escono di casa");
});

/* ─── I comandi ──────────────────────────────────────────────────────────── */

function unPolso({ chiave = "a".repeat(64) } = {}) {
  const casa = homeAssistantFinta();
  const dispositivi = {
    chiaveDi: () => chiave,
    utenteDi: () => "",
    visto() {},
  };
  const polso = new IlPolso({
    casa,
    configurazione: configurazioneFinta(),
    dispositivi,
    attesaDopoIlComando: 0,
  });
  return { casa, polso };
}

test("dal polso si accende una luce, se ne cambia la luminosita' e parte un'azione", async () => {
  const { casa, polso } = unPolso();
  const acceso = await polso.comando("dm_x", { id: "light.cucina", cosa: "gira" });
  assert.equal(acceso.ok, true);
  assert.equal(acceso.testo, "Fatto");
  assert.equal(acceso.foto.dispositivi.find((uno) => uno.id === "light.cucina").acceso, true);
  assert.deepEqual(casa.chiamati[0].service_data.entity_id, ["light.cucina"]);
  assert.equal(casa.chiamati[0].service, "toggle");

  const piano = await polso.comando("dm_x", {
    id: "light.soggiorno",
    cosa: "luminosita",
    valore: 30,
  });
  assert.equal(piano.ok, true);
  assert.equal(casa.chiamati[1].service, "turn_on");
  assert.equal(casa.chiamati[1].service_data.brightness_pct, 30);

  const { foto } = await polso.fotografia("dm_x");
  const buonanotte = foto.azioni.find((uno) => uno.nome === "Buonanotte");
  const azione = await polso.comando("dm_x", { id: buonanotte.id, cosa: "azione" });
  assert.equal(azione.ok, true);
  assert.equal(casa.chiamati[2].domain, "script");
  assert.equal(casa.chiamati[2].service, "turn_on");
});

test("dal polso non parte quello che non e' nella fotografia, ne' serrature e antifurto", async () => {
  const { casa, polso } = unPolso();
  for (const domanda of [
    { id: "lock.portone", cosa: "gira" },
    { id: "alarm_control_panel.casa", cosa: "gira" },
    { id: "light.inventata", cosa: "gira" },
    { id: "cover.cancello", cosa: "luminosita", valore: 50 },
    { id: "light.soggiorno", cosa: "luminosita", valore: 500 },
    { id: "light.soggiorno", cosa: "azione" },
    { id: "1|Inserisci l'allarme", cosa: "azione" },
    { id: "2|Apri il portone", cosa: "azione" },
    { id: "light.soggiorno", cosa: "chiama_un_servizio" },
  ]) {
    const risposta = await polso.comando("dm_x", domanda);
    assert.equal(risposta.ok, false, JSON.stringify(domanda));
  }
  assert.equal(casa.chiamati.length, 0, "Home Assistant non e' stata toccata");
});

/* ─── Il portiere e l'abbinamento ────────────────────────────────────────── */

function presaFinta() {
  const presa = {
    mandati: [],
    chiusa: null,
    viva: true,
    onMessaggio() {},
    onChiusa() {},
    manda(testo) {
      presa.mandati.push(testo);
      return true;
    },
    chiudi(codice, motivo) {
      if (presa.chiusa) return;
      presa.viva = false;
      presa.chiusa = { codice, motivo };
      presa.onChiusa();
    },
    arriva(testo) {
      presa.onMessaggio(testo);
    },
  };
  return presa;
}

/* L'orologio, fatto a mano con `cifra.js`: la stessa stretta dell'app,
 * con `polso: "zepp"` nella prima riga. */
function unOrologio(presa, { codice = null, chi = null, chiaveDelFilo = null } = {}) {
  const mia = coppiaEffimera();
  const apertura = aperturaNuova();
  const ciao = JSON.stringify({
    v: VERSIONE,
    ...(codice != null ? { abbina: VERSIONE_DELL_ABBINAMENTO } : { chi }),
    apertura: apertura.toString("base64"),
    mia: mia.pubblica.toString("base64"),
    lega: VERSIONE_DEL_LEGAME,
    polso: POLSO_ZEPP,
  });
  presa.arriva(ciao);
  const riga = presa.mandati.find((uno) => uno.startsWith("{") && JSON.parse(uno).pronto);
  assert.ok(riga, `nessun pronto: ${presa.mandati.join(" | ")}`);
  const pronto = JSON.parse(riga);
  const busta = new Busta(
    chiaveDiSessione({
      miaPrivata: mia.privata,
      suaPubblica: pronto.mia,
      delTelefono: mia.pubblica,
      dellaCasa: Buffer.from(pronto.mia, "base64"),
      apertura,
      ...(codice != null ? { codice } : { chiaveDelFilo }),
      stretta: improntaDellaStretta(ciao, riga),
    }),
    { io: "telefono" },
  );
  const aperte = [];
  return {
    mia: mia.pubblica.toString("base64"),
    sua: pronto.mia,
    manda: (cosa) => presa.arriva(busta.chiudi(JSON.stringify(cosa))),
    /* Le buste arrivate, aperte una volta sola: il contatore va avanti. */
    lette: () => {
      const nuove = presa.mandati.filter((uno) => !uno.startsWith("{")).slice(aperte.length);
      for (const una of nuove) aperte.push(JSON.parse(busta.apri(una)));
      return aperte;
    },
  };
}

test("l'Amazfit si abbina col codice di «Abbina un telefono», e con la sua chiave chiede solo al polso", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "polso-"));
  try {
    const dispositivi = new Dispositivi({ cartella });
    const abbinamento = new Abbinamento({});
    const casa = homeAssistantFinta();
    const accolti = [];
    const ponte = { accogli: (presa) => accolti.push(presa), polso: null };
    ponte.polso = new IlPolso({
      casa,
      configurazione: configurazioneFinta(),
      dispositivi,
      attesaDopoIlComando: 0,
    });
    const portiere = new Portiere({ ponte, dispositivi, abbinamento, registro: null });

    /* L'abbinamento. */
    const { codice } = abbinamento.nuovo();
    const presa = presaFinta();
    portiere.accogli(presa, { da: "centralino 203.0.113.9", daCasa: false });
    const orologio = unOrologio(presa, { codice });
    orologio.manda({
      t: "conferma",
      telefono: orologio.mia,
      casa: orologio.sua,
      nome: "Amazfit",
      sistema: "zepp",
      polso: POLSO_ZEPP,
    });
    await giro();
    const [ecco] = orologio.lette();
    assert.equal(ecco.t, "ecco");
    const id = ecco.dispositivo.id;
    assert.equal(dispositivi.polsoDi(id), POLSO_ZEPP);
    const riga = dispositivi.elenco().find((uno) => uno.id === id);
    assert.equal(riga.polso, POLSO_ZEPP, "la console lo sa");

    /* Il filo di tutti i giorni: al polso, non al ponte. */
    const filo = presaFinta();
    portiere.accogli(filo, { da: "centralino 203.0.113.9", abbina: false, daCasa: false });
    const dentro = unOrologio(filo, { chi: id, chiaveDelFilo: ecco.chiave });
    dentro.manda({ n: 1, t: "foto" });
    await giro();
    assert.equal(accolti.length, 0, "il ponte di Home Assistant non l'ha visto");
    const [foto] = dentro.lette();
    assert.equal(foto.n, 1);
    assert.equal(foto.ok, true);
    assert.ok(foto.foto.dispositivi.length > 0);

    /* Il protocollo di Home Assistant con quella chiave non passa. */
    dentro.manda({ id: 2, type: "get_states" });
    await giro();
    const [, risposta] = dentro.lette();
    assert.equal(risposta.ok, false);
    assert.equal(JSON.stringify(risposta).includes("lock.portone"), false);

    /* Staccato dalla console: il filo cade. */
    assert.equal(ponte.polso.collegatiPerDispositivo().get(id), 1);
    dispositivi.stacca(id);
    assert.equal(ponte.polso.scollega(id), 1);
    assert.equal(filo.chiusa.codice, 1008);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("un telefono che si dice orologio solo nella prima riga resta un telefono", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "polso-"));
  try {
    const dispositivi = new Dispositivi({ cartella });
    const { dispositivo, chiave } = dispositivi.abbina({ nome: "Telefono", sistema: "android" });
    const accolti = [];
    const ponte = {
      accogli: (presa) => accolti.push(presa),
      polso: { accogli: () => assert.fail() },
    };
    const portiere = new Portiere({
      ponte,
      dispositivi,
      abbinamento: new Abbinamento({}),
      registro: null,
    });
    const presa = presaFinta();
    portiere.accogli(presa, { da: "192.168.1.5", abbina: false });
    unOrologio(presa, { chi: dispositivo.id, chiaveDelFilo: chiave });
    assert.equal(accolti.length, 1, "e' passato dal ponte, come sempre");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
