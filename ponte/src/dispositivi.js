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

/* ─── I telefoni staccati ────────────────────────────────────────────────
 *
 * Un telefono staccato — dalla console, o perche' sparito da troppo tempo —
 * non entra piu'. Ma se ribussa, qualcuno glielo deve dire, e dirglielo in
 * chiaro vuol dire che chiunque stia in mezzo puo' dirlo al posto nostro: un
 * «non ti conosco, riabbinati» falso e' un modo di far riabbinare un telefono
 * dove vuole lui. Allora della chiave del filo di un telefono staccato si
 * tiene memoria per un po': il portiere la usa per dirgli di no **cifrato**,
 * con la sua chiave, cosi' il no e' vero.
 *
 * Si tiene la chiave e basta: il segno, che serve a entrare, se ne va col
 * telefono. E non per sempre, e non senza tetto. */
const GIORNI_DEI_REVOCATI = 180;
const REVOCATI_AL_MASSIMO = 100;

/* ─── I telefoni di prova ─────────────────────────────────────────────────
 *
 * Un telefono entrato col codice della casa di prova (`casa-di-prova.js`) ha
 * una scadenza sua, `finoA`: quella del codice con cui e' entrato. Dopo
 * quell'ora per questa casa non c'e' piu' — non si riconosce, non ha una
 * chiave del filo, non si conta — anche prima che lo spazzino passi a
 * toglierlo dal file (`viaQuelliDiProva`). Lo spazzino gira ogni minuto, ma
 * un minuto di troppo e' proprio quello che non si deve regalare a chi la
 * casa non la abita. */

const nomePulito = (scritto) =>
  String(scritto ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

/* Marca, modello e versioni che il telefono dice di se'
 * (`ponte/telefono/chi-sono`, o all'abbinamento). Arrivano dalla porta
 * esposta: parole corte, senza caratteri di controllo. */
const campoCorto = (scritto) =>
  String(scritto ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

/* Cosa dice di se' un telefono: solo i campi che conosciamo, ripuliti. Il
 * proprietario e' il nome che ha scritto chi lo usa nell'app («Di chi e'
 * questo telefono?»), non l'utente di Home Assistant: al piu' 30 caratteri. */
export function chiE(detto = {}) {
  const fuori = {};
  for (const campo of ["marca", "modello", "versione", "app", "proprietario"]) {
    const pulito = campoCorto(detto?.[campo])
      .slice(0, campo === "proprietario" ? 30 : 40)
      .trim();
    if (pulito) fuori[campo] = pulito;
  }
  return fuori;
}

/* Il nome che la casa da' da sola a un telefono: il modello, e di chi e' se
 * l'ha detto. «Galaxy S24 Ultra di Persona 1». Senza modello, niente. */
export function nomeDalModello({ modello, proprietario } = {}) {
  if (!modello) return "";
  return nomePulito(proprietario ? `${modello} di ${proprietario}` : modello);
}

/* I nomi che un telefono si dava da solo prima del modello: questi si
 * possono sostituire col modello. Uno scritto da una persona no. */
const NOMI_DA_SOLI = new Set([
  "telefono",
  "telefono android",
  "android phone",
  "iphone",
  "ipad",
  "dispositivo",
  "localhost",
  "localhost.localdomain",
  "android",
  "sconosciuto",
]);

/* Il nome si puo' rifare col modello: nessuno l'ha scelto a mano, ed e' uno
 * di quelli che il telefono si dava da solo — o quello fatto qui col modello
 * di prima. */
function nomeRifacibile(dispositivo) {
  if (dispositivo.rinominato === true) return false;
  const nome = String(dispositivo.nome || "")
    .trim()
    .toLowerCase();
  if (!nome || NOMI_DA_SOLI.has(nome)) return true;
  return nome === nomeDalModello(dispositivo).toLowerCase();
}

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
    this.viaQuelliDiProva();
  }

  get lista() {
    return this.archivio.dati.dispositivi;
  }

  /* Un telefono di prova la cui ora e' passata. Gli altri non scadono. */
  _scaduto(uno) {
    return Number.isFinite(uno?.finoA) && uno.finoA <= this.adesso();
  }

  /* I telefoni che valgono adesso: tutti, meno quelli di prova scaduti. */
  get _vivi() {
    return this.lista.filter((uno) => !this._scaduto(uno));
  }

  get _revocati() {
    if (!Array.isArray(this.archivio.dati.revocati)) this.archivio.dati.revocati = [];
    return this.archivio.dati.revocati;
  }

  /* La chiave del filo di un telefono staccato, se lo si ricorda ancora: vedi
   * «I telefoni staccati». `null` se non c'e', o se e' passato troppo tempo. */
  chiaveRevocataDi(id) {
    /* Un telefono di prova scaduto e' gia' staccato, anche se lo spazzino
     * non e' ancora passato: gli si dice cifrato, come agli altri. */
    const scaduto = this.lista.find((uno) => uno.id === id && this._scaduto(uno));
    if (scaduto) {
      return typeof scaduto.chiave === "string" && scaduto.chiave.length === 64
        ? scaduto.chiave
        : null;
    }
    const limite = this.adesso() - GIORNI_DEI_REVOCATI * GIORNO;
    const trovato = this._revocati.find((uno) => uno.id === id && (uno.staccatoIl || 0) >= limite);
    const chiave = trovato?.chiave;
    return typeof chiave === "string" && chiave.length === 64 ? chiave : null;
  }

  /* Si ricorda la chiave di questi telefoni, e dimentica quelle troppo
   * vecchie o di troppo. Non salva: lo fa chi chiama, una volta sola. */
  _ricordaStaccati(andati) {
    const ora = this.adesso();
    const limite = ora - GIORNI_DEI_REVOCATI * GIORNO;
    const nuovi = andati
      .filter((uno) => typeof uno?.chiave === "string" && uno.chiave.length === 64)
      .map((uno) => ({ id: uno.id, chiave: uno.chiave, staccatoIl: ora }));
    const tenuti = [
      ...this._revocati.filter(
        (uno) => (uno.staccatoIl || 0) >= limite && !nuovi.some((nuovo) => nuovo.id === uno.id),
      ),
      ...nuovi,
    ];
    this.archivio.dati.revocati = tenuti.slice(-REVOCATI_AL_MASSIMO);
  }

  /* Quello che si puo' far vedere: l'impronta resta dentro. */
  elenco() {
    return this._vivi.map((uno) => ({
      ...this._chiE(uno),
      ...this._vistoInElenco(uno),
    }));
  }

  /* Marca, modello, versioni, di chi e', e se il nome l'ha scelto una
   * persona: quello che la console scrive sotto il nome. */
  _chiE(uno) {
    return { ...chiE(uno), rinominato: uno.rinominato === true };
  }

  _vistoInElenco({ id, nome, sistema, natoIl, vistoIl, utente, finoA }) {
    return {
      id,
      nome,
      sistema,
      natoIl,
      vistoIl,
      /* Di chi e'. Va detto a schermo: un telefono senza padrone vede tutte
       * le plance, ed e' esattamente quello di cui bisogna accorgersi. */
      utente: utentePulito(utente),
      /* Fino a quando, per un telefono della casa di prova: la console lo
       * scrive accanto al nome. Gli altri non ce l'hanno. */
      ...(Number.isFinite(finoA) ? { finoA } : {}),
    };
  }

  /* Il telefono dice di se' marca, modello, versioni e di chi e'
   * (`ponte/telefono/chi-sono`): si scrive, e se il nome non l'ha scelto una
   * persona si rifa' col modello — «Telefono Android» diventa «Galaxy S24
   * Ultra di Persona 1». Vale solo per il telefono di quel filo: lo decide
   * chi chiama. Torna `true` se e' cambiato qualcosa. */
  presentati(id, detto = {}) {
    const dispositivo = this.lista.find((uno) => uno.id === id);
    if (!dispositivo) return false;
    const chi = chiE(detto);
    if (!Object.keys(chi).length) return false;
    const rifacibile = nomeRifacibile(dispositivo);
    let cambiato = false;
    for (const [campo, valore] of Object.entries(chi)) {
      if (dispositivo[campo] !== valore) {
        dispositivo[campo] = valore;
        cambiato = true;
      }
    }
    const nuovo = nomeDalModello(dispositivo);
    if (rifacibile && nuovo && dispositivo.nome !== nuovo) {
      dispositivo.nome = nuovo;
      cambiato = true;
    }
    if (cambiato) this.archivio.salva();
    return cambiato;
  }

  /* Di chi e' questo telefono. `""` per uno che non c'e' e per uno abbinato
   * prima di oggi — e in tutti e due i casi vuol dire «vede tutto». */
  utenteDi(id) {
    return utentePulito(this._vivi.find((uno) => uno.id === id)?.utente);
  }

  /* Se questo telefono e' entrato col codice della casa di prova, e vale
   * ancora (vedi «I telefoni di prova»). Lo chiede il filo per le licenze:
   * a un telefono di prova l'app lascia in vista gli abbonamenti anche con la
   * casa Premium (`commissioni.js`). */
  diProva(id) {
    return Number.isFinite(this._vivi.find((uno) => uno.id === id)?.finoA);
  }

  quanti() {
    return this._vivi.length;
  }

  /* Quelli della casa, senza i telefoni di prova: sono loro a stare nei
   * dieci (`dispositivi_massimi`). Chi rivede l'app per i negozi non toglie
   * il posto a chi in casa ci abita. */
  quantiDiCasa() {
    return this._vivi.filter((uno) => !Number.isFinite(uno.finoA)).length;
  }

  /* Quanti telefoni sono entrati con la casa di prova, e valgono ancora. */
  quantiDiProva() {
    return this._vivi.filter((uno) => Number.isFinite(uno.finoA)).length;
  }

  /* Abbina un telefono e restituisce il segno.
   *
   * Il segno esce da qui una volta sola, adesso. Chi lo perde riabbina: non
   * c'e' nessuna strada per rileggerlo, ed e' voluto. */
  abbina({ nome, sistema, utente = "", finoA = null, ...detto } = {}) {
    if (!Number.isFinite(finoA) && this.quantiDiCasa() >= this.massimi) {
      throw new TroppiDispositivi(`sono gia' abbinati ${this.massimi} dispositivi`);
    }
    const segno = segnoNuovo();
    const chiave = chiaveDelFiloNuova();
    /* Marca, modello, versioni e di chi e', se l'app li dice: il nome lo fa
     * il modello. Un'app di prima non li manda, e resta il nome che dice. */
    const chi = chiE(detto);
    const dispositivo = {
      id: `dm_${segnoNuovo().slice(0, 16)}`,
      nome: nomeDalModello(chi) || nomePulito(nome) || "Telefono",
      sistema: nomePulito(sistema) || "sconosciuto",
      ...chi,
      rinominato: false,
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
      /* Un telefono della casa di prova scade col codice con cui e' entrato:
       * vedi «I telefoni di prova». */
      ...(Number.isFinite(finoA) ? { finoA } : {}),
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
    const dispositivo = this._vivi.find((uno) => uno.id === id);
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
    if (!trovato || this._scaduto(trovato)) return null;
    trovato.vistoIl = this.adesso();
    this._forseSalva();
    return this._pulito(trovato);
  }

  stacca(id) {
    const andati = this.lista.filter((uno) => uno.id === id);
    if (!andati.length) return false;
    this.archivio.dati.dispositivi = this.lista.filter((uno) => uno.id !== id);
    this._ricordaStaccati(andati);
    this.archivio.salva();
    return true;
  }

  /* Un telefono riabbinato stacca se stesso di prima.
   *
   * «Nei telefoni abbinati lo stesso telefono compare due volte.» Ogni
   * abbinamento fa un telefono nuovo, e quello di prima restava finche' non
   * stava zitto per i giorni di silenzio. Adesso il telefono appena entrato
   * (`nuovo`, quello del filo) puo' dire chi era: il vecchio identificativo e
   * il vecchio **segno**, che ha solo lui. Se il segno torna con l'impronta
   * di quel telefono, quel telefono era lui, e si stacca. Senza il segno
   * giusto non si stacca niente: nessuno puo' mandar via il telefono di un
   * altro sapendone soltanto l'identificativo, che non e' un segreto. */
  sostituisci({ nuovo, vecchio, segno } = {}) {
    if (typeof vecchio !== "string" || typeof segno !== "string" || !segno) return false;
    if (!nuovo || vecchio === nuovo) return false;
    if (!this.lista.some((uno) => uno.id === nuovo)) return false;
    const quello = this.lista.find((uno) => uno.id === vecchio);
    if (!quello || !stessoSegreto(quello.impronta, impronta(segno))) return false;
    return this.stacca(vecchio);
  }

  staccaTutti() {
    const andati = [...this.lista];
    this.archivio.dati.dispositivi = [];
    this._ricordaStaccati(andati);
    this.archivio.salva();
    return andati.length;
  }

  /* Via i telefoni della casa di prova: quelli scaduti, oppure — con
   * `tutti` — anche quelli ancora nel loro tempo, perche' il codice e' stato
   * revocato. Della loro chiave la casa si ricorda, come di ogni telefono
   * staccato: a chi ribussa dice di no cifrato. Torna gli identificativi,
   * cosi' chi chiama chiude i loro fili ancora aperti. */
  viaQuelliDiProva({ tutti = false } = {}) {
    const andati = this.lista.filter(
      (uno) => Number.isFinite(uno.finoA) && (tutti || this._scaduto(uno)),
    );
    if (!andati.length) return [];
    const via = new Set(andati.map((uno) => uno.id));
    this.archivio.dati.dispositivi = this.lista.filter((uno) => !via.has(uno.id));
    this._ricordaStaccati(andati);
    this.archivio.salva();
    return [...via];
  }

  /* I telefoni della casa di prova restano dentro fino a `finoA`, la nuova
   * scadenza di un codice allungato (`allunga` in `casa-di-prova.js`). Solo
   * quelli ancora nel loro tempo: uno scaduto e' gia' fuori, e rientra col
   * codice come tutti. Torna quanti ne ha toccati. */
  allungaQuelliDiProva(finoA) {
    if (!Number.isFinite(finoA)) return 0;
    const dentro = this.lista.filter((uno) => Number.isFinite(uno.finoA) && !this._scaduto(uno));
    for (const uno of dentro) uno.finoA = Math.max(uno.finoA, finoA);
    if (dentro.length) this.archivio.salva();
    return dentro.length;
  }

  rinomina(id, nome) {
    const dispositivo = this.lista.find((uno) => uno.id === id);
    if (!dispositivo) return false;
    const scelto = nomePulito(nome);
    if (scelto) {
      dispositivo.nome = scelto;
      /* Scelto da una persona: il modello non lo rifa' piu'. */
      dispositivo.rinominato = true;
    }
    this.archivio.salva();
    return true;
  }

  /* Via i telefoni spariti da troppo tempo. Zero giorni vuol dire mai. */
  potatura() {
    if (!this.giorniDiSilenzio) return 0;
    const limite = this.adesso() - this.giorniDiSilenzio * GIORNO;
    const andati = this.lista.filter((uno) => (uno.vistoIl || 0) < limite);
    if (!andati.length) return 0;
    this.archivio.dati.dispositivi = this.lista.filter((uno) => (uno.vistoIl || 0) >= limite);
    this._ricordaStaccati(andati);
    this.archivio.salva();
    return andati.length;
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
   * console si vedeva «di Persona 1», perche' l'elenco legge l'archivio; sul
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
