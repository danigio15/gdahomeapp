/* La porta del quadro, chiusa bene.
 *
 * Le cose che non si vedono finche' qualcuno non le cerca: chi scrive nella
 * pagina di un altro, chi bussa mille volte al minuto, chi manda un avviso a
 * una macchina di dentro, chi guarda `/salute` per sapere cosa c'e' dietro.
 * Ognuna ha la sua prova, e ognuna cadrebbe tornando a com'era.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";
import { costruisciIlServer } from "../src/server.js";
import { eVietato, Fattorino } from "../src/fattorino.js";
import { Freno } from "../src/freno.js";
import { APERTI_AL_MASSIMO, PlanceDelleCase, UNA_CASA_AL_MASSIMO } from "../src/plance.js";
import { ilSegnoDi } from "../src/segni.js";

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function banco(opzioni = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "porta-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
    ...opzioni,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;
  const gestore = (via, o = {}) =>
    fetch(`${dove}/gestore${via}`, {
      ...o,
      headers: { authorization: `Bearer ${CHIAVE_DEL_GESTORE}`, ...(o.headers || {}) },
    });
  const iscrivi = async (nome) =>
    (await gestore("/installatori", { method: "POST", body: JSON.stringify({ nome }) })).json();
  const retro = (chiave, via, o = {}) =>
    fetch(`${dove}/console${via}`, {
      ...o,
      headers: { authorization: `Bearer ${chiave}`, ...(o.headers || {}) },
    });
  const unCodice = async (chiave) =>
    (await (await retro(chiave, "/inviti", { method: "POST", body: "{}" })).json()).codice;
  const deposita = (casa, codice, carta = { ogni: 1 }) =>
    fetch(`${dove}/rapporto`, {
      method: "POST",
      headers: { authorization: `Bearer ${codice}`, "x-casa": casa },
      body: JSON.stringify(carta),
    });
  return {
    ...acceso,
    cartella,
    dove,
    gestore,
    iscrivi,
    retro,
    unCodice,
    deposita,
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

/* ─── Le icone degli aggiornamenti: ognuno le sue ─────────────────────── */

test("l'icona e le note mandate da una casa di Bianchi non arrivano a Rossi", async () => {
  const b = await banco();
  try {
    const rossi = await b.iscrivi("Rossi");
    const bianchi = await b.iscrivi("Bianchi");
    const riga = { nome: "Mosquitto broker", da: "6.5.1", a: "6.5.2" };
    const segno = ilSegnoDi(riga.nome, riga.a);
    /* La casa di Bianchi dice di avere Mosquitto e manda la sua roba. */
    const diBianchi = await b.unCodice(bianchi.chiave);
    await b.deposita(ALTRA, diBianchi, {
      aggiornamenti: {
        quanti: 1,
        elenco: [{ ...riga, segno, logo: PNG.toString("base64"), leNote: "roba di Bianchi" }],
      },
    });
    /* La casa di Rossi ha lo stesso aggiornamento: a lui non arriva niente. */
    const diRossi = await b.unCodice(rossi.chiave);
    const detto = await (
      await b.deposita(UNA, diRossi, { aggiornamenti: { quanti: 1, elenco: [{ ...riga, segno }] } })
    ).json();
    assert.deepEqual(detto.manca, [segno], "Rossi deve chiederla alla sua casa");
    assert.equal((await fetch(`${b.dove}/segno/${rossi.chi}/${segno}`)).status, 404);
    assert.equal((await b.retro(rossi.chiave, `/note/${segno}`)).status, 404);
    /* Bianchi invece la vede, nella sua cartella. */
    assert.equal((await fetch(`${b.dove}/segno/${bianchi.chi}/${segno}`)).status, 200);
    assert.equal(
      (await (await b.retro(bianchi.chiave, `/note/${segno}`)).json()).note,
      "roba di Bianchi",
    );
    /* E l'indirizzo di una volta, senza installatore, non c'e' piu'. */
    assert.equal((await fetch(`${b.dove}/segno/${segno}`)).status, 404);
  } finally {
    await b.chiudi();
  }
});

/* ─── Il freno ────────────────────────────────────────────────────────── */

test("il freno: un secchio che si riempie a passo fisso", () => {
  let ora = 0;
  const freno = new Freno({ quanti: 3, ogni: 1000, adesso: () => ora });
  assert.equal(freno.passa("a"), 0);
  assert.equal(freno.passa("a"), 0);
  assert.equal(freno.passa("a"), 0);
  assert.ok(freno.passa("a") > 0, "il quarto di fila aspetta");
  assert.equal(freno.passa("b"), 0, "gli altri non ne risentono");
  ora += 1000;
  assert.equal(freno.passa("a"), 0, "dopo un passo ne torna uno");
  assert.ok(freno.passa("a") > 0);
  const pochi = new Freno({ chiAlMassimo: 2, adesso: () => ora });
  pochi.passa("x");
  pochi.passa("y");
  pochi.passa("z");
  assert.equal(pochi._secchi.size, 2, "i secchi hanno un tetto anche loro");
});

test("una casa che manda rapporti a raffica si sente dire 429, e le altre no", async () => {
  const b = await banco();
  try {
    const rossi = await b.iscrivi("Rossi");
    const codice = await b.unCodice(rossi.chiave);
    const stati = [];
    for (let i = 0; i < 10; i += 1) stati.push((await b.deposita(UNA, codice)).status);
    assert.ok(
      stati.slice(0, 6).every((uno) => uno === 200),
      `i primi passano: ${stati}`,
    );
    assert.equal(stati.at(-1), 429);
    const frenato = await b.deposita(UNA, codice);
    assert.ok(Number(frenato.headers.get("retry-after")) > 0, "dice fra quanto riprovare");
    /* Un'altra casa non ne risente. */
    assert.equal((await b.deposita(ALTRA, await b.unCodice(rossi.chiave))).status, 200);
    /* E chi non ha la chiave non consuma i gettoni di nessuno: il freno si
     * guarda dopo. */
    assert.equal((await b.deposita(ALTRA, "UNA-CHIAVE-SBAGLIATA")).status, 403);
  } finally {
    await b.chiudi();
  }
});

/* ─── Le plance: un tetto per casa, e poche aperte in memoria ─────────── */

test("le plance di una casa hanno un tetto, e in memoria ne restano aperte poche", () => {
  const cartella = mkdtempSync(join(tmpdir(), "plance-"));
  try {
    const plance = new PlanceDelleCase({ cartella });
    const grossa = { dentro: "x".repeat(Math.ceil(UNA_CASA_AL_MASSIMO / 3)) };
    assert.ok(plance.prendi(UNA, { profilo: "uno", revisione: 1, valori: grossa }));
    assert.ok(plance.prendi(UNA, { profilo: "due", revisione: 1, valori: grossa }));
    assert.equal(
      plance.prendi(UNA, { profilo: "tre", revisione: 1, valori: grossa }),
      null,
      "la terza fa passare il tetto della casa",
    );
    assert.equal(plance.scatto(UNA, "tre"), null, "e non resta niente a meta'");
    assert.ok(plance.scatto(UNA, "uno"), "quello che c'era resta");
    /* Tante case: in memoria se ne tiene un numero fisso. */
    for (let i = 0; i < APERTI_AL_MASSIMO + 10; i += 1) {
      const casa = `casa_${String(i).padStart(32, "0")}`;
      plance.prendi(casa, { profilo: "primary", revisione: 1, valori: { a: 1 } });
    }
    assert.equal(plance._aperti.size, APERTI_AL_MASSIMO);
    /* E quello che e' uscito dalla memoria si rilegge dal disco. */
    assert.equal(plance.scatto(`casa_${"0".repeat(32)}`, "primary").revisione, 1);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* ─── Le porte dell'editor che non dicono chi sono ────────────────────── */

/* Una salita a WebSocket fatta a mano, per poterle mettere addosso
 * l'intestazione che mette Caddy. Torna lo stato della risposta: 101 se si
 * apre, e la presa resta aperta finche' non la si chiude. */
function sali(porta, via, testate = {}) {
  return new Promise((ok) => {
    const richiesta = httpRequest({
      host: "127.0.0.1",
      port: porta,
      path: via,
      headers: {
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        "sec-websocket-key": randomBytes(16).toString("base64"),
        ...testate,
      },
    });
    richiesta.on("upgrade", (risposta, presa) => ok({ stato: 101, presa }));
    richiesta.on("response", (risposta) => {
      risposta.resume();
      ok({ stato: risposta.statusCode });
    });
    richiesta.on("error", () => ok({ stato: 0 }));
    richiesta.end();
  });
}

test("le porte dell'editor aperte senza dire chi si e' hanno un tetto, per indirizzo vero", async () => {
  const b = await banco();
  const prese = [];
  try {
    const rossi = await b.iscrivi("Rossi");
    const via = `/plancia-da-lontano/${UNA}/primary/websocket`;
    /* Una casa che non c'e' non ha editor: la porta non si apre nemmeno. */
    assert.equal((await sali(b.porta, via)).stato, 404);
    const codice = await b.unCodice(rossi.chiave);
    await b.deposita(UNA, codice, { configurazione: false });
    assert.equal((await sali(b.porta, via)).stato, 404, "e nemmeno una che non lo permette");
    await b.deposita(UNA, codice, { configurazione: true });

    const apri = async (testate) => {
      const detto = await sali(b.porta, via, testate);
      if (detto.presa) prese.push(detto.presa);
      return detto.stato;
    };
    /* Da fuori passa tutto da Caddy: il socket e' sempre 127.0.0.1, e
     * l'indirizzo vero e' l'ultimo di `x-forwarded-for`. */
    const da = (chi) => ({ "x-forwarded-for": `10.9.9.9, ${chi}` });
    const esiti = [];
    for (let i = 0; i < 6; i += 1) esiti.push(await apri(da("203.0.113.7")));
    assert.deepEqual(esiti, [101, 101, 101, 101, 503, 503], "dallo stesso se ne tengono quattro");
    /* Un altro, sempre dietro Caddy, entra lo stesso: il tetto non e' di tutti. */
    assert.equal(await apri(da("198.51.100.4")), 101);
    /* E un IPv6 si conta per /64: cambiare le ultime cifre non da' altri posti. */
    const sei = [];
    for (let i = 1; i <= 5; i += 1) sei.push(await apri(da(`2001:db8:1:2::${i}`)));
    assert.deepEqual(sei, [101, 101, 101, 101, 503]);
  } finally {
    for (const presa of prese) presa.destroy();
    await b.chiudi();
  }
});

test("l'indirizzo vero: x-forwarded-for si crede solo da questa macchina", async () => {
  const { daChi, perContare } = await import("../src/indirizzo.js");
  const da = (remoteAddress, xff) => ({
    socket: { remoteAddress },
    headers: xff ? { "x-forwarded-for": xff } : {},
  });
  assert.equal(daChi(da("127.0.0.1", "1.1.1.1, 203.0.113.7")), "203.0.113.7", "l'ultimo, di Caddy");
  assert.equal(daChi(da("203.0.113.9", "1.1.1.1")), "203.0.113.9", "da fuori non si crede");
  assert.equal(daChi(da("127.0.0.1", "non un indirizzo")), "127.0.0.1");
  assert.equal(perContare("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
  assert.equal(perContare("::ffff:198.51.100.4"), "198.51.100.4");
});

/* ─── Le testate ──────────────────────────────────────────────────────── */

test("le pagine hanno la loro politica, e ogni risposta le testate di serie", async () => {
  const b = await banco();
  try {
    const cruscotto = await fetch(`${b.dove}/console/`);
    const politica = cruscotto.headers.get("content-security-policy");
    assert.match(politica, /object-src 'none'/);
    assert.match(politica, /base-uri 'none'/);
    assert.match(politica, /script-src 'sha256-[A-Za-z0-9+/=]+'/, "gli script per impronta");
    assert.doesNotMatch(politica, /script-src[^;]*unsafe-inline/);
    /* Il cruscotto e la gestione stanno dentro una voce della barra laterale
     * di Home Assistant: si lasciano mettere in un riquadro. */
    assert.match(politica, /frame-ancestors \*/);
    assert.equal(cruscotto.headers.get("x-content-type-options"), "nosniff");
    assert.equal(cruscotto.headers.get("referrer-policy"), "no-referrer");
    const gestione = await fetch(`${b.dove}/gestore/`);
    assert.match(gestione.headers.get("content-security-policy"), /frame-ancestors \*/);
    assert.equal(gestione.headers.get("x-frame-options"), null);
    /* Le testate di serie anche su una risposta JSON qualunque. */
    const salute = await fetch(`${b.dove}/salute`);
    assert.equal(salute.headers.get("x-content-type-options"), "nosniff");
    assert.equal(salute.headers.get("referrer-policy"), "no-referrer");
  } finally {
    await b.chiudi();
  }
});

test("l'impronta dello script e' quella dello script che c'e' nella pagina", async () => {
  const { createHash } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const pagina = readFileSync(new URL("../console/index.html", import.meta.url), "utf8");
  const script = /<script>([\s\S]*?)<\/script>/.exec(pagina)[1];
  const impronta = createHash("sha256").update(script, "utf8").digest("base64");
  const b = await banco();
  try {
    const politica = (await fetch(`${b.dove}/console/`)).headers.get("content-security-policy");
    assert.ok(politica.includes(`'sha256-${impronta}'`), "il browser non farebbe girare la pagina");
  } finally {
    await b.chiudi();
  }
});

test("con QUADRO_OSPITI il cruscotto si stringe a quelli, e la pagina li sa", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "ospiti-"));
  const server = costruisciIlServer({
    case: { alLavoro: null, lista: [], quella: () => null },
    chiavi: {},
    installatori: { lista: [] },
    cartella,
    ospiti: ["https://casa.esempio.it"],
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  try {
    const risposta = await fetch(`http://127.0.0.1:${server.address().port}/console/`);
    assert.match(
      risposta.headers.get("content-security-policy"),
      /frame-ancestors 'self' https:\/\/casa\.esempio\.it/,
    );
    assert.match(
      await risposta.text(),
      /<meta name="gdahome-ospiti" content="https:\/\/casa\.esempio\.it"/,
    );
  } finally {
    server.close();
    rmSync(cartella, { recursive: true, force: true });
  }
});

/* ─── Gli avvisi non vanno dentro ─────────────────────────────────────── */

test("un avviso non va a un indirizzo di dentro, nemmeno passando da un nome", async () => {
  for (const vietato of [
    "127.0.0.1",
    "10.0.0.8",
    "172.16.4.4",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fd12::1",
    "::ffff:127.0.0.1",
    /* E ogni IPv4 vestito da IPv6, anche di fuori: mappato, tradotto, NAT64. */
    "::ffff:8.8.8.8",
    "::ffff:0:8.8.8.8",
    "64:ff9b::808:808",
    "::8.8.8.8",
  ]) {
    assert.equal(eVietato(vietato), true, vietato);
  }
  for (const buono of ["1.1.1.1", "149.154.167.220", "2606:4700::1111"]) {
    assert.equal(eVietato(buono), false, buono);
  }

  const partiti = [];
  const fattorino = (indirizzi) =>
    new Fattorino({
      risolvi: async () =>
        indirizzi.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
      prendi: async (dove, opzioni) => {
        partiti.push({ dove, opzioni });
        return { ok: true, status: 200 };
      },
    });
  const detto = { testo: "prova", tipo: "prova", case: [] };
  /* Un nome che risolve dentro: non parte niente. */
  assert.equal(await fattorino(["127.0.0.1"]).porta("https://avvisi.esempio.it/x", detto), false);
  /* Un nome che risolve fuori e dentro insieme: nemmeno. */
  assert.equal(
    await fattorino(["1.1.1.1", "10.0.0.1"]).porta("https://avvisi.esempio.it/x", detto),
    false,
  );
  assert.equal(partiti.length, 0);
  /* Solo https, e niente nome e parola d'ordine dentro l'indirizzo. */
  assert.equal(await fattorino(["1.1.1.1"]).porta("http://avvisi.esempio.it/x", detto), false);
  assert.equal(
    await fattorino(["1.1.1.1"]).porta("https://io:segreto@avvisi.esempio.it/", detto),
    false,
  );
  /* Fuori si', e un rimando non si segue. */
  assert.equal(await fattorino(["1.1.1.1"]).porta("https://avvisi.esempio.it/x", detto), true);
  assert.equal(partiti[0].opzioni.redirect, "manual");
});

test("la prova degli avvisi dice si' o no e basta, e non si fa a raffica", async () => {
  const b = await banco();
  try {
    const rossi = await b.iscrivi("Rossi");
    await b.retro(rossi.chiave, "/io/avvisi", {
      method: "PUT",
      body: JSON.stringify({ dove: "https://127.0.0.1/avvisi" }),
    });
    const risposte = [];
    for (let i = 0; i < 4; i += 1) {
      const una = await b.retro(rossi.chiave, "/io/avvisi/prova", { method: "POST" });
      risposte.push({ stato: una.status, corpo: await una.json() });
    }
    assert.deepEqual(risposte[0], { stato: 200, corpo: { arrivato: false } });
    assert.equal(risposte.at(-1).stato, 429, "la quarta di fila aspetta");
  } finally {
    await b.chiudi();
  }
});

/* ─── /salute ─────────────────────────────────────────────────────────── */

test("/salute da fuori dice solo che e' vivo; per intero da qui e dalla gestione", async () => {
  const b = await banco();
  try {
    await b.iscrivi("Rossi");
    /* Da fuori: passa da Caddy, che mette `x-forwarded-for`. */
    const daFuori = await (
      await fetch(`${b.dove}/salute`, { headers: { "x-forwarded-for": "203.0.113.9" } })
    ).json();
    assert.deepEqual(daFuori, { vivo: true });
    /* Da questa macchina, senza nessuno in mezzo: per intero. */
    const daQui = await (await fetch(`${b.dove}/salute`)).json();
    assert.equal(daQui.installatori, 1);
    /* E dalla gestione, con la sua chiave. */
    const dallaGestione = await (await b.gestore("/salute")).json();
    assert.equal(dallaGestione.installatori, 1);
    assert.equal((await fetch(`${b.dove}/gestore/salute`)).status, 401);
  } finally {
    await b.chiudi();
  }
});

test("col tramite vecchio, che dice ancora «telefoni», il numero non si perde", async () => {
  /* «Cosa significa 22 telefoni? L'app non è presente in 22 dispositivi.»
   *
   * Non lo era: quel numero contava i canali aperti in quell'istante. Adesso
   * si chiama col suo nome, ma il tramite e il quadro si aggiornano ognuno per
   * conto suo — e per il tempo in cui uno è avanti e l'altro indietro, la
   * mattonella deve dire il numero vecchio invece di restare a zero. */
  const { createServer } = await import("node:http");
  const vecchio = createServer((_q, r) => {
    r.writeHead(200, { "content-type": "application/json" });
    r.end(JSON.stringify({ vivo: true, acceso_da: 60, case: 3, telefoni: 9 }));
  });
  await new Promise((ok) => vecchio.listen(0, "127.0.0.1", ok));
  const b = await banco({ saluteDelTramite: `http://127.0.0.1:${vecchio.address().port}/salute` });
  try {
    const detto = await (await b.gestore("/salute")).json();
    assert.equal(detto.tramite.collegamenti, 9, "il numero vecchio vale come collegamenti");
    assert.equal(detto.tramite.app, null, "ma le app quel tramite non le sa, e non se le inventa");
  } finally {
    await b.chiudi();
    vecchio.close();
  }
});

test("la gestione vede anche i numeri del tramite, presi uno per uno", async () => {
  const { createServer } = await import("node:http");
  const tramite = createServer((_q, r) => {
    r.writeHead(200, { "content-type": "application/json" });
    r.end(
      JSON.stringify({
        vivo: true,
        acceso_da: 120,
        case: 131,
        collegamenti: 22,
        app: 7,
        segnalazioni: true,
        chat: { linee: 5, console: true },
        posta: false,
        /* Quello che non e' nell'elenco non passa. */
        altro: "<img src=x onerror=alert(1)>",
      }),
    );
  });
  await new Promise((ok) => tramite.listen(0, "127.0.0.1", ok));
  const b = await banco({ saluteDelTramite: `http://127.0.0.1:${tramite.address().port}/salute` });
  try {
    const detto = await (await b.gestore("/salute")).json();
    assert.deepEqual(detto.tramite, {
      vivo: true,
      accesoDa: 120,
      case: 131,
      collegamenti: 22,
      app: 7,
      segnalazioni: true,
      chat: 5,
      console: true,
      posta: false,
    });
    /* Da fuori, niente: ne' del quadro ne' del tramite. */
    const daFuori = await (
      await fetch(`${b.dove}/salute`, { headers: { "x-forwarded-for": "203.0.113.9" } })
    ).json();
    assert.deepEqual(daFuori, { vivo: true });
  } finally {
    await b.chiudi();
    await new Promise((ok) => tramite.close(ok));
  }
});

test("senza tramite su questa macchina la gestione lo dice, e non si ferma", async () => {
  const b = await banco({ saluteDelTramite: "http://127.0.0.1:1/salute" });
  try {
    const detto = await (await b.gestore("/salute")).json();
    assert.equal(detto.tramite, null);
    assert.equal(detto.vivo, true);
  } finally {
    await b.chiudi();
  }
});

/* ─── Dove ascolta ────────────────────────────────────────────────────── */

test("di serie il quadro ascolta solo su questa macchina", async () => {
  const b = await banco();
  try {
    assert.equal(b.server.address().address, "127.0.0.1");
  } finally {
    await b.chiudi();
  }
  assert.equal(existsSync(b.cartella), false);
});
