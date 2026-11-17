/* La pianta dal PDF vettoriale: «la gente carica i PDF e la casa 3D esce
 * sballata».
 *
 * Il PDF dell'architetto (una tavola A3 a 1:50) passava per la strada della
 * foto: la pagina disegnata e i muri cercati a occhio, con dentro le quote,
 * il cartiglio, le righe delle altre unita'; e senza testo (le scritte
 * diventate disegno) la scala non si trovava. Qui una tavola finta, fatta
 * come quelle vere e con nomi inventati, scritta a mano in PDF: muri a
 * contorno con il retino, tramezzi, porte ad arco tratteggiate, finestre, un
 * balcone col parapetto, l'ascensore (il riquadro con le diagonali), le
 * altre unita' a tratto e punto, le scale, le quote con le tacche, il
 * cartiglio, il titolo con «scala 1:50» e i nomi delle stanze coi metri
 * quadri. Passa per pdf.js (quello della plancia) e per la stessa strada
 * della procedura, e si pretende la casa giusta. */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  piantaDalPdf,
  porteDelDisegno,
  senzaIMuriDeiVani,
  stanzeDalPdf,
  tavolaDalPdf,
  tracciatiDellaPagina,
  unisciLeStanze,
} from "../src/core/pianta-da-pdf.js";
import { letteraDelModello, leggiLeScritte } from "../src/core/scritte-disegnate.js";
import { AREE_DELLA_TAVOLA as ATTESE, tavolaFinta as tavola } from "./helpers/tavola-finta-pdf.js";
import { PASSO, grigliaDallaFoto, riconosciDaFoto } from "../src/core/pianta-da-foto.js";
import { nomiDalleScritte } from "../src/core/pianta-da-dwg.js";
import { pianoDaRiconoscimento } from "../src/core/crea-casa.js";
import { CELLA, espandiGriglia } from "../src/core/casa-3d.js";

const QUI = path.dirname(fileURLToPath(import.meta.url));
const PDFJS = path.join(QUI, "../legacy/vendor/pdfjs");

/* ── la stessa strada della procedura ────────────────────────────────── */

let pdfjs = null;
async function caricaPdfjs() {
  if (pdfjs) return pdfjs;
  const avvisa = console.log;
  console.log = () => {}; // «usa la build legacy in Node»: qui va bene cosi'
  try {
    pdfjs = await import(path.join(PDFJS, "pdf.min.js"));
  } finally {
    console.log = avvisa;
  }
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(PDFJS, "pdf.worker.min.js");
  return pdfjs;
}

async function leggiIlPdf(dati) {
  const lib = await caricaPdfjs();
  const documento = await lib.getDocument({ data: dati, verbosity: 0 }).promise;
  const pagina = await documento.getPage(1);
  const uno = pagina.getViewport({ scale: 1 });
  const testo = await pagina.getTextContent();
  const scritte = testo.items
    .filter((i) => String(i.str || "").trim())
    .map((i) => {
      const m = lib.Util.transform(uno.transform, i.transform);
      return {
        t: i.str,
        x: m[4],
        y: m[5],
        h: Math.hypot(m[2], m[3]) || 8,
        w: Number(i.width) || 0,
      };
    });
  const { tratti } = tracciatiDellaPagina(await pagina.getOperatorList(), lib.OPS, uno.transform);
  await documento.destroy();
  return { tratti, scritte };
}

/* il PDF letto e capito, come fa la procedura */
async function pianta(opzioni) {
  const letto = await leggiIlPdf(tavola(opzioni));
  return piantaDalPdf(letto, { scritte: letto.scritte });
}

/* come `riconosci` e `ricalcola` nella procedura (casa-3d-crea-section.js) */
function riconosci(piano, mpp = null) {
  const tav = tavolaDalPdf(piano);
  const m = mpp || tav.mpp;
  const griglia = grigliaDallaFoto(tav.im, m, {
    vetri: tav.vetri,
    porte: null,
    disegno: true,
    pianoDaFoto: false,
  });
  griglia.pieni = true;
  let casa = riconosciDaFoto(griglia, { squadra: false });
  casa = porteDelDisegno(casa, tav, m);
  const lato = PASSO / m;
  casa = unisciLeStanze(casa, stanzeDalPdf(casa, tav, lato).balconi, griglia.barriera);
  const nomi = nomiDalleScritte(casa, tav.etichette, lato);
  const info = stanzeDalPdf(casa, tav, lato, nomi);
  return { tav, casa, nomi, info, mpp: m };
}

function stanzaDi(r, nome) {
  return r.casa.stanze.find((s) => String(r.nomi[s.id] || "").toLowerCase() === nome.toLowerCase());
}

test("la tavola A3 a 1:50: la scala scritta, i muri dalla penna toccata dal retino", async () => {
  const piano = await pianta();
  assert.ok(piano?.muri, "i muri del disegno si riconoscono");
  assert.equal(piano.scala, 50);
  assert.equal(piano.scalaDa, "scritta");
  assert.equal(piano.sicuro, true);
  /* le porte e i tramezzi dicono la stessa scala */
  assert.equal(piano.indizi.porte, 50);
  assert.equal(piano.indizi.muri, 50);
  /* e anche le quote scritte: «5.70» sopra un tratto lungo 5,70 m */
  assert.equal(piano.indizi.quote, 50);
  assert.equal(piano.indizi.coppieDiQuote, 3);
  assert.deepEqual(piano.penne.muri, ["S|0.84|0,0,0|"]);
  assert.deepEqual(piano.penne.retino, ["S|0.24|153,153,153|"]);
  /* le quote (e il cartiglio, con la stessa penna) non sono muri */
  assert.deepEqual(piano.penne.quote, ["S|0.24|84,84,84|"]);
  /* la casa sta nel suo riquadro: il cartiglio (sotto i 1000 punti) fuori */
  assert.ok(piano.riquadro.y1 < 1000, `riquadro ${JSON.stringify(piano.riquadro)}`);
  for (const g of piano.muri) assert.ok(g.s[1] < 1000 && g.s[3] < 1000);
  /* la casa e' 10 x 8 m piu' il balcone e l'ascensore, col metro attorno */
  assert.ok(Math.abs(piano.larghezzaMetri - 13.6) < 0.4, `larga ${piano.larghezzaMetri}`);
  assert.ok(Math.abs(piano.profonditaMetri - 11.4) < 0.4, `profonda ${piano.profonditaMetri}`);
  assert.equal(piano.vani.length, 1, "l'ascensore: il riquadro con le diagonali");
  assert.ok(piano.porte.length >= 5, `porte ${piano.porte.length}`);
  assert.ok(piano.parapetti.length >= 3, `parapetti ${piano.parapetti.length}`);
  /* i nomi e i metri quadri scritti; «Altra U.I.» sta fuori e non e' un nome */
  const nomi = piano.nomi.map((n) => n.t);
  for (const n of ["Soggiorno", "Camera", "Bagno", "Ingresso", "Cameretta", "Balcone"])
    assert.ok(nomi.includes(n), `manca ${n} fra ${nomi}`);
  assert.ok(!nomi.some((n) => /altra/i.test(n)), `${nomi}`);
  assert.equal(piano.metriQuadri.length, 6);
});

test("le stanze escono coi loro nomi e le aree scritte, il balcone e' un balcone", async () => {
  const piano = await pianta();
  const r = riconosci(piano);
  const conta = new Map();
  for (const v of r.casa.tipo) if (v > 0) conta.set(v, (conta.get(v) || 0) + 1);
  const area = (s) => (conta.get(s.id) || 0) * PASSO * PASSO;
  for (const [nome, attesa] of Object.entries(ATTESE)) {
    const s = stanzaDi(r, nome);
    assert.ok(s, `manca ${nome}: ${JSON.stringify(r.nomi)}`);
    const a = area(s);
    assert.ok(
      Math.abs(a / attesa - 1) <= 0.12,
      `${nome}: ${a.toFixed(2)} m² invece di ${attesa} m²`,
    );
  }
  /* il balcone: chiuso dal parapetto, riconosciuto come balcone */
  const balcone = stanzaDi(r, "Balcone");
  assert.ok(balcone, `il balcone: ${JSON.stringify(r.nomi)}`);
  assert.ok(r.info.balconi.has(balcone.id));
  assert.ok(Math.abs(area(balcone) - 8) < 1.5, `balcone ${area(balcone)}`);
  /* l'ascensore e' un vano, non una stanza della casa */
  assert.equal(r.info.vani.size, 1);
  /* le stanze sono queste e basta: niente «Altra U.I.», niente scale,
   * niente cartiglio, niente quote */
  const vere = r.casa.stanze.filter((s) => !r.info.vani.has(s.id));
  assert.equal(vere.length, 7, JSON.stringify(vere.map((s) => [r.nomi[s.id], area(s)])));
  /* le aree scritte tornano: la scala e' giusta */
  assert.equal(r.info.fattore, 1);
  assert.ok(r.info.confronti >= 5, `confronti ${r.info.confronti}`);
  /* i muri dell'ascensore non sono muri della casa: tolti, le stanze restano */
  const senza = senzaIMuriDeiVani(r.casa, r.info.vani);
  const muriDi = (c) => c.tipo.filter((v) => v === CELLA.muro).length * PASSO * PASSO;
  assert.ok(
    muriDi(r.casa) - muriDi(senza) > 0.4,
    `muri tolti: ${(muriDi(r.casa) - muriDi(senza)).toFixed(2)} m²`,
  );
  for (const st of vere)
    assert.equal(
      senza.tipo.filter((v) => v === st.id).length,
      r.casa.tipo.filter((v) => v === st.id).length,
    );
  /* nel piano da salvare il balcone ha il pavimento (e' una stanza «fuori»),
   * l'ascensore no; la porta del soggiorno verso il balcone e' una
   * portafinestra */
  const piano3d = pianoDaRiconoscimento({
    casa: senza,
    nomi: r.nomi,
    fuori: r.info.vani,
    balconi: r.info.balconi,
  });
  const salvato = piano3d.stanze.find((s) => s.id === balcone.id);
  assert.equal(salvato?.fuori, true);
  assert.equal(salvato?.nome, "Balcone");
  const tipo = espandiGriglia(piano3d.griglia, piano3d.W * piano3d.H);
  assert.ok(
    tipo.some((v) => v === balcone.id),
    "il balcone ha le sue celle",
  );
  for (const id of r.info.vani) assert.ok(!tipo.some((v) => v === id));
  assert.ok(tipo.some((v) => v === CELLA.muro));
  assert.ok(
    piano3d.aperture.some((a) => a.portafinestra),
    JSON.stringify(piano3d.aperture),
  );
  /* le porte: le cinque di dentro e il portoncino, che da' fuori ma resta
   * una porta (non una finestra) */
  const porte = piano3d.aperture.filter((a) => a.tipo === "porta");
  assert.equal(porte.length, 6, JSON.stringify(piano3d.aperture.map((a) => [a.tipo, a.x, a.y])));
  assert.equal(piano3d.aperture.filter((a) => a.tipo === "finestra").length, 5);
});

test("una stampa adattata alla pagina: le aree scritte correggono la scala", async () => {
  /* scritto 1:50, ma il foglio e' stato rimpicciolito (1:60 vero): le porte e
   * i muri tornano ancora con 1:50, le aree no */
  const piano = await pianta({ scala: 60, scritta: 50, senzaQuote: true });
  assert.equal(piano.scala, 50);
  const prima = riconosci(piano);
  assert.ok(prima.info.confronti >= 4, `confronti ${prima.info.confronti}`);
  assert.ok(
    Math.abs(prima.info.fattore - 1.2) < 0.06,
    `il fattore dalle aree: ${prima.info.fattore}`,
  );
  /* ricalibrata, come fa la procedura, le stanze tornano */
  const dopo = riconosci(piano, prima.mpp * prima.info.fattore);
  assert.equal(dopo.info.fattore, 1);
  const s = stanzaDi(dopo, "Soggiorno");
  const n = dopo.casa.tipo.filter((v) => v === s.id).length * PASSO * PASSO;
  assert.ok(Math.abs(n / ATTESE.Soggiorno - 1) <= 0.12, `soggiorno ${n}`);
});

test("una stampa adattata alla pagina: le quote scritte dicono la scala vera", async () => {
  const piano = await pianta({ scala: 60, scritta: 50 });
  assert.equal(piano.indizi.scritta, 50);
  assert.equal(piano.scala, 60);
  assert.equal(piano.scalaDa, "quote");
  assert.equal(piano.sicuro, true);
  const r = riconosci(piano);
  assert.equal(r.info.fattore, 1, "con la scala delle quote le aree tornano");
  assert.ok(r.info.confronti >= 4);
});

test("la scala scritta non torna con le porte e coi muri: vale il disegno", async () => {
  /* disegnata a 1:50, ma sul foglio c'e' scritto 1:100 */
  const piano = await pianta({ scritta: 100, senzaQuote: true });
  assert.equal(piano.indizi.scritta, 100);
  assert.equal(piano.scala, 50);
  assert.equal(piano.scalaDa, "porte");
});

test("le scritte disegnate (niente testo nel PDF): nomi, aree e scala si leggono lo stesso", async () => {
  const { tratti, scritte } = await leggiIlPdf(tavola({ testoDisegnato: true }));
  assert.equal(scritte.length, 0, "il PDF non ha testo");
  const piano = piantaDalPdf({ tratti }, { scritte });
  assert.ok(piano.scritteLette > 0);
  assert.equal(piano.scala, 50);
  assert.equal(piano.scalaDa, "scritta");
  const r = riconosci(piano);
  for (const nome of ["Soggiorno", "Camera", "Bagno", "Cameretta"])
    assert.ok(stanzaDi(r, nome), `${nome}: ${JSON.stringify(r.nomi)}`);
  assert.equal(r.info.fattore, 1);
  assert.ok(r.info.confronti >= 4, `confronti ${r.info.confronti}`);
});

test("senza scala scritta la scala viene dalle porte disegnate", async () => {
  const { tratti } = await leggiIlPdf(tavola());
  /* le scritte non arrivano: resta il disegno */
  const piano = piantaDalPdf({ tratti }, { scritte: [{ t: "-" }] });
  assert.equal(piano.scala, 50);
  assert.equal(piano.scalaDa, "porte");
  assert.equal(piano.sicuro, true, "porte e tramezzi dicono la stessa scala");
});

test("le lettere disegnate si leggono, anche spezzate in quadratini", () => {
  const pezzi = [];
  let percorso = 0;
  const scrivi = (testo, x, y, cap) => {
    let cx = x;
    for (const c of testo) {
      if (c === " ") {
        cx += cap * 0.6;
        continue;
      }
      const L = letteraDelModello(c);
      const h = L.h * cap,
        w = L.a * h,
        top = y - cap + L.t * cap;
      percorso++;
      for (const [a, b, c2, d] of L.quadratini)
        pezzi.push({
          percorso,
          poligoni: [
            [
              [cx + a * w, top + b * h],
              [cx + c2 * w + 0.01, top + b * h],
              [cx + c2 * w + 0.01, top + d * h + 0.01],
              [cx + a * w, top + d * h + 0.01],
            ],
          ],
        });
      cx += w + cap * 0.18;
    }
  };
  scrivi("CAMERA 1", 100, 100, 8);
  scrivi("14,72 mq", 100, 114, 8);
  scrivi("scala 1:50", 100, 200, 10);
  const lette = leggiLeScritte(pezzi).sort((a, b) => a.y - b.y);
  assert.deepEqual(
    lette.map((q) => q.t),
    ["CAMERA 1", "14,72 mq", "scala 1:50"],
  );
  for (const q of lette) assert.ok(q.sicurezza > 0.6, `${q.t}: ${q.sicurezza}`);
});

test("la plancia legge il PDF prima dai tratti, e la scala non e' piu' obbligatoria", () => {
  const sezione = fs.readFileSync(
    path.join(QUI, "../src/sections/casa-3d-crea-section.js"),
    "utf8",
  );
  assert.match(sezione, /piantaDalPdf\(tracciatiDellaPagina\(/);
  assert.match(sezione, /usaIlDisegnoDelPdf\(piano\)/);
  /* il passo «Scala» propone la misura ricavata: avanti senza scrivere niente */
  assert.match(sezione, /function proponiLaMisura\(\)/);
  assert.match(sezione, /function stimaLaScala\(\)/);
  assert.doesNotMatch(sezione, /Sul PDF non ho trovato la scala: tocca i due capi/);
});
