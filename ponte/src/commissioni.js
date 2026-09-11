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
import { DISPOSITIVI_MASSIMI, ENTITA_MASSIME } from "./catalogo.js";
import { BASE_DELLE_FOTO, BASE_DI_CASA, FOTO_MASSIMA } from "./foto.js";
import { CentralinoHaDettoNo, SenzaCentralino } from "./segnalazioni.js";

export const TIPO = "ponte/http";
export const TIPO_PLANCIA = "ponte/plancia";
const CONFIG_GET = "dashboardmodern/config/get";
const CONFIG_SET = "dashboardmodern/config/set";
const CONFIG_RESTORE = "dashboardmodern/config/restore";
const CATALOGO = "dashboardmodern/integrations/catalog";
const FOTO_ELENCO = "dashboardmodern/www/list";
const FOTO_CARICA = "dashboardmodern/www/upload";
/* Lo spegnimento programmato del clima (#364): nell'integrazione lo tiene
 * Home Assistant, qui lo tiene il ponte (`spegnimento.js`). */
const TIMER_ELENCO = "dashboardmodern/clima/timer/list";
const TIMER_METTI = "dashboardmodern/clima/timer/set";
const TIMER_TOGLI = "dashboardmodern/clima/timer/clear";

/* Le segnalazioni e la chat di assistenza escono dalla plancia: diventano
 * dell'app, che le fa da se'. Alla pagina, che ha ancora i suoi bottoni, si
 * risponde con una frase e non con un «comando sconosciuto». */
const NELLAPP = /^dashboardmodern\/(tickets|chat)\//;
const DETTO_NELLAPP = "Le segnalazioni e la chat stanno nell'app, non nella plancia.";

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
 * caratteri di controllo: quello che il browser della plancia chiede sta
 * tutto qui dentro, e il resto e' qualcuno che prova.
 *
 * Lo **spazio** c'e', e prima non c'era. I file della plancia hanno nomi
 * semplici, ma sotto `/local/` stanno le foto di casa, e quei nomi li
 * sceglie chi le ha scattate: «mia auto.png». Il servitore dell'app scioglie
 * i segni di percentuale prima di chiedere — un nome di file e' il nome, non
 * il modo in cui viaggia — e con lo spazio vietato qui quella foto tornava
 * «percorso non valido». Dall'altra parte `foto.js` lo spazio lo accetta gia'
 * (`PEZZO_BUONO`), e verso Home Assistant ci pensa `new URL`, che rimette la
 * percentuale dov'era. */
const PERCORSO_BUONO = /^\/[A-Za-z0-9_\-./~%+@:=&?,!()*; ]*$/;

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

/* L'allegato come arriva dall'app: il file in base64 dentro il messaggio —
 * sul filo passa testo — e qui torna byte, una volta sola. Quello che non
 * e' base64 non e' un file. */
export function unAllegato(detto) {
  const testo = typeof detto.byte === "string" ? detto.byte.replace(/\s+/g, "") : "";
  if (!testo || !/^[A-Za-z0-9+/]+=*$/.test(testo)) return null;
  const byte = Buffer.from(testo, "base64");
  if (byte.length === 0) return null;
  return {
    nome: typeof detto.nome === "string" ? detto.nome.slice(0, 120) : "allegato",
    tipo: typeof detto.tipo === "string" ? detto.tipo.slice(0, 60) : "",
    byte: new Uint8Array(byte.buffer, byte.byteOffset, byte.byteLength),
  };
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
    catalogo = null,
    foto = null,
    fotoDiCasa = null,
    segnalazioni = null,
    spegnimento = null,
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
    /* Il catalogo delle integrazioni e le foto: le altre due cose che la
     * plancia chiedeva all'integrazione. */
    this.catalogo = catalogo;
    this.foto = foto;
    /* Quelle che stanno gia' in Home Assistant, in sola lettura: chi ha una
     * casa da qualche anno le ha li', e le sceglieva da li'. */
    this.fotoDiCasa = fotoDiCasa;
    /* Le segnalazioni e la chat dell'app, che passano dal centralino. */
    this.segnalazioni = segnalazioni;
    /* Il conto alla rovescia del clima, che nell'integrazione sta in Home
     * Assistant e qui sta nel ponte. */
    this.spegnimento = spegnimento;
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
    if (tipo === CATALOGO) return Boolean(this.catalogo);
    if (tipo === FOTO_ELENCO || tipo === FOTO_CARICA) return Boolean(this.foto);
    if (tipo === TIMER_ELENCO || tipo === TIMER_METTI || tipo === TIMER_TOGLI)
      return Boolean(this.spegnimento);
    if (NELLAPP.test(tipo)) return true;
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
    if (
      typeof tipo === "string" &&
      (tipo.startsWith("ponte/segnalazioni/") || tipo.startsWith("ponte/chat/"))
    )
      return this._segnalazioni(detto);
    if (tipo === CONFIG_GET || tipo === CONFIG_SET || tipo === CONFIG_RESTORE)
      return this._configurazione(detto);
    if (tipo === CATALOGO) return this._catalogo(detto);
    if (tipo === FOTO_ELENCO) return this._elencoDelleFoto(detto);
    if (tipo === FOTO_CARICA) return this._caricaUnaFoto(detto);
    if (tipo === TIMER_ELENCO || tipo === TIMER_METTI || tipo === TIMER_TOGLI)
      return this._timerDelClima(detto);
    if (typeof tipo === "string" && NELLAPP.test(tipo))
      return no(id, "not_supported", DETTO_NELLAPP);
    if (eLaCopiaVecchia(detto)) {
      /* Una risposta innocua, come fa il ponte del pannello: il codice
       * vecchio non resta appeso, e l'unico scrittore resta quello moderno. */
      return si(id, tipo === "frontend/get_user_data" ? { value: null } : null);
    }
    return no(id, "unknown_command", `non conosco ${tipo}`);
  }

  /* Lo spegnimento programmato: le stesse tre risposte dell'integrazione.
   * Un'entita' e' una parola con un punto dentro; i minuti vanno da zero
   * (togli il timer) a settecentoventi, come lo slider. */
  _timerDelClima(detto) {
    const id = detto.id ?? null;
    const timer = this.spegnimento;
    if (!timer) return no(id, "unknown_command", `non conosco ${detto.type}`);
    try {
      if (detto.type === TIMER_ELENCO) return si(id, { scadenze: timer.scadenze() });
      const entita = typeof detto.entity_id === "string" ? detto.entity_id.trim() : "";
      if (entita.length < 3 || entita.length > 255 || !entita.includes("."))
        return no(id, "invalid_format", "entity_id non valido");
      if (detto.type === TIMER_TOGLI) {
        timer.annulla(entita);
        return si(id, { removed: true });
      }
      const minuti = Number(detto.minuti);
      if (!Number.isInteger(minuti) || minuti < 0 || minuti > 720)
        return no(id, "invalid_format", "minuti non validi: da 0 a 720");
      return si(id, { entity_id: entita, scadenza: timer.programma(entita, minuti) });
    } catch (errore) {
      this.registro.errore(`timer del clima andato storto: ${errore?.message || errore}`);
      return no(id, "ponte_timer", "non ha funzionato");
    }
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

  async _segnalazioni(detto) {
    const id = detto.id ?? null;
    const mie = this.segnalazioni;
    if (!mie) return no(id, "unknown_command", `non conosco ${detto.type}`);
    const parola = (valore, massimo) =>
      typeof valore === "string" ? valore.slice(0, massimo) : "";
    try {
      switch (detto.type) {
        case "ponte/segnalazioni/elenco":
          return si(id, await mie.elenco({ aggiorna: detto.aggiorna === true }));
        case "ponte/segnalazioni/crea":
          return si(
            id,
            await mie.crea({
              tipo: parola(detto.tipo, 20),
              titolo: parola(detto.titolo, 200),
              corpo: parola(detto.corpo, 10000),
              diagnostica:
                detto.diagnostica && typeof detto.diagnostica === "object" ? detto.diagnostica : {},
            }),
          );
        case "ponte/segnalazioni/leggi":
          if (!Number.isFinite(Number(detto.numero)))
            return no(id, "invalid_format", "manca il numero");
          return si(id, await mie.leggi(Number(detto.numero)));
        case "ponte/segnalazioni/rispondi":
          if (!Number.isFinite(Number(detto.numero)))
            return no(id, "invalid_format", "manca il numero");
          return si(id, await mie.rispondi(Number(detto.numero), parola(detto.testo, 5000)));
        case "ponte/segnalazioni/allega": {
          if (!Number.isFinite(Number(detto.numero)))
            return no(id, "invalid_format", "manca il numero");
          const allegato = unAllegato(detto);
          if (!allegato) return no(id, "invalid_format", "manca il file, o non e' base64");
          return si(id, await mie.allega(Number(detto.numero), allegato));
        }
        case "ponte/chat/allega": {
          const allegato = unAllegato(detto);
          if (!allegato) return no(id, "invalid_format", "manca il file, o non e' base64");
          return si(id, await mie.allegaAllaChat(allegato));
        }
        case "ponte/chat/leggi":
          return si(id, { chat: await mie.chat() });
        case "ponte/chat/scrivi":
          return si(
            id,
            await mie.chatta(
              parola(detto.testo, 5000),
              detto.diagnostica && typeof detto.diagnostica === "object" ? detto.diagnostica : {},
            ),
          );
        default:
          return no(id, "unknown_command", `non conosco ${detto.type}`);
      }
    } catch (errore) {
      if (errore instanceof SenzaCentralino) return no(id, errore.codice, errore.message);
      if (errore instanceof CentralinoHaDettoNo) return no(id, errore.codice, errore.message);
      this.registro.errore(`segnalazione andata storta: ${errore?.message || errore}`);
      return no(id, "ponte_segnalazioni", "non ha funzionato");
    }
  }

  async _catalogo(detto) {
    const id = detto.id ?? null;
    if (!this.catalogo) return no(id, "unknown_command", `non conosco ${detto.type}`);
    let deviceIds = null;
    if (detto.device_ids !== undefined) {
      if (
        !Array.isArray(detto.device_ids) ||
        detto.device_ids.length > DISPOSITIVI_MASSIMI ||
        !detto.device_ids.every(
          (uno) => typeof uno === "string" && uno.length > 0 && uno.length <= 64,
        )
      )
        return no(id, "invalid_format", "device_ids non valido");
      deviceIds = detto.device_ids;
    }
    /* Per nome (#382): la scheda delle macchine chiede di chi sono i sensori
     * che ha trovato, a lotti. */
    let entityIds = null;
    if (detto.entity_ids !== undefined) {
      if (
        !Array.isArray(detto.entity_ids) ||
        detto.entity_ids.length > ENTITA_MASSIME ||
        !detto.entity_ids.every(
          (uno) => typeof uno === "string" && uno.length >= 3 && uno.length <= 255,
        )
      )
        return no(id, "invalid_format", "entity_ids non valido");
      entityIds = detto.entity_ids;
    }
    try {
      return si(id, await this.catalogo.chiedi({ deviceIds, entityIds }));
    } catch (errore) {
      this.registro.attenzione(`catalogo non costruito: ${errore?.message || errore}`);
      return no(
        id,
        errore?.code || "ponte_catalogo",
        String(errore?.message || "non ha funzionato"),
      );
    }
  }

  _elencoDelleFoto(detto) {
    const id = detto.id ?? null;
    if (!this.foto) return no(id, "unknown_command", `non conosco ${detto.type}`);
    const percorso = detto.path ?? "";
    if (typeof percorso !== "string" || percorso.length > 512)
      return no(id, "invalid_format", "percorso non valido");
    /* Da quale delle due cartelle: quella di Home Assistant — dove c'e' quello
     * che c'era gia' — o quella del ponte, dove finisce quello che si carica
     * dall'app.
     *
     * Senza dire niente si guarda in **quella di Home Assistant**, e non e'
     * una preferenza: chi chiede senza dire niente e' la maschera delle foto
     * della dashboard, e per lei `/local` vuol dire `config/www` di Home
     * Assistant. Prima si guardava nel ponte, e allora a chi ha duecento foto
     * in `config/www` la maschera diceva «la cartella config/www non esiste
     * ancora: creala» — rispondendo di un'altra cartella, e dando torto a una
     * persona che aveva ragione.
     *
     * Se la cartella di Home Assistant non e' montata — l'add-on senza
     * `homeassistant_config:ro`, o aggiornato e non ancora riavviato — si
     * ripiega su quella del ponte: e' meglio mostrare le foto caricate
     * dall'app che non mostrare niente. */
    const diCasa =
      detto.root === "casa" || (detto.root !== "ponte" && Boolean(this.fotoDiCasa?.cE));
    const dove = diCasa ? this.fotoDiCasa : this.foto;
    if (!dove) return no(id, "not_found", "Questa cartella non c'e'");
    const elenco = dove.elenca(percorso);
    if (elenco === null) return no(id, "not_found", "La cartella non esiste dentro www");
    /* Quali cartelle si possono guardare: la maschera lo chiede una volta e
     * sa se mostrare il tasto «Home Assistant», invece di offrirlo e poi
     * dire che non c'e' niente. */
    return si(id, {
      ...elenco,
      root: diCasa ? "casa" : "ponte",
      roots: {
        ponte: Boolean(this.foto?.cE),
        casa: Boolean(this.fotoDiCasa?.cE),
      },
    });
  }

  _caricaUnaFoto(detto) {
    const id = detto.id ?? null;
    if (!this.foto) return no(id, "unknown_command", `non conosco ${detto.type}`);
    if (typeof detto.filename !== "string" || !detto.filename || detto.filename.length > 255)
      return no(id, "invalid_format", "manca il nome del file");
    if (typeof detto.data !== "string" || !detto.data || detto.data.length > FOTO_MASSIMA * 2)
      return no(id, "invalid_format", "manca la foto");
    let byte;
    try {
      byte = Buffer.from(detto.data, "base64");
    } catch (_errore) {
      return no(id, "invalid_data", "La foto non e' leggibile.");
    }
    const messa = this.foto.carica(detto.filename, byte);
    if (!messa)
      return no(id, "invalid_upload", "Il file non e' un'immagine, o e' piu' grande di 10 MB.");
    return si(id, messa);
  }

  async _http(detto) {
    const id = detto?.id ?? null;
    const metodo = String(detto.metodo ?? "GET").toUpperCase();
    if (!METODI.has(metodo)) return no(id, "not_allowed", `il metodo ${metodo} non passa di qui`);

    const percorso = detto.percorso;
    if (typeof percorso !== "string" || !PERCORSO_BUONO.test(percorso) || percorso.includes("..")) {
      return no(id, "not_allowed", "percorso non valido");
    }

    /* Se chi chiede sa aprire il gzip. Un browser no, e lo dice. */
    const senzaGzip = detto.senzaGzip === true;

    let corpo = null;
    if (detto.corpo != null) {
      if (typeof detto.corpo !== "string") return no(id, "not_allowed", "corpo non valido");
      corpo = Buffer.from(detto.corpo, "base64");
      if (corpo.length > CORPO_MASSIMO) return no(id, "not_allowed", "corpo troppo grande");
    }

    /* Le foto caricate dalla plancia stanno nel ponte. */
    if (percorso.startsWith(`${BASE_DELLE_FOTO}/`) && this.foto) {
      const { stato, tipo, corpo: letto } = this.foto.leggi(percorso);
      return si(id, impacchetta(stato, tipo, letto, { senzaGzip }));
    }

    /* E `/local/…` e' la cartella `www` di Home Assistant.
     *
     * Dentro Home Assistant quell'indirizzo lo serve Home Assistant stessa, e
     * la plancia lo usa da sempre. Nell'app la plancia gira dietro il
     * servitore, e li' quell'indirizzo non porta da nessuna parte: se lo
     * serve il ponte, dal disco, e la stessa configurazione mostra la stessa
     * foto in tutti e due i posti. Sola lettura, e solo immagini. */
    if (percorso.startsWith(`${BASE_DI_CASA}/`) && this.fotoDiCasa) {
      const { stato, tipo, corpo: letto } = this.fotoDiCasa.leggi(percorso);
      return si(id, impacchetta(stato, tipo, letto, { senzaGzip }));
    }

    /* I file della plancia stanno qui, nell'add-on: non si va da nessuna
     * parte. Il metodo non conta, e' un file. */
    if (percorso.startsWith("/dashboardmodern_static/") && this.plancia?.cE) {
      const { stato, tipo, corpo: letto } = this.plancia.leggi(percorso);
      return si(id, impacchetta(stato, tipo, letto, { senzaGzip }));
    }

    const dove = await this._dove(percorso);
    if (!dove) {
      return no(id, "not_allowed", "di qui passano solo /api/, /dashboardmodern_static/ e /local/");
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
      return si(id, impacchetta(stato, tipo, ricevuto, { senzaGzip }));
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
 * `compresso` e sa cosa fare.
 *
 * Con `senzaGzip` non si comprime: e' quello che chiede l'app quando gira in
 * un **browser**, dove il gzip non si apre — `dart:io` non c'e', e mettersi in
 * casa un decompressore per una cosa che si puo' semplicemente non fare e' il
 * modo lungo. Sulla rete di casa qualche byte in piu' non si sente; fuori casa
 * e' il prezzo di poter guardare la casa da un browser. Chi non lo chiede —
 * cioe' ogni telefono — riceve quello che riceveva prima. */
export function impacchetta(stato, tipo, corpo, { senzaGzip = false } = {}) {
  const dati = Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo ?? "");
  const tipoPulito = String(tipo || "application/octet-stream");
  if (!senzaGzip && DA_COMPRIMERE.test(tipoPulito) && dati.length >= ALMENO) {
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
