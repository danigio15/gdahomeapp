/* Le commissioni: quello che il ponte fa da se' per il telefono.
 *
 * Dopo la stretta di mano il ponte non guarda dentro ai messaggi: sono roba
 * fra il telefono e Home Assistant. Con un'eccezione, ed e' questa: tutto
 * quello che riguarda la plancia, che in Home Assistant non c'e'.
 *
 * Sono quattro cose: i file della plancia (`ponte/http`), dove sta e com'e'
 * (`ponte/plancia`), la sua configurazione (`dashboardmodern/config/…`, che
 * la pagina chiede come la chiederebbe all'integrazione e che qui tiene il
 * ponte), e le chiamate REST che la pagina fa a Home Assistant per lo storico
 * e le istantanee.
 *
 * La plancia vera — quella di DashboardModern, che l'app fa girare dentro un
 * WebView invece di rifarla — e' fatta di file: una pagina, un foglio di
 * stile, duecentosettanta moduli, i caratteri, i ritratti. Quei file li serve
 * Home Assistant, su una porta che dal telefono non si vede: in casa forse,
 * da fuori no, e in ogni caso l'app non sa dov'e' e non deve saperlo. L'unica
 * cosa che il telefono sa raggiungere e' il ponte.
 *
 * Quindi i file li chiede al ponte, sullo stesso filo di tutto il resto:
 *
 *     {id, type: "ponte/http", metodo: "GET", percorso: "/dashboardmodern_static/…"}
 *
 * e il ponte va a prenderli e li rimanda dentro una risposta col suo numero,
 * nella forma che ha ogni risposta di Home Assistant — cosi' per il filo
 * dell'app e' un comando come un altro. La stessa strada la fanno le chiamate
 * REST che la plancia usa per lo storico e per le istantanee delle
 * telecamere.
 *
 * Due strade, e sono diverse apposta:
 *
 *   - `/api/…` passa dal Supervisor, col suo segno. E' l'unica via che un
 *     add-on ha per chiamare l'API di Home Assistant senza avere un segno di
 *     Home Assistant, ed e' la stessa che fa il filo.
 *   - `/dashboardmodern_static/…` va dritta al contenitore di Home Assistant,
 *     senza nessun segno: sono file pubblici, e il Supervisor quella strada
 *     non la fa passare — inoltra `/api/` e basta.
 *
 * Tutto il resto no. Questo non e' un proxy verso Home Assistant: sono due
 * cartelle, e il telefono non ottiene di qui niente che non avesse gia' col
 * filo, che dopo l'abbinamento puo' chiedere a Home Assistant qualunque cosa.
 */

import { request as richiestaHttp } from "node:http";
import { request as richiestaHttps } from "node:https";
import { gzipSync } from "node:zlib";

import { Configurazione, PROFILO_PRINCIPALE, ScattoTroppoGrande } from "./configurazione.js";

export const TIPO = "ponte/http";
export const TIPO_PLANCIA = "ponte/plancia";
const CONFIG_GET = "dashboardmodern/config/get";
const CONFIG_SET = "dashboardmodern/config/set";
const CONFIG_RESTORE = "dashboardmodern/config/restore";

/* La pagina, per abitudine vecchia, tiene anche una copia per utente della
 * configurazione in Home Assistant (`frontend/*_user_data`), con questa
 * chiave e coi numeri sotto i settecentomila. Il ponte del pannello la ferma
 * per non avere due scrittori; qui si fa lo stesso, e per la stessa ragione.
 * Le altre chiavi di `frontend/*_user_data` non sono nostre e vanno in Home
 * Assistant come tutto il resto. */
const CHIAVE_VECCHIA = "dashboardmodern_integration_config";
const NUMERO_MODERNO = 700000;

const METODI = new Set(["GET", "POST", "PUT", "DELETE"]);

/* Un file della plancia sta sotto il megabyte; una risposta di Home Assistant
 * — lo storico di un mese — puo' essere molto di piu'. Oltre questo non e'
 * una risposta: e' qualcuno che riempie la memoria. */
const RISPOSTA_MASSIMA = 16 * 1024 * 1024;
const CORPO_MASSIMO = 4 * 1024 * 1024;
const ATTESA = 30_000;

/* Quante commissioni si fanno insieme. Una plancia che parte a freddo ne
 * chiede trecento in pochi secondi: farle tutte nello stesso istante vuol
 * dire trecento connessioni aperte verso Home Assistant, che su un Raspberry
 * e' un modo per farlo pensare ad altro. Otto alla volta bastano a tenere il
 * filo pieno, e le altre aspettano il loro turno. */
const INSIEME = 8;

/* Quello che vale la pena comprimere: testo. Un modulo JavaScript si riduce a
 * un quarto, e passa dal centralino, che e' la strada lenta. Un'immagine e'
 * gia' compressa, e la si lascia stare. */
const DA_COMPRIMERE = /^(text\/|application\/(javascript|json|xml|x-javascript)|image\/svg)/i;
const ALMENO = 512;

/* Un percorso e' fatto di lettere, numeri e pochi segni. Niente `..`, niente
 * spazi, niente caratteri di controllo: quello che il browser della plancia
 * chiede sta tutto qui dentro, e il resto e' qualcuno che prova. */
const PERCORSO_BUONO = /^\/[A-Za-z0-9_\-./~%+@:=&?,!()*;]*$/;

/* Senza leggere il JSON: la maggior parte dei messaggi del telefono sono
 * comandi per Home Assistant e non vanno nemmeno aperti. */
export function eUnaCommissione(testo) {
  return (
    typeof testo === "string" &&
    (testo.includes('"ponte/') ||
      testo.includes('"dashboardmodern/') ||
      testo.includes('"frontend/'))
  );
}

function eLaCopiaVecchia(detto) {
  const tipo = detto?.type;
  if (tipo !== "frontend/get_user_data" && tipo !== "frontend/set_user_data") return false;
  if (!String(detto?.key || "").startsWith(CHIAVE_VECCHIA)) return false;
  const numero = Number(detto?.id);
  return !Number.isFinite(numero) || numero < NUMERO_MODERNO;
}

export function si(id, result) {
  return { id, type: "result", success: true, result };
}

export function no(id, code, message) {
  return { id, type: "result", success: false, error: { code, message } };
}

export class Commissioni {
  constructor({
    casa,
    registro,
    plancia = null,
    configurazione = null,
    scarica = scaricaDavvero,
    insieme = INSIEME,
  } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    /* La plancia dentro l'add-on, e la sua configurazione. Senza — un ponte
     * sul banco, senza la cartella — i file si chiedono a Home Assistant,
     * dove ci sarebbero solo con l'integrazione. */
    this.plancia = plancia;
    this.configurazione = configurazione;
    this.scarica = scarica;
    this.insieme = insieme;
    this._inCorso = 0;
    this._coda = [];
  }

  /* E' una cosa che fa il ponte, o va in Home Assistant? */
  riconosce(detto) {
    const tipo = detto?.type;
    if (typeof tipo !== "string") return false;
    if (tipo.startsWith("ponte/")) return true;
    if (tipo === CONFIG_GET || tipo === CONFIG_SET || tipo === CONFIG_RESTORE)
      return Boolean(this.configurazione);
    return Boolean(this.configurazione) && eLaCopiaVecchia(detto);
  }

  /* La risposta a un messaggio riconosciuto, nella forma di Home Assistant.
   * Non solleva mai: un errore e' una risposta con `success: false`, come
   * farebbe Home Assistant per un comando andato storto. */
  async rispondi(detto) {
    const id = detto?.id ?? null;
    const tipo = detto?.type;
    if (tipo === TIPO) return this._http(detto);
    if (tipo === TIPO_PLANCIA) return this._laPlancia(id);
    if (tipo === CONFIG_GET || tipo === CONFIG_SET || tipo === CONFIG_RESTORE)
      return this._configurazione(detto);
    if (eLaCopiaVecchia(detto)) {
      /* Una risposta innocua, come fa il ponte del pannello: il codice
       * vecchio non resta appeso, e l'unico scrittore resta quello moderno. */
      return si(id, tipo === "frontend/get_user_data" ? { value: null } : null);
    }
    return no(id, "unknown_command", `non conosco ${tipo}`);
  }

  _laPlancia(id) {
    if (!this.plancia?.cE) return no(id, "not_found", "questo ponte non ha la plancia");
    return si(id, this.plancia.descrizione());
  }

  _configurazione(detto) {
    const id = detto.id ?? null;
    const cassetta = this.configurazione;
    if (!cassetta) return no(id, "unknown_command", `non conosco ${detto.type}`);
    const profilo = detto.profile ?? PROFILO_PRINCIPALE;
    if (!Configurazione.profiloBuono(profilo))
      return no(id, "invalid_format", "profilo non valido");
    try {
      if (detto.type === CONFIG_GET) return si(id, cassetta.leggi(profilo));
      if (detto.type === CONFIG_RESTORE) {
        const revisione = Number(detto.revision);
        if (!Number.isFinite(revisione)) return no(id, "invalid_format", "manca la revisione");
        return si(id, cassetta.ripristina(profilo, revisione));
      }
      const scatto = detto.snapshot;
      if (
        !scatto ||
        typeof scatto !== "object" ||
        !scatto.values ||
        typeof scatto.values !== "object"
      )
        return no(id, "invalid_format", "manca lo scatto");
      return si(
        id,
        cassetta.scrivi(profilo, scatto.values, {
          keys_revision: scatto.keys_revision ?? 0,
          writer_generation: scatto.writer_generation ?? 0,
          updated_at: scatto.updated_at ?? 0,
          expected_revision: detto.expected_revision ?? null,
          reset: detto.reset === true,
        }),
      );
    } catch (errore) {
      if (errore instanceof ScattoTroppoGrande) return no(id, "snapshot_too_large", errore.message);
      this.registro.errore(`configurazione andata storta: ${errore?.message || errore}`);
      return no(id, "ponte_config", "non ha funzionato");
    }
  }

  async _http(detto) {
    const id = detto?.id ?? null;
    const metodo = String(detto.metodo ?? "GET").toUpperCase();
    if (!METODI.has(metodo)) return no(id, "not_allowed", `il metodo ${metodo} non passa di qui`);

    const percorso = detto.percorso;
    if (typeof percorso !== "string" || !PERCORSO_BUONO.test(percorso) || percorso.includes("..")) {
      return no(id, "not_allowed", "percorso non valido");
    }

    let corpo = null;
    if (detto.corpo != null) {
      if (typeof detto.corpo !== "string") return no(id, "not_allowed", "corpo non valido");
      corpo = Buffer.from(detto.corpo, "base64");
      if (corpo.length > CORPO_MASSIMO) return no(id, "not_allowed", "corpo troppo grande");
    }

    /* I file della plancia stanno qui, nell'add-on: non si va da nessuna
     * parte. Il metodo non conta, e' un file. */
    if (percorso.startsWith("/dashboardmodern_static/") && this.plancia?.cE) {
      const { stato, tipo, corpo: letto } = this.plancia.leggi(percorso);
      return si(id, impacchetta(stato, tipo, letto));
    }

    const dove = await this._dove(percorso);
    if (!dove) {
      return no(id, "not_allowed", "di qui passano solo /api/ e /dashboardmodern_static/");
    }

    const intestazioni = { ...dove.intestazioni, "accept-encoding": "identity" };
    const tipoDelCorpo = detto.tipo;
    if (corpo && typeof tipoDelCorpo === "string") intestazioni["content-type"] = tipoDelCorpo;

    await this._ilMioTurno();
    try {
      const {
        stato,
        tipo,
        corpo: ricevuto,
      } = await this.scarica({
        url: dove.url,
        metodo,
        intestazioni,
        corpo,
        insicuro: dove.insicuro,
        massimo: RISPOSTA_MASSIMA,
        attesa: ATTESA,
      });
      return si(id, impacchetta(stato, tipo, ricevuto));
    } catch (errore) {
      this.registro.attenzione(
        `commissione fallita (${metodo} ${percorso}): ${errore?.message || errore}`,
      );
      return no(id, "ponte_http", String(errore?.message || "non ha funzionato"));
    } finally {
      this._finito();
    }
  }

  async _dove(percorso) {
    if (percorso.startsWith("/api/")) {
      /* Il filo con Home Assistant passa di qui: `/api/websocket` non e' una
       * cosa che si scarica. */
      if (percorso === "/api/websocket" || percorso.startsWith("/api/websocket?")) return null;
      return {
        url: `${this.casa.indirizzo}${percorso}`,
        intestazioni: { authorization: `Bearer ${this.casa.segno}` },
        insicuro: false,
      };
    }
    if (percorso.startsWith("/dashboardmodern_static/")) {
      const base = await this.casa.doveStaLaPlancia();
      return { url: `${base}${percorso}`, intestazioni: {}, insicuro: base.startsWith("https:") };
    }
    return null;
  }

  _ilMioTurno() {
    if (this._inCorso < this.insieme) {
      this._inCorso += 1;
      return Promise.resolve();
    }
    return new Promise((tocca) => this._coda.push(tocca));
  }

  _finito() {
    const prossimo = this._coda.shift();
    if (prossimo) prossimo();
    else this._inCorso -= 1;
  }
}

/* Il corpo in base64, compresso se e' testo. Chi lo riceve guarda
 * `compresso` e sa cosa fare. */
export function impacchetta(stato, tipo, corpo) {
  const dati = Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo ?? "");
  const tipoPulito = String(tipo || "application/octet-stream");
  if (DA_COMPRIMERE.test(tipoPulito) && dati.length >= ALMENO) {
    return { stato, tipo: tipoPulito, corpo: gzipSync(dati).toString("base64"), compresso: "gzip" };
  }
  return { stato, tipo: tipoPulito, corpo: dati.toString("base64") };
}

/* Scaricare con `node:http` e non con `fetch`, per una ragione sola: Home
 * Assistant con il TLS acceso serve i file su `https://172.30.32.1:8123`, con
 * un certificato che parla di un altro nome. Sulla rete fra i contenitori
 * quel certificato non dice niente a nessuno, e `fetch` non ha un modo pulito
 * di lasciarlo passare per una richiesta sola. */
export function scaricaDavvero({
  url,
  metodo = "GET",
  intestazioni = {},
  corpo = null,
  insicuro = false,
  massimo = RISPOSTA_MASSIMA,
  attesa = ATTESA,
}) {
  return new Promise((riuscito, fallito) => {
    const dove = new URL(url);
    const richiesta = dove.protocol === "https:" ? richiestaHttps : richiestaHttp;
    const pezzi = [];
    let quanto = 0;
    const chiamata = richiesta(
      dove,
      {
        method: metodo,
        headers: intestazioni,
        timeout: attesa,
        ...(dove.protocol === "https:" ? { rejectUnauthorized: !insicuro } : {}),
      },
      (risposta) => {
        risposta.on("data", (pezzo) => {
          quanto += pezzo.length;
          if (quanto > massimo) {
            risposta.destroy(new Error("risposta troppo grande"));
            return;
          }
          pezzi.push(pezzo);
        });
        risposta.on("end", () =>
          riuscito({
            stato: risposta.statusCode ?? 0,
            tipo: risposta.headers["content-type"] || "application/octet-stream",
            corpo: Buffer.concat(pezzi),
          }),
        );
        risposta.on("error", fallito);
      },
    );
    chiamata.on("timeout", () =>
      chiamata.destroy(new Error("Home Assistant non ha risposto in tempo")),
    );
    chiamata.on("error", fallito);
    if (corpo) chiamata.write(corpo);
    chiamata.end();
  });
}
