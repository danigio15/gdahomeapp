/* Le porte del ponte, contro chi bussa storto.
 *
 * La console risponde solo al proxy dell'ingress, e solo a chi amministra; la
 * porta dell'app non cade per una domanda storta e non tiene aperti fili senza
 * nome; le risposte dicono al browser come leggerle; il prefisso dell'ingress
 * e le premesse della plancia non diventano pezzi di pagina; il filo col
 * centralino regge i messaggi grossi; e un telefono staccato si ricorda la sua
 * chiave per sentirsi dire di no in modo credibile.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Chiamata, DAL_CENTRALINO } from "../src/chiamata.js";
import { Dispositivi } from "../src/dispositivi.js";
import { conLePremesse, perLoScript } from "../src/premesse.js";
import { Plancia } from "../src/plancia.js";
import { SaliteSenzaNome } from "../src/presa.js";
import {
  costruisciLaConsole,
  costruisciLaPortaDellApp,
  daLIngress,
  prefissoDellIngress,
  rotta,
} from "../src/server.js";

const CONSOLE = fileURLToPath(new URL("../console", import.meta.url));
const CHI_AMMINISTRA = "chi-amministra";
const UN_OSPITE = "un-ospite";

/* Una console col minimo che le serve per rispondere a `/api/stato`. */
async function unaConsole({ proxyDellIngress = ["127.0.0.1"], cartellaDellApp = "" } = {}) {
  const server = costruisciLaConsole({
    ponte: { collegatiPerDispositivo: () => new Map() },
    casa: { saluta: async () => ({ viva: true }) },
    dispositivi: { elenco: () => [], quanti: () => 0 },
    abbinamento: { stato: () => ({ attivo: false }), nuovo: () => ({ codice: "X" }) },
    opzioni: { portaDellApp: 8098, dispositiviMassimi: 10 },
    utenti: { amministratore: async (chi) => chi === CHI_AMMINISTRA },
    cartellaDellaConsole: CONSOLE,
    cartellaDellApp,
    /* `null` vuol dire «quello di serie», cioe' il proxy del Supervisor. */
    ...(proxyDellIngress === null ? {} : { proxyDellIngress }),
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const dove = `http://127.0.0.1:${server.address().port}`;
  return {
    dove,
    chiedi: (via, chi = CHI_AMMINISTRA, opzioni = {}) =>
      fetch(`${dove}${via}`, {
        redirect: "manual",
        ...opzioni,
        headers: { ...(chi ? { "x-remote-user-id": chi } : {}), ...(opzioni.headers || {}) },
      }),
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

/* ─── Chi arriva alla console ────────────────────────────────────────────── */

test("alla console arriva solo il proxy dell'ingress, anche scritto alla IPv6", () => {
  assert.equal(daLIngress("172.30.32.2"), true);
  assert.equal(daLIngress("::ffff:172.30.32.2"), true);
  assert.equal(daLIngress("172.30.32.1"), false);
  assert.equal(daLIngress("172.30.33.5"), false);
  assert.equal(daLIngress(""), false);
  assert.equal(daLIngress(undefined), false);
  /* Una lista vuota non fa entrare nessuno. */
  assert.equal(daLIngress("172.30.32.2", []), false);
  assert.equal(daLIngress("127.0.0.1", ["127.0.0.1"]), true);
});

test("da un altro indirizzo la console non risponde, e il filo della plancia non si apre", async () => {
  /* La prova bussa da `127.0.0.1`: col proxy vero del Supervisor, e' uno
   * qualunque — cioe' un altro contenitore che si scrive da se' chi e'. */
  const c = await unaConsole({ proxyDellIngress: null });
  try {
    for (const via of ["/", "/api/stato", "/api/codice", "/plancia/"]) {
      const risposta = await c.chiedi(via);
      assert.equal(risposta.status, 403, via);
    }
    const presa = new WebSocket(`${c.dove.replace("http", "ws")}/plancia/api/websocket`);
    const come = await new Promise((ok) => {
      presa.addEventListener("open", () => ok("aperta"));
      presa.addEventListener("error", () => ok("rifiutata"));
    });
    assert.equal(come, "rifiutata");
  } finally {
    await c.spegni();
  }
});

test("la console e le sue vie sono di chi amministra", async () => {
  const c = await unaConsole();
  try {
    assert.equal((await c.chiedi("/api/stato")).status, 200);
    for (const [metodo, via] of [
      ["GET", "/api/stato"],
      ["GET", "/api/codice"],
      ["POST", "/api/codice"],
      ["DELETE", "/api/codice"],
      ["GET", "/api/qr.svg"],
      ["POST", "/api/aggiornamento"],
      ["PATCH", "/api/plance"],
      ["DELETE", "/api/dispositivi/dm_qualunque"],
      ["POST", "/api/cruscotto/biglietto"],
      ["DELETE", "/api/quadro"],
    ]) {
      for (const chi of [UN_OSPITE, ""]) {
        const risposta = await c.chiedi(via, chi, { method: metodo });
        assert.equal(risposta.status, 403, `${metodo} ${via} da ${chi || "nessuno"}`);
      }
    }
    /* La pagina, a chi non amministra: glielo si dice, e basta. */
    const pagina = await c.chiedi("/", UN_OSPITE);
    assert.equal(pagina.status, 403);
    const testo = await pagina.text();
    assert.match(testo, /Solo per gli amministratori/);
    assert.ok(!testo.includes("console.js"), "la console vera non arriva");
    /* E a chi amministra, la console. */
    assert.match(await (await c.chiedi("/")).text(), /<h1>gdahome<\/h1>/);
  } finally {
    await c.spegni();
  }
});

test("le risposte dicono al browser come leggerle, e chi le puo' incorniciare", async () => {
  const c = await unaConsole();
  try {
    for (const via of ["/", "/api/stato", "/non-c-e"]) {
      const risposta = await c.chiedi(via);
      assert.equal(risposta.headers.get("x-content-type-options"), "nosniff", via);
      assert.equal(risposta.headers.get("referrer-policy"), "no-referrer", via);
      assert.equal(risposta.headers.get("content-security-policy"), "frame-ancestors 'self'", via);
    }
  } finally {
    await c.spegni();
  }
});

/* ─── Il prefisso dell'ingress ──────────────────────────────────────────── */

test("il prefisso dell'ingress vale solo se ha la forma che gli da' il Supervisor", () => {
  const buono = "/api/hassio_ingress/AbC-12_x";
  assert.equal(prefissoDellIngress({ headers: { "x-ingress-path": buono } }), buono);
  for (const cattivo of [
    '/api/hassio_ingress/x"><script>alert(1)</script>',
    "/api/hassio_ingress/../../x",
    "//altrove.it/x",
    "javascript:alert(1)",
    "/api/hassio_ingress/",
  ]) {
    assert.equal(prefissoDellIngress({ headers: { "x-ingress-path": cattivo } }), "", cattivo);
  }
  /* Un prefisso storto non si toglie nemmeno dal percorso. */
  assert.equal(rotta({ url: "/x/api/stato", headers: { "x-ingress-path": "/x" } }), "/x/api/stato");
});

test("nelle premesse della plancia un `</script>` resta una stringa", () => {
  assert.equal(
    perLoScript("</script><script>x()</script>&\u2028\u2029"),
    '"\\u003c/script\\u003e\\u003cscript\\u003ex()\\u003c/script\\u003e\\u0026\\u2028\\u2029"',
  );
  /* Quello che si legge in JavaScript e' lo stesso di prima. */
  assert.equal(JSON.parse(perLoScript("a</script>b")), "a</script>b");
  const pagina = conLePremesse("<html><head></head><body></body></html>", {
    base: '/x"><script>y()</script>',
    quale: { istanza: "</script><script>z()</script>", profilo: "primary" },
    lingua: "it",
    doveIlWebSocket: "/plancia/api/websocket</script>",
    vesti: { velo: "</script>", testata: "Casa </script>" },
  });
  assert.equal((pagina.match(/<script/gi) || []).length, 2, "gli script sono i nostri due");
  assert.ok(!pagina.includes('"><script>y()'));
});

/* ─── La porta dell'app ──────────────────────────────────────────────────── */

test("una cartella chiesta come file non fa cadere il ponte", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "app-cartelle-"));
  mkdirSync(join(cartella, "assets", "fonts"), { recursive: true });
  writeFileSync(join(cartella, "index.html"), "<!doctype html><title>gdahome</title>");
  const accanto = `${cartella}-vecchia`;
  mkdirSync(accanto, { recursive: true });
  writeFileSync(join(accanto, "segreto.txt"), "no");
  const server = costruisciLaPortaDellApp({
    portiere: { accogli() {} },
    registro: { info() {}, attenzione() {}, errore() {} },
    cartellaDellApp: cartella,
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const dove = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const via of ["/app/assets", "/app/assets/", "/app/assets/fonts"]) {
      assert.equal((await fetch(`${dove}${via}`)).status, 404, via);
    }
    /* Ancora in piedi, e ancora al suo posto. */
    const pagina = await fetch(`${dove}/app/`);
    assert.equal(pagina.status, 200);
    assert.equal(pagina.headers.get("x-content-type-options"), "nosniff");
    assert.equal(pagina.headers.get("cross-origin-opener-policy"), "same-origin");
    assert.equal(pagina.headers.get("referrer-policy"), "same-origin");
    assert.equal(pagina.headers.get("content-security-policy"), "frame-ancestors 'self'");
    const salute = await fetch(`${dove}/salute`);
    assert.deepEqual(await salute.json(), { vivo: true });
    assert.equal(salute.headers.get("x-content-type-options"), "nosniff");
  } finally {
    await new Promise((ok) => server.close(ok));
    rmSync(cartella, { recursive: true, force: true });
    rmSync(accanto, { recursive: true, force: true });
  }
});

test("il logo si serve col tipo dei suoi byte, e come immagine e basta", async () => {
  const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>');
  const plancia = new Plancia({
    installatore: () => ({ nome: "Impianti Rossi", logo: SVG, tipo: "image/svg+xml" }),
  });
  const server = costruisciLaPortaDellApp({
    portiere: { accogli() {} },
    registro: { info() {}, attenzione() {}, errore() {} },
    plancia,
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  try {
    const logo = await fetch(
      `http://127.0.0.1:${server.address().port}${plancia.base}/legacy/logo.png`,
    );
    assert.equal(logo.status, 200);
    assert.notEqual(logo.headers.get("content-type"), "image/svg+xml");
    assert.match(logo.headers.get("content-type"), /^image\/(png|jpeg|webp)/);
    assert.equal(logo.headers.get("x-content-type-options"), "nosniff");
    assert.equal(logo.headers.get("content-security-policy"), "default-src 'none'; sandbox");
    assert.ok(!Buffer.from(await logo.arrayBuffer()).equals(SVG));
  } finally {
    await new Promise((ok) => server.close(ok));
  }
});

test("i fili senza nome si contano per rete /64, e la casa ha i suoi posti", () => {
  const salite = new SaliteSenzaNome({ perIndirizzo: 2, inTutto: 3, inCasa: 2, attesa: 1000 });
  const unaPresa = () => ({ chiudi() {}, socket: { once() {} } });
  salite.tieni(unaPresa(), "2001:db8:1:2::1");
  salite.tieni(unaPresa(), "2001:db8:1:2::abcd");
  assert.equal(salite.cePosto("2001:db8:1:2:ffff::1"), false, "stessa rete /64");
  salite.tieni(unaPresa(), "2001:db8:9:9::1");
  assert.equal(salite.cePosto("198.51.100.7"), false, "da fuori la fila e' piena");
  /* Ma il telefono sul divano entra lo stesso. */
  for (const inCasa of ["192.168.1.20", "10.0.0.5", "::ffff:172.16.3.4", "fe80::1", "fd00::5"]) {
    assert.equal(salite.cePosto(inCasa), true, inCasa);
  }
  salite.tieni(unaPresa(), "192.168.1.20");
  salite.tieni(unaPresa(), "192.168.1.21");
  assert.equal(salite.cePosto("192.168.1.22"), false, "anche la fila di casa ha un tetto");
});

test("i fili senza nome hanno un tetto, per indirizzo e in tutto, e un tempo", (contesto) => {
  contesto.mock.timers.enable({ apis: ["setTimeout"] });
  const salite = new SaliteSenzaNome({ perIndirizzo: 2, inTutto: 3, attesa: 1000 });
  const unaPresa = () => {
    const chiusure = [];
    const ascolti = [];
    return {
      chiusure,
      chiudi: (codice) => chiusure.push(codice),
      socket: { once: (_che, fai) => ascolti.push(fai) },
      cade: () => ascolti.forEach((fai) => fai()),
    };
  };
  const a = unaPresa();
  const b = unaPresa();
  salite.tieni(a, "1.1.1.1");
  salite.tieni(b, "1.1.1.1");
  assert.equal(salite.cePosto("1.1.1.1"), false, "due dallo stesso indirizzo bastano");
  assert.equal(salite.cePosto("2.2.2.2"), true);
  const c = unaPresa();
  salite.tieni(c, "2.2.2.2");
  assert.equal(salite.cePosto("3.3.3.3"), false, "e tre in tutto");

  /* Chi si presenta smette di contare, e il suo tempo non scade. */
  a._quandoPresentata();
  assert.equal(salite.cePosto("1.1.1.1"), true);
  /* Chi cade da se' libera il posto. */
  c.cade();
  assert.equal(salite.quanti, 1);
  /* Chi tace oltre il tempo viene chiuso. */
  contesto.mock.timers.tick(1001);
  assert.deepEqual(a.chiusure, []);
  assert.deepEqual(b.chiusure, [1008]);
  assert.equal(salite.quanti, 0);
});

/* ─── Il filo col centralino ─────────────────────────────────────────────── */

test("il filo col centralino regge i messaggi grossi, e la porta dei telefoni non abbina", () => {
  const aperte = [];
  class PresaFinta extends EventTarget {
    constructor(dove, opzioni) {
      super();
      aperte.push({ dove, opzioni, presa: this });
    }
    send() {}
    close() {}
  }
  const accolti = [];
  const chiamata = new Chiamata({
    dove: "wss://centralino.finto",
    identita: { casa: "casa_prova", segreto: "s" },
    portiere: { accogli: (canale, come) => accolti.push(come) },
    registro: { info() {}, attenzione() {}, errore() {} },
    Presa: PresaFinta,
  });
  chiamata.avvia();
  try {
    assert.equal(aperte[0].opzioni.messaggioMassimo, DAL_CENTRALINO);
    assert.ok(DAL_CENTRALINO >= 4 * 1024 * 1024);
    const dice = (detto) =>
      aperte[0].presa.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(detto) }));
    dice({ t: "bene" });
    dice({ t: "apri", c: 1, da: "x", via: "telefono" });
    dice({ t: "apri", c: 2, da: "y", via: "abbinamento" });
    dice({ t: "apri", c: 3, da: "z" });
    assert.deepEqual(
      accolti.map((uno) => uno.abbina),
      [false, true, true],
    );
  } finally {
    chiamata.spegni();
  }
});

/* ─── I telefoni staccati ────────────────────────────────────────────────── */

test("di un telefono staccato si ricorda la chiave, e solo quella, per un po'", () => {
  const cartella = mkdtempSync(join(tmpdir(), "revocati-"));
  let ora = 1_000_000_000;
  try {
    const dispositivi = new Dispositivi({ cartella, adesso: () => ora, giorniDiSilenzio: 90 });
    const uno = dispositivi.abbina({ nome: "uno" });
    const due = dispositivi.abbina({ nome: "due" });
    assert.equal(dispositivi.chiaveRevocataDi(uno.dispositivo.id), null, "e' ancora abbinato");
    dispositivi.stacca(uno.dispositivo.id);
    assert.equal(dispositivi.chiaveRevocataDi(uno.dispositivo.id), uno.chiave);
    /* Sul disco la chiave c'e', il segno e la sua impronta no. */
    const riletto = new Dispositivi({ cartella, adesso: () => ora, giorniDiSilenzio: 90 });
    const tenuto = riletto.archivio.dati.revocati.find((x) => x.id === uno.dispositivo.id);
    assert.deepEqual(Object.keys(tenuto).sort(), ["chiave", "id", "staccatoIl"]);
    assert.equal(riletto.chiaveRevocataDi(uno.dispositivo.id), uno.chiave);
    /* Anche chi se ne va da se', perche' sparito da troppo tempo. */
    ora += 91 * 24 * 60 * 60 * 1000;
    assert.equal(riletto.potatura(), 1);
    assert.equal(riletto.chiaveRevocataDi(due.dispositivo.id), due.chiave);
    /* E dopo sei mesi, piu' niente. */
    ora += 181 * 24 * 60 * 60 * 1000;
    assert.equal(riletto.chiaveRevocataDi(due.dispositivo.id), null);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
