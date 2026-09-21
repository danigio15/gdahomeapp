/* La tessera che compare quando qualcosa non risponde (#33).
 *
 * «Ho dei comandi domotici in giardino (tra cui alcuni dedicati alla piscina)
 * che ogni tanto, causa segnale wifi non sufficiente, vanno in offline: avere
 * l'avviso mi allerta di ripristinarli per evitare che la pompa ad esempio
 * resti ferma troppo a lungo.»
 *
 * Quello che si prova qui è soprattutto cosa NON conta come guasto: contare
 * `unknown` vorrebbe dire una tessera rossa a ogni riavvio di Home Assistant,
 * cioè un avviso che si impara a ignorare — e un avviso che si ignora è
 * peggio di nessun avviso.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { chiNonRisponde, nonRisponde } from "../src/core/chi-non-risponde.js";
import { entitaConfigurate } from "../src/core/entita-configurate.js";
import { haOggettoWidget, oggettoWidget } from "../src/core/oggetti-widget.js";

const sezione = await readFile(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

const STATI = {
  "switch.pompa_piscina": {
    state: "unavailable",
    attributes: { friendly_name: "Pompa piscina" },
    last_changed: "2026-09-19T08:00:00Z",
  },
  "switch.luci_vialetto": {
    state: "unavailable",
    attributes: { friendly_name: "Luci vialetto" },
    last_changed: "2026-09-21T10:30:00Z",
  },
  "light.salone": { state: "on", attributes: { friendly_name: "Salone" } },
  "sensor.appena_nato": { state: "unknown", attributes: { friendly_name: "Sonda nuova" } },
  "sensor.spento": { state: "off", attributes: { friendly_name: "Spento" } },
};
const TUTTE = [...Object.keys(STATI), "switch.rinominato"];

test("non rispondere è una parola sola, e non è «spento» né «non so»", () => {
  assert.equal(nonRisponde({ state: "unavailable" }), true);
  assert.equal(nonRisponde({ state: "UNAVAILABLE" }), true);
  /* Un'entità che c'è e risponde, e non ha ancora un valore da dire: è
   * normalissima nei primi secondi dopo un riavvio. */
  assert.equal(nonRisponde({ state: "unknown" }), false);
  /* E spento è una scelta di chi abita, non un guasto. */
  assert.equal(nonRisponde({ state: "off" }), false);
  assert.equal(nonRisponde(null), false);
});

test("escono solo quelle che non rispondono, col nome che hanno in casa", () => {
  const mute = chiNonRisponde(TUTTE, STATI);
  assert.deepEqual(
    mute.map((una) => una.nome),
    /* In ordine alfabetico: l'elenco si guarda, e un ordine che cambia a ogni
     * giro è un elenco che non si riesce a leggere. */
    ["Luci vialetto", "Pompa piscina"],
  );
  /* Un'entità che in questa casa non c'è proprio è una configurazione da
   * correggere, non una cosa andata offline: sono due guai diversi. */
  assert.equal(
    mute.some((una) => una.entity === "switch.rinominato"),
    false,
  );
});

test("un nome che la casa non sa dire resta l'identificativo, non il vuoto", () => {
  const [una] = chiNonRisponde(["switch.0x00158d0004a1b2c3"], {
    "switch.0x00158d0004a1b2c3": { state: "unavailable" },
  });
  assert.equal(una.nome, "switch.0x00158d0004a1b2c3");
  /* E il nome scelto da chi abita vince su quello di Home Assistant. */
  const [scelta] = chiNonRisponde(["switch.pompa_piscina"], STATI, {
    nomeDi: () => "Pompa della piscina",
  });
  assert.equal(scelta.nome, "Pompa della piscina");
});

test("le entità configurate si leggono da un posto solo", () => {
  /* Stavano dentro il cancello degli stati; la stessa risposta serve a due
   * domande, e una copia a mano di un elenco che cresce resta indietro — qui
   * è già successo. */
  const finta = {
    localStorage: { getItem: (k) => (k === "cd_prese" ? '[{"entity":"switch.pompa"}]' : null) },
    ENTITY_OVERRIDES: { "dm.server_cpu": "sensor.carico" },
  };
  assert.deepEqual([...entitaConfigurate(finta, ["cd_prese"])].sort(), [
    "sensor.carico",
    "switch.pompa",
  ]);
});

test("la tessera non c'è finché non c'è niente da dire", () => {
  /* Il punto della segnalazione: non una tessera verde fissa che dice «tutto
   * a posto» — quella diventa invisibile in una settimana — ma una che appare
   * solo quando serve guardarla. */
  assert.match(sezione, /function nonRispondeModel\(states\) \{/);
  assert.match(sezione, /if \(!mute\.length\) return null;/);
  /* E si può spegnere dalla scheda Widget come tutte le altre. */
  assert.match(sezione, /widgetExcludedEntities\("nonrisponde"\)/);
});

test("la tessera si chiama «Dispositivi non connessi»", () => {
  /* «Cambia nome in dispositivi non connessi.» «Non rispondono» dice cosa
   * stanno facendo — cioè niente — e per saperlo bisogna già sapere di chi si
   * parla; «Dispositivi non connessi» dice di CHI si parla e cosa gli manca,
   * che è la domanda di chi legge il titolo prima del numero.
   *
   * La riga «non risponde» accanto a ogni nome resta: lì il soggetto c'è già
   * scritto sopra, e ripetere «non connesso» per ognuno sarebbe la stessa
   * parola tre volte in tre centimetri. */
  assert.match(sezione, /label: t\("Dispositivi non connessi", "Disconnected devices"\)/);
  assert.doesNotMatch(sezione, /t\("Non rispondono", "Not answering"\)/);
});

test("e si disegna da sé, come tutte le altre tessere della Home", () => {
  /* Dal campo, col telefono in mano: «icona non rispondono non allineata».
   *
   * Era l'unica tessera della Home senza un oggetto suo: ricadeva sul motore
   * delle icone, cioè su un'emoji. Un'emoji la disegna il sistema, con le sue
   * proporzioni e la sua linea di base, e accanto a sei oggetti nostri — tutti
   * in una griglia di 32×32 con la stessa luce — si vedeva che era più grande
   * e fuori asse.
   *
   * Questa prova non guarda i pixel: guarda che la tessera passi dalla strada
   * dei disegni invece che da quella del ripiego, che è la differenza da cui
   * lo storto nasceva. */
  assert.equal(haOggettoWidget("nonrisponde"), true);
  /* E il disegno è disegnato davvero, non una stringa vuota che passa il
   * controllo: la sbarra rossa che taglia le onde è la cosa che si legge. */
  const disegno = oggettoWidget("nonrisponde");
  assert.match(disegno, /viewBox="0 0 32 32"/);
  assert.match(disegno, /stroke="#dc2626"/);
});
