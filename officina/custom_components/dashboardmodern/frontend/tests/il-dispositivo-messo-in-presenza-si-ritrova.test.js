/* «Ho aggiunto in presenze e salvato. Ma non l'ho ritrovato nella sezione.»
 *
 * Dal campo, con un sensore di presenza appena abbinato via Zigbee: stanza
 * scelta, «Mettilo in Presenza» premuto, e poi la scheda Presenza che dice
 * «Nessun rilevatore configurato».
 *
 * Il salvataggio era riuscito, nel posto sbagliato. La #74-C e la #74-D hanno
 * cambiato forma a Varchi e Presenza: da «foglietto di correzioni» — questa è
 * una presenza anche se Home Assistant non lo dice, questa no — a ELENCO
 * DICHIARATO di righe. Il foglietto «dove lo metto?» non è stato aggiornato e
 * ha continuato a scrivere `{aggiunte, escluse, nomi}`, mentre la scheda
 * guarda `righe` — e senza quelle risponde «non ancora dichiarato».
 *
 * Un salvataggio che riesce e non si vede è peggio di uno che fallisce: non lo
 * si rifà, e quello che si è scritto resta lì a non servire a niente.
 *
 * ─── La prima volta porta dentro anche gli altri ─────────────────────────
 *
 * C'è una trappola dentro la correzione, e questa prova la tiene chiusa:
 * dichiarare la sezione con dentro la SOLA riga nuova farebbe sparire dalla
 * pagina i settantuno rilevatori che oggi si vedono da sé. Una riga aggiunta
 * che ne toglie settanta. Quindi la prima volta si dichiara con quello che il
 * rilevamento proporrebbe più questo — che è esattamente quello che fa il
 * bottone «Prendi gli N» della scheda.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { laVoceDaScrivere } from "../src/core/dove-lo-metto.js";
import { righeDichiarate } from "../src/core/elenco-dichiarato.js";

const IL_SENSORE = {
  entity: "binary_sensor.0x0cae5ffffec141a9_occupancy",
  nome: "Presenza salone",
  stanza_id: "salone",
};

/* Quello che il rilevamento proporrebbe: due rilevatori che Home Assistant
 * dichiara da sé, e che oggi si vedono senza che nessuno li abbia scritti. */
const GIA_TROVATI = [
  { entity: "binary_sensor.movimento_corridoio", name: "Corridoio", icon: "motion" },
  { entity: "binary_sensor.movimento_cucina", name: "Cucina", icon: "motion" },
];

test("mettere un rilevatore in Presenza scrive una riga, non il foglietto vecchio", () => {
  const scritto = laVoceDaScrivere("presenza", IL_SENSORE, {}, GIA_TROVATI);
  const righe = righeDichiarate(scritto.cd_presenza);
  assert.ok(righe, "la scheda legge «righe»: senza, dice «nessun rilevatore configurato»");
  const sua = righe.find((una) => una.entity === IL_SENSORE.entity);
  assert.ok(sua, "il rilevatore appena messo deve esserci");
  assert.equal(sua.name, "Presenza salone");
});

test("la prima volta porta dentro anche quelli che si vedevano da sé", () => {
  const scritto = laVoceDaScrivere("presenza", IL_SENSORE, {}, GIA_TROVATI);
  const dentro = righeDichiarate(scritto.cd_presenza).map((una) => una.entity);
  for (const gia of GIA_TROVATI)
    assert.ok(
      dentro.includes(gia.entity),
      `${gia.entity} si vedeva da sé: dichiarando senza di lui sparirebbe`,
    );
  assert.equal(dentro.length, 3);
});

test("su una sezione già dichiarata si aggiunge in fondo, e non si butta niente", () => {
  const prima = { righe: [{ entity: "binary_sensor.movimento_bagno", name: "Bagno", icon: "" }] };
  const scritto = laVoceDaScrivere("presenza", IL_SENSORE, { cd_presenza: prima }, GIA_TROVATI);
  const dentro = righeDichiarate(scritto.cd_presenza).map((una) => una.entity);
  assert.deepEqual(dentro, ["binary_sensor.movimento_bagno", IL_SENSORE.entity]);
  /* E quelli del rilevamento NON entrano: la sezione è già dichiarata, e chi
   * la tiene ha già deciso cosa ci sta dentro. */
  assert.ok(!dentro.includes("binary_sensor.movimento_corridoio"));
});

test("lo stesso rilevatore due volte resta una riga sola, col nome nuovo", () => {
  const prima = { righe: [{ entity: IL_SENSORE.entity, name: "Vecchio nome", icon: "motion" }] };
  const scritto = laVoceDaScrivere("presenza", IL_SENSORE, { cd_presenza: prima }, []);
  const righe = righeDichiarate(scritto.cd_presenza);
  assert.equal(righe.length, 1);
  assert.equal(righe[0].name, "Presenza salone");
  /* Il disegno che c'era non si perde: chi non ne porta uno nuovo non ne
   * cancella uno scelto. */
  assert.equal(righe[0].icon, "motion");
});

test("i Varchi sono la stessa forma, e hanno lo stesso guasto e la stessa cura", () => {
  const varco = { entity: "binary_sensor.porta_ingresso", nome: "Porta d'ingresso" };
  const scritto = laVoceDaScrivere("varchi", varco, {}, []);
  const righe = righeDichiarate(scritto.cd_varchi);
  assert.ok(righe);
  assert.equal(righe[0].entity, "binary_sensor.porta_ingresso");
});

test("il foglietto vecchio non si scrive più, in nessuna delle due", () => {
  for (const [quale, cassetto] of [
    ["presenza", "cd_presenza"],
    ["varchi", "cd_varchi"],
  ]) {
    const scritto = laVoceDaScrivere(quale, IL_SENSORE, {}, []);
    assert.ok(
      !Array.isArray(scritto[cassetto].aggiunte),
      `${quale}: «aggiunte» è il foglietto di prima, e la scheda non lo legge`,
    );
  }
});
