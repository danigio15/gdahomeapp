/* Le notifiche col filo del centralino giu'.
 *
 * «Ho impressione che le notifiche non partono se l'app non e' collegata»: la
 * strada di una notifica non passa dal telefono — casa → centralino →
 * Firebase — ma passa dal filo fra la casa e il centralino, e quel filo cade
 * (il router, il centralino che si riavvia) e torna dopo qualche secondo. Una
 * notifica partita in quel buco andava persa: `spingi` diceva `false`, e
 * nessuno ci riprovava. Adesso aspetta, chiusa com'era, e parte appena il
 * centralino ci riconosce; la prova invece no, e dice subito che non e'
 * partita.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Chiamata, SPINTE_IN_ATTESA } from "../src/chiamata.js";

/* Una presa finta: risponde «bene» alla presentazione solo quando le si dice
 * di farlo, e si ricorda cosa le si e' detto. */
class PresaFinta extends EventTarget {
  static ultima = null;
  static rispondi = true;

  constructor(dove) {
    super();
    this.dove = dove;
    this.mandati = [];
    PresaFinta.ultima = this;
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }

  send(testo) {
    const detto = JSON.parse(testo);
    this.mandati.push(detto);
    if (detto.t === "sono-io" && PresaFinta.rispondi) this.dice({ t: "bene" });
  }

  dice(cosa) {
    queueMicrotask(() =>
      this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(cosa) })),
    );
  }

  cade() {
    if (this.chiusa) return;
    this.chiusa = true;
    this.dispatchEvent(new Event("close"));
  }

  close() {
    queueMicrotask(() => this.cade());
  }
}

const muto = { info() {}, attenzione() {}, errore() {} };

const aspetta = async (condizione) => {
  const fine = Date.now() + 3000;
  while (!condizione() && Date.now() < fine) await new Promise((ok) => setTimeout(ok, 2));
  assert.ok(condizione());
};

function unaChiamata(opzioni = {}) {
  return new Chiamata({
    dove: "wss://centralino.finto",
    identita: { casa: "casa_prova", segreto: "un-segreto" },
    portiere: { accogli() {} },
    registro: muto,
    Presa: PresaFinta,
    attesaMassima: 5,
    ...opzioni,
  });
}

const spinte = (presa) => presa.mandati.filter((uno) => uno.t === "spinta");

test("col filo giu' la notifica aspetta, e parte quando il centralino torna", async () => {
  PresaFinta.rispondi = false;
  const chiamata = unaChiamata();
  chiamata.avvia();
  await aspetta(() => PresaFinta.ultima?.mandati.length > 0);
  assert.equal(chiamata.dentro, false);

  const partita = chiamata.spingi({
    telefono: "dm_0123456789abcdef",
    busta: "AAAA",
    urgente: true,
  });
  assert.equal(partita, true, "aspetta: partira'");
  assert.equal(chiamata.spinteInAttesa, 1);
  assert.equal(spinte(PresaFinta.ultima).length, 0, "nessuna busta su un filo che non c'e'");

  /* Il centralino ci riconosce: prima i gettoni, poi la notifica. */
  PresaFinta.rispondi = true;
  chiamata.diIGettoni([{ telefono: "dm_0123456789abcdef", gettone: "g".repeat(40) }]);
  PresaFinta.ultima.cade();
  await aspetta(() => chiamata.dentro);
  const presa = PresaFinta.ultima;
  await aspetta(() => spinte(presa).length === 1);
  const [busta] = spinte(presa);
  assert.equal(busta.telefono, "dm_0123456789abcdef");
  assert.equal(busta.busta, "AAAA");
  assert.equal(busta.urgente, true);
  const ordine = presa.mandati.map((uno) => uno.t);
  assert.ok(ordine.indexOf("spinta-elenco") < ordine.indexOf("spinta"), "i gettoni prima");
  assert.equal(chiamata.spinteInAttesa, 0);
  chiamata.spegni();
});

test("la prova non aspetta: col filo giu' dice subito che non e' partita", async () => {
  PresaFinta.rispondi = false;
  const chiamata = unaChiamata();
  chiamata.avvia();
  await aspetta(() => PresaFinta.ultima?.mandati.length > 0);
  assert.equal(
    chiamata.spingi({ telefono: "dm_0123456789abcdef", busta: "AAAA", aspetta: false }),
    false,
  );
  assert.equal(chiamata.spinteInAttesa, 0);
  chiamata.spegni();
});

test("le troppo vecchie non partono, e piu' di cinquanta non se ne tengono", async () => {
  PresaFinta.rispondi = false;
  const chiamata = unaChiamata({ attesaDelleSpinte: 30 });
  chiamata.avvia();
  await aspetta(() => PresaFinta.ultima?.mandati.length > 0);
  chiamata.spingi({ telefono: "dm_0123456789abcdef", busta: "VECCHIA" });
  await new Promise((ok) => setTimeout(ok, 60));
  for (let volta = 0; volta < SPINTE_IN_ATTESA + 5; volta += 1)
    chiamata.spingi({ telefono: "dm_0123456789abcdef", busta: `B${volta}` });
  assert.equal(chiamata.spinteInAttesa, SPINTE_IN_ATTESA);

  PresaFinta.rispondi = true;
  PresaFinta.ultima.cade();
  await aspetta(() => chiamata.dentro);
  const presa = PresaFinta.ultima;
  await aspetta(() => spinte(presa).length === SPINTE_IN_ATTESA);
  const buste = spinte(presa).map((uno) => uno.busta);
  assert.ok(!buste.includes("VECCHIA"), "una notifica di troppo tempo fa non parte");
  assert.equal(buste[0], "B5", "le piu' vecchie escono per prime");
  assert.equal(buste.at(-1), `B${SPINTE_IN_ATTESA + 4}`);
  chiamata.spegni();
});

test("senza centralino, o rifiutati, non si aspetta niente", async () => {
  const senza = new Chiamata({
    dove: "",
    identita: { casa: "casa_prova", segreto: "x" },
    portiere: { accogli() {} },
    registro: muto,
    Presa: PresaFinta,
  });
  assert.equal(senza.spingi({ telefono: "dm_0123456789abcdef", busta: "AAAA" }), false);

  PresaFinta.rispondi = false;
  const rifiutata = unaChiamata();
  rifiutata.avvia();
  await aspetta(() => PresaFinta.ultima?.mandati.length > 0);
  rifiutata.spingi({ telefono: "dm_0123456789abcdef", busta: "AAAA" });
  PresaFinta.ultima.dice({ t: "no", perche: "non ti conosco" });
  await aspetta(() => rifiutata.rifiutata !== null);
  assert.equal(rifiutata.spinteInAttesa, 0, "quelle in attesa se ne vanno");
  assert.equal(rifiutata.spingi({ telefono: "dm_0123456789abcdef", busta: "AAAA" }), false);
  rifiutata.spegni();
});

test("col filo su la notifica parte subito, come sempre", async () => {
  PresaFinta.rispondi = true;
  const chiamata = unaChiamata();
  chiamata.avvia();
  await aspetta(() => chiamata.dentro);
  assert.equal(chiamata.spingi({ telefono: "dm_0123456789abcdef", busta: "AAAA" }), true);
  assert.equal(spinte(PresaFinta.ultima).length, 1);
  assert.equal(chiamata.spinteInAttesa, 0);
  chiamata.spegni();
});
