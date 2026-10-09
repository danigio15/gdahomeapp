/* L'acquario di casa (#127), e il terrario accanto.
 *
 * «Si potrebbe inserire una sezione con l'acquario?»
 *
 * Con le entità in una sezione tua l'acquario si vedeva già: la temperatura, il
 * pH, la pompa, le luci. Quello che un elenco di numeri non sa, e questa
 * pagina sì, è il mestiere:
 *
 *  - la FORCELLA: in un acquario mezzo grado conta, e il punto è sapere se si
 *    è dentro o fuori — la temperatura e il pH hanno la loro, come il pH della
 *    piscina;
 *  - il LIVELLO: l'acqua evapora e si rabbocca. Serve come «fra quanti giorni»,
 *    non come percentuale, ed è la stessa retta del sale e delle piante;
 *  - il CAMBIO D'ACQUA: da quanti giorni non lo si fa. È la cosa che uno
 *    dimentica davvero, e nessun sensore la misura: è una data che si segna.
 *
 * Ogni riga è un'entità e dice cosa è — una misura con la sua forcella, il
 * livello, oppure un comando: le luci, il filtro, il riscaldatore. La vasca,
 * i litri e ogni quanto si cambia l'acqua sono della vasca, non di una riga,
 * e stanno accanto alle righe nella stessa configurazione.
 *
 * ── Il terrario ─────────────────────────────────────────────────────────
 *
 * «Ho tre terrari.» Acquari e terrari adesso sono voci degli Animali, e ce ne
 * possono essere quanti se ne hanno. Il terrario è lo stesso mestiere con
 * altre righe: l'umidità con la sua forcella, la lampada calda, l'UVB, il
 * nebulizzatore; e le forcelle di serie dipendono dal TIPO — il lato caldo di
 * un terrario sta fra 28 e 35 gradi, che in un acquario tropicale sarebbe una
 * zuppa. Il cambio d'acqua è solo dell'acquario: il terrario, se lo si vuole,
 * ha una pulizia generica, e senza un ritmo scritto non la ricorda a nessuno.
 *
 * È puro: entrano stati, righe e serie; escono letture e giudizi. Niente rete,
 * niente DOM, niente orologio — l'adesso lo passa chi chiama.
 */
import { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga } from "./elenco-dichiarato.js";
import { giorniAllaSoglia } from "./giorni-alla-soglia.js";
import { domandaDelleMedieDiOgniOra, serieDelleMedieDiOgniOra } from "./medie-di-ogni-ora.js";

const pulito = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  if (valore === "" || valore == null) return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const GIORNO_MS = 86400000;

/* ── la configurazione ───────────────────────────────────────────────────── */

/** Dove si scrive la configurazione dell'acquario. */
export const CHIAVE_ACQUARIO = "cd_acquario";

/* Cosa può essere una riga. Le misure si giudicano sulla loro forcella, il
 * livello su quanto manca al rabbocco, i comandi si accendono e si spengono. */
export const MISURE = Object.freeze([
  "temperatura",
  "temperatura_fresca",
  "umidita",
  "ph",
  "misura",
]);
export const COMANDI = Object.freeze([
  "luci",
  "lampada",
  "uvb",
  "nebulizzatore",
  "filtro",
  "riscaldatore",
  "comando",
]);
export const GENERI = Object.freeze([...MISURE, "livello", ...COMANDI]);

/* I due tipi di vasca. Il tipo sta nella voce degli Animali — «acquario» o
 * «terrario» — e qui decide due cose sole: quali generi si offrono, e le
 * forcelle di serie. */
export const TIPI = Object.freeze(["acquario", "terrario"]);

/** Il tipo, se è uno dei due; l'acquario altrimenti, che è com'era prima. */
export function tipoValido(tipo) {
  const scritto = pulito(tipo);
  return TIPI.includes(scritto) ? scritto : "acquario";
}

/* I generi che ogni tipo offre, nell'ordine della tendina. Il terrario non ha
 * il pH né il filtro; l'acquario non ha l'UVB né il nebulizzatore. La lampada
 * calda del terrario è anche il suo riscaldamento: il tappetino riscaldante si
 * accende e si spegne come lei. */
export const GENERI_DEL_TIPO = Object.freeze({
  acquario: Object.freeze([
    "temperatura",
    "ph",
    "misura",
    "livello",
    "luci",
    "filtro",
    "riscaldatore",
    "comando",
  ]),
  terrario: Object.freeze([
    "temperatura",
    "temperatura_fresca",
    "umidita",
    "misura",
    "livello",
    "luci",
    "lampada",
    "uvb",
    "nebulizzatore",
    "comando",
  ]),
});

/** I generi che si offrono per questo tipo. */
export function generiDelTipo(tipo) {
  return GENERI_DEL_TIPO[tipoValido(tipo)];
}

/* I campi in più di una riga: cosa è, la forcella delle misure, la soglia del
 * livello sotto cui si rabbocca. */
export const CAMPI_IN_PIU = Object.freeze(["genere", "minimo", "massimo", "soglia"]);

/* Le forcelle di partenza. Un acquario tropicale d'acqua dolce sta fra 24 e 27
 * gradi, e il pH fra 6,5 e 7,5: sono i numeri di quasi tutte le vasche di
 * comunità. Un marino o una vasca fredda li riscrivono, ed è il motivo per cui
 * stanno nella riga e non qui. */
export const FORCELLA_IN_CELSIUS = Object.freeze({ minimo: 24, massimo: 27 });
export const FORCELLA_IN_FAHRENHEIT = Object.freeze({ minimo: 75, massimo: 81 });
export const FORCELLA_DEL_PH = Object.freeze({ minimo: 6.5, massimo: 7.5 });

/* Il terrario ha due lati: il caldo, sotto la lampada, e il fresco, dove
 * l'animale va a riposare. I numeri sono quelli di un rettile del deserto —
 * un pogona, un geco leopardino —, che è il terrario più comune; chi tiene una
 * rana o un pitone verde li riscrive nella riga, come chi ha un marino. */
export const FORCELLA_DEL_LATO_CALDO = Object.freeze({ minimo: 28, massimo: 35 });
export const FORCELLA_DEL_LATO_CALDO_F = Object.freeze({ minimo: 82, massimo: 95 });
export const FORCELLA_DEL_LATO_FRESCO = Object.freeze({ minimo: 22, massimo: 28 });
export const FORCELLA_DEL_LATO_FRESCO_F = Object.freeze({ minimo: 72, massimo: 82 });

/* L'umidità: fra 40 e 80 per cento è la forcella larga che va bene a quasi
 * tutto quello che vive in un terrario, dal deserto alla foresta. */
export const FORCELLA_DELL_UMIDITA = Object.freeze({ minimo: 40, massimo: 80 });

/* Ogni quanti giorni si cambia l'acqua, se non lo si dice: due settimane, il
 * ritmo più largo che una vasca di comunità regge senza pensarci. */
export const CAMBIO_OGNI_GIORNI = 14;

/* Di quanto deve risalire il livello da un'ora all'altra per essere un
 * rabbocco: le medie di ogni ora ballano di qualche decimo, un rabbocco no. */
export const SALTO_DEL_RABBOCCO = 1;

/* Il disegno di serie di ogni genere, dal catalogo. */
const DISEGNO_DEL_GENERE = Object.freeze({
  temperatura: "thermometer",
  temperatura_fresca: "thermometer",
  umidita: "humidity",
  lampada: "heat-lamp",
  uvb: "uvb",
  nebulizzatore: "mist",
  ph: "gauge",
  misura: "gauge",
  livello: "water",
  luci: "lights",
  filtro: "pump",
  riscaldatore: "flame",
  comando: "toggle",
});

/** Il genere, se è uno di quelli che si sanno leggere. */
export function genereValido(genere) {
  const scritto = pulito(genere);
  return GENERI.includes(scritto) ? scritto : "";
}

/** Il disegno di serie di un genere. */
export function disegnoDelGenere(genere, tipo = "acquario") {
  return DISEGNO_DEL_GENERE[genereValido(genere)] || disegnoDelTipo(tipo);
}

/** Il disegno della vasca intera. */
export function disegnoDelTipo(tipo) {
  return tipoValido(tipo) === "terrario" ? "terrarium" : "aquarium";
}

/* ── cosa è un'entità dell'acquario ──────────────────────────────────────── */

/* «Vasca» no: in questa plancia le vasche sono anche quelle della piscina. */
const PAROLE_DELL_ACQUARIO = /acquari|aquari|reef|pesci|\bfish/i;

/* Il terrario si riconosce dal nome suo o da quello di chi ci vive. */
const PAROLE_DEL_TERRARIO =
  /terrari|vivari|paludari|rettil|reptil|gec[ok]|pogona|bearded|python|pitone|serpent|snake|tartarug|turtle|tortoise|camaleont|chameleon|iguana|lizard|lucertol|anfibi|amphibi/i;

/** Le parole con cui si riconoscono le entità di un tipo. */
export function paroleDelTipo(tipo) {
  return tipoValido(tipo) === "terrario" ? PAROLE_DEL_TERRARIO : PAROLE_DELL_ACQUARIO;
}

/**
 * Che genere di riga sarebbe questa entità, da come si chiama e da cosa
 * dichiara; `""` se non è niente che un acquario — o un terrario — usi.
 */
export function genereDelSensore(entity, stato, tipo = "acquario") {
  const id = pulito(entity);
  const dominio = id.split(".")[0];
  const attributi = stato?.attributes || {};
  const testo = `${id} ${pulito(attributi.friendly_name)}`.toLowerCase();
  const classe = pulito(attributi.device_class).toLowerCase();
  const unita = pulito(attributi.unit_of_measurement);
  const terrario = tipoValido(tipo) === "terrario";
  const comando = dominio === "switch" || dominio === "input_boolean" || dominio === "fan";
  /* Nel terrario un interruttore è quasi sempre una lampada, e quale lampada
   * lo dice il nome: l'UVB, la calda, o la luce del giorno. */
  if (terrario && (comando || dominio === "light")) {
    if (/(^|[._\s])uv(a|b)?([._\s]|$)|uvb|ultraviolet/.test(testo)) return "uvb";
    if (/nebuli|mist|fog|rain|pioggia|spruzz|spray/.test(testo)) return "nebulizzatore";
    if (/calda|caldo|basking|heat|riscald|tappetin|cavetto|ceramic|spot/.test(testo))
      return "lampada";
    if (dominio === "light" || /luc[ei]|light|\bled|lamp/.test(testo)) return "luci";
    return "comando";
  }
  if (dominio === "light") return "luci";
  if (dominio === "climate" || dominio === "water_heater")
    return terrario ? "lampada" : "riscaldatore";
  if (comando) {
    if (/riscald|heater|\bheat/.test(testo)) return "riscaldatore";
    if (/filtr|filter|pomp|pump|wave|corrente/.test(testo)) return "filtro";
    if (/luc[ei]|light|\bled|lamp/.test(testo)) return "luci";
    return "comando";
  }
  /* Un galleggiante dice solo se l'acqua è arrivata o no. */
  if (dominio === "binary_sensor")
    return /livell|level|float|galleggi|\bato\b/.test(testo) ? "livello" : "";
  if (dominio !== "sensor") return "";
  if (classe === "temperature" || /°\s*[CF]$/i.test(unita)) {
    if (terrario && /fredd|fresc|cool|cold/.test(testo)) return "temperatura_fresca";
    return "temperatura";
  }
  if (classe === "humidity" || (unita === "%" && /umid|humid/.test(testo))) return "umidita";
  if (classe === "ph" || /^ph$/i.test(unita) || /(^|[._\s])ph([._\s]|$)/.test(testo)) return "ph";
  if (/livell|level|altezza|float|galleggi/.test(testo)) return "livello";
  return "misura";
}

/* ── l'elenco dichiarato (#74) ───────────────────────────────────────────── */

export { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga };

/** Le righe dichiarate con la loro entità: quelle che la pagina mostra. */
export function righeDellAcquario(config) {
  return (righeDichiarate(config, CAMPI_IN_PIU) || []).filter((riga) => riga.entity);
}

/**
 * Se c'è qualcosa da mostrare. Solo le righe dichiarate contano: la sezione
 * nasce vuota, e la accende chi la configura.
 */
export function acquarioConfigurato(config) {
  return righeDellAcquario(config).length > 0;
}

/** Come si chiama la vasca: il nome della voce degli Animali, o quello di prima. */
export function nomeDellaVasca(config) {
  return pulito(config?.nome) || pulito(config?.vasca);
}

const MUTI = new Set(["", "unknown", "unavailable", "none"]);

/**
 * Le righe che il rilevamento proporrebbe adesso, nell'ordine dei generi.
 *
 * `tipo` dice con che parole si cerca e che generi valgono; `esclusi` le
 * entità che stanno già in un'altra vasca — con tre terrari, la stessa lampada
 * proposta a tutti e tre sarebbe tre volte la stessa domanda.
 */
export function righeDaImportare(
  states = {},
  config,
  nomeDi = (entity) => entity,
  { tipo = "acquario", esclusi = [] } = {},
) {
  const gia = new Set([
    ...righeDellAcquario(config).map((riga) => riga.entity),
    ...(esclusi instanceof Set ? esclusi : Array.isArray(esclusi) ? esclusi : []),
  ]);
  const parole = paroleDelTipo(tipo);
  const generi = generiDelTipo(tipo);
  const righe = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    if (gia.has(entity)) continue;
    const testo = `${entity} ${pulito(stato?.attributes?.friendly_name)}`;
    if (!parole.test(testo)) continue;
    const genere = genereDelSensore(entity, stato, tipo);
    if (!genere || !generi.includes(genere)) continue;
    /* Una misura che non è un numero non è una misura: un sensore di testo
     * con «acquario» nel nome non ha una forcella. */
    const grezzo = pulito(stato?.state).toLowerCase();
    if (entity.startsWith("sensor.") && !MUTI.has(grezzo) && numero(stato?.state) === null)
      continue;
    righe.push({
      entity,
      name: pulito(nomeDi(entity)) || entity,
      icon: disegnoDelGenere(genere, tipo),
      genere,
    });
  }
  const posto = (genere) => GENERI.indexOf(genere);
  return righe.sort((a, b) => posto(a.genere) - posto(b.genere) || a.name.localeCompare(b.name));
}

/* ── una riga, letta ─────────────────────────────────────────────────────── */

/**
 * La forcella di serie di una misura, nell'unità del suo sensore e per il
 * tipo della vasca; `null` se non ne ha.
 */
export function forcellaDiSerie(genere, unita = "", tipo = "acquario") {
  const fahrenheit = /F/i.test(pulito(unita));
  const terrario = tipoValido(tipo) === "terrario";
  if (genere === "temperatura") {
    if (terrario) return fahrenheit ? FORCELLA_DEL_LATO_CALDO_F : FORCELLA_DEL_LATO_CALDO;
    return fahrenheit ? FORCELLA_IN_FAHRENHEIT : FORCELLA_IN_CELSIUS;
  }
  if (genere === "temperatura_fresca")
    return fahrenheit ? FORCELLA_DEL_LATO_FRESCO_F : FORCELLA_DEL_LATO_FRESCO;
  if (genere === "umidita") return FORCELLA_DELL_UMIDITA;
  if (genere === "ph") return FORCELLA_DEL_PH;
  return null;
}

function istanteDelCambio(stato) {
  const quando = Date.parse(pulito(stato?.last_changed) || pulito(stato?.last_updated) || "");
  return Number.isFinite(quando) ? quando : null;
}

/* Acceso, per un comando: gli interruttori dicono «on»; il clima e lo
 * scaldacqua dicono il modo in cui sono, e spento è solo «off». */
function eAcceso(entity, grezzo) {
  const dominio = pulito(entity).split(".")[0];
  if (dominio === "climate" || dominio === "water_heater") return grezzo !== "off";
  return grezzo === "on";
}

/**
 * Una riga, letta adesso dagli stati.
 *
 * Tutte hanno `entity`, `name`, `icon`, `genere`, `muto`, `unita`. Poi, a
 * seconda di cosa sono: le misure il `valore` e la forcella (`minimo` e
 * `massimo`, `null` se non ce n'è una); il livello il `valore` e la `soglia`,
 * o — se è un galleggiante — `binario` e `basso`; i comandi `acceso`.
 */
export function letturaDellaRiga(
  riga,
  states = {},
  nomeDi = (entity) => entity,
  tipo = "acquario",
) {
  const entity = pulito(riga?.entity);
  const stato = states?.[entity];
  const attributi = stato?.attributes || {};
  const genere = genereValido(riga?.genere) || genereDelSensore(entity, stato, tipo) || "misura";
  const grezzo = pulito(stato?.state).toLowerCase();
  const tace = !stato || MUTI.has(grezzo);
  const base = {
    entity,
    name: pulito(riga?.name) || pulito(nomeDi(entity)) || entity,
    icon: pulito(riga?.icon) || disegnoDelGenere(genere, tipo),
    genere,
    unita: pulito(attributi.unit_of_measurement),
    da: istanteDelCambio(stato),
  };
  if (COMANDI.includes(genere))
    return Object.freeze({ ...base, muto: tace, acceso: tace ? null : eAcceso(entity, grezzo) });
  if (genere === "livello" && entity.startsWith("binary_sensor.")) {
    /* Il galleggiante: con la classe «moisture» acceso vuol dire bagnato, cioè
     * l'acqua c'è; con ogni altra classe — «problem», o nessuna — acceso vuol
     * dire che il livello è sceso fin lì. */
    const classe = pulito(attributi.device_class).toLowerCase();
    const acceso = grezzo === "on";
    return Object.freeze({
      ...base,
      muto: tace,
      binario: true,
      valore: null,
      soglia: null,
      basso: tace ? null : classe === "moisture" ? !acceso : acceso,
    });
  }
  const valore = tace ? null : numero(stato?.state);
  const muto = valore === null;
  if (genere === "livello")
    return Object.freeze({
      ...base,
      muto,
      binario: false,
      valore,
      soglia: numero(riga?.soglia),
      basso: null,
    });
  const serie = forcellaDiSerie(genere, base.unita, tipo);
  const minimo = numero(riga?.minimo) ?? serie?.minimo ?? null;
  const massimo = numero(riga?.massimo) ?? serie?.massimo ?? null;
  const forcella = minimo !== null && massimo !== null && massimo > minimo;
  return Object.freeze({
    ...base,
    muto,
    valore,
    minimo: forcella ? minimo : null,
    massimo: forcella ? massimo : null,
  });
}

/**
 * Le righe dichiarate, lette, nell'ordine in cui le si è scritte. Il tipo lo
 * dice la configurazione — una voce degli Animali porta la sua `specie` —, e
 * senza è un acquario, com'era la sezione da cui tutto è partito.
 */
export function acquarioDiCasa(states = {}, config, nomeDi = (entity) => entity) {
  const tipo = tipoValido(config?.specie);
  return righeDellAcquario(config).map((riga) => letturaDellaRiga(riga, states, nomeDi, tipo));
}

/* ── le domande a Home Assistant ─────────────────────────────────────────── */

/* Il livello si guarda come la terra delle piante: le medie di ogni ora degli
 * ultimi dieci giorni, per vedere i rabbocchi e il passo dell'evaporazione. */
export {
  domandaDelleMedieDiOgniOra as domandaDelLivello,
  serieDelleMedieDiOgniOra as serieDelLivello,
};

/** I livelli di cui serve la storia: quelli numerici, con una soglia da raggiungere. */
export function livelliDaSeguire(letture = []) {
  return letture
    .filter(
      (lettura) => lettura.genere === "livello" && !lettura.binario && lettura.soglia !== null,
    )
    .map((lettura) => lettura.entity);
}

/* ── i giudizi ───────────────────────────────────────────────────────────── */

/** Com'è un numero rispetto alla sua forcella: «low», «ok», «high», o «» senza forcella. */
export function nellaForcella(valore, minimo, massimo) {
  const n = numero(valore);
  if (n === null || minimo === null || massimo === null) return "";
  if (n < minimo) return "low";
  if (n > massimo) return "high";
  return "ok";
}

/**
 * Fra quanti giorni il livello arriva alla soglia, al passo con cui l'acqua
 * sta evaporando dall'ultimo rabbocco. La lettura di adesso entra nella retta
 * quando è più nuova dell'ultima media: è il punto che conta di più.
 */
export function giorniAlRabbocco(serie, lettura) {
  if (!lettura || lettura.binario || lettura.soglia === null || lettura.valore === null)
    return null;
  const punti = [...(Array.isArray(serie) ? serie : [])];
  const ultimo = punti.reduce((a, b) => Math.max(a, Number(b?.quando) || -Infinity), -Infinity);
  if (Number.isFinite(lettura.da) && lettura.da > ultimo)
    punti.push({ quando: lettura.da, valore: lettura.valore });
  return giorniAllaSoglia(punti, {
    soglia: lettura.soglia,
    salto: SALTO_DEL_RABBOCCO,
    punti: 12,
    giorni: 1,
  });
}

function mezzanotte(ms) {
  const giorno = new Date(ms);
  giorno.setHours(0, 0, 0, 0);
  return giorno.getTime();
}

/**
 * Il cambio d'acqua: quando è stato fatto l'ultimo, ogni quanti giorni va
 * fatto, da quanti giorni non lo si fa e fra quanti tocca.
 *
 * I giorni sono quelli del calendario: cambiata ieri sera vuol dire «ieri»
 * anche stamattina, non «oggi» perché non sono ancora passate ventiquattr'ore.
 * Senza una data segnata non si sa niente, e non si dice che è in ritardo.
 */
export function cambioDAcqua(config, adesso) {
  const ogni = Math.max(1, Math.round(numero(config?.ogni) ?? CAMBIO_OGNI_GIORNI));
  const ultimo = Date.parse(pulito(config?.cambio));
  if (!Number.isFinite(ultimo))
    return { ultimo: null, ogni, giorni: null, fra: null, scaduto: false };
  const giorni = Math.max(0, Math.round((mezzanotte(adesso) - mezzanotte(ultimo)) / GIORNO_MS));
  const fra = ogni - giorni;
  return { ultimo, ogni, giorni, fra, scaduto: fra <= 0 };
}

/**
 * La configurazione con il cambio d'acqua segnato a `quando`; senza, se
 * `quando` è vuoto. Per un terrario la data è quella della pulizia.
 */
export function conIlCambio(config, quando) {
  const fuori = { ...(config && typeof config === "object" ? config : {}) };
  const campo = tipoValido(fuori.specie) === "terrario" ? "pulizia" : "cambio";
  const istante = Number.isFinite(quando) ? quando : Date.parse(pulito(quando));
  if (Number.isFinite(istante)) fuori[campo] = new Date(istante).toISOString();
  else delete fuori[campo];
  return fuori;
}

/**
 * La pulizia del terrario: come il cambio d'acqua, ma facoltativa. Senza un
 * ritmo scritto non scade mai — dice solo da quanto, se una data c'è —, e
 * senza né ritmo né data non c'è: `null`, e la scheda non la disegna.
 */
export function puliziaDelTerrario(config, adesso) {
  const scritto = numero(config?.ogni);
  const ultimo = Date.parse(pulito(config?.pulizia));
  if (scritto === null && !Number.isFinite(ultimo)) return null;
  if (scritto !== null) return cambioDAcqua({ ogni: scritto, cambio: config?.pulizia }, adesso);
  const giorni = Math.max(0, Math.round((mezzanotte(adesso) - mezzanotte(ultimo)) / GIORNO_MS));
  return { ultimo, ogni: null, giorni, fra: null, scaduto: false };
}

/** La manutenzione: il cambio d'acqua dell'acquario, o la pulizia del terrario. */
export function manutenzioneDellaVasca(config, adesso) {
  return tipoValido(config?.specie) === "terrario"
    ? puliziaDelTerrario(config, adesso)
    : cambioDAcqua(config, adesso);
}

/**
 * Come sta l'acquario, tutto insieme: è quello che leggono la pagina e la
 * tessera in Home, dallo stesso posto.
 *
 * `stato` dice la cosa più importante, in quest'ordine: una misura fuori
 * forcella (`fuori`), l'acqua da rabboccare (`livello`), il cambio d'acqua da
 * fare (`cambio`), e poi `bene`. `mute` quando non risponde niente, `vuoto`
 * senza righe.
 */
export function comeStaLAcquario(letture = [], { serie = {}, config = {}, adesso = 0 } = {}) {
  const elenco = Array.isArray(letture) ? letture : [];
  const misure = elenco
    .filter((lettura) => MISURE.includes(lettura.genere))
    .map((lettura) => ({
      lettura,
      verdetto: lettura.muto ? "" : nellaForcella(lettura.valore, lettura.minimo, lettura.massimo),
    }));
  const livelli = elenco
    .filter((lettura) => lettura.genere === "livello")
    .map((lettura) => {
      const basso =
        !lettura.muto &&
        (lettura.binario
          ? Boolean(lettura.basso)
          : lettura.soglia !== null && lettura.valore < lettura.soglia);
      return {
        lettura,
        basso,
        giorni: basso || lettura.muto ? null : giorniAlRabbocco(serie?.[lettura.entity], lettura),
      };
    });
  const comandi = elenco.filter((lettura) => COMANDI.includes(lettura.genere));
  const fuori = misure.filter((voce) => voce.verdetto === "low" || voce.verdetto === "high");
  const bassi = livelli.filter((voce) => voce.basso);
  const mute = elenco.filter((lettura) => lettura.muto);
  const cambio = manutenzioneDellaVasca(config, adesso);
  const rabbocco =
    livelli.filter((voce) => voce.giorni !== null).sort((a, b) => a.giorni - b.giorni)[0] || null;
  let stato = "bene";
  if (!elenco.length) stato = "vuoto";
  else if (fuori.length) stato = "fuori";
  else if (bassi.length) stato = "livello";
  else if (cambio?.scaduto) stato = "cambio";
  else if (mute.length === elenco.length) stato = "mute";
  return {
    tipo: tipoValido(config?.specie),
    vasca: nomeDellaVasca(config),
    litri: numero(config?.litri),
    misure,
    livelli,
    comandi,
    fuori,
    bassi,
    mute,
    cambio,
    rabbocco,
    stato,
  };
}
