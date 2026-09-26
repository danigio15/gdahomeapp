/* Chi c'è in casa, stanza per stanza (#432).
 *
 * «Ci vorrebbe una sezione con i sensori presenza o movimento.»
 *
 * È la stessa domanda dei varchi, fatta su un'altra famiglia di sensori: di un
 * rilevatore di movimento non si vuole sapere che esiste, si vuole sapere dove
 * c'è qualcuno adesso — e, quasi più importante, da quanto una stanza è vuota.
 * Non si comanda niente: si guarda.
 *
 * Come per i varchi, per il fumo e per l'aria non c'è niente da configurare per
 * cominciare. Un rilevatore lo dichiara Home Assistant col suo `device_class`
 * — `motion`, `occupancy`, `presence` — e chi ne ha uno se lo ritrova. La
 * configurazione serve solo a correggere quel rilevamento: togliere il sensore
 * del cortile che qualcuno ha etichettato «motion», aggiungere quello che
 * nessuno ha etichettato, dare un nome più chiaro di «Motion 3C». È la stessa
 * forma della scheda dei varchi e di quella dell'aria, perché è lo stesso
 * problema.
 *
 * ── Movimento e presenza non sono la stessa cosa ────────────────────────
 *
 * Un `motion` dice «adesso si muove qualcosa» e torna a `off` dopo qualche
 * secondo; un `occupancy` o un `presence` dicono «qui c'è qualcuno» e restano
 * accesi finché la stanza è occupata. Il conteggio in cima li tratta uguali —
 * a chi guarda interessa «in tre stanze c'è qualcuno» — ma la riga li
 * distingue col disegno e col tempo: di un movimento conta l'ultimo, di una
 * presenza conta da quanto dura.
 *
 * È puro: nessun DOM, nessuna memoria, nessun orologio — l'adesso lo passa chi
 * chiama.
 */

import { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga } from "./elenco-dichiarato.js";

const pulito = (valore) => String(valore ?? "").trim();

/** Dove si scrive la configurazione della presenza. */
export const CHIAVE_PRESENZA = "cd_presenza";

/* Le classi che contano come rilevatore. `moving` c'è perché qualche
 * integrazione la usa per i sensori a radar, e `vibration` no: una lavatrice
 * che vibra non è qualcuno che passa. */
export const CLASSI_DELLA_PRESENZA = Object.freeze(["motion", "occupancy", "presence", "moving"]);

/* Il disegno di serie di un rilevatore, dalla classe di Home Assistant.
 *
 * Erano due emoji di sistema, e «icone sempre quelle del catalogo nostro»
 * (#74): cambiano faccia da un telefono all'altro, e un mmWave disegnato come
 * un omino che corre non lo riconosce nessuno. Adesso sono nomi del catalogo
 * di casa, e sono solo il punto di partenza: il disegno vero lo sceglie chi
 * configura la riga.
 *
 * Chi dice «c'e' qualcuno» e chi dice «si e' mosso» non sono la stessa
 * notizia, e vederlo si capisce prima di leggerlo. */
const DISEGNI = Object.freeze({
  motion: "motion",
  moving: "motion",
  occupancy: "person",
  presence: "radar",
});

/** Il disegno di serie di un rilevatore, dalla classe di Home Assistant. */
export function disegnoDelRilevatore(classe) {
  return DISEGNI[pulito(classe)] || "motion";
}

/**
 * Se un rilevatore dice «adesso si muove» o «qui c'è qualcuno».
 *
 * Serve a chi disegna: di un movimento si scrive quando è stato l'ultimo, di
 * una presenza da quanto dura. Sono due frasi diverse per due sensori diversi.
 */
export function eUnaPresenzaStabile(classe) {
  const nome = pulito(classe);
  return nome === "occupancy" || nome === "presence";
}

/** Se questa entità è un rilevatore, per quello che ne dice Home Assistant. */
export function eUnRilevatore(entity, stato) {
  if (!pulito(entity).startsWith("binary_sensor.")) return false;
  return CLASSI_DELLA_PRESENZA.includes(pulito(stato?.attributes?.device_class));
}

/**
 * La configurazione, ripulita.
 *
 * `escluse` e `aggiunte` sono elenchi di entità; `nomi` è il nome che si è
 * voluto dare a un rilevatore quando quello dell'integrazione non dice niente.
 * È la stessa forma dei varchi, e non per simmetria: è la stessa scheda, e chi
 * ne ha imparata una sa già usare l'altra.
 */
export function normalizzaPresenza(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const elenco = (valori) =>
    (Array.isArray(valori) ? valori : [])
      .map(pulito)
      .filter((entity) => entity.includes("."))
      .filter((entity, indice, tutti) => tutti.indexOf(entity) === indice);
  const nomi = {};
  for (const [entity, nome] of Object.entries(
    dato.nomi && typeof dato.nomi === "object" ? dato.nomi : {},
  )) {
    const id = pulito(entity);
    const scritto = pulito(nome);
    if (id.includes(".") && scritto) nomi[id] = scritto;
  }
  return { escluse: elenco(dato.escluse), aggiunte: elenco(dato.aggiunte), nomi };
}

/* ── L'ELENCO DICHIARATO (#74) ────────────────────────────────────────────
 *
 * La regola sta in `elenco-dichiarato.js`, ed è la stessa dei Varchi, delle
 * Batterie e delle Macchine: una riga la metti tu, e quando la elimini è
 * eliminata. Qui si riespone com'è, così chi legge la presenza trova tutto da
 * una porta sola. */
export { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga };

/**
 * I rilevatori che il rilevamento proporrebbe adesso.
 *
 * Serve a due cose, ed è la stessa risposta: il ripiego di chi non ha mai
 * dichiarato niente, e quello che scrive il tasto «prendi quelli che Home
 * Assistant ha trovato». Porta dentro i nomi già scritti e lascia fuori quelli
 * già esclusi: chi aggiorna non deve rifare un lavoro che aveva già fatto.
 */
export function rilevatoriDaImportare(states = {}, config, nomeDi = (entity) => entity) {
  const scelte = normalizzaPresenza(config);
  const righe = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    if (scelte.escluse.includes(entity)) continue;
    const aggiunto = scelte.aggiunte.includes(entity);
    if (!aggiunto && !eUnRilevatore(entity, stato)) continue;
    righe.push({
      entity,
      name: scelte.nomi[entity] || pulito(nomeDi(entity)) || entity,
      icon: disegnoDelRilevatore(pulito(stato?.attributes?.device_class) || "motion"),
    });
  }
  return righe.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Se questa entità è un rilevatore di questa casa.
 *
 * Lo dice la riga che qualcuno ha scritto nella scheda. Finché nessuno ne ha
 * scritte, lo dice il rilevamento di prima.
 */
export function eUnRilevatoreDiCasa(entity, stato, config) {
  const id = pulito(entity);
  if (!id) return false;
  const dichiarate = righeDichiarate(config);
  if (dichiarate) return dichiarate.some((riga) => riga.entity === id);
  const scelte = normalizzaPresenza(config);
  if (scelte.escluse.includes(id)) return false;
  if (scelte.aggiunte.includes(id)) return id.includes(".");
  return eUnRilevatore(id, stato);
}

/** Se c'è qualcosa da mostrare: almeno un rilevatore con la sua entità. */
export function presenzaConfigurata(states = {}, config) {
  const dichiarate = righeDichiarate(config);
  if (dichiarate) return dichiarate.some((riga) => riga.entity);
  return Object.entries(states || {}).some(([entity, stato]) =>
    eUnRilevatoreDiCasa(entity, stato, config),
  );
}

/* Gli stati che vogliono dire «non lo so». Un rilevatore muto non è una stanza
 * vuota: è una sorveglianza che manca, ed è una notizia diversa. */
const MUTI = new Set(["unavailable", "unknown", "none", ""]);

/* E «non c'è» non è «non risponde».
 *
 * Dal campo: un sensore appena abbinato, messo in Presenza, che diceva «Non
 * risponde da 2 minuti» — e chi legge va a guardare la batteria, il segnale,
 * la distanza dal ripetitore. Quella frase però la dice anche una riga che
 * punta a un'entità che in Home Assistant NON C'È: un dispositivo tolto e
 * rimesso, un identificativo cambiato sotto i piedi. Sono due guasti diversi e
 * si riparano in due posti diversi — uno col dispositivo in mano, l'altro
 * nella scheda della configurazione — e dirli con la stessa parola manda a
 * cercare dalla parte sbagliata.
 *
 * La distinzione la faceva già il clima (`modo-del-clima.js`: «muto» quando lo
 * stato c'è e non dice niente, «assente» quando lo stato non c'è affatto).
 * Qui è la stessa, con le stesse due parole. */
export const ASSENTE = "assente";

/** Come sta un rilevatore: `attivo`, `libero`, `assente`, o «» se non risponde. */
export function comeStaIlRilevatore(stato) {
  /* Nessuno stato affatto: quell'entità Home Assistant non ce l'ha. */
  if (stato === null || stato === undefined) return ASSENTE;
  const grezzo = pulito(stato?.state).toLowerCase();
  if (MUTI.has(grezzo)) return "";
  return grezzo === "on" ? "attivo" : "libero";
}

/* Da quando sta così. `last_changed` è l'ultimo cambio di STATO, che è quello
 * che serve: `last_updated` si muove anche quando cambia solo un attributo, e
 * direbbe «libera da un minuto» di una stanza vuota da ieri. */
export function istanteDelCambio(stato) {
  const quando = Date.parse(pulito(stato?.last_changed) || pulito(stato?.last_updated) || "");
  return Number.isFinite(quando) ? quando : null;
}

/**
 * I rilevatori di casa, letti: nome, classe, come stanno e da quando.
 *
 * L'ordine è quello che serve a chi guarda: prima chi rileva qualcuno — è la
 * risposta alla domanda — poi i muti, che sono una sorveglianza che manca, e in
 * fondo le stanze libere, che sono la quiete. Dentro ogni gruppo, per nome.
 */
export function presenzaDiCasa(
  states = {},
  config,
  nomeDi = (entity) => entity,
  stanzaDi = () => "",
) {
  const dichiarate = righeDichiarate(config);
  const scelte = normalizzaPresenza(config);
  const letta = (entity, nome, icona) => {
    const stato = states?.[entity];
    const classe = pulito(stato?.attributes?.device_class) || "motion";
    return {
      entity,
      name: pulito(nome) || pulito(nomeDi(entity)) || entity,
      /* La stanza di Home Assistant, quando la sa: e' l'identita' del posto,
       * e serve al conto qui sotto. */
      stanza: pulito(stanzaDi(entity)),
      classe,
      glifo: pulito(icona) || disegnoDelRilevatore(classe),
      stabile: eUnaPresenzaStabile(classe),
      stato: comeStaIlRilevatore(stato),
      da: istanteDelCambio(stato),
    };
  };

  const righe = dichiarate
    ? /* Una riga cominciata e non finita — c'e' il nome, manca l'entita' — sta
       * nella scheda e lo dice, ma sulla pagina non ci va: nel conto delle
       * stanze occupate sarebbe una sorveglianza inventata. */
      dichiarate
        .filter((riga) => riga.entity)
        .map((riga) => letta(riga.entity, riga.name, riga.icon))
    : Object.entries(states || {})
        .filter(([entity, stato]) => eUnRilevatoreDiCasa(entity, stato, config))
        .map(([entity]) => letta(entity, scelte.nomi[entity], ""));

  /* Prima chi rileva qualcuno, poi le sorveglianze che mancano — mute o
   * assenti, che sono due modi di non guardare — e in fondo le stanze libere,
   * che sono la quiete. */
  const peso = (riga) =>
    riga.stato === "attivo" ? 0 : riga.stato === "" || riga.stato === ASSENTE ? 1 : 2;
  return righe.sort((a, b) => peso(a) - peso(b) || a.name.localeCompare(b.name));
}

/**
 * Il conto: quante stanze hanno qualcuno, quante sono libere, quante mute.
 *
 * Si contano i POSTI, non i rilevatori (#549).
 *
 * «Ho due sensori sulla stessa stanza e mi dice in due stanze c'è qualcuno.
 *  Ovviamente sono assegnati sulla stessa stanza.» Il conto guardava una riga
 * alla volta: due rilevatori in salotto facevano due stanze occupate, e la
 * didascalia scriveva «Salotto · Salotto». Una stanza grande, o un corridoio
 * con due sensori ai due capi, è il caso normale — non l'eccezione.
 *
 * Il posto è la STANZA, e solo in mancanza di quella il nome.
 *
 * Contarlo per nome non bastava: «non posso dare lo stesso nome se i sensori
 * sono diversi, uno prossimità è l'altro presenza, è utile sapere quale dei
 * due». Ha ragione — chiedere di chiamarli uguale vuol dire buttare via
 * proprio l'informazione che distingue i due rilevatori. Ma la stanza lo dice
 * senza toccare i nomi: due rilevatori nella stessa stanza di Home Assistant
 * sono lo stesso posto anche se si chiamano in due modi diversi.
 *
 * Il nome resta il ripiego per chi la stanza non ce l'ha — Home Assistant non
 * obbliga ad assegnarla — e li' vale la regola di prima: chiamarli uguale
 * basta a farne un posto solo. E il verdetto del posto è il più forte dei suoi
 * rilevatori: basta che uno rilevi perché lì ci sia qualcuno, e perché sia
 * libero devono dirlo tutti quelli che rispondono.
 *
 * Chi non risponde non conta né fra le attive né fra le libere: contarlo libero
 * sarebbe una bugia tranquillizzante, ed è la stessa regola con cui li conta la
 * configurazione dei varchi. Un posto è muto solo se non ha nessun'altra
 * lettura: un sensore giù accanto a uno che risponde non spegne la risposta.
 */
export function contoDellaPresenza(righe = []) {
  const posti = new Map();
  for (const riga of Array.isArray(righe) ? righe : []) {
    const nome = pulito(riga?.name);
    const stanza = pulito(riga?.stanza);
    /* Senza stanza e senza nome non si può dire che due righe siano lo stesso
     * posto: l'entità le tiene distinte, che è la risposta prudente. */
    const chiave = stanza
      ? `stanza:${stanza.toLocaleLowerCase()}`
      : nome
        ? `nome:${nome.toLocaleLowerCase()}`
        : `entita:${pulito(riga?.entity)}`;
    const posto = posti.get(chiave) || { nome: stanza || nome, attivo: false, libero: false };
    if (riga?.stato === "attivo") posto.attivo = true;
    else if (riga?.stato === "libero") posto.libero = true;
    if (!posto.nome && nome) posto.nome = nome;
    posti.set(chiave, posto);
  }
  const tutti = [...posti.values()];
  const attivi = tutti.filter((posto) => posto.attivo);
  return {
    attivi: attivi.length,
    liberi: tutti.filter((posto) => !posto.attivo && posto.libero).length,
    muti: tutti.filter((posto) => !posto.attivo && !posto.libero).length,
    totale: tutti.length,
    nomi: attivi.map((posto) => posto.nome),
  };
}

/**
 * Da quanto l'ultima volta che si è mosso qualcosa, fra i rilevatori che
 * rispondono.
 *
 * È il numero che risponde a «è passato qualcuno mentre non c'ero»: con la casa
 * tutta libera, il rilevatore che ha cambiato stato più di recente è quello che
 * si è appena spento, cioè l'ultimo movimento. Torna `null` quando nessuno ha
 * una storia da raccontare.
 *
 * Chi non risponde resta fuori, e non è un dettaglio: un rilevatore che passa a
 * `unavailable` cambia stato in quel momento, e contarlo voleva dire scrivere
 * «Ultimo movimento · appena adesso» a una casa in cui l'unica cosa successa
 * era un sensore andato giù. È la stessa regola con cui un muto non viene
 * contato fra le stanze libere: un'assenza di notizie non è una notizia.
 */
export function ultimoMovimento(righe = []) {
  const istanti = righe
    .filter((riga) => riga?.stato !== "")
    .map((riga) => riga?.da)
    .filter((quando) => Number.isFinite(quando));
  return istanti.length ? Math.max(...istanti) : null;
}
