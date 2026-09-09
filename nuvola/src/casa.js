/* Una casa, e i telefoni che la stanno guardando.
 *
 * Tutto quello che riguarda una casa sta qui dentro: il filo che lei tiene
 * aperto verso il centralino, e un canale per ogni telefono. Due case non si
 * vedono, non si aspettano e non si rallentano.
 *
 * ─── Dormire ─────────────────────────────────────────────────────────────
 *
 * I fili si accettano con `acceptWebSocket`, non con `accept`. La differenza
 * e' tutta la ragione per cui questa cosa e' gratis: cosi' li tiene aperti
 * Cloudflare, e **questo oggetto smette di esistere** finche' non arriva un
 * messaggio. Una casa ferma di notte non costa niente. Il prezzo e' che fra un
 * messaggio e l'altro non si puo' ricordare niente a memoria: quello che serve
 * si scrive addosso al filo — `serializeAttachment` — o nel proprio archivio.
 * Ogni variabile d'istanza qui dentro sarebbe un difetto che si vede solo
 * dopo, quando la casa e' rimasta zitta abbastanza a lungo.
 *
 * ─── Il colpetto a cui si risponde nel sonno ─────────────────────────────
 *
 * La casa manda un colpetto ogni mezzo minuto — le serve per accorgersi dei
 * fili che muoiono senza cadere, vedi `ponte/src/chiamata.js`. Se a
 * rispondergli fosse `webSocketMessage` sveglierebbe questo oggetto due volte
 * al minuto, per sempre, e una casa ferma di notte smetterebbe di costare
 * niente.
 *
 * `setWebSocketAutoResponse` risponde al posto nostro: e' Cloudflare a
 * riconoscere quel messaggio esatto e a rimandare la risposta, senza che
 * l'oggetto si svegli. Il filo resta caldo, il router di casa tiene la sua
 * riga, e qui non gira niente.
 *
 * ─── Chi e' un filo ──────────────────────────────────────────────────────
 *
 * Le targhette dicono chi e': `casa` per il filo della casa, `telefono` e
 * `c<numero>` per i telefoni. Servono anche a instradare, che e' l'unica cosa
 * che questo oggetto fa davvero: un messaggio con dentro `c: 5` va al filo con
 * la targhetta `c5`, senza che nessuno abbia guardato cosa c'e' scritto.
 */

import { impronta, stessaImpronta } from "./segreti.js";
import { quelCodice } from "./dove.js";
import { CASA_VALIDA, IMPRONTA_VALIDA } from "./nomi.js";
import {
  ALLEGATO_MASSIMO,
  GitHub,
  GitHubNonRisponde,
  RichiestaSbagliata,
  Segnalazioni,
} from "./segnalazioni.js";

/* Un corpo piu' grande di cosi' non e' una segnalazione. */
const CORPO_MASSIMO = 64 * 1024;

/* Quanti telefoni insieme puo' avere una casa. Oltre non e' una famiglia. */
const TELEFONI_PER_CASA = 20;

/* «Non per la rete, per la politica»: chi lo riceve lo legge come definitivo e
 * smette di riprovare, invece di girare a vuoto per sempre. */
const PER_REGOLA = 1008;
const NORMALE = 1000;

/* Il colpetto: uguale all'andata e al ritorno, e scritto qui una volta sola —
 * la coppia della risposta automatica confronta il testo **esatto**, quindi
 * fabbricarlo con `JSON.stringify` in due posti sarebbe un modo elegante di
 * romperlo il giorno che uno dei due mette uno spazio. */
const COLPETTO = '{"t":"battito"}';

export class Casa {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  /* ─── Chi arriva ──────────────────────────────────────────────────────── */

  async fetch(richiesta) {
    /* Le segnalazioni e la chat arrivano in HTTP, dal ponte: non aprono
     * nessun filo, chiedono e ricevono una risposta. */
    if (richiesta.headers.get("Upgrade") !== "websocket") return this._http(richiesta);

    const via = new URL(richiesta.url).pathname;
    const da = richiesta.headers.get("cf-connecting-ip") || "?";
    const [alClient, mia] = Object.values(new WebSocketPair());

    const laCasa = /^\/casa\/([A-Za-z0-9_]+)$/.exec(via);
    if (laCasa) this._accogliLaCasa(mia, laCasa[1]);
    else await this._accogliUnTelefono(mia, da);

    return new Response(null, { status: 101, webSocket: alClient });
  }

  _accogliLaCasa(presa, atteso) {
    /* Una casa sola per identificativo. Chi arriva secondo prende il posto del
     * primo, e non il contrario: il primo puo' essere un filo morto che
     * nessuno ha ancora dichiarato tale, e la casa vera che si riaggancia non
     * deve restare fuori per colpa del proprio fantasma. */
    for (const vecchia of this.state.getWebSockets("casa")) {
      try {
        vecchia.close(NORMALE, "questa casa si e' ricollegata");
      } catch (_errore) {
        /* Gia' chiusa. */
      }
    }
    this.state.acceptWebSocket(presa, ["casa"]);
    this._rispondiAiColpetti();
    presa.serializeAttachment({ chi: "casa", atteso, entrata: false });
  }

  async _accogliUnTelefono(presa, da) {
    const casa = this.state.getWebSockets("casa")[0];
    if (!casa) {
      /* Detto com'e': «questa casa adesso non e' collegata». Non e' un
       * rifiuto, e il telefono deve riprovare fra poco invece di arrendersi. */
      presa.accept();
      presa.close(NORMALE, "casa non collegata");
      return;
    }
    if (this.state.getWebSockets("telefono").length >= TELEFONI_PER_CASA) {
      presa.accept();
      presa.close(NORMALE, "troppi telefoni su questa casa");
      return;
    }

    const numero = (await this.state.storage.get("prossimoCanale")) ?? 1;
    await this.state.storage.put("prossimoCanale", numero + 1);

    this.state.acceptWebSocket(presa, ["telefono", `c${numero}`]);
    presa.serializeAttachment({ chi: "telefono", numero });
    casa.send(JSON.stringify({ c: numero, t: "apri", da }));
  }

  /* Il colpetto e la sua risposta. Si dichiara a ogni casa che arriva perche'
   * questo oggetto si dimentica tutto fra un risveglio e l'altro, e dichiarare
   * due volte la stessa coppia non costa niente. */
  _rispondiAiColpetti() {
    const Coppia = globalThis.WebSocketRequestResponsePair;
    if (typeof Coppia !== "function") return;
    try {
      this.state.setWebSocketAutoResponse(new Coppia(COLPETTO, COLPETTO));
    } catch (_errore) {
      /* Un runtime che non lo sa fare: si risponde svegliandosi, sotto. */
    }
  }

  /* ─── Quello che passa ────────────────────────────────────────────────── */

  async webSocketMessage(presa, messaggio) {
    const suo = presa.deserializeAttachment() ?? {};
    if (typeof messaggio !== "string") return;

    if (suo.chi === "telefono") {
      /* Byte, e si spostano. Qui dentro non si guarda mai. */
      const casa = this.state.getWebSockets("casa")[0];
      if (casa) casa.send(JSON.stringify({ c: suo.numero, t: "d", m: messaggio }));
      return;
    }
    if (suo.chi !== "casa") return;

    /* Il ripiego, per un runtime che non sa rispondere da solo: si risponde
     * qui, svegliandosi. Meglio svegliarsi che lasciar morire il filo. */
    if (messaggio === COLPETTO) {
      presa.send(COLPETTO);
      return;
    }

    let detto;
    try {
      detto = JSON.parse(messaggio);
    } catch (_errore) {
      this._rifiuta(presa, "non ho capito");
      return;
    }
    if (!detto || typeof detto !== "object") {
      this._rifiuta(presa, "non ho capito");
      return;
    }

    if (!suo.entrata) {
      await this._siPresenta(presa, suo, detto);
      return;
    }

    switch (detto.t) {
      case "apri-abbinamento":
        await this._apriUnAbbinamento(suo, detto.impronta);
        return;
      case "chiudi-abbinamento":
        await this._chiudiGliAbbinamenti();
        return;
      case "d":
        this._versoIlTelefono(detto.c, detto.m);
        return;
      case "chiudi":
        this._chiudiIlCanale(detto.c, "la casa ha chiuso");
        return;
      default:
        /* Roba che non si conosce si lascia perdere: una casa piu' nuova del
         * centralino puo' dire cose che qui non si sanno ancora, e non e' un
         * motivo per buttarla fuori. */
        return;
    }
  }

  async _siPresenta(presa, suo, detto) {
    if (detto.t !== "sono-io") {
      this._rifiuta(presa, "prima bisogna presentarsi");
      return;
    }
    /* L'identificativo dell'indirizzo e quello del messaggio devono essere lo
     * stesso. Se non lo fossero, una casa potrebbe farsi consegnare l'oggetto
     * di un'altra e poi presentarsi con il proprio nome, e quello che si
     * ritroverebbe in mano sarebbero i telefoni dell'altra. */
    if (!CASA_VALIDA.test(String(detto.casa ?? "")) || detto.casa !== suo.atteso) {
      this._rifiuta(presa, "non ti riconosco");
      return;
    }

    const sua = await impronta(detto.segreto);
    const conosciuta = await this.state.storage.get("impronta");
    if (conosciuta === undefined) {
      /* La prima casa che si presenta con questo identificativo se lo prende.
       * Sono centoventotto bit di caso scelti dal ponte: nessuno li indovina,
       * e nessuno li registra da qualche parte prima. */
      await this.state.storage.put("impronta", sua);
    } else if (!stessaImpronta(conosciuta, sua)) {
      this._rifiuta(presa, "non ti riconosco");
      return;
    }

    presa.serializeAttachment({ ...suo, entrata: true });
    presa.send(JSON.stringify({ t: "bene" }));
  }

  /* ─── Gli abbinamenti ─────────────────────────────────────────────────── */

  async _apriUnAbbinamento(suo, impronta) {
    if (typeof impronta !== "string" || !IMPRONTA_VALIDA.test(impronta)) return;
    await this._chiudiGliAbbinamenti();
    await this.state.storage.put("abbinamento", impronta);
    await quelCodice(this.env, impronta).fetch("https://centralino/apri", {
      method: "POST",
      body: JSON.stringify({ casa: suo.atteso }),
    });
  }

  async _chiudiGliAbbinamenti() {
    const vecchia = await this.state.storage.get("abbinamento");
    if (!vecchia) return;
    await this.state.storage.delete("abbinamento");
    await quelCodice(this.env, vecchia).fetch("https://centralino/chiudi", {
      method: "POST",
    });
  }

  /* ─── I canali ────────────────────────────────────────────────────────── */

  _versoIlTelefono(numero, messaggio) {
    if (typeof numero !== "number" || typeof messaggio !== "string") return;
    const telefono = this.state.getWebSockets(`c${numero}`)[0];
    if (telefono) telefono.send(messaggio);
  }

  _chiudiIlCanale(numero, perche) {
    if (typeof numero !== "number") return;
    const telefono = this.state.getWebSockets(`c${numero}`)[0];
    if (telefono) telefono.close(NORMALE, perche);
  }

  /* ─── Quando qualcuno se ne va ────────────────────────────────────────── */

  async webSocketClose(presa) {
    await this._finita(presa);
  }

  async webSocketError(presa) {
    await this._finita(presa);
  }

  async _finita(presa) {
    const suo = presa.deserializeAttachment() ?? {};

    if (suo.chi === "telefono") {
      const casa = this.state.getWebSockets("casa")[0];
      if (casa) casa.send(JSON.stringify({ c: suo.numero, t: "chiudi" }));
      return;
    }
    if (suo.chi !== "casa") return;

    /* I telefoni non restano appesi a una casa che non c'e' piu': meglio che
     * si accorgano subito e ribussino, invece di parlare nel vuoto. */
    for (const telefono of this.state.getWebSockets("telefono")) {
      try {
        telefono.close(NORMALE, "la casa si e' scollegata");
      } catch (_errore) {
        /* Gia' chiusa. */
      }
    }
    await this._chiudiGliAbbinamenti();
  }

  /* ─── Le segnalazioni e la chat ───────────────────────────────────────── */

  /* La casa si presenta col suo segreto — lo stesso della chiamata — e
   * ottiene le sue issue, e solo le sue. Chi non si e' mai presentato dal
   * filo non ha ancora un'impronta qui, e non entra: prima la casa si
   * collega, poi scrive. */
  async _http(richiesta) {
    const via = new URL(richiesta.url).pathname;
    const pezzi =
      /^\/casa\/([A-Za-z0-9_]+)\/(segnalazioni|chat)(?:\/(\d+))?(?:\/(risposte|messaggi|allegati))?$/.exec(
        via,
      );
    if (!pezzi)
      return rispostaJson({ errore: "non_trovato", spiegazione: "qui non c'e' niente" }, 404);
    const [, casa, cosa, numero, coda] = pezzi;

    const segreto = /^Casa (.+)$/.exec(richiesta.headers.get("authorization") || "")?.[1];
    if (!segreto) {
      return rispostaJson(
        { errore: "senza_segreto", spiegazione: "serve il segreto della casa" },
        401,
      );
    }
    const conosciuta = await this.state.storage.get("impronta");
    if (conosciuta === undefined || !stessaImpronta(conosciuta, await impronta(segreto))) {
      return rispostaJson({ errore: "non_ti_riconosco", spiegazione: "non ti riconosco" }, 403);
    }

    const github = new GitHub({ token: this.env.GITHUB_SEGNALAZIONI, repo: this.env.GITHUB_REPO });
    const segnalazioni = new Segnalazioni({ storage: this.state.storage, github, casa });
    const metodo = richiesta.method;
    try {
      if (cosa === "segnalazioni") {
        if (!numero && !coda && metodo === "GET") {
          return rispostaJson({ segnalazioni: await segnalazioni.elenco() });
        }
        if (!numero && !coda && metodo === "POST") {
          return rispostaJson(await segnalazioni.crea(await corpoDi(richiesta)), 201);
        }
        if (numero && !coda && metodo === "GET") {
          return rispostaJson(await segnalazioni.leggi(Number(numero)));
        }
        if (numero && coda === "risposte" && metodo === "POST") {
          const { testo } = await corpoDi(richiesta);
          return rispostaJson(await segnalazioni.rispondi(Number(numero), testo));
        }
        if (numero && coda === "allegati" && metodo === "POST") {
          return rispostaJson(
            await segnalazioni.allega(Number(numero), await allegatoDi(richiesta)),
            201,
          );
        }
      } else if (!numero) {
        if (!coda && metodo === "GET") return rispostaJson({ chat: await segnalazioni.chat() });
        if (coda === "messaggi" && metodo === "POST") {
          const { testo, diagnostica } = await corpoDi(richiesta);
          return rispostaJson(await segnalazioni.chatta(testo, diagnostica), 201);
        }
        if (coda === "allegati" && metodo === "POST") {
          const allegato = await allegatoDi(richiesta);
          return rispostaJson(await segnalazioni.allegaAllaChat(allegato, {}), 201);
        }
      }
      return rispostaJson({ errore: "non_trovato", spiegazione: "qui non c'e' niente" }, 404);
    } catch (errore) {
      if (errore instanceof RichiestaSbagliata) {
        return rispostaJson({ errore: errore.codice, spiegazione: errore.message }, errore.stato);
      }
      if (errore instanceof GitHubNonRisponde) {
        return rispostaJson(
          {
            errore: "github",
            spiegazione: `GitHub ha risposto ${errore.stato}: ${errore.message}`,
          },
          502,
        );
      }
      return rispostaJson(
        { errore: "centralino", spiegazione: String(errore?.message || errore) },
        500,
      );
    }
  }

  /* Rifiutare **dicendolo**.
   *
   * Chiudere e basta sarebbe la cosa peggiore: il ponte vedrebbe un filo
   * caduto, che e' quello che succede mille volte al giorno per colpa della
   * rete, e ribusserebbe all'infinito senza capire. Un rifiuto e' un'altra
   * cosa da una caduta — non passera' col tempo — e va detto, cosi' chi lo
   * riceve puo' smettere e scriverlo nel proprio registro. */
  _rifiuta(presa, perche) {
    try {
      presa.send(JSON.stringify({ t: "no", perche }));
      presa.close(PER_REGOLA, perche);
    } catch (_errore) {
      /* Gia' chiusa. */
    }
  }
}

function rispostaJson(corpo, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/* Un allegato: il file cosi' com'e' nel corpo, il tipo nel `content-type`,
 * il nome in un'intestazione. Niente JSON, niente base64: dieci megabyte
 * passano una volta sola. */
async function allegatoDi(richiesta) {
  const dichiarato = Number(richiesta.headers.get("content-length") || 0);
  if (dichiarato > ALLEGATO_MASSIMO)
    throw new RichiestaSbagliata("troppo_grande", "L'allegato e' troppo grande.", 413);
  const byte = new Uint8Array(await richiesta.arrayBuffer());
  if (byte.length > ALLEGATO_MASSIMO)
    throw new RichiestaSbagliata("troppo_grande", "L'allegato e' troppo grande.", 413);
  return {
    nome: richiesta.headers.get("x-gdahome-nome") || "allegato",
    tipo: (richiesta.headers.get("content-type") || "").split(";")[0].trim(),
    byte,
  };
}

async function corpoDi(richiesta) {
  const testo = await richiesta.text();
  if (testo.length > CORPO_MASSIMO)
    throw new RichiestaSbagliata("troppo_grande", "Il corpo e' troppo grande.", 413);
  if (!testo.trim()) return {};
  try {
    const letto = JSON.parse(testo);
    return letto && typeof letto === "object" ? letto : {};
  } catch (_errore) {
    throw new RichiestaSbagliata("non_json", "Il corpo non e' JSON.", 400);
  }
}
