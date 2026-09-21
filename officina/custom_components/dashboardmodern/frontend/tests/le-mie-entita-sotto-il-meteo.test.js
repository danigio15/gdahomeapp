/* «La mia idea è quella di avere la possibilità di aggiungere nella sezione
 * sotto al meteo le info di entità personalizzate, magari scegliere se
 * visualizzare in base allo stato. Esempio: quando la modalità vacanze è
 * attiva lo mostra altrimenti no.» (#7)
 *
 * La fascia aveva già quattro letture scelte a mano — temperatura, umidità e
 * le due della pioggia — ma le domande le avevamo scelte noi. Qui la domanda
 * la sceglie chi abita la casa, e con lei il nome, il segno e il colore.
 *
 * La condizione è la metà che conta. Una fascia che porta sempre tutto non è
 * una fascia, è un elenco: la regola di tutta la barra è che si vede quello
 * che ha qualcosa da dire adesso, e un numero c'è sempre. Allora lo dice
 * un'altra entità — «questa mi serve quando siamo via» — che è esattamente
 * come uno ci ragiona.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  QUANTE_MIE,
  SEGNO_MIO,
  STATO_DI_SERIE,
  TINTA_MIA,
  laMiaSiVede,
  normalizzaBarra,
  normalizzaLeMie,
  pastiglieDellaCasa,
} from "../src/core/come-sta-la-casa.js";
import { leMieAdesso, letturaDellaMia } from "../src/sections/come-sta-la-casa-section.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const SERBATOIO = {
  entity: "sensor.acqua_serbatoio",
  nome: "Serbatoio",
  quando: "input_boolean.vacanze",
  stato: "on",
};

/* Quello che la sezione consegna al nucleo: la lettura, e com'è adesso la voce
 * che decide. */
const letto = (valore, extra = {}) => ({
  [SERBATOIO.entity]: { valore, testo: "", unita: "%", nome: "Acqua serbatoio", ...extra },
});

/* ── la configurazione ──────────────────────────────────────────────────── */

test("la barra tiene le pastiglie scelte a mano, al massimo QUANTE_MIE", () => {
  const tante = Array.from({ length: QUANTE_MIE + 3 }, (_, i) => ({ entity: `sensor.n${i}` }));
  assert.equal(normalizzaLeMie(tante).length, QUANTE_MIE);
  /* E la barra le porta con sé: chi salva la fascia salva anche queste. */
  assert.deepEqual(normalizzaBarra({}).mie, []);
  assert.equal(normalizzaBarra({ mie: tante }).mie.length, QUANTE_MIE);
  /* Quello che non è un elenco non diventa una riga per sbaglio. */
  assert.deepEqual(normalizzaLeMie(null), []);
  assert.deepEqual(normalizzaLeMie({ entity: "sensor.uno" }), []);
});

test("due righe sulla stessa entità sono una sola, le righe vuote restano tutte", () => {
  const pulite = normalizzaLeMie([
    { entity: "sensor.uno", nome: "Primo" },
    { entity: "sensor.uno", nome: "Di nuovo" },
    { entity: "sensor.due" },
  ]);
  assert.deepEqual(
    pulite.map((mia) => [mia.entity, mia.nome]),
    [
      ["sensor.uno", "Primo"],
      ["sensor.due", ""],
    ],
  );
  /* Le righe ancora vuote sono quelle appena aggiunte, che l'entità non ce
   * l'hanno: toglierle vorrebbe dire premere «＋» e non vedere comparire
   * niente. */
  assert.equal(normalizzaLeMie([{}, {}, {}]).length, 3);
});

test("lo stato di serie è «on», ma solo quando c'è una condizione", () => {
  const [conCondizione] = normalizzaLeMie([{ entity: "sensor.uno", quando: "input_boolean.via" }]);
  assert.equal(conCondizione.stato, STATO_DI_SERIE);
  /* Senza condizione lo stato non decide niente e non si tiene: una casella
   * piena che non fa niente è una casella che promette. */
  const [senza] = normalizzaLeMie([{ entity: "sensor.uno", stato: "heat" }]);
  assert.equal(senza.stato, "");
});

/* ── quando si vede ─────────────────────────────────────────────────────── */

test("senza condizione si vede sempre; con la condizione solo se torna", () => {
  assert.equal(laMiaSiVede({ quando: "", stato: "" }, {}), true);
  assert.equal(laMiaSiVede({ quando: "input_boolean.vacanze", stato: "on" }, { condizione: "on" }), true);
  assert.equal(
    laMiaSiVede({ quando: "input_boolean.vacanze", stato: "on" }, { condizione: "off" }),
    false,
  );
  /* Chi scrive «ON» nella casella intende `on`. */
  assert.equal(
    laMiaSiVede({ quando: "input_boolean.vacanze", stato: "ON" }, { condizione: "on" }),
    true,
  );
});

test("una condizione che non si riesce a leggere vale NO", () => {
  /* Se non si sa se siamo in vacanza, la pastiglia delle vacanze non si
   * mostra: mostrarla per scrupolo vorrebbe dire dire una cosa che non si sa. */
  for (const letta of [null, {}, { condizione: "" }])
    assert.equal(laMiaSiVede({ quando: "input_boolean.vacanze", stato: "on" }, letta), false);
});

/* ── la pastiglia ───────────────────────────────────────────────────────── */

test("la pastiglia esce in fondo, dopo le misure, e porta la sua identità", () => {
  const misure = { temperatura: { valore: 21.4, unita: "°C", nome: "Fuori" } };
  const pastiglie = pastiglieDellaCasa([], {
    barra: { mie: [SERBATOIO] },
    misure,
    mie: letto(64, { condizione: "on" }),
  });
  const chiavi = pastiglie.map((pastiglia) => pastiglia.chiave);
  assert.deepEqual(chiavi, ["temperatura", "mia"]);
  const [, mia] = pastiglie;
  /* Una pastiglia per entità: chi disegna le riconosce da qui, e due che si
   * chiamassero uguale sarebbero la stessa disegnata due volte. */
  assert.equal(mia.id, `mia:${SERBATOIO.entity}`);
  assert.equal(mia.entity, SERBATOIO.entity);
  assert.equal(mia.valore, 64);
  assert.equal(mia.unita, "%");
  assert.equal(mia.nome, "Serbatoio");
  /* Una tessera non ce l'ha: toccandola si apre la scheda dell'entità. */
  assert.equal(mia.tessera, "");
  assert.equal(mia.tinta, TINTA_MIA);
  assert.equal(mia.mdi, SEGNO_MIO);
});

test("il nome, il segno e il colore: la configurazione vince su Home Assistant", () => {
  const [scelti] = pastiglieDellaCasa([], {
    barra: { mie: [{ ...SERBATOIO, quando: "", icona: "🌴", tinta: "#0ea5e9" }] },
    mie: letto(64, { icona: "mdi:water" }),
  });
  assert.equal(scelti.icona, "🌴");
  assert.equal(scelti.mdi, "");
  assert.equal(scelti.tinta, "#0ea5e9");
  assert.equal(scelti.nome, "Serbatoio");

  /* Senza niente scritto parla Home Assistant: il segno che dichiara l'entità
   * e il nome che le ha dato lei. */
  const [soli] = pastiglieDellaCasa([], {
    barra: { mie: [{ entity: SERBATOIO.entity }] },
    mie: letto(64, { icona: "mdi:water" }),
  });
  assert.equal(soli.mdi, "mdi:water");
  assert.equal(soli.icona, "");
  assert.equal(soli.nome, "Acqua serbatoio");
  assert.equal(soli.tinta, TINTA_MIA);
});

test("con la modalità vacanze spenta la pastiglia non c'è", () => {
  assert.deepEqual(
    pastiglieDellaCasa([], {
      barra: { mie: [SERBATOIO] },
      mie: letto(64, { condizione: "off" }),
    }),
    [],
  );
  /* E accesa sì: è la stessa configurazione, cambia solo l'interruttore. */
  assert.equal(
    pastiglieDellaCasa([], { barra: { mie: [SERBATOIO] }, mie: letto(64, { condizione: "on" }) })
      .length,
    1,
  );
});

test("un'entità che non risponde non scrive «—»: la pastiglia non c'è", () => {
  const spenta = { [SERBATOIO.entity]: { valore: null, testo: "", condizione: "on" } };
  assert.deepEqual(pastiglieDellaCasa([], { barra: { mie: [SERBATOIO] }, mie: spenta }), []);
  /* Nemmeno quando la sezione non ha proprio letto niente. */
  assert.deepEqual(pastiglieDellaCasa([], { barra: { mie: [SERBATOIO] }, mie: {} }), []);
  /* E una riga senza entità — quella appena aggiunta — non disegna niente. */
  assert.deepEqual(pastiglieDellaCasa([], { barra: { mie: [{ nome: "Ancora niente" }] } }), []);
});

test("quello che non è un numero si dice com'è scritto", () => {
  const [mia] = pastiglieDellaCasa([], {
    barra: { mie: [{ entity: SERBATOIO.entity, nome: "Consegna" }] },
    mie: { [SERBATOIO.entity]: { valore: null, testo: "In arrivo", nome: "Consegna" } },
  });
  assert.equal(mia.valore, null);
  assert.equal(mia.testo, "In arrivo");
});

/* ── la lettura, dalla parte della sezione ──────────────────────────────── */

test("è un numero solo quando lo stato È un numero, non quando ne comincia con uno", () => {
  const lettura = (state, attributes = {}) =>
    letturaDellaMia("sensor.prova", { "sensor.prova": { state, attributes } });
  assert.equal(lettura("64").valore, 64);
  assert.equal(lettura("21,5").valore, 21.5);
  assert.equal(lettura("-3.25").valore, -3.25);
  /* «12:30» comincia con 12 e non è dodici. Una lettura letta a metà è peggio
   * di una lettura che manca. */
  assert.equal(lettura("12:30").valore, null);
  assert.equal(lettura("12:30").testo, "12:30");
  assert.equal(lettura("3 giorni").valore, null);
  /* Le parole si traducono: «Acceso», non `on`. */
  assert.equal(lettura("on").valore, null);
  assert.ok(lettura("on").testo && lettura("on").testo !== "on");
  /* E chi non risponde non torna affatto. */
  for (const stato of ["unavailable", "unknown", ""]) assert.equal(lettura(stato), null);
  assert.equal(letturaDellaMia("sensor.assente", {}), null);
  assert.equal(letturaDellaMia("", {}), null);
});

test("la sezione legge DUE entità per riga, e non le scambia", () => {
  const states = {
    "sensor.acqua_serbatoio": {
      state: "64",
      attributes: { unit_of_measurement: "%", friendly_name: "Acqua serbatoio", icon: "mdi:water" },
    },
    "input_boolean.vacanze": { state: "on", attributes: {} },
  };
  const lette = leMieAdesso(normalizzaBarra({ mie: [SERBATOIO] }), states);
  const voce = lette[SERBATOIO.entity];
  assert.equal(voce.valore, 64);
  assert.equal(voce.unita, "%");
  assert.equal(voce.icona, "mdi:water");
  /* La condizione viene dall'ALTRA entità: scambiarle vorrebbe dire una fascia
   * che mostra lo stato dell'interruttore delle vacanze. */
  assert.equal(voce.condizione, "on");
  /* E una condizione che non risponde resta vuota, che per il nucleo vuol dire
   * «non si vede». */
  const alBuio = leMieAdesso(normalizzaBarra({ mie: [SERBATOIO] }), {
    ...states,
    "input_boolean.vacanze": { state: "unavailable", attributes: {} },
  });
  assert.equal(alBuio[SERBATOIO.entity].condizione, "");
});

/* ── la scheda e il tocco ───────────────────────────────────────────────── */

test("la scheda ha le caselle, e il tasto per aggiungerne una", () => {
  const sorgente = leggi("sections/come-sta-la-casa-section.js");
  for (const campo of ["entity", "nome", "icona", "tinta", "quando", "stato"])
    assert.ok(
      sorgente.includes(`data-dm-casa-mia-campo="${campo}"`),
      `manca la casella «${campo}»`,
    );
  assert.match(sorgente, /data-dm-casa-mia-piu/);
  assert.match(sorgente, /data-dm-casa-mia-via/);
  /* Aggiungere e togliere ridisegnano il pannello: senza rileggere quello che
   * c'è scritto adesso, il testo non ancora salvato se ne andrebbe al primo
   * «＋». */
  assert.match(sorgente, /detto\.mie\.push\(/);
  assert.match(sorgente, /detto\.mie\.splice\(quale, 1\)/);
  /* Tre volte: chi salva, chi aggiunge e chi toglie. */
  assert.equal(sorgente.match(/(?<!function )quelloCheDiceIlPannello\(pannello\)/g).length, 3);
});

test("toccandola si apre la scheda di Home Assistant, non una nostra più povera", () => {
  const sorgente = leggi("sections/come-sta-la-casa-section.js");
  assert.match(sorgente, /from "\.\/la-scheda-di-home-assistant\.js"/);
  assert.match(sorgente, /apriLaSchedaDellEntita\(pastiglia\.dataset\.dmEntita\)/);
  /* L'entità arriva al documento addosso alla pastiglia. */
  assert.match(sorgente, /attributo\("data-dm-entita", pastiglia\.entity \|\| ""\)/);
  /* E la strada per uscire dalla cornice sta scritta una volta sola: le
   * Persone la chiedono allo stesso posto. */
  const persone = leggi("sections/people-section.js");
  assert.match(persone, /from "\.\/la-scheda-di-home-assistant\.js"/);
  assert.ok(!persone.includes("hass-more-info"), "la copia nelle Persone è tornata");
});
