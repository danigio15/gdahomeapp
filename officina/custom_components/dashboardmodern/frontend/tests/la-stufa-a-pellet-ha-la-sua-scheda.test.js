/* «É possibile inserire una scheda per inserire i dati delle stufe a
 * pellet?» (#183)
 *
 * La stufa non e' la caldaia a pellet con un altro nome: scalda la stanza in
 * cui sta, e di lei si guardano la fiamma, la potenza, il ventilatore e il
 * serbatoio. Ogni marca la racconta a Home Assistant con le sue parole —
 * Micronova dice «Lavoro», MCZ «Power 3», Palazzetti `burning_mod`, Rika
 * parla tedesco — e queste prove tengono fermo il nucleo che le legge, quello
 * che dice quale servizio chiamare, e il posto della stufa nella Gestione
 * termica senza che chi c'era prima veda cambiare niente.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  BRICIOLE_TERMICHE,
  CASELLE_STUFA,
  CHIAVE_STUFE,
  ETICHETTE_TERMICHE,
  FASI_STUFA,
  PELLET_SCARSO,
  TITOLI_TERMICI,
  allarmeDellaStufa,
  comandoAccensione,
  comandoLivello,
  comandoObiettivo,
  entitaDelleStufe,
  faseStufa,
  impiantiScelti,
  letturaStufa,
  lettureStufe,
  livelloConValore,
  livelloDa,
  livelloDaiModi,
  normalizzaScelta,
  normalizzaStufe,
  pelletDellaStufa,
  prossimoLivello,
  prossimoObiettivo,
} from "../src/core/impianti-termici.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";
import { MAGAZZINO_DELLE_SEZIONI } from "../src/core/contenuto-delle-sezioni.js";
import { SENZA_TESSERA } from "../src/core/fuori-dai-widget.js";

const sorgente = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

/* Una stufa come la racconta un termostato qualunque: accesa in `heat`, che
 * scalda, a 20,5 gradi con l'obiettivo a 21. */
const CLIMA = {
  state: "heat",
  attributes: {
    hvac_modes: ["off", "heat"],
    hvac_action: "heating",
    current_temperature: 20.5,
    temperature: 21,
    min_temp: 7,
    max_temp: 30,
    target_temp_step: 0.5,
  },
};

const STATI = {
  "climate.stufa_soggiorno": CLIMA,
  "sensor.stufa_soggiorno_stato": { state: "Lavoro" },
  "number.stufa_soggiorno_potenza": { state: "3", attributes: { min: 1, max: 5, step: 1 } },
  "fan.stufa_soggiorno": { state: "on", attributes: { percentage: 60, percentage_step: 20 } },
  "sensor.stufa_soggiorno_fumi": { state: "160", attributes: { unit_of_measurement: "°C" } },
  "sensor.stufa_soggiorno_pellet": { state: "62", attributes: { unit_of_measurement: "%" } },
  "sensor.stufa_soggiorno_allarme": { state: "Nessun allarme" },
};

const STUFA = {
  id: "soggiorno",
  name: "Stufa del soggiorno",
  clima: "climate.stufa_soggiorno",
  stato: "sensor.stufa_soggiorno_stato",
  potenza: "number.stufa_soggiorno_potenza",
  ventilatore: "fan.stufa_soggiorno",
  fumi: "sensor.stufa_soggiorno_fumi",
  pellet: "sensor.stufa_soggiorno_pellet",
  allarme: "sensor.stufa_soggiorno_allarme",
};

/* ── il posto nella Gestione termica ─────────────────────────────────── */

test("la stufa e' la quarta macchina, in coda, coi suoi nomi", () => {
  assert.deepEqual(ETICHETTE_TERMICHE.stufa, ["Stufa a pellet", "Pellet stove"]);
  assert.deepEqual(TITOLI_TERMICI.stufa, ["Stufa a pellet", "Pellet stove"]);
  assert.deepEqual(BRICIOLE_TERMICHE.stufa, [
    "Fiamma · Potenza · Pellet",
    "Flame · Power · Pellet",
  ]);
  /* La briciola della sezione nomina tutte e quattro. */
  assert.ok(BRICIOLE_TERMICHE.sezione[0].endsWith("· Stufa"));
});

test("chi aveva gia' scelto non si trova la stufa accesa da sola", () => {
  /* Una scelta salvata prima della stufa non ha la sua chiave: e' spenta. */
  const vecchia = { solare: true, scaldabagno: false, caldaia: true };
  assert.equal(normalizzaScelta(vecchia).stufa, false);
  assert.deepEqual(impiantiScelti(vecchia, { stufa: true }), ["solare", "caldaia"]);
  /* Chi non ha mai scelto e ha configurato una stufa, la vede. */
  assert.deepEqual(impiantiScelti(null, { stufa: true }), ["stufa"]);
  assert.deepEqual(impiantiScelti(null, { caldaia: true, stufa: true }), ["caldaia", "stufa"]);
});

test("le stufe viaggiano con la configurazione e tengono accesa la sezione", () => {
  assert.equal(CHIAVE_STUFE, "cd_stufe");
  assert.ok(CONFIG_KEYS.includes("cd_stufe"));
  assert.ok(MAGAZZINO_DELLE_SEZIONI.boiler.chiavi.includes("cd_stufe"));
});

/* ── la lista ────────────────────────────────────────────────────────── */

test("le stufe sono una lista, e una riga vuota non e' una stufa", () => {
  const due = normalizzaStufe([
    { id: "soggiorno", name: " Soggiorno ", clima: "climate.a" },
    { name: "Mansarda", interruttore: "switch.b" },
    { name: "Appena aggiunta" },
  ]);
  assert.deepEqual(
    due.map((riga) => [riga.id, riga.name]),
    [
      ["soggiorno", "Soggiorno"],
      ["stufa-2", "Mansarda"],
    ],
  );
  /* Un oggetto solo si legge come una riga. */
  assert.equal(normalizzaStufe({ clima: "climate.a" }).length, 1);
  assert.deepEqual(normalizzaStufe(null), []);
  /* Ogni casella e' facoltativa, e ognuna conta come entita' da guardare. */
  for (const { campo } of CASELLE_STUFA)
    assert.equal(normalizzaStufe([{ [campo]: "x.y" }]).length, 1);
  assert.deepEqual(entitaDelleStufe([STUFA]), [
    "climate.stufa_soggiorno",
    "sensor.stufa_soggiorno_stato",
    "number.stufa_soggiorno_potenza",
    "fan.stufa_soggiorno",
    "sensor.stufa_soggiorno_fumi",
    "sensor.stufa_soggiorno_pellet",
    "sensor.stufa_soggiorno_allarme",
  ]);
});

/* ── le fasi ─────────────────────────────────────────────────────────── */

test("le fasi si riconoscono in italiano, in inglese e in tedesco", () => {
  const attese = {
    accensione: [
      "Accensione",
      "Ignition",
      "Zündung",
      "Zuendung",
      "Anheizen",
      "Carico pellet",
      "Fiamma presente",
      "Loading Pellets Cold",
      "Start 1 Hot",
      "heatup",
      "Checking hot or cold",
    ],
    lavoro: [
      "Lavoro",
      "Work",
      "Working",
      "Heating",
      "Heizen",
      "Heizbetrieb",
      "burning",
      "Power 3",
      "P3",
    ],
    modulazione: ["Modulazione", "Modulation", "Lavoro modulazione", "burning_mod", "Regelbetrieb"],
    pulizia: [
      "Pulizia braciere",
      "Cleaning",
      "Brazier cleaning",
      "clean_fire",
      "Brennraumreinigung",
    ],
    spegnimento: [
      "Spegnimento",
      "Shutdown",
      "Shutting down",
      "Cooling",
      "cool_fluid",
      "Pulizia finale",
      "Final cleaning",
      "Ausbrand",
      "Abkühlen",
    ],
    attesa: ["Standby", "Stand-by", "In attesa", "idle", "Bereit"],
    spenta: ["Spenta", "Spento", "Off", "Aus", "off_timer", "0"],
    allarme: [
      "Allarme",
      "Alarm",
      "Error",
      "Störung",
      "Stoerung",
      "Fehler",
      "Mancata accensione",
      "Allarme pellet esaurito",
      "pellet_finished",
      "hatch_door_open",
      "A01",
      "E108",
    ],
  };
  for (const [fase, parole] of Object.entries(attese))
    for (const parola of parole) assert.equal(faseStufa(parola), fase, parola);
  /* Ogni fase che si riconosce ha le sue parole in pagina. */
  for (const fase of Object.keys(attese)) assert.equal(FASI_STUFA[fase].length, 2, fase);
});

test("una fase che non conosciamo resta la parola che e'", () => {
  for (const parola of ["Selbsttest", "Diagnostics", "ecomode", "UNLOCKING SCREW"])
    assert.equal(faseStufa(parola), null, parola);
  /* Un promemoria di manutenzione non e' un allarme ne' una pulizia. */
  assert.equal(faseStufa("cleaning_warning"), null);
  assert.equal(faseStufa("Wartung"), null);
  /* L'assenza non e' una fase. */
  for (const muta of ["", "unavailable", "unknown", null]) assert.equal(faseStufa(muta), null);
  /* E la lettura la porta com'e', perche' la pagina la scriva. */
  const lettura = letturaStufa(
    { stato: "sensor.fase" },
    { "sensor.fase": { state: "Selbsttest" } },
  );
  assert.equal(lettura.fase, null);
  assert.equal(lettura.statoTesto, "Selbsttest");
});

/* ── la lettura ──────────────────────────────────────────────────────── */

test("la stufa si legge: fase, fuoco, stanza, obiettivo, fumi, pellet", () => {
  const lettura = letturaStufa(STUFA, STATI);
  assert.equal(lettura.fase, "lavoro");
  assert.equal(lettura.acceso, true);
  assert.equal(lettura.brucia, true);
  assert.equal(lettura.brace, false);
  /* Senza sonda della stanza, la temperatura e' quella del termostato. */
  assert.equal(lettura.temperatura, 20.5);
  assert.equal(lettura.obiettivo, 21);
  assert.deepEqual([...lettura.scala], [7, 30]);
  assert.equal(lettura.passoObiettivo, 0.5);
  assert.equal(lettura.fumi, 160);
  assert.equal(lettura.pellet, 62);
  assert.equal(lettura.pelletScarso, false);
  assert.deepEqual(lettura.allarme, { attivo: false, testo: "" });
  assert.equal(lettura.comando, "climate.stufa_soggiorno");
  /* La sonda della stanza, se c'e', vale piu' del termostato. */
  const conSonda = letturaStufa(
    { ...STUFA, temperatura: "sensor.stanza" },
    { ...STATI, "sensor.stanza": { state: "19.8" } },
  );
  assert.equal(conSonda.temperatura, 19.8);
});

test("senza la fase della stufa, la dice il termostato", () => {
  const solo = (azione, stato = "heat") =>
    letturaStufa(
      { clima: "climate.s" },
      { "climate.s": { state: stato, attributes: { hvac_action: azione } } },
    ).fase;
  assert.equal(solo("heating"), "lavoro");
  assert.equal(solo("preheating"), "accensione");
  assert.equal(solo("idle"), "attesa");
  assert.equal(solo("off", "off"), "spenta");
  assert.equal(solo(undefined, "off"), "spenta");
});

test("il fuoco c'e' solo quando brucia, e nello spegnimento resta la brace", () => {
  const conFase = (parola) =>
    letturaStufa({ stato: "sensor.f" }, { "sensor.f": { state: parola } });
  for (const parola of ["Accensione", "Lavoro", "Modulazione", "Pulizia braciere"])
    assert.equal(conFase(parola).brucia, true, parola);
  for (const parola of ["Spegnimento", "Standby", "Spenta", "Allarme"])
    assert.equal(conFase(parola).brucia, false, parola);
  assert.equal(conFase("Spegnimento").brace, true);
  /* Col solo interruttore non c'e' una fase: lo dice l'acceso, come l'oblo'
   * della caldaia per chi ha mappato solo lo stato. */
  const interruttore = (stato) =>
    letturaStufa({ interruttore: "switch.s" }, { "switch.s": { state: stato } });
  assert.equal(interruttore("on").brucia, true);
  assert.equal(interruttore("off").brucia, false);
  assert.equal(interruttore("on").comando, "switch.s");
});

test("l'allarme: un binary_sensor acceso, una parola, o una fase d'allarme", () => {
  assert.deepEqual(allarmeDellaStufa("binary_sensor.a", { state: "on" }), {
    entity: "binary_sensor.a",
    attivo: true,
    testo: "",
  });
  assert.equal(allarmeDellaStufa("binary_sensor.a", { state: "off" }).attivo, false);
  assert.deepEqual(allarmeDellaStufa("sensor.a", { state: "Mancata accensione" }), {
    entity: "sensor.a",
    attivo: true,
    testo: "Mancata accensione",
  });
  /* Le parole con cui un sensore dice che va tutto bene non accendono niente:
   * un allarme finto insegna a non guardare quelli veri. */
  for (const calma of [
    "Nessun allarme",
    "No alarm",
    "OK",
    "0",
    "none",
    "Keine Störung",
    "unavailable",
    "",
  ])
    assert.equal(allarmeDellaStufa("sensor.a", { state: calma }).attivo, false, calma);
  assert.equal(allarmeDellaStufa("", { state: "on" }), null);
  /* La fase d'allarme e' un allarme anche senza la casella apposta, e la sua
   * parola e' quella della fascia. */
  const daFase = letturaStufa(
    { stato: "sensor.f" },
    { "sensor.f": { state: "Allarme pellet esaurito" } },
  );
  assert.deepEqual(daFase.allarme, { attivo: true, testo: "Allarme pellet esaurito" });
  /* Il sensore d'allarme parla per primo. */
  const tutti = letturaStufa(
    { stato: "sensor.f", allarme: "sensor.a" },
    { "sensor.f": { state: "Allarme" }, "sensor.a": { state: "A01 · Mancata accensione" } },
  );
  assert.deepEqual(tutti.allarme, { attivo: true, testo: "A01 · Mancata accensione" });
});

test("il pellet: in percentuale con la soglia della caldaia, in chili, o un avviso", () => {
  assert.deepEqual(
    pelletDellaStufa("sensor.p", { state: "12", attributes: { unit_of_measurement: "%" } }),
    {
      pellet: 12,
      pelletChili: null,
      pelletScarso: true,
      pelletAvviso: false,
    },
  );
  assert.ok(12 <= PELLET_SCARSO);
  assert.equal(pelletDellaStufa("sensor.p", { state: "40" }).pelletScarso, false);
  assert.deepEqual(
    pelletDellaStufa("sensor.p", { state: "9", attributes: { unit_of_measurement: "kg" } }),
    {
      pellet: null,
      pelletChili: 9,
      pelletScarso: null,
      pelletAvviso: false,
    },
  );
  /* Il binary_sensor nel serbatoio: acceso vuol dire «sta finendo», e la quota
   * non si inventa. */
  assert.deepEqual(pelletDellaStufa("binary_sensor.p", { state: "on" }), {
    pellet: null,
    pelletChili: null,
    pelletScarso: true,
    pelletAvviso: true,
  });
  assert.equal(pelletDellaStufa("binary_sensor.p", { state: "off" }).pelletScarso, false);
  assert.equal(pelletDellaStufa("binary_sensor.p", { state: "unavailable" }).pelletScarso, null);
  assert.equal(pelletDellaStufa("", null).pelletAvviso, false);
});

/* ── i livelli: potenza e ventilatore ────────────────────────────────── */

test("la potenza come number: pallini, passo, e mai fuori dalla scala", () => {
  const potenza = livelloDa("number.p", { state: "3", attributes: { min: 1, max: 5, step: 1 } });
  assert.equal(potenza.modo, "numero");
  assert.equal(potenza.quanti, 5);
  assert.equal(potenza.livello, 3);
  assert.equal(prossimoLivello(potenza, 1), 4);
  assert.equal(prossimoLivello(potenza, -1), 2);
  assert.deepEqual(comandoLivello(potenza, -1), {
    domain: "number",
    service: "set_value",
    data: { entity_id: "number.p", value: 2 },
  });
  /* In cima e in fondo il tasto non manda niente. */
  const cima = livelloDa("number.p", { state: "5", attributes: { min: 1, max: 5, step: 1 } });
  assert.equal(prossimoLivello(cima, 1), null);
  assert.equal(comandoLivello(cima, 1), null);
  const fondo = livelloDa("input_number.p", {
    state: "1",
    attributes: { min: 1, max: 5, step: 1 },
  });
  assert.equal(prossimoLivello(fondo, -1), null);
  assert.equal(comandoLivello(fondo, 1).domain, "input_number");
  /* Un valore che non si sa non diventa un passo. */
  assert.equal(
    prossimoLivello(livelloDa("number.p", { state: "unknown", attributes: { min: 1, max: 5 } }), 1),
    null,
  );
  /* Passi da mezzo: la griglia parte dal minimo. */
  const mezzi = livelloDa("number.p", { state: "2.5", attributes: { min: 1, max: 3, step: 0.5 } });
  assert.equal(prossimoLivello(mezzi, 1), 3);
  assert.equal(mezzi.quanti, 5);
  assert.equal(mezzi.livello, 4);
});

test("la potenza come select: «P1»…«P5» e le opzioni dichiarate", () => {
  const opzioni = ["P1", "P2", "P3", "P4", "P5"];
  const potenza = livelloDa("select.p", { state: "P3", attributes: { options: opzioni } });
  assert.equal(potenza.modo, "scelta");
  assert.equal(potenza.quanti, 5);
  assert.equal(potenza.livello, 3);
  assert.deepEqual(comandoLivello(potenza, 1), {
    domain: "select",
    service: "select_option",
    data: { entity_id: "select.p", option: "P4" },
  });
  const ultima = livelloDa("input_select.p", { state: "P5", attributes: { options: opzioni } });
  assert.equal(comandoLivello(ultima, 1), null);
  assert.equal(comandoLivello(ultima, -1).domain, "input_select");
  /* Da un'opzione che non c'e', il «+» porta alla prima e il «−» non fa niente. */
  const fuori = livelloDa("select.p", { state: "Auto", attributes: { options: opzioni } });
  assert.equal(prossimoLivello(fuori, 1), "P1");
  assert.equal(prossimoLivello(fuori, -1), null);
});

test("il ventilatore: percentuale, preset, acceso e spento, o i modi del termostato", () => {
  const percento = livelloDa("fan.v", {
    state: "on",
    attributes: { percentage: 60, percentage_step: 20 },
  });
  assert.equal(percento.modo, "percento");
  assert.equal(percento.quanti, 5);
  assert.equal(percento.livello, 3);
  assert.deepEqual(comandoLivello(percento, 1), {
    domain: "fan",
    service: "set_percentage",
    data: { entity_id: "fan.v", percentage: 80 },
  });
  /* Spento e' a zero, non ignoto: il «+» lo accende al primo scatto. */
  const spento = livelloDa("fan.v", {
    state: "off",
    attributes: { percentage: null, percentage_step: 20 },
  });
  assert.equal(spento.valore, 0);
  assert.equal(prossimoLivello(spento, 1), 20);
  assert.equal(prossimoLivello(spento, -1), null);
  /* Tre velocita': 33, 67, 100 — percentuali intere. */
  const tre = livelloDa("fan.v", { state: "on", attributes: { percentage: 33, speed_count: 3 } });
  assert.equal(prossimoLivello(tre, 1), 67);
  const preset = livelloDa("fan.v", {
    state: "on",
    attributes: { preset_modes: ["low", "medium", "high"], preset_mode: "medium" },
  });
  assert.deepEqual(comandoLivello(preset, 1), {
    domain: "fan",
    service: "set_preset_mode",
    data: { entity_id: "fan.v", preset_mode: "high" },
  });
  const nudo = livelloDa("fan.v", { state: "off", attributes: {} });
  assert.equal(nudo.modo, "interruttore");
  assert.deepEqual(comandoLivello(nudo, 1), {
    domain: "fan",
    service: "turn_on",
    data: { entity_id: "fan.v" },
  });
  assert.equal(comandoLivello(nudo, -1), null);
  /* Un sensore si legge e basta. */
  const lettura = livelloDa("sensor.v", { state: "3" });
  assert.equal(lettura.modo, "lettura");
  assert.equal(comandoLivello(lettura, 1), null);
  /* Senza entita' sua, i modi del ventilatore del termostato. */
  const modi = livelloDaiModi("climate.s", {
    state: "heat",
    attributes: { fan_modes: ["auto", "1", "2", "3"], fan_mode: "2" },
  });
  assert.deepEqual(comandoLivello(modi, -1), {
    domain: "climate",
    service: "set_fan_mode",
    data: { entity_id: "climate.s", fan_mode: "1" },
  });
  assert.equal(livelloDaiModi("climate.s", { state: "heat", attributes: {} }), null);
  const conModi = letturaStufa(
    { clima: "climate.s" },
    { "climate.s": { state: "heat", attributes: { fan_modes: ["1", "2"], fan_mode: "1" } } },
  );
  assert.equal(conModi.ventilatore.modo, "modi");
  /* Non mappato non e' un livello a zero. */
  assert.equal(livelloDa("", null), null);
  /* Non disponibile: si vede, ma non si comanda. */
  const muto = livelloDa("number.p", { state: "unavailable", attributes: { min: 1, max: 5 } });
  assert.equal(muto.disponibile, false);
  assert.equal(comandoLivello(muto, 1), null);
});

test("il valore appena chiesto ricolora i pallini prima che torni lo stato", () => {
  const potenza = livelloDa("number.p", { state: "3", attributes: { min: 1, max: 5, step: 1 } });
  assert.equal(livelloConValore(potenza, 4).livello, 4);
  const scelta = livelloDa("select.p", {
    state: "P3",
    attributes: { options: ["P1", "P2", "P3"] },
  });
  assert.equal(livelloConValore(scelta, "P1").livello, 1);
  const ventola = livelloDa("fan.v", {
    state: "on",
    attributes: { percentage: 60, percentage_step: 20 },
  });
  assert.deepEqual(
    [livelloConValore(ventola, 0).livello, livelloConValore(ventola, 0).acceso],
    [0, false],
  );
});

/* ── l'obiettivo e l'accensione ──────────────────────────────────────── */

test("l'obiettivo si muove col passo della stufa e resta nella sua scala", () => {
  const lettura = letturaStufa(STUFA, STATI);
  assert.equal(prossimoObiettivo(lettura, 1), 21.5);
  assert.equal(prossimoObiettivo(lettura, -1), 20.5);
  assert.deepEqual(comandoObiettivo(lettura, 1), {
    domain: "climate",
    service: "set_temperature",
    data: { entity_id: "climate.stufa_soggiorno", temperature: 21.5 },
  });
  /* In cima alla scala che la stufa dichiara, niente. */
  assert.equal(prossimoObiettivo({ ...lettura, obiettivo: 30 }, 1), null);
  assert.equal(prossimoObiettivo({ ...lettura, obiettivo: 7 }, -1), null);
  /* Senza passo dichiarato, mezzo grado; con un passo dichiarato, il suo. */
  const senza = letturaStufa(
    { clima: "climate.s" },
    { "climate.s": { state: "heat", attributes: { temperature: 20 } } },
  );
  assert.equal(prossimoObiettivo(senza, 1), 20.5);
  const intero = letturaStufa(
    { clima: "climate.s" },
    { "climate.s": { state: "heat", attributes: { temperature: 20, target_temp_step: 1 } } },
  );
  assert.equal(prossimoObiettivo(intero, 1), 21);
  /* Senza termostato non c'e' un obiettivo da spostare. */
  assert.equal(comandoObiettivo({ obiettivo: 20, scala: [5, 35] }, 1), null);
});

test("si accende e si spegne per quello che si vuole, non con un «inverti»", () => {
  const lettura = letturaStufa(STUFA, STATI);
  assert.deepEqual(comandoAccensione(lettura, false), {
    domain: "climate",
    service: "set_hvac_mode",
    data: { entity_id: "climate.stufa_soggiorno", hvac_mode: "off" },
  });
  assert.equal(comandoAccensione(lettura, true).data.hvac_mode, "heat");
  /* Un termostato senza `heat` si accende nel primo modo che dichiara. */
  assert.equal(
    comandoAccensione({ clima: "climate.s", modiClima: ["off", "auto"] }, true).data.hvac_mode,
    "auto",
  );
  assert.deepEqual(comandoAccensione({ interruttore: "switch.stufa" }, true), {
    domain: "switch",
    service: "turn_on",
    data: { entity_id: "switch.stufa" },
  });
  assert.equal(
    comandoAccensione({ interruttore: "input_boolean.stufa" }, false).service,
    "turn_off",
  );
  /* Un binary_sensor si legge, non si comanda. */
  assert.equal(comandoAccensione({ interruttore: "binary_sensor.stufa" }, true), null);
  assert.equal(comandoAccensione({}, true), null);
});

test("le letture di piu' stufe, ognuna col suo id", () => {
  const letture = lettureStufe([STUFA, { name: "Mansarda", interruttore: "switch.mansarda" }], {
    ...STATI,
    "switch.mansarda": { state: "off" },
  });
  assert.deepEqual(
    letture.map((riga) => [riga.id, riga.acceso]),
    [
      ["soggiorno", true],
      ["stufa-2", false],
    ],
  );
});

/* ── la pagina e la scheda ───────────────────────────────────────────── */

test("la pagina disegna la stufa e chiama i servizi come la caldaia", () => {
  const scena = sorgente("../src/sections/impianti-termici-section.js");
  assert.match(scena, /function scenaStufa\(lettura\)/);
  /* Senza conferma e senza aspettare, come l'interruttore della caldaia. */
  assert.match(scena, /chiamaServizio\(comando\);/);
  /* Il fuoco segue la lettura, e chi le animazioni non le vuole non le vede. */
  assert.match(scena, /data-brucia="\$\{lettura\.brucia === true\}"/);
  assert.match(
    scena,
    /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\.dm-it-stufa-lingua[\s\S]*?\.dm-it-stufa-ventola-pale\{animation:none!important\}/,
  );
  /* Al buio la stufa ha i suoi colori. */
  assert.match(scena, /html\[data-theme="dark"\] #\$\{PAGINA\} \.dm-it-stufa\{/);
  /* Sul telefono i tasti sono da dito. */
  assert.match(scena, /\.dm-it-stufa-passo\{width:48px;height:48px/);
});

test("la scheda della stufa ha le parole di ogni casella, e nessun «nel widget»", () => {
  const scheda = sorgente("../src/sections/impianti-termici-editor-section.js");
  const tabella = scheda.slice(
    scheda.indexOf("const CAMPI_STUFA"),
    scheda.indexOf("function stufe()"),
  );
  for (const { campo } of CASELLE_STUFA)
    assert.match(tabella, new RegExp(`^ {2}${campo}: \\{`, "m"), campo);
  assert.ok(tabella.includes('esempio: "climate.stufa_soggiorno"'));
  /* In Home la stufa una tessera non ce l'ha: il pannello lo dichiara, e chi
   * mette gli interruttori «nel widget» lo salta. */
  assert.match(scheda, /\$\{SENZA_TESSERA\}>\$\{stufaMarkup\(\)\}/);
  const interruttori = sorgente("../src/sections/widget-entity-choice-section.js");
  assert.ok(interruttori.includes("slot.closest(`[${SENZA_TESSERA}]`)"));
  assert.ok(interruttori.includes("row.closest(`[${SENZA_TESSERA}]`)"));
  assert.equal(SENZA_TESSERA, "data-dm-senza-tessera");
  /* E la ricerca nel Config porta dove la stufa si configura. */
  const ricerca = sorgente("../src/sections/cerca-nel-config-section.js");
  assert.match(ricerca, /cd_stufe: "sez3",/);
});

test("le parole della stufa finiscono nei cataloghi", () => {
  const corpus = sorgente("../src/i18n/source-index.js");
  for (const parola of [
    "Stufa a pellet",
    "Termostato della stufa",
    "Fase della stufa",
    "Allarme della stufa",
    "Pulizia braciere",
    "Spegnimento",
    "Fiamma · Potenza · Pellet",
    "Aggiungi stufa",
  ])
    assert.ok(corpus.includes(`"${parola}"`), `«${parola}» è fuori dai cataloghi`);
});
