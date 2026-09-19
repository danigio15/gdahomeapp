/* Il marchio di chi ha montato l'impianto, visto da dentro casa.
 *
 * Due pezzi in un file solo perche' sono due meta' dello stesso fatto: chi
 * **tiene** il nome e il logo (`installatore.js`) e chi li **mette addosso**
 * alla plancia (`marchio.js`).
 *
 * La riga che regge tutto: il logo lo scarica il **ponte**, e non il browser
 * di chi ci abita. Se lo prendesse il browser, ogni apertura della plancia
 * andrebbe a farsi vedere da una macchina che non e' di casa, e chi tiene il
 * quadro si troverebbe in mano gli orari in cui in quella casa si guarda la
 * plancia — senza averli chiesti e senza che nessuno glieli abbia dati.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { cheImmagineE, Installatore } from "../src/installatore.js";
import { laPagina, NOME, vestiDiGdahome } from "../src/marchio.js";

const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };
const CHI = "inst_0123456789abcdef";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

/* La plancia vera, non un finto: quello che si prova qui e' che le espressioni
 * ritrovino quello che c'e' dentro davvero, e un finto scritto da noi
 * risponderebbe di si' a qualunque espressione. */
const LA_PLANCIA = readFileSync(
  fileURLToPath(new URL("../plancia/legacy/dashboard.html", import.meta.url)),
  "utf8",
);

function banco({ risposta = null, quadro = "https://quadro.invalid" } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "installatore-"));
  const chieste = [];
  const suo = new Installatore({
    cartella,
    quadro,
    registro: ZITTO,
    prendi: async (dove) => {
      chieste.push(dove);
      if (risposta) return risposta;
      return { ok: true, status: 200, arrayBuffer: async () => PNG };
    },
  });
  return { suo, chieste, cartella, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

/* ─── Chi tiene il nome e il logo ──────────────────────────────────────── */

test("il quadro dice chi segue questa casa, e il ponte si va a prendere il logo", async () => {
  const b = banco();
  try {
    await b.suo.dice({ di: "Impianti Rossi", marchio: CHI });
    assert.equal(b.suo.nome, "Impianti Rossi");
    assert.deepEqual(b.chieste, [`https://quadro.invalid/marchio/${CHI}`]);
    const vestito = b.suo.vestito();
    assert.equal(vestito.nome, "Impianti Rossi");
    assert.deepEqual(vestito.logo, PNG);
    assert.equal(vestito.tipo, "image/png");
  } finally {
    b.via();
  }
});

test("il logo si scarica una volta, non a ogni rapporto", async () => {
  /* Il rapporto parte ogni minuto. Un logo cambia una volta ogni mai. */
  const b = banco();
  try {
    for (let giro = 0; giro < 5; giro += 1) {
      await b.suo.dice({ di: "Impianti Rossi", marchio: CHI });
    }
    assert.equal(b.chieste.length, 1);
  } finally {
    b.via();
  }
});

test("una matricola storta non fa partire nessuna richiesta", async () => {
  /* Dal quadro arriva una **matricola**, non un indirizzo, e l'indirizzo se lo
   * compone questa casa. Se passasse altro, sarebbe il quadro a decidere dove
   * va a bussare la casa di qualcuno. */
  for (const storta of [
    "https://altrove.invalid/logo.png",
    "../../qualcosa",
    "inst_NONESADECIMALE",
    "inst_0123",
    "",
  ]) {
    const b = banco();
    try {
      await b.suo.dice({ di: "Rossi", marchio: storta });
      assert.deepEqual(b.chieste, [], `«${storta}» ha fatto partire una richiesta`);
    } finally {
      b.via();
    }
  }
});

test("quello che torna dal quadro deve essere un'immagine, e si guarda come comincia", async () => {
  const b = banco({
    risposta: {
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from("<html><script>alert(1)</script>", "utf8"),
    },
  });
  try {
    await b.suo.dice({ di: "Rossi", marchio: CHI });
    /* Il nome si', il logo no: quel file finirebbe dentro la pagina che apre
     * chi ci abita. */
    assert.equal(b.suo.nome, "Rossi");
    assert.equal(b.suo.vestito().logo, null);
  } finally {
    b.via();
  }
});

test("togliendo l'installatore, il nome e il logo se ne vanno", async () => {
  const b = banco();
  try {
    await b.suo.dice({ di: "Impianti Rossi", marchio: CHI });
    assert.ok(b.suo.vestito());
    /* Il quadro risponde senza piu' niente: e' quello che succede quando chi
     * ci abita toglie il codice, o quando l'installatore lo stacca. */
    await b.suo.dice({ di: "", marchio: "" });
    assert.equal(b.suo.nome, "");
    assert.equal(b.suo.vestito(), null);
  } finally {
    b.via();
  }
});

test("un quadro che non risponde lascia il marchio che c'era", async () => {
  const b = banco({
    risposta: {
      get ok() {
        throw new Error("la rete e' giu'");
      },
    },
  });
  try {
    await b.suo.dice({ di: "Impianti Rossi", marchio: CHI });
    assert.equal(b.suo.nome, "Impianti Rossi");
    assert.equal(b.suo.vestito().logo, null, "senza logo, e senza cadere");
  } finally {
    b.via();
  }
});

test("il logo sopravvive a una riaccensione, senza aspettare il quadro", async () => {
  /* Dopo un riavvio la plancia deve uscire vestita al primo colpo: aspettare
   * il primo rapporto vorrebbe dire un minuto col marchio sbagliato. */
  const b = banco();
  try {
    await b.suo.dice({ di: "Impianti Rossi", marchio: CHI });
    const dopo = new Installatore({ cartella: b.cartella, registro: ZITTO });
    /* Il nome torna col primo rapporto; il logo c'e' gia'. */
    assert.equal(dopo.vestito(), null, "senza nome non si veste niente");
    await dopo.dice({ di: "Impianti Rossi", marchio: CHI });
    assert.deepEqual(dopo.vestito().logo, PNG);
  } finally {
    b.via();
  }
});

test("si riconosce l'immagine da come comincia, non da come si chiama", () => {
  assert.equal(cheImmagineE(PNG).tipo, "image/png");
  assert.equal(cheImmagineE(Buffer.from('<svg xmlns="x"></svg>', "utf8")).tipo, "image/svg+xml");
  assert.equal(cheImmagineE(Buffer.from("MZ un eseguibile", "utf8")), null);
  assert.equal(cheImmagineE(Buffer.alloc(200 * 1024, 0x89)), null, "troppo grosso");
  assert.equal(cheImmagineE(null), null);
});

/* ─── Chi lo mette addosso alla plancia ────────────────────────────────── */

const IL_RUNTIME = "legacy/dashboard-runtime-it.js";
const UN_PEZZO =
  'x.innerHTML=\'<img alt="Dashboard Modern">' +
  '<span class="a">Dashboard</span><span class="b">MODERN</span>\'';

test("senza installatore la plancia resta vestita di gdahome", () => {
  const fatto = vestiDiGdahome(IL_RUNTIME, Buffer.from(UN_PEZZO, "utf8"), "text/javascript");
  const testo = fatto.corpo.toString("utf8");
  assert.match(testo, /alt="gdahome"/);
  assert.match(testo, />gda<\/span>/);
  assert.match(testo, />home<\/span>/);
});

test("con un installatore la plancia porta il suo nome e il suo logo", () => {
  const suo = { nome: "Impianti Rossi", logo: PNG, tipo: "image/png" };
  const testo = vestiDiGdahome(
    IL_RUNTIME,
    Buffer.from(UN_PEZZO, "utf8"),
    "text/javascript",
    suo,
  ).corpo.toString("utf8");
  assert.match(testo, /alt="Impianti Rossi"/);
  assert.match(testo, />Impianti<\/span>/);
  assert.match(testo, />Rossi<\/span>/);

  /* E il logo: gli stessi byte, col tipo che sono davvero. */
  const logo = vestiDiGdahome("legacy/logo.png", Buffer.from("vecchio"), "image/png", suo);
  assert.deepEqual(logo.corpo, PNG);
  assert.equal(logo.tipo, "image/png");
});

test("un nome di una parola sola non si spezza a meta'", () => {
  const testo = vestiDiGdahome(IL_RUNTIME, Buffer.from(UN_PEZZO, "utf8"), "text/javascript", {
    nome: "Elettrotecnica",
  }).corpo.toString("utf8");
  assert.match(testo, />Elettrotecnica<\/span>/);
  assert.match(testo, /><\/span>/, "il secondo pezzo resta vuoto invece di prendersi una sillaba");
});

test("un nome che arriva dal quadro non porta dentro dell'HTML", () => {
  /* Quel nome lo scrive chi tiene il quadro, ma arriva qui passando per una
   * rete, e finisce in un `alt=""`, in un `<title>` e dentro due `span`. */
  const storto = '"><script>alert(1)</script>';
  const testo = vestiDiGdahome(IL_RUNTIME, Buffer.from(UN_PEZZO, "utf8"), "text/javascript", {
    nome: storto,
  }).corpo.toString("utf8");
  assert.ok(!testo.includes("<script>"), "un tag dal nome dell'installatore e' diventato un tag");
  assert.ok(!testo.includes('alt=""'), "l'attributo si e' chiuso a meta'");

  const pagina = laPagina("<title>x</title><b>DashboardModern</b>", { nome: storto });
  assert.ok(!pagina.includes("<script>"));
  assert.match(pagina, /<title>[^<]*<\/title>/);
});

test("il titolo della pagina e la parola del velo prendono il suo nome", () => {
  const pagina = laPagina("<title>Smart Home Dashboard</title><b>DashboardModern</b>", {
    nome: "Impianti Rossi",
  });
  assert.match(pagina, /<title>Impianti Rossi<\/title>/);
  assert.match(pagina, /<b>Impianti Rossi<\/b>/);

  /* E senza installatore, il nostro. */
  const nostra = laPagina("<title>Smart Home Dashboard</title><b>DashboardModern</b>");
  assert.match(nostra, new RegExp(`<title>${NOME}</title>`));
});

test("un logo grosso non finisce dentro il velo d'avvio", () => {
  /* Il velo sta in base64 dentro l'HTML e arriva prima di qualunque altra
   * cosa: centoventotto kilobyte li' dentro sono due secondi di schermo
   * bianco. Sopra la misura resta il nostro, e il suo si vede un attimo dopo
   * in cima alla plancia. */
  const grosso = Buffer.concat([PNG, Buffer.alloc(100 * 1024, 7)]);
  const pagina = laPagina('<div id="cd-boot-overlay"><img src="data:image/webp;base64,AAA">', {
    nome: "Rossi",
    logo: grosso,
    tipo: "image/png",
  });
  assert.ok(!pagina.includes(grosso.toString("base64")), "il logo grosso e' finito nel velo");
});

/* ─── Quello che la plancia dice di se' stessa ────────────────────────── */

test("il segno in cima a Configurazione e' lo stesso logo della testata", () => {
  /* Li' c'era una casetta azzurra disegnata a mano dentro la pagina: non il
   * logo di nessuno, e nemmeno il nostro. Chi apriva Configurazione vedeva il
   * marchio cambiare sotto gli occhi.
   *
   * Adesso quel posto **indica** `logo.png` invece di disegnare qualcosa, ed
   * e' quello che impedisce ai due segni di divergere: e' lo stesso file, e
   * `vestiDiGdahome` lo serve nostro o dell'installatore. */
  const pagina = laPagina(LA_PLANCIA, null);
  assert.match(pagina, /<div class="cfg-hero-ico"[^>]*><img src="\.\/logo\.png"/);
  assert.ok(!/cfg-hero-ico[^>]*>\s*<svg/.test(pagina), "la casetta disegnata a mano e' ancora li'");
  assert.match(pagina, /<div class="cfg-hero-ico"[^>]*><img[^>]*alt="gdahome"/);

  /* E dove la casa ha un installatore col suo nome, quel nome ci va. */
  const sua = laPagina(LA_PLANCIA, { nome: "Impianti Rossi", logo: PNG, tipo: "image/png" });
  assert.match(sua, /<div class="cfg-hero-ico"[^>]*><img[^>]*alt="Impianti Rossi"/);
});

test("la plancia non dichiara piu' una versione sua, vecchia di quattordici giri", () => {
  /* Si leggeva in due posti a schermo — sotto «CONFIGURAZIONE» e nella
   * diagnostica runtime — e diceva 1.4.32 mentre l'add-on diceva 1.5.9.1.
   *
   * Quei numeri li scrive uno script della plancia quando la si costruisce, e
   * di gdahome non sa niente. Si rimettono in pari qui, con quello di
   * `ORIGINE.json`, che e' lo stesso che il ponte mette nel rapporto. */
  const dentro = Buffer.from(
    'export const BUILD_INFO = Object.freeze({"generated":true,' +
      '"integrationVersion":"1.4.32","dashboardVersion":"1.4.32","moduleVersion":14});\n',
  );
  const fatto = vestiDiGdahome(
    "legacy/build-info.js",
    dentro,
    "text/javascript",
    null,
    "1.5.9",
  ).corpo.toString("utf8");
  assert.match(fatto, /"integrationVersion":"1\.5\.9"/);
  assert.match(fatto, /"dashboardVersion":"1\.5\.9"/);
  /* E il resto non si tocca: sono numeri della plancia, non nostri. */
  assert.match(fatto, /"moduleVersion":14/);

  /* Senza una versione da mettere non si inventa niente, e un numero storto
   * nemmeno: quel testo finisce dentro una stringa che il browser esegue. */
  for (const storta of ["", '1.5.9"; alert(1); //', "boh", null]) {
    assert.equal(
      vestiDiGdahome("legacy/build-info.js", dentro, "text/javascript", null, storta).corpo,
      dentro,
      `«${storta}» e' passata`,
    );
  }
});
