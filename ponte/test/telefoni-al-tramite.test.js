/* Quanti telefoni per versione dell'app, detto al tramite
 * (`telefoni-al-tramite.js`): cosa parte, quando, e che dentro non c'e'
 * niente di chi sono. */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Chiamata } from "../src/chiamata.js";
import { iTelefoniPerIlTramite, TelefoniAlTramite } from "../src/telefoni-al-tramite.js";

const ADESSO = 1_800_000_000_000;
const GIORNO = 24 * 60 * 60 * 1000;

/* I telefoni come li tiene `dispositivi.js`: con nome, id, gettoni e tutto il
 * resto, che al tramite non deve arrivare. */
const unTelefono = (giorniFa, sistema, app, costruzione, nome) => ({
  id: `tel_${nome}`,
  nome,
  utente: `utente_${nome}`,
  gettone: `gettone-${nome}`,
  modello: "iPhone 17 Pro",
  vistoIl: ADESSO - giorniFa * GIORNO,
  sistema,
  app,
  costruzione,
});

const dispositivi = {
  elenco: () => [
    unTelefono(1, "ios", "1.18.8", "1180800", "Marco"),
    unTelefono(2, "ios", "1.18.8", "1180800", "Anna"),
    unTelefono(3, "android", "1.16.12", "1161200", "Luca"),
    /* Visto un mese fa: non conta. */
    unTelefono(30, "ios", "1.17.0", "1170000", "Vecchio"),
    /* Una versione scritta strana: arriva come «non detta», non butta il resto. */
    unTelefono(1, "android", "1.18.8 (beta!)", "1180800", "Strano"),
  ],
};

test("il messaggio: quanti per negozio e versione, e basta", () => {
  const detto = iTelefoniPerIlTramite({ dispositivi, adesso: () => ADESSO });
  assert.equal(detto.visti7gg, 4);
  assert.equal(detto.rapporto, false);
  assert.deepEqual(
    detto.versioni.map(({ negozio, versione, costruzione, quanti }) => [
      negozio,
      versione,
      costruzione,
      quanti,
    ]),
    [
      ["apple", "1.18.8", 1180800, 2],
      ["google", "", 1180800, 1],
      ["google", "1.16.12", 1161200, 1],
    ],
  );
  /* Niente di chi sono: ne' nomi, ne' identificativi, ne' gettoni, ne'
   * modelli, ne' quando. */
  const testo = JSON.stringify(detto);
  for (const vietato of ["Marco", "Anna", "Luca", "tel_", "utente_", "gettone-", "iPhone 17"])
    assert.equal(testo.includes(vietato), false, vietato);
  assert.deepEqual(Object.keys(detto).sort(), ["rapporto", "versioni", "visti7gg"]);
  for (const una of detto.versioni)
    assert.deepEqual(Object.keys(una).sort(), ["costruzione", "negozio", "quanti", "versione"]);
});

test("col rapporto al quadro di gdahome lo dice, perche' il centralino non li conti due volte", () => {
  const detto = iTelefoniPerIlTramite({ dispositivi, rapporto: true, adesso: () => ADESSO });
  assert.equal(detto.rapporto, true);
});

/* Una presa finta che risponde «bene» alla presentazione. */
class PresaFinta extends EventTarget {
  static ultima = null;
  constructor() {
    super();
    this.mandati = [];
    PresaFinta.ultima = this;
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }
  send(testo) {
    const detto = JSON.parse(testo);
    this.mandati.push(detto);
    if (detto.t === "sono-io")
      queueMicrotask(() =>
        this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ t: "bene" }) })),
      );
  }
  close() {}
}

test("parte all'entrata e poi a ogni giro, e la chiamata lo ridice a ogni entrata", async () => {
  const chiamata = new Chiamata({
    dove: "wss://centralino.finto",
    identita: { casa: "casa_prova", segreto: "un-segreto" },
    portiere: { accogli() {} },
    registro: { info() {}, attenzione() {}, errore() {} },
    Presa: PresaFinta,
  });
  let rapporto = false;
  const telefoni = new TelefoniAlTramite({
    chiamata,
    dispositivi,
    rapporto: () => rapporto,
    ogni: 20,
    adesso: () => ADESSO,
  });
  /* Detto prima che il filo sia su: aspetta l'entrata. */
  telefoni.parti();
  chiamata.avvia();
  const fine = Date.now() + 3000;
  while (!chiamata.dentro && Date.now() < fine) await new Promise((ok) => setTimeout(ok, 2));
  const presa = PresaFinta.ultima;
  const quanti = () => presa.mandati.filter((uno) => uno.t === "telefoni");
  assert.equal(quanti().length, 1);
  assert.equal(quanti()[0].visti7gg, 4);

  /* Al giro dopo riparte, col rapporto com'e' adesso. */
  rapporto = true;
  const dopo = Date.now() + 3000;
  while (quanti().length < 2 && Date.now() < dopo) await new Promise((ok) => setTimeout(ok, 5));
  telefoni.ferma();
  chiamata.spegni();
  assert.ok(quanti().length >= 2);
  assert.equal(quanti().at(-1).rapporto, true);
});

test("ogni ora, di serie", () => {
  const telefoni = new TelefoniAlTramite({ chiamata: { diITelefoni() {} }, dispositivi });
  assert.equal(telefoni.ogni, 60 * 60 * 1000);
});

test("una casa senza telefoni dice zero, e un conto che non si fa non ferma niente", () => {
  const detti = [];
  const chiamata = { diITelefoni: (conto) => detti.push(conto) };
  new TelefoniAlTramite({ chiamata, dispositivi: { elenco: () => [] } }).dillo();
  assert.deepEqual(detti, [{ visti7gg: 0, versioni: [], rapporto: false }]);
  const rotto = {
    elenco: () => {
      throw new Error("disco");
    },
  };
  assert.doesNotThrow(() => new TelefoniAlTramite({ chiamata, dispositivi: rotto }).dillo());
});
