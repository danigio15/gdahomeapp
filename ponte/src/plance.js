/* Le plance di questa casa: piu' d'una, come nella dashboard.
 *
 * Nella dashboard una plancia e' una **istanza** dell'integrazione: chi ne
 * vuole due le aggiunge da «Dispositivi e servizi», e in Home Assistant
 * compaiono due voci — «DashboardModern» e, per dire, «Casa al mare» — ognuna
 * con la sua configurazione: le sue sezioni, le sue tessere, le sue stanze.
 * Serve a chi tiene due case sullo stesso Home Assistant, e a chi vuole una
 * plancia per se' e una per chi abita con lui.
 *
 * Qui l'integrazione non c'e', e quel mestiere lo fa il ponte. La
 * configurazione di una plancia il ponte la tiene gia' da mesi, e la tiene
 * **per profilo** (`configurazione.js`): `primary` e' quella di sempre, e
 * accanto ce ne possono stare altre. Quello che mancava non era il posto dove
 * mettere la seconda: era poter dire che esiste, come si chiama, e quale
 * aprire. E' quello che c'e' qui.
 *
 * **Una plancia e' tre cose.** Un `profilo`, che e' il nome del cassetto dove
 * sta la configurazione e non si vede da nessuna parte; un `titolo`, che e'
 * come la chiama chi ci abita; e un'`istanza`, che e' il nome con cui la
 * pagina tiene separate le proprie cose sul telefono — il tema, la tavolozza,
 * la barra. Tre nomi e non uno perche' fanno tre mestieri diversi: il primo
 * si scrive in un file, il secondo su uno schermo, il terzo nel deposito di
 * un browser. Confonderli vorrebbe dire che rinominare una plancia le
 * cancella il tema.
 *
 * **La prima c'e' sempre.** Chi ha l'add-on da prima di questa versione ha un
 * profilo `primary` col suo lavoro dentro: quella e' la sua plancia, si chiama
 * «DashboardModern», e nessuno deve accorgersi che da oggi si possono
 * aggiungere altre.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { PROFILO_PRINCIPALE } from "./configurazione.js";
import { NOME } from "./marchio.js";

/* Come si chiama una plancia: abbastanza per un nome, non per una frase. */
export const TITOLO_MASSIMO = 40;

/* Quanti utenti si possono elencare per una plancia.
 *
 * Non e' un limite di Home Assistant: e' che una lista di cinquanta spunte non
 * si legge, e una casa con cinquanta utenti non sta scegliendo chi vede una
 * plancia. */
export const UTENTI_AL_MASSIMO = 50;

/* Chi la vede: l'elenco degli utenti di Home Assistant abilitati.
 *
 * **Vuoto vuol dire tutti**, e non «nessuno». E' la scelta che tiene in piedi
 * le case di chi c'e' gia': nessuna plancia ha questo campo prima di oggi, e
 * dopo l'aggiornamento devono continuare a vedersi come ieri. Ed e' anche
 * quella giusta per una casa nuova: chi non ha mai aperto questa impostazione
 * non ha detto «solo io», ha detto niente.
 *
 * Questo elenco lo sa **solo** il posto dove la plancia si apre — l'add-on.
 * Non e' un permesso di Home Assistant e non ne fa le veci: Home Assistant
 * continua a decidere chi entra in casa, e questo decide quale plancia gli si
 * apre quando e' dentro. */
export function utentiPuliti(dentro) {
  const elenco = Array.isArray(dentro) ? dentro : [];
  const visti = new Set();
  const buoni = [];
  for (const uno of elenco) {
    const chi = String(uno || "").trim();
    /* Gli identificativi di Home Assistant sono trentadue cifre esadecimali.
     * Tenere solo quella forma vuol dire che nessuno ci scrive dentro una
     * frase, e che un elenco arrivato storto non diventa un elenco di
     * fantasmi che non corrispondono a nessuno. */
    if (!/^[a-f0-9]{32}$/i.test(chi) || visti.has(chi)) continue;
    visti.add(chi);
    buoni.push(chi);
    if (buoni.length >= UTENTI_AL_MASSIMO) break;
  }
  return buoni;
}

/* Se questa plancia si apre a questo utente.
 *
 * `chi` e' l'identificativo che l'ingress di Home Assistant scrive in testa a
 * ogni richiesta (`X-Remote-User-Id`). Quando la plancia non ha un elenco, si
 * apre a tutti e non importa chi bussa; quando ce l'ha e non si sa chi bussa,
 * **non** si apre: chi ha scritto un elenco ha chiesto una restrizione, e una
 * restrizione che si spegne da sola quando non si sa niente non e' una
 * restrizione.
 *
 * **Le due restrizioni si sommano, non si scelgono.** Una plancia puo' avere
 * un elenco di utenti e chiedere che siano amministratori: chi la apre deve
 * passare le due cose. Sono due domande diverse — «e' lui?» e «amministra?» —
 * e chi le mette entrambe intende entrambe.
 *
 * `amministra` e' il terzo stato che serve per forza: `true`, `false`, e
 * `null` per «non lo so ancora». Chi non lo sa e trova una plancia riservata a
 * chi amministra non fa passare — stessa regola di sopra. */
export function laVede(quale, chi, amministra = null) {
  const elenco = utentiPuliti(quale?.utenti);
  const chiBussa = String(chi || "").trim();
  if (elenco.length > 0 && !elenco.includes(chiBussa)) return false;
  if (quale?.solo_admin && amministra !== true) return false;
  return true;
}

/* Se a questo utente si apre almeno una plancia di questa casa.
 *
 * Serve al WebSocket della plancia, che e' uno per tutte e non sa quale pagina
 * l'ha aperto: chi non vede nessuna plancia non ha niente da chiedere. */
export function vedeQualcosa(elenco, chi, amministra = null) {
  const plance = Array.isArray(elenco) ? elenco : [];
  if (plance.length === 0) return true;
  return plance.some((una) => laVede(una, chi, amministra));
}

/* Quante se ne possono tenere.
 *
 * Non e' un limite tecnico — i profili starebbero in mille — e' il selettore:
 * una riga per plancia si legge finche' sono poche, e chi ne ha otto non sta
 * cercando una plancia, sta cercando un elenco. Nella dashboard il limite non
 * c'e' perche' ogni istanza e' una voce di Home Assistant, e li' l'elenco lo
 * fa lui. */
export const QUANTE_AL_MASSIMO = 8;

/* Come si chiama la prima plancia, quella che c'e' sempre. */
const TITOLO_DELLA_PRIMA = "gdahome";

/* Come si chiamava prima, e perche' si cambia in casa di chi ce l'ha gia'.
 *
 * Quel titolo non l'ha scelto nessuno: l'avevamo scritto noi, ed e' il nome di
 * un altro prodotto. Chi apre l'app dopo l'aggiornamento troverebbe «gdahome»
 * in cima e «DashboardModern» nel selettore delle plance, cioe' due nomi per
 * la stessa cosa. Quindi si cambia — ma **solo se e' ancora quello**: un
 * titolo che chi ci abita ha scritto lui non si tocca, nemmeno se somiglia a
 * questo. */
const TITOLO_DI_PRIMA = "DashboardModern";

const DIFETTO = Object.freeze({ plance: [] });

/* Il nome del cassetto, ricavato dal titolo.
 *
 * Deve passare `Configurazione.profiloBuono` — minuscole, cifre e trattini —
 * perche' e' la chiave con cui la configurazione sta sul disco. Un titolo
 * scritto in cinese o fatto di soli emoji non lascia niente: allora il nome
 * lo fa il contatore, che e' brutto e funziona. */
function nomeDelCassetto(titolo, giaPrese) {
  const radice =
    String(titolo || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "plancia";
  let quale = /^[a-z0-9]/.test(radice) ? radice : `p-${radice}`;
  let numero = 2;
  while (giaPrese.has(quale)) {
    quale = `${radice}-${numero}`;
    numero += 1;
  }
  return quale;
}

export function titoloPulito(titolo, difetto = "") {
  const testo = String(titolo ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITOLO_MASSIMO);
  return testo || difetto;
}

export class TroppePlance extends Error {
  constructor() {
    super(`di plance se ne tengono ${QUANTE_AL_MASSIMO}, non di piu'`);
    this.codice = "troppe_plance";
  }
}

export class QuellaPlanciaNo extends Error {
  constructor(spiegazione, codice = "plancia_sconosciuta") {
    super(spiegazione);
    this.codice = codice;
  }
}

export class Plance {
  constructor({
    cartella,
    percorso = null,
    adesso = () => Date.now(),
    registro,
    /* Chi va avvisato quando l'elenco cambia.
     *
     * Serve a una cosa sola: le voci fra le «Plance» di Home Assistant, che
     * devono comparire nel momento in cui si aggiunge una plancia e non al
     * prossimo riavvio dell'add-on. Sta qui e non nei due posti da cui si
     * aggiunge — la scheda dell'add-on e l'app — perche' sono due, e domani
     * potrebbero essere tre: un avviso solo, dove le plance cambiano
     * davvero. */
    quandoCambia = null,
  } = {}) {
    this.archivio = new Archivio(percorso || join(cartella, "plance.json"), DIFETTO);
    this.adesso = adesso;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.quandoCambia = quandoCambia;
    this._sistema();
  }

  /* L'avviso, dopo che l'elenco e' cambiato **e** salvato.
   *
   * Non si aspetta e non si solleva: chi aggiunge una plancia deve vedere la
   * sua risposta subito, e se Home Assistant e' in modalita' YAML — dove le
   * Plance non si aggiungono da fuori — la plancia esiste comunque, la si apre
   * dall'app e dall'ingress. */
  _cambiato() {
    if (typeof this.quandoCambia !== "function") return;
    try {
      Promise.resolve(this.quandoCambia(this.elenco())).catch((errore) =>
        this.registro.attenzione(`dopo le plance: ${errore?.message || errore}`),
      );
    } catch (errore) {
      this.registro.attenzione(`dopo le plance: ${errore?.message || errore}`);
    }
  }

  /* La prima plancia esiste sempre, e sta sempre per prima.
   *
   * Si scrive sul disco solo se qualcosa e' cambiato davvero: un file
   * riscritto a ogni accensione e' un file che cambia data senza motivo, e
   * chi guarda i backup non sa piu' cosa e' successo quando. */
  _sistema() {
    const dentro = Array.isArray(this.archivio.dati.plance) ? this.archivio.dati.plance : [];
    const buone = [];
    const prese = new Set();
    for (const una of dentro) {
      const profilo = String(una?.profilo || "");
      if (!profilo || prese.has(profilo)) continue;
      prese.add(profilo);
      buone.push({
        profilo,
        titolo: titoloPulito(una?.titolo, profilo),
        creata_il: Number(una?.creata_il) || 0,
        utenti: utentiPuliti(una?.utenti),
        solo_admin: una?.solo_admin === true,
      });
    }
    /* La prima plancia che si chiama ancora come il prodotto di prima prende
     * il nome nuovo. Una volta sola, e solo se nessuno l'ha rinominata. */
    for (const una of buone) {
      if (una.profilo === PROFILO_PRINCIPALE && una.titolo === TITOLO_DI_PRIMA) {
        una.titolo = TITOLO_DELLA_PRIMA;
      }
    }
    if (!prese.has(PROFILO_PRINCIPALE)) {
      buone.unshift({
        profilo: PROFILO_PRINCIPALE,
        titolo: TITOLO_DELLA_PRIMA,
        creata_il: 0,
        utenti: [],
        solo_admin: false,
      });
    }
    buone.sort((una, altra) =>
      una.profilo === PROFILO_PRINCIPALE ? -1 : altra.profilo === PROFILO_PRINCIPALE ? 1 : 0,
    );
    const cambiato = JSON.stringify(buone) !== JSON.stringify(dentro);
    this.archivio.dati.plance = buone;
    if (cambiato) this.archivio.salva();
  }

  /* ─── Quello che si chiede ─────────────────────────────────────────────── */

  /* L'elenco, nella forma che vede chi deve disegnare un selettore. */
  elenco() {
    return this.archivio.dati.plance.map((una) => ({
      profilo: una.profilo,
      titolo: una.titolo,
      /* L'istanza: il nome con cui la pagina tiene separate le proprie cose.
       * Per la prima e' «gdahome» e non «gdahome-primary», perche' e' quella
       * che c'e' sempre e il suo nome non ha bisogno di dire quale e'.
       *
       * Fino a ieri era «ponte», e cambiarlo costa una cosa: le plance di chi
       * ce l'aveva si ritrovano il tema di serie, perche' il deposito del
       * browser le loro cose le teneva sotto quel nome. Si e' cambiato adesso
       * per lo stesso motivo dello slug — ce l'ha una persona, su una macchina
       * di prova — e adesso e' l'unico momento in cui costa questo e non
       * di piu'. */
      istanza: una.profilo === PROFILO_PRINCIPALE ? NOME : `${NOME}-${una.profilo}`,
      primaria: una.profilo === PROFILO_PRINCIPALE,
      creata_il: una.creata_il,
      /* Chi la vede. Una copia, non l'array del disco: chi legge l'elenco non
       * deve poter cambiare quello che c'e' scritto scrivendoci dentro. */
      utenti: utentiPuliti(una.utenti),
      /* Se la vedono solo gli amministratori della casa. Questa la fa
       * rispettare anche Home Assistant da se' — la voce fra le «Plance»
       * nasce con `require_admin` — e la fa rispettare l'add-on, che e' la
       * parte che non si aggira aprendo l'indirizzo a mano. */
      solo_admin: una.solo_admin === true,
    }));
  }

  /* Una plancia, dal nome del suo cassetto. La prima anche senza chiedere. */
  quale(profilo = PROFILO_PRINCIPALE) {
    const cercato = String(profilo || PROFILO_PRINCIPALE);
    return this.elenco().find((una) => una.profilo === cercato) || null;
  }

  get prima() {
    return this.quale(PROFILO_PRINCIPALE);
  }

  get quante() {
    return this.archivio.dati.plance.length;
  }

  /* ─── Quello che si cambia ─────────────────────────────────────────────── */

  /* Una plancia nuova: un cassetto vuoto e un titolo.
   *
   * Nasce **vuota**, e non copiata da quella di prima: chi ne aggiunge una
   * seconda la vuole diversa, e una copia da svuotare e' piu' lavoro di una
   * pagina bianca da riempire. La plancia, davanti a una configurazione che
   * non c'e', mostra la sua «la dashboard e' quasi pronta»: e' la stessa cosa
   * che vede chi la installa il primo giorno. */
  aggiungi(titolo) {
    if (this.quante >= QUANTE_AL_MASSIMO) throw new TroppePlance();
    const prese = new Set(this.archivio.dati.plance.map((una) => una.profilo));
    const nome = titoloPulito(titolo, "Plancia");
    const profilo = nomeDelCassetto(nome, prese);
    const nuova = {
      profilo,
      titolo: nome,
      creata_il: this.adesso(),
      utenti: [],
      solo_admin: false,
    };
    this.archivio.dati.plance.push(nuova);
    this.archivio.salva();
    this.registro.info(`una plancia in piu': «${nome}»`);
    this._cambiato();
    return this.quale(profilo);
  }

  rinomina(profilo, titolo) {
    const una = this.archivio.dati.plance.find((quella) => quella.profilo === String(profilo));
    if (!una) throw new QuellaPlanciaNo("quella plancia non c'e'");
    const nome = titoloPulito(titolo);
    if (!nome) throw new QuellaPlanciaNo("una plancia senza nome non si trova", "senza_titolo");
    if (nome === una.titolo) return this.quale(una.profilo);
    una.titolo = nome;
    this.archivio.salva();
    this._cambiato();
    return this.quale(una.profilo);
  }

  /* Chi la vede: l'elenco degli utenti di Home Assistant abilitati.
   *
   * Un elenco vuoto la riapre a tutti, ed e' il modo di annullare la scelta:
   * non serve un secondo comando per dire «come prima».
   *
   * **La prima plancia si restringe come le altre.** Nella dashboard era
   * un'opzione dell'istanza, e valeva anche per la prima; qui non c'e' motivo
   * di fare un'eccezione — chi tiene una plancia per se' e una per chi abita
   * con lui vuole restringere proprio quella di sempre.
   *
   * Non ci si chiude fuori per sbaglio: questa scelta si cambia dalla pagina
   * di gdahome, che sta dietro l'ingress e la aprono gli amministratori della
   * casa, non dalla plancia che si e' appena nascosta. */
  chiLaVede(profilo, utenti) {
    const una = this.archivio.dati.plance.find((quella) => quella.profilo === String(profilo));
    if (!una) throw new QuellaPlanciaNo("quella plancia non c'e'");
    const voluti = utentiPuliti(utenti);
    if (JSON.stringify(voluti) === JSON.stringify(utentiPuliti(una.utenti))) {
      return this.quale(una.profilo);
    }
    una.utenti = voluti;
    this.archivio.salva();
    this.registro.info(
      voluti.length === 0
        ? `la plancia «${una.titolo}» la vedono tutti`
        : `la plancia «${una.titolo}» la vedono ${voluti.length} utenti`,
    );
    /* Le voci fra le «Plance» di Home Assistant vanno riscritte: dentro la
     * vista c'e' l'elenco, ed e' quello che fa dire alla cartina «questa non
     * e' abilitata per te» senza chiedere niente a nessuno. */
    this._cambiato();
    return this.quale(una.profilo);
  }

  /* Se la vedono solo gli amministratori della casa.
   *
   * E' l'altra meta' di «chi la vede», e serve un caso diverso: non «questi
   * tre», ma «chi ha le chiavi di casa» — chiunque sia, anche chi arrivera'
   * domani. Un elenco di nomi va rifatto ogni volta che cambia qualcosa; il
   * gruppo degli amministratori si aggiorna da se'.
   *
   * Home Assistant sa farlo da se': una Plancia con `require_admin` non
   * compare nella barra laterale di chi non amministra, e la sua
   * configurazione non gliela da'. Ma l'indirizzo dell'ingress si puo' aprire
   * anche senza passare da quella voce, e allora il controllo lo rifa'
   * l'add-on. Due volte la stessa cosa, in due posti: quello che HA blocca non
   * arriva nemmeno, e quello che gli gira intorno lo blocca il secondo. */
  soloChiAmministra(profilo, si) {
    const una = this.archivio.dati.plance.find((quella) => quella.profilo === String(profilo));
    if (!una) throw new QuellaPlanciaNo("quella plancia non c'e'");
    const voluto = si === true;
    if (voluto === (una.solo_admin === true)) return this.quale(una.profilo);
    una.solo_admin = voluto;
    this.archivio.salva();
    this.registro.info(
      voluto
        ? `la plancia «${una.titolo}» la vedono solo gli amministratori`
        : `la plancia «${una.titolo}» non chiede piu' di amministrare`,
    );
    /* La voce fra le «Plance» di Home Assistant va riscritta: `require_admin`
     * sta li', e senza questo avviso resterebbe come prima fino al prossimo
     * riavvio dell'add-on. */
    this._cambiato();
    return this.quale(una.profilo);
  }

  /* Via una plancia, e con lei la sua configurazione.
   *
   * La prima non si tocca: e' quella che c'era, e una casa senza nessuna
   * plancia e' un'app che si apre su niente. Chi vuole ricominciare da capo
   * ha «Reset totale» dentro la Config, che e' il posto dove quella cosa si
   * chiede.
   *
   * `dimentica` e' passata da fuori — la tiene la cassetta della
   * configurazione — perche' questo file sa quali plance ci sono e non cosa
   * c'e' dentro: due mestieri, due posti. Senza, il cassetto resterebbe sul
   * disco per sempre, e il giorno che qualcuno rifacesse una plancia con lo
   * stesso nome si ritroverebbe la roba di prima. */
  togli(profilo, { dimentica } = {}) {
    const quale = String(profilo || "");
    if (quale === PROFILO_PRINCIPALE) {
      throw new QuellaPlanciaNo("la prima plancia non si toglie", "non_la_prima");
    }
    const dove = this.archivio.dati.plance.findIndex((una) => una.profilo === quale);
    if (dove < 0) throw new QuellaPlanciaNo("quella plancia non c'e'");
    const [via] = this.archivio.dati.plance.splice(dove, 1);
    this.archivio.salva();
    if (typeof dimentica === "function") {
      try {
        dimentica(quale);
      } catch (errore) {
        /* La plancia e' via comunque: quello che resta e' un cassetto senza
         * porta, e si dice invece di far finta. */
        this.registro.attenzione(
          `la plancia «${via.titolo}» e' via, la sua configurazione no: ${errore?.message || errore}`,
        );
      }
    }
    this.registro.info(`una plancia in meno: «${via.titolo}»`);
    this._cambiato();
    return this.elenco();
  }
}
