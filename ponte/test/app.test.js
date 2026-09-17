/* Le prove di gdahome servita dall'add-on.
 *
 * E' il link: chi ha l'add-on acceso apre `/app/` dietro l'ingress di Home
 * Assistant e si trova l'app, senza installare niente da nessuna parte.
 *
 * Le cose che si provano qui sono tre, e sono tutte cose che si rompono in
 * silenzio:
 *  - la barra in fondo — `/app` senza barra vuol dire che il browser cerca i
 *    file un piano piu' su, e la pagina resta bianca;
 *  - il prefisso dell'ingress, che cambia a ogni riavvio di Home Assistant;
 *  - i pezzi che `strumenti/porta-l-app.mjs` **non** porta dentro: se un
 *    giorno la pagina cominciasse a chiederne uno, qui si vede subito invece
 *    che sul computer di chi la apre.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { costruisciLaConsole } from "../src/server.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CONSOLE = join(dirname(QUI), "console");
const APP_VERA = join(dirname(QUI), "app");

/* Una console con dentro il minimo che le serve: qui non si prova ne' la casa
 * ne' l'abbinamento, si prova una cartella servita. */
async function unaConsole({ cartellaDellApp, chat } = {}) {
  const server = costruisciLaConsole({
    ponte: { collegatiPerDispositivo: () => new Map() },
    casa: { saluta: async () => ({ viva: true }) },
    dispositivi: { elenco: () => [], quanti: () => 0 },
    abbinamento: { stato: () => ({ attivo: false }) },
    opzioni: { portaDellApp: 8098, dispositiviMassimi: 10, app: cartellaDellApp },
    chat,
    cartellaDellaConsole: CONSOLE,
    cartellaDellApp,
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const dove = `http://127.0.0.1:${server.address().port}`;
  return {
    dove,
    chiedi: (via, opzioni) => fetch(`${dove}${via}`, { redirect: "manual", ...opzioni }),
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

/* Un'app finta, che e' quello che serve per provare come si serve una
 * cartella: quella vera pesa quindici megabyte e cambia a ogni costruzione. */
function appFinta() {
  const cartella = mkdtempSync(join(tmpdir(), "app-web-"));
  mkdirSync(join(cartella, "canvaskit"), { recursive: true });
  writeFileSync(join(cartella, "index.html"), "<!doctype html><title>gdahome</title>");
  writeFileSync(join(cartella, "main.dart.js"), "console.log('ciao');");
  writeFileSync(join(cartella, "canvaskit", "canvaskit.wasm"), Buffer.from([0, 97, 115, 109]));
  return cartella;
}

test("l'indirizzo senza barra rimanda a quello con la barra, e il rimando e' relativo", async () => {
  const cartella = appFinta();
  const c = await unaConsole({ cartellaDellApp: cartella });
  try {
    const senza = await c.chiedi("/app");
    assert.equal(senza.status, 302);
    /* Relativo apposta: `app/` e non `/app/`. Sotto l'ingress davanti c'e' un
     * prefisso che il ponte non conosce, e un rimando assoluto porterebbe
     * fuori — cioe' a una pagina di Home Assistant che non c'e'. */
    assert.equal(senza.headers.get("location"), "app/");
  } finally {
    await c.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("la pagina si serve, e i file si possono tenere; la pagina no", async () => {
  const cartella = appFinta();
  const c = await unaConsole({ cartellaDellApp: cartella });
  try {
    const pagina = await c.chiedi("/app/");
    assert.equal(pagina.status, 200);
    assert.match(pagina.headers.get("content-type"), /^text\/html/);
    assert.match(await pagina.text(), /gdahome/);
    /* Niente si usa senza chiedere prima: `no-cache` vuol dire «tienilo, ma
     * prima di usarlo chiedimi se va ancora bene». */
    assert.equal(pagina.headers.get("cache-control"), "no-cache");

    const programma = await c.chiedi("/app/main.dart.js");
    assert.equal(programma.status, 200);
    assert.match(programma.headers.get("content-type"), /^text\/javascript/);
    /* Il programma **soprattutto**: non ha l'impronta nel nome, e uno tenuto
     * in tasca vuol dire l'app di prima con l'add-on nuovo. */
    assert.equal(programma.headers.get("cache-control"), "no-cache");
    assert.ok(programma.headers.get("etag"), "senza contrassegno non si puo' richiedere");

    const tela = await c.chiedi("/app/canvaskit/canvaskit.wasm");
    assert.equal(tela.status, 200);
    assert.equal(tela.headers.get("content-type"), "application/wasm");
  } finally {
    await c.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("sotto l'ingress il prefisso non da' fastidio", async () => {
  const cartella = appFinta();
  const c = await unaConsole({ cartellaDellApp: cartella });
  const davanti = "/api/hassio_ingress/un-gettone-qualunque";
  try {
    const senza = await c.chiedi(`${davanti}/app`, { headers: { "x-ingress-path": davanti } });
    assert.equal(senza.status, 302);
    assert.equal(senza.headers.get("location"), "app/");

    const programma = await c.chiedi(`${davanti}/app/main.dart.js`, {
      headers: { "x-ingress-path": davanti },
    });
    assert.equal(programma.status, 200);
    assert.match(await programma.text(), /ciao/);
  } finally {
    await c.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("dalla cartella dell'app non si esce", async () => {
  const cartella = appFinta();
  const c = await unaConsole({ cartellaDellApp: cartella });
  try {
    for (const via of [
      "/app/../console/index.html",
      "/app/..%2f..%2fetc%2fpasswd",
      "/app/%2e%2e/%2e%2e/etc/passwd",
    ]) {
      const risposta = await c.chiedi(via);
      assert.notEqual(risposta.status, 200, `${via} non deve servire niente`);
    }
  } finally {
    await c.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("senza app dentro, il ponte lo dice invece di dare una pagina rotta", async () => {
  const c = await unaConsole({ cartellaDellApp: join(tmpdir(), "app-che-non-ce-e-mai-esistita") });
  try {
    const risposta = await c.chiedi("/app/");
    assert.equal(risposta.status, 404);
    assert.match(await risposta.text(), /gdahome/);

    const stato = await (await c.chiedi("/api/stato")).json();
    assert.equal(
      stato.app,
      false,
      "e la console non mostra un link che non porta da nessuna parte",
    );
  } finally {
    await c.spegni();
  }
});

test("con l'app dentro, la console lo sa", async () => {
  const cartella = appFinta();
  const c = await unaConsole({ cartellaDellApp: cartella });
  try {
    const stato = await (await c.chiedi("/api/stato")).json();
    assert.equal(stato.app, true);
  } finally {
    await c.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* ─── La chiave della console, l'unico segno che e' arrivata ─────────────── */

test("senza la chiave della console, la scheda dell'assistenza non si accende", async () => {
  const c = await unaConsole();
  try {
    const stato = await (await c.chiedi("/api/stato")).json();
    assert.equal(stato.assistenza.console, false);
  } finally {
    await c.spegni();
  }
});

test("con la chiave, lo stato lo dice — e la chiave non esce", async () => {
  /* Il difetto che questa prova chiude: Home Assistant un campo `password` lo
   * nasconde e non lo rimostra, quindi chi ha appena incollato la chiave della
   * console riapre la scheda dell'add-on, trova la casella vuota e non ha
   * **nessun** modo di sapere se sia stata presa o buttata via. Adesso c'e' un
   * posto dove leggerlo. */
  const c = await unaConsole({
    chat: { eLaConsole: true, chiaveDellaConsole: "unaChiaveSegreta" },
  });
  try {
    const risposta = await c.chiedi("/api/stato");
    const testo = await risposta.text();
    assert.equal(JSON.parse(testo).assistenza.console, true);
    /* E di quella chiave non esce niente: ne' intera, ne' a pezzi. Esce un
     * si'. */
    assert.equal(testo.includes("unaChiaveSegreta"), false);
  } finally {
    await c.spegni();
  }
});

/* ─── L'app vera, quella portata dentro ──────────────────────────────────── */

/* Queste due si saltano se `ponte/app/` non c'e': chi lavora sul ponte non ha
 * per forza un'app costruita sotto mano, e un rosso li' vorrebbe dire
 * insegnare a non guardare i rossi. */
const cE = existsSync(join(APP_VERA, "index.html"));

test("l'app portata dentro chiede solo pezzi che ci sono", { skip: !cE }, () => {
  for (const quale of [
    "flutter_bootstrap.js",
    "flutter.js",
    "main.dart.js",
    "canvaskit/canvaskit.js",
    "canvaskit/canvaskit.wasm",
    "assets/AssetManifest.bin.json",
    "assets/FontManifest.json",
    /* Il servitore della plancia nel browser: senza, l'app c'e' e la plancia
     * no, e nessuno capisce perche'. */
    "plancia-sw.js",
  ]) {
    assert.ok(existsSync(join(APP_VERA, quale)), `manca ${quale}`);
  }
});

test("i motori che non si usano restano fuori, e la pagina non li chiede", { skip: !cE }, () => {
  /* Il patto e' scritto in `app/web/flutter_bootstrap.js`: un motore solo,
   * nella versione buona per tutti i browser. Se quella riga sparisse, Chrome
   * andrebbe a cercare `canvaskit/chromium/canvaskit.js` — che qui dentro non
   * c'e' — e l'app non partirebbe **solo su Chrome**. Che e' il browser di
   * quasi tutti. */
  const acceso = readFileSync(join(APP_VERA, "flutter_bootstrap.js"), "utf8");
  assert.match(acceso, /canvasKitVariant:\s*"full"/);
  assert.match(acceso, /renderer:\s*"canvaskit"/);

  for (const quale of [
    "canvaskit/chromium",
    "canvaskit/skwasm.wasm",
    "canvaskit/skwasm_heavy.wasm",
    "canvaskit/wimp.wasm",
    "canvaskit/webparagraph",
    "canvaskit/canvaskit.js.symbols",
  ]) {
    assert.equal(existsSync(join(APP_VERA, quale)), false, `${quale} non ci va`);
  }
});

test("la diagnostica del traffico sta dietro la stessa chiave", () => {
  /* «Chi parla di piu'» elenca entita' col nome tecnico, conta eventi al
   * minuto e parla di filtri da mettere in Home Assistant: a chi ha gdahome
   * in casa non serve, e spaventa piu' di quanto spieghi. Serve a chi guarda
   * una casa che va a scatti, cioe' a chi risponde alle segnalazioni.
   *
   * Due cose la tengono ferma: la scheda nasce nascosta nell'HTML — se no si
   * vedrebbe per un istante prima che la pagina sappia com'e' fatta questa
   * casa — e si accende con la stessa condizione dell'assistenza. */
  const pagina = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
  /* Il vestito della pagina cambia; quello che non deve cambiare e' che quella
   * scheda **nasca nascosta**. Quindi si guarda il fatto, non la classe. */
  const laSua = /<section[^>]*\bid="chiacchieroni"[^>]*>/.exec(pagina);
  assert.ok(laSua, "la scheda della diagnostica non c'e' piu'");
  assert.match(laSua[0], /\shidden\b/, "la scheda della diagnostica non nasce nascosta");

  const console_ = readFileSync(join(QUI, "..", "console", "console.js"), "utf8");
  assert.match(
    console_,
    /trova\("chiacchieroni"\)\.hidden = !risponde;/,
    "la diagnostica non si lega alla chiave della console",
  );
  /* E i dati non si disegnano nemmeno, dove la scheda non si vede. */
  assert.match(console_, /if \(risponde\) disegnaIChiacchieroni\(stato\.chiacchieroni\);/);
});

test("chi ha gia' un file si sente dire di tenerselo, e non lo riscarica", async () => {
  const cartella = appFinta();
  const c = await unaConsole({ cartellaDellApp: cartella });
  try {
    const prima = await c.chiedi("/app/main.dart.js");
    assert.equal(prima.status, 200);
    const contrassegno = prima.headers.get("etag");
    assert.ok(contrassegno);
    await prima.text();

    const ancora = await c.chiedi("/app/main.dart.js", {
      headers: { "if-none-match": contrassegno },
    });
    assert.equal(ancora.status, 304, "lo ha gia': 304");
    assert.equal(await ancora.text(), "", "e senza corpo, che e' tutto il risparmio");
    assert.equal(ancora.headers.get("etag"), contrassegno);
  } finally {
    await c.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("ma se l'add-on si aggiorna, quello che aveva non vale piu'", async () => {
  const cartella = appFinta();
  const c = await unaConsole({ cartellaDellApp: cartella });
  try {
    const prima = await c.chiedi("/app/main.dart.js");
    const vecchio = prima.headers.get("etag");
    await prima.text();

    /* L'app nuova al posto di quella di prima: e' quello che fa un
     * aggiornamento dell'add-on. */
    writeFileSync(join(cartella, "main.dart.js"), "console.log('la barra si apre');");

    const dopo = await c.chiedi("/app/main.dart.js", {
      headers: { "if-none-match": vecchio },
    });
    assert.equal(dopo.status, 200, "e' cambiato: niente 304");
    assert.notEqual(dopo.headers.get("etag"), vecchio);
    assert.match(await dopo.text(), /la barra si apre/);
  } finally {
    await c.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("il contrassegno vale anche rimandato indietro come debole", async () => {
  const cartella = appFinta();
  const c = await unaConsole({ cartellaDellApp: cartella });
  try {
    const prima = await c.chiedi("/app/main.dart.js");
    const contrassegno = prima.headers.get("etag");
    await prima.text();

    /* Qualcuno in mezzo — un proxy — puo' rimandarlo indietro cosi', o
     * insieme a un altro. Un confronto troppo stretto non darebbe errore:
     * darebbe tre megabyte riscaricati ogni volta, senza dirlo a nessuno. */
    const debole = await c.chiedi("/app/main.dart.js", {
      headers: { "if-none-match": `"altro", W/${contrassegno}` },
    });
    assert.equal(debole.status, 304);
  } finally {
    await c.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("la console invece non si tiene affatto: e' piccola e cambia con l'add-on", async () => {
  const cartella = appFinta();
  const c = await unaConsole({ cartellaDellApp: cartella });
  try {
    const pagina = await c.chiedi("/");
    assert.equal(pagina.status, 200);
    assert.equal(pagina.headers.get("cache-control"), "no-store");
    assert.equal(pagina.headers.get("etag"), null);
    await pagina.text();
  } finally {
    await c.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* ── gdahome in un browser di casa, senza fare il giro del centralino ──────
 *
 * Il difetto era questo: un computer a tre metri dalla casa apriva gdahome
 * passando da internet, perche' in casa i file non li serviva nessuno. La
 * porta dell'app — l'unica che si raggiunge dalla rete di casa — aveva tre
 * sportelli e basta.
 *
 * Adesso serve anche i **pezzi**: quelli dell'app e quelli della plancia. La
 * *pagina* della plancia no, e non e' un dettaglio: quella ha le premesse
 * dentro e il cancello di chi la vede, e resta sulla porta dietro l'ingress.
 * Qui si tengono ferme entrambe le cose — quello che si serve, e quello che
 * non si serve.
 */

import { costruisciLaPortaDellApp } from "../src/server.js";

async function unaPortaDellApp({ cartellaDellApp, plancia } = {}) {
  const server = costruisciLaPortaDellApp({
    ponte: { quantiCollegati: () => 0 },
    portiere: { apri: () => {} },
    dispositivi: { quanti: () => 0 },
    abbinamento: {},
    cartellaDellApp,
    plancia,
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const dove = `http://127.0.0.1:${server.address().port}`;
  return {
    dove,
    chiedi: (via, opzioni) => fetch(`${dove}${via}`, { redirect: "manual", ...opzioni }),
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

/* Una plancia finta, con la stessa forma di quella vera: `cE`, e un `leggi`
 * che risponde per percorso. */
function planciaFinta() {
  return {
    cE: true,
    chieste: [],
    leggi(via) {
      this.chieste.push(via);
      if (via.endsWith("/legacy/dashboard.html"))
        return { stato: 200, tipo: "text/html; charset=utf-8", corpo: Buffer.from("<html>") };
      if (via.endsWith(".js"))
        return { stato: 200, tipo: "text/javascript; charset=utf-8", corpo: Buffer.from("//x") };
      return { stato: 404, tipo: "", corpo: Buffer.alloc(0) };
    },
  };
}

test("in casa l'app si apre da questa porta, senza passare da fuori", async () => {
  const cartella = appFinta();
  const porta = await unaPortaDellApp({ cartellaDellApp: cartella, plancia: planciaFinta() });
  try {
    /* La barra in fondo, come sull'altra porta: relativa, perche' qui davanti
     * non c'e' nessun prefisso e la' c'e' quello dell'ingress. */
    const senzaBarra = await porta.chiedi("/app");
    assert.equal(senzaBarra.status, 302);
    assert.equal(senzaBarra.headers.get("location"), "app/");

    const pagina = await porta.chiedi("/app/");
    assert.equal(pagina.status, 200);
    assert.match(await pagina.text(), /gdahome/);

    const suo = await porta.chiedi("/app/main.dart.js");
    assert.equal(suo.status, 200);
  } finally {
    await porta.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("e i file della plancia, che la pagina chiede per nome relativo", async () => {
  /* E' questo che rende inutile il service worker: la plancia i suoi file li
   * chiede relativi al `<base>`, e il `<base>` punta qui. Su `https` il
   * service worker serve perche' il centralino quei file non li ha; qui ce li
   * ha il ponte, sulla stessa origine. */
  const cartella = appFinta();
  const dm = planciaFinta();
  const porta = await unaPortaDellApp({ cartellaDellApp: cartella, plancia: dm });
  try {
    const uno = await porta.chiedi("/dashboardmodern_static/abc123/legacy/dashboard.html");
    assert.equal(uno.status, 200);
    assert.match(uno.headers.get("cache-control") || "", /immutable/);

    const due = await porta.chiedi("/dashboardmodern_static/abc123/src/core/qualcosa.js");
    assert.equal(due.status, 200);

    const niente = await porta.chiedi("/dashboardmodern_static/abc123/non-ci-sono.png");
    assert.equal(niente.status, 404);
  } finally {
    await porta.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("la pagina della plancia, col suo cancello, da qui non si apre", async () => {
  /* La riga che conta. `/plancia/…` ha dentro le premesse — quale istanza,
   * quale profilo, dove sta il WebSocket — e il cancello di chi la vede, che
   * si regge sull'utente che l'ingress mette nell'intestazione. Qui quell'utente
   * non c'e', quindi la pagina non c'e': ci sono i pezzi, non la pagina.
   * La pagina se la compone l'app, con le sue premesse. */
  const cartella = appFinta();
  const porta = await unaPortaDellApp({ cartellaDellApp: cartella, plancia: planciaFinta() });
  try {
    for (const via of ["/plancia", "/plancia/", "/plancia/mare/"]) {
      const suo = await porta.chiedi(via);
      assert.equal(suo.status, 404, `«${via}» non deve aprirsi da questa porta`);
    }
  } finally {
    await porta.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("da questa porta non si esce dalla cartella, e non si scrive niente", async () => {
  /* Questa porta puo' finire esposta a internet, quindi le due domande sono:
   * si puo' uscire dalla radice, e si puo' fare qualcosa oltre a leggere. */
  const cartella = appFinta();
  writeFileSync(join(dirname(cartella), "fuori-dalla-radice.txt"), "segreto");
  const porta = await unaPortaDellApp({ cartellaDellApp: cartella, plancia: planciaFinta() });
  try {
    for (const via of [
      "/app/../fuori-dalla-radice.txt",
      "/app/%2e%2e/fuori-dalla-radice.txt",
      "/app/..%2ffuori-dalla-radice.txt",
      "/dashboardmodern_static/../../etc/passwd",
    ]) {
      const suo = await porta.chiedi(via);
      assert.ok(suo.status >= 300, `«${via}» ha risposto ${suo.status}`);
      const detto = await suo.text();
      assert.equal(detto.includes("segreto"), false, `«${via}» ha fatto uscire il file`);
    }
    /* E solo GET: un POST su quei percorsi non e' una rotta, e cade dove
     * cadono tutte le richieste che questa porta non conosce. */
    for (const metodo of ["POST", "PUT", "DELETE"]) {
      const suo = await porta.chiedi("/app/index.html", { method: metodo });
      assert.notEqual(suo.status, 200, `${metodo} su un file non deve rispondere 200`);
    }
  } finally {
    await porta.spegni();
    rmSync(cartella, { recursive: true, force: true });
    rmSync(join(dirname(cartella), "fuori-dalla-radice.txt"), { force: true });
  }
});

test("senza l'app dentro, la porta lo dice invece di servire il vuoto", async () => {
  const porta = await unaPortaDellApp({ cartellaDellApp: "", plancia: null });
  try {
    assert.equal((await porta.chiedi("/app/")).status, 404);
    assert.equal(
      (await porta.chiedi("/dashboardmodern_static/x/legacy/dashboard.html")).status,
      404,
    );
    /* Ma i tre sportelli di sempre rispondono: non si e' rotto niente. */
    const salute = await porta.chiedi("/salute");
    assert.equal(salute.status, 200);
    assert.equal((await salute.json()).vivo, true);
  } finally {
    await porta.spegni();
  }
});
