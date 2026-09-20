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
 *   GET    /attesa                       la casa resta in linea, e sente subito
 *   GET    /segno/<segno>                l'icona di un aggiornamento, senza chiave
 *   GET    /marchio/<chi>                il logo di un installatore, senza chiave
 *   GET    /carattere/<nome>.woff2       il carattere delle pagine, senza chiave
 *
 *   GET    /console/                     la pagina dell'installatore
 *   GET    /console/io                   chi sono, quanti ne ho, qual e' il limite
 *   PUT    /console/io/avvisi            dove mandarmi gli avvisi
 *   POST   /console/io/avvisi/prova      mandamene uno adesso, per vedere
 *   GET    /console/case                 **le sue** case
 *   GET    /console/note/<segno>         le note intere di un aggiornamento
 *   GET    /console/inviti               i **suoi** codici in attesa
 *   POST   /console/inviti               fanne uno, se il limite lo consente
 *   DELETE /console/inviti/<codice>      annulla il suo
 *   PUT    /console/casa/<casa_…>        il nome, se la casa e' sua
 *   DELETE /console/casa/<casa_…>        non seguirla piu', se e' sua
 *   POST   /console/casa/<casa_…>/installa   chiedile di installare una cosa
 *   POST   /console/casa/<casa_…>/riavvia    chiedile di riavviare Home Assistant
 *   DELETE /console/casa/<casa_…>/installa   ci ripensa, se non e' ancora passata
 *
 *   GET    /gestore/                     la pagina di chi tiene il quadro
 *   GET    /gestore/installatori         chi c'e', quanti impianti ha ognuno e
 *                                        quante entita' in tutto
 *   GET    /gestore/installatore/<id>/case   le sue case, come le vede lui
 *   GET    /gestore/note/<segno>         le note intere di un aggiornamento
 *   POST   /gestore/installatori         aggiungine uno
 *   PUT    /gestore/installatore/<id>    nome e limite
 *   POST   /gestore/installatore/<id>/congela   congelagli l'utenza
 *   DELETE /gestore/installatore/<id>/congela   e ridagliela
 *   POST   /gestore/installatore/<id>/chiave   una chiave nuova
 *   DELETE /gestore/installatore/<id>    eliminalo, con tutto quello che e' suo
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
 * e vede le case di ognuno **come le vede lui** — il nome che le ha dato, i
 * controlli, quante entita' hanno — con la chiave della gestione, e non un
 * grammo di piu' di quello che arriva all'installatore. Per un pezzo questa
 * porta contava e basta, «quante, non quali»: adesso chi tiene il quadro
 * tiene anche i suoi installatori, e per aiutarne uno deve vedere quello
 * che vede lui. Non tocca niente: da qui non si installa, non si rinomina,
 * non si toglie. Quello resta a chi la casa l'ha messa.
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
import { DISCO_FINITO, DISCO_PIENO, TROPPO_CALDO } from "./controlli.js";
import { Fattorino, indirizzoBuono } from "./fattorino.js";
import { comeVaLAggiornamento, laVersioneCheGira } from "./mi-aggiorno.js";
import { CHI_VALIDO } from "./installatori.js";
import { stessoSegreto } from "./segreti.js";
import { ilTipoDi, Marchi, QUANTO_GROSSO } from "./marchi.js";
import { SEGNO_VALIDO, Segni } from "./segni.js";

/**
 * Quanto puo' essere grossa un rapporto. Le vere stanno sotto i quattro KiB —
 * ma un rapporto che porta le icone che gli sono state chieste pesa di piu', e
 * quel di piu' e' il motivo di questo numero.
 *
 * Deve stare **sopra** a quello che la casa e' disposta a mandare
 * (`IN_TUTTO_AL_MASSIMO` in `ponte/src/segni.js`, 96 KiB contati in base64) piu'
 * il rapporto vero e proprio. Se stesse sotto succederebbe questo: la casa
 * prepara le icone, il rapporto sfora, qui torna un 413 — e non salta l'icona,
 * salta **tutto il rapporto**. La casa si tiene l'elenco di quello che le e'
 * stato chiesto, al minuto dopo rimanda lo stesso pacco, e si ribecca il 413.
 * Quella casa smetterebbe di dire come sta, per sempre, per un'icona.
 *
 * Ed e' esattamente com'era: 64 KiB qui contro 192 KiB di byte veri di la',
 * che in base64 fanno 256. Bastava un'icona sola un po' grossa.
 *
 * I due numeri si tengono per mano, e una prova per parte li tiene fermi.
 */
const RAPPORTO_MASSIMA = 256 * 1024;

/* A chi scrive un installatore a cui e' stata congelata l'utenza.
 *
 * Sta scritto qui e non nella pagina perche' e' una cosa di questo quadro, non
 * del disegno: chi un domani mettesse su un quadro suo cambia una riga, e non
 * va a cercarla dentro un foglio di stile. */
export const DOVE_SCRIVERE = "assistenza@gdahome.org";

/* Quanto si tiene aperta una richiesta di `/attesa` prima di rispondere a mani
 * vuote.
 *
 * Cinquanta secondi. Il numero non e' scelto per il tempo reale — quello lo da'
 * gia' la prima risposta — ma **contro chi sta in mezzo**: proxy, bilanciatori
 * e router tagliano le richieste ferme, e sessanta secondi e' la soglia che si
 * incontra piu' spesso. Chiudendo prima noi, il filo si riapre in modo
 * ordinato invece di cadere, e nel registro della casa non compare un errore
 * al minuto.
 *
 * E' anche il tempo massimo in cui una casa spenta resta scritta qui dentro
 * senza che nessuno se ne accorga. */
const QUANTO_SI_ASPETTA = 50 * 1000;

const PAGINA = new URL("../console/index.html", import.meta.url);
const PAGINA_DEL_GESTORE = new URL("../gestore/index.html", import.meta.url);
let pagina;
let paginaDelGestore;

export function json(risposta, corpo, stato = 200) {
  /* L'a capo in fondo non e' un vezzo: `/salute` si guarda **col curl da un
   * terminale** — lo dice il README, ed e' la prima cosa che si fa dopo aver
   * acceso la macchina. Senza, la risposta finisce incollata al prompt della
   * riga dopo, e su un telefono, dove la riga va a capo da sola, diventa
   * illeggibile o sembra che non abbia risposto niente.
   *
   * Per chi legge la risposta da programma non cambia nulla: uno spazio bianco
   * in fondo a un JSON lo ignorano tutti. */
  const testo = `${JSON.stringify(corpo)}\n`;
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
  /* Le icone vere degli aggiornamenti e le loro note intere, come le manda la
   * casa. Il perche' sta in cima a `segni.js`. */
  const segni = new Segni({ cartella });

  /* ─── Il filo tenuto aperto ───────────────────────────────────────────
   *
   * Chi sta fermo su `/attesa`, casa per casa. Dopo aver depositato, una casa
   * lascia li' una richiesta che non si chiude: quando qualcuno preme
   * «Installa» le si risponde **nell'istante**, invece di farle aspettare il
   * rapporto del minuto dopo.
   *
   * Perche' una richiesta tenuta aperta e non un WebSocket: da una casa al
   * quadro c'e' di mezzo il router di casa, e qualche volta il proxy di
   * un'azienda. Una GET che tarda e' la cosa che passa dappertutto, e qui non
   * serve altro — il filo porta una frase sola, ogni tanto, in una direzione.
   *
   * Una per casa: se ne arriva una seconda, la prima si chiude subito a mani
   * vuote. Una casa che si riavvia lascia indietro la sua, e due fili aperti
   * per la stessa casa vorrebbero dire un comando consegnato a quello morto.
   *
   * La memoria e' del processo e va bene cosi': se il quadro si riavvia i fili
   * cadono, le case se ne accorgono e li riaprono, e nel frattempo c'e' il
   * rapporto al minuto che non ha mai smesso. */
  const aspettano = new Map();

  function sveglia(casa, cosa) {
    const chi = aspettano.get(casa);
    if (!chi) return false;
    aspettano.delete(casa);
    clearTimeout(chi.orologio);
    try {
      chi.rispondi(cosa);
    } catch (_errore) {
      /* Il filo se n'e' andato mentre gli si rispondeva: non e' un guaio di
       * nessuno, e il lavoro resta in coda per il rapporto dopo. */
    }
    return true;
  }

  /* Quando un lavoro viene chiesto, chi e' in linea lo sente adesso. */
  case_.alLavoro = (casa) => {
    if (!aspettano.has(casa)) return;
    const fai = case_.ilLavoroDa(casa);
    if (fai) sveglia(casa, { fai });
  };

  const server = createServer((richiesta, risposta) => {
    servi(richiesta, risposta).catch((errore) => {
      registro.errore(`il quadro e' inciampato: ${errore?.message || errore}`);
      if (!risposta.headersSent) male(risposta, 500, "qualcosa e' andato storto");
    });
  });

  /* Spegnendo, i fili aperti si chiudono a mani vuote.
   *
   * Senza questo `server.close()` resterebbe li' ad aspettare che finiscano
   * cinquanta richieste che per definizione non finiscono, e il quadro non si
   * spegnerebbe piu' — in produzione, e nelle prove. Le case se ne accorgono e
   * riaprono al giro dopo. */
  server.lasciaAndareIFili = () => {
    for (const casa of [...aspettano.keys()]) sveglia(casa, {});
  };
  return server;

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
      /* E **quale versione gira**, che era la cosa che non si poteva sapere da
       * nessuna parte: questa riga risponde a «si e' aggiornato?» senza dover
       * entrare nella macchina a leggere un registro. */
      const versione = laVersioneCheGira();
      json(risposta, {
        vivo: true,
        ...(versione ? { versione } : {}),
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

    /* La casa resta in linea, e sente subito.
     *
     * Dopo aver depositato il suo rapporto, una casa chiede qui e **non si
     * chiude**: la richiesta resta aperta finche' non c'e' qualcosa da dirle o
     * finche' non scade. Cosi' fra il tasto «Installa» e l'installazione che
     * parte non passa piu' un minuto — passa il tempo di un giro di rete.
     *
     * Chi non puo' o non vuole tenerlo aperto — un ponte vecchio, un proxy che
     * taglia le richieste lunghe — non perde niente: il rapporto al minuto
     * porta il lavoro come ha sempre fatto. Questo e' in piu', non al posto. */
    if (via === "/attesa" && metodo === "GET") {
      const casa = String(richiesta.headers["x-casa"] || "");
      if (!CASA_VALIDA.test(casa)) {
        male(risposta, 400, "questa non e' una matricola");
        return;
      }
      if (!chiavi.riconosci(casa, ilSegno(richiesta))) {
        male(risposta, 403, "questa chiave non apre niente");
        return;
      }
      /* Quello che c'e' gia' non fa aspettare nessuno. */
      const subito = case_.ilLavoroDa(casa);
      if (subito) {
        json(risposta, { fai: subito });
        return;
      }
      /* Una per casa: la precedente si chiude a mani vuote, e quella casa ne
       * apre una sola perche' aspetta la risposta prima di rifarlo. */
      sveglia(casa, {});
      const rispondi = (cosa) => json(risposta, cosa);
      const orologio = setTimeout(() => sveglia(casa, {}), QUANTO_SI_ASPETTA);
      orologio.unref?.();
      aspettano.set(casa, { rispondi, orologio });
      /* E se il filo cade dall'altra parte — casa spenta, rete che se ne va —
       * si toglie di mezzo: se no la prima cosa che arriva finirebbe scritta
       * dentro un socket che non c'e' piu', e quel lavoro sarebbe perso invece
       * che consegnato al rapporto dopo. */
      richiesta.on("close", () => {
        const chi = aspettano.get(casa);
        if (chi && chi.rispondi === rispondi) {
          aspettano.delete(casa);
          clearTimeout(orologio);
        }
      });
      return;
    }

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
      /* Le icone e le note che sono arrivate dentro questo rapporto, e quelle
       * che ancora mancano.
       *
       * E' questo scambio che fa viaggiare un'icona **una volta sola**: la casa
       * manda solo quello che il quadro le dice di non avere, e il quadro lo
       * sa guardando i suoi file. Un quadro che li perde li richiede da se'; una
       * casa che si riavvia non rimanda niente che sia gia' arrivato. */
      const elenco = carta?.aggiornamenti?.elenco;
      segni.metti(elenco);
      const manca = segni.quelliCheMancano(elenco);
      json(risposta, {
        presa: true,
        di: suo?.nome || "",
        ...(suo?.marchio ? { marchio: suo.chi } : {}),
        ...(fai ? { fai } : {}),
        ...(manca.length ? { manca } : {}),
      });
      return;
    }

    /* L'icona di un aggiornamento, **senza chiave**.
     *
     * Stessa regola del marchio di un installatore: sedici cifre esadecimali
     * non si indovinano, e quello che si scopre indovinandole e' l'icona di
     * Mosquitto. Chi la guarda e' il browser di chi installa, e la prende da
     * qui invece che da `brands.home-assistant.io` — cosi' quel browser non va
     * a farsi vedere da una macchina che non e' la sua, e quello che trova e'
     * l'icona giusta invece del logo di HACS. */
    /* `quale` e non `ilSegno`: quel nome e' gia' preso, ed e' la funzione che
     * legge la chiave dall'intestazione. Chiamandolo cosi' la si oscurava, e
     * da li' in poi **ogni** via che chiede una chiave rispondeva 500. */
    const quale = new RegExp(`^/segno/(${SEGNO_VALIDO.source.slice(1, -1)})$`).exec(via);
    if (quale && metodo === "GET") {
      const suo = segni.leggi(quale[1]);
      if (!suo) {
        male(risposta, 404, "questo aggiornamento non ha un'icona");
        return;
      }
      risposta.writeHead(200, {
        "content-type": suo.tipo,
        "content-length": suo.byte.length,
        /* Un giorno: l'icona di una versione non cambia mai, e il segno cambia
         * con la versione. */
        "cache-control": "public, max-age=86400, immutable",
        /* Un SVG porta dentro un programma: dentro un `<img>` non gira, ma
         * questo indirizzo lo si puo' anche aprire a mano. */
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "x-content-type-options": "nosniff",
      });
      risposta.end(suo.byte);
      return;
    }

    /* Il carattere delle pagine, servito da qui e non da Google.
     *
     * Le due pagine sono scritte in Manrope. Prenderlo da Google Fonts vorrebbe
     * dire che il browser di ogni installatore — e di chi apre il cruscotto
     * dentro Home Assistant — va a farsi vedere da una macchina che non e' la
     * nostra, a ogni pagina: e' la stessa regola delle icone e dei marchi, che
     * il browser non va a prendere da fuori. I due file stanno in
     * `quadro/carattere/` con la loro licenza (OFL), e si servono senza
     * chiave: un carattere non e' un segreto, ed e' un file che la pagina
     * chiede prima di avere la chiave in mano. Un anno di cache: il nome del
     * file cambia se cambia il carattere. */
    const ilCarattere = /^\/carattere\/(manrope-latin(?:-ext)?)\.woff2$/.exec(via);
    if (ilCarattere && metodo === "GET") {
      let byte = null;
      try {
        byte = readFileSync(new URL(`../carattere/${ilCarattere[1]}.woff2`, import.meta.url));
      } catch (_nonCE) {
        byte = null;
      }
      if (!byte) {
        male(risposta, 404, "questo carattere non c'e'");
        return;
      }
      risposta.writeHead(200, {
        "content-type": "font/woff2",
        "content-length": byte.length,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      });
      risposta.end(byte);
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
      /* Congelato: la chiave apre, e non fa vedere niente.
       *
       * La chiave deve aprire, se no non si saprebbe chi sta bussando e non
       * gli si potrebbe dire **perche'** non vede piu' niente: si troverebbe
       * un «la chiave non va bene» e andrebbe a cercare un guasto che non
       * c'e'. Quindi si risponde a lui, per nome, con l'indirizzo a cui
       * scrivere.
       *
       * Il controllo sta **qui**, sulla soglia, e non dentro le singole vie:
       * una via aggiunta domani sarebbe una via che si dimentica di guardare
       * se questa utenza e' congelata, e nessuno se ne accorgerebbe fino al
       * giorno che conta. */
      if (installatori.congelato(chi)) {
        json(
          risposta,
          {
            errore: "questa utenza e' congelata",
            congelato: true,
            scrivi: DOVE_SCRIVERE,
          },
          403,
        );
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

  /* Le case di un installatore, nella forma in cui le legge la sua pagina.
   *
   * Una funzione sola per due porte: la sua (`/console/case`) e quella di chi
   * tiene il quadro (`/gestore/installatore/<chi>/case`). Cosi' quello che
   * vede la gestione e' **per costruzione** quello che vede lui — non una
   * seconda forma che gli somiglia oggi e domani no. */
  function leCaseDi(chi) {
    const sue = case_.elenco(chi);
    return {
      case: sue,
      /* Di quali aggiornamenti si hanno le note intere.
       *
       * Un elenco a parte e non un campo dentro ogni riga: la riga di un
       * aggiornamento e' quello che la casa ha mandato, e questo e' quello
       * che il quadro ha ricevuto — due cose diverse, e mescolarle vorrebbe
       * dire riscrivere il rapporto di una casa con roba nostra. Serve alla
       * pagina per far comparire il tasto solo dove c'e' qualcosa da aprire.
       *
       * Solo quelli di **queste** case: un elenco di tutti quelli che il
       * quadro ha sarebbe roba di case di altri, e viaggerebbe a ogni giro. */
      note: [
        ...new Set(
          sue.flatMap((una) =>
            (una.carta?.aggiornamenti?.elenco || [])
              .map((uno) => String(uno?.segno || ""))
              .filter((uno) => segni.note(uno)),
          ),
        ),
      ],
      /* Le soglie con cui la pagina colora i metri sono **le stesse** con cui
       * qui si decide se una casa e' da guardare: viaggiano insieme alle case
       * invece di stare scritte anche nella pagina, perche' due numeri uguali
       * in due posti sono due numeri che prima o poi diventano diversi. */
      soglie: { troppoCaldo: TROPPO_CALDO, discoPieno: DISCO_PIENO, discoFinito: DISCO_FINITO },
    };
  }

  /* Le note intere di un aggiornamento, quelle che la casa ha preso da Home
   * Assistant: si rispondono uguali dal retro e dalla gestione. */
  function rispondiLeNote(risposta, segno) {
    const dette = segni.note(segno);
    if (!dette) {
      male(risposta, 404, "di questo aggiornamento non sono arrivate le note");
      return;
    }
    json(risposta, { note: dette });
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
      json(risposta, leCaseDi(chi));
      return;
    }

    /* Le note intere di un aggiornamento, quelle che la casa ha preso da Home
     * Assistant.
     *
     * Con la chiave, e non senza come l'icona: un'icona e' un disegno, un
     * CHANGELOG e' testo che qualcuno ha scritto. E si aprono **dentro la
     * pagina**: prima c'era un collegamento che portava fuori, e leggere cosa
     * cambia prima di premere «Installa» vuol dire restare dove si e'. */
    const leNote = new RegExp(`^/note/(${SEGNO_VALIDO.source.slice(1, -1)})$`).exec(via);
    if (leNote && metodo === "GET") {
      rispondiLeNote(risposta, leNote[1]);
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

    /* I due lavori che si chiedono a una casa: installare una cosa, o
     * riavviare Home Assistant. Stessa strada — si mette in attesa, la casa se
     * lo porta via al rapporto dopo — e stessa porta per annullare. */
    const lavoro = /^\/casa\/(casa_[0-9a-f]{32})\/(installa|riavvia)$/.exec(via);
    if (lavoro && metodo === "POST") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 4096);
      } catch (_errore) {
        detto = {};
      }
      const messo = case_.chiediUnLavoro(lavoro[1], { ...detto, cosa: lavoro[2] }, chi);
      if (!messo) {
        /* Tre no in uno, e si dicono uguale: la casa non e' tua, non ha aperto
         * la manutenzione, o ne sta gia' facendo uno. Il primo dei tre e' il
         * motivo per cui si dicono uguale — da un no non si deve imparare che
         * una certa matricola esiste da qualche altra parte — e gli altri due
         * la pagina li sa gia', perche' li legge nel rapporto. */
        male(risposta, 409, "questo lavoro non si puo' chiedere adesso");
        return;
      }
      registro.info(
        messo.cosa === "riavvia"
          ? `chiesto a ${lavoro[1]}: riavvia Home Assistant`
          : `chiesto a ${lavoro[1]}: installa ${messo.nome} ${messo.da} → ${messo.a}`,
      );
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
      installatori: installatori.elenco(
        (chi) => case_.quante(chi),
        (chi) => case_.entita(chi),
      ),
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

    /* Le case di un installatore, come le vede lui.
     *
     * La stessa funzione della sua pagina, e quindi la stessa risposta: il
     * nome che ha dato a ogni casa, lo stato, i controlli, il rapporto con
     * quante entita' ha. Non c'e' un campo in piu' — se all'installatore una
     * cosa non arriva, non arriva nemmeno qui. Un installatore che non c'e'
     * e' un 404, non un elenco vuoto: un elenco vuoto sembrerebbe «nessuna
     * casa», che e' un'altra risposta. */
    const leSue = new RegExp(`^/installatore/(${CHI_VALIDO.source.slice(1, -1)})/case$`).exec(via);
    if (leSue && metodo === "GET") {
      if (!installatori.quello(leSue[1])) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      json(risposta, leCaseDi(leSue[1]));
      return;
    }

    /* Le note intere: le stesse che legge l'installatore, con la chiave
     * della gestione. */
    const leNote = new RegExp(`^/note/(${SEGNO_VALIDO.source.slice(1, -1)})$`).exec(via);
    if (leNote && metodo === "GET") {
      rispondiLeNote(risposta, leNote[1]);
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
      /* Eliminare un installatore porta via **tutto quello che e' suo**: lui, i
       * suoi codici in attesa, le chiavi delle sue case, le sue case e il suo
       * marchio.
       *
       * ─── Perche' adesso porta via anche le case ──────────────────────────
       *
       * Prima no: le case restavano, e siccome nessuno le guardava piu'
       * diventavano un numero — «3 impianti senza piu' nessuno» — che non si
       * poteva ne' aprire ne' riassegnare. Il ragionamento era buono (sono
       * impianti che funzionano in casa di qualcuno) ma la conseguenza no:
       * roba che occupa posto per sempre e non serve a nessuno.
       *
       * Adesso ci sono **due tasti, e due cose diverse**. Congela e' quello per
       * la lite con l'installatore: lui non vede piu' niente, le case restano
       * accese e non si perde una riga. Elimina e' quello per «questo non c'e'
       * piu'», e fa proprio quello.
       *
       * ─── Cosa succede a quelle case ──────────────────────────────────────
       *
       * Continuano a mandare il rapporto — non lo sanno, e da qui non si
       * decide cosa fa casa d'altri — e si sentono rispondere di no. Per
       * tornare dentro ci vuole un codice nuovo, di un installatore vivo,
       * incollato **da dentro casa**: e' l'unica strada, ed e' la stessa che
       * regge tutto il resto. Riaggiungere l'installatore di prima non basta,
       * perche' prende una matricola nuova.
       *
       * La pagina lo dice prima di farlo, con quante case si porta dietro. */
      const chi = uno[1];
      if (!installatori.quello(chi)) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      const suoi = chiavi.toglieTutto(chi);
      const quante = case_.toglieTutto(chi);
      marchi.togli(chi, installatori.quello(chi)?.marchio || "");
      const chiuso = installatori.togli(chi);
      registro.info(
        `installatore eliminato: ${chi} — ${quante} case, ${suoi.chiavi} chiavi, ` +
          `${suoi.inviti} codici in attesa`,
      );
      json(risposta, { chiuso, case: quante, ...ilQuadro() });
      return;
    }

    /* Congela e scongela.
     *
     * Due vie e non una con un `acceso: true/false` nel corpo: cosi' quello
     * che sta per succedere si legge nel registro del server e nella barra del
     * browser, e un corpo storto non puo' scongelare chi si voleva congelare. */
    const gelo = new RegExp(`^/installatore/(${CHI_VALIDO.source.slice(1, -1)})/congela$`).exec(
      via,
    );
    if (gelo && (metodo === "POST" || metodo === "DELETE")) {
      if (!installatori.quello(gelo[1])) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      const congela = metodo === "POST";
      const cambiato = congela ? installatori.congela(gelo[1]) : installatori.scongela(gelo[1]);
      if (cambiato) {
        registro.info(
          congela
            ? `utenza congelata: ${gelo[1]} — la sua pagina non gli fa piu' vedere niente`
            : `utenza scongelata: ${gelo[1]} — torna a vedere le sue case`,
        );
      }
      json(risposta, { congelato: congela, ...ilQuadro() });
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
