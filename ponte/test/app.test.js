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
    /* La pagina si chiede ogni volta: e' quella che dice qual e' la versione,
     * e una tenuta in tasca vuol dire un aggiornamento che non si vede. */
    assert.equal(pagina.headers.get("cache-control"), "no-store");

    const programma = await c.chiedi("/app/main.dart.js");
    assert.equal(programma.status, 200);
    assert.match(programma.headers.get("content-type"), /^text\/javascript/);
    assert.equal(programma.headers.get("cache-control"), "public, max-age=3600");

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
