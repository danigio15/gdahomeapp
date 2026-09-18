/* Le prove del quadro, col server vero acceso.
 *
 * Quello che si prova, e in quest'ordine di importanza:
 *
 *  1. **che due installatori non si vedano.** Adesso il quadro e' uno solo e
 *     sta su una macchina di gdahome, con dentro le case di ditte diverse che
 *     fra loro si fanno concorrenza: i clienti di Rossi non sono affari di
 *     Bianchi. E' la riga che regge tutto quanto il resto;
 *  2. **che una casa non possa leggere nessuna console.** La chiave di una
 *     casa apre una porta sola — depositare la propria cartolina — e non fa
 *     vedere niente;
 *  3. **che un codice usato non serva a nessun'altra casa**, che e' cosa vuol
 *     dire «si brucia»;
 *  4. **che il tetto sia un tetto.** Qui il limite lo impone il server di chi
 *     lo decide, non un controllo dentro un programma che gira su una macchina
 *     altrui: quando conta, conta davvero;
 *  5. che quello che una cartolina non dice resti «non si sa» invece di
 *     diventare una spunta rossa;
 *  6. che la matricola che conta sia quella verificata, non quella scritta nel
 *     corpo da chi manda.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";

const CARTOLINA = {
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

async function banco({ ditte = 1, soglia = 0 } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;

  /* Lo sgabuzzino: chi tiene il quadro. */
  const gestore = (via, opzioni = {}) =>
    fetch(`${dove}/gestore${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${CHIAVE_DEL_GESTORE}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });

  /* Le ditte iscritte prima che la prova cominci. Ognuna riceve la sua chiave
   * una volta sola, come nella vita. */
  const conti = [];
  for (let n = 0; n < ditte; n += 1) {
    const detto = await (
      await gestore("/installatori", {
        method: "POST",
        body: JSON.stringify({ nome: `Ditta ${n + 1}`, soglia }),
      })
    ).json();
    conti.push(detto);
  }

  return {
    ...acceso,
    dove,
    gestore,
    conti,
    /* Il retro: si bussa con la chiave di **una** ditta, la prima se non si
     * dice altro. */
    retro: (via, opzioni = {}, chiave = conti[0]?.chiave) =>
      fetch(`${dove}/console${via}`, {
        ...opzioni,
        headers: {
          authorization: `Bearer ${chiave}`,
          "content-type": "application/json",
          ...(opzioni.headers || {}),
        },
      }),
    /* Il davanti: una casa che deposita. */
    deposita: (casa, chiave, carta = CARTOLINA) =>
      fetch(`${dove}/cartolina`, {
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
     * sono di clienti di qualcun altro. Nemmeno lo sgabuzzino. */
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
      "lo sgabuzzino si e' aperto con la chiave di una casa",
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

test("una casa nuova nasce depositando, senza nome e in fila «collaudo aperto»", async () => {
  const b = await banco();
  try {
    await b.deposita(UNA, await unCodice(b, "Villa Aurora"));
    const { case: case_ } = await (await b.retro("/case")).json();
    assert.equal(case_.length, 1);
    assert.equal(case_[0].casa, UNA);
    assert.equal(case_[0].senzaNome, true);
    /* La prima cartolina di questa casa ha tutte le spunte a posto, quindi il
     * collaudo si chiude subito: e' giusto, l'impianto e' finito. */
    assert.equal(case_[0].stato.chiave, "posto");
    assert.ok(case_[0].collaudataIl);

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

test("quello che una cartolina non dice resta «non si sa», e non diventa rosso", async () => {
  const b = await banco();
  try {
    /* Una casa senza Supervisor e con Home Assistant giu': mezza cartolina. */
    await b.deposita(UNA, await unCodice(b), {
      quando: new Date().toISOString(),
      ogni: 15,
      ponte: "1.4.32.15",
    });
    const { case: case_ } = await (await b.retro("/case")).json();
    const collaudo = case_[0].collaudo;
    assert.equal(collaudo.aperte, 0, "niente e' «va male»");
    assert.equal(collaudo.fatte, 0, "e niente e' «a posto»");
    assert.equal(collaudo.ignote, collaudo.quante, "e' tutto «questa casa non lo dice»");
    /* E siccome nessuna spunta e' aperta, questa casa e' consegnabile: non
     * resta in fila per un dato che non e' suo. */
    assert.ok(case_[0].collaudataIl);
  } finally {
    await b.chiudi();
  }
});

test("la matricola che conta e' quella verificata, non quella scritta nel corpo", async () => {
  const b = await banco();
  try {
    await b.deposita(UNA, await unCodice(b), { ...CARTOLINA, casa: ALTRA });
    const { case: case_ } = await (await b.retro("/case")).json();
    assert.equal(case_.length, 1);
    assert.equal(case_[0].casa, UNA);
    assert.equal(case_[0].carta.casa, UNA, "la matricola del corpo si riscrive");
  } finally {
    await b.chiudi();
  }
});

test("una matricola storta non entra, e una cartolina che non e' JSON nemmeno", async () => {
  const b = await banco();
  try {
    const codice = await unCodice(b);
    assert.equal((await b.deposita("non-una-matricola", codice)).status, 400);
    const storta = await fetch(`${b.dove}/cartolina`, {
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
    /* E senza buttare anche la chiave, la prima cartolina la farebbe rinascere
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

/* ─── Due ditte sullo stesso quadro ───────────────────────────────────── */

test("due installatori sullo stesso quadro non si vedono", async () => {
  /* La riga che regge tutto. Il quadro e' uno solo e sta su una macchina di
   * gdahome: dentro ci sono le case di ditte che fra loro si fanno
   * concorrenza, e un elenco che le mescolasse consegnerebbe a ognuna la
   * clientela dell'altra. */
  const b = await banco({ ditte: 2 });
  const [rossi, bianchi] = b.conti;
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

test("la casa di un altro non si rinomina e non si toglie, nemmeno sapendone la matricola", async () => {
  /* Le matricole non sono segrete — passano in chiaro nelle intestazioni — e
   * quindi l'appartenenza dev'essere un lucchetto sulla via, non un filtro
   * sull'elenco. */
  const b = await banco({ ditte: 2 });
  const [rossi, bianchi] = b.conti;
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

test("il tetto e' un tetto: al limite non esce nessun codice nuovo", async () => {
  /* Qui il limite lo impone il server di chi lo decide, non un controllo dentro
   * un programma che gira su una macchina altrui. E' la differenza fra un no e
   * un dosso. */
  const b = await banco({ ditte: 1, soglia: 1 });
  try {
    await b.deposita(UNA, await unCodice(b));

    const ancora = await b.retro("/inviti", { method: "POST", body: JSON.stringify({}) });
    assert.equal(ancora.status, 409);
    assert.match((await ancora.json()).errore, /arriva a 1 case/);

    /* Chi tiene il quadro alza il tetto, e il codice esce. */
    await b.gestore(`/installatore/${b.conti[0].chi}`, {
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

test("gli inviti aperti contano nel tetto, se no si fa il pieno in un minuto", async () => {
  /* Senza questa riga si generano venti codici mentre si e' sotto il tetto, e
   * il giorno dopo ci sono venti case oltre, tutte legittime. */
  const b = await banco({ ditte: 1, soglia: 2 });
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
  /* Il conto e' suo, l'elenco no: sa che quella ditta ne segue due, non chi
   * sono. Un elenco di nomi di clienti di ditte terze e' un'altra cosa, e piu'
   * pesante, che contare licenze. */
  const b = await banco({ ditte: 2 });
  const [rossi] = b.conti;
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
    assert.equal(suo.nome, "Ditta 1");
    for (const parola of ["Verdi", "Rossi —", UNA]) {
      assert.ok(!scritto.includes(parola), `«${parola}» e' arrivata a chi tiene il quadro`);
    }
  } finally {
    await b.chiudi();
  }
});

test("una chiave rifatta apre, e quella di prima no", async () => {
  const b = await banco({ ditte: 1 });
  const vecchia = b.conti[0].chiave;
  try {
    assert.equal((await b.retro("/case", {}, vecchia)).status, 200);
    const detto = await (
      await b.gestore(`/installatore/${b.conti[0].chi}/chiave`, { method: "POST" })
    ).json();
    assert.equal((await b.retro("/case", {}, detto.chiave)).status, 200);
    assert.equal((await b.retro("/case", {}, vecchia)).status, 401);
  } finally {
    await b.chiudi();
  }
});

test("un installatore non entra nello sgabuzzino, e non si apre un conto da se'", async () => {
  const b = await banco({ ditte: 1 });
  try {
    const sua = b.conti[0].chiave;
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
