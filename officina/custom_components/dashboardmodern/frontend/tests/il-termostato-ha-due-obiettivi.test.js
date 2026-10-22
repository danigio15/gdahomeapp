/* Il termostato col caldo e il freddo: due obiettivi, non uno.
 *
 * «Il termostato di Home Assistant mi vede le due mezze lune, da una parte
 * caldo e dall'altra freddo. Se lo inserisco nel clima tuo, invece, mi legge
 * solo la temperatura attuale, ma non mi gestisce il target.» Home Assistant
 * lo mostrava con 22 e 40 — `target_temp_low` e `target_temp_high` — e la card
 * del Clima scriveva «--°», con un meno e un piu' che non facevano niente.
 *
 * Queste prove tengono ferme le regole del nucleo — quale tipo e', cosa si
 * mostra in che modalita', di quanto si muove e fin dove — e i tre posti che
 * le usano: la card della pagina Clima, la sua finestra e la tessera della
 * Home. E tengono fermo il testimone: chi ha un obiettivo solo non cambia.
 *
 * Poi la linguetta: i termostati a coppia stanno in «Termostato» e non in
 * Caldo o in Freddo, e la loro card ha un meno e un piu' per ciascuno dei due
 * numeri, che mandano sempre la coppia intera.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CLIMA_CON_DUE_OBIETTIVI,
  coppiaCon,
  coppiaDelTermostato,
  coppiaSpostata,
  eUnTermostatoACoppia,
  estremoDiPartenza,
  obiettiviDelClima,
  obiettiviScritti,
  obiettivoDaMuovere,
  obiettivoMostrato,
} from "../src/core/i-due-obiettivi-del-clima.js";

/* Il termostato delle foto, con un nome di fantasia: spento, 22 e 40, la
 * scala che dichiara da 4 a 40, e nessun `temperature`. */
const TERMOSTATO = Object.freeze({
  hvac_modes: ["off", "heat", "cool", "heat_cool"],
  supported_features: 1 | CLIMA_CON_DUE_OBIETTIVI | 128 | 256,
  current_temperature: 19.5,
  temperature: null,
  target_temp_low: 22,
  target_temp_high: 40,
  min_temp: 4,
  max_temp: 40,
  target_temp_step: 0.5,
});

test("chi e' un termostato a coppia: i due numeri, il bit, o heat_cool senza singolo", () => {
  assert.equal(eUnTermostatoACoppia(TERMOSTATO), true);
  // Basta uno dei due numeri: la coppia c'e', anche se un estremo e' vuoto.
  assert.equal(eUnTermostatoACoppia({ target_temp_high: 26 }), true);
  // Il bit TARGET_TEMPERATURE_RANGE da solo, coi numeri ancora vuoti.
  assert.equal(eUnTermostatoACoppia({ supported_features: CLIMA_CON_DUE_OBIETTIVI }), true);
  assert.equal(eUnTermostatoACoppia({ supported_features: 1 | 128 }), false);
  // `heat_cool` senza un obiettivo solo: e' l'intervallo di Home Assistant.
  assert.equal(eUnTermostatoACoppia({ hvac_modes: ["off", "heat_cool"] }), true);
  /* «Mi compare il termostato ma non lo tengo configurato»: il condizionatore
   * spento ha `temperature` vuoto, non assente. Resta in Freddo e in Caldo. */
  assert.equal(
    eUnTermostatoACoppia({
      hvac_modes: ["off", "cool", "heat", "dry", "fan_only", "heat_cool"],
      temperature: null,
      current_temperature: null,
      supported_features: 1 | 8 | 32 | 128 | 256,
    }),
    false,
  );
  /* Il condizionatore che chiama `heat_cool` il suo automatico ma ha un
   * numero solo resta in Freddo e in Caldo, com'era. */
  assert.equal(
    eUnTermostatoACoppia({ hvac_modes: ["off", "cool", "heat", "heat_cool"], temperature: 24 }),
    false,
  );
  assert.equal(eUnTermostatoACoppia({ hvac_modes: ["off", "heat"], temperature: 21 }), false);
  assert.equal(eUnTermostatoACoppia(null), false);
  assert.equal(eUnTermostatoACoppia({ target_temp_low: null, target_temp_high: "" }), false);
});

test("la coppia del termostato e' sempre intera, qualunque sia la modalita'", () => {
  assert.deepEqual({ ...coppiaDelTermostato(TERMOSTATO) }, {
    doppio: true,
    singolo: null,
    basso: 22,
    alto: 40,
    mostra: "entrambi",
  });
  // Anche con il singolo accanto: la card del termostato mostra i due numeri.
  assert.equal(
    coppiaDelTermostato({ temperature: 21, target_temp_low: 19, target_temp_high: 26 }).alto,
    26,
  );
  // Senza uno dei due non c'e' coppia da mandare.
  assert.equal(coppiaDelTermostato({ target_temp_low: 20 }), null);
  assert.deepEqual(
    coppiaSpostata(coppiaDelTermostato(TERMOSTATO), "alto", -1, { passo: 0.5, scala: [4, 40] }),
    { target_temp_low: 22, target_temp_high: 39.5 },
  );
});

test("la coppia senza singolo e' doppia, e in automatico e da spento si mostrano tutti e due", () => {
  for (const modo of ["heat_cool", "auto", "off", ""]) {
    const lettura = obiettiviDelClima(TERMOSTATO, modo);
    assert.equal(lettura.doppio, true, modo);
    assert.equal(lettura.mostra, "entrambi", modo);
    assert.equal(lettura.basso, 22);
    assert.equal(lettura.alto, 40);
    assert.equal(lettura.singolo, null);
    assert.equal(obiettivoMostrato(lettura), null, "in automatico non c'e' un numero solo onesto");
  }
});

test("in caldo si mostra il basso, in freddo l'alto", () => {
  const caldo = obiettiviDelClima(TERMOSTATO, "heat");
  assert.equal(caldo.mostra, "basso");
  assert.equal(obiettivoMostrato(caldo), 22);
  const freddo = obiettiviDelClima(TERMOSTATO, "cool");
  assert.equal(freddo.mostra, "alto");
  assert.equal(obiettivoMostrato(freddo), 40);
});

test("il testimone: chi ha un obiettivo solo resta a obiettivo solo", () => {
  const singolo = obiettiviDelClima({ temperature: 21.5 }, "heat");
  assert.equal(singolo.doppio, false);
  assert.equal(singolo.mostra, "singolo");
  assert.equal(obiettivoMostrato(singolo), 21.5);
  assert.equal(obiettivoDaMuovere(singolo, "basso"), "singolo");
  /* Uno spento senza nessun numero non ha niente da mostrare ne' da muovere. */
  const muto = obiettiviDelClima({ temperature: null }, "off");
  assert.equal(muto.mostra, "nessuno");
  assert.equal(obiettivoDaMuovere(muto), null);
  /* La coppia a meta' (un estremo solo) non e' una coppia: Home Assistant la
   * rifiuterebbe comunque. */
  assert.equal(obiettiviDelClima({ target_temp_low: 20 }, "heat_cool").mostra, "nessuno");
});

test("con singolo e coppia insieme si preferisce quello che conta nella modalita'", () => {
  const tutti = { temperature: 21, target_temp_low: 19, target_temp_high: 26 };
  assert.equal(obiettiviDelClima(tutti, "heat").doppio, false);
  assert.equal(obiettivoMostrato(obiettiviDelClima(tutti, "heat")), 21);
  assert.equal(obiettiviDelClima(tutti, "cool").doppio, false);
  assert.equal(obiettiviDelClima(tutti, "heat_cool").doppio, true);
  assert.equal(obiettiviDelClima(tutti, "auto").mostra, "entrambi");
});

test("quale estremo muovono il meno e il piu'", () => {
  const auto = obiettiviDelClima(TERMOSTATO, "heat_cool");
  assert.equal(obiettivoDaMuovere(auto, "basso"), "basso");
  assert.equal(obiettivoDaMuovere(auto, "alto"), "alto");
  // Senza scelta, quello di partenza.
  assert.equal(obiettivoDaMuovere(auto, "", "basso"), "basso");
  assert.equal(obiettivoDaMuovere(auto, ""), "alto");
  // In caldo e in freddo la scelta non conta: c'e' un numero solo in vista.
  assert.equal(obiettivoDaMuovere(obiettiviDelClima(TERMOSTATO, "heat"), "alto"), "basso");
  assert.equal(obiettivoDaMuovere(obiettiviDelClima(TERMOSTATO, "cool"), "basso"), "alto");
  // La partenza: prima quello che sta facendo, poi la zona.
  assert.equal(estremoDiPartenza({ azione: "heating", zona: "freddo" }), "basso");
  assert.equal(estremoDiPartenza({ azione: "cooling", zona: "caldo" }), "alto");
  assert.equal(estremoDiPartenza({ azione: "idle", zona: "caldo" }), "basso");
  assert.equal(estremoDiPartenza({ zona: "freddo" }), "alto");
  assert.equal(estremoDiPartenza(), "alto");
});

test("un passo manda sempre la coppia intera, col passo dell'unita'", () => {
  const auto = obiettiviDelClima(TERMOSTATO, "off");
  const scala = [TERMOSTATO.min_temp, TERMOSTATO.max_temp];
  assert.deepEqual(coppiaSpostata(auto, "basso", 1, { passo: 0.5, scala }), {
    target_temp_low: 22.5,
    target_temp_high: 40,
  });
  assert.deepEqual(coppiaSpostata(auto, "basso", -1, { passo: 0.5, scala }), {
    target_temp_low: 21.5,
    target_temp_high: 40,
  });
  assert.deepEqual(coppiaSpostata(auto, "alto", -1, { passo: 1, scala }), {
    target_temp_low: 22,
    target_temp_high: 39,
  });
});

test("a fine corsa non parte niente, e il caldo non scavalca il freddo", () => {
  const scala = [4, 40];
  const auto = obiettiviDelClima(TERMOSTATO, "heat_cool");
  // L'alto e' gia' al massimo dichiarato: il piu' non manda niente.
  assert.equal(coppiaSpostata(auto, "alto", 1, { passo: 0.5, scala }), null);
  // Il basso si ferma contro l'alto, non lo spinge.
  const stretti = obiettiviDelClima({ target_temp_low: 23, target_temp_high: 23.5 }, "heat_cool");
  assert.deepEqual(coppiaSpostata(stretti, "basso", 1, { passo: 0.5 }), {
    target_temp_low: 23.5,
    target_temp_high: 23.5,
  });
  const attaccati = obiettiviDelClima({ target_temp_low: 23, target_temp_high: 23 }, "heat_cool");
  assert.equal(coppiaSpostata(attaccati, "basso", 1, { passo: 0.5 }), null);
  assert.equal(coppiaSpostata(attaccati, "alto", -1, { passo: 0.5 }), null);
  // Al minimo dichiarato il meno del basso non manda niente.
  const giu = obiettiviDelClima({ target_temp_low: 4, target_temp_high: 30 }, "heat_cool");
  assert.equal(coppiaSpostata(giu, "basso", -1, { passo: 1, scala }), null);
  // Il trascinamento porta un estremo a un grado: stesse regole.
  assert.deepEqual(coppiaCon(auto, "basso", 45, { scala }), {
    target_temp_low: 40,
    target_temp_high: 40,
  });
  assert.equal(coppiaCon(auto, "basso", 22), null);
  // Chi ha un obiettivo solo non riceve mai una coppia.
  assert.equal(coppiaSpostata(obiettiviDelClima({ temperature: 21 }, "heat"), "basso", 1), null);
});

test("un estremo fuori griglia va al primo grado buono, senza scavalcarlo", () => {
  const storto = obiettiviDelClima({ target_temp_low: 21.3, target_temp_high: 26 }, "heat_cool");
  assert.equal(coppiaSpostata(storto, "basso", 1, { passo: 0.5 }).target_temp_low, 21.5);
  assert.equal(coppiaSpostata(storto, "basso", -1, { passo: 0.5 }).target_temp_low, 21);
  // La griglia parte dal minimo dichiarato: 4,25 a passi da mezzo grado.
  const dispari = obiettiviDelClima({ target_temp_low: 20.25, target_temp_high: 26 }, "heat_cool");
  assert.equal(
    coppiaSpostata(dispari, "basso", 1, { passo: 0.5, scala: [4.25, 40] }).target_temp_low,
    20.75,
  );
});

test("la coppia si scrive in una riga", () => {
  assert.equal(obiettiviScritti(obiettiviDelClima(TERMOSTATO, "heat_cool")), "22° – 40°");
  assert.equal(obiettiviScritti(obiettiviDelClima(TERMOSTATO, "heat")), "22°");
  assert.equal(obiettiviScritti(obiettiviDelClima(TERMOSTATO, "cool")), "40°");
  assert.equal(obiettiviScritti(obiettiviDelClima({ temperature: 21 }, "heat")), "21°");
  assert.equal(obiettiviScritti(obiettiviDelClima({}, "off")), "");
  assert.equal(
    obiettiviScritti(obiettiviDelClima(TERMOSTATO, "auto"), (v) => v.toFixed(1)),
    "22.0° – 40.0°",
  );
});

/* ── la card della pagina Clima ─────────────────────────────────────────── */

async function sezione() {
  return import(`../src/sections/climate-thermal-section.js?due=${Date.now()}`);
}

test("la lettura della card porta la coppia, e il target solo quando e' uno", async () => {
  const { climateReading } = await sezione();
  const stati = {
    "climate.living": { state: "heat_cool", attributes: TERMOSTATO },
    "climate.caldo": { state: "heat", attributes: TERMOSTATO },
    "climate.solo": { state: "cool", attributes: { temperature: 24, current_temperature: 26 } },
  };
  const auto = climateReading("climate.living", stati);
  assert.equal(auto.target, null);
  assert.equal(auto.obiettivi.mostra, "entrambi");
  assert.equal(auto.ambient, 19.5);
  assert.equal(climateReading("climate.caldo", stati).target, 22);
  const solo = climateReading("climate.solo", stati);
  assert.equal(solo.target, 24);
  assert.equal(solo.obiettivi.doppio, false);
});

test("il meno e il piu' della card mandano la coppia, e lasciano il singolo al guscio", async () => {
  const { muoviIlClimaDoppio } = await sezione();
  const prima = {
    STATES: globalThis.STATES,
    dmCallHaService: globalThis.dmCallHaService,
    getClimaUnits: globalThis.getClimaUnits,
  };
  const chiamate = [];
  try {
    globalThis.STATES = {
      "climate.living": { state: "off", attributes: TERMOSTATO },
      "climate.solo": { state: "cool", attributes: { temperature: 24 } },
    };
    globalThis.getClimaUnits = () => [
      { entity: "climate.living", name: "Termostato", type: "termo" },
      { entity: "climate.solo", name: "Condizionatore", type: "clima" },
    ];
    globalThis.dmCallHaService = (dominio, servizio, dati) => {
      chiamate.push({ dominio, servizio, dati });
      return Promise.resolve();
    };
    // Dal Caldo, spento e senza scelta: si muove il caldo, di mezzo grado.
    assert.equal(muoviIlClimaDoppio("climate.living", 1, "caldo"), true);
    assert.deepEqual(chiamate.at(-1), {
      dominio: "climate",
      servizio: "set_temperature",
      dati: { entity_id: "climate.living", target_temp_low: 22.5, target_temp_high: 40 },
    });
    // Dal Freddo il freddo — che e' a fine corsa: il tasto e' preso, ma non
    // parte niente (e soprattutto non parte il passo storico con `temperature`).
    const quante = chiamate.length;
    assert.equal(muoviIlClimaDoppio("climate.living", 1, "freddo"), true);
    assert.equal(chiamate.length, quante);
    assert.equal(muoviIlClimaDoppio("climate.living", -1, "freddo"), true);
    assert.deepEqual(chiamate.at(-1).dati, {
      entity_id: "climate.living",
      target_temp_low: 22,
      target_temp_high: 39.5,
    });
    // Chi ha un obiettivo solo non passa da qui.
    assert.equal(muoviIlClimaDoppio("climate.solo", 1, "freddo"), false);
    assert.ok(chiamate.every((voce) => !("temperature" in voce.dati)));
  } finally {
    for (const [nome, valore] of Object.entries(prima)) {
      if (valore === undefined) delete globalThis[nome];
      else globalThis[nome] = valore;
    }
  }
});

/* ── la linguetta «Termostato» ───────────────────────────────────────── */

/* Un giro con gli stati e le unita' finte della plancia, rimessi a posto alla
 * fine qualunque cosa succeda. */
async function conLaCasa(stati, unita, prova) {
  const prima = {
    STATES: globalThis.STATES,
    dmCallHaService: globalThis.dmCallHaService,
    getClimaUnits: globalThis.getClimaUnits,
  };
  const chiamate = [];
  try {
    globalThis.STATES = stati;
    globalThis.getClimaUnits = () => unita;
    globalThis.dmCallHaService = (dominio, servizio, dati) => {
      chiamate.push({ dominio, servizio, dati });
      return Promise.resolve();
    };
    await prova(chiamate);
  } finally {
    for (const [nome, valore] of Object.entries(prima)) {
      if (valore === undefined) delete globalThis[nome];
      else globalThis[nome] = valore;
    }
  }
}

test("il termostato a coppia va nella linguetta Termostato e in nessun'altra", async () => {
  const { climateUnits, climateZones, ZONE_DEL_CLIMA } = await sezione();
  assert.deepEqual([...ZONE_DEL_CLIMA], ["freddo", "caldo", "termostato"]);
  // Senza attributi la risposta e' quella di sempre (il Clima rapido la usa).
  assert.deepEqual(climateZones({ type: "termo" }), ["caldo"]);
  assert.deepEqual(climateZones({ type: "pompa" }, TERMOSTATO), ["termostato"]);
  assert.deepEqual(climateZones({ type: "pompa" }, { temperature: 22 }), ["freddo", "caldo"]);
  await conLaCasa(
    {
      "climate.living": { state: "off", attributes: TERMOSTATO },
      "climate.bagno": { state: "heat", attributes: { temperature: 23, hvac_modes: ["off", "heat"] } },
      "climate.salone": {
        state: "cool",
        attributes: { temperature: 24, hvac_modes: ["off", "cool", "heat", "heat_cool"] },
      },
    },
    [
      // Scritto «pompa»: senza la linguetta avrebbe avuto due card.
      { entity: "climate.living", name: "Termostato Living", type: "pompa" },
      { entity: "climate.bagno", name: "Radiatore Bagno", type: "termo" },
      { entity: "climate.salone", name: "Salone", type: "clima" },
    ],
    () => {
      const zone = climateUnits().map((unita) => [unita.entity, unita.zone]);
      assert.deepEqual(zone, [
        ["climate.living", "termostato"],
        ["climate.bagno", "caldo"],
        ["climate.salone", "freddo"],
      ]);
    },
  );
});

test("i due meno e i due piu' della card del termostato mandano la coppia, e si sommano", async () => {
  const { muoviLEstremo } = await sezione();
  await conLaCasa(
    { "climate.living": { state: "off", attributes: TERMOSTATO } },
    [{ entity: "climate.living", name: "Termostato Living", type: "termo" }],
    (chiamate) => {
      assert.deepEqual(muoviLEstremo("climate.living", "basso", 1), {
        target_temp_low: 22.5,
        target_temp_high: 40,
      });
      /* Il secondo tocco, prima che Home Assistant risponda, parte dal numero
       * appena mandato e non da quello vecchio. */
      muoviLEstremo("climate.living", "basso", 1);
      muoviLEstremo("climate.living", "alto", -1);
      assert.deepEqual(
        chiamate.map((voce) => voce.dati),
        [
          { entity_id: "climate.living", target_temp_low: 22.5, target_temp_high: 40 },
          { entity_id: "climate.living", target_temp_low: 23, target_temp_high: 40 },
          { entity_id: "climate.living", target_temp_low: 23, target_temp_high: 39.5 },
        ],
      );
      assert.ok(chiamate.every((voce) => voce.servizio === "set_temperature"));
      // Un estremo che non esiste non manda niente.
      assert.equal(muoviLEstremo("climate.living", "singolo", 1), null);
      assert.equal(chiamate.length, 3);
    },
  );
  /* A fine corsa non parte niente: l'alto e' al massimo dichiarato. */
  await conLaCasa(
    { "climate.cima": { state: "off", attributes: TERMOSTATO } },
    [{ entity: "climate.cima", name: "Cima", type: "termo" }],
    (chiamate) => {
      assert.equal(muoviLEstremo("climate.cima", "alto", 1), null);
      assert.equal(chiamate.length, 0);
    },
  );
});

test("la card del termostato ha un meno e un piu' per numero, e la linguetta e' la terza", async () => {
  const sorgente = await readFile(
    new URL("../src/sections/climate-thermal-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /data-dm-cl-passo="\$\{estremo\}" data-dm-cl-verso="\$\{verso\}"/);
  assert.match(sorgente, /\$\{zoneButton\("termostato", labels\)\}/);
  assert.match(sorgente, /root\.setClimaPageMode = setClimaPageModeConTermostato/);
  // La pastiglia da scegliere della versione di prima non c'e' piu'.
  assert.doesNotMatch(sorgente, /data-dm-cl-knob-alto/);
  assert.doesNotMatch(sorgente, /function scegliLObiettivo/);
  // Il passo storico e quello della finestra, coi due obiettivi, restano nostri.
  assert.match(sorgente, /root\.setTemp = setTempThermal/);
  assert.match(sorgente, /if \(muoviIlClimaDoppio\(aperta, /);
});

/* ── la tessera della Home e la sua rotella ─────────────────────────────── */

test("il pannello della tessera ha un passo per estremo e manda la coppia", async () => {
  const sorgente = await readFile(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sorgente, /function obiettiviDoppiMarkup\(row\)/);
  assert.match(sorgente, /data-dm-w-obj="\$\{estremo\}"/);
  assert.match(
    sorgente,
    /callHa\("climate", "set_temperature", \{ entity_id: entity, \.\.\.dati \}\)/,
  );
  // Il singolo resta quello di sempre.
  assert.match(
    sorgente,
    /callHa\("climate", "set_temperature", \{ entity_id: entity, temperature: voluta \}\)/,
  );
});
