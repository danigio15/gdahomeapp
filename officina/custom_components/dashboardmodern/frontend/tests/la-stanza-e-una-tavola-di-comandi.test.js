/* La stanza come una tavola di comandi (#160): le decisioni che non chiedono
 * un documento. Quale vista, in che ordine, quali tessere sono larghe, cosa
 * dice il clima della testata, a che punto e' una tapparella. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CHIAVE_VISTA_STANZA,
  VISTA_RIGHE,
  VISTA_TESSERE,
  blocchiDellaTavola,
  climaDellaStanza,
  comeStaLaCopertura,
  tesseraLarga,
  vistaDellaStanza,
} from "../src/core/la-stanza-a-tessere.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

test("le tessere sono la vista di serie, le righe si hanno solo chiedendole", () => {
  assert.equal(vistaDellaStanza(undefined), VISTA_TESSERE);
  assert.equal(vistaDellaStanza(""), VISTA_TESSERE);
  assert.equal(vistaDellaStanza("qualcosa"), VISTA_TESSERE);
  assert.equal(vistaDellaStanza({}), VISTA_TESSERE);
  assert.equal(vistaDellaStanza("righe"), VISTA_RIGHE);
  assert.equal(vistaDellaStanza(" Righe "), VISTA_RIGHE);
});

test("la scelta della vista viaggia con la configurazione della casa", () => {
  assert.ok(CONFIG_KEYS.includes(CHIAVE_VISTA_STANZA));
});

test("la tavola comincia dalle luci, e un blocco sconosciuto va in coda", () => {
  const pagina = {
    blocchi: [
      { key: "clima", voci: [{ entity: "climate.a" }] },
      { key: "luci", voci: [{ entity: "light.a" }] },
      { key: "prese", voci: [] },
      { key: "nuovo", voci: [{ entity: "x.y" }] },
      { key: "coperture", voci: [{ entity: "cover.a" }] },
      { key: "altro", voci: [{ entity: "sensor.a" }] },
      { key: "media", voci: [{ entity: "media_player.a" }] },
    ],
  };
  assert.deepEqual(
    blocchiDellaTavola(pagina).map((blocco) => blocco.key),
    ["luci", "coperture", "clima", "media", "altro", "nuovo"],
  );
  assert.deepEqual(blocchiDellaTavola(null), []);
  assert.deepEqual(blocchiDellaTavola({ blocchi: [{ key: "luci" }] }), []);
});

test("il clima e la musica prendono due posti, il resto uno", () => {
  assert.equal(tesseraLarga("clima"), true);
  assert.equal(tesseraLarga("media"), true);
  assert.equal(tesseraLarga("luci"), false);
  assert.equal(tesseraLarga("coperture"), false);
});

test("la testata dice il clima che lavora, altrimenti il primo che risponde", () => {
  const stati = {
    "climate.spento": { state: "off", attributes: { temperature: 20, current_temperature: 19 } },
    "climate.caldo": { state: "heat", attributes: { temperature: "21.5", current_temperature: 20 } },
    "climate.muto": { state: "unavailable", attributes: { temperature: 30 } },
  };
  assert.deepEqual(climaDellaStanza(["climate.spento", "climate.caldo"], stati), {
    entity: "climate.caldo",
    modo: "heat",
    acceso: true,
    obiettivo: 21.5,
    ambiente: 20,
  });
  assert.equal(climaDellaStanza(["climate.muto", "climate.spento"], stati).entity, "climate.spento");
  assert.equal(climaDellaStanza(["climate.muto", "climate.spento"], stati).acceso, false);
  /* Una macchina che non risponde non dice un numero vecchio in grande. */
  assert.equal(climaDellaStanza(["climate.muto"], stati), null);
  assert.equal(climaDellaStanza([], stati), null);
});

test("la tapparella dice a che punto e', e la girata si legge al contrario", () => {
  const a = (state, current_position) => ({
    state,
    attributes: current_position === undefined ? {} : { current_position },
  });
  assert.deepEqual(comeStaLaCopertura(a("open", 100)), { posizione: 100, stato: "aperta" });
  assert.deepEqual(comeStaLaCopertura(a("open", 40)), { posizione: 40, stato: "socchiusa" });
  assert.deepEqual(comeStaLaCopertura(a("closed", 0)), { posizione: 0, stato: "chiusa" });
  assert.deepEqual(comeStaLaCopertura(a("open")), { posizione: 100, stato: "aperta" });
  assert.deepEqual(comeStaLaCopertura(a("closing", 70)), { posizione: 70, stato: "scende" });
  assert.deepEqual(comeStaLaCopertura(a("unavailable")), { posizione: null, stato: "muta" });
  assert.deepEqual(comeStaLaCopertura(null), { posizione: null, stato: "muta" });
  /* Montata al contrario: dichiara 100 quando e' giu', e «opening» vuol dire
   * che scende. */
  assert.deepEqual(comeStaLaCopertura(a("open", 100), { invertita: true }), {
    posizione: 0,
    stato: "chiusa",
  });
  assert.deepEqual(comeStaLaCopertura(a("opening", 30), { invertita: true }), {
    posizione: 70,
    stato: "scende",
  });
  assert.deepEqual(comeStaLaCopertura(a("closed"), { invertita: true }), {
    posizione: 100,
    stato: "aperta",
  });
});
