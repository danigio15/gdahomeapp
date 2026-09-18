/* Le prove delle due porte, con il ponte intero acceso.
 *
 * Qui si accende davvero tutto quanto — `alzaIlPonte` — contro una Home
 * Assistant finta, e si guarda la cosa che conta di piu' di tutto l'add-on:
 * che dalla porta esposta non si possa fabbricare un codice di abbinamento.
 * Se quella riga si rompesse, chiunque arrivi alla porta entrerebbe in casa.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { accetta } from "../src/presa.js";
import { telefonoCifrato } from "./telefono-cifrato.js";
import { alzaIlPonte } from "../src/index.js";
import { rotta } from "../src/server.js";
import { qrInSvg } from "../src/qr.js";

const SEGNO_DEL_SUPERVISOR = "segno-finto-del-supervisor";

const INDIRIZZO_DI_CASA = "192.168.1.50";

async function casaFinta() {
  const prese = [];
  const server = createServer((richiesta, risposta) => {
    risposta.writeHead(200, { "content-type": "application/json" });
    /* Il Supervisor finto: e' da qui che il ponte impara su quale indirizzo
     * lo trovano i telefoni quando sono in casa. */
    if ((richiesta.url || "").startsWith("/network/info")) {
      risposta.end(
        JSON.stringify({
          data: {
            interfaces: [
              { enabled: true, ipv4: { address: ["172.30.32.2/23"] } },
              { enabled: true, ipv4: { address: [`${INDIRIZZO_DI_CASA}/24`] } },
            ],
          },
        }),
      );
      return;
    }
    risposta.end('{"message":"API running."}');
  });
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        const detto = JSON.parse(testo);
        if (detto.type !== "auth") return;
        presa.manda(
          JSON.stringify(
            detto.access_token === SEGNO_DEL_SUPERVISOR
              ? { type: "auth_ok", ha_version: "2025.1.0" }
              : { type: "auth_invalid" },
          ),
        );
      },
    });
    if (!presa) return;
    prese.push(presa);
    presa.manda(JSON.stringify({ type: "auth_required", ha_version: "2025.1.0" }));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

async function banco({ quadro = null, installatore = false } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-server-"));
  const ha = await casaFinta();
  const primaCasa = process.env.PONTE_CASA;
  const primoSegno = process.env.SUPERVISOR_TOKEN;
  const primoSupervisor = process.env.PONTE_SUPERVISOR;
  process.env.PONTE_CASA = ha.indirizzo;
  process.env.PONTE_SUPERVISOR = ha.indirizzo;
  process.env.SUPERVISOR_TOKEN = SEGNO_DEL_SUPERVISOR;

  const avviato = await alzaIlPonte({
    cartella,
    portaDellApp: 0,
    portaDellaConsole: 0,
    dispositiviMassimi: 3,
    minutiDelCodice: 5,
    giorniDiSilenzio: 90,
    registro: "errore",
    console: fileURLToPath(new URL("../console", import.meta.url)),
    quadro,
    quadroOgni: 15,
    installatore,
  });

  const app = `http://127.0.0.1:${avviato.app.address().port}`;
  const consolle = `http://127.0.0.1:${avviato.console.address().port}`;
  return {
    ...avviato,
    app,
    consolle,
    filo: app.replace("http", "ws"),
    spegni: async () => {
      await avviato.abbassa();
      await ha.spegni();
      rmSync(cartella, { recursive: true, force: true });
      if (primaCasa === undefined) delete process.env.PONTE_CASA;
      else process.env.PONTE_CASA = primaCasa;
      if (primoSegno === undefined) delete process.env.SUPERVISOR_TOKEN;
      else process.env.SUPERVISOR_TOKEN = primoSegno;
      if (primoSupervisor === undefined) delete process.env.PONTE_SUPERVISOR;
      else process.env.PONTE_SUPERVISOR = primoSupervisor;
    },
  };
}

const prendi = (via, opzioni = {}) =>
  fetch(via, {
    ...opzioni,
    headers: { "content-type": "application/json", ...(opzioni.headers || {}) },
  });

/* ─── Il taglio del prefisso dell'ingress ────────────────────────────────── */

test("il prefisso dell'ingress si toglie, e senza prefisso non si tocca niente", () => {
  const gettone = "/api/hassio_ingress/AbCdEf123";
  assert.equal(
    rotta({ url: `${gettone}/api/stato`, headers: { "x-ingress-path": gettone } }),
    "/api/stato",
  );
  assert.equal(rotta({ url: `${gettone}/`, headers: { "x-ingress-path": gettone } }), "/");
  assert.equal(rotta({ url: gettone, headers: { "x-ingress-path": gettone } }), "/");
  assert.equal(rotta({ url: "/api/stato", headers: {} }), "/api/stato");
  assert.equal(rotta({ url: "/salute", headers: {} }), "/salute");
});

/* ─── La porta dell'app ──────────────────────────────────────────────────── */

test("la porta dell'app dice solo se e' viva", async () => {
  const b = await banco();
  try {
    const risposta = await prendi(`${b.app}/salute`);
    assert.equal(risposta.status, 200);
    const detto = await risposta.json();
    assert.equal(detto.vivo, true);
    assert.equal(detto.dispositivi, 0);
  } finally {
    await b.spegni();
  }
});

test("dalla porta dell'app non si fabbrica un codice, e non si vede niente della console", async () => {
  const b = await banco();
  try {
    for (const [metodo, via] of [
      ["POST", "/api/codice"],
      ["GET", "/api/stato"],
      ["GET", "/api/dispositivi"],
      ["GET", "/"],
      ["GET", "/index.html"],
      ["DELETE", "/api/dispositivi/dm_qualunque"],
    ]) {
      const risposta = await prendi(`${b.app}${via}`, { method: metodo });
      assert.equal(risposta.status, 404, `${metodo} ${via} non deve esistere sulla porta dell'app`);
    }
    assert.equal(b.abbinamento.stato().attivo, false);
  } finally {
    await b.spegni();
  }
});

test("il codice della console abbina il telefono, e vale una volta sola", async () => {
  const b = await banco();
  try {
    const { codice, invito } = await (
      await prendi(`${b.consolle}/api/codice`, { method: "POST" })
    ).json();
    assert.match(codice, /^[0-9A-Z]{16}$/);
    /* Nel QR code ci va il codice **e come si arriva qui**: un'app che
     * inquadra non deve sapere niente da prima. Questo banco non ha
     * centralino, e quel campo resta vuoto. */
    assert.equal(invito, `gdahome|1|${codice}||${INDIRIZZO_DI_CASA}:${b.app.split(":").pop()}`);

    const risposta = await prendi(`${b.app}/abbinamento`, {
      method: "POST",
      body: JSON.stringify({ codice, nome: "iPhone di Anna", sistema: "ios" }),
    });
    assert.equal(risposta.status, 201);
    const fatto = await risposta.json();
    assert.match(fatto.segno, /^[0-9a-f]{64}$/);
    assert.equal(fatto.dispositivo.nome, "iPhone di Anna");

    /* Dove tornare. Senza questo, un telefono che si e' abbinato inquadrando
     * un QR code non saprebbe dove ribussare: non ha mai visto un
     * indirizzo, ed e' apposta. */
    assert.equal(fatto.ritorno.casa, b.identita.casa);
    assert.deepEqual(fatto.ritorno.indirizzi, [`${INDIRIZZO_DI_CASA}:${b.app.split(":").pop()}`]);
    /* Questo banco non ha centralino: si dice, invece di far finta. */
    assert.equal(fatto.ritorno.centralino, null);

    const seconda = await prendi(`${b.app}/abbinamento`, {
      method: "POST",
      body: JSON.stringify({ codice, nome: "un altro" }),
    });
    assert.equal(seconda.status, 403);
    assert.equal(b.dispositivi.quanti(), 1);
  } finally {
    await b.spegni();
  }
});

test("un codice sbagliato non abbina, e dopo dieci tentativi la porta si chiude", async () => {
  const b = await banco();
  try {
    await prendi(`${b.consolle}/api/codice`, { method: "POST" });
    for (let i = 0; i < 10; i += 1) {
      const risposta = await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice: "SBAGLIA2" }),
      });
      assert.equal(risposta.status, 403);
    }
    const undicesima = await prendi(`${b.app}/abbinamento`, {
      method: "POST",
      body: JSON.stringify({ codice: "SBAGLIA2" }),
    });
    assert.equal(undicesima.status, 429);
    assert.equal(b.dispositivi.quanti(), 0);
  } finally {
    await b.spegni();
  }
});

test("un corpo che non e' JSON, o troppo grande, non passa", async () => {
  const b = await banco();
  try {
    const storto = await prendi(`${b.app}/abbinamento`, { method: "POST", body: "non json" });
    assert.equal(storto.status, 400);
    const enorme = await prendi(`${b.app}/abbinamento`, {
      method: "POST",
      body: JSON.stringify({ codice: "A".repeat(10_000) }),
    });
    assert.equal(enorme.status, 400);
  } finally {
    await b.spegni();
  }
});

test("oltre il numero massimo la console non fabbrica piu' codici", async () => {
  const b = await banco();
  try {
    for (let i = 0; i < 3; i += 1) {
      const { codice } = await (
        await prendi(`${b.consolle}/api/codice`, { method: "POST" })
      ).json();
      const risposta = await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice, nome: `telefono ${i}` }),
      });
      assert.equal(risposta.status, 201);
    }
    const troppi = await prendi(`${b.consolle}/api/codice`, { method: "POST" });
    assert.equal(troppi.status, 409);
  } finally {
    await b.spegni();
  }
});

/* ─── Il browser ─────────────────────────────────────────────────────────── */

test("il browser riceve il permesso di parlare, e la console no", async () => {
  const b = await banco();
  try {
    /* La porta dell'app: le intestazioni ci sono, perche' ci deve poter
     * parlare una versione web dell'app. */
    const salute = await prendi(`${b.app}/salute`);
    assert.equal(salute.headers.get("access-control-allow-origin"), "*");

    const permesso = await prendi(`${b.app}/abbinamento`, { method: "OPTIONS" });
    assert.equal(permesso.status, 204);
    assert.match(permesso.headers.get("access-control-allow-methods") || "", /POST/);
    assert.match(permesso.headers.get("access-control-allow-headers") || "", /content-type/);

    /* La console no: ci arriva solo Home Assistant, e una pagina di un altro
     * sito li' dentro non ci deve poter guardare. */
    const stato = await prendi(`${b.consolle}/api/stato`);
    assert.equal(stato.headers.get("access-control-allow-origin"), null);
  } finally {
    await b.spegni();
  }
});

test("la richiesta di permesso non consuma niente e non abbina nessuno", async () => {
  const b = await banco();
  try {
    await prendi(`${b.consolle}/api/codice`, { method: "POST" });
    for (let i = 0; i < 5; i += 1) {
      await prendi(`${b.app}/abbinamento`, { method: "OPTIONS" });
    }
    assert.equal(b.abbinamento.stato().attivo, true, "il codice e' ancora buono");
    assert.equal(b.abbinamento.stato().tentativiSbagliati, 0);
    assert.equal(b.dispositivi.quanti(), 0);
  } finally {
    await b.spegni();
  }
});

/* ─── Dal codice al filo, tutto di seguito ───────────────────────────────── */

test("abbinato dalla console, il telefono entra dal filo e parla con la casa", async () => {
  const b = await banco();
  try {
    const { codice } = await (await prendi(`${b.consolle}/api/codice`, { method: "POST" })).json();
    const { segno, chiave, dispositivo } = await (
      await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice, nome: "Pixel", sistema: "android" }),
      })
    ).json();

    /* Anche in casa si passa dal portiere, quindi si parla cifrato: una strada
     * sola invece di due. */
    const telefono = telefonoCifrato(`${b.filo}/casa`, { chi: dispositivo.id, chiave });
    await telefono.dentro;
    await telefono.aspetta("auth_required");
    telefono.manda({ type: "auth", access_token: segno });
    await telefono.aspetta("auth_ok");
    const presa = telefono.presa;

    const stato = await (await prendi(`${b.consolle}/api/stato`)).json();
    assert.equal(stato.dispositivi[0].collegati, 1);
    assert.equal(stato.casa.viva, true);
    presa.close();
  } finally {
    await b.spegni();
  }
});

test("una salita su una via che non e' /casa non diventa un filo", async () => {
  const b = await banco();
  try {
    const presa = new WebSocket(`${b.filo}/altrove`);
    const finita = await new Promise((ok) => {
      presa.addEventListener("error", () => ok("errore"));
      presa.addEventListener("close", () => ok("chiusa"));
      presa.addEventListener("open", () => ok("aperta"));
    });
    assert.notEqual(finita, "aperta");
  } finally {
    await b.spegni();
  }
});

/* ─── La console ─────────────────────────────────────────────────────────── */

test("la console serve la sua pagina e non esce dalla sua cartella", async () => {
  const b = await banco();
  try {
    const pagina = await prendi(`${b.consolle}/`);
    assert.equal(pagina.status, 200);
    assert.match(await pagina.text(), /<h1>gdahome<\/h1>/);

    const fuori = mkdtempSync(join(tmpdir(), "fuori-"));
    writeFileSync(join(fuori, "segreto.txt"), "questo non si deve leggere", "utf8");
    try {
      for (const tentativo of [
        "/../../etc/passwd",
        "/..%2f..%2fetc%2fpasswd",
        `/../${fuori.split("/").pop()}/segreto.txt`,
      ]) {
        const risposta = await prendi(`${b.consolle}${tentativo}`);
        assert.notEqual(risposta.status, 200, `${tentativo} non deve leggersi`);
      }
    } finally {
      rmSync(fuori, { recursive: true, force: true });
    }
  } finally {
    await b.spegni();
  }
});

test("la console stacca un telefono e ne butta giu' il filo", async () => {
  const b = await banco();
  try {
    const { codice } = await (await prendi(`${b.consolle}/api/codice`, { method: "POST" })).json();
    const { segno, chiave, dispositivo } = await (
      await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice, nome: "via" }),
      })
    ).json();

    const telefono = telefonoCifrato(`${b.filo}/casa`, { chi: dispositivo.id, chiave });
    await telefono.dentro;
    await telefono.aspetta("auth_required");
    telefono.manda({ type: "auth", access_token: segno });
    await telefono.aspetta("auth_ok");

    const staccato = await prendi(`${b.consolle}/api/dispositivi/${dispositivo.id}`, {
      method: "DELETE",
    });
    assert.equal(staccato.status, 200);
    assert.equal((await staccato.json()).filiChiusi, 1);
    await telefono.chiusa;

    /* E con quel telefono non si rientra: il portiere non lo conosce piu'. */
    const riprova = telefonoCifrato(`${b.filo}/casa`, { chi: dispositivo.id, chiave });
    await assert.rejects(riprova.dentro, /riabbina/);
    await riprova.chiusa;
  } finally {
    await b.spegni();
  }
});

test("la console rinomina, e annulla un codice", async () => {
  const b = await banco();
  try {
    const { codice } = await (await prendi(`${b.consolle}/api/codice`, { method: "POST" })).json();
    const { dispositivo } = await (
      await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice, nome: "prima" }),
      })
    ).json();

    const rinominato = await prendi(`${b.consolle}/api/dispositivi/${dispositivo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ nome: "dopo" }),
    });
    assert.equal(rinominato.status, 200);
    assert.equal(b.dispositivi.elenco()[0].nome, "dopo");

    await prendi(`${b.consolle}/api/codice`, { method: "POST" });
    const annullato = await prendi(`${b.consolle}/api/codice`, { method: "DELETE" });
    assert.equal((await annullato.json()).annullato, true);
    assert.equal(b.abbinamento.stato().attivo, false);
  } finally {
    await b.spegni();
  }
});

test("una via che non esiste sulla console risponde 404, non 500", async () => {
  const b = await banco();
  try {
    assert.equal((await prendi(`${b.consolle}/api/inventata`)).status, 404);
    assert.equal(
      (await prendi(`${b.consolle}/api/dispositivi/dm_nonesiste`, { method: "DELETE" })).status,
      404,
    );
  } finally {
    await b.spegni();
  }
});

test("il QR code si ridisegna, e chi ricarica la pagina lo ritrova", async () => {
  /* Il caso che si vede subito usandolo: la console si ricarica — un tocco
   * per sbaglio, un riavvio dell'add-on, il telefono che torna sulla scheda —
   * mentre il codice e' ancora buono. Se la pagina non sa piu' qual e', chi
   * sta inquadrando deve fabbricarne un altro, cioe' buttare via un codice
   * valido e ricominciare davanti a qualcuno che aspetta. */
  const b = await banco();
  try {
    const fatto = await (await prendi(`${b.consolle}/api/codice`, { method: "POST" })).json();

    const ancora = await (await prendi(`${b.consolle}/api/codice`)).json();
    assert.equal(ancora.attivo, true);
    assert.equal(ancora.codice, fatto.codice);
    assert.equal(ancora.invito, fatto.invito);
    assert.equal(ancora.scadeIl, fatto.scadeIl);

    const disegno = await prendi(`${b.consolle}/api/qr.svg`);
    assert.equal(disegno.status, 200);
    assert.match(disegno.headers.get("content-type"), /image\/svg\+xml/);
    /* Non si guarda che «sembri» un QR: si guarda che sia **quel** QR, cioe'
     * quello dell'invito che la console ha appena ricevuto. */
    assert.equal(await disegno.text(), qrInSvg(fatto.invito, { titolo: "Codice di abbinamento" }));

    await prendi(`${b.consolle}/api/codice`, { method: "DELETE" });
    assert.equal((await (await prendi(`${b.consolle}/api/codice`)).json()).attivo, false);
    assert.equal((await prendi(`${b.consolle}/api/qr.svg`)).status, 404);
  } finally {
    await b.spegni();
  }
});

test("il QR code non esiste sulla porta dell'app", async () => {
  /* La porta esposta non deve avere **nessuna** via che faccia vedere un
   * codice di abbinamento: quella e' la differenza fra un ponte e una porta
   * aperta. */
  const b = await banco();
  try {
    await prendi(`${b.consolle}/api/codice`, { method: "POST" });
    for (const via of ["/api/qr.svg", "/api/codice"]) {
      assert.equal((await prendi(`${b.app}${via}`)).status, 404, via);
    }
  } finally {
    await b.spegni();
  }
});

/* ─── Attese ─────────────────────────────────────────────────────────────── */

const nuovoGiro = (millesimi = 5) => new Promise((ok) => setTimeout(ok, millesimi));

async function attendi(condizione, entro = 5000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    const risultato = condizione();
    if (risultato) return risultato;
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}

test("le plance si aggiungono, si rinominano e si tolgono dalla scheda dell'add-on", async () => {
  const b = await banco();
  try {
    /* Una casa ne ha una, e si chiama come si e' sempre chiamata. */
    const prima = await (await prendi(`${b.consolle}/api/plance`)).json();
    assert.deepEqual(prima.plance, [
      {
        profilo: "primary",
        titolo: "gdahome",
        istanza: "gdahome",
        primaria: true,
        creata_il: 0,
        /* Vuoto: la vedono tutti quelli che entrano in casa. */
        utenti: [],
        solo_admin: false,
      },
    ]);

    /* Una in piu': cassetto suo, istanza sua. Come aggiungere una seconda
     * istanza dell'integrazione in Home Assistant. */
    const aggiunta = await prendi(`${b.consolle}/api/plance`, {
      method: "POST",
      body: JSON.stringify({ titolo: "Casa al mare" }),
    });
    assert.equal(aggiunta.status, 201);
    const { quale } = await aggiunta.json();
    assert.equal(quale.profilo, "casa-al-mare");
    assert.equal(quale.istanza, "gdahome-casa-al-mare");
    assert.equal(quale.primaria, false);

    /* Rinominare cambia il titolo e non il cassetto: se no rinominare una
     * plancia le cancellerebbe la configurazione. */
    const rinominata = await (
      await prendi(`${b.consolle}/api/plance`, {
        method: "PATCH",
        body: JSON.stringify({ profilo: "casa-al-mare", titolo: "Al mare" }),
      })
    ).json();
    assert.equal(rinominata.quale.titolo, "Al mare");
    assert.equal(rinominata.quale.profilo, "casa-al-mare");

    /* La prima non si toglie: una casa senza nessuna plancia e' un'app che si
     * apre su niente. */
    const negata = await prendi(`${b.consolle}/api/plance`, {
      method: "DELETE",
      body: JSON.stringify({ profilo: "primary" }),
    });
    assert.equal(negata.status, 400);
    assert.equal((await negata.json()).errore, "non_la_prima");

    const tolta = await (
      await prendi(`${b.consolle}/api/plance`, {
        method: "DELETE",
        body: JSON.stringify({ profilo: "casa-al-mare" }),
      })
    ).json();
    assert.equal(tolta.plance.length, 1);

    /* E sulla porta dell'app quelle vie non esistono: la scheda dell'add-on
     * sta dietro l'autenticazione di Home Assistant, quella porta no. */
    const fuori = await prendi(`${b.app}/api/plance`);
    assert.equal(fuori.status, 404);
  } finally {
    await b.spegni();
  }
});

/* ─── Il rapporto al quadro, dalla console ───────────────────────────────
 *
 * Quello che si prova qui: che la scheda esista **solo** dove qualcuno ha
 * incollato un codice; che quella via dica a chi parla questa casa e **non**
 * dica con che — l'indirizzo e' la risposta a «a chi?», la chiave sarebbe di
 * che farla parlare; e che «smetti» smetta davvero, cioe' fermi il postino e
 * svuoti la casella, perche' un tasto che smette finche' non si riavvia e' una
 * bugia con un bottone sopra.
 */

test("senza codice la scheda del quadro non c'e' nemmeno", async () => {
  const b = await banco();
  try {
    const detto = await (await prendi(`${b.consolle}/api/quadro`)).json();
    assert.deepEqual(detto, { acceso: false });
    /* E non si puo' spegnere quello che non e' acceso, senza che sia un
     * errore: e' semplicemente gia' cosi'. */
    const spento = await (await prendi(`${b.consolle}/api/quadro`, { method: "DELETE" })).json();
    assert.deepEqual(spento, { acceso: false });
  } finally {
    await b.spegni();
  }
});

test("col codice, la console dice a chi parla questa casa — e non dice con che", async () => {
  const b = await banco({
    quadro: { dove: "https://quadro.impiantirossi.it", chiave: "CHIAVE-SEGRETISSIMA-9XQF" },
  });
  try {
    const risposta = await prendi(`${b.consolle}/api/quadro`);
    const testo = await risposta.text();
    const detto = JSON.parse(testo);
    assert.equal(detto.acceso, true);
    assert.equal(detto.dove, "https://quadro.impiantirossi.it");
    assert.equal(detto.ogni, 15);
    /* Il nome della ditta e' vuoto finche' non e' partita la prima rapporto:
     * arriva **nella risposta** del quadro, e finche' non c'e' la scheda mostra
     * l'indirizzo e basta invece di inventarsi qualcosa. */
    assert.equal(detto.chi, "");
    /* La riga che conta: da questa pagina si legge **a chi**, non si prende
     * di che. */
    assert.ok(
      !testo.includes("SEGRETISSIMA"),
      "la chiave del quadro non deve uscire dalla console",
    );
  } finally {
    await b.spegni();
  }
});

test("«smetti» ferma il postino e svuota la casella, che se no al riavvio ricomincia", async () => {
  const b = await banco({
    quadro: { dove: "https://quadro.impiantirossi.it", chiave: "CHIAVE-LUNGA-ABBASTANZA" },
  });
  try {
    assert.equal(b.postino.acceso, true);
    const esito = await (await prendi(`${b.consolle}/api/quadro`, { method: "DELETE" })).json();
    assert.equal(esito.acceso, false);
    /* Il Supervisor finto risponde a tutto, quindi la casella si e' svuotata:
     * quello che conta e' che si sia **provato** a svuotarla, e che l'esito
     * arrivi a chi ha premuto invece di essere ingoiato. */
    assert.equal(esito.spento, true);
  } finally {
    await b.spegni();
  }
});

/* ─── Il cruscotto di chi installa ────────────────────────────────────── */

test("senza l'interruttore, la scheda del cruscotto non c'è e non dice dove", async () => {
  /* Una porta che non si apre è peggio di una porta che non c'è: in casa di un
   * cliente quella sezione non ha motivo di esistere. */
  const b = await banco();
  try {
    const detto = await (await prendi(`${b.consolle}/api/cruscotto`)).json();
    assert.equal(detto.installatore, false);
    assert.equal(detto.dove, "");
  } finally {
    await b.spegni();
  }
});

test("con l'interruttore, dice dove si apre — e nient'altro", async () => {
  /* La riga che conta: da qui esce un sì e un indirizzo. La chiave della flotta
   * non passa da queste opzioni e non finisce sul disco di questa casa — la
   * chiede quella pagina, e resta nel browser di chi la digita. */
  const b = await banco({ installatore: true });
  try {
    const risposta = await prendi(`${b.consolle}/api/cruscotto`);
    const testo = await risposta.text();
    const detto = JSON.parse(testo);
    assert.equal(detto.installatore, true);
    assert.match(detto.dove, /^https:\/\/.+\/console\/$/);
    assert.deepEqual(Object.keys(detto).sort(), ["dove", "installatore"]);
  } finally {
    await b.spegni();
  }
});
