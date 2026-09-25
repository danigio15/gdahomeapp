/* La soglia: l'indirizzo nudo del centralino.
 *
 * Il tramite ha un indirizzo, e quell'indirizzo la gente lo apre: sta fra i
 * segnalibri, si detta al telefono, si incolla senza il pezzo dopo la barra.
 * Quello che trovava era `{"errore":"qui non c'e' niente"}` — vero, e
 * inservibile: chi lo legge pensa che sia rotto e chiude.
 *
 * Queste prove tengono tre cose, e tutte e tre si rompono per distrazione:
 *
 *  - l'indirizzo nudo **risponde con una pagina**, non con un errore;
 *  - **manda dove si va davvero**, e quello che non sa non se lo inventa: un
 *    centralino di qualcun altro non si chiama gdahome, e scrivergli dentro
 *    gdahome.org sarebbe mandare la sua gente a casa nostra;
 *  - **niente viene da fuori**: e' una pagina servita da una macchina che non
 *    deve andare a prendere niente da nessuno.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { costruisciIlServer } from "../src/server.js";
import { laSoglia, nomePulito } from "../src/soglia.js";

/* Il centralino qui non serve: la soglia non gli chiede niente. Quello che
 * serve e' che `/salute` risponda, per la prova che guarda le altre vie. */
const centralinoFinto = {
  quanteCase: () => 0,
  quantiCollegamenti: () => 0,
  quanteAppAperte: () => 0,
};

async function banco(dove = {}) {
  const server = costruisciIlServer({ centralino: centralinoFinto, dove });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    http: `http://127.0.0.1:${server.address().port}`,
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

test("l'indirizzo nudo risponde con una pagina, non con un errore", async () => {
  const b = await banco({ sito: "gdahome.org", app: "webapp.gdahome.org" });
  try {
    const detta = await fetch(`${b.http}/`);
    assert.equal(detta.status, 200);
    assert.match(detta.headers.get("content-type") || "", /^text\/html/);
    const pagina = await detta.text();
    assert.match(pagina, /<title>[^<]+<\/title>/);
    assert.doesNotMatch(pagina, /qui non c'e' niente/);
  } finally {
    await b.spegni();
  }
});

test("manda dove si va davvero: il sito, l'app, la console", async () => {
  const b = await banco({ sito: "gdahome.org", app: "webapp.gdahome.org" });
  try {
    const pagina = await (await fetch(`${b.http}/`)).text();
    assert.match(pagina, /href="https:\/\/gdahome\.org"/);
    assert.match(pagina, /href="https:\/\/webapp\.gdahome\.org"/);
    /* La console e' la ragione per cui quell'indirizzo sta fra i segnalibri:
     * e' da li' che si risponde a chi chiede aiuto. */
    assert.match(pagina, /href="\/console\/"/);
  } finally {
    await b.spegni();
  }
});

test("quello che non sa non se lo inventa", () => {
  /* Il centralino di qualcun altro non ha un sito, e non ha la nostra app. */
  const nuda = laSoglia();
  assert.doesNotMatch(nuda, /gdahome\.org/);
  assert.doesNotMatch(nuda, /Apri gdahome/);
  /* Ma la porta c'e' comunque, e dice cos'e' questa macchina. */
  assert.match(nuda, /<title>[^<]+<\/title>/);
  assert.match(nuda, /href="\/console\/"/);

  /* E un solo nome dei due basta: si scrive quello, non l'altro. */
  const mezza = laSoglia({ app: "app.casadimario.it" });
  assert.match(mezza, /href="https:\/\/app\.casadimario\.it"/);
  assert.doesNotMatch(mezza, /gdahome\.org/);
});

test("un indirizzo che non e' un indirizzo non finisce nella pagina", () => {
  /* I due nomi arrivano da un file di configurazione, e un `href` e' un posto
   * dove si va: una riga sbagliata si butta qui, non si scopre nel browser di
   * qualcun altro. */
  assert.equal(nomePulito("javascript:alert(1)"), "");
  assert.equal(nomePulito('gdahome.org" onload="x'), "");
  assert.equal(nomePulito("mica un indirizzo"), "");
  assert.equal(nomePulito(""), "");
  /* E quelli buoni passano, anche scritti come li scrive una persona. */
  assert.equal(nomePulito("https://webapp.gdahome.org/"), "webapp.gdahome.org");
  assert.equal(nomePulito(" GDAhome.org "), "gdahome.org");

  const pagina = laSoglia({ sito: "javascript:alert(1)", app: "gdahome.org" });
  assert.doesNotMatch(pagina, /javascript:/);
});

test("niente viene da fuori: nessun carattere, nessuna libreria, nessun contatore", () => {
  const pagina = laSoglia({ sito: "gdahome.org", app: "webapp.gdahome.org" });
  for (const riga of pagina.split("\n")) {
    /* I collegamenti su cui si clicca portano via: sono un'altra cosa da
     * quello che il browser va a prendere da solo. */
    if (/<a\s/.test(riga)) continue;
    const preso = riga.match(/(?:src|href)="(https?:)?\/\/[^"]+"/g);
    assert.equal(preso, null, `la soglia si porta dentro una cosa da fuori: ${preso?.[0]}`);
  }
});

test("le altre vie non cambiano: salute risponde, e altrove non c'e' niente", async () => {
  const b = await banco({ sito: "gdahome.org" });
  try {
    const salute = await fetch(`${b.http}/salute`);
    assert.equal(salute.status, 200);
    assert.equal((await salute.json()).vivo, true);

    /* La soglia e' una via sola: non si mette a rispondere per tutto il resto,
     * perche' un 404 vero e' quello che dice a un programma che ha sbagliato
     * indirizzo. */
    const altrove = await fetch(`${b.http}/qualcosa/che/non/c/e`);
    assert.equal(altrove.status, 404);
    assert.match(altrove.headers.get("content-type") || "", /^application\/json/);
  } finally {
    await b.spegni();
  }
});

test("anche a testa in giu': curl -I trova la pagina e non un errore", async () => {
  /* `curl -sSI https://tramite.gdahome.org` e' la prima cosa che si fa per
   * vedere se un indirizzo risponde. */
  const b = await banco({ app: "webapp.gdahome.org" });
  try {
    const detta = await fetch(`${b.http}/`, { method: "HEAD" });
    assert.equal(detta.status, 200);
    assert.match(detta.headers.get("content-type") || "", /^text\/html/);
    assert.ok(Number(detta.headers.get("content-length")) > 500);
    assert.equal(await detta.text(), "");
  } finally {
    await b.spegni();
  }
});
