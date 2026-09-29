/* Il filo col centralino e le licenze: la presentazione, e la ricevuta di chi
 * compra fuori casa.
 *
 * La licenza va detta **dentro** la presentazione, anche vuota: e' cosi' che il
 * centralino sa dal primo istante che l'add-on le licenze le conosce, e a un
 * telefono che bussa in quel millisecondo non dice «aggiorna l'add-on» per
 * sbaglio. Con le licenze spente invece la presentazione e' quella di sempre.
 *
 * E la ricevuta: il centralino la gira qui, `{t: "ricevuta", n, corpo}`, e la
 * risposta torna sullo stesso filo con lo stesso numero, qualunque cosa
 * succeda a chi la controlla.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Chiamata } from "../src/chiamata.js";

/* Una presa finta che risponde «bene» alla presentazione, e si ricorda cosa
 * le si e' detto. */
class PresaFinta extends EventTarget {
  static ultima = null;

  constructor(dove) {
    super();
    this.dove = dove;
    this.mandati = [];
    PresaFinta.ultima = this;
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }

  send(testo) {
    this.mandati.push(JSON.parse(testo));
    if (JSON.parse(testo).t === "sono-io") this.dice({ t: "bene" });
  }

  dice(cosa) {
    queueMicrotask(() =>
      this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(cosa) })),
    );
  }

  close() {}
}

const muto = { info() {}, attenzione() {}, errore() {} };

async function unaChiamata(prima = () => {}) {
  const chiamata = new Chiamata({
    dove: "wss://centralino.finto",
    identita: { casa: "casa_prova", segreto: "un-segreto" },
    portiere: { accogli() {} },
    registro: muto,
    Presa: PresaFinta,
  });
  prima(chiamata);
  chiamata.avvia();
  const fine = Date.now() + 3000;
  while (!chiamata.dentro && Date.now() < fine) await new Promise((ok) => setTimeout(ok, 2));
  assert.equal(chiamata.dentro, true);
  return { chiamata, presa: PresaFinta.ultima };
}

async function laRispostaA(presa, n) {
  const fine = Date.now() + 3000;
  while (Date.now() < fine) {
    const trovata = presa.mandati.find((uno) => uno.t === "ricevuta" && uno.n === n);
    if (trovata) return trovata;
    await new Promise((ok) => setTimeout(ok, 2));
  }
  assert.fail(`nessuna risposta alla ricevuta ${n}`);
}

test("con le licenze accese la presentazione porta la licenza, anche vuota", async () => {
  const { chiamata, presa } = await unaChiamata((una) => una.diLaLicenza(""));
  const presentazione = presa.mandati[0];
  assert.equal(presentazione.t, "sono-io");
  assert.equal(presentazione.gettone, "");
  /* E poi a parte, come sempre: un centralino che nella presentazione non la
   * guarda la sente lo stesso. */
  assert.ok(presa.mandati.some((uno) => uno.t === "licenza" && uno.gettone === ""));
  chiamata.spegni();
});

test("con le licenze spente la presentazione e' quella di sempre", async () => {
  const { chiamata, presa } = await unaChiamata();
  assert.equal("gettone" in presa.mandati[0], false);
  assert.equal(
    presa.mandati.some((uno) => uno.t === "licenza"),
    false,
  );
  chiamata.spegni();
});

test("la ricevuta girata dal centralino ha la sua risposta, col suo numero", async () => {
  const arrivate = [];
  const { chiamata, presa } = await unaChiamata((una) => {
    una.diLaLicenza("");
    una.alRicevere = async (corpo) => {
      arrivate.push(corpo);
      return { stato: 200, corpo: { gdahome: { attiva: true } } };
    };
  });
  presa.dice({ t: "ricevuta", n: 7, corpo: { ricevuta: "2000000123456789" } });
  const risposta = await laRispostaA(presa, 7);
  assert.deepEqual(risposta, {
    t: "ricevuta",
    n: 7,
    stato: 200,
    corpo: { gdahome: { attiva: true } },
  });
  assert.deepEqual(arrivate, [{ ricevuta: "2000000123456789" }]);
  chiamata.spegni();
});

test("senza chi la controlla, o se inciampa, la risposta arriva lo stesso", async () => {
  const spenta = await unaChiamata();
  spenta.presa.dice({ t: "ricevuta", n: 1, corpo: {} });
  assert.deepEqual(await laRispostaA(spenta.presa, 1), {
    t: "ricevuta",
    n: 1,
    stato: 501,
    corpo: { errore: "licenze-spente" },
  });
  spenta.chiamata.spegni();

  const inciampa = await unaChiamata((una) => {
    una.diLaLicenza("");
    una.alRicevere = async () => {
      throw new Error("boh");
    };
  });
  inciampa.presa.dice({ t: "ricevuta", n: 2, corpo: {} });
  const risposta = await laRispostaA(inciampa.presa, 2);
  assert.equal(risposta.stato, 500);
  /* E il filo resta su: un errore di chi controlla non e' una caduta. */
  assert.equal(inciampa.chiamata.dentro, true);
  inciampa.chiamata.spegni();
});
