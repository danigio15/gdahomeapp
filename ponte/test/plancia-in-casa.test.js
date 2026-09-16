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
        /* Chi c'e' in casa. Home Assistant risponde con l'elenco degli utenti,
         * e in mezzo ci mette anche i suoi — quelli che fa da se' per gli
         * add-on — che in una lista di «chi vede la plancia» non sono
         * persone. */
        if (detto.type === "config/auth/list") {
          presa.manda(
            JSON.stringify({
              id: detto.id,
              type: "result",
              success: true,
              result: [
                {
                  id: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
                  name: "Giovanni",
                  is_owner: true,
                  is_active: true,
                  system_generated: false,
                  group_ids: ["system-admin"],
                },
                {
                  id: "0f9e8d7c6b5a49382716f5e4d3c2b1a0",
                  name: "Marta",
                  is_owner: false,
                  is_active: true,
                  system_generated: false,
                  group_ids: ["system-users"],
                },
                {
                  id: "11111111111111111111111111111111",
                  name: "Home Assistant Content",
                  system_generated: true,
                  group_ids: [],
                },
              ],
            }),
          );
          return;
        }
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
    /* E il posto dell'avviso «non hai ancora collegato le tue entita'».
     *
     * Quella domanda la plancia se la fa mezzo secondo dopo che la pagina e'
     * pronta, e se la fa una volta sola: qui la configurazione arriva sul
     * filo, dopo, e su un filo lento l'avviso resta sopra una Home piena di
     * tessere coi dati dentro. Il posto si tiene occupato, e quando la
     * configurazione arriva si rifa' la loro domanda. */
    assert.match(pagina, /id="cd-empty-banner"|posto\.id=NOME/);
    assert.match(pagina, /dashboardmodern:persistence-restored/);
    assert.match(pagina, /cdEmptyStateCheck\(\)/);
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

test("a chi non e' abilitato la pagina della plancia non arriva", async () => {
  /* E' la prova che dice se «chi la vede» e' un cancello o un velo.
   *
   * Nella dashboard era un velo: l'elenco lo guardava il pannello, nel
   * browser. Qui lo guarda l'add-on, e guarda la riga che gli scrive
   * l'ingress — `X-Remote-User-Id` — che la pagina non puo' toccare. Percio'
   * qui si chiede la cosa vera: la pagina arriva o no.
   */
  const b = await banco();
  const IO = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const LEI = "0f9e8d7c6b5a49382716f5e4d3c2b1a0";
  try {
    /* Finche' nessuno ha scelto niente, la plancia si apre a tutti — anche a
     * chi non dice chi e'. E' come si aprono le case di chi c'e' gia'. */
    assert.equal((await fetch(`${b.consolle}/plancia/`)).status, 200);
    assert.equal(
      (await fetch(`${b.consolle}/plancia/`, { headers: { "x-remote-user-id": LEI } })).status,
      200,
    );

    /* Adesso la prima plancia e' solo mia. */
    const messa = await fetch(`${b.consolle}/api/plance`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profilo: "primary", utenti: [IO] }),
    });
    assert.equal(messa.status, 200);

    /* A me arriva. */
    const mia = await fetch(`${b.consolle}/plancia/`, {
      headers: { "x-remote-user-id": IO },
    });
    assert.equal(mia.status, 200);
    assert.match(await mia.text(), /__DASHBOARDMODERN_HOSTED__/);

    /* A lei no, e non le arriva **nascosta**: non le arriva. La risposta e'
     * una pagina, perche' dall'altra parte c'e' una persona dentro un riquadro
     * della sua Home Assistant. */
    const sua = await fetch(`${b.consolle}/plancia/`, {
      headers: { "x-remote-user-id": LEI },
    });
    assert.equal(sua.status, 403);
    const detto = await sua.text();
    assert.match(detto, /non e' abilitata per te/);
    assert.doesNotMatch(detto, /__DASHBOARDMODERN_HOSTED__/, "la plancia e' arrivata comunque");

    /* E a chi non dice chi e' nemmeno: con un elenco addosso, non sapere chi
     * bussa e' un no. */
    assert.equal((await fetch(`${b.consolle}/plancia/`)).status, 403);

    /* Una seconda plancia nasce aperta a tutti, e resta aperta: restringere
     * una non restringe le altre. */
    const { quale } = await (
      await fetch(`${b.consolle}/api/plance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ titolo: "Casa al mare" }),
      })
    ).json();
    const altra = await fetch(`${b.consolle}/plancia/${quale.profilo}/`, {
      headers: { "x-remote-user-id": LEI },
    });
    assert.equal(altra.status, 200);

    /* Togliendo le spunte torna di tutti. */
    await fetch(`${b.consolle}/api/plance`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profilo: "primary", utenti: [] }),
    });
    assert.equal(
      (await fetch(`${b.consolle}/plancia/`, { headers: { "x-remote-user-id": LEI } })).status,
      200,
    );
  } finally {
    await b.spegni();
  }
});

test("«solo amministratori»: a chi non amministra la pagina non arriva", async () => {
  /* E' il pezzo che la vecchia integrazione non aveva. Home Assistant sa gia'
   * nascondere una Plancia a chi non amministra (`require_admin`, e quella
   * meta' si prova in «plance-in-casa»); ma l'indirizzo dell'ingress si apre
   * anche senza passare da quella voce, e allora il controllo lo rifa'
   * l'add-on — che «amministra?» lo chiede a Home Assistant, perche' l'ingress
   * gli dice chi sta guardando e non se ha le chiavi. */
  const b = await banco();
  const IO = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const LEI = "0f9e8d7c6b5a49382716f5e4d3c2b1a0";
  try {
    const messa = await fetch(`${b.consolle}/api/plance`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profilo: "primary", solo_admin: true }),
    });
    assert.equal(messa.status, 200);
    assert.equal((await messa.json()).quale.solo_admin, true);

    /* Giovanni amministra questa casa — lo dice la Home Assistant finta — e la
     * pagina gli arriva. */
    const mia = await fetch(`${b.consolle}/plancia/`, { headers: { "x-remote-user-id": IO } });
    assert.equal(mia.status, 200);
    assert.match(await mia.text(), /__DASHBOARDMODERN_HOSTED__/);

    /* Marta no, e non le arriva. Il messaggio dice **quale** delle due cose
     * l'ha fermata: sapere che una plancia e' «solo degli amministratori» e'
     * un'informazione che puo' usare, «solo di alcuni utenti» la manderebbe a
     * chiedere la cosa sbagliata. */
    const sua = await fetch(`${b.consolle}/plancia/`, { headers: { "x-remote-user-id": LEI } });
    assert.equal(sua.status, 403);
    const detto = await sua.text();
    assert.match(detto, /solo gli amministratori/);
    assert.doesNotMatch(detto, /__DASHBOARDMODERN_HOSTED__/);

    /* E a chi non dice chi e' nemmeno. */
    assert.equal((await fetch(`${b.consolle}/plancia/`)).status, 403);

    /* Spegnendola torna di tutti. */
    await fetch(`${b.consolle}/api/plance`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profilo: "primary", solo_admin: false }),
    });
    assert.equal(
      (await fetch(`${b.consolle}/plancia/`, { headers: { "x-remote-user-id": LEI } })).status,
      200,
    );
  } finally {
    await b.spegni();
  }
});

test("gli utenti della casa li chiede a Home Assistant, e non conta i suoi", async () => {
  /* L'elenco non lo teniamo noi, e non e' un dettaglio: un elenco copiato da
   * qualche parte invecchia, e chi ha tolto una persona da casa se la
   * ritroverebbe ancora spuntata. */
  const b = await banco();
  try {
    const detto = await (await fetch(`${b.consolle}/api/utenti`)).json();
    assert.deepEqual(detto.utenti, [
      {
        id: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
        nome: "Giovanni",
        amministratore: true,
        attivo: true,
      },
      {
        id: "0f9e8d7c6b5a49382716f5e4d3c2b1a0",
        nome: "Marta",
        amministratore: false,
        attivo: true,
      },
    ]);
    /* «Home Assistant Content» non c'e': e' un utente che Home Assistant fa da
     * se', e in questa lista sarebbe una riga che non e' una persona. */
    assert.ok(
      !detto.utenti.some((uno) => uno.nome.startsWith("Home Assistant")),
      "in elenco c'e' un utente di sistema",
    );
  } finally {
    await b.spegni();
  }
});

test("il filo della plancia si chiude a chi non vede nessuna plancia", async () => {
  /* Il filo e' uno per tutte le plance e non sa quale pagina l'ha aperto: non
   * puo' dire «questa no». Ma chi non vede **nessuna** plancia non ha niente
   * da chiedere, e quello lo sa dire.
   *
   * Qui si apre il filo senza la riga dell'ingress — che e' il caso di chi non
   * si sa chi sia — con l'unica plancia della casa riservata a qualcun altro. */
  const b = await banco();
  try {
    await fetch(`${b.consolle}/api/plance`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profilo: "primary", utenti: ["a1b2c3d4e5f60718293a4b5c6d7e8f90"] }),
    });

    const pagina = unaPagina(`${b.consolle.replace("http", "ws")}/plancia/api/websocket`);
    await assert.rejects(pagina.aperta, /non si e' aperto/);
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
     * l'integrazione, e la domanda della pagina a Home Assistant non arriva.
     *
     * Una domanda a Home Assistant pero' c'e', e non e' questa: la prima
     * volta che una plancia vuota si legge, il ponte guarda se
     * l'integrazione ce l'ha (`_laPrendeDallIntegrazione`). Quella parte dal
     * filo suo, coi numeri suoi — quindi mai col 7 della pagina — ed e' una
     * sola. */
    pagina.manda({ id: 7, type: "dashboardmodern/config/get", profile: "primary" });
    const configurazione = await pagina.aspetta((detto) => detto.id === 7);
    assert.equal(configurazione.success, true);
    assert.equal(configurazione.result.profile, "primary");
    const suLaCasa = b.ha.arrivati.filter((detto) => detto.type === "dashboardmodern/config/get");
    assert.ok(
      suLaCasa.every((detto) => detto.id !== 7),
      "la domanda della pagina e' arrivata a Home Assistant, e la' non la sa nessuno",
    );
    assert.ok(
      suLaCasa.length <= 1,
      "il ponte ne chiede una sola, e solo per adottare quella dell'integrazione",
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
