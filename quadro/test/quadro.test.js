/* Le prove del quadro, col server vero acceso.
 *
 * Quello che si prova, e in quest'ordine di importanza:
 *
 *  1. **che due installatori non si vedano.** Adesso il quadro e' uno solo e
 *     sta su una macchina di gdahome, con dentro le case di installatori diversi
 *     che fra loro si fanno concorrenza: i clienti di Rossi non sono affari di
 *     Bianchi. E' la riga che regge tutto quanto il resto;
 *  2. **che una casa non possa leggere nessuna console.** La chiave di una
 *     casa apre una porta sola — depositare il proprio rapporto — e non fa
 *     vedere niente;
 *  3. **che un codice usato non serva a nessun'altra casa**, che e' cosa vuol
 *     dire «si brucia»;
 *  4. **che il limite sia un limite.** Qui il limite lo impone il server di chi
 *     lo decide, non un controllo dentro un programma che gira su una macchina
 *     altrui: quando conta, conta davvero;
 *  5. che quello che un rapporto non dice resti «non si sa» invece di
 *     diventare una spunta rossa;
 *  6. che la matricola che conta sia quella verificata, non quella scritta nel
 *     corpo da chi manda.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";

const RAPPORTO = {
  quando: new Date().toISOString(),
  ogni: 15,
  ponte: "1.4.32.15",
  plance: { quante: 1, configurate: 1 },
  telefoni: { abbinati: 2, visti7gg: 2 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 214, sparite: 0, impronte: [] },
  batterie: { scariche: 0, piuBassa: 47 },
  backup: { giorniFa: 2 },
  aggiornamenti: { quanti: 0, ha: false, addon: 0, gdahome: false, firmware: 0 },
  addon: { quanti: 3, accesi: 3, spentiCheDovrebbero: 0, elenco: [] },
  rete: { internet: true, schede: [], sorvegliate: { quante: 0, giu: 0 } },
  macchina: { scheda: "ODROID-N2+", cpu: 14, ram: 38, disco: 46, temperatura: 46, discoVita: 11 },
};

async function banco({ installatori = 1, soglia = 0 } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;

  /* La gestione: chi tiene il quadro. */
  const gestore = (via, opzioni = {}) =>
    fetch(`${dove}/gestore${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${CHIAVE_DEL_GESTORE}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });

  /* Gli installatori iscritti prima che la prova cominci. Ognuno riceve la sua
   * chiave una volta sola, come nella vita. */
  const iscritti = [];
  for (let n = 0; n < installatori; n += 1) {
    const detto = await (
      await gestore("/installatori", {
        method: "POST",
        body: JSON.stringify({ nome: `Installatore ${n + 1}`, soglia }),
      })
    ).json();
    iscritti.push(detto);
  }

  return {
    ...acceso,
    dove,
    cartella,
    gestore,
    iscritti,
    /* Il retro: si bussa con la chiave di **un** installatore, il primo se non
     * si dice altro. */
    retro: (via, opzioni = {}, chiave = iscritti[0]?.chiave) =>
      fetch(`${dove}/console${via}`, {
        ...opzioni,
        headers: {
          authorization: `Bearer ${chiave}`,
          "content-type": "application/json",
          ...(opzioni.headers || {}),
        },
      }),
    /* Il davanti: una casa che deposita. */
    deposita: (casa, chiave, carta = RAPPORTO) =>
      fetch(`${dove}/rapporto`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${chiave}`,
          "content-type": "application/json",
          "x-casa": casa,
        },
        body: JSON.stringify(carta),
      }),
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

const unCodice = async (b, per = "", chiave) => {
  const detto = await (
    await b.retro("/inviti", { method: "POST", body: JSON.stringify({ per }) }, chiave)
  ).json();
  return detto.codice;
};

test("una casa non puo' leggere nessuna console, e non e' una svista", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    assert.equal((await b.deposita(UNA, codice)).status, 200);

    /* La chiave che le apre il deposito non le apre niente altro: quelle case
     * sono di clienti di qualcun altro. Nemmeno la gestione. */
    for (const via of ["/case", "/inviti"]) {
      const risposta = await fetch(`${b.dove}/console${via}`, {
        headers: { authorization: `Bearer ${codice}` },
      });
      assert.equal(risposta.status, 401, `«${via}» si e' aperta con la chiave di una casa`);
    }
    assert.equal(
      (
        await fetch(`${b.dove}/gestore/installatori`, {
          headers: { authorization: `Bearer ${codice}` },
        })
      ).status,
      401,
      "la gestione si e' aperto con la chiave di una casa",
    );
    /* E senza niente in testa, nemmeno. */
    assert.equal((await fetch(`${b.dove}/console/case`)).status, 401);
  } finally {
    await b.chiudi();
  }
});

test("un codice usato non serve a nessun'altra casa", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    assert.equal((await b.deposita(UNA, codice)).status, 200);
    /* La stessa casa continua a entrare: la chiave e' sua. */
    assert.equal((await b.deposita(UNA, codice)).status, 200);
    /* Un'altra no, e non impara niente da come glielo si dice. */
    const altra = await b.deposita(ALTRA, codice);
    assert.equal(altra.status, 403);
    assert.match((await altra.json()).errore, /non apre niente/);
  } finally {
    await b.chiudi();
  }
});

test("un codice annullato non apre piu', e uno mai fatto nemmeno", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    await b.retro(`/inviti/${codice}`, { method: "DELETE" });
    assert.equal((await b.deposita(UNA, codice)).status, 403);
    assert.equal((await b.deposita(UNA, "MAI-FATTO-QUESTO-QUI")).status, 403);
  } finally {
    await b.chiudi();
  }
});

test("una casa nuova nasce depositando, senza nome", async () => {
  const b = await banco();
  try {
    await b.deposita(UNA, await unCodice(b, "Villa Aurora"));
    const { case: case_ } = await (await b.retro("/case")).json();
    assert.equal(case_.length, 1);
    assert.equal(case_[0].casa, UNA);
    assert.equal(case_[0].senzaNome, true);
    /* Il primo rapporto di questa casa ha tutti i controlli verdi, quindi e'
     * a posto da subito. Non c'e' nessuna fila delle case da consegnare in cui
     * metterla: quella era il collaudo, e non c'e' piu'. */
    assert.equal(case_[0].stato.chiave, "posto");

    await b.retro(`/casa/${UNA}`, {
      method: "PUT",
      body: JSON.stringify({ nome: "Rossi — via Verdi 12" }),
    });
    const dopo = await (await b.retro("/case")).json();
    assert.equal(dopo.case[0].nome, "Rossi — via Verdi 12");
    assert.equal(dopo.case[0].senzaNome, false);
  } finally {
    await b.chiudi();
  }
});

test("quello che un rapporto non dice resta «non si sa», e non diventa rosso", async () => {
  const b = await banco();
  try {
    /* Una casa senza Supervisor e con Home Assistant giu': mezza rapporto. */
    await b.deposita(UNA, await unCodice(b), {
      quando: new Date().toISOString(),
      ogni: 15,
      ponte: "1.4.32.15",
    });
    const { case: case_ } = await (await b.retro("/case")).json();
    const controlli = case_[0].controlli;
    assert.equal(controlli.male, 0, "niente e' «va male»");
    assert.equal(controlli.bene, 0, "e niente e' «a posto»");
    assert.equal(controlli.ignoti, controlli.quanti, "e' tutto «questa casa non lo dice»");
    /* E siccome niente e' rosso, questa casa non finisce in nessuna fila: non
     * si guarda per un dato che non e' suo. */
    assert.equal(case_[0].stato.chiave, "posto");
  } finally {
    await b.chiudi();
  }
});

test("la matricola che conta e' quella verificata, non quella scritta nel corpo", async () => {
  const b = await banco();
  try {
    await b.deposita(UNA, await unCodice(b), { ...RAPPORTO, casa: ALTRA });
    const { case: case_ } = await (await b.retro("/case")).json();
    assert.equal(case_.length, 1);
    assert.equal(case_[0].casa, UNA);
    assert.equal(case_[0].carta.casa, UNA, "la matricola del corpo si riscrive");
  } finally {
    await b.chiudi();
  }
});

test("una matricola storta non entra, e un rapporto che non e' JSON nemmeno", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    assert.equal((await b.deposita("non-una-matricola", codice)).status, 400);
    const storta = await fetch(`${b.dove}/rapporto`, {
      method: "POST",
      headers: { authorization: `Bearer ${codice}`, "x-casa": UNA },
      body: "questo non e' JSON",
    });
    assert.equal(storta.status, 413);
  } finally {
    await b.chiudi();
  }
});

test("non seguirla piu' butta quello che se ne sa e anche la sua chiave", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    await b.deposita(UNA, codice);
    await b.retro(`/casa/${UNA}`, { method: "DELETE" });
    const { case: case_ } = await (await b.retro("/case")).json();
    assert.equal(case_.length, 0);
    /* E senza buttare anche la chiave, il primo rapporto la farebbe rinascere
     * tre secondi dopo. */
    assert.equal((await b.deposita(UNA, codice)).status, 403);
  } finally {
    await b.chiudi();
  }
});

test("la soglia e la salute rispondono a chi non sa cosa sia questo indirizzo", async () => {
  const b = await banco();
  try {
    const soglia = await fetch(`${b.dove}/`);
    assert.equal(soglia.status, 200);
    assert.match(await soglia.text(), /Non si entra in nessuna casa/);
    const salute = await (await fetch(`${b.dove}/salute`)).json();
    assert.deepEqual(salute, { vivo: true, case: 0, installatori: 1, gestore: true });
  } finally {
    await b.chiudi();
  }
});

/* ─── Due installatori sullo stesso quadro ────────────────────────────── */

test("due installatori sullo stesso quadro non si vedono", async () => {
  /* La riga che regge tutto. Il quadro e' uno solo e sta su una macchina di
   * gdahome: dentro ci sono le case di installatori che fra loro si fanno
   * concorrenza, e un elenco che le mescolasse consegnerebbe a ognuna la
   * clientela dell'altra. */
  const b = await banco({ installatori: 2 });
  const [rossi, bianchi] = b.iscritti;
  try {
    await b.deposita(UNA, await unCodice(b, "Rossi", rossi.chiave));
    await b.deposita(ALTRA, await unCodice(b, "Bianchi", bianchi.chiave));

    const diRossi = await (await b.retro("/case", {}, rossi.chiave)).json();
    const diBianchi = await (await b.retro("/case", {}, bianchi.chiave)).json();

    assert.deepEqual(
      diRossi.case.map((una) => una.casa),
      [UNA],
      "Rossi vede una casa che non e' sua",
    );
    assert.deepEqual(
      diBianchi.case.map((una) => una.casa),
      [ALTRA],
      "Bianchi vede una casa che non e' sua",
    );

    /* E nemmeno i codici in attesa: un invito aperto dice che una casa sta per
     * arrivare, e quando arrivera' e' un'informazione commerciale. */
    await b.retro(
      "/inviti",
      { method: "POST", body: JSON.stringify({ per: "il prossimo" }) },
      rossi.chiave,
    );
    const invitiDiBianchi = await (await b.retro("/inviti", {}, bianchi.chiave)).json();
    assert.equal(invitiDiBianchi.inviti.length, 0);
  } finally {
    await b.chiudi();
  }
});

test("una casa riabbinata cambia padrone davvero, elenchi e conti compresi", async () => {
  /* Il guasto che ha fatto scrivere questa prova, raccontato da chi l'ha
   * trovato: «ho tolto installatore e me lo lascia in piedi, secondo me legge
   * ancora quello che avevo eliminato».
   *
   * Leggeva. Riabbinare sostituisce la **chiave**, ma di chi fosse la casa
   * stava scritto in un secondo posto — la riga della casa — e quella non si
   * muoveva. Siccome e' quella riga a decidere chi vede cosa, la casa
   * spariva a tutti e due: zero impianti nel cruscotto del nuovo, e un
   * impianto rimasto solo nel conto della gestione. */
  const b = await banco({ installatori: 2 });
  const [rossi, bianchi] = b.iscritti;
  try {
    await b.deposita(UNA, await unCodice(b, "Rossi", rossi.chiave));
    await b.retro(
      `/casa/${UNA}`,
      { method: "PUT", body: JSON.stringify({ nome: "Sig.ra Verdi, via Tal dei Tali 3" }) },
      rossi.chiave,
    );

    /* Il codice di Bianchi, incollato in quella stessa casa. E' l'unico modo
     * che c'e' di riabbinare, e si fa da dentro casa: e' giusto cosi', perche'
     * e' chi ci abita a decidere chi guarda il suo impianto. */
    await b.deposita(UNA, await unCodice(b, "Bianchi", bianchi.chiave));

    const diRossi = await (await b.retro("/case", {}, rossi.chiave)).json();
    const diBianchi = await (await b.retro("/case", {}, bianchi.chiave)).json();
    assert.deepEqual(diRossi.case, [], "a Rossi resta in elenco una casa che non e' piu' sua");
    assert.deepEqual(
      diBianchi.case.map((una) => una.casa),
      [UNA],
      "Bianchi non vede la casa che ha appena abbinato",
    );

    /* E il nome no: non e' il nome dell'impianto, e' la nota che si era preso
     * Rossi, e dentro c'e' il cognome di una cliente. */
    assert.equal(diBianchi.case[0].senzaNome, true);
    assert.doesNotMatch(JSON.stringify(diBianchi.case[0]), /Verdi/);

    const quadro = await (await b.gestore("/installatori")).json();
    assert.equal(quadro.orfane, 0, "una casa che ha un padrone risulta rimasta sola");
    assert.equal(quadro.installatori.find((uno) => uno.nome === "Installatore 1").case, 0);
    assert.equal(quadro.installatori.find((uno) => uno.nome === "Installatore 2").case, 1);
  } finally {
    await b.chiudi();
  }
});

test("tolto l'installatore, la sua casa si recupera dandola a un altro", async () => {
  /* Il giro intero, quello vero: mi iscrivo, abbino la mia casa, mi tolgo
   * dalla gestione, mi riscrivo, e me la riprendo. Finche' non ha funzionato
   * non si poteva nemmeno provare il quadro sulla propria casa. */
  const b = await banco({ installatori: 1 });
  const [prima] = b.iscritti;
  try {
    const sua = await unCodice(b, "la mia", prima.chiave);
    await b.deposita(UNA, sua);

    await b.gestore(`/installatore/${prima.chi}`, { method: "DELETE" });
    const dopoIlTaglio = await (await b.gestore("/installatori")).json();
    assert.equal(dopoIlTaglio.case, 0, "eliminare ha lasciato indietro la casa");
    assert.equal(dopoIlTaglio.orfane, 0);

    /* E la casa, col codice che aveva incollato, non entra piu': quello che
     * l'apriva se n'e' andato con chi gliel'aveva dato. */
    assert.equal((await b.deposita(UNA, sua)).status, 403);

    const dopo = await (
      await b.gestore("/installatori", {
        method: "POST",
        body: JSON.stringify({ nome: "Io, adesso" }),
      })
    ).json();

    await b.deposita(UNA, await unCodice(b, "la mia", dopo.chiave));
    const mie = await (await b.retro("/case", {}, dopo.chiave)).json();
    assert.deepEqual(
      mie.case.map((una) => una.casa),
      [UNA],
      "la casa non e' tornata a chi l'ha appena riabbinata",
    );

    const quadro = await (await b.gestore("/installatori")).json();
    assert.equal(quadro.orfane, 0);
    assert.equal(quadro.installatori.find((uno) => uno.chi === dopo.chi).case, 1);
  } finally {
    await b.chiudi();
  }
});

test("la casa di un altro non si rinomina e non si toglie, nemmeno sapendone la matricola", async () => {
  /* Le matricole non sono segrete — passano in chiaro nelle intestazioni — e
   * quindi l'appartenenza dev'essere un lucchetto sulla via, non un filtro
   * sull'elenco. */
  const b = await banco({ installatori: 2 });
  const [rossi, bianchi] = b.iscritti;
  try {
    await b.deposita(UNA, await unCodice(b, "Rossi", rossi.chiave));
    await b.retro(
      `/casa/${UNA}`,
      { method: "PUT", body: JSON.stringify({ nome: "Casa Rossi" }) },
      rossi.chiave,
    );

    const rinomina = await b.retro(
      `/casa/${UNA}`,
      { method: "PUT", body: JSON.stringify({ nome: "adesso e' mia" }) },
      bianchi.chiave,
    );
    assert.equal(rinomina.status, 404, "Bianchi ha rinominato una casa di Rossi");

    const tolta = await b.retro(`/casa/${UNA}`, { method: "DELETE" }, bianchi.chiave);
    assert.equal((await tolta.json()).tolta, false, "Bianchi ha tolto una casa di Rossi");

    /* E a Rossi e' rimasta com'era. */
    const sue = await (await b.retro("/case", {}, rossi.chiave)).json();
    assert.equal(sue.case[0].nome, "Casa Rossi");
  } finally {
    await b.chiudi();
  }
});

test("il limite e' un limite: al limite non esce nessun codice nuovo", async () => {
  /* Qui il limite lo impone il server di chi lo decide, non un controllo dentro
   * un programma che gira su una macchina altrui. E' la differenza fra un no e
   * un dosso. */
  const b = await banco({ installatori: 1, soglia: 1 });
  try {
    await b.deposita(UNA, await unCodice(b));

    const ancora = await b.retro("/inviti", { method: "POST", body: JSON.stringify({}) });
    assert.equal(ancora.status, 409);
    assert.match((await ancora.json()).errore, /il tuo limite e' 1, e ci sei arrivato/);

    /* Chi tiene il quadro alza il limite, e il codice esce. */
    await b.gestore(`/installatore/${b.iscritti[0].chi}`, {
      method: "PUT",
      body: JSON.stringify({ soglia: 5 }),
    });
    assert.equal(
      (await b.retro("/inviti", { method: "POST", body: JSON.stringify({}) })).status,
      200,
    );
  } finally {
    await b.chiudi();
  }
});

test("gli inviti aperti contano nel limite, se no si fa il pieno in un minuto", async () => {
  /* Senza questa riga si generano venti codici mentre si e' sotto il limite, e
   * il giorno dopo ci sono venti case oltre, tutte legittime. */
  const b = await banco({ installatori: 1, soglia: 2 });
  try {
    assert.equal(
      (await b.retro("/inviti", { method: "POST", body: JSON.stringify({}) })).status,
      200,
    );
    assert.equal(
      (await b.retro("/inviti", { method: "POST", body: JSON.stringify({}) })).status,
      200,
    );
    assert.equal(
      (await b.retro("/inviti", { method: "POST", body: JSON.stringify({}) })).status,
      409,
    );
  } finally {
    await b.chiudi();
  }
});

test("chi tiene il quadro conta le case di ognuno, e non sa quali sono", async () => {
  /* Il conto e' suo, l'elenco no: sa che quello ne segue due, non chi
   * sono. Un elenco di nomi di clienti di terzi e' un'altra cosa, e piu'
   * pesante, che contare licenze. */
  const b = await banco({ installatori: 2 });
  const [rossi] = b.iscritti;
  try {
    await b.deposita(UNA, await unCodice(b, "", rossi.chiave));
    await b.retro(
      `/casa/${UNA}`,
      { method: "PUT", body: JSON.stringify({ nome: "Rossi — via Verdi 12" }) },
      rossi.chiave,
    );

    const detto = await (await b.gestore("/installatori")).json();
    const scritto = JSON.stringify(detto);

    const suo = detto.installatori.find((uno) => uno.chi === rossi.chi);
    assert.equal(suo.case, 1);
    assert.equal(suo.nome, "Installatore 1");
    for (const parola of ["Verdi", "Rossi —", UNA]) {
      assert.ok(!scritto.includes(parola), `«${parola}» e' arrivata a chi tiene il quadro`);
    }
  } finally {
    await b.chiudi();
  }
});

test("una chiave rifatta apre, e quella di prima no", async () => {
  const b = await banco({ installatori: 1 });
  const vecchia = b.iscritti[0].chiave;
  try {
    assert.equal((await b.retro("/case", {}, vecchia)).status, 200);
    const detto = await (
      await b.gestore(`/installatore/${b.iscritti[0].chi}/chiave`, { method: "POST" })
    ).json();
    assert.equal((await b.retro("/case", {}, detto.chiave)).status, 200);
    assert.equal((await b.retro("/case", {}, vecchia)).status, 401);
  } finally {
    await b.chiudi();
  }
});

test("un installatore non entra nella gestione, e non se ne aggiunge uno da se'", async () => {
  const b = await banco({ installatori: 1 });
  try {
    const sua = b.iscritti[0].chiave;
    assert.equal(
      (
        await fetch(`${b.dove}/gestore/installatori`, {
          headers: { authorization: `Bearer ${sua}` },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${b.dove}/gestore/installatori`, {
          method: "POST",
          headers: { authorization: `Bearer ${sua}`, "content-type": "application/json" },
          body: JSON.stringify({ nome: "me ne apro un altro", soglia: 999 }),
        })
      ).status,
      401,
    );
  } finally {
    await b.chiudi();
  }
});

test("eliminare un installatore porta via anche le sue case", async () => {
  /* Qui c'era la prova della scelta di prima: le case restavano, e siccome
   * nessuno le guardava piu' diventavano un numero — «1 impianto senza piu'
   * nessuno» — che non si poteva ne' aprire ne' riassegnare.
   *
   * Adesso i tasti sono due e le cose sono due. Per la lite con
   * l'installatore c'e' **congela**, che non tocca niente: le sue case restano
   * accese e non si perde una riga (`congela-ed-elimina.test.js`). Elimina
   * vuol dire «questo non c'e' piu'», e fa proprio quello. */
  const b = await banco({ installatori: 1 });
  const rossi = b.iscritti[0];
  try {
    const codice = await unCodice(b);
    await b.deposita(UNA, codice);

    await b.gestore(`/installatore/${rossi.chi}`, { method: "DELETE" });

    /* La chiave dell'installatore non apre piu' niente. */
    assert.equal((await b.retro("/case", {}, rossi.chiave)).status, 401);

    /* E la casa bussa e si sente dire di no: per tornare dentro ci vuole un
     * codice nuovo, di un installatore vivo, incollato da dentro casa. */
    assert.equal((await b.deposita(UNA, codice)).status, 403);

    const detto = await (await b.gestore("/installatori")).json();
    assert.equal(detto.installatori.length, 0);
    assert.equal(detto.case, 0, "la casa e' rimasta dov'era");
    assert.equal(detto.orfane, 0, "resta una casa senza nessuno che la guardi");
  } finally {
    await b.chiudi();
  }
});

test("l'installatore dice dove vuole gli avvisi, e su http non si mandano", async () => {
  /* Nel messaggio c'è il nome che lui ha dato a una casa — l'unica cosa in
   * tutto questo quadro che nomini una persona — e in chiaro lo leggerebbe
   * chiunque stia in mezzo. */
  const b = await banco({ installatori: 1 });
  try {
    const storto = await b.retro("/io/avvisi", {
      method: "PUT",
      body: JSON.stringify({ dove: "http://esempio.it/avvisi" }),
    });
    assert.equal(storto.status, 400);
    assert.match((await storto.json()).errore, /https/);

    await b.retro("/io/avvisi", {
      method: "PUT",
      body: JSON.stringify({ dove: "https://esempio.it/avvisi" }),
    });
    assert.equal((await (await b.retro("/io")).json()).avvisi, "https://esempio.it/avvisi");

    /* Vuoto li spegne, ed è un caso normale. */
    await b.retro("/io/avvisi", { method: "PUT", body: JSON.stringify({ dove: "" }) });
    assert.equal((await (await b.retro("/io")).json()).avvisi, "");
  } finally {
    await b.chiudi();
  }
});

test("un installatore non vede né cambia l'indirizzo degli avvisi di un altro", async () => {
  const b = await banco({ installatori: 2 });
  const [rossi, bianchi] = b.iscritti;
  try {
    await b.retro(
      "/io/avvisi",
      { method: "PUT", body: JSON.stringify({ dove: "https://rossi.it/avvisi" }) },
      rossi.chiave,
    );
    const suoi = await (await b.retro("/io", {}, bianchi.chiave)).json();
    assert.equal(suoi.avvisi, "", "Bianchi vede dove viene avvisato Rossi");
    assert.equal(suoi.nome, "Installatore 2");
  } finally {
    await b.chiudi();
  }
});

test("la risposta al rapporto dice alla casa di chi è il quadro", async () => {
  /* La casa non ha altro modo di saperlo: nel codice che le è stato incollato
   * c'è solo un codice. Serve alla scheda nella console dell'add-on, dove chi
   * ci abita legge a chi vanno i suoi numeri — «Impianti Rossi» gli dice
   * qualcosa, un indirizzo no. */
  const b = await banco({ installatori: 1 });
  try {
    const risposta = await b.deposita(UNA, await unCodice(b));
    assert.deepEqual(await risposta.json(), { presa: true, di: "Installatore 1" });
  } finally {
    await b.chiudi();
  }
});

test("un installatore non può cambiarsi il nome, e quindi non può spacciarsi per un altro", async () => {
  /* È la riga che rende quel nome degno di essere mostrato in casa di
   * qualcuno: lo scrive chi tiene il quadro, e non c'è nessuna via da cui un
   * installatore possa riscriverselo. */
  const b = await banco({ installatori: 1 });
  try {
    for (const [via, corpo] of [
      ["/io", { nome: "Impianti Bianchi" }],
      ["/io/nome", { nome: "Impianti Bianchi" }],
    ]) {
      const provato = await b.retro(via, { method: "PUT", body: JSON.stringify(corpo) });
      assert.ok(provato.status >= 400, `«PUT ${via}» ha lasciato cambiare il nome`);
    }
    const risposta = await b.deposita(UNA, await unCodice(b));
    assert.equal((await risposta.json()).di, "Installatore 1");

    /* Chi tiene il quadro sì, e la casa lo vede al deposito dopo. */
    await b.gestore(`/installatore/${b.iscritti[0].chi}`, {
      method: "PUT",
      body: JSON.stringify({ nome: "Impianti Rossi" }),
    });
    const dopo = await b.deposita(UNA, await unCodice(b));
    assert.equal((await dopo.json()).di, "Impianti Rossi");
  } finally {
    await b.chiudi();
  }
});

test("la pagina di gestione si serve senza chiave, e le sue vie no", async () => {
  /* Servirla dietro autenticazione vorrebbe dire non avere nessun posto dove
   * digitare la chiave. La pagina non mostra niente finché non ce l'ha. */
  const b = await banco({ installatori: 0 });
  try {
    const pagina = await fetch(`${b.dove}/gestore/`);
    assert.equal(pagina.status, 200);
    assert.match(await pagina.text(), /gestione installatori/);

    /* Senza barra ci si viene mandati, se no le vie in relativo si perdono. */
    const senzaBarra = await fetch(`${b.dove}/gestore`, { redirect: "manual" });
    assert.equal(senzaBarra.status, 301);

    /* Ma i dati no. */
    assert.equal((await fetch(`${b.dove}/gestore/installatori`)).status, 401);
  } finally {
    await b.chiudi();
  }
});

test("ogni risposta della gestione porta i totali, non solo l'elenco", async () => {
  /* Una risposta con l'elenco ma senza i totali fa scrivere zero alla pagina:
   * chi ha appena aggiunto un installatore vede «0 impianti in tutto» con le righe che
   * dicono altro. È successo, e questa prova è perché non risucceda. */
  const b = await banco({ installatori: 1 });
  try {
    await b.deposita(UNA, await unCodice(b));

    const dopoOgnuna = [
      await b.gestore("/installatori", { method: "POST", body: JSON.stringify({ nome: "Nuova" }) }),
      await b.gestore(`/installatore/${b.iscritti[0].chi}`, {
        method: "PUT",
        body: JSON.stringify({ soglia: 9 }),
      }),
      await b.gestore("/installatori"),
    ];
    for (const risposta of dopoOgnuna) {
      const detto = await risposta.json();
      assert.equal(detto.case, 1, "i totali mancano da una risposta");
      assert.equal(typeof detto.orfane, "number");
      assert.ok(Array.isArray(detto.installatori));
    }
  } finally {
    await b.chiudi();
  }
});

test("«/salute» dice quando il quadro non riesce piu' ad aggiornarsi", async () => {
  /* La riga che si guarda. Il registro di una macchina che funziona non lo apre
   * nessuno, ed e' li' che un guasto silenzioso resterebbe in silenzio: questa
   * riga invece e' quella che si apre dopo averlo acceso, e quella che si
   * riapre quando si sospetta qualcosa. */
  const b = await banco();
  try {
    const prima = await (await fetch(`${b.dove}/salute`)).json();
    assert.equal("nonMiAggiorno" in prima, false, "lo dice anche quando va tutto bene");

    /* Il foglietto come lo scrive `aggiorna.sh`: epoch in secondi, poi il
     * perche'. Cinque ore fa, cioe' trenta giri di fila andati a vuoto. */
    const cinqueOreFa = Math.floor((Date.now() - 5 * 60 * 60 * 1000) / 1000);
    writeFileSync(
      join(b.cartella, "non-mi-aggiorno"),
      `${cinqueOreFa}\nGitHub non risponde, o il segno non c'e' piu'\n`,
    );

    const dopo = await (await fetch(`${b.dove}/salute`)).json();
    assert.ok(dopo.nonMiAggiorno, "tace anche dopo cinque ore");
    assert.equal(dopo.nonMiAggiorno.ore, 5);
    assert.match(dopo.nonMiAggiorno.perche, /GitHub non risponde/);
    /* E il resto continua a dire quello che diceva: un campo nuovo non deve
     * portarsi via gli altri. */
    assert.equal(dopo.vivo, true);
    assert.equal(dopo.gestore, true);
  } finally {
    await b.chiudi();
  }
});

/* ─── Il secondo verbo: installare da lontano ──────────────────────────── */

const CON_MANUTENZIONE = { ...RAPPORTO, manutenzione: true };
const QUESTO = { nome: "Shelly Plus", da: "1.2.0", a: "1.3.0" };

test("il comando entra in casa dentro la risposta a un rapporto, e una volta sola", async () => {
  /* E' il pezzo che regge tutta la faccenda: verso una casa non c'e' nessuna
   * porta aperta, nessun buco nel router, niente da difendere. E' lei che
   * bussa ogni minuto, e qualche volta chi apre le dice qualcosa. */
  const b = await banco({ installatori: 1 });
  try {
    const chiave = await unCodice(b);
    await b.deposita(UNA, chiave, CON_MANUTENZIONE);

    const chiesto = await b.retro(`/casa/${UNA}/installa`, {
      method: "POST",
      body: JSON.stringify(QUESTO),
    });
    assert.equal(chiesto.status, 200);

    /* Al rapporto dopo se lo porta via. */
    const preso = await (await b.deposita(UNA, chiave, CON_MANUTENZIONE)).json();
    assert.equal(preso.fai.cosa, "installa");
    assert.equal(preso.fai.nome, "Shelly Plus");
    assert.equal(preso.fai.a, "1.3.0");

    /* E a quello dopo ancora non c'e' piu': un tasto premuto una volta non
     * installa due volte. */
    const dopo = await (await b.deposita(UNA, chiave, CON_MANUTENZIONE)).json();
    assert.equal(dopo.fai, undefined);
  } finally {
    await b.chiudi();
  }
});

test("una casa che non ha aperto la manutenzione non riceve nessun comando", async () => {
  /* Il no vero lo dice la casa, in `lavori.js`. Questo e' il no di qui, e
   * serve a non far aspettare dieci minuti una risposta gia' scritta. */
  const b = await banco({ installatori: 1 });
  try {
    const chiave = await unCodice(b);
    await b.deposita(UNA, chiave, RAPPORTO);
    const chiesto = await b.retro(`/casa/${UNA}/installa`, {
      method: "POST",
      body: JSON.stringify(QUESTO),
    });
    assert.equal(chiesto.status, 409);
    const preso = await (await b.deposita(UNA, chiave, RAPPORTO)).json();
    assert.equal(preso.fai, undefined);
  } finally {
    await b.chiudi();
  }
});

test("nessuno fa installare niente a casa di un altro installatore", async () => {
  /* Le matricole si possono scrivere a mano, e questa e' la via che fa
   * succedere qualcosa in casa di qualcuno: e' quella dove un lucchetto
   * dimenticato costa di piu'. */
  const b = await banco({ installatori: 2 });
  try {
    const chiave = await unCodice(b, "", b.iscritti[0].chiave);
    await b.deposita(UNA, chiave, CON_MANUTENZIONE);

    const provato = await b.retro(
      `/casa/${UNA}/installa`,
      { method: "POST", body: JSON.stringify(QUESTO) },
      b.iscritti[1].chiave,
    );
    assert.ok(provato.status >= 400, "un installatore ha fatto installare in casa di un altro");
    const preso = await (await b.deposita(UNA, chiave, CON_MANUTENZIONE)).json();
    assert.equal(preso.fai, undefined);
  } finally {
    await b.chiudi();
  }
});

test("una casa non puo' chiedere niente a se stessa, ne' a nessun'altra", async () => {
  /* La chiave di una casa apre una porta sola. Provarci con la via che
   * installa deve finire come tutte le altre. */
  const b = await banco({ installatori: 1 });
  try {
    const chiave = await unCodice(b);
    await b.deposita(UNA, chiave, CON_MANUTENZIONE);
    const provato = await fetch(`${b.dove}/console/casa/${UNA}/installa`, {
      method: "POST",
      headers: { authorization: `Bearer ${chiave}`, "content-type": "application/json" },
      body: JSON.stringify(QUESTO),
    });
    assert.equal(provato.status, 401);
  } finally {
    await b.chiudi();
  }
});

test("si puo' annullare finche' la casa non e' passata a prenderselo", async () => {
  const b = await banco({ installatori: 1 });
  try {
    const chiave = await unCodice(b);
    await b.deposita(UNA, chiave, CON_MANUTENZIONE);
    await b.retro(`/casa/${UNA}/installa`, { method: "POST", body: JSON.stringify(QUESTO) });
    const tolto = await (await b.retro(`/casa/${UNA}/installa`, { method: "DELETE" })).json();
    assert.equal(tolto.annullato, true);
    const preso = await (await b.deposita(UNA, chiave, CON_MANUTENZIONE)).json();
    assert.equal(preso.fai, undefined);
  } finally {
    await b.chiudi();
  }
});

test("finche' la casa non ha detto com'e' andata non se ne chiede un altro", async () => {
  const b = await banco({ installatori: 1 });
  try {
    const chiave = await unCodice(b);
    await b.deposita(UNA, chiave, CON_MANUTENZIONE);
    await b.retro(`/casa/${UNA}/installa`, { method: "POST", body: JSON.stringify(QUESTO) });
    const secondo = await b.retro(`/casa/${UNA}/installa`, {
      method: "POST",
      body: JSON.stringify({ nome: "Altro", da: "1", a: "2" }),
    });
    assert.equal(secondo.status, 409);
  } finally {
    await b.chiudi();
  }
});
