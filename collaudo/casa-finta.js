/* Una Home Assistant finta, per guardare l'app dal vivo.
 *
 * Sta dietro al ponte vero e si comporta come Home Assistant quanto basta:
 * fa la stretta di mano, risponde a `get_states`, accetta i comandi e cambia
 * lo stato di conseguenza — cosi' premendo un interruttore nell'app la luce si
 * spegne davvero, e si vede.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

export const SEGNO_DEL_SUPERVISOR = "segno-finto-del-supervisor";

/* Quello che risponde `get_panels`: una casa senza DashboardModern. La
 * plancia non sta qui: la porta il ponte, dentro l'add-on, e in Home
 * Assistant non serve nessuna integrazione. */
function pannelli() {
  return { lovelace: { component_name: "lovelace", url_path: "lovelace", config: null } };
}

/* La casa demo di DashboardModern: la stessa casa inventata con cui la plancia
 * web disegna le sue anteprime, con dentro tutto — persone, luci, clima,
 * energia, elettrodomestici, auto, piscina — e la configurazione della plancia
 * gia' fatta. Cosi' quello che si fotografa qui si confronta con quelle
 * anteprime, tessera per tessera.
 *
 * Le date delle entita' si rimettono a «un minuto e mezzo fa» a ogni
 * accensione: nel file sono ferme al giorno in cui e' stato scritto, e le
 * persone direbbero «visto 40 giorni fa». */
const DEMO = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "casa-demo.json"), "utf8"),
);
const ADESSO = new Date(Date.now() - 90_000).toISOString();

/* L'icona di un add-on, quella che il Supervisor serve su
 * `/api/hassio/addons/<add-on>/icon`. Qui e' il marchio di gdahome, che e'
 * proprio quello che servirebbe in casa per l'add-on gdahome. */
const ICONA_DELL_ADDON = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "ponte", "marchio", "gdahome.png"),
);

/* Le note lunghe che questa casa sa dare: il `CHANGELOG.md` vero.
 *
 * E' quello che risponderebbe una casa vera per l'aggiornamento della
 * plancia, ed e' anche l'unico modo di guardare il foglio del changelog con
 * dentro un testo che somiglia a quello che ci finisce davvero — titoli,
 * elenchi, grassetto, codice e link, tutti e cinque. */
const IL_CHANGELOG = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "ponte", "CHANGELOG.md"),
  "utf8",
);

/* Quello che aspetta di essere aggiornato.
 *
 * Nella casa demo della plancia non c'e': quella e' una casa di **tessere**, e
 * un'entita' `update.` non ne disegna nessuna. Qui servono, perche' la sezione
 * Aggiornamenti dell'app legge quelle e basta — e una sezione che nel collaudo
 * si fotografa sempre vuota non si e' mai guardata davvero.
 *
 * Sono le quattro che si trovano in tutte le case, e sono diverse apposta: il
 * sistema e l'add-on **portano giu' il filo** quando si installano — e
 * l'app deve dirlo prima; la plancia no; e il firmware di una presa non si
 * installa chiamando un servizio, quindi il tasto non ci va.
 *
 * E sono diverse anche in **quello che sanno dire di se'**, che e' la seconda
 * meta' della sezione:
 *
 *  - `entity_picture` di **casa** (`/api/hassio/addons/…/icon`): il segno lo
 *    apre il ponte col segno di Home Assistant, e questa casa finta quel
 *    percorso lo serve per davvero. E' l'unico modo di provare la strada
 *    intera — attributo, ponte, segno, byte, immagine nel quadrato — in un
 *    browser vero;
 *  - `entity_picture` dei **marchi** (`brands.home-assistant.io`): quello e'
 *    un giro fuori, e da un banco senza internet non arriva. Percio' quella
 *    riga resta con la sua iniziale, ed e' giusto che si veda: e' quello che
 *    fa l'app quando un logo non c'e' o non arriva;
 *  - il **quinto bit** di `supported_features` (16): «le note della versione
 *    le so, chiedimele». Chi ce l'ha risponde a `update/release_notes`, e nel
 *    collaudo risponde col `CHANGELOG.md` vero. Chi non ce l'ha non se le fa
 *    nemmeno chiedere. */
const DA_AGGIORNARE = [
  {
    entity_id: "update.dashboardmodern_update",
    state: "on",
    attributes: {
      friendly_name: "DashboardModern Update",
      title: "DashboardModern",
      installed_version: "1.4.32.7",
      latest_version: "1.4.32.8",
      release_summary: "Il firewall dell'ufficio, spiegato dove si legge l'indirizzo.",
      release_url: "https://github.com/danigio15/gdahomeapp/releases",
      /* 1 = si installa, 16 = le note lunghe le sa. */
      supported_features: 1 | 16,
    },
  },
  {
    entity_id: "update.gdahome_update",
    state: "on",
    attributes: {
      friendly_name: "gdahome Update",
      title: "gdahome",
      installed_version: "0.20.0",
      latest_version: "0.21.0",
      /* Il segno di un add-on: sta in casa, e senza il segno di Home
       * Assistant non si apre. Questa casa lo serve. */
      entity_picture: "/api/hassio/addons/gdahome/icon",
      supported_features: 1,
    },
  },
  {
    entity_id: "update.home_assistant_core_update",
    state: "on",
    attributes: {
      friendly_name: "Home Assistant Core Update",
      title: "Home Assistant Core",
      installed_version: "2026.8.4",
      latest_version: "2026.9.1",
      release_url: "https://www.home-assistant.io/latest-release-notes/",
      /* I marchi di Home Assistant: e' l'indirizzo vero, e da un banco senza
       * internet non arriva. La riga resta con la sua iniziale, ed e' quello
       * che si vuole vedere. */
      entity_picture: "https://brands.home-assistant.io/homeassistant/icon.png",
      supported_features: 1,
    },
  },
  {
    entity_id: "update.presa_lavatrice_firmware",
    state: "on",
    attributes: {
      friendly_name: "Presa lavatrice",
      installed_version: "1.0.9",
      latest_version: "1.1.0",
      device_class: "firmware",
      supported_features: 0,
    },
  },
];

const CASA = [...DEMO.entita, ...DA_AGGIORNARE].map((una) => ({
  ...una,
  last_changed: ADESSO,
  last_updated: ADESSO,
}));
/* La configurazione della plancia, nella forma dell'integrazione. Non la
 * risponde questa casa: la tiene il ponte, e il collaudo gliela mette
 * nell'archivio prima di accenderlo. */
export const SCATTO_DEMO = DEMO.configurazione.snapshot;

/* Gli appuntamenti e le cose da fare non stanno negli stati.
 *
 * Lo stato di un `calendar.*` dice soltanto se c'e' qualcosa in corso, quello
 * di un `todo.*` soltanto quante voci restano: le voci vere si chiedono coi
 * servizi `calendar.get_events` e `todo.get_items`, e solo con
 * `return_response`. Qui si risponde come risponderebbe Home Assistant.
 *
 * Le date sono relative a oggi, se no dopo una settimana l'agenda del
 * collaudo sarebbe tutta scaduta. */
function fraQuanto(giorni, ore, minuti = 0) {
  const quando = new Date();
  quando.setDate(quando.getDate() + giorni);
  quando.setHours(ore, minuti, 0, 0);
  return quando;
}

/* Senza fuso, come li scrive Home Assistant per gli eventi con un'ora. */
const scritto = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-` +
  `${String(data.getDate()).padStart(2, "0")}T` +
  `${String(data.getHours()).padStart(2, "0")}:` +
  `${String(data.getMinutes()).padStart(2, "0")}:00`;

const soloIlGiorno = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-` +
  `${String(data.getDate()).padStart(2, "0")}`;

const EVENTI = {
  "calendar.famiglia": [
    {
      summary: "Dentista — Laura",
      start: scritto(fraQuanto(0, 17, 30)),
      end: scritto(fraQuanto(0, 18, 30)),
      location: "Studio Bianchi",
    },
    {
      summary: "Cena dai nonni",
      start: scritto(fraQuanto(0, 20, 0)),
      end: scritto(fraQuanto(0, 22, 30)),
    },
    {
      summary: "Saggio di Marco",
      start: scritto(fraQuanto(1, 16, 0)),
      end: scritto(fraQuanto(1, 18, 0)),
      location: "Teatro comunale",
    },
    {
      summary: "Gita in montagna",
      start: soloIlGiorno(fraQuanto(3, 0)),
      end: soloIlGiorno(fraQuanto(4, 0)),
    },
  ],
  "calendar.lavoro": [
    {
      summary: "Riunione settimanale",
      start: scritto(fraQuanto(0, 9, 0)),
      end: scritto(fraQuanto(0, 10, 0)),
    },
    {
      summary: "Consegna preventivo",
      start: scritto(fraQuanto(2, 11, 0)),
      end: scritto(fraQuanto(2, 12, 0)),
    },
  ],
};

const COSE = {
  "todo.spesa": [
    { uid: "1", summary: "Pane e latte", status: "needs_action" },
    { uid: "2", summary: "Caffe'", status: "needs_action" },
    { uid: "3", summary: "Detersivo piatti", status: "needs_action" },
    { uid: "4", summary: "Frutta", status: "needs_action" },
    { uid: "5", summary: "Pasta", status: "completed" },
  ],
  "todo.casa": [
    {
      uid: "6",
      summary: "Revisione auto",
      status: "needs_action",
      due: soloIlGiorno(fraQuanto(2, 0)),
    },
    {
      uid: "7",
      summary: "Cambiare filtro cappa",
      status: "needs_action",
      due: soloIlGiorno(fraQuanto(-3, 0)),
    },
  ],
};

/* ─── La presa WebSocket, la stessa del ponte ─────────────────────────────── */

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function firma(chiave) {
  return createHash("sha1")
    .update(chiave + GUID)
    .digest("base64");
}

function telaio(carico) {
  const dati = Buffer.from(carico, "utf8");
  let testa;
  if (dati.length < 126) {
    testa = Buffer.alloc(2);
    testa[1] = dati.length;
  } else if (dati.length < 65536) {
    testa = Buffer.alloc(4);
    testa[1] = 126;
    testa.writeUInt16BE(dati.length, 2);
  } else {
    testa = Buffer.alloc(10);
    testa[1] = 127;
    testa.writeBigUInt64BE(BigInt(dati.length), 2);
  }
  testa[0] = 0x81;
  return Buffer.concat([testa, dati]);
}

function stacca(buffer) {
  if (buffer.length < 2) return null;
  const tipo = buffer[0] & 0x0f;
  let lunghezza = buffer[1] & 0x7f;
  let inizio = 2;
  if (lunghezza === 126) {
    if (buffer.length < 4) return null;
    lunghezza = buffer.readUInt16BE(2);
    inizio = 4;
  } else if (lunghezza === 127) {
    if (buffer.length < 10) return null;
    lunghezza = Number(buffer.readBigUInt64BE(2));
    inizio = 10;
  }
  const finaMaschera = inizio + 4;
  if (buffer.length < finaMaschera + lunghezza) return null;
  const maschera = buffer.subarray(inizio, finaMaschera);
  const carico = Buffer.from(buffer.subarray(finaMaschera, finaMaschera + lunghezza));
  for (let i = 0; i < carico.length; i += 1) carico[i] ^= maschera[i & 3];
  return { tipo, carico, consumati: finaMaschera + lunghezza };
}

/* ─── La casa ─────────────────────────────────────────────────────────────── */

export function alzaLaCasaFinta() {
  const entita = new Map(CASA.map((una) => [una.entity_id, structuredClone(una)]));
  const prese = new Set();
  const sottoscrizioni = new Map();

  /* La porta HTTP: e' quella su cui il ponte fa le chiamate REST
   * (`PONTE_CASA`) per conto della plancia. */
  const server = createServer((richiesta, risposta) => {
    const percorso = new URL(richiesta.url || "/", "http://casa").pathname;
    if (percorso.startsWith("/dashboardmodern_static/")) {
      risposta.writeHead(404, { "content-type": "text/plain" });
      risposta.end("qui non c'e' niente");
      return;
    }
    /* L'icona di un add-on, nelle **due** forme in cui si chiede: quella del
     * Supervisor (`/addons/<add-on>/icon`), che e' la strada che fa il ponte,
     * e quella del proxy di Home Assistant (`/api/hassio/addons/…`), che
     * resta per chi gira fuori dal Supervisor. In tutte e due si vuole il
     * segno: senza il controllo, il collaudo direbbe che il logo arriva anche
     * se il ponte si fosse dimenticato di mandarlo. */
    if (/^(?:\/api\/hassio)?\/addons\/[^/]+\/icon$/.test(percorso)) {
      const chi = String(richiesta.headers.authorization || "");
      if (chi !== `Bearer ${SEGNO_DEL_SUPERVISOR}`) {
        risposta.writeHead(401, { "content-type": "text/plain" });
        risposta.end("senza segno non si apre");
        return;
      }
      risposta.writeHead(200, { "content-type": "image/png" });
      risposta.end(ICONA_DELL_ADDON);
      return;
    }
    /* Lo storico e i calendari via REST: vuoti, ma nella forma giusta. */
    if (percorso.startsWith("/api/history/") || percorso.startsWith("/api/calendars/")) {
      risposta.writeHead(200, { "content-type": "application/json" });
      risposta.end("[]");
      return;
    }
    risposta.writeHead(200, { "content-type": "application/json" });
    risposta.end('{"message":"API running."}');
  });

  server.on("upgrade", (richiesta, socket) => {
    const chiave = richiesta.headers["sec-websocket-key"];
    if (!chiave) {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\n" +
        `connection: Upgrade\r\nsec-websocket-accept: ${firma(chiave)}\r\n\r\n`,
    );
    prese.add(socket);
    let avanzo = Buffer.alloc(0);
    const manda = (cosa) => {
      try {
        socket.write(telaio(JSON.stringify(cosa)));
      } catch (_errore) {
        /* Chiusa. */
      }
    };
    manda({ type: "auth_required", ha_version: "2025.1.0 (finta)" });

    socket.on("data", (pezzo) => {
      avanzo = Buffer.concat([avanzo, pezzo]);
      for (;;) {
        const letto = stacca(avanzo);
        if (!letto) return;
        avanzo = avanzo.subarray(letto.consumati);
        if (letto.tipo === 0x8) {
          socket.end();
          return;
        }
        if (letto.tipo !== 0x1) continue;
        let detto;
        try {
          detto = JSON.parse(letto.carico.toString("utf8"));
        } catch (_errore) {
          continue;
        }
        rispondi(manda, socket, detto);
      }
    });
    socket.on("close", () => prese.delete(socket));
    socket.on("error", () => prese.delete(socket));
  });

  function rispondi(manda, socket, detto) {
    if (detto.type === "auth") {
      const buono = detto.access_token === SEGNO_DEL_SUPERVISOR;
      manda(buono ? { type: "auth_ok" } : { type: "auth_invalid" });
      if (!buono) socket.end();
      return;
    }
    const ok = (result = null) => manda({ id: detto.id, type: "result", success: true, result });
    /* E il no, con la sua forma: Home Assistant risponde cosi', e il ponte
     * legge `code` e `message`. Senza un no vero il collaudo non potrebbe
     * provare le strade in cui la casa **dice di no**, che sono quelle dove
     * l'app deve avere una frase pronta. */
    const no = (code, message) =>
      manda({ id: detto.id, type: "result", success: false, error: { code, message } });

    switch (detto.type) {
      /* Il colpetto, come lo fa Home Assistant. L'app lo manda ogni mezzo
       * minuto per accorgersi dei fili che muoiono senza chiudersi: una casa
       * finta che non rispondesse farebbe passare il collaudo su una strada
       * che in casa vera non si percorre. */
      case "ping":
        manda({ id: detto.id, type: "pong" });
        return;
      case "get_states":
        ok([...entita.values()]);
        return;
      case "get_panels":
        ok(pannelli());
        return;
      /* Quello che la plancia vera chiede a Home Assistant appena parte, nella
       * forma che si aspetta e senza niente dentro: una casa finta non ha
       * stanze registrate ne' storico, ma non deve rispondere `null` a chi
       * legge un campo. */
      case "get_config":
        ok({
          location_name: "Casa del collaudo",
          latitude: 45.4642,
          longitude: 9.19,
          elevation: 120,
          unit_system: { length: "km", mass: "kg", temperature: "°C", volume: "L" },
          time_zone: "Europe/Rome",
          currency: "EUR",
          language: "it",
          version: "2025.1.0",
          components: ["frontend", "dashboardmodern"],
          state: "RUNNING",
        });
        return;
      case "get_services":
      case "history/history_during_period":
      case "recorder/statistics_during_period":
      case "dashboardmodern/integrations/catalog":
        ok({});
        return;
      case "config/area_registry/list":
      case "config/floor_registry/list":
      case "config/device_registry/list":
      case "config/entity_registry/list":
      case "recorder/list_statistic_ids":
      case "dashboardmodern/www/list":
      case "dashboardmodern/tickets/list":
        ok([]);
        return;
      case "frontend/get_user_data":
        ok({ value: null });
        return;
      case "auth/sign_path":
        ok({ path: detto.path });
        return;
      /* Le note lunghe di una versione: le calcola l'entita' quando gliele si
       * chiede, e per questo non stanno negli attributi.
       *
       * Risponde **solo** chi ha dichiarato il quinto bit di
       * `supported_features`, come fa Home Assistant: a chi non l'ha
       * dichiarato si risponde no, e il ponte non dovrebbe nemmeno
       * chiederglielo. Se lo chiede, il collaudo lo scopre qui. */
      case "update/release_notes": {
        const chi = String(detto.entity_id || "");
        const quale = CASA.find((una) => una.entity_id === chi);
        const bit = Number(quale?.attributes?.supported_features ?? 0);
        if (!quale || (bit & 16) === 0) {
          no("not_supported", `${chi} non sa dare le note della versione`);
          return;
        }
        ok(IL_CHANGELOG);
        return;
      }
      case "subscribe_events":
        sottoscrizioni.set(socket, detto.id);
        ok();
        return;
      case "unsubscribe_events":
        sottoscrizioni.delete(socket);
        ok();
        return;
      case "call_service": {
        /* I servizi che rispondono: si chiamano con `return_response`, e la
         * risposta e' l'unico modo di sapere cosa c'e' in un calendario o in
         * una lista. */
        const chiesto = [detto.target?.entity_id].flat().filter(Boolean)[0];
        if (detto.domain === "calendar" && detto.service === "get_events") {
          ok({ response: { [chiesto]: { events: EVENTI[chiesto] || [] } } });
          return;
        }
        if (detto.domain === "todo" && detto.service === "get_items") {
          ok({ response: { [chiesto]: { items: COSE[chiesto] || [] } } });
          return;
        }
        if (detto.domain === "todo" && detto.service === "update_item") {
          const voci = COSE[chiesto] || [];
          const quale = voci.find(
            (una) =>
              una.uid === detto.service_data?.item || una.summary === detto.service_data?.item,
          );
          if (quale) quale.status = detto.service_data?.status || "completed";
          ok();
          return;
        }
        ok();
        /* Il comando cambia davvero lo stato, e il cambiamento torna
         * indietro: cosi' nell'app l'interruttore si muove per conto suo,
         * come farebbe in casa. */
        const chi = detto.target?.entity_id;
        const nuovo =
          detto.service === "turn_on" ? "on" : detto.service === "turn_off" ? "off" : null;
        for (const id of [chi].flat().filter(Boolean)) {
          const una = entita.get(id);
          if (!una) continue;
          una.state = nuovo ?? (una.state === "on" ? "off" : "on");
          una.last_changed = new Date().toISOString();
          racconta(una);
        }
        return;
      }
      default:
        ok();
    }
  }

  function racconta(una) {
    for (const [socket, numero] of sottoscrizioni) {
      if (socket.destroyed) continue;
      try {
        socket.write(
          telaio(
            JSON.stringify({
              id: numero,
              type: "event",
              event: {
                event_type: "state_changed",
                data: { entity_id: una.entity_id, new_state: una },
              },
            }),
          ),
        );
      } catch (_errore) {
        /* Chiusa. */
      }
    }
  }

  return {
    server,
    ascolta: () =>
      new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server.address().port))),
    spegni: () =>
      new Promise((ok) => {
        for (const presa of prese) presa.destroy();
        server.close(ok);
      }),
  };
}
