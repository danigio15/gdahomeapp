/* I telefoni abbinati.
 *
 * Un telefono si abbina una volta e riceve **due cose**, e sono diverse
 * apposta:
 *
 *   - il **segno**, che serve a entrare. Qui ne resta solo l'impronta, quindi
 *     chi legge `/data/dispositivi.json` non entra in casa di nessuno — e
 *     nemmeno chi ne fa un backup e se lo dimentica in giro.
 *   - la **chiave del filo**, che serve a cifrare quello che passa dal
 *     centralino. Quella resta com'e', perche' per cifrare serve la chiave e
 *     non la sua impronta.
 *
 * Chi rubasse questo file avrebbe la seconda e non la prima: potrebbe leggere
 * del traffico che avesse gia' registrato per conto suo, ma non potrebbe
 * entrare in casa. Sono due danni diversi, e tenerli separati e' il motivo per
 * cui sono due cose invece di una.
 *
 * Il segno non e' un segno di Home Assistant, ed e' il punto di tutto
 * l'add-on: vale solo per questo ponte, si stacca da qui senza toccare gli
 * utenti di Home Assistant, e se un telefono viene perso si spegne quello
 * senza cambiare niente a nessun altro.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { chiaveDelFiloNuova } from "./cifra.js";
import { impronta, segnoNuovo, stessoSegreto } from "./segreti.js";

const GIORNO = 24 * 60 * 60 * 1000;

/* Ogni quanto l'ora dell'ultima visita puo' finire sul disco.
 *
 * Un telefono collegato fa passare messaggi in continuazione, e scrivere il
 * file a ogni messaggio vorrebbe dire scrivere sulla scheda SD di un Raspberry
 * qualche volta al secondo. L'ora esatta dell'ultima visita non serve a
 * nessuno: serve sapere se un telefono e' sparito da tre mesi. */
const VISITA_SUL_DISCO = 5 * 60 * 1000;

const nomePulito = (scritto) =>
  String(scritto ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

/* L'identificativo di un utente di Home Assistant: trentadue cifre
 * esadecimali. Quello che non ha quella forma diventa «non si sa di chi e'» —
 * cioe' vede tutto, come prima — invece di un fantasma che non apre niente. */
function utentePulito(chi) {
  const detto = String(chi || "").trim();
  return /^[a-f0-9]{32}$/i.test(detto) ? detto : "";
}

export class Dispositivi {
  constructor({
    cartella = "/data",
    massimi = 10,
    giorniDiSilenzio = 90,
    adesso = () => Date.now(),
  } = {}) {
    this.massimi = massimi;
    this.giorniDiSilenzio = giorniDiSilenzio;
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "dispositivi.json"), { dispositivi: [] });
    /* Si parte come se si fosse appena scritto: altrimenti il primo telefono
     * che si fa vivo dopo l'accensione scrive sul disco comunque, e un ponte
     * che si riavvia spesso scriverebbe a ogni riavvio. L'ora dell'ultima
     * visita serve a sapere se un telefono e' sparito da tre mesi, e a quella
     * domanda cinque minuti di approssimazione non cambiano niente. */
    this._visitaSalvataIl = this.adesso();
    this.potatura();
  }

  get lista() {
    return this.archivio.dati.dispositivi;
  }

  /* Quello che si puo' far vedere: l'impronta resta dentro. */
  elenco() {
    return this.lista.map(({ id, nome, sistema, natoIl, vistoIl, utente }) => ({
      id,
      nome,
      sistema,
      natoIl,
      vistoIl,
      /* Di chi e'. Va detto a schermo: un telefono senza padrone vede tutte
       * le plance, ed e' esattamente quello di cui bisogna accorgersi. */
      utente: utentePulito(utente),
    }));
  }

  /* Di chi e' questo telefono. `""` per uno che non c'e' e per uno abbinato
   * prima di oggi — e in tutti e due i casi vuol dire «vede tutto». */
  utenteDi(id) {
    return utentePulito(this.lista.find((uno) => uno.id === id)?.utente);
  }

  quanti() {
    return this.lista.length;
  }

  /* Abbina un telefono e restituisce il segno.
   *
   * Il segno esce da qui una volta sola, adesso. Chi lo perde riabbina: non
   * c'e' nessuna strada per rileggerlo, ed e' voluto. */
  abbina({ nome, sistema, utente = "" } = {}) {
    if (this.lista.length >= this.massimi) {
      throw new TroppiDispositivi(`sono gia' abbinati ${this.massimi} dispositivi`);
    }
    const segno = segnoNuovo();
    const chiave = chiaveDelFiloNuova();
    const dispositivo = {
      id: `dm_${segnoNuovo().slice(0, 16)}`,
      nome: nomePulito(nome) || "Telefono",
      sistema: nomePulito(sistema) || "sconosciuto",
      impronta: impronta(segno),
      chiave,
      natoIl: this.adesso(),
      vistoIl: this.adesso(),
      /* Di chi e' questo telefono, secondo l'utente di Home Assistant che ha
       * fabbricato il codice.
       *
       * Serve a «chi vede quale plancia»: il QR abbina un telefono e non un
       * utente, e senza questa riga quel telefono chiede le plance al filo e
       * se le prende **tutte** — comprese quelle riservate a qualcun altro.
       * Cosi' invece eredita un utente, e vede quello che vede lui.
       *
       * Vuoto vuol dire «non si sa di chi e'», e chi non si sa vede tutto: e'
       * come sono i telefoni abbinati prima di oggi, e non si spengono a
       * tradimento il giorno dell'aggiornamento. */
      utente: utentePulito(utente),
    };
    this.lista.push(dispositivo);
    this.archivio.salva();
    return { dispositivo: this._pulito(dispositivo), segno, chiave };
  }

  /* La chiave del filo di un telefono, per cifrare quello che gli si manda.
   *
   * Torna `null` per un telefono che non c'e', e anche per uno abbinato prima
   * che le chiavi esistessero: quello si riabbina, e finche' non lo fa parla
   * in chiaro come faceva prima. */
  chiaveDi(id) {
    const dispositivo = this.lista.find((uno) => uno.id === id);
    const chiave = dispositivo?.chiave;
    return typeof chiave === "string" && chiave.length === 64 ? chiave : null;
  }

  /* Chi bussa con un segno: `null` se non e' nessuno. */
  riconosci(segno) {
    const cercata = impronta(segno);
    /* Il confronto passa da tutti quanti anche dopo aver trovato: uscire al
     * primo che coincide direbbe, col tempo, in che posizione dell'elenco sta
     * il telefono, e con abbastanza tentativi si ricostruisce chi c'e'. */
    let trovato = null;
    for (const dispositivo of this.lista) {
      if (stessoSegreto(dispositivo.impronta, cercata)) trovato = dispositivo;
    }
    if (!trovato) return null;
    trovato.vistoIl = this.adesso();
    this._forseSalva();
    return this._pulito(trovato);
  }

  stacca(id) {
    const prima = this.lista.length;
    this.archivio.dati.dispositivi = this.lista.filter((uno) => uno.id !== id);
    if (this.lista.length === prima) return false;
    this.archivio.salva();
    return true;
  }

  staccaTutti() {
    const quanti = this.lista.length;
    this.archivio.dati.dispositivi = [];
    this.archivio.salva();
    return quanti;
  }

  rinomina(id, nome) {
    const dispositivo = this.lista.find((uno) => uno.id === id);
    if (!dispositivo) return false;
    dispositivo.nome = nomePulito(nome) || dispositivo.nome;
    this.archivio.salva();
    return true;
  }

  /* Via i telefoni spariti da troppo tempo. Zero giorni vuol dire mai. */
  potatura() {
    if (!this.giorniDiSilenzio) return 0;
    const limite = this.adesso() - this.giorniDiSilenzio * GIORNO;
    const prima = this.lista.length;
    this.archivio.dati.dispositivi = this.lista.filter((uno) => (uno.vistoIl || 0) >= limite);
    const andati = prima - this.lista.length;
    if (andati) this.archivio.salva();
    return andati;
  }

  /* Il dispositivo come lo vede chi sta fuori da qui.
   *
   * `utente` c'e' dentro, e non e' un dettaglio: da questa funzione passa
   * anche `riconosci`, e quello che `riconosci` non dice il filo non lo sa.
   * Senza questo campo il ponte chiedeva «di chi e' questo telefono?» a un
   * oggetto che non ce l'aveva — e la risposta era sempre «non si sa» —
   * mentre «non si sa» vuol dire «vede tutto». Cosi' il cancello delle plance
   * riservate non si chiudeva per nessuno: il dato era giusto nell'archivio,
   * la regola era giusta, e il valore si perdeva nel passo in mezzo. Nella
   * console si vedeva «di Giovanni», perche' l'elenco legge l'archivio; sul
   * filo no. */
  _pulito({ id, nome, sistema, natoIl, vistoIl, utente }) {
    return { id, nome, sistema, natoIl, vistoIl, utente: utentePulito(utente) };
  }

  _forseSalva() {
    const ora = this.adesso();
    if (ora - this._visitaSalvataIl < VISITA_SUL_DISCO) return;
    this._visitaSalvataIl = ora;
    this.archivio.salva();
  }
}

export class TroppiDispositivi extends Error {}
