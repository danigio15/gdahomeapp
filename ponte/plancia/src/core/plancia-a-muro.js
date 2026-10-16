/* La plancia a muro: un tablet fisso, una schermata sola, comandi grandi.
 *
 * «Creami una plancia prettamente per dispositivi a muro: minimal, con comandi
 * ben precisi.» Non e' un'altra plancia da riempire da capo: e' una plancia
 * della casa che si accende «a muro» dal suo config, e che le cose — stanze,
 * luci, clima, tapparelle, azioni, antifurto — le prende da un'altra plancia,
 * di solito la principale. Qui si scrive solo COSA mostrare e COME si
 * comporta: quali pagine, con quale modello, quali sei comandi.
 *
 * Questo file non tocca la pagina: legge e pulisce. Tutto quello che qui si
 * decide si prova senza browser.
 *
 * ── Perche' i comandi puntano e non copiano ─────────────────────────────────
 *
 * Un comando a muro dice «la luce `light.tavolo`», non «la luce Tavolo con la
 * sua icona e la sua stanza». Il nome, il disegno e lo stato si leggono ogni
 * volta dalla plancia di origine e da Home Assistant: rinominare la luce nella
 * principale la rinomina anche sul tablet, e una luce tolta lascia il suo
 * posto vuoto invece di comandare un'entita' che non c'e' piu'. */

import { opzioniDelCampanello } from "./il-campanello-a-muro.js";
import { alarmHiddenModes, centraliAllarme, entitaDellaCentrale } from "./alarm-panel.js";
import { canonicalClimateType } from "./device-model.js";
import { ingressiScritti } from "./le-zone-della-centrale.js";
import { genereDelComando, partiDelComando } from "./comandi-accanto.js";
import { lettoriConfigurati } from "./media-player.js";
import { isDerivedEntity, powerPairSource, signedSource } from "./signed-energy.js";
import { isCharging, nomeDellaPersona, personViewModel } from "./person-model.js";
import { stanzaAllAperto, temperatureEntries } from "./room-overview.js";

export const CHIAVE_MURO = "cd_muro";

/* «Dare la possibilita' di fare sezioni personalizzate, tipo luci con tutte le
 * luci di casa, clima freddo e caldo.» Oltre alle tre di partenza:
 * - `personale`: sei posti scelti a mano, di qualunque cosa, senza stanza;
 * - `luci`: tutte le luci della casa;
 * - `freddo` e `caldo`: le unita' del clima che raffrescano o che scaldano
 *   (la pompa di calore sta in tutte e due, come nella pagina Clima). */
/* «Come sezioni da gestire e vedere riusciamo a fare meglio?» Le pagine da
 * guardare, oltre a quelle da comandare:
 * - `tapparelle`: tutte le tapparelle della casa, come `luci`;
 * - `ambienti`: una tessera per stanza, con temperatura, umidita' e luci
 *   accese, che cambia mentre cambia la casa;
 * - `telecamere`: le telecamere della plancia di origine, tutte insieme;
 * - `energia`: quanto consuma la casa adesso, quanto fa il solare, la rete e
 *   la batteria;
 * - `musica`: il lettore che suona, grande, con la copertina, i tasti, il
 *   volume e le sorgenti; accanto gli altri lettori della casa. */
export const MODELLI = Object.freeze([
  "stanza",
  "scene",
  "ingresso",
  "personale",
  "luci",
  "clima",
  "tapparelle",
  "ambienti",
  "telecamere",
  "energia",
  "musica",
  /* «Cerca di creare una cosa del genere per wall»: le pagine di una regia —
   * un pannello da sala riunioni, da auditorium, da chiesa — dove a muro non
   * si accendono le luci ma si alzano i microfoni, si gira la telecamera e si
   * avvia la sala. Vedi «la regia» piu' sotto. */
  "mixer",
  "telecamera",
  "comandi",
]);

/** Le pagine che si riempiono da sole con un intero gruppo della casa. */
export const MODELLI_ELENCO = Object.freeze(["luci", "clima", "tapparelle"]);

/* «Clima caldo e freddo non devono essere due sezioni ma una che si chiama
 * clima e dentro due tab caldo freddo, come la sezione clima.» Le pagine
 * nate come «freddo» o «caldo» diventano una pagina Clima che si apre su
 * quella linguetta. */
export const ZONE_DEL_CLIMA = Object.freeze(["freddo", "caldo"]);
/* Otto pagine: quattro bastavano per una stanza, non per la cucina che e'
 * anche l'ingresso e il posto da cui si guarda il giardino. Con piu' di
 * quattro, le linguette mostrano solo il disegno e il nome di quella aperta. */
export const PAGINE_AL_MASSIMO = 8;
/** I posti di una pagina, se nessuno ha scelto un'altra griglia. */
export const POSTI = 6;

/* La griglia di una pagina: quanti posti, e come stanno in orizzontale. In
 * verticale colonne e righe si scambiano. Quattro posti grandi per chi guarda
 * da lontano, dodici piccoli per chi ha tanto da comandare. */
export const GRIGLIE = Object.freeze({
  4: Object.freeze({ colonne: 2, righe: 2 }),
  6: Object.freeze({ colonne: 3, righe: 2 }),
  8: Object.freeze({ colonne: 4, righe: 2 }),
  9: Object.freeze({ colonne: 3, righe: 3 }),
  12: Object.freeze({ colonne: 4, righe: 3 }),
  /* «Se riempio le 12 caselle solo di dati tecnici della casa c'e' molto
   * spazio inutilizzato e se ne potrebbero mettere di piu'.» Le letture hanno
   * la loro tessera compatta, e su un tablet grande ne stanno sedici, venti,
   * ventiquattro. */
  16: Object.freeze({ colonne: 4, righe: 4 }),
  20: Object.freeze({ colonne: 5, righe: 4 }),
  24: Object.freeze({ colonne: 6, righe: 4 }),
});
export const POSTI_AL_MASSIMO = 24;

/* La griglia che una pagina nuova sceglie da se': le telecamere stanno meglio
 * in quattro, l'energia ha le sue quattro tessere. */
const GRIGLIA_DI_SERIE = Object.freeze({ telecamere: 4, energia: 4, ambienti: 6 });

/** Quanti posti ha questa pagina. */
export function postiDellaPagina(pagina) {
  const n = Number(pagina?.griglia);
  return GRIGLIE[n] ? n : POSTI;
}

/** Colonne e righe della pagina, per come e' girato il tablet. */
export function grigliaDellaPagina(pagina, versoScelto = "orizzontale") {
  const g = GRIGLIE[postiDellaPagina(pagina)];
  return versoScelto === "verticale"
    ? { colonne: g.righe, righe: g.colonne }
    : { colonne: g.colonne, righe: g.righe };
}

/* Il colore della pagina: quello del suo tipo, o uno di questi. */
export const COLORI_DELLE_PAGINE = Object.freeze([
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#64748b",
]);
export const TIPI_DI_COMANDO = Object.freeze([
  "luce",
  "clima",
  "tapparella",
  "entita",
  "azione",
  "vuoto",
  /* «Se ci fosse un on e off di uno switch che sono due entita' separate, si
   * potrebbe nei riquadri smezzarlo e fare in uno unico on e off? Unico nome,
   * ma con ON e OFF uno a destra e uno a sinistra.» Il riquadro dei due tasti:
   * un nome solo, e in alto, al posto dell'interruttore, ON a sinistra e OFF a
   * destra, ognuno con la sua entita'. Vedi `servizioDelTasto` piu' sotto. */
  "duetasti",
]);

/* Le entita' che hanno una card loro: la luce col cursore, il clima col meno e
 * il piu', la tapparella coi tre tasti. Tutto il resto — una presa, una
 * serratura, un sensore, uno script — e' una card «entita'» che fa la cosa
 * giusta per il suo dominio. */
const CARTE_DEDICATE = Object.freeze({ light: "luce", climate: "clima", cover: "tapparella" });

/** Che card fa questa entita' sul tablet. */
export function tipoDellEntita(id) {
  return CARTE_DEDICATE[String(id || "").split(".")[0]] || "entita";
}

/* I tasti di una tapparella, sulla sua card e nella sua finestra.
 *
 * «Sulla personalizzata la modifica che hai fatto del clima serve anche sulle
 * tapparelle, per far comparire i pulsanti diretti senza entrarci dentro.» I
 * tasti ▲ ■ ▼ ora stanno sempre sulla card; ma non tutte le coperture sanno
 * fare tutto: una tenda che si apre e si chiude soltanto non ha il «ferma», e
 * un tasto che manda un servizio che Home Assistant rifiuta e' peggio di un
 * tasto che non c'e'. Lo dicono i `supported_features` della cover: 1 apre,
 * 2 chiude, 8 ferma (4 e' la posizione, che vive nella finestra). Senza il
 * numero — un'entita' vecchia, o finta — i tasti sono tutti e tre, come prima.
 * Restituisce le chiavi dei tasti nell'ordine in cui si vedono: «su» (▲),
 * «ferma» (■), «giu» (▼). */
const APRE = 1;
const CHIUDE = 2;
const FERMA = 8;
export function tastiDellaTapparella(attributi = {}) {
  const f = Number(attributi?.supported_features);
  if (
    attributi?.supported_features === undefined ||
    attributi?.supported_features === null ||
    !Number.isFinite(f)
  )
    return ["su", "ferma", "giu"];
  return [
    ...(f & APRE ? ["su"] : []),
    ...(f & FERMA ? ["ferma"] : []),
    ...(f & CHIUDE ? ["giu"] : []),
  ];
}

/* Quale temperatura il tablet mostra dove c'e' il meteo — in alto accanto
 * all'ora e sul riposo. «Il meteo lo possiamo scegliere, ma la temperatura no,
 * perche' e' quella geolocalizzata del weather: potresti mettere la scelta di
 * un sensore interno, come la barra della Home.»
 * - `meteo`: quella di fuori, dell'entita' meteo (com'era sempre);
 * - `casa`: quella del sensore «in casa» — lo stesso campo che il riposo usava
 *   gia' (`riposo.sensore`), vuoto vuol dire la stanza della prima pagina. Un
 *   sensore solo per le due cose: due caselle che potevano dire due numeri
 *   diversi per la stessa «temperatura in casa» avrebbero solo confuso. */
export const TEMPERATURE_MOSTRATE = Object.freeze(["meteo", "casa"]);

/* Un posto lasciato vuoto apposta in mezzo agli altri: «il quinto lo voglio
 * libero». Senza, i posti dopo scivolerebbero avanti. */
const POSTO_VUOTO = Object.freeze({ tipo: "vuoto" });

/* Toglie i posti vuoti in coda: in mezzo contano, in fondo no. */
function senzaVuotiInCoda(posti) {
  const fuori = [...posti];
  while (fuori.length && fuori[fuori.length - 1].tipo === "vuoto") fuori.pop();
  return fuori;
}
export const ORIENTAMENTI = Object.freeze(["auto", "orizzontale", "verticale"]);
export const TEMI = Object.freeze(["plancia", "scuro", "chiaro", "orario"]);
export const MINUTI_DI_RIPOSO = Object.freeze([1, 2, 5, 10, 30]);
export const PROFILO_DI_ORIGINE = "primary";

const testo = (valore, massimo = 80) =>
  String(valore ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, massimo);
const entita = (valore) => {
  const pulita = testo(valore, 255).toLowerCase();
  return /^[a-z_]+\.[a-z0-9_]+$/.test(pulita) ? pulita : "";
};
const ora = (valore, ripiego) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(testo(valore, 5));
  if (!m) return ripiego;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return ripiego;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};
const scelta = (valore, ammesse, ripiego) => (ammesse.includes(valore) ? valore : ripiego);
const vero = (valore, ripiego) => (typeof valore === "boolean" ? valore : ripiego);
const profilo = (valore) => {
  const pulito = testo(valore, 64).toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(pulito) ? pulito : PROFILO_DI_ORIGINE;
};

/* Il PIN per uscire: da quattro a otto cifre, o niente. Un PIN piu' corto si
 * indovina guardando le ditate sul vetro. */
export function pinPulito(valore) {
  const cifre = String(valore ?? "").replace(/\D/g, "");
  return cifre.length >= 4 && cifre.length <= 8 ? cifre : "";
}

/**
 * Un comando di un posto: cosa comanda, e come si presenta sul tablet.
 *
 * «Devi dare la possibilita' di personalizzare le 6 card e scegliere a
 * piacimento cosa inserire»: un posto prende qualunque entita' di Home
 * Assistant o qualunque azione della plancia, e ognuno ha il suo nome, la sua
 * riga sotto e il suo disegno. Il tipo lo decide l'entita' — una luce scelta
 * a mano fa la card della luce — e non chi l'ha scritto.
 */
export function comandoPulito(input) {
  if (!input || typeof input !== "object") return null;
  const tipo = scelta(input.tipo, TIPI_DI_COMANDO, "");
  if (!tipo) return null;
  if (tipo === "vuoto") return { ...POSTO_VUOTO };
  const aspetto = {
    nome: testo(input.nome, 40),
    sotto: testo(input.sotto, 80),
    disegno: testo(input.disegno, 32),
  };
  if (tipo === "azione") {
    const azione = testo(input.azione, 80);
    if (!azione) return null;
    return { tipo, azione, ...aspetto };
  }
  const id = entita(input.entita);
  if (!id) return null;
  if (tipo === "duetasti") {
    /* Qui il tipo lo decide chi l'ha scritto, non l'entita': due tasti di
     * una luce restano due tasti, non la card della luce col cursore. Senza
     * il tasto OFF non e' un riquadro dei due tasti, e il posto resta vuoto
     * piuttosto che mostrare un OFF che non spegne niente. Lo stato e'
     * facoltativo: un'entita' scritta male vale come non scritta. */
    const spegne = entita(input.entitaOff);
    if (!spegne) return null;
    return { tipo, entita: id, entitaOff: spegne, stato: entita(input.stato), ...aspetto };
  }
  return { tipo: tipoDellEntita(id), entita: id, ...aspetto };
}

/* ── Il riquadro dei due tasti ────────────────────────────────────────────
 *
 * Ogni tasto «attiva» la sua entita' e basta: non e' un interruttore che va e
 * viene, e premere ON due volte lascia acceso. Un pulsante si preme, uno
 * script o una scena partono, un'automazione scatta, e tutto il resto — un
 * interruttore, un input_boolean, una luce — si accende. Chi ha due entita'
 * separate per accendere e spegnere (il relè a impulsi, il telecomando
 * imparato, i due pulsanti del led) le ha cosi' tutte e due sotto un nome. */
const DOMINI_CHE_SI_PREMONO = Object.freeze(["button", "input_button"]);
const DOMINI_CHE_PARTONO = Object.freeze(["script", "scene"]);
/* Le entita' del tasto ON che dicono da sole se la cosa e' accesa: quando lo
 * stato non e' scritto, il riquadro guarda loro. Un pulsante o uno script no:
 * dopo la pressione tornano come prima, e non dicono niente. */
const DOMINI_CHE_DICONO_LO_STATO = Object.freeze(["switch", "input_boolean", "light"]);

/** Il servizio che manda il tocco su un tasto dei due: `{ domain, service, data }`. */
export function servizioDelTasto(id) {
  const pulita = entita(id);
  if (!pulita) return null;
  const d = dominioDi(pulita);
  const data = { entity_id: pulita };
  if (DOMINI_CHE_SI_PREMONO.includes(d)) return { domain: d, service: "press", data };
  if (DOMINI_CHE_PARTONO.includes(d)) return { domain: d, service: "turn_on", data };
  if (d === "automation") return { domain: d, service: "trigger", data };
  if (DOMINI_CHE_DICONO_LO_STATO.includes(d)) return { domain: d, service: "turn_on", data };
  /* Il resto (una ventola, un telecomando, una valvola) lo accende Home
   * Assistant col servizio di tutti: ogni dominio ha il suo «accendi». */
  return { domain: "homeassistant", service: "turn_on", data };
}

/** Da quale entita' il riquadro dei due tasti legge se e' acceso: quella
 * scritta come stato, o il tasto ON quando e' un interruttore, una luce, un
 * input_boolean. Vuoto: il riquadro non sa lo stato e dice «Comando». */
export function statoDeiDueTasti(comando) {
  if (!comando || comando.tipo !== "duetasti") return "";
  const scritto = entita(comando.stato);
  if (scritto) return scritto;
  const on = entita(comando.entita);
  return DOMINI_CHE_DICONO_LO_STATO.includes(dominioDi(on)) ? on : "";
}

/* Una scena: un'azione della plancia di origine o un'entita' qualunque — una
 * scena, uno script, un tasto — col nome, la riga sotto e il disegno. */
function scenaPulita(input) {
  if (!input || typeof input !== "object") return null;
  const tipo = input.tipo || (input.entita && !input.azione ? "entita" : "azione");
  const comando = comandoPulito({ ...input, tipo });
  if (!comando) return null;
  /* Nelle scene un'entita' e' sempre una tessera grande: anche una luce qui
   * e' «accendi», non il cursore. E i due tasti, che le Scene non hanno,
   * diventano la tessera del solo tasto ON. */
  if (!comando.entita) return comando;
  const { entitaOff: _off, stato: _stato, ...tessera } = comando;
  return { ...tessera, tipo: "entita" };
}

const INGRESSO_VUOTO = Object.freeze({
  centrale: "",
  telecamera: "",
  apri: "",
  apri2: "",
  nomeApri: "",
  nomeApri2: "",
  esco: "",
  rientro: "",
  campanello: "",
  /* Le scelte del campanello (`il-campanello-a-muro.js`). */
  suono: "dindon",
  volume: 70,
  accendiSchermo: true,
  tieniAcceso: true,
  parla: false,
  persone: true,
  finestre: true,
  aree: [],
  letture: [],
  comandi: [],
});

/* «L'antifurto non gestisce piu' partizioni come abbiamo fatto sul telefono»:
 * sul telefono la sezione Sicurezza ha le sue aree (`cd_centrali`), e
 * l'Ingresso del tablet ne mostrava una sola. Qui si scrive quali aree e in
 * che ordine; vuoto, tutte quelle della plancia di origine. Sei al massimo:
 * oltre, un pannello a muro non e' piu' un colpo d'occhio. */
export const AREE_AL_MASSIMO = 6;

/* «Dentro la pagina dell'antifurto ci metterei la possibilita' di riprendere
 * altri dati, tipo se ci sono finestre aperte. Magari allo stesso modo come
 * sull'audio.» Come le «Altre letture» e gli «Altri comandi» della Musica:
 * un elenco di entita' da guardare — sensori, porte e finestre, serrature,
 * tapparelle — e uno da toccare. */
export const LETTURE_DELL_INGRESSO_AL_MASSIMO = 12;
export const COMANDI_DELL_INGRESSO_AL_MASSIMO = 8;
const DOMINI_DA_LEGGERE = Object.freeze([
  "binary_sensor",
  "sensor",
  "lock",
  "cover",
  "number",
  "input_number",
  "input_text",
  "input_select",
  "select",
  "input_boolean",
  "switch",
  "valve",
  "device_tracker",
  "person",
]);
/* I comandi: quelli che la Musica gia' accetta (`comandi-accanto.js`), piu'
 * la serratura e la tapparella, che accanto all'antifurto sono di casa. Un
 * telecomando col suo comando si scrive `remote.nome:comando`. */
const DOMINI_DA_TOCCARE = Object.freeze(["lock", "cover"]);

/** Se quell'entita' si puo' guardare fra le «Altre letture» dell'ingresso. */
export function eLetturaDellIngresso(id) {
  return DOMINI_DA_LEGGERE.includes(dominioDi(entita(id)));
}

/** Se quella voce si puo' toccare fra gli «Altri comandi» dell'ingresso. */
export function eComandoDellIngresso(voce) {
  const { entity, comando } = partiDelComando(voce);
  if (!entita(entity)) return false;
  if (comando) return true;
  /* Una tendina si sceglie, non si tocca: fra le letture si guarda. */
  const genere = genereDelComando(entity);
  return (genere && genere !== "tendina") || DOMINI_DA_TOCCARE.includes(dominioDi(entity));
}

const unici = (voci) => [...new Set(voci.filter(Boolean))];
const voci = (valore) => (Array.isArray(valore) ? valore : []);

function ingressoPulito(input = {}) {
  const dentro = input && typeof input === "object" ? input : {};
  return {
    centrale: entita(dentro.centrale),
    telecamera: entita(dentro.telecamera),
    apri: entita(dentro.apri),
    apri2: entita(dentro.apri2),
    /* I nomi dei due tasti sul tablet: «Cancello», «Portoncino». Vuoti, il
     * nome dell'entita'. */
    nomeApri: testo(dentro.nomeApri, 32),
    nomeApri2: testo(dentro.nomeApri2, 32),
    esco: testo(dentro.esco, 80),
    rientro: testo(dentro.rientro, 80),
    /* Il campanello: quando suona, il pannello si sveglia e apre il citofono
     * da solo, col video e i tasti per aprire. Un sensore che si accende, o
     * un evento di Home Assistant che scatta. */
    campanello: entita(dentro.campanello),
    /* E come suona: il suono e il suo volume, se lo schermo si accende quando
     * suona, se resta acceso (di notte al minimo) e se c'e' «Parla». */
    ...opzioniDelCampanello(dentro),
    persone: vero(dentro.persone, INGRESSO_VUOTO.persone),
    finestre: vero(dentro.finestre, INGRESSO_VUOTO.finestre),
    aree: unici(
      voci(dentro.aree)
        .map(entita)
        .filter((id) => id.startsWith("alarm_control_panel.")),
    ).slice(0, AREE_AL_MASSIMO),
    letture: unici(voci(dentro.letture).map(entita).filter(eLetturaDellIngresso)).slice(
      0,
      LETTURE_DELL_INGRESSO_AL_MASSIMO,
    ),
    comandi: unici(
      voci(dentro.comandi)
        .map((voce) => {
          const { entity, comando } = partiDelComando(testo(voce, 160));
          const id = entita(entity);
          return id && comando ? `${id}:${comando}` : id;
        })
        .filter(eComandoDellIngresso),
    ).slice(0, COMANDI_DELL_INGRESSO_AL_MASSIMO),
  };
}

/**
 * Le aree dell'antifurto dell'Ingresso, ognuna col suo nome.
 *
 * Quelle scelte nella pagina, nel loro ordine; senza scelta, la centrale
 * scritta come si faceva prima (una sola, come prima); senza nemmeno quella,
 * tutte le aree della plancia di origine. Il nome e' quello che l'area ha
 * nella sezione Sicurezza, vuoto se non ne ha uno.
 */
export function areeDellIngresso(pagina, fonte = {}) {
  const ing = pagina?.ingresso || {};
  const nomi = new Map(elenco(fonte.aree).map((a) => [a.entita, testo(a.nome, 40)]));
  const scelte = elenco(ing.aree).map(entita).filter(Boolean);
  const vecchia = entita(ing.centrale);
  const ids = scelte.length
    ? scelte
    : vecchia
      ? [vecchia]
      : elenco(fonte.centrali).map(entita).filter(Boolean);
  return unici(ids)
    .slice(0, AREE_AL_MASSIMO)
    .map((id) => ({ entita: id, nome: nomi.get(id) || "" }));
}

/* Le porte e le finestre si contano insieme: «Finestre aperte: 2» dice di
 * piu' di due etichette «Aperta». */
const CLASSI_DELLE_APERTURE = Object.freeze({
  window: "finestre",
  door: "porte",
  garage_door: "porte",
  opening: "aperture",
});

/**
 * Le «Altre letture» dell'ingresso, come si mostrano: i sensori di porte e
 * finestre messi insieme in un conto — quando sono almeno due — e le altre
 * una per una.
 *
 * `gruppo` e' `null` o `{ tipo, tutte, aperte }`: `tipo` dice come chiamarlo
 * («finestre» se sono tutte finestre, «porte» se sono tutte porte,
 * «aperture» se sono di piu' tipi), `aperte` sono quelle aperte adesso.
 */
export function lettureDellIngresso(letture = [], stati = {}) {
  const ids = elenco(letture).map(entita).filter(Boolean);
  const classe = (id) =>
    dominioDi(id) === "binary_sensor"
      ? CLASSI_DELLE_APERTURE[String(stati?.[id]?.attributes?.device_class || "")] || ""
      : "";
  const aperture = ids.filter((id) => classe(id));
  if (aperture.length < 2) return { gruppo: null, singole: ids };
  const tipi = unici(aperture.map(classe));
  return {
    gruppo: {
      tipo: tipi.length === 1 ? tipi[0] : "aperture",
      tutte: aperture,
      aperte: aperture.filter((id) => String(stati?.[id]?.state) === "on"),
    },
    singole: ids.filter((id) => !aperture.includes(id)),
  };
}

const RIGA_PIENA = Object.freeze({ clima: true, antifurto: true, persone: true, meteo: true });

let contatore = 0;
const nuovoId = () => `p${Date.now().toString(36)}${(contatore++).toString(36)}`;

/** Una pagina del tablet. */
export function paginaPulita(input, indice = 0) {
  const dentro = input && typeof input === "object" ? input : {};
  const vecchia = ZONE_DEL_CLIMA.includes(dentro.modello) ? dentro.modello : "";
  const modello = vecchia ? "clima" : scelta(dentro.modello, MODELLI, "stanza");
  const id = /^[a-z0-9-]{1,24}$/.test(String(dentro.id || "")) ? dentro.id : `p${indice + 1}`;
  /* `posti` e' come la chiamavano le plance della 1.11.1: vale lo stesso. */
  const scritta = Number(dentro.griglia ?? dentro.posti);
  const griglia = GRIGLIE[scritta] ? scritta : GRIGLIA_DI_SERIE[modello] || POSTI;
  const comandi = senzaVuotiInCoda(
    (Array.isArray(dentro.comandi) ? dentro.comandi : [])
      .slice(0, griglia)
      .map((c) => comandoPulito(c) || { ...POSTO_VUOTO }),
  );
  const scene = senzaVuotiInCoda(
    (Array.isArray(dentro.scene) ? dentro.scene : [])
      .slice(0, griglia)
      .map((c) =>
        c?.tipo === "vuoto" ? { ...POSTO_VUOTO } : scenaPulita(c) || { ...POSTO_VUOTO },
      ),
  );
  const riga = { ...RIGA_PIENA };
  if (dentro.riga && typeof dentro.riga === "object")
    for (const chiave of Object.keys(RIGA_PIENA))
      riga[chiave] = vero(dentro.riga[chiave], RIGA_PIENA[chiave]);
  return {
    id,
    modello,
    titolo: testo(dentro.titolo, 32),
    /* Il disegno della linguetta: vuoto, quello del tipo di pagina. */
    disegno: testo(dentro.disegno, 32),
    /* Il colore della linguetta e del titolo: vuoto, quello del tipo. */
    colore: COLORI_DELLE_PAGINE.includes(String(dentro.colore || "").toLowerCase())
      ? String(dentro.colore).toLowerCase()
      : "",
    griglia,
    /* Su quale linguetta si apre la pagina Clima. */
    zona: scelta(vecchia || dentro.zona, ZONE_DEL_CLIMA, "freddo"),
    /* Con cosa accende il ⏻ di una pagina Clima: il comando rapido della
     * plancia — modalita', gradi e ventola di quella stanza — o la prima
     * modalita' che il condizionatore dichiara, come prima. */
    accensione: scelta(dentro.accensione, ["rapido", "ultima"], "rapido"),
    stanza: testo(dentro.stanza, 80),
    /* `scelti` dice se i comandi li ha scelti qualcuno. Finche' e' falso la
     * pagina segue la stanza: una luce aggiunta nella principale compare da
     * sola sul tablet. */
    scelti: vero(dentro.scelti, comandi.length > 0),
    comandi,
    scene,
    riga,
    ingresso: ingressoPulito(dentro.ingresso),
    energia: energiaPulita(dentro.energia),
    /* I lettori della pagina Musica: vuoto, quelli della plancia di origine. */
    lettori: [...new Set((Array.isArray(dentro.lettori) ? dentro.lettori : []).map(entita))]
      .filter((id) => id.startsWith("media_player."))
      .slice(0, LETTORI_AL_MASSIMO),
    confermaUscita: vero(dentro.confermaUscita, false),
    /* Le tre pagine della regia: ognuna legge solo il suo pezzo. */
    mixer: mixerPulito(dentro.mixer),
    telecamera: telecameraPulita(dentro.telecamera),
    pulsanti: (Array.isArray(dentro.pulsanti) ? dentro.pulsanti : [])
      .slice(0, PULSANTI_AL_MASSIMO)
      .map(pulsantePulito)
      .filter(Boolean),
    fermaTutto: fermaTuttoPulito(dentro.fermaTutto),
  };
}

/* ── la regia: mixer, telecamera, comandi ────────────────────────────────
 *
 * «Cerca di creare una cosa del genere per wall»: un tablet da dieci pollici,
 * scuro, coi tasti grandi a sinistra e tre pagine — l'audio coi suoi cursori
 * in piedi, la telecamera con le frecce e i preset, i comandi d'avvio della
 * sala. Niente di tutto questo viene dalla plancia di origine: una regia non
 * ha stanze. Si scrive qui, entita' per entita'.
 *
 * Il mixer. Un canale e' un'entita' che ha un livello: un lettore
 * (`media_player`, il suo volume da 0 a 1) o un numero (`number`,
 * `input_number`, coi suoi min, max e passo — i dB di un mixer digitale). Il
 * muto e' quello del lettore, se lo sa fare, o un interruttore scelto a
 * parte, acceso vuol dire muto. Un canale senza ne' l'uno ne' l'altro non ha
 * il tasto: un tasto che non fa niente e' peggio di un tasto che non c'e'.
 *
 * «Perche' non prende i sensor. e i remote.?»: chi installa l'audio di una
 * sala ha anche questi. Un `sensor` col livello (dB, %) e' un canale da
 * guardare: lo stesso cursore in piedi, senza manopola, come un VU. Un
 * `remote` non ha un livello: si comanda con `remote.send_command`, e il
 * canale diventa ▲ / ▼ e il muto, ognuno col suo comando scritto nel config.
 * Un canale che si muove (un numero, un lettore, un telecomando) puo' avere
 * anche un sensore a parte che legge il livello vero («Livello letto»). Il
 * muto, oltre all'interruttore, puo' essere un telecomando (il suo comando) o
 * un tasto o uno script da premere: questi non dicono se e' muto.
 *
 * La telecamera. Le frecce, lo stop, lo zoom e i preset sono entita' da
 * premere — un `button`, uno `script`, una `scene` — che chi installa ha gia'
 * in Home Assistant: le telecamere PTZ le espongono cosi', e dove non lo
 * fanno uno script con `onvif.ptz` dentro fa lo stesso. Lo zoom puo' essere
 * anche un numero, e allora e' un cursore. Ogni tasto puo' essere anche un
 * `remote`, col comando da mandare scritto accanto.
 *
 * I comandi. Ognuno ha un tasto d'avvio e, se vuole, uno di stop: «AVVIO» e
 * «SPEGNIMENTO» sono due comandi di un tasto solo, le cinque sale sono cinque
 * comandi coi due tasti. Acceso lo dice l'entita' di stato scelta, o quella
 * dell'avvio quando sa dirlo (un interruttore, uno script che sta girando).
 * Un telecomando (`remote`) col comando scritto lo manda; senza comando si
 * accende e si spegne, come un interruttore. */
export const GRUPPI_AL_MASSIMO = 4;
export const CANALI_PER_GRUPPO = 8;
export const PRESET_AL_MASSIMO = 8;
export const PULSANTI_AL_MASSIMO = 8;
/* Il colore di un gruppo che nessuno ha scelto: il primo giallo, poi
 * l'azzurro e il verde, come sui banchi. */
export const COLORI_DEI_GRUPPI = Object.freeze(["#f59e0b", "#0ea5e9", "#10b981", "#ec4899"]);
/* I canali che si trascinano. */
export const DOMINI_DEL_FADER = Object.freeze(["media_player", "number", "input_number"]);
/* Tutti i canali: quelli che si trascinano, quelli da guardare (`sensor`) e
 * quelli coi tasti ▲ / ▼ (`remote`). */
export const DOMINI_DEL_CANALE = Object.freeze([...DOMINI_DEL_FADER, "sensor", "remote"]);
/* Il muto: un interruttore (acceso vuol dire muto), un telecomando col suo
 * comando, o qualcosa da premere. */
export const DOMINI_DEL_MUTO = Object.freeze([
  "switch",
  "input_boolean",
  "remote",
  "button",
  "input_button",
  "script",
]);
/* I comandi di un telecomando che nessuno ha scritto: i nomi piu' comuni. */
export const COMANDI_DEL_CANALE = Object.freeze({
  su: "volume_up",
  giu: "volume_down",
  muto: "mute",
});
export const COMANDI_DELLA_TELECAMERA = Object.freeze({
  su: "up",
  giu: "down",
  sinistra: "left",
  destra: "right",
  stop: "stop",
  zoomPiu: "zoom_in",
  zoomMeno: "zoom_out",
});
export const DOMINI_DA_PREMERE = Object.freeze([
  "button",
  "input_button",
  "script",
  "scene",
  "switch",
  "input_boolean",
  "automation",
  "light",
  "fan",
  "remote",
]);
/* Chi si accende e si spegne: per loro «stop» vuol dire spegnere. Un
 * telecomando lo e' solo senza un comando da mandare. */
const SI_SPENGONO = new Set(["switch", "input_boolean", "light", "fan", "automation"]);
const siSpegne = (id, comando = "") =>
  SI_SPENGONO.has(dominioDi(id)) || (dominioDi(id) === "remote" && !comando);
const DIREZIONI = Object.freeze(["su", "giu", "sinistra", "destra", "stop"]);

const dominioDi = (id) => String(id || "").split(".")[0];
function entitaDi(valore, domini) {
  const id = entita(valore);
  return id && domini.includes(dominioDi(id)) ? id : "";
}
const colorePulito = (valore) =>
  COLORI_DELLE_PAGINE.includes(String(valore || "").toLowerCase())
    ? String(valore).toLowerCase()
    : "";
/* Il comando di un telecomando, come Home Assistant lo vuole: una parola. */
const parolaDelComando = (valore) => testo(valore, 64);
/* Un numero scritto, o niente: la scala di un sensore. */
const numeroOVuoto = (valore) =>
  valore === null ||
  valore === undefined ||
  String(valore).trim() === "" ||
  !Number.isFinite(Number(valore))
    ? null
    : Number(valore);

/**
 * Un canale del mixer: l'entita' col livello, il nome, il muto; per un
 * telecomando i suoi comandi, per un sensore la sua scala, e il sensore che
 * legge il livello vero di un canale che si muove.
 */
export function canalePulito(input) {
  const dentro = typeof input === "string" ? { entita: input } : input;
  if (!dentro || typeof dentro !== "object") return null;
  const id = entitaDi(dentro.entita, DOMINI_DEL_CANALE);
  if (!id) return null;
  const d = dominioDi(id);
  const muto = entitaDi(dentro.muto, DOMINI_DEL_MUTO);
  const letto = d === "sensor" ? "" : entitaDi(dentro.letto, ["sensor"]);
  const telecomando = d === "remote";
  const mutoDaComando = telecomando || dominioDi(muto) === "remote";
  const conScala = d === "sensor" || Boolean(letto);
  return {
    entita: id,
    nome: testo(dentro.nome, 24),
    muto,
    letto,
    suComando: telecomando ? parolaDelComando(dentro.suComando) || COMANDI_DEL_CANALE.su : "",
    giuComando: telecomando ? parolaDelComando(dentro.giuComando) || COMANDI_DEL_CANALE.giu : "",
    mutoComando: mutoDaComando
      ? parolaDelComando(dentro.mutoComando) || COMANDI_DEL_CANALE.muto
      : "",
    dispositivo: mutoDaComando ? testo(dentro.dispositivo, 64) : "",
    min: conScala ? numeroOVuoto(dentro.min) : null,
    max: conScala ? numeroOVuoto(dentro.max) : null,
  };
}

/** Il canale vuoto: il volume totale che nessuno ha scelto. */
export const CANALE_VUOTO = Object.freeze({
  entita: "",
  nome: "",
  muto: "",
  letto: "",
  suComando: "",
  giuComando: "",
  mutoComando: "",
  dispositivo: "",
  min: null,
  max: null,
});

function mixerPulito(input) {
  const dentro = input && typeof input === "object" ? input : {};
  /* Un gruppo resta anche vuoto: e' appena nato nel config, e i canali
   * arrivano dopo. Sul tablet un gruppo senza canali non si disegna. */
  const gruppi = (Array.isArray(dentro.gruppi) ? dentro.gruppi : [])
    .slice(0, GRUPPI_AL_MASSIMO)
    .map((g) => (g && typeof g === "object" ? g : {}))
    .map((g) => ({
      nome: testo(g.nome, 24),
      colore: colorePulito(g.colore),
      canali: (Array.isArray(g.canali) ? g.canali : [])
        .map(canalePulito)
        .filter(Boolean)
        .slice(0, CANALI_PER_GRUPPO),
    }));
  const master = canalePulito(dentro.master) || { ...CANALE_VUOTO };
  return { gruppi, master };
}

/** Il colore di un gruppo: quello scelto, o quello del suo posto. */
export function coloreDelGruppo(gruppo, indice = 0) {
  return gruppo?.colore || COLORI_DEI_GRUPPI[indice % COLORI_DEI_GRUPPI.length];
}

function telecameraPulita(input) {
  const dentro = input && typeof input === "object" ? input : {};
  const fuori = { entita: entitaDi(dentro.entita, ["camera"]) };
  /* Un tasto che e' un telecomando porta il suo comando accanto
   * (`suComando`, `zoomPiuComando`…): vuoto, il nome piu' comune. */
  const tasto = (chiave) => {
    fuori[chiave] = entitaDi(dentro[chiave], DOMINI_DA_PREMERE);
    fuori[`${chiave}Comando`] =
      dominioDi(fuori[chiave]) === "remote"
        ? parolaDelComando(dentro[`${chiave}Comando`]) || COMANDI_DELLA_TELECAMERA[chiave]
        : "";
  };
  for (const d of DIREZIONI) tasto(d);
  fuori.zoom = entitaDi(dentro.zoom, ["number", "input_number"]);
  tasto("zoomPiu");
  tasto("zoomMeno");
  fuori.preset = (Array.isArray(dentro.preset) ? dentro.preset : [])
    .map((p) => (p && typeof p === "object" ? p : {}))
    .map((p) => {
      const id = entitaDi(p.entita, DOMINI_DA_PREMERE);
      return {
        entita: id,
        nome: testo(p.nome, 24),
        comando: dominioDi(id) === "remote" ? parolaDelComando(p.comando) : "",
      };
    })
    .filter((p) => p.entita)
    .slice(0, PRESET_AL_MASSIMO);
  /* Il preset di un telecomando senza comando: il suo numero. */
  fuori.preset.forEach((p, k) => {
    if (dominioDi(p.entita) === "remote" && !p.comando) p.comando = `preset_${k + 1}`;
  });
  fuori.dispositivo = telecomandiDellaTelecamera(fuori) ? testo(dentro.dispositivo, 64) : "";
  return fuori;
}

const telecomandiDellaTelecamera = (tc) =>
  [...DIREZIONI, "zoomPiu", "zoomMeno"].some((k) => dominioDi(tc[k]) === "remote") ||
  tc.preset.some((p) => dominioDi(p.entita) === "remote");

/* Un comando della pagina Comandi. Resta anche col solo nome: nel config si
 * scrive prima il nome e poi si sceglie l'entita'. Sul tablet uno senza
 * entita' non si disegna. */
function pulsantePulito(input) {
  if (!input || typeof input !== "object") return null;
  const fuori = {
    nome: testo(input.nome, 32),
    disegno: testo(input.disegno, 32),
    colore: colorePulito(input.colore),
    avvio: entitaDi(input.avvio, DOMINI_DA_PREMERE),
    stop: entitaDi(input.stop, DOMINI_DA_PREMERE),
    stato: entita(input.stato),
  };
  /* Un telecomando manda il comando scritto; senza, si accende e si spegne. */
  fuori.avvioComando =
    dominioDi(fuori.avvio) === "remote" ? parolaDelComando(input.avvioComando) : "";
  fuori.stopComando = dominioDi(fuori.stop) === "remote" ? parolaDelComando(input.stopComando) : "";
  fuori.dispositivo =
    dominioDi(fuori.avvio) === "remote" || dominioDi(fuori.stop) === "remote"
      ? testo(input.dispositivo, 64)
      : "";
  return fuori.nome || fuori.avvio || fuori.stop ? fuori : null;
}

/* «Ferma tutto»: un'entita' sola, o lo stop di ogni comando. Un telecomando
 * manda il suo comando, o senza si spegne. */
function fermaTuttoPulito(input) {
  const dentro = input && typeof input === "object" ? input : {};
  const id = entitaDi(dentro.entita, DOMINI_DA_PREMERE);
  const telecomando = dominioDi(id) === "remote";
  return {
    attivo: vero(dentro.attivo, false),
    entita: id,
    comando: telecomando ? parolaDelComando(dentro.comando) : "",
    dispositivo: telecomando ? testo(dentro.dispositivo, 64) : "",
  };
}

/** I comandi che il tablet sa davvero premere. */
export function pulsantiDellaPagina(pagina) {
  return (pagina?.pulsanti || []).filter((p) => p.avvio || p.stop);
}

/** I gruppi del mixer che hanno almeno un canale. */
export function gruppiDelMixer(pagina) {
  return (pagina?.mixer?.gruppi || [])
    .map((g, i) => ({ ...g, colore: coloreDelGruppo(g, i) }))
    .filter((g) => g.canali.length);
}

const IGNOTO = new Set(["", "unavailable", "unknown"]);
const VOLUME_SET = 4;
const VOLUME_MUTE = 8;
const arrotonda = (n) => Number(Number(n).toFixed(6));
const tra = (n, min, max) => Math.min(max, Math.max(min, n));

/** La posizione di un valore fra min e max, da 0 (in fondo) a 1 (in cima). */
export function posizioneDelValore(valore, min = 0, max = 1) {
  const v = Number(valore);
  if (!Number.isFinite(v) || !(Number(max) > Number(min))) return 0;
  return tra((v - min) / (max - min), 0, 1);
}

/* La scala di un sensore: quella scritta nel config, quella che dichiara, o
 * quella del canale che legge (un numero in dB letto in dB); se no dalla sua
 * unita': da 0 a 100 per i %, da -60 a +12 per i dB, come sui banchi. */
function scalaDellaMisura(canale, a, unita, accanto = null) {
  const dichiarata = (k) =>
    Number.isFinite(Number(a?.[k])) && a?.[k] !== "" && a?.[k] !== null ? Number(a[k]) : null;
  let min = numeroOVuoto(canale?.min) ?? dichiarata("min");
  let max = numeroOVuoto(canale?.max) ?? dichiarata("max");
  if (min === null && max === null && accanto && accanto.unita === unita) {
    min = accanto.min;
    max = accanto.max;
  }
  const db = /db/i.test(unita);
  if (min === null) min = db ? -60 : 0;
  if (max === null) max = db ? 12 : 100;
  if (!(max > min)) max = min + 100;
  return { min, max };
}

/* Quello che dice un sensore di livello: il numero, la sua unita', dove sta. */
function misuraDelSensore(id, canale, stati, accanto = null) {
  const s = stati?.[id];
  if (!s || IGNOTO.has(String(s.state ?? ""))) return null;
  const valore = Number(s.state);
  if (String(s.state).trim() === "" || !Number.isFinite(valore)) return null;
  const a = s.attributes || {};
  const unita = testo(a.unit_of_measurement, 12);
  const { min, max } = scalaDellaMisura(canale, a, unita, accanto);
  return { entita: id, valore, unita, min, max, posizione: posizioneDelValore(valore, min, max) };
}

/**
 * Quello che si sa di un canale adesso, per il cursore e il muto.
 *
 * `posizione` va da 0 a 1 ed e' dove sta il cursore; `valore` e' il numero
 * vero (il volume da 0 a 1 di un lettore, i dB di un numero), con `unita`.
 * `muove` dice se il cursore si puo' toccare, `puoMuto` se c'e' il tasto,
 * `mutoSaDire` se il muto dice com'e' (un interruttore, il muto del lettore:
 * un tasto da premere o un comando del telecomando non lo dicono).
 *
 * `tipo` e' «volume» (un lettore), «numero», «misura» (un sensore: si guarda
 * e basta) o «telecomando» (i tasti ▲ / ▼, `passi`). `misura` e' quello che
 * legge il sensore «Livello letto» di un canale che si muove, o `null`.
 */
export function letturaDelCanale(canale, stati = {}) {
  const id = canale?.entita || "";
  const d = dominioDi(id);
  const s = stati?.[id];
  const a = s?.attributes || {};
  const muto = canale?.muto || "";
  const mutoInterruttore = ["switch", "input_boolean"].includes(dominioDi(muto));
  const statoMuto = muto ? String(stati?.[muto]?.state ?? "") : "";
  const tipo =
    d === "media_player"
      ? "volume"
      : d === "sensor"
        ? "misura"
        : d === "remote"
          ? "telecomando"
          : "numero";
  const base = {
    entita: id,
    tipo,
    disponibile: Boolean(s) && !IGNOTO.has(String(s.state ?? "")),
    valore: null,
    min: 0,
    max: 1,
    passo: 0.01,
    unita: "",
    posizione: 0,
    muove: false,
    passi: false,
    misura: null,
    puoMuto: Boolean(muto),
    mutoSaDire: mutoInterruttore,
    mutato: mutoInterruttore ? statoMuto === "on" : false,
  };
  if (!base.disponibile) return { ...base, puoMuto: false };
  if (tipo === "misura") {
    const m = misuraDelSensore(id, canale, stati);
    return {
      ...base,
      valore: m ? m.valore : null,
      min: m ? m.min : 0,
      max: m ? m.max : 100,
      passo: 0,
      unita: m ? m.unita : testo(a.unit_of_measurement, 12),
      posizione: m ? m.posizione : 0,
    };
  }
  if (tipo === "telecomando") {
    /* Un telecomando non dice il livello: se c'e', lo legge il sensore. */
    const m = canale?.letto ? misuraDelSensore(canale.letto, canale, stati) : null;
    return {
      ...base,
      valore: m ? m.valore : null,
      min: m ? m.min : 0,
      max: m ? m.max : 100,
      passo: 0,
      unita: m ? m.unita : "",
      posizione: m ? m.posizione : 0,
      passi: true,
      misura: m,
      puoMuto: true,
    };
  }
  if (tipo === "volume") {
    const f = Number(a.supported_features);
    const tutto = a.supported_features === undefined || !Number.isFinite(f);
    const volume = Number(a.volume_level);
    const ce = a.volume_level !== undefined && a.volume_level !== null && Number.isFinite(volume);
    const proprio = !muto && (tutto || Boolean(f & VOLUME_MUTE));
    const lettura = {
      ...base,
      valore: ce ? tra(volume, 0, 1) : null,
      unita: "%",
      posizione: ce ? tra(volume, 0, 1) : 0,
      muove: ce && (tutto || Boolean(f & VOLUME_SET)),
      puoMuto: Boolean(muto) || tutto || Boolean(f & VOLUME_MUTE),
      mutoSaDire: mutoInterruttore || proprio,
      mutato: muto ? base.mutato : a.is_volume_muted === true,
    };
    lettura.misura = canale?.letto ? misuraDelSensore(canale.letto, canale, stati) : null;
    return lettura;
  }
  const min = Number.isFinite(Number(a.min)) ? Number(a.min) : 0;
  const max = Number.isFinite(Number(a.max)) && Number(a.max) > min ? Number(a.max) : min + 100;
  const passo = Number(a.step) > 0 ? Number(a.step) : 1;
  const valore = Number(s.state);
  const ce = String(s.state).trim() !== "" && Number.isFinite(valore);
  const lettura = {
    ...base,
    valore: ce ? valore : null,
    min,
    max,
    passo,
    unita: testo(a.unit_of_measurement, 12),
    posizione: ce ? posizioneDelValore(valore, min, max) : 0,
    muove: ce,
  };
  /* Il sensore che legge un numero: nella sua stessa unita' ha la sua scala. */
  lettura.misura = canale?.letto
    ? misuraDelSensore(canale.letto, canale, stati, { unita: lettura.unita, min, max })
    : null;
  return lettura;
}

/** Il valore che vuol dire una posizione del cursore, sul passo del canale. */
export function valoreDallaPosizione(posizione, lettura) {
  const p = tra(Number(posizione) || 0, 0, 1);
  if (lettura?.tipo === "volume") return arrotonda(Math.round(p * 100) / 100);
  const min = Number(lettura?.min) || 0;
  const max = Number(lettura?.max) > min ? Number(lettura.max) : min + 100;
  const passo = Number(lettura?.passo) > 0 ? Number(lettura.passo) : 1;
  const grezzo = min + p * (max - min);
  return arrotonda(tra(min + Math.round((grezzo - min) / passo) * passo, min, max));
}

/** Il servizio che porta il canale a quella posizione. */
export function servizioDelFader(canale, posizione, lettura) {
  const id = canale?.entita || lettura?.entita || "";
  const d = dominioDi(id);
  if (!id || !DOMINI_DEL_FADER.includes(d)) return null;
  const valore = valoreDallaPosizione(posizione, lettura);
  if (d === "media_player")
    return { domain: d, service: "volume_set", data: { entity_id: id, volume_level: valore } };
  return { domain: d, service: "set_value", data: { entity_id: id, value: valore } };
}

/** Un comando a un telecomando: `remote.send_command`, col dispositivo se c'e'. */
export function comandoAlTelecomando(id, comando, dispositivo = "") {
  if (dominioDi(id) !== "remote" || !comando) return null;
  const data = { entity_id: id, command: comando };
  if (dispositivo) data.device = dispositivo;
  return { domain: "remote", service: "send_command", data };
}

/** Il servizio del tasto muto: l'interruttore scelto, il comando del
 * telecomando, il tasto da premere, o il muto del lettore. */
export function servizioDelMuto(canale, lettura) {
  if (!lettura?.puoMuto) return null;
  const muto = canale?.muto || "";
  if (muto) {
    const d = dominioDi(muto);
    if (d === "switch" || d === "input_boolean")
      return {
        domain: d,
        service: lettura.mutato ? "turn_off" : "turn_on",
        data: { entity_id: muto },
      };
    if (d === "remote")
      return comandoAlTelecomando(
        muto,
        canale.mutoComando || COMANDI_DEL_CANALE.muto,
        canale.dispositivo,
      );
    return servizioDaPremere(muto);
  }
  if (dominioDi(canale?.entita) === "remote")
    return comandoAlTelecomando(
      canale.entita,
      canale.mutoComando || COMANDI_DEL_CANALE.muto,
      canale.dispositivo,
    );
  if (dominioDi(canale?.entita) !== "media_player") return null;
  return {
    domain: "media_player",
    service: "volume_mute",
    data: { entity_id: canale.entita, is_volume_muted: !lettura.mutato },
  };
}

/** I tasti ▲ / ▼ di un canale telecomando: il comando del verso. */
export function servizioDelPasso(canale, verso = "su") {
  if (dominioDi(canale?.entita) !== "remote") return null;
  const comando =
    verso === "giu"
      ? canale.giuComando || COMANDI_DEL_CANALE.giu
      : canale.suComando || COMANDI_DEL_CANALE.su;
  return comandoAlTelecomando(canale.entita, comando, canale.dispositivo);
}

/** Premere un'entita': il tasto, lo script, la scena, l'interruttore, il
 * comando di un telecomando (senza comando, il telecomando si accende). */
export function servizioDaPremere(id, comando = "", dispositivo = "") {
  const d = dominioDi(id);
  if (!id || !DOMINI_DA_PREMERE.includes(d)) return null;
  if (d === "remote" && comando) return comandoAlTelecomando(id, comando, dispositivo);
  if (d === "button" || d === "input_button")
    return { domain: d, service: "press", data: { entity_id: id } };
  if (d === "automation") return { domain: d, service: "trigger", data: { entity_id: id } };
  return { domain: d, service: "turn_on", data: { entity_id: id } };
}

/** Il servizio di una freccia, dello stop, di un tasto dello zoom o di un
 * preset (`tasto` «entita'» su una voce dei preset). */
export function servizioDellaTelecamera(telecamera, tasto, dispositivo = "") {
  const comando = tasto === "entita" ? telecamera?.comando : telecamera?.[`${tasto}Comando`];
  return servizioDaPremere(
    telecamera?.[tasto] || "",
    comando || "",
    dispositivo || telecamera?.dispositivo || "",
  );
}

const ACCESI_DEI_PULSANTI = new Set(["on", "playing", "open", "home", "true"]);

/** Il comando e' acceso? Lo dice l'entita' di stato, o quella dell'avvio. */
export function pulsanteAcceso(pulsante, stati = {}) {
  const id = pulsante?.stato || pulsante?.avvio || "";
  if (!id) return false;
  const d = dominioDi(id);
  if (["button", "input_button", "scene"].includes(d)) return false;
  /* Un telecomando che manda un comando non dice se quel comando e' acceso. */
  if (!pulsante?.stato && d === "remote" && pulsante?.avvioComando) return false;
  return ACCESI_DEI_PULSANTI.has(String(stati?.[id]?.state ?? "").toLowerCase());
}

/** Chi dice se un comando e' acceso: l'entita' di stato, o un avvio che si
 * accende e si spegne. */
export function pulsanteDiceLoStato(pulsante) {
  return Boolean(pulsante?.stato) || siSpegne(pulsante?.avvio, pulsante?.avvioComando);
}

/**
 * Il servizio di un tasto di un comando: «avvio» o «stop».
 *
 * Un interruttore senza tasto di stop e' un tasto solo che accende e spegne;
 * con lo stop scritto uguale all'avvio, lo stop lo spegne. Tutto il resto si
 * preme: lo script d'avvio, quello di spegnimento, il comando del telecomando.
 */
export function servizioDelPulsante(pulsante, verso = "avvio", stati = {}) {
  const avvio = pulsante?.avvio || "";
  const stop = pulsante?.stop || "";
  const dispositivo = pulsante?.dispositivo || "";
  const spegni = (id) => ({
    domain: dominioDi(id),
    service: "turn_off",
    data: { entity_id: id },
  });
  if (verso === "stop") {
    /* Lo stop che e' un telecomando manda il suo comando, o lo spegne. */
    if (dominioDi(stop) === "remote")
      return pulsante?.stopComando
        ? comandoAlTelecomando(stop, pulsante.stopComando, dispositivo)
        : spegni(stop);
    if (stop && stop !== avvio) return servizioDaPremere(stop);
    if (avvio && siSpegne(avvio, pulsante?.avvioComando)) return spegni(avvio);
    return null;
  }
  if (!avvio) return null;
  if (!stop && siSpegne(avvio, pulsante?.avvioComando) && pulsanteAcceso({ avvio }, stati))
    return spegni(avvio);
  return servizioDaPremere(avvio, pulsante?.avvioComando, dispositivo);
}

/** «Ferma tutto»: l'entita' scelta, o lo stop di ogni comando che ne ha uno. */
export function chiamateDelFermaTutto(pagina, stati = {}) {
  const ferma = pagina?.fermaTutto;
  if (!ferma?.attivo) return [];
  if (ferma.entita) {
    /* Un telecomando senza comando, per fermare tutto, si spegne. */
    if (dominioDi(ferma.entita) === "remote" && !ferma.comando)
      return [{ domain: "remote", service: "turn_off", data: { entity_id: ferma.entita } }];
    return [servizioDaPremere(ferma.entita, ferma.comando, ferma.dispositivo)];
  }
  return pulsantiDellaPagina(pagina)
    .filter((p) => p.stop || siSpegne(p.avvio, p.avvioComando))
    .map((p) => servizioDelPulsante(p, "stop", stati))
    .filter(Boolean);
}

/** Il menu di lato si vede solo in orizzontale e sul tablet vero. */
export function menuDiLato(muro, versoScelto = "orizzontale", compatto = false) {
  return Boolean(muro?.menuDiLato) && versoScelto === "orizzontale" && !compatto;
}

export const LETTORI_AL_MASSIMO = 8;

/** I lettori della pagina Musica: quelli scelti, o quelli della plancia. */
export function lettoriDellaPagina(pagina, fonte = {}) {
  if (pagina?.lettori?.length) return pagina.lettori.map((id) => ({ entita: id, nome: "" }));
  return elenco(fonte.lettori)
    .slice(0, LETTORI_AL_MASSIMO)
    .map((l) => ({ entita: l.entity, nome: l.nome || "" }));
}

/* La pagina Energia: quattro misure, ognuna un'entita'. Vuote, le prende la
 * plancia di origine dalla sua sezione Energia.
 *
 * «Preleva dalla rete» quando cedeva: dal campo, con un FoxESS. La rete e la
 * batteria si misurano in due modi — un sensore col segno, o due sensori
 * sempre positivi (prelievo e immissione, carica e scarica) — e il segno non
 * e' uguale per tutti gli inverter. La plancia lo sa gia' dalla sua scheda
 * Energia: il tablet adesso lo legge da li', e chi vuole lo cambia qui.
 *
 * - `rete`: col segno, positivo si preleva; oppure `prelievo` e `immissione`;
 * - `batteria`: la carica in %; `potenzaBatteria` col segno, positivo si
 *   scarica; oppure `carica` e `scarica`;
 * - `invertiRete`, `invertiBatteria`: per i sensori che scrivono al contrario. */
const ENERGIA_VUOTA = Object.freeze({
  casa: "",
  solare: "",
  rete: "",
  prelievo: "",
  immissione: "",
  batteria: "",
  potenzaBatteria: "",
  carica: "",
  scarica: "",
});
const VERSI_DELL_ENERGIA = Object.freeze(["invertiRete", "invertiBatteria"]);

/* «L'Energia propone quattro scelte soltanto: darei modo di aumentare le
 * entità a scelta.» Oltre alle quattro misure fisse, altre a piacere — una
 * presa, la pompa di calore, l'auto in carica, i kWh di oggi — fino a
 * dodici tessere in tutto. */
export const ALTRE_MISURE_AL_MASSIMO = 8;

function energiaPulita(input) {
  const dentro = input && typeof input === "object" ? input : {};
  const fisse = Object.fromEntries(Object.keys(ENERGIA_VUOTA).map((k) => [k, entita(dentro[k])]));
  const viste = new Set();
  const altre = (Array.isArray(dentro.altre) ? dentro.altre : [])
    .map(entita)
    .filter((e) => e && !viste.has(e) && viste.add(e))
    .slice(0, ALTRE_MISURE_AL_MASSIMO);
  const versi = Object.fromEntries(VERSI_DELL_ENERGIA.map((k) => [k, dentro[k] === true]));
  return { ...fisse, ...versi, altre };
}

/** Le misure in più della pagina Energia, nell'ordine scelto. */
export function altreMisureDellaPagina(pagina) {
  return Array.isArray(pagina?.energia?.altre) ? pagina.energia.altre.filter(Boolean) : [];
}

/** La griglia piu' piccola in cui stanno [quante] tessere. */
export function grigliaPer(quante) {
  const misure = Object.keys(GRIGLIE)
    .map(Number)
    .sort((a, b) => a - b);
  return misure.find((n) => n >= quante) || misure.at(-1);
}

/** Le misure dell'energia: quelle scelte, e le altre dalla plancia di origine. */
export function energiaDellaPagina(pagina, fonte = {}) {
  const scelte = pagina?.energia || {};
  const sue = fonte?.energia || {};
  const una = (k) => scelte[k] || sue[k] || "";
  /* La rete e la potenza della batteria vanno a gruppi: chi ne sceglie una
   * parte qui sceglie tutto il gruppo, e la plancia non ci mette del suo —
   * un prelievo scritto qui con un'immissione presa da li' sarebbe un conto
   * fatto con due misure di due persone diverse. */
  const gruppo = (chiavi, girataDiLa, inverti) => {
    const qui = chiavi.some((k) => scelte[k]);
    const da = qui ? scelte : sue;
    return {
      ...Object.fromEntries(chiavi.map((k) => [k, entita(da[k])])),
      girata: (qui ? false : sue[girataDiLa] === true) !== (scelte[inverti] === true),
    };
  };
  const rete = gruppo(["rete", "prelievo", "immissione"], "reteGirata", "invertiRete");
  const batteria = gruppo(
    ["potenzaBatteria", "carica", "scarica"],
    "batteriaGirata",
    "invertiBatteria",
  );
  return {
    casa: una("casa"),
    solare: una("solare"),
    batteria: una("batteria"),
    rete: rete.rete,
    prelievo: rete.prelievo,
    immissione: rete.immissione,
    reteGirata: rete.girata,
    potenzaBatteria: batteria.potenzaBatteria,
    carica: batteria.carica,
    scarica: batteria.scarica,
    batteriaGirata: batteria.girata,
  };
}

/**
 * Un numero di watt col segno da una misura: positivo si preleva dalla rete
 * (o si scarica la batteria). Con due sensori e' la differenza; con uno solo
 * e' lui, girato se scrive al contrario. `null` se non si sa.
 *
 * `watt(id)` legge un'entita' in watt (o `null`).
 */
export function potenzaConIlSegno({ segno, positivo, negativo, girata }, watt) {
  if (positivo || negativo) {
    const piu = positivo ? watt(positivo) : 0;
    const meno = negativo ? watt(negativo) : 0;
    if (piu === null && meno === null) return null;
    return (piu ?? 0) - (meno ?? 0);
  }
  if (!segno) return null;
  const v = watt(segno);
  return v === null ? null : girata ? -v : v;
}

/* Come la plancia legge rete e batteria dalla sua scheda Energia: il sensore
 * col segno e il suo verso, o la coppia di sensori. Le letture ricavate
 * (`dm_derived.*`) sul tablet non ci sono: si risale ai sensori veri. */
function versiDellaPlancia(energy) {
  const modello = energy && typeof energy === "object" ? energy : {};
  const fuori = {};
  const rete = powerPairSource(modello, "grid");
  if (rete) {
    fuori.prelievo = entita(rete.main);
    fuori.immissione = entita(rete.opposite);
  } else {
    const fonte = signedSource(modello, "grid");
    fuori.rete = entita(fonte?.entities?.power || modello.grid?.power);
    fuori.reteGirata = fonte?.inverted === true;
  }
  const batteria = powerPairSource(modello, "battery");
  if (batteria) {
    fuori.carica = entita(batteria.main);
    fuori.scarica = entita(batteria.opposite);
  } else {
    const fonte = signedSource(modello, "battery");
    fuori.potenzaBatteria = entita(fonte?.entities?.power || modello.battery?.power);
    fuori.batteriaGirata = fonte?.inverted === true;
  }
  for (const [k, v] of Object.entries(fuori))
    if (typeof v === "string" && isDerivedEntity(v)) fuori[k] = "";
  return fuori;
}

export const MURO_VUOTO = Object.freeze({
  attiva: false,
  fonte: PROFILO_DI_ORIGINE,
  orientamento: "auto",
  tema: "plancia",
  meteo: "",
  temperatura: "meteo",
  menuDiLato: false,
  riposo: { attivo: true, minuti: 2, torna: true, sensore: "" },
  notte: { attiva: false, da: "23:00", a: "06:30" },
  avvisi: true,
  avvisiGrandi: true,
  risveglio: { attivo: false, entita: "" },
  blocco: { attivo: false, pin: "" },
  batteria: { attiva: false, livello: "", carica: "" },
  pagine: [],
});

/** Il config a muro pulito, da qualunque cosa ci sia in memoria. */
export function muroPulito(input) {
  let dentro = input;
  if (typeof dentro === "string") {
    try {
      dentro = JSON.parse(dentro);
    } catch {
      dentro = null;
    }
  }
  if (!dentro || typeof dentro !== "object" || Array.isArray(dentro)) dentro = {};
  const riposo = dentro.riposo && typeof dentro.riposo === "object" ? dentro.riposo : {};
  const notte = dentro.notte && typeof dentro.notte === "object" ? dentro.notte : {};
  const risveglio =
    dentro.risveglio && typeof dentro.risveglio === "object" ? dentro.risveglio : {};
  const blocco = dentro.blocco && typeof dentro.blocco === "object" ? dentro.blocco : {};
  const batteria = dentro.batteria && typeof dentro.batteria === "object" ? dentro.batteria : {};
  const minuti = Number(riposo.minuti);
  const pin = pinPulito(blocco.pin);
  const visti = new Set();
  const pagine = (Array.isArray(dentro.pagine) ? dentro.pagine : [])
    .slice(0, PAGINE_AL_MASSIMO)
    .map((pagina, i) => paginaPulita(pagina, i))
    .map((pagina, i) => {
      if (visti.has(pagina.id)) pagina = { ...pagina, id: `p${i + 1}${nuovoId()}`.slice(0, 24) };
      visti.add(pagina.id);
      return pagina;
    });
  return {
    attiva: vero(dentro.attiva, false),
    fonte: profilo(dentro.fonte),
    orientamento: scelta(dentro.orientamento, ORIENTAMENTI, "auto"),
    tema: scelta(dentro.tema, TEMI, "plancia"),
    /* Il meteo in alto e sul riposo: vuoto, il primo che Home Assistant ha. */
    meteo: entita(dentro.meteo),
    /* La temperatura accanto al disegno del meteo: quella del meteo o quella
     * del sensore in casa (`riposo.sensore`). */
    temperatura: scelta(dentro.temperatura, TEMPERATURE_MOSTRATE, "meteo"),
    /* «Menu di lato»: le pagine in una colonna di tasti grandi a sinistra,
     * come sui pannelli di regia, invece che nelle linguette in alto. Vale
     * solo in orizzontale sul tablet vero (`menuDiLato()`): in verticale e sul
     * pannello piccolo restano le linguette. */
    menuDiLato: vero(dentro.menuDiLato, false),
    riposo: {
      attivo: vero(riposo.attivo, true),
      minuti: MINUTI_DI_RIPOSO.includes(minuti) ? minuti : 2,
      /* Al riposo il tablet torna alla prima pagina, o resta dov'era. */
      torna: vero(riposo.torna, true),
      /* La temperatura «in casa» del riposo, e quella in alto quando si
       * sceglie `temperatura: "casa"`: vuoto, quella della prima stanza. */
      sensore: entita(riposo.sensore),
    },
    notte: {
      attiva: vero(notte.attiva, false),
      da: ora(notte.da, "23:00"),
      a: ora(notte.a, "06:30"),
    },
    avvisi: vero(dentro.avvisi, true),
    /* Un avviso che si accende — l'allagamento, il fumo, l'antifurto che
     * suona — prende tutto lo schermo finche' qualcuno tocca «Ho visto». */
    avvisiGrandi: vero(dentro.avvisiGrandi, true),
    risveglio: {
      attivo: vero(risveglio.attivo, false) && Boolean(entita(risveglio.entita)),
      entita: entita(risveglio.entita),
    },
    /* Senza PIN il blocco non c'e': un tablet bloccato senza la chiave per
     * uscire e' un tablet da smontare dal muro. */
    blocco: { attivo: vero(blocco.attivo, false) && Boolean(pin), pin },
    /* La batteria del tablet sul riposo: spenta finche' qualcuno non la
     * accende. Le due entita' sono facoltative: vuote, la dice il browser. */
    batteria: {
      attiva: vero(batteria.attiva, false),
      livello: entita(batteria.livello),
      carica: entita(batteria.carica),
    },
    pagine,
  };
}

/**
 * La plancia a muro appena nata, gia' accesa e gia' riempita.
 *
 * «Gestiscila tu la creazione: per default parte a muro.» Chi aggiunge una
 * plancia «a muro» dalla console non deve poi aprirne il config per vedere
 * qualcosa sul tablet: nasce con le pagine che la fonte permette. Una Stanza
 * sempre — la prima della casa, coi suoi comandi che la seguono — le Scene se
 * fra le Azioni ce n'e' almeno una, l'Ingresso se c'e' una centrale o una
 * telecamera. Le stesse proposte di chi aggiunge le pagine a mano.
 */
export function muroDiPartenza(fonte = {}) {
  const pagine = [nuovaPagina("stanza", fonte, 0)];
  if (scenePropose(fonte).length) pagine.push(nuovaPagina("scene", fonte, pagine.length));
  if (elenco(fonte.centrali).length || elenco(fonte.telecamere).length)
    pagine.push(nuovaPagina("ingresso", fonte, pagine.length));
  return muroPulito({ ...MURO_VUOTO, attiva: true, fonte: PROFILO_DI_ORIGINE, pagine });
}

/** Una pagina nuova del modello scelto, gia' pronta a mostrare qualcosa. */
export function nuovaPagina(modello, fonte = {}, indice = 0) {
  const pagina = paginaPulita({ id: nuovoId().slice(0, 24), modello }, indice);
  if (pagina.modello === "stanza") pagina.stanza = fonte.stanze?.[0]?.name || "";
  if (pagina.modello === "scene") pagina.scene = scenePropose(fonte, pagina.griglia);
  if (pagina.modello === "ingresso") pagina.ingresso = ingressoProposto(fonte);
  /* La pagina personale nasce coi sei posti vuoti: li riempie chi la fa. */
  if (pagina.modello === "personale") pagina.scelti = true;
  /* Il mixer nasce con un gruppo da riempire, la telecamera con la prima
   * della plancia di origine. */
  if (pagina.modello === "mixer") pagina.mixer.gruppi = [{ nome: "", colore: "", canali: [] }];
  if (pagina.modello === "telecamera")
    pagina.telecamera.entita = entitaDi(elenco(fonte.telecamere)[0]?.entity, ["camera"]);
  return pagina;
}

/* ── la fonte: le cose della plancia da cui si legge ─────────────────────── */

const json = (valore, ripiego) => {
  if (valore && typeof valore === "object") return valore;
  try {
    const letto = JSON.parse(String(valore ?? ""));
    return letto ?? ripiego;
  } catch {
    return ripiego;
  }
};
const elenco = (valore) => (Array.isArray(valore) ? valore : []);

/**
 * Le cose che servono al tablet, dai valori del config di un'altra plancia —
 * quelli che il ponte rimanda con `dashboardmodern/config/get`.
 *
 * Si leggono le sezioni dallo stato della plancia (`dm_dashboard_state`,
 * schema 4), che sono gia' pulite; le azioni, le persone e le centrali dalle
 * loro caselle.
 */
export function fonteDaiValori(valori = {}) {
  const stato = json(valori.dm_dashboard_state, {});
  const sezioni = stato?.sections && typeof stato.sections === "object" ? stato.sections : {};
  return fonteDalleSezioni(sezioni, {
    azioni: json(valori.cd_quick_actions, []),
    persone: json(valori.cd_people, []),
    centrali: json(valori.cd_centrali, []),
    overrides: json(valori.cd_entity_overrides, {}),
    avvisi: json(valori.cd_avvisi_custom, []),
    climaUnita: json(valori.cd_clima_units, []),
    lettori: json(valori.cd_media_player, []),
    antifurtoModi: json(valori.cd_antifurto_modi, []),
    antifurtoSuMisura: json(valori.cd_antifurto_su_misura, []),
    varchi: json(valori.cd_varchi, {}),
    invertiti: json(valori.cd_stati_invertiti, []),
    rapidoGlobale: json(valori.cd_clima_rapido, null),
    rapidoPerUnita: json(valori.cd_clima_rapido_unita, {}),
  });
}

/* Il clima con il suo tipo: `clima` raffresca, `termo` scalda, `pompa` fa
 * tutte e due. Il tipo sta sull'unita' della sezione, o — nelle plance che le
 * tengono a parte — nell'elenco `cd_clima_units`; quelle che ci sono solo li'
 * si aggiungono. */
function climaColTipo(sezione, unita) {
  const altre = elenco(unita).filter((u) => u && entita(u.entity || u.entity_id));
  const tipoDi = (id, proprio) =>
    canonicalClimateType(
      proprio || altre.find((u) => entita(u.entity || u.entity_id) === id)?.type,
    );
  const visti = new Set();
  const fuori = sezione.map((d) => {
    visti.add(d.entity);
    return { ...d, tipo: tipoDi(d.entity, d.type) };
  });
  for (const u of altre) {
    const id = entita(u.entity || u.entity_id);
    if (visti.has(id) || u.enabled === false) continue;
    visti.add(id);
    fuori.push({ ...u, entity: id, tipo: canonicalClimateType(u.type) });
  }
  return fuori;
}

/** In quali pagine del clima sta un'unita' di questo tipo. */
export function zoneDelClima(tipo) {
  if (tipo === "termo") return ["caldo"];
  if (tipo === "pompa") return ["freddo", "caldo"];
  return ["freddo"];
}

/** La stessa fonte, quando le sezioni sono gia' in mano (la plancia stessa). */
export function fonteDalleSezioni(sezioni = {}, altro = {}) {
  const dispositivi = (nome) =>
    elenco(sezioni[nome]).filter((d) => d && d.enabled !== false && entita(d.entity));
  const overrides = altro.overrides && typeof altro.overrides === "object" ? altro.overrides : {};
  const centrali = elenco(altro.centrali)
    .map((c) => entita(c?.caselle?.["dm.security_centrale_allarme"]))
    .filter(Boolean);
  const centraleSola = entita(overrides["dm.security_centrale_allarme"]);
  if (centraleSola && !centrali.includes(centraleSola)) centrali.unshift(centraleSola);
  /* Il nome di ogni area, come l'ha scritto chi ha configurato l'antifurto:
   * con piu' aree il riposo dice quali sono inserite. */
  const nomiDelleAree = new Map(
    elenco(altro.centrali)
      .map((c) => [
        entita(c?.caselle?.["dm.security_centrale_allarme"]),
        testo(c?.nome || c?.name, 40),
      ])
      .filter(([id]) => id),
  );
  const misura = (chiave) => {
    const id = entita(overrides[`dm.energy_${chiave}`]);
    return isDerivedEntity(id) ? "" : id;
  };
  const versi = versiDellaPlancia(sezioni.energy);
  const conVersi = Object.values(versi).some((v) => typeof v === "string" && v);
  return {
    /* Le misure dell'energia che la plancia di origine ha gia' scelto: rete
     * e batteria col verso della sua scheda Energia. Una plancia senza il
     * modello (le piu' vecchie) dice solo gli alias. */
    energia: {
      casa: misura("potenza_consumo_casa"),
      solare: misura("potenza_fotovoltaico"),
      batteria: misura("stato_carica_batteria"),
      ...(conVersi
        ? versi
        : {
            rete: misura("potenza_scambio_rete"),
            potenzaBatteria: misura("potenza_batteria"),
          }),
    },
    /* I lettori della sezione Musica, per la pagina Musica. */
    lettori: lettoriConfigurati(elenco(altro.lettori))
      .filter((l) => entita(l.entity))
      /* Con gli «altri comandi» scelti accanto al lettore: «quelli che ho
       * abilitato nella plancia li vedo, nel pannello no». E con le «altre
       * letture» e il «telecomando»: «i remote. e i sensor. li aggiungi nel
       * config, ma non compaiono» — qui si tenevano solo i comandi, e una
       * lettura o un telecomando non arrivavano mai al tablet. I comandi
       * restano come li pulisce la sezione Musica: `remote.sala:volume_up`
       * non e' un'entita' sola, e un filtro da entita' lo buttava. */
      .map((l) => ({
        entity: entita(l.entity),
        nome: testo(l.nome),
        comandi: l.comandi,
        letture: l.letture.map(entita).filter(Boolean),
        telecomando: entita(l.telecomando),
      })),
    stanze: elenco(sezioni.rooms)
      .filter((s) => s && testo(s.name))
      .map((s) => ({
        id: testo(s.id, 80),
        name: testo(s.name),
        temp: entita(s.temp),
        hum: entita(s.hum),
        /* All'aperto (#251): la sua temperatura e' quella di fuori, e il
         * tablet non la scrive «in casa» (`temperaturaDelMuro`). Con lei le
         * altre sonde della stanza, oltre alla prima. */
        outdoor: stanzaAllAperto(s),
        sonde: unici(temperatureEntries(s).map((e) => entita(e.temp))),
      })),
    luci: dispositivi("lights"),
    clima: climaColTipo(dispositivi("climate"), altro.climaUnita),
    tapparelle: dispositivi("covers"),
    telecamere: dispositivi("cameras"),
    azioni: elenco(altro.azioni)
      .filter((a) => a && testo(a.name))
      .map((a) => ({
        name: testo(a.name),
        icon: testo(a.icon, 32),
        type: testo(a.type, 16),
        entity: testo(a.entity, 255),
        builtin: testo(a.builtin, 16),
        confirm: a.confirm === true,
        option: testo(a.option, 80),
      })),
    /* Il meteo scelto nella config della plancia (la casella della Home),
     * come lo legge la plancia: «il meteo non ridice con quello che e' messo
     * nella config». Vuoto, il tablet fa come la plancia senza scelta. */
    meteo: entita(overrides["dm.home_meteo"]) || entita(overrides["dm.core_055"]),
    /* Anche quelle spente in Home: non si contano fra chi e' in casa, ma il
     * loro nome di casa serve lo stesso a una card del tablet che le mostra. */
    persone: elenco(altro.persone)
      .filter((p) => p && entita(p.entity))
      .map((p) => ({
        entity: entita(p.entity),
        name: testo(p.name),
        ...(p.nascosta === true ? { nascosta: true } : {}),
      })),
    centrali,
    aree: centrali.map((id) => ({ entita: id, nome: nomiDelleAree.get(id) || "" })),
    /* L'antifurto come lo ha messo a posto la plancia di origine: «stato e
     * modalita' antifurto devono seguire quelle della plancia». I tasti tolti
     * in configurazione, quelli scritti a mano, e gli ingressi che ogni
     * centrale ha dichiarato — sono quelli, non ogni sensore con la classe
     * «finestra», a dire cosa e' rimasto aperto. */
    antifurto: {
      tolte: alarmHiddenModes(altro.antifurtoModi),
      suMisura: elenco(altro.antifurtoSuMisura),
      ingressi: Object.fromEntries(
        centraliAllarme(elenco(altro.centrali), overrides)
          .map((c) => [entitaDellaCentrale(c), ingressiScritti(c)])
          .filter(([id]) => id),
      ),
    },
    varchi: altro.varchi && typeof altro.varchi === "object" ? altro.varchi : {},
    /* I Comandi Rapidi del clima della plancia di origine: quello di tutta la
     * casa e quelli di ogni unita'. Il tablet accende come accende lei. */
    rapido: {
      globale:
        altro.rapidoGlobale && typeof altro.rapidoGlobale === "object" ? altro.rapidoGlobale : null,
      perUnita:
        altro.rapidoPerUnita &&
        typeof altro.rapidoPerUnita === "object" &&
        !Array.isArray(altro.rapidoPerUnita)
          ? altro.rapidoPerUnita
          : {},
    },
    invertiti: elenco(altro.invertiti),
    avvisi: elenco(altro.avvisi)
      .map((a) => ({
        name: testo(a?.name, 60),
        icon: testo(a?.icon, 16),
        entita: elenco(a?.entities?.length ? a.entities : [a?.entity])
          .map(entita)
          .filter(Boolean),
        cond: scelta(a?.cond, ["on", "off", "eq", "neq", "gt", "lt"], "on"),
        value: testo(a?.value, 40),
      }))
      .filter((a) => a.entita.length),
  };
}

/**
 * Chi e' in casa, per la riga in alto, l'ingresso e il riposo del tablet.
 *
 * Le persone sono quelle della scheda Persone della plancia di origine, coi
 * loro nomi di casa; senza nessuna in elenco, tutte le `person.*` che Home
 * Assistant conosce. Il nome e la presenza si decidono come nella card della
 * Home (`personViewModel`): il tablet non chiama nessuno in un altro modo.
 */
export function personeDelMuro(fonte = {}, stati = {}) {
  const configurate = elenco(fonte?.persone).filter((p) => p && entita(p.entity));
  /* Chi e' spento in Home non conta nemmeno qui; ma una scheda Persone fatta
   * solo di persone spente resta una scelta, non un elenco vuoto da riempire
   * con tutte le `person.*`. */
  const elencoDelMuro = configurate.length
    ? configurate.filter((p) => p.nascosta !== true)
    : Object.keys(stati || {})
        .filter((id) => id.startsWith("person."))
        .map((entity) => ({ entity, name: "" }));
  const inCasa = elencoDelMuro
    .map((p) => personViewModel(p, stati, 0))
    .filter((vista) => vista.presence === "home");
  return {
    entita: elencoDelMuro.map((p) => p.entity),
    tutte: elencoDelMuro.length,
    inCasa: inCasa.length,
    nomi: inCasa.map((vista) => vista.name),
  };
}

/**
 * Il nome di casa di una persona della plancia di origine, se e' in elenco.
 *
 * La scheda Persone puo' tenere la persona per la `person.*` o per il
 * `device_tracker.*` del suo telefono, e il tablet puo' mostrarla per l'altra
 * delle due: si riconosce dai `device_trackers` che Home Assistant scrive
 * sulla persona. Senza, una card della `person.*` diceva il nome dell'account
 * e la Home quello di casa.
 */
export function nomeDellaPersonaDelMuro(id, fonte = {}, stati = {}) {
  const chi = entita(id);
  if (!chi) return "";
  const persone = elenco(fonte?.persone).filter((p) => p && p.entity);
  const tracciati = (persona) => elenco(stati?.[persona]?.attributes?.device_trackers);
  const persona =
    persone.find((p) => p.entity === chi) ||
    persone.find((p) => tracciati(chi).includes(p.entity)) ||
    persone.find((p) => tracciati(p.entity).includes(chi));
  return persona ? nomeDellaPersona(persona, stati) : "";
}

const ACCESI = new Set(["on", "open", "opening", "unlocked", "detected", "wet", "home", "true"]);

/* Un avviso personalizzato della plancia di origine e' acceso? La stessa
 * regola del Quadro Avvisi: basta un'entita' che la rispetti. */
function avvisoAcceso(avviso, stati = {}) {
  return avviso.entita.some((id) => {
    const stato = String(stati[id]?.state ?? "").toLowerCase();
    if (!stato || stato === "unavailable" || stato === "unknown") return false;
    const numero = Number(stato);
    const soglia = Number(avviso.value);
    if (avviso.cond === "on") return ACCESI.has(stato);
    if (avviso.cond === "off") return !ACCESI.has(stato);
    if (avviso.cond === "eq") return stato === avviso.value.toLowerCase();
    if (avviso.cond === "neq") return stato !== avviso.value.toLowerCase();
    if (!Number.isFinite(numero) || !Number.isFinite(soglia)) return false;
    return avviso.cond === "gt" ? numero > soglia : numero < soglia;
  });
}

/**
 * Dove sta il riposo in questo minuto: uno spostamento fra -1 e 1, su x e y.
 *
 * «Orario e le altre info si muovono nello schermo per non restare sempre
 * allo stesso punto»: un tablet acceso tutto il giorno si stampa addosso
 * quello che non si muove mai. Ogni minuto il blocco va altrove, seguendo una
 * sequenza a bassa discrepanza (R2): posti sempre diversi, sparsi su tutto il
 * riquadro, e due minuti di fila non cadono mai vicini.
 */
export function derivaDelRiposo(adesso = Date.now()) {
  const n = Math.floor(Number(adesso) / 60000);
  const parte = (v) => v - Math.floor(v);
  return {
    x: parte(0.5 + n * 0.7548776662466927) * 2 - 1,
    y: parte(0.5 + n * 0.5698402909980532) * 2 - 1,
  };
}

/** Gli avvisi da mostrare sul riposo: quelli accesi, e l'antifurto che suona. */
export function avvisiAccesi(fonte = {}, stati = {}, centrale = "") {
  const accesi = elenco(fonte.avvisi)
    .filter((a) => avvisoAcceso(a, stati))
    .map((a) => ({
      chiave: a.entita[0],
      testo: a.name || a.entita[0],
      icon: a.icon,
      grave: false,
    }));
  /* Suona una qualunque area, non solo la prima: con piu' partizioni quella
   * che scatta puo' essere la terza. */
  const tutte = [...new Set([entita(centrale), ...elenco(fonte.centrali)].filter(Boolean))];
  const allarme = tutte.find((id) => String(stati[id]?.state) === "triggered");
  if (allarme) accesi.unshift({ chiave: allarme, testo: "", icon: "", grave: true });
  return accesi;
}

const diStanza = (dispositivo, stanza) =>
  Boolean(stanza) &&
  (dispositivo.room === stanza.name ||
    dispositivo.room === stanza.id ||
    (stanza.id && dispositivo.room_id === stanza.id));

/* Le azioni che sembrano della stanza: il nome della stanza nel nome
 * dell'azione («Cinema soggiorno»), o le scene in generale se di quelle della
 * stanza non ce n'e'. */
function azioniDellaStanza(fonte, stanza) {
  const azioni = elenco(fonte.azioni).filter((a) => eUnaScena(a));
  const nome = String(stanza?.name || "").toLowerCase();
  const sue = nome ? azioni.filter((a) => a.name.toLowerCase().includes(nome)) : [];
  return sue.length ? sue : azioni.filter((a) => a.type === "scene" || a.type === "script");
}

/**
 * I comandi che una stanza propone da sola: prima le luci, poi il clima e le
 * tapparelle, poi le sue azioni. Sei posti, come la griglia.
 */
export function comandiProposti(fonte = {}, nomeStanza = "", posti = POSTI) {
  const stanza =
    elenco(fonte.stanze).find((s) => s.name === nomeStanza || s.id === nomeStanza) || null;
  if (!stanza) return [];
  const proposti = [
    ...elenco(fonte.luci)
      .filter((d) => diStanza(d, stanza))
      .map((d) => ({ tipo: "luce", entita: d.entity, nome: "" })),
    ...elenco(fonte.clima)
      .filter((d) => diStanza(d, stanza))
      .map((d) => ({ tipo: "clima", entita: d.entity, nome: "" })),
    ...elenco(fonte.tapparelle)
      .filter((d) => diStanza(d, stanza))
      .map((d) => ({ tipo: "tapparella", entita: d.entity, nome: "" })),
  ];
  /* Le azioni riempiono i posti che restano, almeno due se ci stanno. */
  const liberi = Math.max(posti - proposti.length, Math.min(2, posti));
  const azioni = azioniDellaStanza(fonte, stanza)
    .slice(0, liberi)
    .map((a) => ({ tipo: "azione", azione: a.name, nome: "", sotto: "" }));
  return [...proposti.slice(0, posti - azioni.length), ...azioni]
    .map(comandoPulito)
    .filter(Boolean)
    .slice(0, posti);
}

/**
 * La temperatura che il tablet scrive accanto al meteo e sul riposo: da quale
 * sensore, e se e' di dentro o di fuori. `{ sonda, fuori }`, `sonda` vuota se
 * non ce n'e' una.
 *
 * «Il muro scrive "X° in casa", ma quel sensore e' esterno.» Dalla 1.14.3 una
 * stanza puo' essere all'aperto (`outdoor`, #251), e la sua temperatura e'
 * quella di fuori:
 * - il sensore scelto (`riposo.sensore`) e' quello che e', ma se e' una sonda
 *   di una stanza all'aperto si scrive «fuori»;
 * - senza sensore scelto si prende la stanza della prima pagina; se quella e'
 *   all'aperto (il terrazzo, il giardino) per «in casa» si cerca la prima
 *   stanza al chiuso con una sonda, e solo se non ce n'e' nessuna si mostra
 *   quella del terrazzo, scritta «fuori».
 */
export function temperaturaDelMuro(muro, fonte = {}) {
  const stanze = elenco(fonte?.stanze);
  const sonde = (s) => unici([entita(s?.temp), ...elenco(s?.sonde).map(entita)]);
  const scelta = entita(muro?.riposo?.sensore);
  if (scelta)
    return {
      sonda: scelta,
      fuori: stanze.some((s) => s?.outdoor === true && sonde(s).includes(scelta)),
    };
  const nome = muro?.pagine?.[0]?.stanza;
  const stanza = nome ? stanze.find((s) => s?.name === nome) || null : null;
  if (!stanza) return { sonda: "", fuori: false };
  if (stanza.outdoor !== true) return { sonda: entita(stanza.temp), fuori: false };
  const dentro = stanze.find((s) => s?.outdoor !== true && entita(s?.temp));
  if (dentro) return { sonda: entita(dentro.temp), fuori: false };
  const suo = entita(stanza.temp);
  return { sonda: suo, fuori: Boolean(suo) };
}

/** I comandi che la pagina mostra adesso: quelli scelti, o quelli proposti.
 *
 * `aCoppia` dice, per entita', se e' un termostato a coppia (il caldo e il
 * freddo coi loro due numeri): nella pagina Clima quelli vanno nella
 * linguetta «Termostato» e in nessun'altra. Lo sa chi ha in mano gli stati —
 * la sezione — e non questo modulo, che di stati non ne vede; chi non lo dice
 * riceve le due linguette di sempre. */
export function comandiDellaPagina(pagina, fonte = {}, zona = "", { aCoppia = null } = {}) {
  if (!pagina) return [];
  if (pagina.modello === "personale") return pagina.comandi;
  if (pagina.modello === "clima")
    return comandiDellElenco(zona || pagina.zona || "freddo", fonte, { aCoppia });
  if (MODELLI_ELENCO.includes(pagina.modello)) return comandiDellElenco(pagina.modello, fonte);
  return pagina.scelti
    ? pagina.comandi
    : comandiProposti(fonte, pagina.stanza, postiDellaPagina(pagina));
}

/* Le pagine elenco: tutte le luci, il clima che raffresca, quello che scalda.
 * Non hanno tetto di sei: sul tablet la griglia scorre. */
export function comandiDellElenco(modello, fonte = {}, { aCoppia = null } = {}) {
  /* Tutto quello che la plancia chiama luce fa la card della luce, anche una
   * presa o un interruttore (`switch.*`): «nel wall le luci si vedono
   * diverse». Come nelle stanze, dove le luci proposte sono gia' tutte uguali. */
  if (modello === "luci")
    return elenco(fonte.luci).map((d) => {
      const comando = comandoPulito({ tipo: "luce", entita: d.entity });
      return comando && { ...comando, tipo: "luce" };
    });
  if (modello === "tapparelle")
    return elenco(fonte.tapparelle).map((d) =>
      comandoPulito({ tipo: "tapparella", entita: d.entity }),
    );
  /* Il termostato a coppia sta nella sua linguetta e fuori dalle altre due:
   * una card sola, coi due numeri insieme, invece di una in Caldo che muove
   * il caldo e una in Freddo che muove il freddo. */
  const doppio = (d) => typeof aCoppia === "function" && Boolean(aCoppia(d.entity));
  if (modello === "termostato")
    return elenco(fonte.clima)
      .filter(doppio)
      .map((d) => comandoPulito({ tipo: "clima", entita: d.entity }));
  if (modello === "freddo" || modello === "caldo")
    return elenco(fonte.clima)
      .filter((d) => !doppio(d) && zoneDelClima(d.tipo).includes(modello))
      .map((d) => comandoPulito({ tipo: "clima", entita: d.entity }));
  return [];
}

/* Un'azione che il tablet sa far partire da solo: le scene, gli script, i
 * tasti e gli interruttori. I pannelli gia' pronti della plancia (le luci, il
 * clima…) e i gruppi di luci aprono una finestra della plancia, e a muro non
 * ci sono. */
export function eUnaScena(azione) {
  return (
    Boolean(azione) && !["builtin", "luci_group"].includes(azione.type) && Boolean(azione.entity)
  );
}

/* Le scene proposte: le azioni che il tablet sa far partire. */
export function scenePropose(fonte = {}, posti = POSTI) {
  return elenco(fonte.azioni)
    .filter(eUnaScena)
    .slice(0, posti)
    .map((a) => scenaPulita({ azione: a.name }))
    .filter(Boolean);
}

const cercaAzione = (fonte, ...parole) =>
  elenco(fonte.azioni).find((a) => parole.some((p) => a.name.toLowerCase().includes(p)))?.name ||
  "";

/* La pagina Ambienti: una tessera per stanza, con quello che si sa di lei. Le
 * stanze senza sonde e senza luci non dicono niente, e non si mostrano. */
export function ambientiDellaFonte(fonte = {}) {
  return elenco(fonte.stanze)
    .map((stanza) => ({
      stanza,
      luci: elenco(fonte.luci)
        .filter((d) => diStanza(d, stanza))
        .map((d) => d.entity),
    }))
    .filter((a) => a.stanza.temp || a.stanza.hum || a.luci.length);
}

/** Le telecamere della pagina: tutte quelle della plancia di origine. */
export function telecamereDellaFonte(fonte = {}) {
  return elenco(fonte.telecamere).map((d) => ({ entita: d.entity, nome: testo(d.name) }));
}

export function ingressoProposto(fonte = {}) {
  /* Con piu' aree la pagina nuova non ne sceglie una: le mostra tutte, e
   * un'area aggiunta poi nella sezione Sicurezza compare da sola. */
  const centrali = elenco(fonte.centrali);
  return ingressoPulito({
    centrale: centrali.length === 1 ? centrali[0] : "",
    telecamera: elenco(fonte.telecamere)[0]?.entity || "",
    esco: cercaAzione(fonte, "esco", "uscita", "leave", "away"),
    rientro: cercaAzione(fonte, "rientro", "arrivo", "torno", "home"),
  });
}

/* ── il tempo: riposo, notte, tema ───────────────────────────────────────── */

const minutiDa = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

/** Se adesso e' notte per il tablet. La fascia puo' scavalcare la mezzanotte. */
export function eNotte(muro, adesso = new Date()) {
  if (!muro?.notte?.attiva) return false;
  const da = minutiDa(muro.notte.da);
  const a = minutiDa(muro.notte.a);
  const qui = adesso.getHours() * 60 + adesso.getMinutes();
  if (da === a) return false;
  return da < a ? qui >= da && qui < a : qui >= da || qui < a;
}

/**
 * Il tema da usare: quello della plancia, uno fisso, o «con l'orario» —
 * chiaro dalle sette alle diciannove, scuro il resto.
 */
export function temaDelMomento(muro, adesso = new Date(), temaDellaPlancia = "dark") {
  const tema = muro?.tema || "plancia";
  if (tema === "scuro") return "dark";
  if (tema === "chiaro") return "light";
  if (tema === "orario") {
    const h = adesso.getHours();
    return h >= 7 && h < 19 ? "light" : "dark";
  }
  return temaDellaPlancia === "light" ? "light" : "dark";
}

/** Orizzontale o verticale, per questo schermo e questa scelta. */
export function verso(muro, larghezza, altezza) {
  if (muro?.orientamento === "orizzontale") return "orizzontale";
  if (muro?.orientamento === "verticale") return "verticale";
  return Number(larghezza) >= Number(altezza) ? "orizzontale" : "verticale";
}

/* La misura su cui sono disegnate le pagine. Lo schermo vero si riempie
 * tutto: la griglia si allunga o si allarga, e i testi crescono col lato
 * corto, cosi' un 7" resta leggibile e un 15" non diventa un cartellone. */
export const MISURA = Object.freeze({
  orizzontale: { larghezza: 1280, altezza: 800 },
  verticale: { larghezza: 800, altezza: 1280 },
});

/* Gli schermi piccoli — un NSPanel Pro da 4,7" o quello quadrato da 4" —
 * non sono un tablet rimpicciolito: la griglia da tablet ci entrerebbe solo
 * con le scritte a cinque pixel. Sotto i seicento pixel sul lato corto il
 * pannello passa alla forma compatta: tessere grandi con un tocco solo, e il
 * resto nella finestra che si apre. */
export const LATO_COMPATTO = 600;
export function eCompatto(larghezza, altezza) {
  return Math.min(Number(larghezza) || 0, Number(altezza) || 0) < LATO_COMPATTO;
}

export function scala(versoScelto, larghezza, altezza) {
  if (eCompatto(larghezza, altezza)) {
    const s = Math.min(Number(larghezza), Number(altezza)) / 420;
    return Number.isFinite(s) && s > 0 ? Math.max(0.75, Math.min(s, 1.4)) : 1;
  }
  const base = MISURA[versoScelto] || MISURA.orizzontale;
  const s = Math.min(Number(larghezza) / base.larghezza, Number(altezza) / base.altezza);
  return Number.isFinite(s) && s > 0 ? Math.max(0.45, Math.min(s, 1.6)) : 1;
}

/* ── la batteria del tablet ──────────────────────────────────────────────
 *
 * «Nella schermata idle della plancia a muro mettere la possibilita' di
 * visualizzare la % di carica della batteria e/o se e' sotto carica o no.»
 * Un tablet a muro vive attaccato al caricatore, e quando il caricatore si
 * stacca lo si scopre a tablet spento. Il riposo lo dice, piccolo, accanto
 * alla data.
 *
 * Da dove si legge, in ordine:
 * - le entita' scelte nel config — il `sensor.<tablet>_battery_level` e il
 *   `binary_sensor.<tablet>_is_charging` (o il `sensor.<tablet>_battery_state`)
 *   della Companion App: sono quelle che chi ha scelto vuole vedere;
 * - il browser del tablet (`navigator.getBattery`), che la WebView di Android
 *   e Chrome danno da soli, senza configurare niente.
 * Senza un numero non si mostra niente: un'icona vuota non dice nulla. */

/* Gli stati che vogliono dire «staccato»: la Companion App li scrive cosi' su
 * Android, con lo spazio su iOS. */
const SCARICA = new Set(["discharging", "not_charging", "unplugged", "off", "false"]);
const IGNOTI = new Set(["", "unknown", "unavailable", "none"]);
export const BATTERIA_BASSA = 20;

/** In carica? `true`, `false`, o `null` quando lo stato non lo dice. */
export function inCaricaDaStato(valore) {
  const s = String(valore ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (IGNOTI.has(s)) return null;
  if (s === "on" || s === "true" || isCharging(s)) return true;
  if (SCARICA.has(s)) return false;
  return null;
}

const percento = (valore) => {
  if (valore === null || valore === undefined || String(valore).trim() === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? Math.round(Math.max(0, Math.min(100, n))) : null;
};

/** Quello che dice il browser (`BatteryManager`): livello da 0 a 1. */
export function batteriaDalBrowser(manager) {
  if (!manager || typeof manager !== "object") return null;
  const livello = Number(manager.level);
  if (!Number.isFinite(livello)) return null;
  return {
    livello: percento(livello * 100),
    inCarica: typeof manager.charging === "boolean" ? manager.charging : null,
  };
}

/**
 * La batteria da mostrare sul riposo, o `null` se non c'e' niente da dire.
 *
 * `browser` e' quello che `batteriaDalBrowser` ha letto (o `null`). Se
 * l'entita' scelta ha un numero vince lei; la carica viene dall'entita' della
 * carica, poi dagli attributi del sensore del livello, e — solo se anche il
 * livello e' del browser — dal browser: mescolare il livello di un tablet con
 * la spina di un altro schermo che fa l'anteprima sarebbe peggio di niente.
 */
export function batteriaDelTablet(muro, stati = {}, browser = null) {
  const scelta = muro?.batteria;
  if (!scelta?.attiva) return null;
  const sensore = scelta.livello ? stati?.[scelta.livello] : null;
  const daEntita = percento(sensore?.state);
  const caricaScelta = scelta.carica ? inCaricaDaStato(stati?.[scelta.carica]?.state) : null;
  if (daEntita !== null) {
    const attr = sensore?.attributes || {};
    const daAttributi =
      typeof attr.is_charging === "boolean"
        ? attr.is_charging
        : typeof attr.charging === "boolean"
          ? attr.charging
          : null;
    const inCarica = caricaScelta ?? daAttributi;
    return {
      livello: daEntita,
      inCarica,
      bassa: daEntita <= BATTERIA_BASSA && inCarica !== true,
      fonte: "entita",
    };
  }
  if (browser && browser.livello !== null && browser.livello !== undefined) {
    const inCarica = caricaScelta ?? browser.inCarica ?? null;
    return {
      livello: browser.livello,
      inCarica,
      bassa: browser.livello <= BATTERIA_BASSA && inCarica !== true,
      fonte: "browser",
    };
  }
  return null;
}

/** Il PIN scritto e' quello giusto? Un muro senza blocco si apre sempre. */
export function pinGiusto(muro, scritto) {
  if (!muro?.blocco?.attivo) return true;
  return String(scritto ?? "") === muro.blocco.pin;
}
