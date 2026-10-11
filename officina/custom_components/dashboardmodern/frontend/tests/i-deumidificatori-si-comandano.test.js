/* «Problemi di comunicazione con dei deumidificatori di marca Comfee tramite
 * Midea: non riconosciuti con tutti i comandi del dispositivo. Li ho integrati
 * su Home Assistant e funzionano benissimo.» (#205)
 *
 * In Home Assistant funzionavano, qui no: qui l'unico posto per loro era
 * un'unità del Clima, cioè un termostato, e una card che chiede i gradi e il
 * caldo o il freddo non sa cosa farsene di un `humidifier`. Adesso hanno una
 * fascia loro nel Clima: l'umidità di adesso, l'obiettivo con − e +, le
 * modalità della macchina, la ventola e il serbatoio pieno.
 *
 * Queste prove guardano le regole a tavolino — quale servizio parte per ogni
 * tasto, dove si ferma l'obiettivo, quali entità si trovano da sole — e che
 * un deumidificatore rimasto fra le unità del Clima esca dalle card dei gradi
 * per entrare nella sua fascia.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  CHIAVE_DEUMIDIFICATORI,
  MASSIMO_DEUMIDIFICATORI,
  caselleProposte,
  comandoDeumidificatore,
  completaDeumidificatore,
  deumidificatoriDaMostrare,
  deumidificatoriDalClima,
  letturaDeumidificatore,
  normalizzaDeumidificatori,
  obiettivoVicino,
} from "../src/core/deumidificatori.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const stato = (state, attributes = {}) => ({ state, attributes });

/* Un Comfee col cloud Midea, com'e' in Home Assistant: le modalita' sono
 * quelle che scrive l'integrazione, maiuscole e trattini compresi. */
const COMFEE = {
  "humidifier.deumidificatore_sala": stato("on", {
    friendly_name: "Comfee sala",
    device_class: "dehumidifier",
    humidity: 50,
    current_humidity: 63,
    min_humidity: 35,
    max_humidity: 85,
    available_modes: ["Set", "Continuous", "Smart", "Clothes-Dry"],
    mode: "Set",
    action: "drying",
  }),
  "binary_sensor.deumidificatore_sala_tank_full": stato("on"),
  "sensor.deumidificatore_sala_humidity": stato("63", {
    device_class: "humidity",
    unit_of_measurement: "%",
  }),
  "sensor.deumidificatore_sala_temperature": stato("21.4", {
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
  "fan.deumidificatore_sala_fan": stato("on", {
    preset_modes: ["low", "medium", "high"],
    preset_mode: "medium",
  }),
  "sensor.deumidificatore_sala_power": stato("212", {
    device_class: "power",
    unit_of_measurement: "W",
  }),
  /* Una seconda macchina, col nome che comincia come la prima. */
  "humidifier.deumidificatore_sala_2": stato("off", { humidity: 45 }),
  "binary_sensor.deumidificatore_sala_2_tank_full": stato("off"),
};

const SALA = { id: "sala", nome: "Sala", entita: "humidifier.deumidificatore_sala" };

test("la configurazione viaggia fra i dispositivi come le altre", () => {
  assert.equal(CHIAVE_DEUMIDIFICATORI, "cd_deumidificatori");
  assert.ok(CONFIG_KEYS.includes("cd_deumidificatori"));
});

test("la lettura dice quello che la macchina sa: umidità, obiettivo, modi, serbatoio", () => {
  const lettura = letturaDeumidificatore(completaDeumidificatore(SALA, COMFEE), COMFEE);
  assert.equal(lettura.nome, "Sala");
  assert.equal(lettura.acceso, true);
  assert.equal(lettura.muto, false);
  assert.equal(lettura.tipo, "deumidificatore");
  assert.equal(lettura.azione, "drying");
  assert.equal(lettura.attuale, 63);
  assert.equal(lettura.obiettivo, 50);
  assert.equal(lettura.minimo, 35);
  assert.equal(lettura.massimo, 85);
  assert.deepEqual(lettura.modi, ["Set", "Continuous", "Smart", "Clothes-Dry"]);
  assert.equal(lettura.modo, "Set");
  /* Il serbatoio pieno è l'avviso che conta: una macchina col secchio pieno
   * si ferma, e da fuori sembra rotta. */
  assert.equal(lettura.serbatoioPieno, true);
  assert.deepEqual(
    lettura.avvisi.map((avviso) => avviso.chiave),
    ["serbatoio_pieno"],
  );
  assert.equal(lettura.temperatura, 21.4);
  assert.equal(lettura.consumo, 212);
  assert.deepEqual(lettura.ventola.opzioni, ["low", "medium", "high"]);
  assert.equal(lettura.ventola.scelta, "medium");
});

test("senza current_humidity l'umidità di adesso la dice il sensore accanto", () => {
  const stati = {
    "humidifier.vecchio": stato("on", { humidity: 55 }),
    "sensor.vecchio_humidity": stato("71", { device_class: "humidity", unit_of_measurement: "%" }),
  };
  const lettura = letturaDeumidificatore(
    { entita: "humidifier.vecchio", umidita: "sensor.vecchio_humidity" },
    stati,
  );
  assert.equal(lettura.attuale, 71);
  /* E il serbatoio che non si sa non è «vuoto»: è non saputo. */
  assert.equal(lettura.serbatoioPieno, null);
  assert.deepEqual(lettura.avvisi, []);
});

test("una macchina che non risponde resta in pagina, e lo dice", () => {
  const lettura = letturaDeumidificatore(SALA, {
    "humidifier.deumidificatore_sala": stato("unavailable"),
  });
  assert.equal(lettura.muto, true);
  assert.equal(lettura.acceso, null);
});

test("il − e il + vanno di passo in passo, e non escono dai limiti", () => {
  const base = { obiettivo: 50, minimo: 35, massimo: 85, passo: 5 };
  assert.equal(obiettivoVicino(base, 1), 55);
  assert.equal(obiettivoVicino(base, -1), 45);
  /* Un 47 lasciato da un'altra app: col meno va a 45, non a 42 — prima si
   * rimette sul passo, poi si sposta. */
  assert.equal(obiettivoVicino({ ...base, obiettivo: 47 }, -1), 45);
  assert.equal(obiettivoVicino({ ...base, obiettivo: 47 }, 1), 50);
  /* Ai bordi si ferma. */
  assert.equal(obiettivoVicino({ ...base, obiettivo: 85 }, 1), 85);
  assert.equal(obiettivoVicino({ ...base, obiettivo: 35 }, -1), 35);
  /* Senza passo dichiarato si va di cinque, come sul pannello del Comfee. */
  assert.equal(obiettivoVicino({ obiettivo: 50 }, 1), 55);
  /* Senza obiettivo si parte dall'umidità di adesso. */
  assert.equal(obiettivoVicino({ attuale: 61, passo: 5, minimo: 30, massimo: 80 }, -1), 60);
});

test("ogni tasto della card chiama il servizio giusto", () => {
  const lettura = letturaDeumidificatore(completaDeumidificatore(SALA, COMFEE), COMFEE);
  const ent = { entity_id: "humidifier.deumidificatore_sala" };
  assert.deepEqual(comandoDeumidificatore(lettura, "accendi"), {
    domain: "humidifier",
    service: "turn_on",
    data: ent,
  });
  assert.deepEqual(comandoDeumidificatore(lettura, "spegni"), {
    domain: "humidifier",
    service: "turn_off",
    data: ent,
  });
  /* Acceso, il tasto di accensione spegne; spento, accende. */
  assert.equal(comandoDeumidificatore(lettura, "commuta").service, "turn_off");
  assert.equal(comandoDeumidificatore({ ...lettura, acceso: false }, "commuta").service, "turn_on");
  assert.deepEqual(comandoDeumidificatore(lettura, "umidita", 55), {
    domain: "humidifier",
    service: "set_humidity",
    data: { ...ent, humidity: 55 },
  });
  /* Fuori dai limiti si ferma al bordo invece di mandare un numero che la
   * macchina rifiuta. */
  assert.equal(comandoDeumidificatore(lettura, "umidita", 99).data.humidity, 85);
  assert.equal(comandoDeumidificatore(lettura, "umidita", "niente"), null);
  assert.deepEqual(comandoDeumidificatore(lettura, "modo", "Continuous"), {
    domain: "humidifier",
    service: "set_mode",
    data: { ...ent, mode: "Continuous" },
  });
  /* Una modalità che la macchina non ha non parte. */
  assert.equal(comandoDeumidificatore(lettura, "modo", "Turbo"), null);
  assert.deepEqual(comandoDeumidificatore(lettura, "ventola", "high"), {
    domain: "fan",
    service: "set_preset_mode",
    data: { entity_id: "fan.deumidificatore_sala_fan", preset_mode: "high" },
  });
  assert.equal(comandoDeumidificatore(lettura, "ventola", "uragano"), null);
  assert.equal(comandoDeumidificatore(lettura, "boh"), null);
  assert.equal(comandoDeumidificatore({}, "accendi"), null);
});

test("una ventola fatta a select si comanda con select_option", () => {
  const stati = {
    "humidifier.d": stato("on", {}),
    "select.d_fan_speed": stato("Low", { options: ["Low", "High"] }),
  };
  const lettura = letturaDeumidificatore(
    { entita: "humidifier.d", ventola: "select.d_fan_speed" },
    stati,
  );
  assert.deepEqual(comandoDeumidificatore(lettura, "ventola", "High"), {
    domain: "select",
    service: "select_option",
    data: { entity_id: "select.d_fan_speed", option: "High" },
  });
});

test("scelto l'humidifier, le caselle accanto si trovano dal nome", () => {
  assert.deepEqual(caselleProposte("humidifier.deumidificatore_sala", COMFEE), {
    serbatoio: "binary_sensor.deumidificatore_sala_tank_full",
    umidita: "sensor.deumidificatore_sala_humidity",
    temperatura: "sensor.deumidificatore_sala_temperature",
    ventola: "fan.deumidificatore_sala_fan",
    consumo: "sensor.deumidificatore_sala_power",
  });
  /* La seconda macchina ha il suo serbatoio e non quello della prima — e la
   * prima non si prende quello della seconda, che col nome le somiglia. */
  assert.deepEqual(caselleProposte("humidifier.deumidificatore_sala_2", COMFEE), {
    serbatoio: "binary_sensor.deumidificatore_sala_2_tank_full",
  });
});

test("salvando, le caselle scritte a mano restano quelle", () => {
  const completa = completaDeumidificatore({ ...SALA, umidita: "sensor.igrometro_sala" }, COMFEE);
  assert.equal(completa.umidita, "sensor.igrometro_sala");
  assert.equal(completa.serbatoio, "binary_sensor.deumidificatore_sala_tank_full");
});

test("chi l'aveva messo fra le unità del Clima lo ritrova come deumidificatore", () => {
  /* È quello che ha fatto chi ha aperto la #205: rifargli la configurazione
   * da capo sarebbe stato un altro difetto. */
  const clima = [
    { entity: "climate.salotto", name: "Salotto", type: "clima" },
    { entity: "humidifier.deumidificatore_sala", name: "Comfee", room: "sala", type: "clima" },
    { entity: "humidifier.deumidificatore_sala", name: "Doppio", type: "clima" },
  ];
  const dalClima = deumidificatoriDalClima(clima);
  assert.equal(dalClima.length, 1);
  assert.equal(dalClima[0].entita, "humidifier.deumidificatore_sala");
  assert.equal(dalClima[0].nome, "Comfee");
  assert.equal(dalClima[0].stanza, "sala");

  /* Se poi lo configura nella sua scheda, si vede una volta sola. */
  const mostrati = deumidificatoriDaMostrare([SALA], clima);
  assert.equal(mostrati.length, 1);
  assert.equal(mostrati[0].id, "sala");
});

test("l'elenco non ha doppioni di id e non passa il tetto", () => {
  const tanti = Array.from({ length: 9 }, (_, i) => ({ id: "x", entita: `humidifier.d${i}` }));
  const elenco = normalizzaDeumidificatori(tanti);
  assert.equal(elenco.length, MASSIMO_DEUMIDIFICATORI);
  assert.equal(new Set(elenco.map((voce) => voce.id)).size, elenco.length);
});

test("un humidifier fra le unità del Clima esce dalle card dei gradi", async () => {
  const { climateUnits, unitaDelClimaScritte } = await import(
    `../src/sections/climate-thermal-section.js?deum=${Date.now()}`
  );
  const previous = globalThis.getClimaUnits;
  try {
    globalThis.getClimaUnits = () => [
      { entity: "climate.salotto", name: "Salotto", type: "clima" },
      { entity: "humidifier.deumidificatore_sala", name: "Comfee", type: "clima" },
    ];
    assert.deepEqual(
      climateUnits().map((unita) => unita.entity),
      ["climate.salotto"],
    );
    /* …ma resta nella configurazione scritta, da dove la fascia lo prende. */
    assert.equal(unitaDelClimaScritte().length, 2);
  } finally {
    if (previous === undefined) delete globalThis.getClimaUnits;
    else globalThis.getClimaUnits = previous;
  }
});

test("la card parla come la macchina: modi tradotti, pausa diversa da spento", async () => {
  const { parolaModo, parolaVentola, statoInParole, deumidificatoriMarkup } =
    await import("../src/sections/deumidificatori-section.js");
  assert.equal(parolaModo("Continuous"), "Continuo");
  assert.equal(parolaModo("Set"), "Manuale");
  assert.equal(parolaModo("Clothes-Dry"), "Asciuga bucato");
  assert.equal(parolaModo("dry_shoes"), "Asciuga scarpe");
  /* Quello che non conosciamo si mostra com'è, con la maiuscola. */
  assert.equal(parolaModo("purple_rain"), "Purple rain");
  assert.equal(parolaVentola("high"), "Alta");

  const base = { muto: false, acceso: true, tipo: "deumidificatore" };
  assert.equal(statoInParole({ ...base, azione: "drying" }), "Sta deumidificando");
  /* Acceso e fermo perché l'aria è già secca: sta facendo il suo lavoro. */
  assert.equal(statoInParole({ ...base, azione: "idle" }), "In pausa: aria già asciutta");
  assert.equal(statoInParole({ ...base, acceso: false, azione: "off" }), "Spento");
  assert.equal(statoInParole({ ...base, muto: true }), "Non risponde");

  const lettura = letturaDeumidificatore(completaDeumidificatore(SALA, COMFEE), COMFEE);
  const markup = deumidificatoriMarkup([lettura]);
  assert.match(markup, /Deumidificatori/);
  assert.match(markup, /data-avvisa="true"/);
  assert.match(markup, /Serbatoio pieno — svuotalo/);
  assert.match(markup, /data-dm-deum-azione="meno"/);
  assert.match(markup, /data-dm-deum-azione="piu"/);
  assert.match(markup, /data-dm-deum-valore="Continuous"[^>]*>Continuo</);
  assert.match(markup, /data-dm-deum-valore="Set" aria-pressed="true"/);
  assert.equal(deumidificatoriMarkup([]), "");
});

test("la pagina del Clima ha il posto per la fascia e il tocco passa di lì", () => {
  const fonte = readFileSync(
    new URL("../src/sections/climate-thermal-section.js", import.meta.url),
    "utf8",
  );
  assert.match(fonte, /<div data-dm-vmc-posto><\/div>[\s\S]*<div data-dm-deum-posto><\/div>/);
  assert.match(fonte, /dipingiIDeumidificatori\(shell, states\);/);
  assert.match(fonte, /toccaUnDeumidificatore\(event, unitaDelClimaScritte\(\)\)/);
  const runtime = readFileSync(
    new URL("../src/sections/section-runtime.js", import.meta.url),
    "utf8",
  );
  assert.match(runtime, /senzaCadere\(installDeumidificatoriEditor\);/);
});
