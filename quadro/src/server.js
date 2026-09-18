/* La porta del quadro.
 *
 * Poche vie, e due mondi che non si toccano.
 *
 *   GET    /                          la soglia: cos'e' questo indirizzo
 *   GET    /salute                    dice solo che e' vivo
 *
 *   POST   /cartolina                 una casa deposita i suoi numeri
 *
 *   GET    /console/                  la pagina, e sotto le sue vie
 *   GET    /console/case              le case, gia' vestite
 *   GET    /console/inviti            i codici in attesa
 *   POST   /console/inviti            fanne uno nuovo
 *   DELETE /console/inviti/<codice>   annullalo
 *   PUT    /console/casa/<casa_…>     il nome che le da' l'installatore
 *   DELETE /console/casa/<casa_…>     non seguirla piu'
 *
 * ─── Due chiavi diverse, e non e' una complicazione inutile ──────────────
 *
 * Dal **davanti** entrano le case, ognuna con la chiave che le e' stata data:
 * quella apre una porta sola — depositare una cartolina per la propria
 * matricola — e non fa vedere niente. Dal **retro** entra l'installatore con
 * la chiave della console, e quella fa vedere tutto e non permette di
 * depositare niente.
 *
 * Con una chiave sola, una casa qualunque potrebbe leggere l'elenco degli
 * impianti di chi l'ha installata — cioe' i clienti di qualcun altro.
 *
 * ─── Cosa non c'e' ───────────────────────────────────────────────────────
 *
 * Non c'e' nessuna via che entri in una casa, e non e' una dimenticanza:
 * questo pezzo riceve numeri e li mostra. Per entrare in una casa serve un
 * abbinamento, e quello lo da' chi ci abita.
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import { CASA_VALIDA, TroppiInviti } from "./chiavi.js";
import { DISCO_FINITO, DISCO_PIENO, TROPPO_CALDO } from "./collaudo.js";
import { stessoSegreto } from "./segreti.js";

/** Quanto puo' essere grossa una cartolina. Le vere stanno sotto i quattro. */
const CARTOLINA_MASSIMA = 64 * 1024;

/* La pagina della console: una sola, letta dal disco al primo che la chiede e
 * poi tenuta in memoria. */
const PAGINA = new URL("../console/index.html", import.meta.url);
let pagina;

export function json(risposta, corpo, stato = 200) {
  const testo = JSON.stringify(corpo);
  risposta.writeHead(stato, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(testo),
  });
  risposta.end(testo);
}

const male = (risposta, stato, perche) => json(risposta, { errore: perche }, stato);

const ilSegno = (richiesta) =>
  (/^Bearer\s+(.+)$/i.exec(String(richiesta.headers.authorization || "").trim()) || [])[1] || "";

async function ilCorpo(richiesta, massimo) {
  let quanto = 0;
  const pezzi = [];
  for await (const pezzo of richiesta) {
    quanto += pezzo.length;
    if (quanto > massimo) throw new TroppoGrosso("questa cartolina e' troppo grossa");
    pezzi.push(pezzo);
  }
  try {
    return JSON.parse(Buffer.concat(pezzi).toString("utf8"));
  } catch (_errore) {
    throw new TroppoGrosso("questo non e' JSON");
  }
}

class TroppoGrosso extends Error {}

export function costruisciIlServer({
  case: case_,
  chiavi,
  chiaveDellaConsole = "",
  registro = { debug() {}, info() {}, attenzione() {}, errore() {} },
}) {
  /* La console e' aperta solo dove c'e' una chiave vera. Senza, questo quadro
   * riceve le cartoline e non le fa vedere a nessuno: e' una meta' inutile, e
   * va detto all'accensione invece di farlo scoprire aprendo la pagina. */
  const consoleAperta = String(chiaveDellaConsole).length >= 16;

  const puoGuardare = (richiesta) =>
    consoleAperta && stessoSegreto(ilSegno(richiesta), String(chiaveDellaConsole));

  return createServer((richiesta, risposta) => {
    servi(richiesta, risposta).catch((errore) => {
      registro.errore(`il quadro e' inciampato: ${errore?.message || errore}`);
      if (!risposta.headersSent) male(risposta, 500, "qualcosa e' andato storto");
    });
  });

  async function servi(richiesta, risposta) {
    /* La barra finale **non** si toglie, e non e' una svista.
     *
     * La pagina della console chiede le sue vie in relativo — `case`, non
     * `/console/case` — cosi' funziona anche dietro un proxy che la monta
     * sotto un prefisso. Un indirizzo relativo si risolve contro la cartella:
     * da `/console/` porta a `/console/case`, da `/console` porterebbe a
     * `/case`. Percio' la pagina sta su `/console/` e chi bussa a `/console`
     * ci viene mandato, invece di ricevere una pagina i cui tasti non
     * funzionano. */
    const via = (richiesta.url || "/").split("?")[0];
    const metodo = richiesta.method || "GET";

    if ((via === "/salute" || via === "/salute/") && metodo === "GET") {
      json(risposta, {
        vivo: true,
        case: case_.lista.length,
        /* Se la console si puo' aprire. Chi accende un quadro e non mette la
         * chiave lo scopre da qui, invece che da una pagina che dice sempre
         * «la chiave non va bene». */
        console: consoleAperta,
      });
      return;
    }

    if (via === "/" && metodo === "GET") {
      /* La soglia. Chi si tiene l'indirizzo fra i segnalibri prima o poi lo
       * apre nudo, e trovarci un errore in JSON vuol dire crederlo rotto. */
      risposta.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      risposta.end(
        "Il quadro di gdahome.\n\n" +
          "Qui le case installate depositano poche righe di numeri, e chi le ha\n" +
          "installate le guarda. Non si entra in nessuna casa da qui.\n\n" +
          "La console sta su /console/.\n",
      );
      return;
    }

    /* ─── Il davanti: le case ──────────────────────────────────────────── */

    if (via === "/cartolina" && metodo === "POST") {
      const casa = String(richiesta.headers["x-casa"] || "");
      if (!CASA_VALIDA.test(casa)) {
        male(risposta, 400, "questa non e' una matricola");
        return;
      }
      if (!chiavi.riconosci(casa, ilSegno(richiesta))) {
        /* Non si distingue «chiave sbagliata» da «chiave di un'altra casa»:
         * chi bussa con una chiave che non e' sua non deve imparare niente da
         * come gli si dice di no. */
        male(risposta, 403, "questa chiave non apre niente");
        return;
      }
      let carta;
      try {
        carta = await ilCorpo(richiesta, CARTOLINA_MASSIMA);
      } catch (errore) {
        male(risposta, 413, String(errore?.message || errore));
        return;
      }
      if (!carta || typeof carta !== "object" || Array.isArray(carta)) {
        male(risposta, 400, "una cartolina e' un oggetto");
        return;
      }
      /* La matricola che conta e' quella in testa, non quella nel corpo: la
       * prima e' stata verificata contro una chiave, la seconda l'ha scritta
       * chi manda. Si riscrive, e non si discute. */
      const prima = case_.quella(casa);
      case_.deposita(casa, { ...carta, casa });
      if (!prima) registro.info(`una casa nuova si e' presentata: ${casa}`);
      json(risposta, { presa: true });
      return;
    }

    /* ─── Il retro: l'installatore ─────────────────────────────────────── */

    if (via === "/console" && metodo === "GET") {
      risposta.writeHead(301, { location: "/console/" });
      risposta.end();
      return;
    }

    if (via === "/console/" && metodo === "GET") {
      laPagina(risposta);
      return;
    }

    if (via.startsWith("/console/")) {
      if (!puoGuardare(richiesta)) {
        male(
          risposta,
          401,
          consoleAperta ? "la chiave non va bene" : "questo quadro non ha console",
        );
        return;
      }
      await ilRetro(richiesta, risposta, via.slice("/console".length).replace(/\/+$/, ""), metodo);
      return;
    }

    male(risposta, 404, "qui non c'e' niente");
  }

  async function ilRetro(richiesta, risposta, via, metodo) {
    if (via === "/case" && metodo === "GET") {
      json(risposta, {
        case: case_.elenco(),
        /* Le soglie con cui la pagina colora i metri sono **le stesse** con cui
         * qui si decide se una casa è da guardare. Viaggiano insieme alle case
         * invece di stare scritte anche nella pagina: due numeri uguali in due
         * posti sono due numeri che prima o poi diventano diversi. */
        soglie: { troppoCaldo: TROPPO_CALDO, discoPieno: DISCO_PIENO, discoFinito: DISCO_FINITO },
      });
      return;
    }

    if (via === "/inviti" && metodo === "GET") {
      json(risposta, { inviti: chiavi.elenco() });
      return;
    }

    if (via === "/inviti" && metodo === "POST") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 4096);
      } catch (_errore) {
        detto = {};
      }
      try {
        const codice = chiavi.fai({ per: detto?.per });
        registro.info("un codice nuovo, buono per una casa e per un quarto d'ora");
        json(risposta, { codice, inviti: chiavi.elenco() });
      } catch (errore) {
        male(risposta, errore instanceof TroppiInviti ? 409 : 500, String(errore?.message));
      }
      return;
    }

    const invito = /^\/inviti\/([A-Za-z0-9-]{8,40})$/.exec(via);
    if (invito && metodo === "DELETE") {
      json(risposta, { annullato: chiavi.annulla(invito[1]), inviti: chiavi.elenco() });
      return;
    }

    const casa = /^\/casa\/(casa_[0-9a-f]{32})$/.exec(via);
    if (casa && metodo === "PUT") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 4096);
      } catch (_errore) {
        detto = {};
      }
      if (!case_.rinomina(casa[1], detto?.nome)) {
        male(risposta, 404, "questa casa non la segue nessuno");
        return;
      }
      json(risposta, { case: case_.elenco() });
      return;
    }

    if (casa && metodo === "DELETE") {
      /* Non seguirla piu' vuol dire due cose insieme: si butta quello che se
       * ne sa, e si butta la sua chiave — se no la prima cartolina la farebbe
       * rinascere tre secondi dopo. */
      const cEra = case_.togli(casa[1]);
      chiavi.stacca(casa[1]);
      if (cEra) registro.info(`questa casa non si segue piu': ${casa[1]}`);
      json(risposta, { tolta: cEra, case: case_.elenco() });
      return;
    }

    male(risposta, 404, "qui non c'e' niente");
  }

  function laPagina(risposta) {
    try {
      if (pagina === undefined) pagina = readFileSync(PAGINA);
    } catch (_errore) {
      pagina = null;
    }
    if (!pagina) {
      male(risposta, 404, "la pagina della console non c'e'");
      return;
    }
    risposta.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    risposta.end(pagina);
  }
}
