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
import {
  ALLEGATO_MASSIMO,
  CORPO_MASSIMO,
  GitHub,
  GitHubNonRisponde,
  RichiestaSbagliata,
  Segnalazioni,
} from "./segnalazioni.js";

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
    fetch: prendi = globalThis.fetch,
    adesso = () => Date.now(),
  }) {
    this.case = case_;
    this.cartella = cartella;
    this.gettone = gettone;
    this.repo = repo;
    this.prendi = prendi;
    this.adesso = adesso;
  }

  _github() {
    return new GitHub({ token: this.gettone, repo: this.repo, fetch: this.prendi });
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

    const segnalazioni = new Segnalazioni({
      storage: new MagazzinoDellaCasa(this.cartella, casa),
      github: this._github(),
      casa,
      adesso: this.adesso,
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
      json(risposta, { errore: "centralino", spiegazione: String(errore?.message || errore) }, 500);
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
