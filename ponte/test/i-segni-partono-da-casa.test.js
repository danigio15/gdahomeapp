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
