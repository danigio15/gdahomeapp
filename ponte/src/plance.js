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

/* Come si chiama una plancia: abbastanza per un nome, non per una frase. */
export const TITOLO_MASSIMO = 40;

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
       * Per la prima e' «ponte» e non «ponte-primary», perche' quel nome e'
       * gia' scritto nei depositi dei telefoni di chi ce l'ha da prima: e
       * cambiarlo vorrebbe dire una plancia che si ritrova il tema di serie
       * senza che nessuno l'abbia toccato. */
      istanza: una.profilo === PROFILO_PRINCIPALE ? "ponte" : `ponte-${una.profilo}`,
      primaria: una.profilo === PROFILO_PRINCIPALE,
      creata_il: una.creata_il,
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
    const nuova = { profilo, titolo: nome, creata_il: this.adesso() };
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
