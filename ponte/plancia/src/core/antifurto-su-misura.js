/* L'inserimento quando la centrale non e' una centrale (#413).
 *
 * «Possibilita' di configurare i comandi di inserimento e modalita' sia nel
 * comando da lanciare che nel nome icona. Utilizzando un dispositivo tramite
 * esphome non ho il classico control_panel_alarm.»
 *
 * La sezione Sicurezza sa leggere una centrale vera: `supported_features` dice
 * quali inserimenti accetta, `code_format` se chiede un codice, e i tasti
 * chiamano i servizi di `alarm_control_panel`. Chi si e' fatto l'antifurto con
 * ESPHome quell'entita' non ce l'ha: ha uno script che inserisce, un
 * `input_select` con le modalita', un paio di `switch`. Tutta roba che Home
 * Assistant sa comandare benissimo — solo che nessuno la dichiara come una
 * centrale, e la fila di tasti restava quella finta di ripiego, che chiamava
 * servizi che non esistono.
 *
 * Qui i tasti li descrive chi ha la casa: un nome, un'icona, l'entita' da
 * chiamare, e — se serve — dove leggere se quella modalita' e' inserita adesso.
 * Non si indovina niente: il servizio si ricava dal dominio dell'entita',
 * perche' quello Home Assistant lo dichiara, e il resto e' scritto.
 *
 * Il modulo e' puro: dice cosa chiamare e chi e' acceso, e non chiama niente.
 */

import { actionCatalogMatch } from "./personalization-catalog.js";
import { ilCodiceCombacia, ilCodiceServe, normalizzaIlCodice } from "./codice-a-tastierino.js";

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

/** Dove si scrivono i modi su misura. */
export const CHIAVE_ANTIFURTO_SU_MISURA = "cd_antifurto_su_misura";

/* Che cosa sa eseguire ogni dominio quando gli si dice «inserisci cosi'».
 *
 * Solo domini che un antifurto fatto in casa usa davvero. Chiamare `turn_on`
 * su un `button` non da' errore a schermo — Home Assistant risponde che quel
 * servizio non c'e', il messaggio resta nella console e non succede niente —
 * ed e' esattamente il tasto rotto che questa tabella evita. */
const SERVIZI = Object.freeze({
  script: "turn_on",
  scene: "turn_on",
  button: "press",
  input_button: "press",
  automation: "trigger",
  switch: "turn_on",
  input_boolean: "turn_on",
  light: "turn_on",
  select: "select_option",
  input_select: "select_option",
  alarm_control_panel: "alarm_arm_away",
});

/** Il dominio di un'entita', o "" se non e' un'entita'. */
function dominioDi(entity) {
  const id = pulito(entity);
  const punto = id.indexOf(".");
  return punto > 0 ? id.slice(0, punto).toLowerCase() : "";
}

/** I domini che si possono mettere su un tasto dell'antifurto. */
export const DOMINI_SU_MISURA = Object.freeze(Object.keys(SERVIZI));

/** Se questa entita' e' una di quelle che chiedono anche l'opzione. */
export function vuoleUnOpzione(entity) {
  return ["select", "input_select"].includes(dominioDi(entity));
}

/**
 * Un modo su misura ripulito, o `null` se non ha niente da premere.
 *
 * Senza entita' il tasto non farebbe niente, e un tasto che non fa niente non
 * deve esistere: e' la stessa regola dei tasti della centrale vera.
 *
 * E un menu senza la voce da scegliere e' la stessa cosa detta in un altro
 * modo: `select_option` senza l'opzione non e' una chiamata, e il tasto
 * sarebbe li' a farsi premere senza fare niente. Capita alla prima riga
 * appena scritta, dove il campo dell'opzione compare solo dopo che l'entita'
 * c'e': meglio un tasto che non compare ancora di uno che compare e tace.
 */
export function normalizzaModoSuMisura(grezzo, indice = 0) {
  if (!grezzo || typeof grezzo !== "object") return null;
  const entita = pulito(grezzo.entita);
  if (!entita.includes(".") || !SERVIZI[dominioDi(entita)]) return null;
  const id = pulito(grezzo.id) || `su-misura-${indice + 1}`;
  const opzione = pulito(grezzo.opzione);
  if (vuoleUnOpzione(entita) && !opzione) return null;
  return Object.freeze({
    id,
    nome: pulito(grezzo.nome),
    icona: pulito(grezzo.icona),
    entita,
    opzione,
    /* Dove si legge se e' inserito adesso. In mancanza si guarda l'entita'
     * stessa: per uno `switch` o un `input_select` e' gia' la risposta, per
     * uno `script` non lo e' — e allora nessun tasto resta acceso, che e'
     * meglio di uno acceso a caso. */
    stato: pulito(grezzo.stato) || entita,
    valore: pulito(grezzo.valore) || opzione,
    /* Il codice che questo tasto chiede prima di partire (#336).
     *
     * «Oltre a scegliere l'entita' si possa inserire un pin ed esca il
     * tastierino, come succede gia' nella sezione aperture mettendo una
     * serratura.» Una centrale vera il codice lo dichiara lei e lo verifica
     * Home Assistant; uno script e un interruttore un codice non lo
     * accettano, quindi l'unico posto dove chiederlo e' qui, prima di
     * mandare il comando — esattamente come per le aperture.
     *
     * Facoltativo: chi non lo scrive preme e basta, come ha sempre fatto. */
    pin: normalizzaIlCodice(grezzo.pin),
    /* Il codice c'e' ma lo tiene il ponte: e' il tasto come arriva a un
     * pannello a muro entrato con un utente che la plancia di origine non la
     * vede (`MURO_FONTE`). Il tastierino esce lo stesso, e il codice scritto
     * lo controlla il ponte (`MURO_CODICE`): qui non arriva mai. */
    codiceAlPonte: !normalizzaIlCodice(grezzo.pin) && grezzo.codiceAlPonte === true,
  });
}

/** Se questo tasto, prima di partire, chiede il codice. */
export function ilModoChiedeIlCodice(modo) {
  return ilCodiceServe(modo?.pin) || modo?.codiceAlPonte === true;
}

/** Il codice digitato fa partire questo tasto? Un tasto senza codice parte sempre. */
export function ilCodiceApreIlModo(modo, digitato) {
  /* Un codice tenuto dal ponte qui non si sa: apre solo la sua risposta. */
  if (modo?.codiceAlPonte === true && !ilCodiceServe(modo?.pin)) return false;
  return ilCodiceCombacia(modo?.pin, digitato);
}

/** L'elenco pulito, da qualunque cosa ci sia in memoria. */
export function normalizzaModiSuMisura(stored) {
  const grezzi = Array.isArray(stored) ? stored : [];
  const visti = new Set();
  const modi = [];
  for (const [indice, grezzo] of grezzi.entries()) {
    const modo = normalizzaModoSuMisura(grezzo, indice);
    if (!modo || visti.has(modo.id)) continue;
    visti.add(modo.id);
    modi.push(modo);
  }
  return modi;
}

/**
 * La chiamata da fare per questo tasto: dominio, servizio, entita' e dati.
 *
 * @returns {{domain:string,service:string,entity:string,data:object}|null}
 */
export function chiamataDelModo(modo) {
  const pulita = modo && modo.entita ? modo : normalizzaModoSuMisura(modo);
  if (!pulita) return null;
  const domain = dominioDi(pulita.entita);
  const service = SERVIZI[domain];
  if (!service) return null;
  const data = { entity_id: pulita.entita };
  if (service === "select_option") {
    if (!pulita.opzione) return null;
    data.option = pulita.opzione;
  }
  return Object.freeze({ domain, service, entity: pulita.entita, data: Object.freeze(data) });
}

/* Se questo valore vuol dire «inserito». Senza un valore scritto vale la
 * regola di Home Assistant: `on` e' acceso, tutto il resto no. */
function eAcceso(modo, stato) {
  const adesso = minuscolo(stato);
  if (!adesso || ["unavailable", "unknown", "none"].includes(adesso)) return false;
  const atteso = minuscolo(modo.valore);
  return atteso ? adesso === atteso : adesso === "on";
}

/**
 * Quale dei modi su misura e' inserito adesso, o "".
 *
 * Il primo che risponde di si'. Se due dicono di essere inseriti insieme
 * qualcosa non torna nella configurazione, e accendere il primo e' meglio che
 * accenderne due: su un antifurto una fila con due tasti accesi non si sa
 * leggere.
 */
export function modoSuMisuraAcceso(modi = [], states = {}) {
  for (const modo of modi) {
    const stato = states?.[modo.stato]?.state;
    if (eAcceso(modo, stato)) return modo.id;
  }
  return "";
}

/* Il prefisso che distingue un tasto su misura da un servizio della centrale.
 *
 * I tasti dell'antifurto — quelli della sezione e quelli della tessera in Home
 * — passano tutti da `promptPinAndSet`, che riceve il nome del servizio. Un
 * tasto su misura non ha un servizio di `alarm_control_panel` da mandare: manda
 * il proprio nome marcato cosi', e chi riceve sa di dover guardare qui invece
 * che nella centrale. Una porta sola, e le due file restano quello che sono. */
export const PREFISSO_SU_MISURA = "dm-su-misura:";

/** L'identificativo dentro un servizio marcato, o "" se non lo e'. */
export function modoDalServizio(servizio) {
  const testo = pulito(servizio);
  return testo.startsWith(PREFISSO_SU_MISURA) ? testo.slice(PREFISSO_SU_MISURA.length) : "";
}

/**
 * I modi su misura nella forma dei tasti dell'antifurto.
 *
 * Stessa forma di `ALARM_MODES`, cosi' da qui in poi sono tasti come gli altri:
 * la sezione e la tessera della Home li disegnano senza sapere da dove
 * arrivano, ed e' l'unico modo perche' le due file restino uguali.
 */
export function tastiSuMisura(stored) {
  return normalizzaModiSuMisura(stored).map((modo) =>
    Object.freeze({
      mode: modo.id,
      bit: 0,
      service: `${PREFISSO_SU_MISURA}${modo.id}`,
      state: "",
      icon: actionCatalogMatch(modo.icona)?.glyph || "\u{1F6E1}\u{FE0F}",
      /* Il nome dell'icona scelta, non il glifo: chi disegna lo passa al
       * motore delle icone, che il disegno lo trova da se'. */
      icona: modo.icona,
      label: modo.nome || modo.id,
      /* Sotto il nome niente: l'entita' che lo fa partire
       * («script.attiva_zone_1») e' lunga e usciva dal tasto (#346). Il
       * widget della Home la toglieva gia' (#303); ora e' cosi' ovunque. */
      hint: "",
      suMisura: true,
    }),
  );
}

/* ─── Quando e' scattato ────────────────────────────────────────────────
 *
 * «Prevedi un'entità per inserire allarme antifurto, ho uno switch che mi
 * controlla se è scattato antifurto.» Chi si e' fatto l'antifurto da se'
 * spesso ha un interruttore — o un sensore — che si accende quando suona: la
 * centrale vera lo direbbe con `triggered`, questo lo dice con un `on`. Qui
 * lo si dichiara una volta: quale entita', quale valore vuol dire «scattato»
 * (di solito `on`), e facoltativi la sirena e da dove leggere la zona.
 *
 * Lo leggono la sezione Sicurezza, la tessera della Home, il pannello a muro e
 * la casa, che manda la notifica urgente anche a plancia chiusa. Per chi ha la
 * plancia di prima vale anche la casella storica dell'interruttore
 * dell'antifurto (`dm.home_interruttore_antifurto`): il salvataggio scrive
 * anche quella, cosi' le due strade dicono la stessa cosa. */

/** Dove si scrive. */
export const CHIAVE_ANTIFURTO_SCATTATO = "cd_antifurto_scattato";

/** La casella storica dell'interruttore dell'antifurto. */
export const CASELLA_DELLO_SCATTATO = "dm.home_interruttore_antifurto";

/** I domini che possono dire «scattato». */
export const DOMINI_DELLO_SCATTATO = Object.freeze([
  "switch",
  "binary_sensor",
  "input_boolean",
  "sensor",
  "siren",
  "light",
]);

/** I domini di una sirena, e il servizio che la spegne. */
export const SPEGNI_LA_SIRENA = Object.freeze({
  siren: "turn_off",
  switch: "turn_off",
  input_boolean: "turn_off",
  light: "turn_off",
});

/**
 * Lo «scattato» ripulito, o `null` se non c'e' un'entita'.
 *
 * `ripiego`: l'entita' della casella storica, per chi non ha ancora scritto
 * niente qui ma l'aveva mappata nella plancia di prima.
 */
export function normalizzaScattato(grezzo, ripiego = "") {
  let dato = grezzo;
  if (typeof dato === "string") {
    try {
      dato = JSON.parse(dato);
    } catch (_errore) {
      dato = null;
    }
  }
  const d = dato && typeof dato === "object" && !Array.isArray(dato) ? dato : {};
  const entita = pulito(d.entita) || pulito(ripiego);
  if (!entita.includes(".") || !DOMINI_DELLO_SCATTATO.includes(dominioDi(entita))) return null;
  const sirena = pulito(d.sirena);
  const zona = pulito(d.zona);
  return Object.freeze({
    entita,
    valore: pulito(d.valore),
    sirena: sirena.includes(".") && SPEGNI_LA_SIRENA[dominioDi(sirena)] ? sirena : "",
    zona: zona.includes(".") ? zona : "",
  });
}

/* Se uno stato vuol dire «scattato»: il valore scritto, oppure `on`. */
export function valeScattato(scattato, stato) {
  if (!scattato) return false;
  const adesso = minuscolo(stato);
  if (!adesso || ["unavailable", "unknown", "none"].includes(adesso)) return false;
  const atteso = minuscolo(scattato.valore);
  return atteso ? adesso === atteso : adesso === "on" || adesso === "triggered";
}

/** Se l'antifurto su misura e' scattato adesso. */
export function eScattatoAdesso(scattato, states = {}) {
  if (!scattato) return false;
  return valeScattato(scattato, states?.[scattato.entita]?.state);
}

/** Se la sirena dichiarata suona adesso. */
export function sirenaAccesa(scattato, states = {}) {
  if (!scattato?.sirena) return false;
  return minuscolo(states?.[scattato.sirena]?.state) === "on";
}

const APERTURE_E_MOVIMENTO = new Set([
  "door",
  "window",
  "garage_door",
  "opening",
  "motion",
  "occupancy",
  "presence",
  "vibration",
  "tamper",
]);

/**
 * Che cosa l'ha fatto scattare, detto con un nome.
 *
 * Se e' dichiarata un'entita' della zona: il suo stato se e' una parola (un
 * `sensor` che dice «Finestra cucina»), il suo nome se e' un sensore acceso.
 * Altrimenti l'ultima porta, finestra o movimento che si e' acceso nei dieci
 * minuti prima: quasi sempre e' quello. `""` se non si sa.
 */
export function zonaDelloScattato(scattato, states = {}, { adesso = Date.now() } = {}) {
  const nome = (id, st) =>
    pulito(st?.attributes?.friendly_name) || id.split(".")[1]?.replace(/_/g, " ") || id;
  if (scattato?.zona) {
    const st = states?.[scattato.zona];
    if (st) {
      const valore = pulito(st.state);
      if (dominioDi(scattato.zona) === "binary_sensor")
        return valore === "on" ? nome(scattato.zona, st) : "";
      if (valore && !["unknown", "unavailable", "none", "off", "on"].includes(valore.toLowerCase()))
        return valore.slice(0, 40);
      if (valore === "on") return nome(scattato.zona, st);
    }
  }
  let migliore = null;
  for (const [id, st] of Object.entries(states || {})) {
    if (dominioDi(id) !== "binary_sensor" || st?.state !== "on") continue;
    if (!APERTURE_E_MOVIMENTO.has(st?.attributes?.device_class)) continue;
    const quando = Date.parse(st.last_changed || "");
    if (!Number.isFinite(quando) || adesso - quando > 10 * 60 * 1000) continue;
    if (!migliore || quando > migliore.quando) migliore = { id, st, quando };
  }
  return migliore ? nome(migliore.id, migliore.st).slice(0, 40) : "";
}

/* Il tasto che disinserisce, fra quelli su misura: quello che si chiama cosi'. */
const DISINSERITO = /disinser|disarm|spent|off\b|libero/i;

/** Il modo su misura che disinserisce, o `null`. */
export function modoCheDisinserisce(modi = []) {
  return modi.find((modo) => DISINSERITO.test(`${modo.id} ${modo.nome}`)) || null;
}

/* Il tasto che inserisce «fuori casa»: totale, fuori, away; altrimenti il
 * primo che non disinserisce. */
const TOTALE = /total|fuori|away|tutt|esco|uscit/i;

/** Il modo su misura con cui inserire dalla notifica, o `null`. */
export function modoPerInserire(modi = []) {
  const inserimenti = modi.filter((modo) => !DISINSERITO.test(`${modo.id} ${modo.nome}`));
  return (
    inserimenti.find((modo) => TOTALE.test(`${modo.id} ${modo.nome}`)) || inserimenti[0] || null
  );
}
