/* I varchi si dichiarano, non si autocompilano (#74).
 *
 * «Sezione varchi attuale è differente dalle altre sezioni in quanto si
 *  autocompila, cosa che avevo detto già di eliminare, e sotto compaiono
 *  ancora quelle che ho eliminato da sopra.»
 *
 * Qui si prova la riga che fa la differenza: `righe` assente vuol dire «questa
 * casa non ha ancora dichiarato niente» e si continua col rilevamento di
 * prima; `righe` presente — anche vuoto — vuol dire «ha dichiarato», e allora
 * comanda quello. È quella distinzione che fa sì che cancellando l'ultimo
 * varco non tornino tutti.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  conLaRiga,
  disegnoDelVarco,
  righeDichiarate,
  senzaLaRiga,
  varchiConfigurati,
  varchiDaImportare,
  varchiDiCasa,
} from "../src/core/varchi-di-casa.js";
import { chiaveDelDisegno } from "../src/core/catalogo-disegni.js";

const contatto = (state, classe = "door") => ({
  state,
  attributes: { device_class: classe },
  last_changed: "2026-09-22T08:00:00Z",
});

const CASA = {
  "binary_sensor.ingresso": contatto("off", "door"),
  "binary_sensor.cucina": contatto("on", "window"),
  "cover.garage": contatto("closed", "garage_door"),
  "sensor.temperatura": { state: "21" },
};

test("chi non ha mai dichiarato niente continua col rilevamento di prima", () => {
  /* Il punto non è la comodità: è che un aggiornamento non deve far sparire
   * la pagina Varchi a chi la configurazione non l'ha mai aperta. */
  assert.equal(righeDichiarate({}), null);
  assert.equal(righeDichiarate(null), null);
  const righe = varchiDiCasa(CASA, {}, new Set());
  assert.deepEqual(
    righe.map((r) => r.entity).sort(),
    ["binary_sensor.cucina", "binary_sensor.ingresso"],
    "il rilevamento di Home Assistant vale ancora, finché non si dichiara",
  );
  assert.equal(varchiConfigurati(CASA, {}), true);
});

test("dichiarata, una tapparella motorizzata è un varco — rilevata non lo era", () => {
  /* Il rilevamento guarda solo i `binary_sensor.*`: un basculante che in Home
   * Assistant è un `cover.*` non lo trovava, e non c'era modo di metterlo —
   * la casella «aggiungi» lo accettava, ma la pagina lo scartava lo stesso.
   * Dichiarandolo entra, e `comeStaIlVarco` sa già leggere open/closed. */
  assert.deepEqual(varchiDiCasa(CASA, {}, new Set()).map((r) => r.entity).includes("cover.garage"), false);
  const config = { righe: [{ entity: "cover.garage", name: "Basculante", icon: "garage-door" }] };
  const righe = varchiDiCasa(CASA, config, new Set());
  assert.deepEqual(righe.map((r) => [r.entity, r.stato]), [["cover.garage", "chiuso"]]);
});

test("dichiarato l'elenco, comanda l'elenco", () => {
  const config = { righe: [{ entity: "binary_sensor.cucina", name: "Finestra cucina", icon: "window" }] };
  const righe = varchiDiCasa(CASA, config, new Set());
  assert.deepEqual(righe.map((r) => r.entity), ["binary_sensor.cucina"]);
  assert.equal(righe[0].name, "Finestra cucina");
  assert.equal(righe[0].glifo, "window");
  assert.equal(righe[0].stato, "aperto");
});

test("l'elenco vuoto è una risposta, non un'assenza", () => {
  /* È questa la riga che chiude la segnalazione: eliminato l'ultimo varco, la
   * pagina resta vuota. Con `null` al posto di `[]` tornerebbero tutti. */
  assert.deepEqual(righeDichiarate({ righe: [] }), []);
  assert.deepEqual(varchiDiCasa(CASA, { righe: [] }, new Set()), []);
  assert.equal(varchiConfigurati(CASA, { righe: [] }), false);
});

test("una riga si scrive, si cambia e si elimina — e eliminata resta eliminata", () => {
  let config = {};
  config = conLaRiga(config, -1, { entity: "binary_sensor.ingresso", name: "Ingresso", icon: "door" });
  config = conLaRiga(config, -1, { entity: "cover.garage", name: "Garage", icon: "garage-door" });
  assert.deepEqual(righeDichiarate(config).map((r) => r.name), ["Ingresso", "Garage"]);

  config = conLaRiga(config, 1, { entity: "cover.garage", name: "Basculante", icon: "garage-door" });
  assert.deepEqual(righeDichiarate(config).map((r) => r.name), ["Ingresso", "Basculante"]);

  config = senzaLaRiga(config, 0);
  assert.deepEqual(righeDichiarate(config).map((r) => r.entity), ["cover.garage"]);
  /* E il rilevamento non se la riprende: l'ingresso è ancora un `door` in
   * casa, ma qui dentro non c'è più. */
  assert.deepEqual(
    varchiDiCasa(CASA, config, new Set()).map((r) => r.entity),
    ["cover.garage"],
  );
});

test("una riga senza entità sta nella scheda ma non sulla pagina", () => {
  /* «Aggiungi varco», il nome scritto, l'entità ancora no: la scheda la tiene
   * — e lo dice — ma sulla pagina non c'è niente da mostrare, e nel conto
   * degli aperti sarebbe un muto inventato. */
  const config = conLaRiga({}, -1, { entity: "", name: "Lucernario bagno", icon: "skylight" });
  assert.equal(righeDichiarate(config).length, 1);
  assert.deepEqual(varchiDiCasa(CASA, config, new Set()), []);
  assert.equal(varchiConfigurati(CASA, config), false);
});

test("una riga del tutto vuota non si scrive", () => {
  assert.deepEqual(righeDichiarate({ righe: [{ entity: "", name: "" }, null, 7, {}] }), []);
});

test("la stessa entità due volte conta una volta sola", () => {
  /* Contata due volte, in cima alla pagina il numero degli aperti sarebbe
   * sbagliato — ed è l'unico numero per cui quella pagina esiste. */
  const config = {
    righe: [
      { entity: "binary_sensor.cucina", name: "Cucina" },
      { entity: "binary_sensor.cucina", name: "Cucina di nuovo" },
    ],
  };
  assert.deepEqual(righeDichiarate(config).map((r) => r.name), ["Cucina"]);
});

test("l'importazione porta dentro quello che la scheda mostrava, nomi compresi", () => {
  /* Il tasto «prendi quelli che Home Assistant ha trovato», e il ripiego di
   * chi non ha mai dichiarato: è la stessa risposta. Chi aveva già scritto i
   * nomi e già escluso quello che varco non è non deve rifare quel lavoro. */
  const prima = {
    nomi: { "binary_sensor.cucina": "Finestra cucina" },
    escluse: ["cover.garage"],
    aggiunte: ["binary_sensor.cantina"],
  };
  const righe = varchiDaImportare(
    { ...CASA, "binary_sensor.cantina": { state: "off" } },
    prima,
    (entity) => entity.split(".")[1],
  );
  assert.deepEqual(righe.map((r) => r.entity).sort(), [
    "binary_sensor.cantina",
    "binary_sensor.cucina",
    "binary_sensor.ingresso",
  ]);
  assert.equal(righe.find((r) => r.entity === "binary_sensor.cucina").name, "Finestra cucina");
  assert.equal(righe.find((r) => r.entity === "binary_sensor.ingresso").icon, "door");
});

test("i disegni di serie sono del catalogo di casa, non emoji di sistema", () => {
  /* «Icone sempre quelle del catalogo nostro, se non presenti queste creale.»
   * Un'emoji cambia faccia da un telefono all'altro: la stessa plancia non era
   * uguale nemmeno a se stessa. */
  for (const [classe, disegno] of [
    ["door", "door"],
    ["window", "window"],
    ["garage_door", "garage-door"],
    ["opening", "doorway"],
    ["quello_che_e", "door"],
  ]) {
    assert.equal(disegnoDelVarco(classe), disegno);
    assert.equal(chiaveDelDisegno(disegno), disegno, `${disegno} non è nel catalogo`);
  }
});

test("i tredici disegni della scheda ci sono tutti", () => {
  /* La striscia che la scheda mette davanti a chi configura. Uno che manca
   * uscirebbe come un buco, e nessuno se ne accorgerebbe scrivendo il codice. */
  for (const chiave of [
    "door", "front-door", "window", "french-window", "sliding-door", "gate",
    "garage-door", "barrier", "shutters", "skylight", "hatch", "doorway", "lift",
  ]) {
    assert.equal(chiaveDelDisegno(chiave), chiave, `manca il disegno ${chiave}`);
  }
});

/* ── La forma della scheda ──────────────────────────────────────────────── */

const scheda = readFileSync(
  new URL("../src/sections/varchi-editor-section.js", import.meta.url),
  "utf8",
);
/* Il codice, senza i commenti: l'intestazione racconta com'era prima, e
 * raccontarlo non è rifarlo. Una prova che non sa distinguere le due cose
 * obbliga a smettere di spiegare, che è il prezzo più caro che si possa
 * pagare per una prova. */
const codice = scheda.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("la scheda ha la forma delle altre, non più quella del rilevamento", () => {
  /* «Le sezioni si devono comportare tutte alla stessa maniera.» Qui si conta
   * che ci siano le parti che fanno quella forma, e che non ci sia più quello
   * che la rompeva. */
  for (const pezzo of [
    "data-dm-varco-aggiungi", // il ＋ che mancava: la riga la metti tu
    "data-dm-varco-elimina", // il cestino che elimina davvero
    "data-dm-varco-apri", // la matita che apre la riga
    "data-dm-varco-salva", // il 💾, come in Porte e cancelli
    "dm-varco-ed-icone", // la striscia dei disegni, che non c'era
    "ed-btn-import", // «prendi quelli che Home Assistant ha trovato»
  ]) {
    assert.ok(scheda.includes(pezzo), `alla scheda manca ${pezzo}`);
  }
  for (const via of [
    "Tolti dai conti", // l'elenco degli esclusi, che è la segnalazione
    "data-dm-varco-escludi",
    "data-dm-varco-riprendi",
    "dm-varco-ed-fuori",
  ]) {
    assert.ok(!codice.includes(via), `«${via}» doveva sparire dalla scheda`);
  }
});

test("il campo dell'entità è quello che diventa pastiglia, non una lente e basta", () => {
  /* «Vedo ancora la lente: guarda le sezioni e vedi che la lente per la
   * ricerca entità non c'è.» La lente si scrive lo stesso — è la guardia che
   * la riconosce e la trasforma — ma deve stare accanto a un input `mono` con
   * un `placeholder` che sa di entità, che è quello che fa scattare la
   * trasformazione. Senza, resta una lente per sempre. */
  const campo = scheda.slice(scheda.indexOf("Entità del contatto"), scheda.indexOf("Nome", scheda.indexOf("Entità del contatto")));
  assert.match(campo, /class="ed-input mono"/, "senza «mono» la guardia non lo riconosce");
  assert.match(campo, /placeholder="binary_sensor\./, "il placeholder dice che è un'entità");
  assert.match(campo, /class="dm-entity-picker"/, "la lente è quella che diventa pastiglia");
});

test("i disegni della striscia sono tutti disegni veri", () => {
  const dichiarati = [...scheda.matchAll(/^ {2}"([a-z-]+)",$/gm)].map((m) => m[1]);
  assert.ok(dichiarati.length >= 13, `la striscia dichiara solo ${dichiarati.length} disegni`);
  for (const chiave of dichiarati)
    assert.equal(chiaveDelDisegno(chiave), chiave, `${chiave} non è nel catalogo`);
});
