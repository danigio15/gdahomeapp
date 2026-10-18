/* «Riquadri con l'immagine»: un riquadro della plancia puo' portare una foto
 * di casa o un disegno da riquadro che lo riempie tutto.
 *
 * Qui si tengono ferme le tre cose che non si vedono a occhio:
 * - il catalogo dei disegni parla sempre nello stesso modo (la forma di ogni
 *   voce, gli `id` col prefisso della chiave, la ricerca senza accenti), perche'
 *   un catalogo piu' grande arrivera' al suo posto e tutto il resto lo usa solo
 *   da li';
 * - quello che si salva e' pulito: solo indirizzi di casa o disegni del
 *   catalogo, i numeri dentro i loro confini;
 * - come si posa l'immagine: il fuoco, lo zoom, la finestra che si vede in un
 *   riquadro di una certa forma, e il suo inverso per quando si trascina.
 * E che i riquadri lo mostrino davvero: a muro, nelle prese, nei Dispositivi.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DISEGNI_DA_RIQUADRO,
  GRUPPI_DISEGNI,
  cercaDisegni,
  disegnoDaRiquadro,
} from "../src/core/disegni-da-riquadro.js";
import {
  chiaveDelDisegno,
  finestraVisibile,
  fuocoDallaFinestra,
  immagineMarkup,
  immaginePulita,
  riquadroConImmagineMarkup,
  srcDaMostrare,
  srcPulito,
  stessaImmagine,
  stileDellImmagine,
  stileInLinea,
} from "../src/core/immagine-del-riquadro.js";
import { comandoPulito, muroPulito } from "../src/core/plancia-a-muro.js";
import { normalizzaPrese } from "../src/core/prese-model.js";
import { anteprimaDellaPagina } from "../src/sections/plancia-a-muro-section.js";
import { pageCardMarkup } from "../src/sections/lights-page-section.js";
import { bloccoImmagineMarkup } from "../src/sections/riquadri-con-immagine-section.js";

const FOTO = "/dashboardmodern_static/www/dashboardmodern/riquadri/terrazza.webp";

/* ── il catalogo ─────────────────────────────────────────────────────────── */

test("il catalogo dei disegni ha la forma che tutti si aspettano", () => {
  assert.ok(GRUPPI_DISEGNI.length > 0);
  const gruppi = new Set();
  for (const g of GRUPPI_DISEGNI) {
    assert.match(g.chiave, /^[a-z0-9-]+$/);
    assert.equal(typeof g.nome.it, "string");
    assert.equal(typeof g.nome.en, "string");
    assert.ok(g.nome.it && g.nome.en);
    gruppi.add(g.chiave);
  }
  assert.equal(gruppi.size, GRUPPI_DISEGNI.length, "chiavi dei gruppi uniche");
  const chiavi = new Set();
  for (const d of DISEGNI_DA_RIQUADRO) {
    assert.match(d.chiave, /^[a-z0-9-]+$/, d.chiave);
    assert.ok(!chiavi.has(d.chiave), `chiave doppia: ${d.chiave}`);
    chiavi.add(d.chiave);
    assert.ok(gruppi.has(d.gruppo), `${d.chiave}: gruppo ${d.gruppo} sconosciuto`);
    assert.ok(d.nome.it && d.nome.en, d.chiave);
    assert.ok(Array.isArray(d.parole) && d.parole.every((p) => typeof p === "string"));
    assert.equal(d.fuoco.length, 2);
    for (const n of d.fuoco) assert.ok(n >= 0 && n <= 100, `${d.chiave}: fuoco ${n}`);
    assert.equal(typeof d.svg, "function");
    assert.equal(disegnoDaRiquadro(d.chiave), d);
  }
  assert.equal(disegnoDaRiquadro("non-esiste"), null);
  assert.equal(disegnoDaRiquadro(undefined), null);
});

test("ci sono i sei disegni di partenza", () => {
  for (const chiave of ["proiettore", "decoder", "cancello", "albero", "lampione", "prato"])
    assert.ok(disegnoDaRiquadro(chiave), chiave);
});

test("ogni SVG e' un 240×240 con gli id che cominciano dalla sua chiave", () => {
  const visti = new Set();
  for (const d of DISEGNI_DA_RIQUADRO) {
    const svg = d.svg();
    assert.equal(svg, d.svg(), "lo stesso disegno a ogni chiamata");
    assert.match(svg, /^<svg [^>]*viewBox="0 0 240 240"/, d.chiave);
    assert.match(svg, /<\/svg>$/);
    assert.doesNotMatch(svg, /<script|on\w+=|href="http/i, d.chiave);
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(ids.length > 0, d.chiave);
    for (const id of ids) {
      assert.ok(id.startsWith(`${d.chiave}-`), `${d.chiave}: id ${id}`);
      assert.ok(!visti.has(id), `id doppio fra i disegni: ${id}`);
      visti.add(id);
    }
    /* Ogni url(#…) punta a un id del suo disegno. */
    for (const [, rif] of svg.matchAll(/url\(#([^)]+)\)/g))
      assert.ok(ids.includes(rif), `${d.chiave}: url(#${rif}) senza id`);
  }
});

test("la ricerca dei disegni non guarda gli accenti ne' le maiuscole", () => {
  assert.equal(cercaDisegni("").length, DISEGNI_DA_RIQUADRO.length);
  assert.equal(cercaDisegni("   ").length, DISEGNI_DA_RIQUADRO.length);
  /* Il catalogo e' grande: quello cercato c'e' fra i trovati. */
  const trova = (testo, chiave, lingua) =>
    assert.ok(
      cercaDisegni(testo, lingua).some((d) => d.chiave === chiave),
      `${testo} → ${chiave}`,
    );
  trova("NATÀLE", "albero");
  trova("cancello", "cancello");
  /* Nella lingua chiesta, e in inglese comunque. */
  trova("projector", "proiettore", "en");
  trova("gate", "cancello", "de");
  /* Ogni parola deve trovarsi. */
  trova("luce esterna", "lampione");
  assert.deepEqual(cercaDisegni("zzz nessuno"), []);
});

/* ── quello che si salva ─────────────────────────────────────────────────── */

test("si salvano solo foto di casa e disegni del catalogo", () => {
  assert.equal(srcPulito(FOTO), FOTO);
  assert.equal(
    srcPulito("/local/dashboardmodern/riquadri/a.JPG"),
    "/local/dashboardmodern/riquadri/a.JPG",
  );
  assert.equal(srcPulito("disegno:albero"), "disegno:albero");
  for (const cattivo of [
    "",
    "disegno:",
    "disegno:non-esiste",
    "disegno:../albero",
    "https://esterno.example/foto.jpg",
    "//esterno.example/foto.jpg",
    "http:/local/a.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "/local/../secrets.yaml",
    "/local/a/../../b.png",
    "/local/./a.png",
    "/local//a.png",
    "/local/a.png?x=1",
    "/local/a.svg",
    "/local/a",
    "/local/",
    "/api/image/serve/x/original",
    "/dashboardmodern_static/legacy/dashboard.html",
    '/local/a".png',
    "/local/a b.png",
    `/local/${"a".repeat(400)}.png`,
  ])
    assert.equal(srcPulito(cattivo), "", cattivo);
});

test("l'immagine pulita: i numeri dentro i confini, i vuoti col loro ripiego", () => {
  assert.equal(immaginePulita(null), null);
  assert.equal(immaginePulita("disegno:albero"), null, "una stringa non e' un'immagine");
  assert.equal(immaginePulita([FOTO]), null);
  assert.equal(immaginePulita({ src: "https://x.example/a.png" }), null);
  assert.deepEqual(immaginePulita({ src: FOTO }), { src: FOTO, fuoco: [50, 50], zoom: 1 });
  assert.deepEqual(immaginePulita({ src: FOTO, fuoco: [140, -3], zoom: 9 }), {
    src: FOTO,
    fuoco: [100, 0],
    zoom: 3,
  });
  assert.deepEqual(immaginePulita({ src: FOTO, fuoco: ["62.345", "x"], zoom: 0.2 }), {
    src: FOTO,
    fuoco: [62.3, 50],
    zoom: 1,
  });
  assert.deepEqual(immaginePulita({ src: FOTO, fuoco: "50% 50%", zoom: "1.234" }), {
    src: FOTO,
    fuoco: [50, 50],
    zoom: 1.23,
  });
  /* Un disegno senza fuoco prende quello del catalogo. */
  assert.deepEqual(
    immaginePulita({ src: "disegno:albero" }).fuoco,
    disegnoDaRiquadro("albero").fuoco,
  );
  /* Niente campi in piu': quello che arriva da fuori non passa. */
  assert.deepEqual(Object.keys(immaginePulita({ src: FOTO, onload: "x", extra: 1 })), [
    "src",
    "fuoco",
    "zoom",
  ]);
  assert.equal(chiaveDelDisegno({ src: "disegno:prato" }), "prato");
  assert.equal(chiaveDelDisegno({ src: FOTO }), "");
  assert.ok(stessaImmagine({ src: FOTO }, { src: FOTO, fuoco: [50, 50], zoom: 1 }));
  assert.ok(!stessaImmagine({ src: FOTO }, { src: FOTO, zoom: 2 }));
  assert.ok(stessaImmagine(null, { src: "fuori" }));
});

test("un posto a muro tiene la sua immagine pulita, e butta quella che non e' di casa", () => {
  const luce = comandoPulito({
    tipo: "luce",
    entita: "light.terrazza",
    immagine: { src: FOTO, fuoco: [62, 50], zoom: 1.2 },
  });
  assert.deepEqual(luce.immagine, { src: FOTO, fuoco: [62, 50], zoom: 1.2 });
  const azione = comandoPulito({
    tipo: "azione",
    azione: "Buonanotte",
    immagine: { src: "disegno:albero" },
  });
  assert.equal(azione.immagine.src, "disegno:albero");
  const fuori = comandoPulito({
    tipo: "entita",
    entita: "switch.presa",
    immagine: { src: "https://x.example/a.png" },
  });
  assert.equal("immagine" in fuori, false);
  /* Senza immagine il posto e' quello di sempre, senza la chiave. */
  assert.deepEqual(comandoPulito({ tipo: "entita", entita: "switch.presa" }), {
    tipo: "entita",
    entita: "switch.presa",
    nome: "",
    sotto: "",
    disegno: "",
  });
  /* E passa dentro la pagina e dentro le scene. */
  const muro = muroPulito({
    pagine: [
      {
        modello: "personale",
        scelti: true,
        comandi: [{ tipo: "luce", entita: "light.a", immagine: { src: "disegno:prato", zoom: 7 } }],
      },
      { modello: "scene", scene: [{ entita: "scene.sera", immagine: { src: "disegno:decoder" } }] },
    ],
  });
  assert.deepEqual(muro.pagine[0].comandi[0].immagine, {
    src: "disegno:prato",
    fuoco: disegnoDaRiquadro("prato").fuoco,
    zoom: 3,
  });
  assert.equal(muro.pagine[1].scene[0].immagine.src, "disegno:decoder");
});

test("una presa tiene la sua immagine pulita, e butta quella che non e' di casa", () => {
  const [buona, cattiva, senza] = normalizzaPrese([
    { name: "Terrazza", entity: "switch.terrazza", immagine: { src: FOTO, zoom: 2 } },
    { name: "Fuori", entity: "switch.fuori", immagine: { src: "https://x.example/a.png" } },
    { name: "Modem", entity: "switch.modem" },
  ]);
  assert.deepEqual(buona.immagine, { src: FOTO, fuoco: [50, 50], zoom: 2 });
  assert.equal("immagine" in cattiva, false);
  assert.equal("immagine" in senza, false);
});

/* ── come si posa ────────────────────────────────────────────────────────── */

test("il fuoco e lo zoom diventano le proprieta' dell'immagine", () => {
  assert.deepEqual(stileDellImmagine({ src: FOTO, fuoco: [62, 30], zoom: 1.5 }), {
    objectPosition: "62% 30%",
    transformOrigin: "62% 30%",
    transform: "scale(1.5)",
  });
  assert.deepEqual(stileDellImmagine({ src: FOTO }), {
    objectPosition: "50% 50%",
    transformOrigin: "50% 50%",
    transform: "",
  });
  assert.equal(
    stileInLinea({ src: FOTO, fuoco: [10, 90], zoom: 1 }),
    "object-position:10% 90%;transform-origin:10% 90%",
  );
  assert.deepEqual(stileDellImmagine(null).transform, "");
});

test("la finestra che si vede: la forma del riquadro, il fuoco e lo zoom", () => {
  const quasi = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
  /* Una foto 16:10 in un quadrato: se ne vede il 62,5% della larghezza. */
  const centro = finestraVisibile({ larghezza: 1600, altezza: 1000 }, 1, { src: FOTO });
  quasi(centro.w, 0.625);
  quasi(centro.h, 1);
  quasi(centro.x, (1 - 0.625) / 2);
  quasi(centro.y, 0);
  /* Il fuoco tutto a destra porta la finestra sul bordo destro. */
  const destra = finestraVisibile({ larghezza: 1600, altezza: 1000 }, 1, {
    src: FOTO,
    fuoco: [100, 50],
  });
  quasi(destra.x + destra.w, 1);
  /* Lo zoom stringe la finestra attorno al fuoco. */
  const vicino = finestraVisibile({ larghezza: 1000, altezza: 1000 }, 1, {
    src: FOTO,
    fuoco: [25, 75],
    zoom: 2,
  });
  quasi(vicino.w, 0.5);
  quasi(vicino.h, 0.5);
  quasi(vicino.x, 0.25 * 0.5);
  quasi(vicino.y, 0.75 * 0.5);
  /* Un quadrato in un 3:2 a muro: se ne vedono due terzi dell'altezza. */
  const muro = finestraVisibile({ larghezza: 240, altezza: 240 }, 1.5, { src: "disegno:albero" });
  quasi(muro.w, 1);
  quasi(muro.h, 1 / 1.5);
});

test("trascinare la cornice e' l'inverso della finestra", () => {
  const misure = { larghezza: 1600, altezza: 1000 };
  const immagine = immaginePulita({ src: FOTO, fuoco: [30, 40], zoom: 1.5 });
  const f = finestraVisibile(misure, 1, immagine);
  assert.deepEqual(fuocoDallaFinestra(misure, 1, immagine, f.x, f.y), [30, 40]);
  /* Oltre il bordo, il fuoco si ferma a 0 o a 100. */
  assert.deepEqual(fuocoDallaFinestra(misure, 1, immagine, 5, -5), [100, 0]);
  /* Dove la finestra prende tutto il lato, quel fuoco non si muove. */
  const intero = immaginePulita({ src: FOTO, fuoco: [30, 40] });
  assert.equal(fuocoDallaFinestra(misure, 1, intero, 0.1, 0.9)[1], 40);
  assert.equal(fuocoDallaFinestra(misure, 1, null, 0, 0), null);
});

/* ── i riquadri ──────────────────────────────────────────────────────────── */

test("il riquadro con l'immagine: il velo, il nome scappato, il segno della foto", () => {
  const html = riquadroConImmagineMarkup({
    immagine: { src: FOTO, fuoco: [62, 50] },
    nome: 'Terrazza <b>"x"</b>',
    stato: "Accese",
    acceso: true,
    accento: "#f59e0b",
  });
  assert.match(html, /^<div class="dm-rq on /);
  assert.match(html, /--acc:#f59e0b/);
  assert.match(
    html,
    /<img class="dm-rq-img" src="\/dashboardmodern_static\/www\/dashboardmodern\/riquadri\/terrazza\.webp"/,
  );
  assert.match(html, /object-position:62% 50%/);
  assert.match(html, /Terrazza &lt;b&gt;&quot;x&quot;&lt;\/b&gt;/);
  assert.match(html, /class="dm-rq-foto"/, "una foto caricata porta il suo segno");
  const disegno = riquadroConImmagineMarkup({
    immagine: { src: "disegno:albero" },
    nome: "Albero",
  });
  assert.match(disegno, /^<div class="dm-rq  /, "spento: niente `on`");
  assert.doesNotMatch(disegno, /dm-rq-foto/, "un disegno non e' una foto");
  assert.match(disegno, /src="data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  assert.equal(riquadroConImmagineMarkup({ immagine: { src: "https://x.example/a.png" } }), "");
  assert.equal(immagineMarkup(null), "");
  assert.equal(srcDaMostrare({ src: FOTO }), FOTO);
});

const FONTE = Object.freeze({
  luci: [],
  clima: [],
  tapparelle: [],
  azioni: [{ name: "Buonanotte" }],
});

test("a muro: la luce, l'entita' e la scena con l'immagine sono riquadri con l'immagine", () => {
  const muro = muroPulito({
    pagine: [
      {
        modello: "personale",
        scelti: true,
        comandi: [
          {
            tipo: "luce",
            entita: "light.terrazza",
            nome: "Terrazza",
            immagine: { src: "disegno:albero" },
          },
          {
            tipo: "entita",
            entita: "switch.proiettore",
            nome: "Proiettore",
            immagine: { src: FOTO },
          },
          { tipo: "azione", azione: "Buonanotte", immagine: { src: "disegno:lampione" } },
          { tipo: "entita", entita: "switch.presa", nome: "Presa" },
        ],
      },
    ],
  });
  const html = anteprimaDellaPagina(muro, 0, FONTE);
  const riquadri = html.match(/<(div|button)[^>]*class="dm-rq [^"]*"[^>]*>/g) || [];
  assert.equal(riquadri.length, 3, html.slice(0, 400));
  /* La luce: il suo interruttore in vetro e i dati del tocco di sempre. */
  assert.match(riquadri[0], /data-mu-card="0" data-mu-entita="light\.terrazza"/);
  assert.match(
    html,
    /class="dm-rq-int [^"]*" data-mu-fa="interruttore" data-mu-entita="light\.terrazza"/,
  );
  /* L'entita' resta un tasto che fa il gesto del suo dominio. */
  assert.match(riquadri[1], /^<button type="button" class="dm-rq [^"]*mu-tessera/);
  assert.match(riquadri[1], /data-mu-fa="entita" data-mu-entita="switch\.proiettore"/);
  /* La scena: il tocco fa partire l'azione. */
  assert.match(riquadri[2], /data-mu-fa="azione" data-mu-azione="Buonanotte"/);
  /* Il posto senza immagine e' la tessera di sempre. */
  assert.match(
    html,
    /mu-fam mu-tessera[^"]*"[^>]*data-mu-fa="entita" data-mu-entita="switch\.presa"/,
  );
});

test("le prese con l'immagine tengono la levetta e lo stato che la pagina aggiorna", () => {
  const view = {
    id: "switch.terrazza",
    name: "Terrazza",
    domain: "switch",
    on: true,
    available: true,
    comandabile: true,
    dimmable: false,
    colorful: false,
    tunable: false,
    effects: [],
    consumo: "14 W",
    immagine: { src: "disegno:proiettore" },
  };
  const html = pageCardMarkup(view);
  assert.match(html, /^<article class="dm-rq  dm-lucip-rq is-on"/);
  assert.match(html, /data-dm-lucip="switch\.terrazza"/);
  assert.match(html, /data-dm-lucip-toggle aria-pressed="true"/);
  assert.match(html, /<span data-dm-lucip-state>/);
  assert.match(html, /14 W/);
  /* Senza immagine, la card di sempre. */
  assert.match(
    pageCardMarkup({ ...view, immagine: null }),
    /^<article class="dm-lucip-card is-on"/,
  );
  /* Una presa che si guarda e basta non ha la levetta, e il tocco apre. */
  const bloccata = pageCardMarkup({ ...view, comandabile: false });
  assert.doesNotMatch(bloccata, /data-dm-lucip-toggle/);
  assert.match(bloccata, /data-dm-lucip-open/);
});

test("il blocco «Immagine» degli editor: le due strade, e il togli solo quando c'e' qualcosa", () => {
  const vuoto = bloccoImmagineMarkup({
    chiave: "pagine.0.comandi.2",
    immagine: null,
    nome: "Terrazza",
  });
  assert.match(vuoto, /data-dm-rqi="pagine\.0\.comandi\.2"/);
  assert.match(vuoto, /<input type="file" accept="image\/\*" data-dm-rqi-carica>/);
  assert.match(vuoto, /data-dm-rqi-disegni/);
  assert.match(vuoto, /data-dm-rqi-valore="null"/);
  assert.doesNotMatch(vuoto, /data-dm-rqi-togli/);
  assert.doesNotMatch(vuoto, /data-dm-rqi-tela/);
  const pieno = bloccoImmagineMarkup({
    chiave: "presa",
    immagine: { src: "disegno:albero", zoom: 1.2 },
    nome: "Albero",
  });
  assert.match(pieno, /data-dm-rqi-togli/);
  assert.match(pieno, /data-dm-rqi-tela[^>]*style="aspect-ratio:240\/240"/);
  assert.match(pieno, /data-dm-rqi-forma="1"/);
  assert.match(pieno, /data-dm-rqi-forma="1\.5"/);
  assert.match(pieno, /value="120" data-dm-rqi-zoom/);
  assert.match(pieno, /&quot;src&quot;:&quot;disegno:albero&quot;/);
});
