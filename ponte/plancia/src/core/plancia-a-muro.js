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

import { alarmHiddenModes, centraliAllarme, entitaDellaCentrale } from "./alarm-panel.js";
import { canonicalClimateType } from "./device-model.js";
import { ingressiScritti } from "./le-zone-della-centrale.js";
import { lettoriConfigurati } from "./media-player.js";
import { nomeDellaPersona, personViewModel } from "./person-model.js";

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
  return { tipo: tipoDellEntita(id), entita: id, ...aspetto };
}

/* Una scena: un'azione della plancia di origine o un'entita' qualunque — una
 * scena, uno script, un tasto — col nome, la riga sotto e il disegno. */
function scenaPulita(input) {
  if (!input || typeof input !== "object") return null;
  const tipo = input.tipo || (input.entita && !input.azione ? "entita" : "azione");
  const comando = comandoPulito({ ...input, tipo });
  if (!comando) return null;
  /* Nelle scene un'entita' e' sempre una tessera grande: anche una luce qui
   * e' «accendi», non il cursore. */
  return comando.entita ? { ...comando, tipo: "entita" } : comando;
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
  persone: true,
  finestre: true,
});

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
    persone: vero(dentro.persone, INGRESSO_VUOTO.persone),
    finestre: vero(dentro.finestre, INGRESSO_VUOTO.finestre),
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
  };
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
 * plancia di origine dalla sua sezione Energia. */
const ENERGIA_VUOTA = Object.freeze({ casa: "", solare: "", rete: "", batteria: "" });
function energiaPulita(input) {
  const dentro = input && typeof input === "object" ? input : {};
  return Object.fromEntries(Object.keys(ENERGIA_VUOTA).map((k) => [k, entita(dentro[k])]));
}

/** Le misure dell'energia: quelle scelte, e le altre dalla plancia di origine. */
export function energiaDellaPagina(pagina, fonte = {}) {
  const scelte = pagina?.energia || {};
  const sue = fonte?.energia || {};
  return Object.fromEntries(Object.keys(ENERGIA_VUOTA).map((k) => [k, scelte[k] || sue[k] || ""]));
}

export const MURO_VUOTO = Object.freeze({
  attiva: false,
  fonte: PROFILO_DI_ORIGINE,
  orientamento: "auto",
  tema: "plancia",
  meteo: "",
  riposo: { attivo: true, minuti: 2, torna: true, sensore: "" },
  notte: { attiva: false, da: "23:00", a: "06:30" },
  avvisi: true,
  avvisiGrandi: true,
  risveglio: { attivo: false, entita: "" },
  blocco: { attivo: false, pin: "" },
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
    riposo: {
      attivo: vero(riposo.attivo, true),
      minuti: MINUTI_DI_RIPOSO.includes(minuti) ? minuti : 2,
      /* Al riposo il tablet torna alla prima pagina, o resta dov'era. */
      torna: vero(riposo.torna, true),
      /* La temperatura «in casa» del riposo: vuoto, quella della prima stanza. */
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
  const misura = (chiave) => entita(overrides[`dm.energy_${chiave}`]);
  return {
    /* Le misure dell'energia che la plancia di origine ha gia' scelto. */
    energia: {
      casa: misura("potenza_consumo_casa"),
      solare: misura("potenza_fotovoltaico"),
      rete: misura("potenza_scambio_rete"),
      batteria: misura("stato_carica_batteria"),
    },
    /* I lettori della sezione Musica, per la pagina Musica. */
    lettori: lettoriConfigurati(elenco(altro.lettori))
      .filter((l) => entita(l.entity))
      /* Con gli «altri comandi» scelti accanto al lettore: «quelli che ho
       * abilitato nella plancia li vedo, nel pannello no». */
      .map((l) => ({
        entity: entita(l.entity),
        nome: testo(l.nome),
        comandi: elenco(l.comandi).map(entita).filter(Boolean),
      })),
    stanze: elenco(sezioni.rooms)
      .filter((s) => s && testo(s.name))
      .map((s) => ({
        id: testo(s.id, 80),
        name: testo(s.name),
        temp: entita(s.temp),
        hum: entita(s.hum),
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
    persone: elenco(altro.persone)
      .filter((p) => p && entita(p.entity) && p.nascosta !== true)
      .map((p) => ({ entity: entita(p.entity), name: testo(p.name) })),
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
  const elencoDelMuro = configurate.length
    ? configurate
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

/** Il nome di casa di una persona della plancia di origine, se e' in elenco. */
export function nomeDellaPersonaDelMuro(id, fonte = {}, stati = {}) {
  const persona = elenco(fonte?.persone).find((p) => p && p.entity === id);
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

/** I comandi che la pagina mostra adesso: quelli scelti, o quelli proposti. */
export function comandiDellaPagina(pagina, fonte = {}, zona = "") {
  if (!pagina) return [];
  if (pagina.modello === "personale") return pagina.comandi;
  if (pagina.modello === "clima") return comandiDellElenco(zona || pagina.zona || "freddo", fonte);
  if (MODELLI_ELENCO.includes(pagina.modello)) return comandiDellElenco(pagina.modello, fonte);
  return pagina.scelti
    ? pagina.comandi
    : comandiProposti(fonte, pagina.stanza, postiDellaPagina(pagina));
}

/* Le pagine elenco: tutte le luci, il clima che raffresca, quello che scalda.
 * Non hanno tetto di sei: sul tablet la griglia scorre. */
export function comandiDellElenco(modello, fonte = {}) {
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
  if (modello === "freddo" || modello === "caldo")
    return elenco(fonte.clima)
      .filter((d) => zoneDelClima(d.tipo).includes(modello))
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
  return ingressoPulito({
    centrale: elenco(fonte.centrali)[0] || "",
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

/** Il PIN scritto e' quello giusto? Un muro senza blocco si apre sempre. */
export function pinGiusto(muro, scritto) {
  if (!muro?.blocco?.attivo) return true;
  return String(scritto ?? "") === muro.blocco.pin;
}
