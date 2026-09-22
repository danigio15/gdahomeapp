/* I varchi di casa: quali contatti guardare, e come stanno (#367, #377).
 *
 * «In verde dovrebbe segnare i sensori contact chiusi e in rosso quelli
 * aperti … almeno a colpo d'occhio so quante finestre sono aperte in questo
 * momento» (#367).
 *
 * «Si potrebbe avere una sezione porte: c'e' gia' Finestre per le tapparelle,
 * ma porte sarebbe utile per notificare lo stato delle porte che hanno sensori,
 * magari che la card principale come per le luci mostri solo il numero di porte
 * aperte» (#377).
 *
 * Sono la stessa domanda, fatta da due persone: dei contatti porta-finestra si
 * vuole sapere quanti sono aperti adesso, e quali. Non e' la sezione Finestre —
 * quella governa le tapparelle, e ha un motore per comandarle — e non e'
 * «Apri porte/cancelli», che manda comandi a serrature e rele'. Qui non si
 * comanda niente: si guarda, ed e' proprio quello che serviva.
 *
 * Non c'e' niente da configurare per cominciare, come per il fumo e per
 * l'aria: un contatto lo dichiara Home Assistant col suo `device_class`, e chi
 * ne ha uno se lo ritrova. La configurazione serve solo a correggere quel
 * rilevamento — togliere il sensore del frigo che qualcuno ha etichettato
 * «door», aggiungere quello che nessuno ha etichettato, dare un nome piu'
 * chiaro di «Contact 4B» — ed e' la stessa forma della scheda dell'aria,
 * perche' e' lo stesso problema.
 *
 * Il verso girato lo dice `verso-aperture.js`, e il giudizio aperto/chiuso lo
 * dice `varchi-in-configurazione.js`: sono gia' scritti, e riscriverli qui
 * vorrebbe dire che prima o poi la pagina e la configurazione si
 * contraddicono.
 */

import { contactEntity, inferriataEntity } from "./shutter-window.js";
import { CLASSI_DEL_VARCO, comeStaIlVarco, eUnVarco } from "./varchi-in-configurazione.js";

const clean = (valore) => String(valore ?? "").trim();

/** Dove si scrive la configurazione dei varchi. */
export const CHIAVE_VARCHI = "cd_varchi";

/** Le classi che contano come varco: le stesse del rilevamento, non una copia. */
export { CLASSI_DEL_VARCO };

/* Il disegno di serie di un varco, dalla classe che Home Assistant gli ha dato.
 *
 * Erano quattro emoji di sistema — porta, finestra, casa diroccata, cartello
 * di lavori — e «icone sempre quelle del catalogo nostro» (#74). Un'emoji
 * cambia faccia da un telefono all'altro, e la casa diroccata come portone del
 * garage non la riconosceva nessuno. Adesso sono nomi del catalogo di casa, e
 * sono solo il PUNTO DI PARTENZA: il disegno vero lo sceglie chi configura la
 * riga, fra i tredici che la scheda gli mette davanti.
 */
const DISEGNI = Object.freeze({
  door: "door",
  window: "window",
  garage_door: "garage-door",
  opening: "doorway",
});

/** Il disegno di serie di un varco, dalla classe di Home Assistant. */
export function disegnoDelVarco(classe) {
  return DISEGNI[clean(classe)] || "door";
}

/**
 * La configurazione, ripulita.
 *
 * `escluse` e `aggiunte` sono elenchi di entita'; `nomi` e' il nome che si e'
 * voluto dare a un contatto quando quello dell'integrazione non dice niente.
 */
export function normalizzaVarchi(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const elenco = (valori) =>
    (Array.isArray(valori) ? valori : [])
      .map(clean)
      .filter((entity) => entity.includes("."))
      .filter((entity, indice, tutti) => tutti.indexOf(entity) === indice);
  const nomi = {};
  for (const [entity, nome] of Object.entries(
    dato.nomi && typeof dato.nomi === "object" ? dato.nomi : {},
  )) {
    const id = clean(entity);
    const scritto = clean(nome);
    if (id.includes(".") && scritto) nomi[id] = scritto;
  }
  return { escluse: elenco(dato.escluse), aggiunte: elenco(dato.aggiunte), nomi };
}

/* I contatti dichiarati dentro le righe delle Finestre.
 *
 * Un contatto scritto nella casella dell'anta di una riga delle Finestre e'
 * una DICHIARAZIONE — l'ha battuta chi abita la casa, e dice «questa e' una
 * finestra» meglio di qualunque etichetta automatica. Vale quanto uno aggiunto
 * a mano nella scheda dei Varchi, e infatti entra dalla stessa porta.
 */
export function contattiDichiaratiNelleFinestre(righe) {
  const presi = [];
  for (const item of Array.isArray(righe) ? righe : [])
    for (const entity of [contactEntity(item), inferriataEntity(item)]) {
      const id = clean(entity);
      if (id.includes(".")) presi.push(id);
    }
  return [...new Set(presi)];
}

/**
 * La configurazione dei varchi, coi contatti delle Finestre fra gli aggiunti.
 *
 * Perche' sta qui e non in chi disegna la Home (la segnalazione #19).
 *
 * Quei contatti li aggiungeva la tessera della Home, da sola, al momento di
 * disegnarsi. La scheda dei Varchi e la pagina Varchi non ne sapevano niente:
 * nella scheda «nessun contatto trovato», e in Home le finestre li'. E siccome
 * la scheda non li elencava, non si potevano nemmeno togliere — l'esclusione
 * vince su tutto, ma vince solo su quello che si vede.
 *
 * Adesso la lista e' una sola e la leggono tutti e tre dallo stesso posto: chi
 * disegna la Home, la pagina, e la scheda dove si mettono le X. Quello che si
 * vede in Home e' quello che la scheda elenca, e una X lo toglie da tutti e
 * due.
 */
export function varchiConLeFinestre(config, righeDelleFinestre) {
  const dichiarati = contattiDichiaratiNelleFinestre(righeDelleFinestre);
  const base = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  if (!dichiarati.length) return base;
  return {
    ...base,
    aggiunte: [...(Array.isArray(base.aggiunte) ? base.aggiunte : []), ...dichiarati],
  };
}

/* ── L'ELENCO DICHIARATO (#74) ────────────────────────────────────────────
 *
 * «La sezione si autocompila, cosa che avevo detto gia' di eliminare, e sotto
 *  compaiono ancora quelle che ho eliminato da sopra. Va cambiata per tutte
 *  quelle che hanno questa cosa: le sezioni si devono comportare tutte alla
 *  stessa maniera.»
 *
 * Questa scheda elencava da se' tutto quello che Home Assistant chiamava
 * «door» o «window», e il cestino non cancellava: ESCLUDEVA, e l'escluso
 * restava scritto in un elenco «Tolti dai conti» sotto. Due difetti in uno —
 * una riga che non hai messo tu, e una che hai tolto e continui a vedere.
 *
 * Adesso e' come Porte e cancelli, come i Carichi, come tutte le altre: una
 * riga la metti tu, e quando la elimini e' eliminata.
 *
 * ── Chi non ha mai aperto la scheda ───────────────────────────────────────
 *
 * `righe` assente vuol dire «questa casa non ha ancora dichiarato niente», e
 * la' si continua a leggere il rilevamento di prima: chi non apre mai la
 * configurazione non deve vedersi sparire la pagina Varchi da sotto i piedi
 * per un aggiornamento. `righe` presente — anche VUOTO — vuol dire «ha
 * dichiarato», e allora comanda quello e basta. E' la differenza fra «non lo
 * so» e «non ne voglio nessuno», ed e' la riga che fa si' che cancellando
 * l'ultimo varco non tornino tutti.
 */

/** Una riga dichiarata, ripulita. Torna `null` se non e' una riga. */
function rigaPulita(voce) {
  if (!voce || typeof voce !== "object") return null;
  const entity = clean(voce.entity);
  const name = clean(voce.name);
  const icon = clean(voce.icon);
  /* Una riga senza entita' e senza nome non e' una riga: e' un `+ Aggiungi`
   * premuto per sbaglio, e riscriverla ogni volta vorrebbe dire una scheda che
   * si riempie di righe vuote. Con il nome invece resta: e' una riga cominciata
   * e non finita, e la scheda lo dice. */
  if (!entity && !name) return null;
  return { entity, name, icon };
}

/**
 * Le righe dichiarate da questa casa, oppure `null` se non ne ha mai
 * dichiarate. `null` non e' l'elenco vuoto: vedi il capitolo qui sopra.
 */
export function righeDichiarate(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  if (!Array.isArray(dato.righe)) return null;
  const viste = new Set();
  const righe = [];
  for (const voce of dato.righe) {
    const riga = rigaPulita(voce);
    if (!riga) continue;
    /* La stessa entita' due volte sarebbe la stessa porta contata due volte,
     * e in cima alla pagina il conto degli aperti direbbe un numero sbagliato.
     * Vince la prima, che e' quella che si e' scritta prima. */
    if (riga.entity && viste.has(riga.entity)) continue;
    if (riga.entity) viste.add(riga.entity);
    righe.push(riga);
  }
  return righe;
}

/** La configurazione con questa riga scritta al suo posto, pronta da salvare. */
export function conLaRiga(config, indice, riga) {
  const righe = [...(righeDichiarate(config) || [])];
  const pulita = rigaPulita(riga) || { entity: "", name: "", icon: "" };
  if (indice >= 0 && indice < righe.length) righe[indice] = pulita;
  else righe.push(pulita);
  return { ...(config && typeof config === "object" ? config : {}), righe };
}

/** La configurazione senza questa riga. Eliminata vuol dire eliminata. */
export function senzaLaRiga(config, indice) {
  const righe = (righeDichiarate(config) || []).filter((_riga, posto) => posto !== indice);
  return { ...(config && typeof config === "object" ? config : {}), righe };
}

/**
 * Le righe che il rilevamento proporrebbe adesso.
 *
 * Serve a due cose, ed e' la stessa risposta: il ripiego di chi non ha mai
 * dichiarato niente, e quello che scrive il tasto «Prendi quelli che Home
 * Assistant ha trovato». Porta dentro tutto quello che la scheda di prima
 * mostrava — i nomi che uno aveva gia' scritto compresi, e senza quelli che
 * aveva gia' escluso — perche' chi aggiorna non deve ritrovarsi a rifare un
 * lavoro che aveva gia' fatto.
 */
export function varchiDaImportare(states = {}, config, nomeDi = (entity) => entity) {
  const scelte = normalizzaVarchi(config);
  const righe = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    if (scelte.escluse.includes(entity)) continue;
    const aggiunto = scelte.aggiunte.includes(entity);
    if (!aggiunto && !eUnVarco(entity, stato)) continue;
    righe.push({
      entity,
      name: scelte.nomi[entity] || clean(nomeDi(entity)) || entity,
      icon: disegnoDelVarco(clean(stato?.attributes?.device_class) || "door"),
    });
  }
  return righe.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Se questa entita' e' un varco di casa.
 *
 * Lo dice la riga che qualcuno ha scritto nella scheda. Finche' nessuno ne ha
 * scritte, lo dice il rilevamento di prima — `device_class` piu' le scelte
 * vecchie — perche' chi non apre mai la configurazione non deve vedersi
 * sparire la pagina per un aggiornamento.
 */
export function eUnVarcoDiCasa(entity, stato, config) {
  const id = clean(entity);
  if (!id) return false;
  const dichiarate = righeDichiarate(config);
  if (dichiarate) return dichiarate.some((riga) => riga.entity === id);
  const scelte = normalizzaVarchi(config);
  if (scelte.escluse.includes(id)) return false;
  if (scelte.aggiunte.includes(id)) return id.includes(".");
  return eUnVarco(id, stato);
}

/** Se c'e' qualcosa da mostrare: almeno un varco con la sua entita'. */
export function varchiConfigurati(states = {}, config) {
  const dichiarate = righeDichiarate(config);
  if (dichiarate) return dichiarate.some((riga) => riga.entity);
  return Object.entries(states || {}).some(([entity, stato]) =>
    eUnVarcoDiCasa(entity, stato, config),
  );
}

/* Quando questo varco ha cambiato stato l'ultima volta.
 *
 * `last_changed` e' l'ultimo cambio di STATO, che e' quello che serve:
 * `last_updated` si muove anche quando cambia solo un attributo, e direbbe
 * «aperta da un minuto» di una porta ferma da ieri. Torna `null` quando Home
 * Assistant non lo dice: una porta senza storia non e' una porta appena
 * aperta. */
export function istanteDelCambio(stato) {
  const quando = Date.parse(clean(stato?.last_changed) || clean(stato?.last_updated) || "");
  return Number.isFinite(quando) ? quando : null;
}

/**
 * I varchi di casa, letti: nome, disegno, e come stanno.
 *
 * L'ordine e' quello che serve a chi guarda: prima gli aperti — sono la
 * risposta alla domanda — poi i muti, che sono una sorveglianza che manca, e
 * in fondo i chiusi, che sono la buona notizia. Dentro ogni gruppo, per nome.
 *
 * `glifo` e' il nome di un disegno del catalogo, non un'emoji: chi disegna lo
 * passa a `disegnoDelCatalogo`. Si chiama ancora cosi' perche' e' il campo che
 * quattro pagine leggono, e rinominarlo era un giro di parole in piu' senza
 * niente in cambio.
 */
export function varchiDiCasa(states = {}, config, invertiti, nomeDi = (entity) => entity) {
  const dichiarate = righeDichiarate(config);
  const scelte = normalizzaVarchi(config);
  const letta = (entity, nome, icona) => {
    const stato = states?.[entity];
    const classe = clean(stato?.attributes?.device_class) || "door";
    return {
      entity,
      name: clean(nome) || clean(nomeDi(entity)) || entity,
      classe,
      glifo: clean(icona) || disegnoDelVarco(classe),
      stato: comeStaIlVarco(entity, stato, invertiti),
      /* Da quando sta cosi' (#406): «l'ultima apertura o cambio stato». Sotto
       * il nome c'era l'entity_id, che chi guarda la pagina non ha mai
       * chiesto — «volendo il nome del sensore potrebbe essere obsoleto». Qui
       * si porta l'istante grezzo di Home Assistant; a dirlo in parole ci
       * pensa chi disegna, che sa che lingua si parla. */
      da: istanteDelCambio(stato),
    };
  };

  const righe = dichiarate
    ? /* Una riga cominciata e non finita — c'e' il nome, manca l'entita' — sta
       * nella scheda e lo dice, ma sulla pagina non ci va: non c'e' niente da
       * mostrare, e nel conto degli aperti sarebbe un muto inventato. */
      dichiarate
        .filter((riga) => riga.entity)
        .map((riga) => letta(riga.entity, riga.name, riga.icon))
    : Object.entries(states || {})
        .filter(([entity, stato]) => eUnVarcoDiCasa(entity, stato, config))
        .map(([entity]) => letta(entity, scelte.nomi[entity], ""));

  const peso = (riga) => (riga.stato === "aperto" ? 0 : riga.stato === "" ? 1 : 2);
  return righe.sort((a, b) => peso(a) - peso(b) || a.name.localeCompare(b.name));
}

/**
 * Il conto: quanti aperti, quanti chiusi, quanti non rispondono.
 *
 * Chi non risponde non conta ne' fra gli aperti ne' fra i chiusi: contarlo
 * chiuso sarebbe una bugia tranquillizzante, ed e' la stessa regola con cui li
 * conta la configurazione.
 */
export function contoDeiVarchi(righe = []) {
  const tutte = Array.isArray(righe) ? righe : [];
  const aperti = tutte.filter((riga) => riga?.stato === "aperto");
  const muti = tutte.filter((riga) => !clean(riga?.stato));
  return {
    aperti: aperti.length,
    chiusi: tutte.length - aperti.length - muti.length,
    muti: muti.length,
    totale: tutte.length,
    nomi: aperti.map((riga) => clean(riga.name)).filter(Boolean),
    /* Le righe aperte, non solo quante sono (#482).
     *
     * La fascia sotto il meteo dice «3 varchi aperti» e mette i nomi nel
     * titolo, e per farlo le serve la stessa lista che la tessera usa per la
     * didascalia. Filtrarla una seconda volta la' vorrebbe dire due regole su
     * cosa conta come aperto, e due regole sulla stessa cosa divergono al
     * primo caso strano: un contatto che non risponde. Qui la regola e' una. */
    aperte: aperti,
  };
}
