/* La porta del quadro.
 *
 * Un quadro solo, su una macchina di gdahome, con dentro le case di installatori
 * diversi. Chi installa non accende niente: lo si aggiunge, gli si da' una
 * chiave, e apre una pagina.
 *
 *   GET    /                             la soglia: cos'e' questo indirizzo
 *   GET    /salute                       dice solo che e' vivo
 *
 *   POST   /rapporto                     una casa deposita i suoi numeri, e si
 *                                        porta via quello che le e' stato chiesto
 *   GET    /marchio/<chi>                il logo di un installatore, senza chiave
 *
 *   GET    /console/                     la pagina dell'installatore
 *   GET    /console/io                   chi sono, quanti ne ho, qual e' il limite
 *   PUT    /console/io/avvisi            dove mandarmi gli avvisi
 *   POST   /console/io/avvisi/prova      mandamene uno adesso, per vedere
 *   GET    /console/case                 **le sue** case
 *   GET    /console/inviti               i **suoi** codici in attesa
 *   POST   /console/inviti               fanne uno, se il limite lo consente
 *   DELETE /console/inviti/<codice>      annulla il suo
 *   PUT    /console/casa/<casa_…>        il nome, se la casa e' sua
 *   DELETE /console/casa/<casa_…>        non seguirla piu', se e' sua
 *
 *   GET    /gestore/                     la pagina di chi tiene il quadro
 *   GET    /gestore/installatori         chi c'e', e quanti impianti ha ognuno
 *   POST   /gestore/installatori         aggiungine uno
 *   PUT    /gestore/installatore/<id>    nome e limite
 *   POST   /gestore/installatore/<id>/chiave   una chiave nuova
 *   DELETE /gestore/installatore/<id>    toglilo
 *
 * ─── Tre chiavi, e ognuna apre una porta sola ────────────────────────────
 *
 * Dal **davanti** entrano le case, ognuna con la chiave che le e' stata data:
 * quella apre una porta sola — depositare un rapporto per la propria
 * matricola — e non fa vedere niente.
 *
 * Dal **retro** entrano gli installatori, ognuno con la sua: quella fa vedere
 * **le sue** case e nient'altro. E' la riga che tiene separati installatori che fra
 * loro si fanno concorrenza: i clienti di Rossi non sono affari di Bianchi.
 *
 * Dalla **gestione** entra chi tiene il quadro: aggiunge gli installatori, mette i limiti,
 * e vede **quante** case ha ognuno — non quali. Il conto e' suo, l'elenco no.
 *
 * ─── Cosa non c'e' ───────────────────────────────────────────────────────
 *
 * Non c'e' nessuna via che entri in una casa, e non e' una dimenticanza:
 * questo pezzo riceve numeri e li mostra. Per entrare in una casa serve un
 * abbinamento, e quello lo da' chi ci abita.
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import { TUTTE } from "./case.js";
import { CASA_VALIDA, TroppiInviti } from "./chiavi.js";
import { DISCO_FINITO, DISCO_PIENO, TROPPO_CALDO } from "./collaudo.js";
import { Fattorino, indirizzoBuono } from "./fattorino.js";
import { comeVaLAggiornamento } from "./mi-aggiorno.js";
import { CHI_VALIDO } from "./installatori.js";
import { stessoSegreto } from "./segreti.js";
import { ilTipoDi, Marchi, QUANTO_GROSSO } from "./marchi.js";

/** Quanto puo' essere grossa un rapporto. Le vere stanno sotto i quattro. */
const RAPPORTO_MASSIMA = 64 * 1024;

const PAGINA = new URL("../console/index.html", import.meta.url);
const PAGINA_DEL_GESTORE = new URL("../gestore/index.html", import.meta.url);
let pagina;
let paginaDelGestore;

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
    if (quanto > massimo) throw new TroppoGrosso("questo rapporto e' troppo grosso");
    pezzi.push(pezzo);
  }
  try {
    return JSON.parse(Buffer.concat(pezzi).toString("utf8"));
  } catch (_errore) {
    throw new TroppoGrosso("questo non e' JSON");
  }
}

/* I byte com'e' arrivati, senza provare a leggerli come JSON: e' quello che
 * serve a un'immagine. Il tetto e' l'argomento, perche' un logo e un rapporto
 * non sono grossi uguale. */
async function iByte(richiesta, massimo) {
  let quanto = 0;
  const pezzi = [];
  for await (const pezzo of richiesta) {
    quanto += pezzo.length;
    if (quanto > massimo) throw new TroppoGrosso("questa immagine e' troppo grossa");
    pezzi.push(pezzo);
  }
  return Buffer.concat(pezzi);
}

class TroppoGrosso extends Error {}

export function costruisciIlServer({
  case: case_,
  chiavi,
  installatori,
  chiaveDelGestore = "",
  cartella = "./dati",
  fattorino = new Fattorino(),
  registro = { debug() {}, info() {}, attenzione() {}, errore() {} },
}) {
  /* La gestione si apre solo dove c'e' una chiave vera. Senza, questo quadro
   * riceve rapporti e non ha modo di aggiungere nessun installatore: e' una meta'
   * inutile, e va detto all'accensione invece di farlo scoprire dalla pagina. */
  const gestoreAperto = String(chiaveDelGestore).length >= 16;

  /* I loghi degli installatori. Un file per uno, fuori dall'archivio: il
   * perche' sta in cima a `marchi.js`. */
  const marchi = new Marchi({ cartella });

  return createServer((richiesta, risposta) => {
    servi(richiesta, risposta).catch((errore) => {
      registro.errore(`il quadro e' inciampato: ${errore?.message || errore}`);
      if (!risposta.headersSent) male(risposta, 500, "qualcosa e' andato storto");
    });
  });

  async function servi(richiesta, risposta) {
    /* La barra finale **non** si toglie, e non e' una svista: la pagina chiede
     * le sue vie in relativo — `case`, non `/console/case` — cosi' funziona
     * anche dietro un proxy che la monta sotto un prefisso. Da `/console/` un
     * indirizzo relativo porta a `/console/case`; da `/console` porterebbe a
     * `/case`. Percio' chi bussa senza barra ci viene mandato. */
    const via = (richiesta.url || "/").split("?")[0];
    const metodo = richiesta.method || "GET";

    if ((via === "/salute" || via === "/salute/") && metodo === "GET") {
      /* Se il quadro non riesce piu' ad aggiornarsi, lo dice **qui**.
       *
       * Qui e non nel registro, perche' questa riga qualcuno la guarda: e'
       * quella che si apre dopo averlo acceso, e quella che si riapre quando
       * si sospetta qualcosa. Il registro di una macchina che funziona non lo
       * apre nessuno, ed e' esattamente il posto dove un guasto silenzioso
       * resterebbe in silenzio.
       *
       * E non compare quasi mai: ci vogliono sei giri di fila andati a vuoto.
       * Un campo che c'e' sempre si smette di leggere. */
      const fermo = comeVaLAggiornamento({ cartella });
      json(risposta, {
        vivo: true,
        case: case_.lista.length,
        installatori: installatori.lista.length,
        gestore: gestoreAperto,
        ...(fermo ? { nonMiAggiorno: fermo } : {}),
      });
      return;
    }

    if (via === "/" && metodo === "GET") {
      risposta.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      risposta.end(
        "Il quadro di gdahome.\n\n" +
          "Qui le case installate depositano poche righe di numeri, e chi le ha\n" +
          "installate le guarda. Non si entra in nessuna casa da qui.\n\n" +
          "Se hai un codice, va incollato nella scheda dell'add-on gdahome di\n" +
          "casa tua, non qui. La console degli installatori sta su /console/.\n",
      );
      return;
    }

    /* ─── Il davanti: le case ──────────────────────────────────────────── */

    if (via === "/rapporto" && metodo === "POST") {
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
        carta = await ilCorpo(richiesta, RAPPORTO_MASSIMA);
      } catch (errore) {
        male(risposta, 413, String(errore?.message || errore));
        return;
      }
      if (!carta || typeof carta !== "object" || Array.isArray(carta)) {
        male(risposta, 400, "un rapporto e' un oggetto");
        return;
      }
      /* La matricola che conta e' quella in testa, non quella nel corpo: la
       * prima e' stata verificata contro una chiave, la seconda l'ha scritta
       * chi manda. Si riscrive, e non si discute. Lo stesso vale per di chi e'
       * questa casa: lo dice l'invito con cui e' entrata. */
      const prima = case_.quella(casa);
      const di = chiavi.diChiE(casa);
      case_.deposita(casa, { ...carta, casa }, di);
      if (!prima) registro.info(`una casa nuova si e' presentata: ${casa}`);
      /* Nella risposta torna **il nome dell'installatore**, che la casa non ha modo
       * di sapere altrimenti: nel codice che le e' stato incollato c'e' solo un
       * codice. Serve alla console dell'add-on, dove chi ci abita legge chi
       * riceve i suoi numeri — e «Impianti Rossi» gli dice qualcosa, un
       * indirizzo no.
       *
       * Quel nome lo scrive **chi tiene il quadro**, non l'installatore: non
       * c'e' nessuna via da cui uno possa cambiarsi il nome, e quindi non
       * c'e' modo di presentarsi in casa di qualcuno come qualcun altro. */
      /* E nella stessa risposta, se c'e', **quello che le e' stato chiesto**.
       *
       * E' l'unica strada per cui un comando entra in una casa, e passa di
       * qui: verso una casa non c'e' nessuna porta aperta, nessun buco nel
       * router, niente da difendere. E' lei che bussa, ogni minuto, e qualche
       * volta chi apre le dice qualcosa.
       *
       * Si chiede **dopo** aver depositato, e non prima: `deposita` butta il
       * lavoro che quella casa ha gia' preso in carico, e chiederlo prima
       * vorrebbe dire riconsegnarle quello che sta gia' facendo. */
      const fai = case_.ilLavoroDa(casa);
      if (fai) registro.info(`a ${casa} si e' consegnato: ${fai.cosa} ${fai.nome} ${fai.a}`);
      /* E se chi segue questa casa ha un logo suo, la matricola con cui
       * andarselo a prendere.
       *
       * La **matricola**, non l'indirizzo: l'indirizzo se lo compone la casa
       * col quadro che ha gia' in configurazione. E' la stessa regola del
       * marchio di un aggiornamento — se di qui passasse un indirizzo, sarebbe
       * questo quadro a decidere dove va a bussare il browser di chi ci abita. */
      const suo = installatori.quello(di);
      json(risposta, {
        presa: true,
        di: suo?.nome || "",
        ...(suo?.marchio ? { marchio: suo.chi } : {}),
        ...(fai ? { fai } : {}),
      });
      return;
    }

    /* Il logo di un installatore, **senza chiave**.
     *
     * Non e' una svista. Questo logo deve arrivare nel browser di chi abita una
     * casa abbinata — che una chiave non ce l'ha, e non gliela si puo' dare — e
     * nella pagina del cruscotto, che la chiave ce l'ha ma la tiene per se'. Un
     * `inst_` sono sedici cifre esadecimali: non si indovina, e quello che si
     * scopre indovinandolo e' un logo stampato su un furgone. */
    const ilMarchio = /^\/marchio\/(inst_[0-9a-f]{16})$/.exec(via);
    if (ilMarchio && metodo === "GET") {
      const suo = installatori.quello(ilMarchio[1]);
      const byte = suo ? marchi.leggi(suo.chi, suo.marchio) : null;
      if (!byte) {
        male(risposta, 404, "questo installatore non ha un marchio");
        return;
      }
      risposta.writeHead(200, {
        "content-type": ilTipoDi(suo.marchio),
        "content-length": byte.length,
        /* Un'ora: un logo cambia una volta ogni mai, e ogni casa abbinata lo
         * chiede a ogni ricarica della pagina. */
        "cache-control": "public, max-age=3600",
        /* Un SVG porta dentro un programma. Dentro un `<img>` non gira, ma
         * questo indirizzo lo si puo' anche aprire a mano — ed e' li' che
         * conterebbe. Queste due righe fanno si' che non conti. */
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "x-content-type-options": "nosniff",
      });
      risposta.end(byte);
      return;
    }

    /* ─── Il retro: gli installatori ───────────────────────────────────── */

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
      const chi = installatori.riconosci(ilSegno(richiesta));
      if (!chi) {
        male(risposta, 401, "la chiave non va bene");
        return;
      }
      await ilRetro(
        richiesta,
        risposta,
        via.slice("/console".length).replace(/\/+$/, ""),
        metodo,
        chi,
      );
      return;
    }

    /* ─── La gestione: chi tiene il quadro ───────────────────────────── */

    if (via === "/gestore" && metodo === "GET") {
      risposta.writeHead(301, { location: "/gestore/" });
      risposta.end();
      return;
    }

    /* La pagina si serve **senza chiave**, come quella degli installatori: la
     * chiave la chiede lei, e senza non mostra niente. Servirla dietro
     * autenticazione vorrebbe dire non avere nessun posto dove digitarla. */
    if (via === "/gestore/" && metodo === "GET") {
      laPagina(risposta, PAGINA_DEL_GESTORE, "gestore");
      return;
    }

    if (via.startsWith("/gestore/")) {
      if (!gestoreAperto || !stessoSegreto(ilSegno(richiesta), String(chiaveDelGestore))) {
        male(
          risposta,
          401,
          gestoreAperto ? "la chiave non va bene" : "questo quadro non ha gestore",
        );
        return;
      }
      await laGestione(
        richiesta,
        risposta,
        via.slice("/gestore".length).replace(/\/+$/, ""),
        metodo,
      );
      return;
    }

    male(risposta, 404, "qui non c'e' niente");
  }

  async function ilRetro(richiesta, risposta, via, metodo, chi) {
    const io = installatori.quello(chi);

    if (via === "/io" && metodo === "GET") {
      json(risposta, {
        /* La matricola serve alla pagina per andarsi a prendere il proprio
         * logo: `/marchio/<chi>` non vuole chiave, e la chiave non si mette in
         * un `src` che finisce nella cronologia del browser. */
        chi,
        nome: io?.nome || "",
        marchio: io?.marchio || "",
        soglia: io?.soglia || 0,
        case: case_.quante(chi),
        avvisi: io?.avvisi || "",
      });
      return;
    }

    if (via === "/io/avvisi" && metodo === "PUT") {
      const detto = await ilDetto(richiesta);
      const dove = String(detto?.dove ?? "").trim();
      /* Vuoto li spegne, ed e' un caso normale. Un indirizzo che non e' `https`
       * si rifiuta subito dicendo perche': nel messaggio c'e' il nome che lui
       * ha dato a una casa, e in chiaro lo leggerebbe chiunque stia in mezzo. */
      if (dove && !indirizzoBuono(dove)) {
        male(risposta, 400, "l'indirizzo degli avvisi deve cominciare per https://");
        return;
      }
      installatori.doveAvvisare(chi, dove);
      json(risposta, { avvisi: dove });
      return;
    }

    if (via === "/io/marchio" && metodo === "PUT") {
      let byte;
      try {
        byte = await iByte(richiesta, QUANTO_GROSSO);
      } catch (errore) {
        male(risposta, 413, String(errore?.message || errore));
        return;
      }
      const razza = marchi.metti(chi, byte, io?.marchio || "");
      if (!razza) {
        /* Un no che dice **perche'**: «non ha funzionato» davanti a un logo
         * che si vede benissimo nel finder e' la risposta peggiore che ci sia. */
        male(
          risposta,
          400,
          byte.length > QUANTO_GROSSO
            ? "questa immagine e' troppo grossa"
            : "si accettano PNG, JPEG, WEBP e SVG, e questa non e' nessuno dei quattro",
        );
        return;
      }
      installatori.ilMarchio(chi, razza);
      registro.info(`${chi} ha messo il suo marchio (${razza}, ${byte.length} byte)`);
      json(risposta, { marchio: razza });
      return;
    }

    if (via === "/io/marchio" && metodo === "DELETE") {
      marchi.togli(chi, io?.marchio || "");
      installatori.ilMarchio(chi, "");
      json(risposta, { marchio: "" });
      return;
    }

    if (via === "/io/avvisi/prova" && metodo === "POST") {
      /* Un messaggio finto, adesso. Un avviso che si scopre rotto la notte che
       * serviva non e' un avviso: qui si vede subito se quell'indirizzo
       * accetta quello che gli si manda. */
      if (!io?.avvisi) {
        male(risposta, 400, "prima serve un indirizzo dove mandarli");
        return;
      }
      const arrivato = await fattorino.porta(io.avvisi, {
        tipo: "prova",
        case: [],
        testo:
          "Questa e' una prova del quadro di gdahome. " +
          "Se la stai leggendo, gli avvisi arrivano dove devono.",
      });
      json(risposta, { arrivato });
      return;
    }

    if (via === "/case" && metodo === "GET") {
      json(risposta, {
        case: case_.elenco(chi),
        /* Le soglie con cui la pagina colora i metri sono **le stesse** con cui
         * qui si decide se una casa e' da guardare: viaggiano insieme alle case
         * invece di stare scritte anche nella pagina, perche' due numeri uguali
         * in due posti sono due numeri che prima o poi diventano diversi. */
        soglie: { troppoCaldo: TROPPO_CALDO, discoPieno: DISCO_PIENO, discoFinito: DISCO_FINITO },
      });
      return;
    }

    if (via === "/inviti" && metodo === "GET") {
      json(risposta, { inviti: chiavi.elenco(chi) });
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
        const codice = chiavi.fai({
          di: chi,
          per: detto?.per,
          limite: io?.soglia || 0,
          quante: case_.quante(chi),
        });
        registro.info("un codice nuovo, buono per una casa e per un giorno");
        json(risposta, { codice, inviti: chiavi.elenco(chi) });
      } catch (errore) {
        male(risposta, errore instanceof TroppiInviti ? 409 : 500, String(errore?.message));
      }
      return;
    }

    const invito = /^\/inviti\/([A-Za-z0-9-]{8,40})$/.exec(via);
    if (invito && metodo === "DELETE") {
      json(risposta, { annullato: chiavi.annulla(invito[1], chi), inviti: chiavi.elenco(chi) });
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
      if (!case_.rinomina(casa[1], detto?.nome, chi)) {
        /* «Non e' tua» e «non esiste» si dicono uguale: da un no non si deve
         * imparare che una certa matricola esiste da qualche altra parte. */
        male(risposta, 404, "questa casa non la segui tu");
        return;
      }
      json(risposta, { case: case_.elenco(chi) });
      return;
    }

    const lavoro = /^\/casa\/(casa_[0-9a-f]{32})\/installa$/.exec(via);
    if (lavoro && metodo === "POST") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 4096);
      } catch (_errore) {
        detto = {};
      }
      const messo = case_.chiediUnLavoro(lavoro[1], detto, chi);
      if (!messo) {
        /* Tre no in uno, e si dicono uguale: la casa non e' tua, non ha aperto
         * la manutenzione, o ne sta gia' facendo uno. Il primo dei tre e' il
         * motivo per cui si dicono uguale — da un no non si deve imparare che
         * una certa matricola esiste da qualche altra parte — e gli altri due
         * la pagina li sa gia', perche' li legge nel rapporto. */
        male(risposta, 409, "questo lavoro non si puo' chiedere adesso");
        return;
      }
      registro.info(`chiesto a ${lavoro[1]}: installa ${messo.nome} ${messo.da} → ${messo.a}`);
      json(risposta, { chiesto: messo, case: case_.elenco(chi) });
      return;
    }

    if (lavoro && metodo === "DELETE") {
      json(risposta, {
        annullato: case_.annullaIlLavoro(lavoro[1], chi),
        case: case_.elenco(chi),
      });
      return;
    }

    if (casa && metodo === "DELETE") {
      /* Non seguirla piu' vuol dire due cose insieme: si butta quello che se
       * ne sa, e si butta la sua chiave — se no il primo rapporto la farebbe
       * rinascere tre secondi dopo. */
      const mia = chiavi.diChiE(casa[1]) === chi;
      const cEra = case_.togli(casa[1], chi);
      if (mia) chiavi.stacca(casa[1]);
      if (cEra) registro.info(`questa casa non si segue piu': ${casa[1]}`);
      json(risposta, { tolta: cEra, case: case_.elenco(chi) });
      return;
    }

    male(risposta, 404, "qui non c'e' niente");
  }

  async function laGestione(richiesta, risposta, via, metodo) {
    /* Il quadro visto da chi lo tiene, sempre nella stessa forma.
     *
     * Lo tornano **tutte** le vie che cambiano qualcosa, non solo quella che
     * legge: una risposta che porta l'elenco ma non i totali fa scrivere zero
     * alla pagina, e chi ha appena aggiunto un installatore vede «0 impianti in tutto»
     * con le righe che dicono altro. Una forma sola non lo lascia succedere. */
    const ilQuadro = () => ({
      installatori: installatori.elenco((chi) => case_.quante(chi)),
      case: case_.lista.length,
      /* Quelle di un installatore tolto: restano, e continuano a depositare. Senza
       * questo numero il totale non tornerebbe con la somma degli installatori, e non
       * si capirebbe perche'. */
      orfane: case_.orfane(installatori.lista.map((uno) => uno.chi)),
    });

    if (via === "/installatori" && metodo === "GET") {
      json(risposta, ilQuadro());
      return;
    }

    if (via === "/installatori" && metodo === "POST") {
      const detto = await ilDetto(richiesta);
      const fatto = installatori.fai({ nome: detto?.nome, soglia: detto?.soglia });
      registro.info(`un installatore nuovo: ${fatto.chi}`);
      /* La chiave in chiaro esce **una volta sola**, adesso. Poi qui resta solo
       * la sua impronta: se si perde si rifa', non si recupera. */
      json(risposta, { ...fatto, ...ilQuadro() });
      return;
    }

    const uno = new RegExp(`^/installatore/(${CHI_VALIDO.source.slice(1, -1)})$`).exec(via);
    if (uno && metodo === "PUT") {
      const detto = await ilDetto(richiesta);
      if (!installatori.quello(uno[1])) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      if (detto?.nome !== undefined) installatori.rinomina(uno[1], detto.nome);
      if (detto?.soglia !== undefined) installatori.limite(uno[1], detto.soglia);
      json(risposta, ilQuadro());
      return;
    }

    if (uno && metodo === "DELETE") {
      /* Togliere un installatore non butta le sue case: restano nel quadro, senza piu'
       * nessuno che le guardi, e i loro rapporti continuano ad arrivare. E'
       * voluto — sono impianti che funzionano in casa di qualcuno — e chi
       * gestisce se le ritrova da assegnare se lo si riaggiunge. */
      json(risposta, { chiuso: installatori.togli(uno[1]), ...ilQuadro() });
      return;
    }

    const chiave = new RegExp(`^/installatore/(${CHI_VALIDO.source.slice(1, -1)})/chiave$`).exec(
      via,
    );
    if (chiave && metodo === "POST") {
      const nuova = installatori.rifai(chiave[1]);
      if (!nuova) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      registro.info(`chiave rifatta per ${chiave[1]}: quella di prima non apre piu'`);
      json(risposta, { chiave: nuova });
      return;
    }

    male(risposta, 404, "qui non c'e' niente");
  }

  async function ilDetto(richiesta) {
    try {
      return await ilCorpo(richiesta, 4096);
    } catch (_errore) {
      return {};
    }
  }

  function laPagina(risposta, quale = PAGINA, chiamata = "console") {
    /* Lette dal disco al primo che le chiede, e poi tenute in memoria. */
    let foglio = quale === PAGINA ? pagina : paginaDelGestore;
    if (foglio === undefined) {
      try {
        foglio = readFileSync(quale);
      } catch (_errore) {
        foglio = null;
      }
      if (quale === PAGINA) pagina = foglio;
      else paginaDelGestore = foglio;
    }
    if (!foglio) {
      male(risposta, 404, `la pagina della ${chiamata} non c'e'`);
      return;
    }
    const pagina_ = foglio;
    risposta.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    risposta.end(pagina_);
  }
}

/* Usato dalla gestione per contare tutto quello che c'e', di chiunque sia. */
export { TUTTE };
