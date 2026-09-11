/* Lo sportello, provato dalla parte da cui lo usa il ponte: bussando.
 *
 * Le regole che contano qui non sono quelle delle segnalazioni — quelle hanno
 * le loro prove nella nuvola, e il file e' lo stesso — ma quelle della
 * **porta**: chi entra, chi no, e cosa risponde a chi sbaglia. Sono le tre
 * cose che, se si rompono, si rompono in silenzio: una porta troppo aperta non
 * da' nessun errore a nessuno.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Case } from "../src/case.js";
import { costruisciIlServer } from "../src/server.js";
import { Sportello } from "../src/sportello.js";

const CASA = `casa_${"a1b2c3d4".repeat(4)}`;
const SEGRETO = "9".repeat(64);

/* Il centralino vero qui non serve: lo sportello non lo tocca, e il server gli
 * chiede solo quanti sono per scriverlo in `/salute`. */
const centralinoFinto = { quanteCase: () => 1, quantiTelefoni: () => 0 };

/* GitHub finto: tiene quello che gli e' stato chiesto, e risponde come
 * risponderebbe quello vero alle sole chiamate che facciamo. */
function gitHubFinto() {
  const chiamate = [];
  const prendi = async (indirizzo, opzioni = {}) => {
    const metodo = opzioni.method || "GET";
    chiamate.push({
      indirizzo: String(indirizzo),
      metodo,
      corpo: opzioni.body ? JSON.parse(opzioni.body) : null,
    });
    if (metodo === "POST" && String(indirizzo).endsWith("/issues")) {
      return new Response(
        JSON.stringify({
          number: 7,
          html_url: "https://github.esempio/7",
          created_at: "2026-01-01T00:00:00Z",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ message: "non previsto" }), { status: 404 });
  };
  return { prendi, chiamate };
}

/* Una macchina intera, alzata su una porta a caso e spenta alla fine. */
async function banco({ gettone = "gettone-finto", repo = "tizio/cose" } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "sportello-"));
  const case_ = new Case({ cartella });
  const github = gitHubFinto();
  const sportello = new Sportello({
    case: case_,
    cartella,
    gettone,
    repo,
    fetch: github.prendi,
  });
  const server = costruisciIlServer({ centralino: centralinoFinto, sportello });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    case: case_,
    github,
    base,
    /* Come bussa il ponte: `Casa <segreto>` e niente altro. */
    bussa(via, { segreto = SEGRETO, metodo = "GET", corpo, intestazioni = {} } = {}) {
      return fetch(`${base}${via}`, {
        method: metodo,
        headers: {
          ...(segreto ? { authorization: `Casa ${segreto}` } : {}),
          ...(corpo ? { "content-type": "application/json" } : {}),
          ...intestazioni,
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    },
    async spegni() {
      await new Promise((ok) => server.close(ok));
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("senza segreto non si entra", async () => {
  const b = await banco();
  try {
    const risposta = await b.bussa(`/casa/${CASA}/segnalazioni`, { segreto: "" });
    assert.equal(risposta.status, 401);
    assert.equal((await risposta.json()).errore, "senza_segreto");
  } finally {
    await b.spegni();
  }
});

test("una casa che non si e' mai collegata non entra, e non nasce", async () => {
  const b = await banco();
  try {
    const risposta = await b.bussa(`/casa/${CASA}/segnalazioni`);
    assert.equal(risposta.status, 403);
    assert.equal((await risposta.json()).errore, "non_ti_riconosco");
    /* La cosa che conta: bussare allo sportello non l'ha fatta nascere. */
    assert.equal(b.case.quante(), 0);
  } finally {
    await b.spegni();
  }
});

test("col segreto sbagliato non si entra nemmeno", async () => {
  const b = await banco();
  b.case.riconosci(CASA, SEGRETO);
  try {
    const risposta = await b.bussa(`/casa/${CASA}/segnalazioni`, { segreto: "8".repeat(64) });
    assert.equal(risposta.status, 403);
  } finally {
    await b.spegni();
  }
});

test("la casa collegata legge il suo elenco, che all'inizio e' vuoto", async () => {
  const b = await banco();
  b.case.riconosci(CASA, SEGRETO);
  try {
    const risposta = await b.bussa(`/casa/${CASA}/segnalazioni`);
    assert.equal(risposta.status, 200);
    assert.deepEqual(await risposta.json(), { segnalazioni: [] });
  } finally {
    await b.spegni();
  }
});

test("apre una segnalazione, e la ritrova nell'elenco anche dopo", async () => {
  const b = await banco();
  b.case.riconosci(CASA, SEGRETO);
  try {
    const aperta = await b.bussa(`/casa/${CASA}/segnalazioni`, {
      metodo: "POST",
      corpo: { tipo: "problema", titolo: "La luce non si spegne", corpo: "Da ieri sera." },
    });
    assert.equal(aperta.status, 201);
    const detta = await aperta.json();
    assert.equal(detta.numero, 7);
    assert.equal(detta.stato, "aperta");

    /* E' arrivata a GitHub come una issue, col titolo e l'etichetta. */
    const scrittura = b.github.chiamate.find((una) => una.metodo === "POST");
    assert.match(scrittura.corpo.title, /^\[problema\] La luce non si spegne$/);
    assert.deepEqual(scrittura.corpo.labels, ["gdahome", "problema"]);

    /* E resta scritta: l'elenco la ritrova senza richiamare GitHub. */
    const elenco = await (await b.bussa(`/casa/${CASA}/segnalazioni`)).json();
    assert.equal(elenco.segnalazioni.length, 1);
    assert.equal(elenco.segnalazioni[0].numero, 7);
  } finally {
    await b.spegni();
  }
});

test("una segnalazione di un'altra casa non si legge", async () => {
  const b = await banco();
  b.case.riconosci(CASA, SEGRETO);
  try {
    const risposta = await b.bussa(`/casa/${CASA}/segnalazioni/99`);
    assert.equal(risposta.status, 404);
    assert.equal((await risposta.json()).errore, "non_trovata");
  } finally {
    await b.spegni();
  }
});

test("senza gettone lo sportello lo dice, invece di far finta", async () => {
  const b = await banco({ gettone: "" });
  b.case.riconosci(CASA, SEGRETO);
  try {
    const risposta = await b.bussa(`/casa/${CASA}/segnalazioni`, {
      metodo: "POST",
      corpo: { titolo: "Cosa", corpo: "Qualcosa" },
    });
    assert.equal(risposta.status, 503);
    assert.equal((await risposta.json()).errore, "non_configurate");
    assert.equal(b.github.chiamate.length, 0);
  } finally {
    await b.spegni();
  }
});

test("/salute dice da quanto e' acceso e se le segnalazioni sono accese", async () => {
  const b = await banco();
  try {
    const detto = await (await fetch(`${b.base}/salute`)).json();
    assert.equal(detto.vivo, true);
    assert.equal(detto.segnalazioni, true);
    assert.ok(Number.isFinite(detto.acceso_da));
  } finally {
    await b.spegni();
  }

  const spento = await banco({ gettone: "" });
  try {
    const detto = await (await fetch(`${spento.base}/salute`)).json();
    assert.equal(detto.segnalazioni, false);
  } finally {
    await spento.spegni();
  }
});

test("una via che non esiste resta un 404, non un errore", async () => {
  const b = await banco();
  try {
    const risposta = await fetch(`${b.base}/qualunque/cosa`);
    assert.equal(risposta.status, 404);
    assert.equal(risposta.headers.get("content-type"), "application/json; charset=utf-8");
  } finally {
    await b.spegni();
  }
});
