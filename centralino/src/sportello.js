/* Lo sportello: la porta HTTP di fianco al filo.
 *
 * Il filo serve a parlare con la propria casa. Lo sportello serve a tutto il
 * resto — quello che non passa da un telefono e da una casa, ma da una casa e
 * dal manutentore: le segnalazioni.
 *
 * Perche' le segnalazioni passano da qui e non dal telefono: il gettone di
 * GitHub e' del manutentore e non deve stare su nessun telefono e in nessun
 * ponte. Sta sulla macchina, e viaggia solo verso `api.github.com`. La casa si
 * presenta col **suo** segreto — lo stesso del filo — e puo' leggere e
 * scrivere solo nelle issue che ha aperto lei.
 *
 * Chi non si e' mai presentato dal filo qui non entra. Lo sportello non fa
 * nascere case: prima la casa si collega, poi scrive. Se le facesse nascere,
 * chiunque potrebbe prendersi l'identificativo di una casa spenta senza
 * nemmeno provare ad aprirci un filo.
 *
 * Questa e' la stessa porta che sul Worker stava dentro l'oggetto della casa
 * (`nuvola/src/casa.js`), con le stesse vie e le stesse risposte: il ponte non
 * si accorge di aver cambiato indirizzo.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { Freno } from "./freno.js";
import { daChi } from "./indirizzo.js";
import {
  ALLEGATO_MASSIMO,
  CORPO_MASSIMO,
  GitHub,
  GitHubNonRisponde,
  RichiestaSbagliata,
  SCRITTURE_ALLORA,
  Segnalazioni,
} from "./segnalazioni.js";

/* Quante scritture verso GitHub in un'ora, da uno stesso indirizzo (in
 * IPv6: da una stessa rete /64) e in tutto. Il limite di ogni casa sta nelle
 * segnalazioni; questi due stanno sopra, per chi di case ne ha tante — o se
 * le fabbrica. Il tetto in tutto e' anche quello che tiene il gettone lontano
 * dai limiti di GitHub.
 *
 * Il tetto in tutto vale solo per le case **giovani**. Chi volesse riempirlo
 * dovrebbe farlo con case nuove — fabbricarle costa poco — e se valesse per
 * tutte, fermerebbe anche quelle che scrivono da mesi. Una casa nata da piu'
 * di una settimana ha solo il suo limite e quello del suo indirizzo. */
export const SCRITTURE_PER_INDIRIZZO = Math.round(SCRITTURE_ALLORA * 1.5);
export const SCRITTURE_IN_TUTTO = 600;
export const CASA_ANZIANA = 7 * 24 * 60 * 60 * 1000;

/* `/casa/<casa_…>/segnalazioni`, piu' il numero e la coda quando ci sono. */
export const VIA_DELLE_SEGNALAZIONI =
  /^\/casa\/([A-Za-z0-9_]+)\/segnalazioni(?:\/(\d+))?(?:\/(risposte|allegati))?$/;

export function json(risposta, corpo, stato = 200) {
  const testo = JSON.stringify(corpo);
  risposta.writeHead(stato, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(testo),
    /* Il centralino lo chiama anche una versione web dell'app, da un'origine
     * qualunque. Non c'e' niente da difendere con l'origine: qui non ci sono
     * biscotti e nessuna autorita' implicita — chi bussa senza sapere niente
     * non ottiene niente. */
    "access-control-allow-origin": "*",
  });
  risposta.end(testo);
}

/* Il magazzino di una casa, con la faccia che `Segnalazioni` si aspetta.
 *
 * Sul Worker era lo `storage` dell'oggetto della casa: due chiavi,
 * `segnalazioni` e `scritture`, lette e scritte una alla volta. Qui e' un file
 * per casa, che e' la stessa cosa vista da vicino — e tenerli separati vuol
 * dire che una casa rumorosa non fa riscrivere l'archivio di tutte le altre.
 */
class MagazzinoDellaCasa {
  constructor(cartella, casa) {
    this.archivio = new Archivio(join(cartella, "segnalazioni", `${casa}.json`), {});
  }

  async get(chiave) {
    return this.archivio.dati[chiave];
  }

  async put(chiave, valore) {
    this.archivio.dati[chiave] = valore;
    this.archivio.salva();
  }
}

export class Sportello {
  constructor({
    case: case_,
    cartella = "./dati",
    gettone = "",
    repo = "",
    /* Dove vanno foto e video: un'altra repository, se si vuole. Vuota vuol
     * dire «la stessa delle issue», che e' come stava prima. */
    repoAllegati = "",
    /* E su quale ramo: vuoto vuol dire quello principale. Vedi
     * `segnalazioni.js`, dove c'e' il perche'. */
    ramoAllegati = "",
    scritturePerIndirizzo = SCRITTURE_PER_INDIRIZZO,
    scrittureInTutto = SCRITTURE_IN_TUTTO,
    fetch: prendi = globalThis.fetch,
    adesso = () => Date.now(),
    registro = null,
  }) {
    this.case = case_;
    this.cartella = cartella;
    this.gettone = gettone;
    this.repo = repo;
    this.repoAllegati = repoAllegati;
    this.ramoAllegati = ramoAllegati;
    this.prendi = prendi;
    this.adesso = adesso;
    this.registro = registro;
    this.perIndirizzo = new Freno({ perChi: scritturePerIndirizzo, adesso });
    this.inTutto = new Freno({ inTutto: scrittureInTutto, adesso });
  }

  /* Una scrittura in piu', se c'e' posto. Il tetto in tutto non ferma le
   * case anziane (vedi sopra), ma le conta lo stesso. */
  _concedi(chi, anziana) {
    if (!this.perIndirizzo.cePosto(chi)) return false;
    if (!anziana && !this.inTutto.cePosto()) return false;
    this.perIndirizzo.conta(chi);
    this.inTutto.conta();
    return true;
  }

  _github() {
    return new GitHub({
      token: this.gettone,
      repo: this.repo,
      repoAllegati: this.repoAllegati,
      ramoAllegati: this.ramoAllegati,
      fetch: this.prendi,
    });
  }

  /* Se le segnalazioni sono accese. La console lo dice in `/salute`: senza
   * gettone lo sportello risponde lo stesso, ma dice che non e' configurato
   * invece di far finta di aver spedito. */
  get pronto() {
    return this._github().pronto;
  }

  /* Torna `true` se la via era sua — risposta gia' mandata — e `false` se non
   * la riguarda, cosi' chi chiama prova le altre porte. */
  async forseServe(richiesta, risposta, via) {
    const pezzi = VIA_DELLE_SEGNALAZIONI.exec(via);
    if (!pezzi) return false;
    await this._servi(richiesta, risposta, pezzi);
    return true;
  }

  async _servi(richiesta, risposta, [, casa, numero, coda]) {
    const segreto = /^Casa (.+)$/.exec(richiesta.headers.authorization || "")?.[1];
    if (!segreto) {
      json(risposta, { errore: "senza_segreto", spiegazione: "serve il segreto della casa" }, 401);
      return;
    }
    if (!this.case.verifica(casa, segreto)) {
      json(risposta, { errore: "non_ti_riconosco", spiegazione: "non ti riconosco" }, 403);
      return;
    }

    const nata = Number(this.case.quella?.(casa)?.natoIl || 0);
    const anziana = nata > 0 && this.adesso() - nata >= CASA_ANZIANA;
    const segnalazioni = new Segnalazioni({
      storage: new MagazzinoDellaCasa(this.cartella, casa),
      github: this._github(),
      casa,
      adesso: this.adesso,
      freno: async (chi) => this._concedi(chi, anziana),
      chi: daChi(richiesta),
    });
    const metodo = richiesta.method;

    try {
      if (!numero && !coda && metodo === "GET") {
        json(risposta, { segnalazioni: await segnalazioni.elenco() });
        return;
      }
      if (!numero && !coda && metodo === "POST") {
        json(risposta, await segnalazioni.crea(await corpoDi(richiesta)), 201);
        return;
      }
      if (numero && !coda && metodo === "GET") {
        json(risposta, await segnalazioni.leggi(Number(numero)));
        return;
      }
      if (numero && coda === "risposte" && metodo === "POST") {
        const { testo } = await corpoDi(richiesta);
        json(risposta, await segnalazioni.rispondi(Number(numero), testo));
        return;
      }
      if (numero && coda === "allegati" && metodo === "POST") {
        json(risposta, await segnalazioni.allega(Number(numero), await allegatoDi(richiesta)), 201);
        return;
      }
      json(risposta, { errore: "non_trovato", spiegazione: "qui non c'e' niente" }, 404);
    } catch (errore) {
      if (errore instanceof RichiestaSbagliata) {
        json(risposta, { errore: errore.codice, spiegazione: errore.message }, errore.stato);
        return;
      }
      if (errore instanceof GitHubNonRisponde) {
        json(
          risposta,
          {
            errore: "github",
            spiegazione: `GitHub ha risposto ${errore.stato}: ${errore.message}`,
          },
          502,
        );
        return;
      }
      /* Il motivo vero va nel registro, non nella risposta: quello che esce
       * di qui lo legge chiunque bussi, e un errore interno racconta com'e'
       * fatta la macchina. */
      this.registro?.errore?.(`lo sportello e' inciampato: ${errore?.stack || errore}`);
      json(
        risposta,
        {
          errore: "centralino",
          spiegazione: "Il centralino ha avuto un problema: riprova fra poco.",
        },
        500,
      );
    }
  }
}

/* Il corpo, con un tetto **mentre arriva** e non solo dichiarato.
 *
 * `content-length` lo scrive chi bussa, quindi da solo non difende niente: si
 * conta quello che arriva davvero, e alla prima riga oltre il tetto si chiude
 * invece di tenere in memoria un fiume. */
export async function byteDi(richiesta, massimo) {
  const dichiarato = Number(richiesta.headers["content-length"] || 0);
  if (dichiarato > massimo)
    throw new RichiestaSbagliata("troppo_grande", "Il corpo e' troppo grande.", 413);
  const pezzi = [];
  let quanti = 0;
  for await (const pezzo of richiesta) {
    quanti += pezzo.length;
    if (quanti > massimo) {
      richiesta.destroy();
      throw new RichiestaSbagliata("troppo_grande", "Il corpo e' troppo grande.", 413);
    }
    pezzi.push(pezzo);
  }
  return Buffer.concat(pezzi);
}

export async function corpoDi(richiesta) {
  const testo = (await byteDi(richiesta, CORPO_MASSIMO)).toString("utf8");
  if (!testo.trim()) return {};
  try {
    const letto = JSON.parse(testo);
    return letto && typeof letto === "object" ? letto : {};
  } catch (_errore) {
    throw new RichiestaSbagliata("non_json", "Il corpo non e' JSON.", 400);
  }
}

/* Un allegato: il file cosi' com'e' nel corpo, il tipo nel `content-type`, il
 * nome in un'intestazione. Niente JSON, niente base64: dieci megabyte passano
 * una volta sola. */
async function allegatoDi(richiesta) {
  const byte = await byteDi(richiesta, ALLEGATO_MASSIMO);
  return {
    nome: richiesta.headers["x-gdahome-nome"] || "allegato",
    tipo: String(richiesta.headers["content-type"] || "")
      .split(";")[0]
      .trim(),
    byte: new Uint8Array(byte),
  };
}
