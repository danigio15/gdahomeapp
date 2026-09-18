/* Cosa c'e' da aggiornare in casa, e i due tasti per farlo.
 *
 * «Quando ci saranno gli aggiornamenti, e quindi compaiono in Home Assistant,
 * chi utilizzera' app non vedra' mai aggiornamenti se non accede su HA.»
 *
 * E' il prezzo di un'app che sostituisce Home Assistant: chi la usa tutti i
 * giorni in Home Assistant non ci entra piu', e li' resta il pallino rosso
 * che nessuno guarda. Una casa che non si aggiorna per sei mesi non e' una
 * casa aggiornata male, e' una casa con sei mesi di correzioni di sicurezza
 * in meno.
 *
 * Le regole sono **le stesse della plancia** — `aggiornamenti-da-fare.js`,
 * dentro `ponte/plancia/`, la tessera ambra della Home (#498, #540) — e non
 * per caso: chi guarda la dashboard e chi guarda l'app devono vedere lo
 * stesso elenco, con gli stessi nomi e nello stesso ordine. Sono riscritte
 * qui invece di importate perche' quella cartella e' la plancia vendorizzata,
 * che a ogni rilascio di DashboardModern viene sostituita intera: un `import`
 * da li' dentro romperebbe l'add-on il giorno che un file cambia posto. A
 * tenerle uguali ci pensa una prova, che le confronta sulle stesse entita'
 * (`ponte/test/aggiornamenti.test.js`).
 *
 * Perche' la domanda la faccia il ponte e non il telefono: le entita'
 * `update.` sono cinque o sei, e stanno dentro un `get_states` da un megabyte
 * e mezzo. Il telefono quel megabyte se lo tira giu' solo quando gli serve la
 * casa intera — l'elenco dei dispositivi, la configurazione — e per contare
 * tre aggiornamenti non gli serve. Qui il `get_states` si fa sulla rete di
 * casa, dove non costa niente, e sul filo passano tre righe.
 */

import { RispostaNegativa } from "./casa.js";

const pulito = (valore) => String(valore ?? "").trim();

/** Il dominio delle entita' che dicono se c'e' una versione nuova. */
const DOMINIO = "update.";

/* La plancia si riconosce dal suo `title`, che l'entita' dichiara e che non
 * cambia col nome che uno da' alla propria plancia. */
const NOSTRA = "dashboardmodern";

/* Quello che un'entita' `update.` sa fare, come lo numera Home Assistant: il
 * primo bit e' «si installa chiamando un servizio». Chi non ce l'ha si
 * aggiorna altrove — un firmware che si porta col cacciavite non ha un tasto,
 * e mostrarglielo sarebbe una promessa che non si mantiene. */
const SI_INSTALLA = 1;

/* E il quinto bit e' «le note della versione le so, chiedimele».
 *
 * Non tutte le entita' `update.` le sanno: gdahome e Home Assistant si', un
 * firmware di una presa quasi mai. Chi non ce l'ha, se glielo si chiede, fa
 * dire no a Home Assistant — e un no che si poteva prevedere leggendo un bit
 * non e' un no da mostrare a nessuno. Percio' il tasto «Cosa cambia» compare
 * dove **questo bit** c'e', o dove c'e' almeno un indirizzo da aprire. */
const LE_NOTE = 16;

/* Quanto si tiene l'elenco prima di richiederlo. La schermata si riguarda da
 * sola mentre si sta li' — un'installazione che va avanti deve muoversi — e
 * senza questo ogni giro sarebbe un `get_states` intero. Gli aggiornamenti
 * non compaiono al secondo: dieci secondi non li fa perdere a nessuno. */
export const QUANTO_DURA = 10_000;

/* Quanto si aspetta una risposta a un comando che **fa cadere il filo**.
 *
 * `update.install` in Home Assistant non torna quando l'installazione parte:
 * torna quando e' finita, e un add-on ci mette minuti. `homeassistant.restart`
 * non torna affatto — spegne Home Assistant, e con lui il filo che doveva
 * portare la risposta. Aspettare la risposta vera vorrebbe dire lasciare il
 * telefono appeso per tutto il tempo, per poi dirgli «non ha risposto» di una
 * cosa che sta andando benissimo.
 *
 * Quindi si aspetta poco, e il silenzio non e' un errore: si risponde
 * «avviato», e cosa sia successo lo dicono le entita' al giro dopo. E' la
 * stessa scelta della plancia, che il tasto lo spegne e scrive «In corso»
 * senza aspettare niente. */
const ATTESA_CORTA = 4_000;

function numero(valore) {
  const quanto = Number(valore);
  return Number.isFinite(quanto) ? quanto : 0;
}

/** Se questa entita' e' un aggiornamento che aspetta di essere fatto. */
export function aspettaDiEssereFatto(stato) {
  if (!stato || !pulito(stato.entity_id).startsWith(DOMINIO)) return false;
  /* «on» vuol dire «c'e' una versione nuova». Le entita' non disponibili non
   * si contano: un'integrazione che non risponde non e' un aggiornamento da
   * fare, e' un'integrazione che non risponde. */
  return pulito(stato.state).toLowerCase() === "on";
}

/** Se questo aggiornamento si puo' far partire da qui. */
function siInstalla(attributi) {
  return (numero(attributi?.supported_features) & SI_INSTALLA) !== 0;
}

/** Se le note lunghe di questa versione si possono chiedere a Home Assistant. */
function saLeNote(attributi) {
  return (numero(attributi?.supported_features) & LE_NOTE) !== 0;
}

/* Se sta gia' andando.
 *
 * Home Assistant lo dice in due modi, e nel tempo li ha cambiati:
 * `in_progress` oggi e' un si' o un no, ieri era la percentuale — e uno zero
 * li' vuol dire «fermo», non «allo zero per cento». La percentuale, quando
 * c'e', arriva a parte. Vanno letti tutt'e due: una versione sola lascia
 * indietro meta' delle case. */
function staAndando(attributi) {
  if (attributi?.in_progress === true) return true;
  if (numero(attributi?.in_progress) > 0) return true;
  return numero(attributi?.update_percentage) > 0;
}

/* A che punto e', da 0 a 100, oppure -1 quando non lo dice. Serve alla barra
 * che avanza: una barra ferma a zero per due minuti sembra un'app bloccata,
 * e dove la percentuale non c'e' e' meglio una striscia che si muove da sola
 * e non promette niente. */
function aChePunto(attributi) {
  const detta = attributi?.update_percentage;
  if (detta === null || detta === undefined || detta === "") return -1;
  const quanto = Number(detta);
  if (!Number.isFinite(quanto)) return -1;
  return Math.max(0, Math.min(100, Math.round(quanto)));
}

/** Il nome da mostrare: quello che l'utente legge nella pagina Aggiornamenti. */
function nomeDi(stato) {
  const attributi = stato?.attributes || {};
  return (
    pulito(attributi.title) || pulito(attributi.friendly_name) || pulito(stato?.entity_id) || ""
  );
}

/** Se questo aggiornamento e' della plancia. */
function eLaNostra(stato) {
  const attributi = stato?.attributes || {};
  return (
    pulito(attributi.title).toLowerCase().replace(/\s+/g, "").includes(NOSTRA) ||
    pulito(stato?.entity_id).toLowerCase().includes(NOSTRA)
  );
}

/* Quelli che, per installarsi, portano giu' la strada fra il telefono e casa.
 *
 * Sono tre cose diverse che finiscono uguale: **gdahome** — questo add-on, il
 * ponte stesso: si riavvia, e il filo del telefono se ne va con lui;
 * **Home Assistant** (Core, Supervisor, sistema operativo): si riavvia lui, e
 * il ponte resta acceso a parlare con una casa che non c'e'.
 *
 * Serve a dirlo **prima**. Senza, chi preme «Installa» sull'aggiornamento di
 * gdahome vede l'app sconnettersi un istante dopo e pensa di aver rotto
 * qualcosa: e la volta dopo non lo preme piu'. Detto prima e' un'attesa; non
 * detto e' un guasto. */
const STACCANO = [
  "gdahome",
  "home_assistant_core",
  "home_assistant_supervisor",
  "home_assistant_operating_system",
  "homeassistantcore",
  "homeassistantsupervisor",
  "homeassistantoperatingsystem",
];

/* Il segno di chi si aggiorna: dove Home Assistant dice che sta.
 *
 * Un elenco di sei righe tutte uguali, con sei nomi scritti, si legge riga per
 * riga. Con i segni davanti si riconosce quello che si cerca **senza
 * leggere** — la casa di Home Assistant, il quadrato di gdahome, il marchio
 * dell'add-on — che e' come funziona la pagina Aggiornamenti di Home
 * Assistant e come funziona la tessera della plancia.
 *
 * `entity_picture` e' il campo dove Home Assistant lo scrive, e ne scrive di
 * due razze:
 *
 *  - un indirizzo **di casa**, che comincia con una barra: `/api/hassio/...`
 *    per l'icona di un add-on. Quello non si apre senza il segno di Home
 *    Assistant, e il segno ce l'ha il ponte: passa da `ponte/http`, che e'
 *    la strada che i file di casa fanno gia';
 *  - un indirizzo dei **marchi** di Home Assistant
 *    (`brands.home-assistant.io`), che e' dove stanno i loghi delle
 *    integrazioni. Quello e' pubblico, e lo prende il ponte per non mandare
 *    il telefono a chiedere in giro chi ha in casa.
 *
 * Tutto il resto **non passa**, e non e' prudenza per il gusto di esserlo: se
 * qui passasse un indirizzo qualunque, chi puo' scrivere l'attributo di
 * un'entita' avrebbe il ponte come messaggero per andare dove vuole. Due
 * razze, e nient'altro.
 */
export const I_MARCHI = "https://brands.home-assistant.io/";

/* Dove si vanno a **prendere** i marchi.
 *
 * E' la stessa cosa di `I_MARCHI`, tranne sul banco, dove internet non c'e' e
 * li serve la casa finta. Sono due costanti e non una perche' fanno due
 * lavori diversi, e confonderli si e' visto subito: `I_MARCHI` e' la **lista
 * di quello che passa** — un indirizzo dichiarato da un'entita' vale solo se
 * comincia cosi' — e spostarla per il banco voleva dire che l'indirizzo vero
 * dei marchi, quello che dichiara Home Assistant, non passava piu'. */
const DOVE_I_MARCHI = process.env.PONTE_MARCHI || I_MARCHI;

/**
 * Dove sta il segno di questo aggiornamento, o stringa vuota se non si sa.
 *
 * @param {object} stato lo stato dell'entita'
 */
export function ilLogoDi(stato) {
  const dove = pulito(stato?.attributes?.entity_picture);
  if (!dove) return "";
  if (dove.startsWith("//")) return "";
  if (dove.startsWith("/")) return dove;
  if (dove.startsWith(I_MARCHI)) return dove;
  return "";
}

/**
 * Il marchio di un'integrazione, dai marchi di Home Assistant.
 *
 * E' la seconda strada, e serve a chi non dichiara **niente**: certi
 * aggiornamenti non hanno `entity_picture` affatto, e nel riquadro restava
 * l'iniziale. Quello che si sa di loro e' **da dove vengono**: il registro
 * delle entita' dice l'integrazione, e le integrazioni hanno il loro marchio.
 * Non e' il logo dell'apparecchio, e non pretende di esserlo: e' il segno di
 * chi lo porta in casa, che e' la stessa cosa che Home Assistant fa vedere
 * nella pagina delle integrazioni.
 *
 * @param {string} integrazione il nome dell'integrazione, come lo dice il registro
 */
export function ilMarchioDi(integrazione) {
  const quale = pulito(integrazione).toLowerCase();
  /* Solo quello che e' un nome: il pezzo finisce dentro un indirizzo, e un
   * nome con una barra o un punto porterebbe da un'altra parte. */
  if (!/^[a-z0-9_]+$/.test(quale)) return "";
  /* **Senza** il `_/` davanti, ed e' la differenza fra un no e un quadrato
   * grigio: i marchi di Home Assistant servono quell'indirizzo in due modi, e
   * con il `_/` un'integrazione che un marchio non ce l'ha non risponde `404`
   * — risponde `200` con dentro il segnaposto «logo mancante». Il telefono lo
   * prenderebbe per un logo e lo disegnerebbe, al posto dell'iniziale, che
   * almeno dice la prima lettera di quello che stai aggiornando. */
  return `${DOVE_I_MARCHI}${quale}/icon.png`;
}

/* L'integrazione che non e' un prodotto ma una **strada**, e la classe di chi
 * ci passa sopra. Insieme dicono «questo e' un dispositivo di Zigbee2MQTT». */
const UNA_STRADA = "mqtt";
const UN_FIRMWARE = "firmware";

/* Come si riconosce l'add-on di Zigbee2MQTT fra gli altri. Lo slug ha davanti
 * il numero di chi tiene il deposito (`45df7312_zigbee2mqtt`), e dietro puo'
 * avere una coda (`_edge`): quello che conta e' il pezzo in mezzo. */
const ZIGBEE2MQTT = /(?:^|_)zigbee2mqtt(?:_|$)/;
const LICONA_DI_UN_ADDON = /^\/api\/hassio\/addons\/([a-z0-9_-]+)\/icon$/;

/**
 * Il segno dell'add-on di Zigbee2MQTT, se questa casa ce l'ha.
 *
 * Non si chiede niente a nessuno: Home Assistant fa un'entita' `update.` per
 * **ogni** add-on installato — anche per quelli a posto, che stanno a `off` —
 * e ognuna si porta dietro l'indirizzo della sua icona. Quindi l'elenco degli
 * stati, che il ponte ha gia' in mano, dice anche quali add-on ci sono e dove
 * stanno i loro segni.
 *
 * @param {Array<object>} stati gli stati di Home Assistant, tutti
 */
export function ilSegnoDiZigbee2mqtt(stati) {
  const dentro = Array.isArray(stati) ? stati : [];
  for (const stato of dentro) {
    if (!pulito(stato?.entity_id).startsWith(DOMINIO)) continue;
    const dove = pulito(stato?.attributes?.entity_picture);
    const quale = LICONA_DI_UN_ADDON.exec(dove);
    if (quale && ZIGBEE2MQTT.test(quale[1])) return dove;
  }
  return "";
}

function staccaIlFilo(stato) {
  const dove = `${pulito(stato?.entity_id)} ${pulito(stato?.attributes?.title)}`
    .toLowerCase()
    .replace(/\s+/g, "");
  return STACCANO.some((quale) => dove.includes(quale));
}

/* Le note di questa versione, quelle brevi che Home Assistant si porta dietro
 * nell'entita'. Sono gia' corte — le taglia lui a 255 caratteri — e si mandano
 * cosi': su un telefono sono la differenza fra premere «Installa» sapendo cosa
 * cambia e premerlo al buio. Quelle lunghe stanno all'indirizzo che viaggia
 * accanto. */
const NOTE_MASSIME = 400;

/**
 * Gli aggiornamenti che aspettano, in ordine di chi si guarda per primo.
 *
 * La plancia va davanti quando c'e'. Gli altri seguono in ordine alfabetico,
 * che e' l'unico ordine stabile fra una lettura e l'altra: per data non si
 * puo', perche' un'entita' `update.` non dice da quando aspetta.
 *
 * @param {Array<object>} stati gli stati di Home Assistant
 */
export function aggiornamentiDaFare(stati) {
  const dentro = Array.isArray(stati) ? stati : [];
  return dentro
    .filter(aspettaDiEssereFatto)
    .map((stato) => ({
      entita: pulito(stato.entity_id),
      nome: nomeDi(stato),
      da: pulito(stato.attributes?.installed_version),
      a: pulito(stato.attributes?.latest_version),
      nostra: eLaNostra(stato),
      installabile: siInstalla(stato.attributes),
      inCorso: staAndando(stato.attributes),
      quanto: aChePunto(stato.attributes),
      stacca: staccaIlFilo(stato),
      /* Dove sono scritte le note di questa versione: e' l'indirizzo che Home
       * Assistant si porta dietro, non uno che indoviniamo noi. */
      note: pulito(stato.attributes?.release_url),
      dettagli: pulito(stato.attributes?.release_summary).slice(0, NOTE_MASSIME),
      /* Se c'e' un segno da provare a prendere — e per un'entita' `update.`
       * c'e' sempre: o l'indirizzo che dichiara, o il marchio
       * dell'integrazione da cui viene. Quale delle due, e se quella strada
       * porti a qualcosa, lo si sa solo chiedendolo; chi chiede tiene il no
       * quando arriva, e non lo richiede piu'.
       *
       * L'indirizzo non viaggia: il telefono chiede «il logo di questa
       * entita'», e dove andarlo a prendere lo sa il ponte. Cosi' quello che
       * si scarica non lo scegli tu. */
      logo: true,
      /* Se le note lunghe si possono chiedere: allora si leggono **dentro
       * l'app**, e l'indirizzo qui sopra resta l'ultima spiaggia. */
      leNote: saLeNote(stato.attributes),
    }))
    .sort((una, altra) => {
      if (una.nostra !== altra.nostra) return una.nostra ? -1 : 1;
      return una.nome.localeCompare(altra.nome);
    });
}

/** Quando l'entita' che si chiede di installare non c'e', o non si installa. */
export class QuestoNoNo extends Error {
  constructor(message) {
    super(message);
    this.code = "not_found";
  }
}

/* Quando **Home Assistant** dice no alle note di una versione.
 *
 * Ha un codice suo perche' e' un caso suo, e senza un codice suo finiva nel
 * mucchio di `unknown_command` — che nell'app vuol dire «gdahome in casa e'
 * piu' vecchio dell'app: aggiorna l'add-on». Qui l'add-on non c'entra niente:
 * e' Home Assistant che quel comando non lo conosce, o l'entita' che per
 * questa versione non sa rispondere. Dire la frase sbagliata manda a
 * aggiornare la cosa sbagliata. */
export class NoteNonDate extends Error {
  constructor(message) {
    super(message);
    this.code = "note_non_date";
  }
}

export class Aggiornamenti {
  constructor({ casa, registro = null, adesso = () => Date.now(), quantoDura = QUANTO_DURA } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.quantoDura = quantoDura;
    this._elenco = null;
    this._lettoIl = 0;
    /* Dove sta il segno di ognuno. Si riempie insieme all'elenco, e non
     * viaggia: il telefono chiede il logo di un'entita', e l'indirizzo lo
     * tiene questa mappa. */
    this._dovIlLogo = new Map();
    /* Di che classe e' ognuno: `firmware` e' quello che distingue un
     * apparecchio da un programma, e serve a capire chi lo porta in casa. */
    this._laClasse = new Map();
    /* Il segno dell'add-on di Zigbee2MQTT, se questa casa ce l'ha. */
    this._diZigbee = "";
    /* Dove sta il segno di chi non ne dichiara uno, quando l'ha fatto
     * chiedere. Si svuota insieme all'elenco: la risposta non dipende solo
     * dall'entita' ma anche da quali add-on ci sono in casa, e quello cambia
     * — chi installa Zigbee2MQTT domani non deve riavviare il ponte per
     * vedere il suo segno. */
    this._diChiE = new Map();
  }

  /* Cosa aspetta di essere aggiornato. L'elenco si tiene per qualche secondo:
   * la schermata si riguarda da sola, e ogni giro e' un `get_states`. */
  async elenco({ forza = false } = {}) {
    const ora = this.adesso();
    if (!forza && this._elenco && ora - this._lettoIl < this.quantoDura) return this._elenco;
    const stati = await this.casa.chiedi({ type: "get_states" });
    const dentro = Array.isArray(stati) ? stati : [];
    this._elenco = aggiornamentiDaFare(dentro);
    this._dovIlLogo = new Map(
      dentro
        .filter(aspettaDiEssereFatto)
        .map((stato) => [pulito(stato.entity_id), ilLogoDi(stato)])
        .filter(([, dove]) => dove !== ""),
    );
    this._laClasse = new Map(
      dentro
        .filter(aspettaDiEssereFatto)
        .map((stato) => [pulito(stato.entity_id), pulito(stato.attributes?.device_class)]),
    );
    /* Si guarda in **tutti** gli stati, non solo in quelli che aspettano: un
     * add-on a posto ha la sua entita' `update.` a `off`, e il segno ce l'ha
     * comunque. */
    this._diZigbee = ilSegnoDiZigbee2mqtt(dentro);
    this._diChiE = new Map();
    this._lettoIl = this.adesso();
    return this._elenco;
  }

  /* L'elenco si e' mosso: la prossima domanda se lo va a riprendere. Si chiama
   * dopo aver fatto partire qualcosa, se no per dieci secondi si continua a
   * rispondere con la fotografia di prima — quella dove l'installazione non
   * era ancora partita. */
  dimentica() {
    this._elenco = null;
    this._lettoIl = 0;
  }

  /**
   * Dove sta il segno di questo aggiornamento, o stringa vuota.
   *
   * Si passa dall'elenco perche' e' li' che l'indirizzo si sa: chiedere il
   * logo di un'entita' che l'elenco non ha nemmeno guardato vorrebbe dire
   * fidarsi del nome che arriva dal telefono, e andare a prendere quello che
   * dice lui. Cosi' invece si va a prendere solo cio' che **questa casa** ha
   * dichiarato, per gli aggiornamenti che aspettano davvero.
   *
   * @param {string} entita l'entita' `update.`
   */
  async doveIlLogo(entita) {
    const quale = pulito(entita);
    if (!quale) return "";
    await this.elenco();
    const dichiarato = this._dovIlLogo.get(quale);
    if (dichiarato) return dichiarato;
    /* Non dichiara niente: si guarda **da dove viene**.
     *
     * Solo per quelli che l'elenco ha: se l'entita' non aspetta nessun
     * aggiornamento non si va a chiedere niente di lei, che e' la stessa
     * regola del logo dichiarato. */
    if (!this._elenco?.some((una) => una.entita === quale)) return "";
    if (this._diChiE.has(quale)) return this._diChiE.get(quale);
    let dove = "";
    try {
      const riga = await this.casa.chiedi({
        type: "config/entity_registry/get",
        entity_id: quale,
      });
      dove = this._chiLoPorta(quale, riga?.platform);
    } catch (errore) {
      /* Un registro che non risponde non e' un guasto da mostrare: e' un logo
       * che non c'e'. Si dice al registro nostro e si va avanti. */
      this.registro.info(`di chi e' ${quale}: ${errore?.message || errore}`);
    }
    this._diChiE.set(quale, dove);
    return dove;
  }

  /* Il segno di chi porta in casa questa entita'.
   *
   * Di solito e' il marchio della sua integrazione. C'e' un caso in cui non
   * va, e l'ha visto subito la prima casa vera: un **firmware** che arriva
   * per **MQTT** e' un dispositivo di Zigbee2MQTT, e mettergli il marchio di
   * MQTT vuol dire far vedere la **strada** che ha fatto invece di chi lo
   * comanda. Tre interruttori Zigbee col logo di MQTT non sono piu' utili di
   * tre «S»: dicono una cosa che non e' quella che stai guardando.
   *
   * Chi li comanda ce l'ha in casa, ed e' l'add-on di Zigbee2MQTT: il suo
   * segno si prende da li', dalla sua macchina, senza andare a chiedere
   * niente fuori. Se quell'add-on non c'e' — Zigbee2MQTT gira da un'altra
   * parte — non si mette niente e resta l'iniziale, che e' meglio del nome
   * sbagliato.
   *
   * @param {string} entita l'entita' `update.`
   * @param {string} integrazione l'integrazione, come la dice il registro
   */
  _chiLoPorta(entita, integrazione) {
    const quale = pulito(integrazione).toLowerCase();
    if (quale === UNA_STRADA && this._laClasse.get(entita) === UN_FIRMWARE) {
      return this._diZigbee;
    }
    return ilMarchioDi(quale);
  }

  /**
   * Le note lunghe di questa versione, in markdown.
   *
   * E' la stessa cosa che la finestra di Home Assistant mostra quando si
   * preme su un aggiornamento: `update/release_notes`, che l'entita' calcola
   * su richiesta — e per questo non sta negli attributi. Chi la sa lo dice col
   * quinto bit di `supported_features`, e a chi non lo dice non si chiede
   * niente: un no prevedibile leggendo un bit non e' un no da far vedere.
   *
   * Si passa dall'elenco per la stessa ragione del logo: si chiedono le note
   * di cio' che **questa casa** ha dichiarato di avere da aggiornare, non di
   * un'entita' che arriva dal telefono.
   *
   * Quello che torna e' testo, e puo' tornare **vuoto**: un'entita' che sa
   * fare `release_notes` e che per questa versione non ha niente da dire
   * risponde `null`, ed e' una risposta, non un guasto. Chi chiama se ne
   * accorge dalla stringa vuota.
   *
   * @param {string} entita l'entita' `update.`
   */
  async note(entita) {
    const quale = pulito(entita);
    const fila = await this.elenco();
    const voce = fila.find((una) => una.entita === quale);
    if (!voce) throw new QuestoNoNo("quell'aggiornamento non c'e' piu'");
    if (!voce.leNote) throw new QuestoNoNo("quell'aggiornamento non ha note da leggere");
    let dette;
    try {
      dette = await this.casa.chiedi({ type: "update/release_notes", entity_id: quale });
    } catch (errore) {
      /* Un no di Home Assistant e' un no **suo**, e si dice com'e': una Home
       * Assistant che quel comando non lo conosce, o un'entita' che dichiara
       * di saperle e poi non risponde. */
      if (errore instanceof RispostaNegativa) {
        throw new NoteNonDate(errore.message || "Home Assistant non ha dato le note");
      }
      throw errore;
    }
    /* Home Assistant risponde col testo, e certe versioni lo incartano. Si
     * prende quello che c'e' e non si inventa niente. */
    const testo = typeof dette === "string" ? dette : pulito(dette?.release_notes ?? dette?.notes);
    return { note: testo, versione: voce.a };
  }

  /**
   * Fa partire un'installazione.
   *
   * Non aspetta che finisca, e non e' pigrizia: `update.install` torna quando
   * l'aggiornamento e' installato, e un add-on ci mette minuti. Qui si aspetta
   * il tanto che basta a sapere che Home Assistant ha preso il comando; se non
   * risponde in tempo si risponde «avviato» lo stesso, perche' e' quello che
   * sta succedendo. A che punto sia lo dice l'entita', al giro dopo.
   */
  async installa(entita) {
    const quale = pulito(entita);
    if (!quale.startsWith(DOMINIO) || quale.length < DOMINIO.length + 1)
      throw new QuestoNoNo("questo non e' un aggiornamento");
    /* Si guarda che quell'entita' ci sia davvero, che aspetti, e che si possa
     * installare di qui: chiamare il servizio su un firmware che si cambia col
     * cacciavite non fa niente e non lo dice a nessuno. L'elenco fresco,
     * perche' un tasto premuto due volte non deve ripartire due volte. */
    const fila = await this.elenco({ forza: true });
    const voce = fila.find((una) => una.entita === quale);
    if (!voce) throw new QuestoNoNo("quell'aggiornamento non c'e' piu'");
    if (!voce.installabile) throw new QuestoNoNo("quell'aggiornamento non si installa da qui");
    if (voce.inCorso) return { avviato: true, gia: true, stacca: voce.stacca };
    await this._comanda(
      { type: "call_service", domain: "update", service: "install", target: { entity_id: quale } },
      `installo ${quale}`,
    );
    this.dimentica();
    return { avviato: true, gia: false, stacca: voce.stacca };
  }

  /**
   * Riavvia Home Assistant.
   *
   * Il filo del ponte cade di sicuro — e' Home Assistant che si spegne — e
   * quindi la risposta vera non arriva quasi mai. Si chiede, si aspetta poco,
   * e si dice che e' stato chiesto: l'app da li' in poi guarda il filo, e
   * quando la casa torna se ne accorge da sola.
   */
  async riavvia() {
    await this._comanda(
      { type: "call_service", domain: "homeassistant", service: "restart" },
      "riavvio Home Assistant",
    );
    this.dimentica();
    return { avviato: true };
  }

  /* Un comando che puo' non rispondere. Il silenzio e la caduta del filo non
   * sono errori: sono la forma che ha, vista da qui, una cosa che e' partita.
   * Un «no» detto da Home Assistant invece e' un no, e si propaga. */
  async _comanda(comando, cosa) {
    try {
      await this.casa.chiedi(comando, { entro: ATTESA_CORTA });
    } catch (errore) {
      /* `RispostaNegativa` e' Home Assistant che ha risposto di no — permesso
       * negato, entita' sconosciuta — e quello va detto. Tutto il resto e' il
       * filo che non ha portato indietro niente, ed e' normale. */
      if (errore instanceof RispostaNegativa) throw errore;
      this.registro.info(`${cosa}: nessuna risposta, ed e' quello che ci si aspetta`);
    }
  }
}
