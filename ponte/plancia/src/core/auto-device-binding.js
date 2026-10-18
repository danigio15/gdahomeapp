/* L'auto che arriva da un'integrazione, gia' fatta.
 *
 * «Vogliamo cercare di fare la stessa cosa integrazione anche su auto, cosi'
 * viene piu' pulita.» E' il giro degli elettrodomestici e dei robot: si sceglie
 * l'integrazione, si sceglie il dispositivo, e la vettura nasce con le caselle
 * gia' piene invece di battere venti entity_id a mano.
 *
 * Chi guida l'assegnazione e' il `device_class` quando c'e' — e' quello che
 * Home Assistant dichiara, non quello che si indovina — e solo dove non basta
 * si guardano le parole. Le parole si guardano in tutte le lingue che le
 * integrazioni delle auto usano davvero: il costruttore coreano scrive
 * «Fuel level», quello tedesco «Reichweite», quello italiano «Autonomia».
 *
 * Una casella la si riempie una volta sola: la stessa entita' non puo' essere
 * insieme l'odometro e l'ultimo viaggio, e la prima domanda che se la prende
 * la toglie dal mazzo per le successive.
 *
 * Un'auto di GdAAuto, la sorella che parla con le auto, non si indovina: si
 * riconosce dalla chiave (`CHIAVI_DI_GDAAUTO`), prima di ogni parola.
 */
/* Il nucleo non importa il guscio: una riga sola, come fanno le sorelle. */
const clean = (value) => String(value ?? "").trim();

import { eUnaLettera } from "./stato-della-ricarica.js";
import { parlaDelCavo } from "./wallbox-device-binding.js";

/* ── GdAAuto: la chiave, non le parole ───────────────────────────────── */

/* Le entita' di GdAAuto, per chiave.
 *
 * E' il contratto delle tre sorelle (`docs/DATI-AUTO.md` di GdAAuto): ogni
 * dato che l'auto manda e' un'entita' con `platform: gdaauto` e la sua chiave
 * in `translation_key`, e qui ogni chiave ha la sua casella, con lo stesso
 * nome e lo stesso significato. Il nome mostrato lo sceglie la lingua di Home
 * Assistant e l'`entity_id` il nome che uno da' all'auto: la chiave no.
 *
 * L'ordine conta dove due chiavi dicono la stessa casella: lo stato della
 * ricarica prima di «in carica», la serratura prima delle portiere — la
 * seconda vale solo quando la prima manca. */
export const CHIAVI_DI_GDAAUTO = Object.freeze([
  ["batteria", "dm.ev_batteria_auto"],
  ["autonomia", "dm.ev_autonomia"],
  ["energia_residua", "dm.ev_energia_residua"],
  ["capacita_batteria", "dm.ev_capacita_batteria"],
  ["consumo_medio", "dm.ev_consumo_medio"],
  ["temperatura_esterna", "dm.ev_temperatura_esterna"],
  ["temperatura_batteria", "dm.ev_temperatura_batteria"],
  ["temperatura_interna", "dm.ev_temperatura_interna"],
  ["potenza_riscaldatore", "dm.ev_potenza_riscaldatore"],
  ["clima_acceso", "dm.ev_clima"],
  ["batteria_in_riscaldamento", "dm.ev_batteria_in_riscaldamento"],
  ["velocita", "dm.ev_velocita"],
  ["potenza", "dm.ev_potenza_istantanea"],
  ["odometro", "dm.ev_odometro"],
  ["autonomia_nominale", "dm.ev_autonomia_nominale"],
  ["stato_ricarica", "dm.ev_stato_ricarica"],
  ["in_carica", "dm.ev_stato_ricarica"],
  ["cavo_collegato", "dm.ev_cavo_collegato"],
  ["potenza_ricarica", "dm.ev_potenza_ricarica"],
  ["tempo_ricarica", "dm.ev_tempo_ricarica"],
  ["limite_ricarica", "dm.ev_target_soc"],
  ["ricarica_rapida", "dm.ev_ricarica_rapida"],
  ["ricarica_programmata", "dm.ev_ricarica_programmata"],
  ["ricarica_inizio", "dm.ev_ricarica_inizio"],
  ["ricarica_fine", "dm.ev_ricarica_fine"],
  ["v2l", "dm.ev_v2l"],
  ["comando_ricarica", "dm.ev_comando_ricarica"],
  ["energia_oggi_guida", "dm.ev_energia_oggi_guida"],
  ["energia_oggi_clima", "dm.ev_energia_oggi_clima"],
  ["energia_oggi_altro", "dm.ev_energia_oggi_altro"],
  ["km_7_giorni", "dm.ev_km_7_giorni"],
  ["energia_7_giorni", "dm.ev_energia_7_giorni"],
  ["ultima_ricarica_energia", "dm.ev_ultima_ricarica_energia"],
  ["ultima_ricarica_tipo", "dm.ev_ultima_ricarica_tipo"],
  ["ultima_ricarica_inizio", "dm.ev_ultima_ricarica_inizio"],
  ["ultima_ricarica_fine", "dm.ev_ultima_ricarica_fine"],
  ["serratura", "dm.ev_portiere"],
  ["portiere", "dm.ev_portiere"],
  ["bagagliaio", "dm.ev_bagagliaio"],
  ["finestrini", "dm.ev_finestrini"],
  ["quadro", "dm.ev_motore"],
  ["marcia", "dm.ev_marcia"],
  ["posizione", "dm.ev_posizione"],
  ["pneumatici_ant_sx", "dm.ev_pneumatico_ant_sx"],
  ["pneumatici_ant_dx", "dm.ev_pneumatico_ant_dx"],
  ["pneumatici_post_sx", "dm.ev_pneumatico_post_sx"],
  ["pneumatici_post_dx", "dm.ev_pneumatico_post_dx"],
  ["pneumatici_allarme", "dm.ev_pneumatici"],
  ["antifurto", "dm.ev_allarme"],
  ["sentinella", "dm.ev_sentinella"],
  ["freno_stazionamento", "dm.ev_freno_stazionamento"],
  ["sbrinamento", "dm.ev_sbrinamento"],
  ["in_sonno", "dm.ev_in_sonno"],
  ["ultimo_aggiornamento", "dm.ev_ultimo_aggiornamento"],
  ["clima", "dm.ev_comando_clima"],
  ["carburante", "dm.ev_carburante"],
  ["autonomia_carburante", "dm.ev_autonomia_carburante"],
  ["autonomia_totale", "dm.ev_autonomia_totale"],
]);

const PIATTAFORMA_GDAAUTO = "gdaauto";

/** Se questa riga del catalogo e' un'entita' di GdAAuto, con la sua chiave. */
export const eDiGdaauto = (voce) =>
  clean(voce?.platform).toLowerCase() === PIATTAFORMA_GDAAUTO &&
  Boolean(clean(voce?.translation_key));

/* ── i vocabolari ─────────────────────────────────────────────────────── */

/* Ogni voce e' una domanda sola, e l'ordine conta: si chiede prima quello che
 * si riconosce con certezza. */
const PAROLE = Object.freeze({
  batteria:
    /\b(soc|state of charge|batteria(?! di servizio| 12)|battery(?! voltage| 12)|hv batt|traction batt)\b/i,
  batteriaServizio:
    /\b(12\s?v|aux(iliary)? batt|batteria (di )?servizio|batteria ausiliaria|starter batt|bordbatterie)\b/i,
  carburante:
    /\b(fuel|carburante|benzina|gasolio|diesel|tank|serbatoio|kraftstoff|combustible|niveau de carburant)\b/i,
  autonomia: /\b(range|autonomia|reichweite|autonomie|autonom[ií]a|dte|distance to empty)\b/i,
  odometro: /\b(odometer|odometro|contachilometri|kilometerstand|kilometraje|totalizzatore)\b/i,
  ultimoViaggio: /\b(last trip|ultimo viaggio|trip distance|letzte fahrt|dernier trajet)\b/i,
  carburanteTotale:
    /\b(fuel (used|consumed)|carburante (consumato|totale)|verbrauch(t)?|consommation totale)\b/i,
  ricarica:
    /\b(charging|charge state|stato (di )?ricarica|ladezustand|estado de carga|en charge|plug|cavo|cable)\b/i,
  potenza: /\b(charg\w* power|potenza (di )?ricarica|ladeleistung|puissance)\b/i,
  target: /\b(target|limite|soglia|ladeziel|objetivo|charg\w* limit)\b/i,
  motore: /\b(engine|motore|ignition|quadro|z[üu]ndung|encendido|moteur)\b/i,
  /* Le portiere si chiedono in due tempi: prima «e' chiusa a chiave?», che e'
   * il riepilogo che la card vuole (bloccate/aperte), e solo dopo la singola
   * porta. Su un'auto vera ci sono quattro `Door ...` e una `Locked`: senza
   * questa distinzione la card raccontava lo sportello del guidatore. */
  serratura: /\b(lock(ed)?|serratur|bloccat|verrouill|verriegel|cerrad)\b/i,
  portiere: /\b(door|portier|porte|t[üu]r|puerta)\b/i,
  finestrini: /\b(window|finestrin|fenster|ventana|vitre)\b/i,
  bagagliaio: /\b(trunk|boot|bagagliaio|kofferraum|maletero|coffre|tailgate|hatch|liftgate)\b/i,
  cofano: /\b(hood|bonnet|cofano|motorhaube|cap[óo]|capot|frunk)\b/i,
  allarme: /\b(alarm|allarm|antifurt|alarma|alarme)\b/i,
  olio: /\b(oil|olio|[öo]l\b|aceite|huile)\b/i,
  esterna: /\b(outside|outdoor|external|ambient|esterna|au(ss|ß)en|exterior|ext[ée]rieur)\b/i,
  interna: /\b(interior|inside|indoor|cabin|abitacolo|interna|innen\w*|habitacle|int[ée]rieur)\b/i,
  pneumatici: /\b(tyre|tire|pneumatic|pneumatici|reifen|neum[áa]tic|pneu)\b/i,
  /* Le autonomie che NON sono quella di adesso (#2d del resoconto): quella
   * di omologazione, quella a carburante, quella totale di un'ibrida e quella
   * al limite di carica. Prima arrivavano in ordine alfabetico, e «Autonomia
   * di omologazione» batteva «Autonomia stimata» per una «d» prima della «s»:
   * il consumo che se ne ricava usciva basso, e la pagina prometteva
   * chilometri che l'auto non fa. Ognuna ha la sua casella. */
  autonomiaNominale: /\b(rated|nominal\w*|omologazion\w*|wltp|epa|nedc|cltc|ideal|typical)\b/i,
  autonomiaCarburante:
    /\b(fuel|carburante|benzina|gasolio|diesel|kraftstoff|combustible|petrol|gas)\b/i,
  autonomiaTotale: /\b(total\w*|combined|combinat\w*|gesamt\w*)\b/i,
  autonomiaAlLimite: /\b(at (the )?(charge )?limit|al limite|at target|al target)\b/i,
  /* Quello che non e' dell'auto, anche se ne usa le parole: l'additivo dei
   * diesel ha un «tank» e un «range» suoi (#444). */
  adblue: /\b(adblue|urea|def)\b/i,
  /* Un consumo, comunque lo si scriva: non e' una distanza e non e' carburante
   * usato, anche se dice «ultimo viaggio» o «Verbrauch». */
  consumo: /\b(consum\w*|consumption|verbrauch\w*|consommation|efficien\w*|economy)\b/i,
  capacita: /\b(capacit\w*|capacity|kapazit\w*|capacidad)\b/i,
  energiaResidua:
    /\b(energia residua|remaining energy|energy remaining|available energy|restenergie|[ée]nergie restante)\b/i,
  rimanente: /\b(remaining|rimanent\w*|left|to full|alla fine|manca\w*|restzeit|restante)\b/i,
});

/* Il consumo di un'auto elettrica, nelle unita' in cui lo scrivono: kWh per
 * cento chilometri, Wh al chilometro, chilometri per kWh, e le miglia. */
const UNITA_DEL_CONSUMO = /^(k?wh\s?\/\s?100\s?(km|mi)|wh\s?\/\s?(km|mi)|(km|mi)\s?\/\s?kwh)$/i;
const UNITA_DI_DISTANZA = /^(k?m|mi|ft)$/i;
const UNITA_DI_VOLUME = /^(l|gal|ml)$/i;
const UNITA_DI_ENERGIA = /^(k?wh|mwh)$/i;
const UNITA_DI_TEMPO = /^(s|min|h|d)$/i;

/* Le quattro ruote, e le parole con cui le integrazioni le distinguono. */
const RUOTE = Object.freeze([
  [
    "dm.ev_pneumatico_ant_sx",
    /\b(front[- _]?left|ant\w*[- _]?(sx|sinistr)|vorne links|avant gauche|fl)\b/i,
  ],
  [
    "dm.ev_pneumatico_ant_dx",
    /\b(front[- _]?right|ant\w*[- _]?(dx|destr)|vorne rechts|avant droit|fr)\b/i,
  ],
  [
    "dm.ev_pneumatico_post_sx",
    /\b(rear[- _]?left|post\w*[- _]?(sx|sinistr)|hinten links|arri[èe]re gauche|rl)\b/i,
  ],
  [
    "dm.ev_pneumatico_post_dx",
    /\b(rear[- _]?right|post\w*[- _]?(dx|destr)|hinten rechts|arri[èe]re droit|rr)\b/i,
  ],
]);

/* Le impostazioni del dispositivo non sono l'auto.
 *
 * Home Assistant marca da se' cosa e' configurazione e cosa e' diagnostica: il
 * volume dell'avvisatore e la versione del firmware stanno nel pannello del
 * dispositivo, non sulla card di chi guarda quanta benzina ha. La diagnostica
 * pero' NON si scarta del tutto: parecchie integrazioni ci mettono dentro la
 * batteria di servizio e la pressione delle gomme, che sulla card servono. */
const SOLO_IMPOSTAZIONE = (voce) => clean(voce?.category).toLowerCase() === "config";

/* ── gli attrezzi ─────────────────────────────────────────────────────── */

const dominio = (voce) => clean(voce?.entity_id).split(".")[0];

const parole = (voce, states) =>
  `${clean(voce?.entity_id)} ${clean(voce?.name)} ${clean(
    states?.[clean(voce?.entity_id)]?.attributes?.friendly_name,
  )}`.replace(/_/g, " ");

const classe = (voce, states) =>
  clean(
    voce?.device_class || states?.[clean(voce?.entity_id)]?.attributes?.device_class,
  ).toLowerCase();

const unita = (voce, states) =>
  clean(voce?.unit || states?.[clean(voce?.entity_id)]?.attributes?.unit_of_measurement);

/* ── il legame ────────────────────────────────────────────────────────── */

/**
 * Le caselle `dm.ev_*` che questo dispositivo sa riempire.
 *
 * Torna una mappa ref → entity_id, piu' il tipo di motore che le entita'
 * lasciano capire. Non salva niente: chi chiama decide cosa farne, e la
 * scheda dell'auto la disegna qualcun altro.
 */
export function legaLAutoAlDispositivo({ entities = [], states = {} } = {}) {
  const elenco = (Array.isArray(entities) ? entities : []).filter(
    (voce) => voce && !voce.disabled && clean(voce.entity_id).includes("."),
  );
  const libere = new Set(elenco.map((voce) => clean(voce.entity_id)));
  const mappa = {};

  /* Prende la prima entita' che risponde alla domanda, e la toglie dal mazzo:
   * una casella riempita non si riempie due volte, e un'entita' presa non
   * finisce anche altrove. */
  const prendi = (ref, domanda, { ancheImpostazioni = false } = {}) => {
    if (mappa[ref]) return false;
    for (const voce of elenco) {
      const id = clean(voce.entity_id);
      if (!libere.has(id) || (!ancheImpostazioni && SOLO_IMPOSTAZIONE(voce))) continue;
      if (!domanda(voce)) continue;
      mappa[ref] = id;
      libere.delete(id);
      return true;
    }
    return false;
  };

  /* GdAAuto per prima, e per chiave: esatta, in qualunque lingua e con
   * qualunque nome. La serratura comandabile vince su quella di sola lettura.
   * Anche un'impostazione entra, se la chiave e' del contratto: e' GdAAuto a
   * dire che quella e' la casella. Poi le sue entita' escono dal mazzo tutte,
   * anche quelle che non hanno una casella — il pulsante «Aggiorna» non e' lo
   * stato della ricarica — perche' una GdAAuto si riconosce dalla chiave, o
   * non si riconosce. */
  const chiave = (voce) => clean(voce?.translation_key);
  for (const [nome, ref] of CHIAVI_DI_GDAAUTO) {
    const sua = (voce) => eDiGdaauto(voce) && chiave(voce) === nome;
    prendi(ref, (voce) => sua(voce) && dominio(voce) === "lock", { ancheImpostazioni: true });
    prendi(ref, sua, { ancheImpostazioni: true });
  }
  for (const voce of elenco) if (eDiGdaauto(voce)) libere.delete(clean(voce.entity_id));

  const conClasse = (nome) => (voce) => classe(voce, states) === nome;
  const conParola = (chiave, dom) => (voce) =>
    (!dom || dominio(voce) === dom) && PAROLE[chiave].test(parole(voce, states));
  const percentuale = (voce) => unita(voce, states) === "%";
  const distanza = (voce) =>
    conClasse("distance")(voce) || UNITA_DI_DISTANZA.test(unita(voce, states));
  const gradi = (voce) => conClasse("temperature")(voce) || /°\s?[cf]$/i.test(unita(voce, states));
  /* Il nome che l'integrazione ha dato all'entita', senza quello del
   * dispositivo davanti: «Car Battery Level» di Kia e Hyundai e' la batteria
   * da 12 V (quella di trazione e' «EV Battery Level»), ma la stessa parola
   * dentro un'auto che si chiama «My Car» non dice niente. */
  const nome = (voce) => clean(voce?.name);

  /* La posizione: un `device_tracker` e' esattamente quello, e non serve
   * chiedersi come si chiama. */
  prendi("dm.ev_posizione", (voce) => dominio(voce) === "device_tracker");

  /* Le due batterie, nell'ordine che conta: prima quella di servizio, che si
   * riconosce dalle parole, o la sua percentuale si prenderebbe il posto della
   * batteria di trazione. */
  const diServizio = (voce) =>
    PAROLE.batteriaServizio.test(parole(voce, states)) ||
    /\b(car battery level|lv batt\w*|low voltage)\b/i.test(nome(voce));
  prendi("dm.ev_batteria_servizio", (voce) => percentuale(voce) && diServizio(voce));
  /* Oppure in volt: meta' delle integrazioni pubblica la batteria da 12 V
   * come tensione, non come livello (#348). Si prende solo se parla di
   * batteria di servizio — una tensione qualunque e' della colonnina o della
   * rete — e la casella sa mostrare i volt per quello che sono, senza farne
   * una percentuale. */
  prendi(
    "dm.ev_batteria_servizio",
    (voce) =>
      (conClasse("voltage")(voce) || /^m?v$/i.test(unita(voce, states))) &&
      PAROLE.batteriaServizio.test(parole(voce, states)),
  );
  /* La classe `battery` non basta da sola: ce l'hanno anche la 12 V e il
   * traguardo della ricarica, e chi arrivava prima in ordine alfabetico
   * diventava la batteria di trazione. */
  prendi(
    "dm.ev_batteria_auto",
    (voce) =>
      conClasse("battery")(voce) &&
      dominio(voce) === "sensor" &&
      !diServizio(voce) &&
      !conParola("target")(voce),
  );
  /* «Target SoC» parla di SoC ma non e' la batteria: e' il traguardo della
   * ricarica, e ha la sua casella piu' sotto. */
  prendi(
    "dm.ev_batteria_auto",
    (voce) => percentuale(voce) && conParola("batteria")(voce) && !conParola("target")(voce),
  );

  /* Il serbatoio: una percentuale che parla di carburante. Un sensore in litri
   * e' il consumo totale, non il livello, e sta in un'altra casella. Il
   * serbatoio dell'AdBlue non e' quello del gasolio. */
  prendi(
    "dm.ev_carburante",
    (voce) =>
      percentuale(voce) &&
      PAROLE.carburante.test(parole(voce, states)) &&
      !conParola("adblue")(voce),
  );

  /* Le autonomie con un aggettivo, prima di quella senza: ognuna alla sua
   * casella, cosi' la sola che resta e' quella che l'auto stima adesso. */
  const unAutonomia = (voce) =>
    dominio(voce) === "sensor" && conParola("autonomia")(voce) && !conParola("adblue")(voce);
  const qualificata = (voce) =>
    conParola("autonomiaNominale")(voce) ||
    conParola("autonomiaCarburante")(voce) ||
    conParola("autonomiaTotale")(voce) ||
    conParola("autonomiaAlLimite")(voce);
  prendi(
    "dm.ev_autonomia_al_limite_di_carica",
    (voce) => unAutonomia(voce) && distanza(voce) && conParola("autonomiaAlLimite")(voce),
  );
  prendi(
    "dm.ev_autonomia_nominale",
    (voce) => unAutonomia(voce) && distanza(voce) && conParola("autonomiaNominale")(voce),
  );
  prendi(
    "dm.ev_autonomia_carburante",
    (voce) => unAutonomia(voce) && distanza(voce) && conParola("autonomiaCarburante")(voce),
  );
  prendi(
    "dm.ev_autonomia_totale",
    (voce) => unAutonomia(voce) && distanza(voce) && conParola("autonomiaTotale")(voce),
  );
  prendi(
    "dm.ev_autonomia",
    (voce) => conClasse("distance")(voce) && unAutonomia(voce) && !qualificata(voce),
  );
  prendi("dm.ev_autonomia", (voce) => unAutonomia(voce) && !qualificata(voce));
  prendi("dm.ev_odometro", conParola("odometro", "sensor"));
  /* L'ultimo viaggio e' una distanza. «Consumo ultimo viaggio» parla di
   * ultimo viaggio ma e' in kWh/100 km: finiva qui, e la pagina lo scriveva
   * con i «km» accanto. */
  const unConsumo = (voce) =>
    conParola("consumo")(voce) || UNITA_DEL_CONSUMO.test(unita(voce, states));
  prendi(
    "dm.ev_ultimo_viaggio",
    (voce) =>
      conParola("ultimoViaggio", "sensor")(voce) &&
      !unConsumo(voce) &&
      (distanza(voce) || !unita(voce, states)),
  );
  /* Il consumo medio che l'auto misura: un'unita' del consumo elettrico, e
   * non quello dell'ultimo viaggio, che dice un'altra cosa. */
  prendi(
    "dm.ev_consumo_medio",
    (voce) =>
      dominio(voce) === "sensor" &&
      UNITA_DEL_CONSUMO.test(unita(voce, states)) &&
      !conParola("ultimoViaggio")(voce),
  );
  /* Il carburante usato si conta in litri: «Verbrauch» in kWh/100 km e il
   * carburante dell'ultimo viaggio non sono il totale. */
  prendi(
    "dm.ev_carburante_totale",
    (voce) =>
      conParola("carburanteTotale", "sensor")(voce) &&
      !conParola("ultimoViaggio")(voce) &&
      (UNITA_DI_VOLUME.test(unita(voce, states)) || !unita(voce, states)),
  );

  /* La batteria in kilowattora: quanti ne tiene, e quanti ne restano. */
  const inKwh = (voce) =>
    conClasse("energy_storage")(voce) || UNITA_DI_ENERGIA.test(unita(voce, states));
  prendi(
    "dm.ev_capacita_batteria",
    (voce) => dominio(voce) === "sensor" && inKwh(voce) && conParola("capacita")(voce),
  );
  prendi(
    "dm.ev_energia_residua",
    (voce) => dominio(voce) === "sensor" && inKwh(voce) && conParola("energiaResidua")(voce),
  );

  /* La ricarica: lo stato, la potenza e il traguardo.
   *
   * Anche qui si chiede in due tempi. Un'auto pubblica sia «Charging» sia
   * «Battery Charging»: dicono la stessa cosa, ma la prima e' il nome che uno
   * riconosce sulla card, e senza un ordine vinceva quella che capitava prima
   * nell'elenco. «Discharging» non e' «charging» e non entra: fra «dis» e
   * «charging» non c'e' confine di parola. */
  const nuda = (voce) => !/\bbatter/i.test(clean(voce?.name));

  /* Il cavo, e prima dello stato della ricarica.
   *
   * Il cavo lo sa anche la vettura: quasi tutte le integrazioni delle auto
   * pubblicano il loro «charger connected», e finora quel sensore lo mappava
   * soltanto la colonnina. Chi ha l'auto da un'integrazione e nessuna wallbox
   * collegata non aveva NESSUNO che dicesse alla plancia se il cavo era
   * dentro: uno stato di carica a `off`, senza cavo e senza potenza, diventa
   * «Non in carica» — ed e' quello che si legge sull'eroe con la macchina
   * attaccata («in questo momento e' collegato e dice non in carica»).
   *
   * Prima dello stato, perche' le parole del cavo stanno anche nel vocabolario
   * della ricarica — «plug», «cable» — e chi arriva primo si porta via
   * l'entita': un «charger connected» finiva nella casella dello stato, dove
   * vuol dire un'altra cosa. Un sensore che parla di carica non e' un cavo, e
   * si esclude come fa la colonnina. */
  const lettera = (voce) => eUnaLettera(states?.[clean(voce?.entity_id)]?.state);
  /* Un'apertura non e' un cavo: in un'auto che si chiama «Outlander Plug-in»
   * ogni portiera dice «plug». */
  const apertura = (voce) =>
    ["door", "window", "opening", "lock", "garage_door"].includes(classe(voce, states));
  /* La classe `plug` di Home Assistant e' il cavo, detto da chi lo sa. */
  prendi(
    "dm.ev_cavo_collegato",
    (voce) => dominio(voce) === "binary_sensor" && conClasse("plug")(voce),
  );
  /* Un `binary_sensor` che parla del cavo, oppure un sensore che pubblica la
   * lettera della norma — «vehicle status» a B con l'auto attaccata e' il cavo
   * detto meglio di qualunque acceso/spento. */
  prendi(
    "dm.ev_cavo_collegato",
    (voce) =>
      parlaDelCavo(parole(voce, states)) &&
      !apertura(voce) &&
      (dominio(voce) === "binary_sensor" || lettera(voce)),
  );

  /* Lo stato e' una parola o un acceso/spento, non un numero ne' un orario.
   *
   * «Charging power», «Charging time remaining», «Scheduled charging start» e
   * il pulsante «Start charging» parlano tutti di «charging», e prima il
   * primo in ordine alfabetico diventava lo stato: la pastiglia scriveva i
   * kilowatt, i minuti o l'ora d'inizio della ricarica programmata. Fuori
   * chi ha un'unita' o una classe da misura, i comandi che non dicono uno
   * stato — un pulsante, la serratura del cavo, il limite — e chi parla di
   * orari, potenze e programmi. */
  const NON_STATI = new Set([
    "button",
    "lock",
    "number",
    "input_number",
    "select",
    "input_select",
    "cover",
    "device_tracker",
    "image",
    "camera",
    "event",
    "update",
    "text",
    "input_text",
    "datetime",
    "date",
    "time",
  ]);
  const CLASSI_DA_MISURA = new Set([
    "power",
    "energy",
    "energy_storage",
    "duration",
    "timestamp",
    "date",
    "current",
    "voltage",
    "battery",
    "distance",
    "temperature",
    "speed",
    "door",
    "window",
    "opening",
    "lock",
    "plug",
  ]);
  const ALTRO_DALLO_STATO =
    /\b(sched\w*|programmat\w*|timer|start\w*|inizio|end|fine|stop\w*|time|tempo|remaining|rimanent\w*|left|until|limit\w*|current|corrente|power|potenza|energy|energia|cost\w*|rate|rapid\w*|fast|speed|veloc\w*|lock\w*)\b/i;
  const unoStato = (voce) =>
    conParola("ricarica")(voce) &&
    !NON_STATI.has(dominio(voce)) &&
    !unita(voce, states) &&
    !CLASSI_DA_MISURA.has(classe(voce, states)) &&
    !ALTRO_DALLO_STATO.test(parole(voce, states));
  /* La classe `battery_charging` dice la cosa giusta senza parole. */
  prendi(
    "dm.ev_stato_ricarica",
    (voce) => dominio(voce) === "binary_sensor" && conClasse("battery_charging")(voce),
  );
  prendi(
    "dm.ev_stato_ricarica",
    (voce) => unoStato(voce) && nuda(voce) && dominio(voce) !== "sensor",
  );
  prendi("dm.ev_stato_ricarica", (voce) => unoStato(voce) && nuda(voce));
  prendi("dm.ev_stato_ricarica", (voce) => unoStato(voce) && dominio(voce) !== "sensor");
  prendi("dm.ev_stato_ricarica", (voce) => unoStato(voce) && dominio(voce) === "sensor");
  prendi(
    "dm.ev_potenza_ricarica",
    (voce) => conClasse("power")(voce) && conParola("potenza")(voce),
  );
  prendi("dm.ev_potenza_ricarica", conParola("potenza", "sensor"));
  /* Quanto manca alla fine della carica: una durata che parla di carica. */
  prendi(
    "dm.ev_tempo_ricarica",
    (voce) =>
      dominio(voce) === "sensor" &&
      (conClasse("duration")(voce) || UNITA_DI_TEMPO.test(unita(voce, states))) &&
      /\b(charg\w*|ricaric\w*|carica|lade\w*|recharge)\b/i.test(parole(voce, states)) &&
      conParola("rimanente")(voce),
  );
  /* Il target: prima uno che si puo' COMANDARE — un `number` o una tendina
   * — perche' la plancia lo usa per cambiare il limite, e a un sensore di sola
   * lettura non si puo' dire niente. Il sensore resta come ripiego: mostra il
   * valore, e la tendina sa di essere muta. */
  const comandabile = (voce) =>
    ["select", "input_select", "number", "input_number"].includes(dominio(voce));
  /* Ma deve parlare di CARICA: una percentuale, o le parole del limite. Un
   * `number.cabin_target_temperature` e' un target anche lui, e la tendina
   * del target gli manderebbe un limite di carica (osservazione della review). */
  const parlaDiCarica = (voce) =>
    /\b(soc|charg\w*|carica|limit\w*|ladeziel|ladelimit)\b/i.test(parole(voce, states));
  /* E non deve essere una corrente: «Limite corrente di ricarica» e' in
   * ampere, e la tendina gli mandava un 80 che e' un'altra cosa. */
  const corrente = (voce) =>
    /^m?a$/i.test(unita(voce, states)) ||
    conClasse("current")(voce) ||
    /\b(corrente|current|ampere|amps?|strom|courant)\b/i.test(parole(voce, states));
  prendi(
    "dm.ev_target_soc",
    (voce) =>
      comandabile(voce) &&
      conParola("target")(voce) &&
      !corrente(voce) &&
      (percentuale(voce) || parlaDiCarica(voce)),
  );
  prendi(
    "dm.ev_target_soc",
    (voce) => percentuale(voce) && conParola("target")(voce) && !corrente(voce),
  );

  /* Le aperture e i comandi: le classi di Home Assistant per prime. La
   * serratura delle portiere, non quella del cavo: Tesla ha tutte e due, e
   * «charge_cable_lock» viene prima di «lock» in ordine alfabetico. */
  const delCavo = (voce) =>
    /\b(cable|cavo|kabel|charg\w*|ricaric\w*|port|presa)\b/i.test(parole(voce, states));
  prendi("dm.ev_portiere", (voce) => dominio(voce) === "lock" && !delCavo(voce));
  prendi("dm.ev_portiere", (voce) => dominio(voce) === "lock");
  prendi("dm.ev_portiere", (voce) => classe(voce, states) === "lock");
  prendi("dm.ev_portiere", conParola("serratura"));
  prendi("dm.ev_portiere", (voce) => classe(voce, states) === "door");
  prendi("dm.ev_portiere", conParola("portiere"));
  prendi("dm.ev_finestrini", (voce) => classe(voce, states) === "window");
  /* Il lunotto termico parla di finestrino, ma e' un interruttore che scalda. */
  prendi(
    "dm.ev_finestrini",
    (voce) =>
      conParola("finestrini")(voce) &&
      !["switch", "button"].includes(dominio(voce)) &&
      !/\b(heat\w*|riscald\w*|beheiz\w*|defrost\w*|sbrin\w*|d[ée]givr\w*)\b/i.test(
        parole(voce, states),
      ),
  );
  prendi("dm.ev_bagagliaio", conParola("bagagliaio"));
  prendi("dm.ev_cofano", conParola("cofano"));
  prendi("dm.ev_allarme", conParola("allarme"));
  /* Il motore acceso o spento: non la sua temperatura e non il pulsante che
   * lo avvia a distanza. «Engine coolant temperature» e «Temperatura motore»
   * finivano qui, prima della temperatura dell'olio. */
  prendi(
    "dm.ev_motore",
    (voce) =>
      conParola("motore")(voce) &&
      dominio(voce) !== "button" &&
      !unita(voce, states) &&
      !gradi(voce),
  );

  /* Le temperature: l'olio, quella di fuori, quella della batteria e quella
   * dell'abitacolo sono quattro gradi diversi. */
  prendi("dm.ev_temperatura_olio", (voce) => gradi(voce) && conParola("olio")(voce));
  prendi("dm.ev_temperatura_esterna", (voce) => gradi(voce) && conParola("esterna")(voce));
  prendi("dm.ev_temperatura_interna", (voce) => gradi(voce) && conParola("interna")(voce));
  prendi(
    "dm.ev_temperatura_batteria",
    (voce) =>
      gradi(voce) &&
      /\b(batter\w*|pack|hv|akku|bms|cell\w*)\b/i.test(parole(voce, states)) &&
      !diServizio(voce),
  );

  /* Le gomme: prima le quattro ruote per nome, poi quella riepilogativa con
   * quello che resta. Una pressione o un avviso, mai la temperatura della
   * gomma ne' la pila del sensore: «Tire temperature front left» prendeva la
   * casella della pressione, e la pressione vera finiva nel riepilogo. */
  const unaGomma = (voce) =>
    PAROLE.pneumatici.test(parole(voce, states)) &&
    !gradi(voce) &&
    !["battery", "voltage", "signal_strength"].includes(classe(voce, states)) &&
    !/^(%|m?v)$/i.test(unita(voce, states)) &&
    !/\b(temperatur\w*|temp|batter\w*)\b/i.test(parole(voce, states));
  for (const [ref, ruota] of RUOTE)
    prendi(ref, (voce) => unaGomma(voce) && ruota.test(parole(voce, states)));
  prendi("dm.ev_pneumatici", unaGomma);

  /* Un'auto a benzina non ha un'autonomia elettrica da distinguere: la sua
   * autonomia «a carburante» e' l'autonomia e basta, e la pagina la cerca
   * li'. Su un'ibrida restano due caselle, perche' sono due numeri. */
  if (
    !mappa["dm.ev_autonomia"] &&
    !mappa["dm.ev_batteria_auto"] &&
    mappa["dm.ev_autonomia_carburante"]
  ) {
    mappa["dm.ev_autonomia"] = mappa["dm.ev_autonomia_carburante"];
    delete mappa["dm.ev_autonomia_carburante"];
  }

  return { mappa, tipo: motoreDalleCaselle(mappa) };
}

/**
 * Che auto e', a giudicare da quello che pubblica.
 *
 * Il serbatoio da solo dice benzina; la batteria di trazione con la ricarica
 * dice elettrica; tutte e due dicono ibrida. Quando non si capisce si tace —
 * `""` e' «elettrica», che e' il valore di sempre — perche' dichiarare un
 * motore sbagliato nasconde meta' della pagina a chi apre la card.
 */
export function motoreDalleCaselle(mappa = {}) {
  const serbatoio = Boolean(clean(mappa["dm.ev_carburante"]));
  const batteria = Boolean(clean(mappa["dm.ev_batteria_auto"]));
  if (serbatoio && batteria) return "ibrida";
  if (serbatoio) return "termica";
  return "";
}
