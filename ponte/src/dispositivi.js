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
    return this.lista.map(({ id, nome, sistema, natoIl, vistoIl }) => ({
      id,
      nome,
      sistema,
      natoIl,
      vistoIl,
    }));
  }

  quanti() {
    return this.lista.length;
  }

  /* Abbina un telefono e restituisce il segno.
   *
   * Il segno esce da qui una volta sola, adesso. Chi lo perde riabbina: non
   * c'e' nessuna strada per rileggerlo, ed e' voluto. */
  abbina({ nome, sistema } = {}) {
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

  _pulito({ id, nome, sistema, natoIl, vistoIl }) {
    return { id, nome, sistema, natoIl, vistoIl };
  }

  _forseSalva() {
    const ora = this.adesso();
    if (ora - this._visitaSalvataIl < VISITA_SUL_DISCO) return;
    this._visitaSalvataIl = ora;
    this.archivio.salva();
  }
}

export class TroppiDispositivi extends Error {}
