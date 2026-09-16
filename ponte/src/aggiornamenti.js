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

export class Aggiornamenti {
  constructor({ casa, registro = null, adesso = () => Date.now(), quantoDura = QUANTO_DURA } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.quantoDura = quantoDura;
    this._elenco = null;
    this._lettoIl = 0;
  }

  /* Cosa aspetta di essere aggiornato. L'elenco si tiene per qualche secondo:
   * la schermata si riguarda da sola, e ogni giro e' un `get_states`. */
  async elenco({ forza = false } = {}) {
    const ora = this.adesso();
    if (!forza && this._elenco && ora - this._lettoIl < this.quantoDura) return this._elenco;
    const stati = await this.casa.chiedi({ type: "get_states" });
    this._elenco = aggiornamentiDaFare(Array.isArray(stati) ? stati : []);
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
