/* «Casa 3D»: resta aperta anche su un tablet debole.
 *
 * «Quando provo ad aprire la casa 3D inizia a caricare, per un attimo si vede
 * la foto del palazzo e poi diventa tutto nero.» Da un tablet Android a muro,
 * dentro l'app. Le cose che lo facevano, e che qui restano chiuse:
 *
 *   · la licenza. La domanda al ponte partiva prima dell'`auth_ok`, la
 *     cucitura dell'app la buttava, e dopo otto secondi di silenzio la
 *     risposta era «Base»: la Casa 3D, aperta col ricordo del tablet, si
 *     toglieva e lasciava sotto la sua plancia vuota. Adesso la domanda si
 *     rimanda all'`auth_ok`, e un «non lo so» vale il ricordo, mai un «no»;
 *   · la memoria grafica. La tela chiedeva fino a due pixel per punto con
 *     l'antialias e un'ombra da 2048: su uno schermo grande, oltre cento
 *     megabyte. Adesso si chiede quanto lo schermo e la memoria reggono;
 *   · il disegno che cade (`webglcontextlost`): si aspetta che torni, se no
 *     si rifa' la scena piu' leggera, e dopo qualche caduta lo si dice con un
 *     tasto per riprovare, invece di restare neri.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ATTESA_DEL_RITORNO_MS,
  CADUTE_AL_MASSIMO,
  FINESTRA_DELLE_CADUTE_MS,
  PIXEL_AL_MASSIMO,
  cosaFareDopoLaCaduta,
  memoriaDelDispositivo,
  qualitaDellaCasa3D,
} from "../src/core/la-qualita-della-casa-3d.js";
import { premiumSenzaRisposta } from "../src/core/plancia-a-muro.js";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

/* La tela della Casa 3D su un tablet 1280×800 in orizzontale, con le fasce
 * ai lati chiuse: quasi tutto lo schermo. */
const TABLET = { larghezza: 1250, altezza: 660 };

test("un telefono tiene i suoi due pixel per punto, e mai piu' di due", () => {
  const q = qualitaDellaCasa3D({ dpr: 3, larghezza: 390, altezza: 520, memoria: 6 });
  assert.equal(q.pixel, 2);
  assert.equal(q.antialias, true);
  assert.equal(q.ombra, 2048);
  /* due e' il tetto di sempre: per un telefono non e' una rinuncia */
  assert.equal(q.leggera, false);
});

test("su uno schermo grande uno e mezzo: a un metro dal muro non si distingue", () => {
  const q = qualitaDellaCasa3D({ dpr: 2, ...TABLET, memoria: 4 });
  assert.equal(q.pixel, 1.5);
  assert.equal(q.antialias, true);
  assert.ok(TABLET.larghezza * TABLET.altezza * q.pixel ** 2 <= PIXEL_AL_MASSIMO);
});

test("con poca memoria un pixel per punto, senza antialias, l'ombra piu' piccola", () => {
  const q = qualitaDellaCasa3D({ dpr: 2, ...TABLET, memoria: 2 });
  assert.deepEqual(q, {
    pixel: 1,
    antialias: false,
    ombra: 1024,
    leggera: true,
    semplice: false,
    tela: 2048,
  });
  assert.equal(qualitaDellaCasa3D({ dpr: 1.5, larghezza: 360, altezza: 500, memoria: 1 }).pixel, 1);
});

test("il tetto dei pixel veri: si scende fino a uno, non sotto", () => {
  /* una tela grande su un dispositivo che non dice molta memoria: fra uno e
   * uno e mezzo, quanto sta sotto il tetto */
  const grande = qualitaDellaCasa3D({ dpr: 2, larghezza: 1500, altezza: 1000, memoria: 4 });
  assert.ok(grande.pixel > 1 && grande.pixel < 1.5, String(grande.pixel));
  assert.ok(1500 * 1000 * grande.pixel ** 2 <= PIXEL_AL_MASSIMO * 1.01);
  /* oltre il tetto gia' a uno: si resta a uno */
  assert.equal(qualitaDellaCasa3D({ dpr: 2, larghezza: 2400, altezza: 1300, memoria: 4 }).pixel, 1);
  const enorme = qualitaDellaCasa3D({ dpr: 1, larghezza: 3800, altezza: 2000, memoria: 8 });
  assert.equal(enorme.pixel, 1, "sotto uno la casa si sgrana");
  /* chi ha uno schermo sotto uno, lo tiene */
  assert.equal(qualitaDellaCasa3D({ dpr: 0.75, larghezza: 800, altezza: 600 }).pixel, 0.75);
});

test("un computer potente non perde niente", () => {
  const q = qualitaDellaCasa3D({ dpr: 1, larghezza: 1400, altezza: 800, memoria: 8 });
  assert.deepEqual(q, {
    pixel: 1,
    antialias: true,
    ombra: 2048,
    leggera: false,
    semplice: false,
    tela: 2048,
  });
  /* un portatile retina: uno e mezzo e l'antialias, come un tablet */
  const retina = qualitaDellaCasa3D({ dpr: 2, larghezza: 1100, altezza: 700, memoria: 8 });
  assert.equal(retina.pixel, 1.5);
  assert.equal(retina.antialias, true);
});

test("dopo ogni caduta del disegno un gradino piu' in basso", () => {
  const prima = qualitaDellaCasa3D({ dpr: 2, ...TABLET, memoria: 8, cadute: 0 });
  const una = qualitaDellaCasa3D({ dpr: 2, ...TABLET, memoria: 8, cadute: 1 });
  const due = qualitaDellaCasa3D({ dpr: 2, ...TABLET, memoria: 8, cadute: 2 });
  assert.equal(prima.pixel, 1.5);
  assert.deepEqual(una, {
    pixel: 1,
    antialias: false,
    ombra: 1024,
    leggera: true,
    semplice: false,
    tela: 1024,
  });
  assert.equal(due.ombra, 512);
  /* dopo due cadute anche i materiali si fanno semplici */
  assert.equal(due.semplice, true);
});

test("numeri storti o mancanti non rompono niente", () => {
  for (const dati of [undefined, {}, { dpr: NaN }, { dpr: -1, larghezza: -5 }, { dpr: "2" }]) {
    const q = qualitaDellaCasa3D(dati);
    assert.ok(Number.isFinite(q.pixel) && q.pixel > 0 && q.pixel <= 2, JSON.stringify(dati));
    assert.equal(typeof q.antialias, "boolean");
  }
  assert.equal(memoriaDelDispositivo({ deviceMemory: 2 }), 2);
  assert.equal(memoriaDelDispositivo({}), null);
  assert.equal(memoriaDelDispositivo(null), null);
  assert.equal(memoriaDelDispositivo({ deviceMemory: "4" }), null);
});

test("il disegno caduto: si riprova qualche volta, poi si smette e lo si dice", () => {
  const ora = 10 * 60 * 1000;
  let cadute = [];
  for (let i = 0; i < CADUTE_AL_MASSIMO; i++) {
    const esito = cosaFareDopoLaCaduta(cadute, ora + i * 1000);
    assert.equal(esito.azione, "riprova", `caduta ${i + 1}`);
    cadute = esito.cadute;
  }
  assert.equal(cadute.length, CADUTE_AL_MASSIMO);
  const basta = cosaFareDopoLaCaduta(cadute, ora + 5000);
  assert.equal(basta.azione, "basta");
  /* quelle vecchie escono dalla finestra: un tablet caduto ieri riprova */
  const dopo = cosaFareDopoLaCaduta(basta.cadute, ora + 5000 + FINESTRA_DELLE_CADUTE_MS);
  assert.equal(dopo.azione, "riprova");
  assert.deepEqual(dopo.cadute, [ora + 5000 + FINESTRA_DELLE_CADUTE_MS]);
  /* roba strana nel ricordo non conta */
  assert.equal(cosaFareDopoLaCaduta([NaN, "x", null], ora).cadute.length, 1);
  assert.ok(ATTESA_DEL_RITORNO_MS >= 1000 && ATTESA_DEL_RITORNO_MS <= 5000);
});

test("la licenza senza risposta vale quello che si sapeva, mai un «no»", () => {
  assert.equal(premiumSenzaRisposta(null, true), true, "il ricordo del tablet");
  assert.equal(premiumSenzaRisposta(null, undefined), false);
  assert.equal(premiumSenzaRisposta(null, false), false);
  assert.equal(
    premiumSenzaRisposta(true, false),
    true,
    "la risposta di questa pagina vale di piu'",
  );
  assert.equal(premiumSenzaRisposta(false, true), false);
});

test("la domanda della licenza si rimanda all'auth_ok, e un errore non la spegne", () => {
  const muro = leggi("../src/sections/plancia-a-muro-section.js");
  const domanda = muro.slice(muro.indexOf("async function chiediIlPremium"));
  const corpo = domanda.slice(0, domanda.indexOf("\n}\n"));
  assert.match(corpo, /bridgeRequest\("ponte\/licenza\/stato", \{\}, \{ rimanda: true \}\)/);
  assert.match(corpo, /premiumSenzaRisposta\(state\.premium, ricordo\(\)\.premium\)/);
  assert.doesNotMatch(corpo, /return state\.premium === true;/);
  const persistenza = leggi("../src/sections/config-persistence-section.js");
  assert.match(persistenza, /bridgeRequest\(SHARED_GET, sharedPayload\(\), \{ rimanda: true \}\)/);
});

test("le scene chiedono la qualita' giusta e restituiscono il disegno uscendo", () => {
  for (const file of [
    "../src/sections/casa-3d/scena.js",
    "../src/sections/casa-3d/scena-modello.js",
  ]) {
    const sorgente = leggi(file);
    assert.match(sorgente, /qualitaDellaCasa3D\(/, file);
    assert.doesNotMatch(sorgente, /setPixelRatio\(Math\.min\(2, window\.devicePixelRatio/, file);
    assert.doesNotMatch(sorgente, /mapSize\.set\(2048, 2048\)/, file);
    assert.match(sorgente, /forceContextLoss\(\)/, file);
    assert.match(sorgente, /webglcontextlost/, file);
  }
  const scena = leggi("../src/sections/casa-3d/scena.js");
  assert.match(scena, /webglcontextrestored/);
  const sezione = leggi("../src/sections/casa-3d-section.js");
  assert.match(sezione, /quandoCade: scenaCaduta/);
  assert.match(sezione, /data-c3s="riprova"/);
});
