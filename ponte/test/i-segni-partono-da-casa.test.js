/* L'icona di un aggiornamento che sta **in casa**, e che non partiva.
 *
 * Nell'app le icone c'erano tutte; nel cruscotto quasi nessuna — Frigate, Home
 * Assistant Core, il sistema operativo, il firmware del minipc, tutti con la
 * loro letterina. L'unica che passava era quella che arriva dai marchi.
 *
 * Il motivo: due strade per la stessa icona. Quella dell'app —
 * `ponte/aggiornamenti/logo` — sa chiedere a Home Assistant col segno di casa;
 * quella scritta qui accanto per il rapporto no, e a un indirizzo di casa
 * rispondeva `NON_CE_NE`, cioe' **non esiste**. Era falso, e faceva danno due
 * volte: l'icona non partiva, e il quadro si segnava che quel segno un'icona
 * non ce l'ha — per sempre, senza richiederla mai piu'.
 *
 * Adesso la strada e' una sola: quella che gia' funzionava.
 */

import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import { ilSegnoDi, Segni } from "../src/segni.js";

const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);

const UNO = {
  entita: "update.home_assistant_core_update",
  nome: "Home Assistant Core",
  a: "2026.9.3",
};

const laCasa = (dove) => ({
  async doveIlLogo() {
    return dove;
  },
  async note() {
    return { note: "" };
  },
});

test("l'icona che sta in casa si chiede per la strada dell'app, e arriva", async () => {
  let chiesta = "";
  const segni = new Segni({
    aggiornamenti: laCasa("/api/image_proxy/update.home_assistant_core_update"),
    registro: ZITTO,
    async ilLogoDiCasa(entita) {
      chiesta = entita;
      return {
        success: true,
        result: { stato: 200, tipo: "image/png", corpo: PNG.toString("base64") },
      };
    },
  });

  const fatti = await segni.quelliCheMancano([ilSegnoDi(UNO.nome, UNO.a)], [UNO]);
  const suo = fatti.get(ilSegnoDi(UNO.nome, UNO.a));
  assert.equal(chiesta, UNO.entita, "non ha chiesto di quell'aggiornamento");
  assert.equal(suo.logo, PNG.toString("base64"), "l'icona non e' partita");
  assert.equal(suo.senzaLogo, undefined, "si e' segnata come inesistente");
});

test("«non ce l'ha» e «oggi non arriva» restano due cose diverse", async () => {
  /* La differenza costa cara: la prima si dice al quadro e non si richiede
   * piu', la seconda si tace e al giro dopo si riprova. Scambiarle vuol dire o
   * una letterina per sempre, o una domanda che non finisce mai. */
  const con = (risposta) =>
    new Segni({
      aggiornamenti: laCasa("/api/image_proxy/update.qualcosa"),
      registro: ZITTO,
      async ilLogoDiCasa() {
        if (risposta instanceof Error) throw risposta;
        return risposta;
      },
    });
  const quale = ilSegnoDi(UNO.nome, UNO.a);
  const chiedi = async (risposta) =>
    (await con(risposta).quelliCheMancano([quale], [UNO])).get(quale);

  /* Home Assistant dice che quell'immagine non c'e': e' un no definitivo. */
  const mai = await chiedi({ success: true, result: { stato: 404 } });
  assert.equal(mai.senzaLogo, true, "una cosa che non esiste si richiede per sempre");

  /* Il ponte non sa nemmeno di cosa si parli: lo stesso. */
  const nemmeno = await chiedi({ success: false, error: { code: "not_found" } });
  assert.equal(nemmeno.senzaLogo, true);

  /* Ma un guasto di oggi — Home Assistant giu', un cinquecento, un'eccezione —
   * non si dice al quadro: si tace, e al giro dopo si riprova. */
  for (const oggi of [
    { success: true, result: { stato: 500 } },
    { success: false, error: { code: "ponte_http" } },
    new Error("Home Assistant non risponde"),
  ]) {
    const detto = await chiedi(oggi);
    assert.equal(detto.logo, undefined);
    assert.equal(detto.senzaLogo, undefined, "un guasto di oggi diventa un no per sempre");
  }
});

test("quello che non e' un'immagine non diventa un'icona", async () => {
  /* Fra le due macchine c'e' una rete, e un controllo da una parte sola non e'
   * un controllo. Qui arriva da Home Assistant, e si guarda lo stesso. */
  const segni = new Segni({
    aggiornamenti: laCasa("/api/image_proxy/update.qualcosa"),
    registro: ZITTO,
    async ilLogoDiCasa() {
      return {
        success: true,
        result: {
          stato: 200,
          tipo: "image/png",
          corpo: Buffer.from("<html>ciao</html>").toString("base64"),
        },
      };
    },
  });
  const quale = ilSegnoDi(UNO.nome, UNO.a);
  const suo = (await segni.quelliCheMancano([quale], [UNO])).get(quale);
  assert.equal(suo.logo, undefined);
  assert.equal(suo.senzaLogo, true, "quella cosa li' non e' un'icona e non lo sara' mai");
});

/* ─── E anche il marchio passa di li' ─────────────────────────────────────
 *
 * Nella 1.5.9.11 la strada dell'app valeva solo per l'icona **di casa**; il
 * marchio se lo scaricava il rapporto da solo, con un `fetch` nudo, e in una
 * casa vera non portava niente: Home Assistant, il sistema e Frigate con la
 * lettera nel cruscotto, e coi loghi nell'app. Adesso la strada e' una per
 * tutte, e il `fetch` di qui non si chiama piu' se quella strada c'e'.
 */

test("anche l'icona dei marchi passa dalla strada dell'app, e il fetch di qui non si tocca", async () => {
  let chiesta = "";
  let scaricato = 0;
  const segni = new Segni({
    aggiornamenti: laCasa("https://brands.home-assistant.io/homeassistant/icon.png"),
    registro: ZITTO,
    async fetch() {
      scaricato += 1;
      throw new Error("non doveva passare di qui");
    },
    async ilLogoDiCasa(entita) {
      chiesta = entita;
      return {
        success: true,
        result: { stato: 200, tipo: "image/png", corpo: PNG.toString("base64") },
      };
    },
  });
  const quale = ilSegnoDi(UNO.nome, UNO.a);
  const suo = (await segni.quelliCheMancano([quale], [UNO])).get(quale);
  assert.equal(chiesta, UNO.entita);
  assert.equal(scaricato, 0, "il marchio si e' scaricato per conto suo");
  assert.equal(suo.logo, PNG.toString("base64"));
});

test("un'icona da quaranta kilobyte parte: il tetto e' quello del quadro", async () => {
  /* Erano 24 KiB, e un marchio colorato da 256 punti li passa con niente:
   * non partiva, e non lo diceva. */
  const grossa = Buffer.concat([PNG, Buffer.alloc(40 * 1024, 3)]);
  const segni = new Segni({
    aggiornamenti: laCasa("https://brands.home-assistant.io/frigate/icon.png"),
    registro: ZITTO,
    async ilLogoDiCasa() {
      return {
        success: true,
        result: { stato: 200, tipo: "image/png", corpo: grossa.toString("base64") },
      };
    },
  });
  const quale = ilSegnoDi(UNO.nome, UNO.a);
  const suo = (await segni.quelliCheMancano([quale], [UNO])).get(quale);
  assert.equal(suo.logo, grossa.toString("base64"), "l'icona grossa non e' partita");

  const { UN_SEGNO_AL_MASSIMO } = await import("../src/segni.js");
  const { QUANTO_GROSSA } = await import("../../quadro/src/segni.js");
  assert.equal(
    UN_SEGNO_AL_MASSIMO,
    QUANTO_GROSSA,
    "la casa manda fino a un peso e il quadro ne accetta un altro: una delle due si perde",
  );
});

test("un'icona che non ci sta si dice nel registro, e non si richiede ogni minuto", async () => {
  const { UN_SEGNO_AL_MASSIMO } = await import("../src/segni.js");
  const enorme = Buffer.concat([PNG, Buffer.alloc(UN_SEGNO_AL_MASSIMO, 3)]);
  const detto = [];
  const segni = new Segni({
    aggiornamenti: laCasa("https://brands.home-assistant.io/frigate/icon.png"),
    registro: { ...ZITTO, attenzione: (riga) => detto.push(riga) },
    async ilLogoDiCasa() {
      return {
        success: true,
        result: { stato: 200, tipo: "image/png", corpo: enorme.toString("base64") },
      };
    },
  });
  const quale = ilSegnoDi(UNO.nome, UNO.a);
  const suo = (await segni.quelliCheMancano([quale], [UNO])).get(quale);
  assert.equal(suo.logo, undefined);
  assert.equal(suo.senzaLogo, true, "un'icona troppo grossa si richiederebbe per sempre");
  assert.ok(
    detto.some((riga) => /piu' dei \d+ che stanno in un rapporto/.test(riga)),
    `il registro non dice perche': ${JSON.stringify(detto)}`,
  );
});

test("l'icona di gdahome ci sta in un rapporto: è l'unica che dipende da noi", async () => {
  /* Dal campo, con lo scatto del cruscotto: «negli aggiornamenti non esce
   * icona gdahome, cioè proprio la nostra». Duck DNS, Git pull, Home Assistant
   * Core avevano il loro marchio; gdahome la lettera «G».
   *
   * Non era il modo in cui il dato viaggia — quello funziona, e lo dicono le
   * prove qui sopra. Era il file: `ponte/icon.png` pesava centodue kilobyte,
   * il tetto di quello che sta in un rapporto è sessantaquattro, e sopra il
   * tetto il ponte non dice «oggi non ce l'ho» ma «un'icona non ce l'ha» —
   * che il quadro si segna **per sempre**, e non la richiede mai più. Le icone
   * degli altri add-on stanno tutte sotto il tetto: la nostra era l'unica
   * sopra, e per questo era l'unica che mancava.
   *
   * Questa prova guarda il file vero e non una finta, perché è il file vero
   * che parte: è l'unico modo di accorgersene il giorno che qualcuno rifà il
   * disegno e lo salva grosso. */
  const { cheImmagineE, UN_SEGNO_AL_MASSIMO } = await import("../src/segni.js");
  const byte = readFileSync(new URL("../icon.png", import.meta.url));
  assert.ok(
    byte.length <= UN_SEGNO_AL_MASSIMO,
    `la nostra icona pesa ${byte.length} byte e in un rapporto ne stanno ${UN_SEGNO_AL_MASSIMO}: ` +
      "nel cruscotto resterebbe la lettera, per sempre",
  );
  /* E si sa ancora leggere: un'icona sotto il tetto ma di una razza che non si
   * sa mostrare finirebbe nello stesso posto. */
  assert.equal(cheImmagineE(byte), "image/png");
});
