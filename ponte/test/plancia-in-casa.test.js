/* La plancia dentro Home Assistant, servita dal ponte.
 *
 * Nella dashboard la plancia e' un pannello dell'integrazione: la serve lei, e
 * la barra laterale ha la sua voce. L'integrazione va dismessa, e allora quel
 * mestiere lo fa il ponte, dalla porta dell'**ingress** — quella dove arriva
 * solo chi e' entrato in Home Assistant.
 *
 * Quello che si prova qui e' la catena intera, che nessuna prova piu' piccola
 * mette insieme:
 *
 *  - la pagina arriva con le premesse giuste, e con un `<base>` che porta ai
 *    suoi file: senza, la plancia va a cercare il proprio foglio di stile
 *    dove non e' e arriva nuda;
 *  - sotto l'ingress il prefisso — che cambia a ogni riavvio di Home Assistant
 *    — finisce dentro la pagina, nel `<base>` e nell'indirizzo del WebSocket:
 *    la pagina da sola non lo puo' indovinare;
 *  - il WebSocket che la pagina apre riceve `auth_ok` senza aver chiesto
 *    niente: la plancia ospitata non manda nessun `auth`, e resterebbe ad
 *    aspettare per sempre;
 *  - i comandi che il ponte fa da se' — la configurazione, che nella dashboard
 *    la faceva l'integrazione — non arrivano a Home Assistant; tutti gli altri
 *    si', com'e';
 *  - e ogni plancia apre il suo cassetto: due plance sulla stessa casa non
 *    devono leggersi la configurazione a vicenda.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { accetta } from "../src/presa.js";
import { alzaIlPonte } from "../src/index.js";

const SEGNO_DEL_SUPERVISOR = "segno-del-supervisor";
const PREFISSO = "/api/hassio_ingress/un-gettone-qualunque";

/* Una Home Assistant finta che risponde a tutto: `auth`, e poi qualunque
 * comando con una riga che si riconosce. Serve a distinguere chi ha risposto —
 * lei o il ponte — che e' tutta la domanda di questa prova. */
async function casaFinta() {
  const prese = [];
  const arrivati = [];
  const server = createServer((richiesta, risposta) => {
    risposta.writeHead(200, { "content-type": "application/json" });
    risposta.end('{"message":"API running."}');
  });
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        const detto = JSON.parse(testo);
        if (detto.type === "auth") {
          presa.manda(
            JSON.stringify(
              detto.access_token === SEGNO_DEL_SUPERVISOR
                ? { type: "auth_ok", ha_version: "2025.1.0" }
                : { type: "auth_invalid" },
            ),
          );
          return;
        }
        arrivati.push(detto);
        presa.manda(
          JSON.stringify({ id: detto.id, type: "result", success: true, result: "dalla casa" }),
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
    arrivati,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "plancia-in-casa-"));
  const ha = await casaFinta();
  const prima = {
    casa: process.env.PONTE_CASA,
    segno: process.env.SUPERVISOR_TOKEN,
    supervisor: process.env.PONTE_SUPERVISOR,
  };
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
  });
  const consolle = `http://127.0.0.1:${avviato.console.address().port}`;
  return {
    ...avviato,
    ha,
    consolle,
    app: `http://127.0.0.1:${avviato.app.address().port}`,
    spegni: async () => {
      await avviato.abbassa();
      await ha.spegni();
      rmSync(cartella, { recursive: true, force: true });
      for (const [chiave, valore] of [
        ["PONTE_CASA", prima.casa],
        ["SUPERVISOR_TOKEN", prima.segno],
        ["PONTE_SUPERVISOR", prima.supervisor],
      ]) {
        if (valore === undefined) delete process.env[chiave];
        else process.env[chiave] = valore;
      }
    },
  };
}

/* Un browser, quel tanto che basta: apre il WebSocket della plancia e mette in
 * fila quello che arriva. */
function unaPagina(dove) {
  const presa = new WebSocket(dove);
  const arrivati = [];
  const attese = [];
  presa.addEventListener("message", (evento) => {
    const detto = JSON.parse(String(evento.data));
    arrivati.push(detto);
    for (let quale = attese.length - 1; quale >= 0; quale -= 1) {
      if (attese[quale].quando(detto)) {
        attese[quale].ok(detto);
        attese.splice(quale, 1);
      }
    }
  });
  return {
    presa,
    aperta: new Promise((ok, no) => {
      presa.addEventListener("open", ok);
      presa.addEventListener("error", () => no(new Error("il WebSocket non si e' aperto")));
    }),
    manda: (cosa) => presa.send(JSON.stringify(cosa)),
    aspetta: (quando) =>
      new Promise((ok, no) => {
        const gia = arrivati.find(quando);
        if (gia) {
          ok(gia);
          return;
        }
        const scadenza = setTimeout(() => no(new Error("non e' arrivato niente")), 5000);
        attese.push({
          quando,
          ok: (detto) => {
            clearTimeout(scadenza);
            ok(detto);
          },
        });
      }),
    chiudi: () => presa.close(),
  };
}

test("la pagina della plancia arriva con le sue premesse e col suo «base»", async () => {
  const b = await banco();
  try {
    /* Senza la barra in fondo il browser crederebbe di stare un piano sopra, e
     * il rimando e' **relativo**: sotto l'ingress davanti c'e' un prefisso che
     * il ponte non deve scrivere a mano. */
    const senzaBarra = await fetch(`${b.consolle}/plancia`, { redirect: "manual" });
    assert.equal(senzaBarra.status, 302);
    assert.equal(senzaBarra.headers.get("location"), "plancia/");

    const risposta = await fetch(`${b.consolle}/plancia/`);
    assert.equal(risposta.status, 200);
    assert.match(risposta.headers.get("content-type"), /^text\/html/);
    const pagina = await risposta.text();

    /* Le sette cose che la plancia deve sapere. Sono le stesse che le dice il
     * servitore dentro l'app: una plancia che si apre in due posti non deve
     * sapere due cose diverse. */
    assert.match(pagina, /window\.__DASHBOARDMODERN_HOSTED__=true;/);
    assert.match(pagina, /window\.__DASHBOARDMODERN_INSTANCE__="gdahome";/);
    assert.match(pagina, /window\.__DASHBOARDMODERN_PROFILE__="primary";/);
    assert.match(pagina, /window\.__DASHBOARDMODERN_PRIMARY__=true;/);
    assert.match(pagina, /window\.__DASHBOARDMODERN_LOCALE__="it";/);
    assert.match(pagina, /window\.__GDAHOME__=true;/);
    assert.match(pagina, /window\.__DASHBOARDMODERN_BRIDGE_WS__=\(function\(Vera\)/);
    /* E l'indirizzo del filo: qualunque cosa la pagina gli passi, va al
     * ponte. */
    assert.match(pagina, /location\.host\+"\/plancia\/api\/websocket"/);

    /* Il `<base>`: la pagina chiama i suoi file per nome relativo, e servita
     * da un indirizzo diverso dal suo li cercherebbe dove non sono. */
    const base = /<base href="([^"]+)"/.exec(pagina);
    assert.ok(base, "senza «base» la plancia arriva nuda");
    assert.match(base[1], /^\/dashboardmodern_static\/[0-9a-f]+\/legacy\/$/);

    /* E quei file arrivano davvero, dalla stessa porta. */
    const foglio = await fetch(`${b.consolle}${base[1]}dashboard-runtime-it.css`);
    assert.equal(foglio.status, 200);
    assert.match(foglio.headers.get("content-type"), /css/);
    /* Nell'indirizzo c'e' l'impronta: quello che c'e' non cambia mai. */
    assert.match(foglio.headers.get("cache-control"), /immutable/);

    /* Sulla porta dell'app, invece, questa roba non c'e': li' non passa
     * l'autenticazione di Home Assistant. */
    assert.equal((await fetch(`${b.app}/plancia/`)).status, 404);
  } finally {
    await b.spegni();
  }
});

test("sotto l'ingress il prefisso finisce dentro la pagina", async () => {
  const b = await banco();
  try {
    const pagina = await (
      await fetch(`${b.consolle}${PREFISSO}/plancia/`, {
        headers: { "x-ingress-path": PREFISSO },
      })
    ).text();
    const base = /<base href="([^"]+)"/.exec(pagina);
    assert.ok(base);
    assert.ok(
      base[1].startsWith(`${PREFISSO}/dashboardmodern_static/`),
      `il «base» non porta il prefisso: ${base[1]}`,
    );
    assert.match(pagina, new RegExp(`"${PREFISSO}/plancia/api/websocket"`));
  } finally {
    await b.spegni();
  }
});

test("ogni plancia apre il suo cassetto, e quella che non c'e' non si apre", async () => {
  const b = await banco();
  try {
    const { quale } = await (
      await fetch(`${b.consolle}/api/plance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ titolo: "Casa al mare" }),
      })
    ).json();
    assert.equal(quale.profilo, "casa-al-mare");

    const pagina = await (await fetch(`${b.consolle}/plancia/casa-al-mare/`)).text();
    assert.match(pagina, /window\.__DASHBOARDMODERN_PROFILE__="casa-al-mare";/);
    assert.match(pagina, /window\.__DASHBOARDMODERN_INSTANCE__="gdahome-casa-al-mare";/);
    assert.match(pagina, /window\.__DASHBOARDMODERN_PRIMARY__=false;/);

    /* Senza la barra in fondo si rimanda, sempre in relativo. */
    const senzaBarra = await fetch(`${b.consolle}/plancia/casa-al-mare`, { redirect: "manual" });
    assert.equal(senzaBarra.status, 302);
    assert.equal(senzaBarra.headers.get("location"), "casa-al-mare/");

    assert.equal((await fetch(`${b.consolle}/plancia/mai-esistita/`)).status, 404);
  } finally {
    await b.spegni();
  }
});

test("il filo della pagina: «auth_ok» senza chiedere, e chi risponde a cosa", async () => {
  const b = await banco();
  const pagina = unaPagina(`${b.consolle.replace("http", "ws")}/plancia/api/websocket`);
  try {
    await pagina.aperta;
    /* La plancia ospitata non manda nessun `auth`: se qui si aspettasse di
     * riceverlo, resterebbe ad aspettare per sempre. */
    const dentro = await pagina.aspetta((detto) => detto.type === "auth_ok");
    assert.equal(dentro.ha_version, "gdahome");

    /* La configurazione la fa il ponte: nella dashboard la faceva
     * l'integrazione, e a Home Assistant non deve arrivare. */
    pagina.manda({ id: 7, type: "dashboardmodern/config/get", profile: "primary" });
    const configurazione = await pagina.aspetta((detto) => detto.id === 7);
    assert.equal(configurazione.success, true);
    assert.equal(configurazione.result.profile, "primary");
    assert.ok(
      !b.ha.arrivati.some((detto) => detto.type === "dashboardmodern/config/get"),
      "la configurazione e' arrivata a Home Assistant, e la' non la sa nessuno",
    );

    /* Tutto il resto no: quello e' roba della casa, e passa com'e'. */
    pagina.manda({ id: 8, type: "get_states" });
    const stati = await pagina.aspetta((detto) => detto.id === 8);
    assert.equal(stati.result, "dalla casa");
    assert.ok(b.ha.arrivati.some((detto) => detto.type === "get_states"));
  } finally {
    pagina.chiudi();
    await b.spegni();
  }
});
