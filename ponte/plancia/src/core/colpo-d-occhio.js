/* «Colpo d'occhio»: la plancia di una pagina sola.
 *
 * Dal campo: «una pagina unica, senza sezioni, ma con popup diretti per
 * vedere i dati». In cima il nome della casa, l'ora e se e' collegata; sotto
 * il meteo, che toccato apre le previsioni dei sette giorni e di ogni ora; poi
 * i riquadri grandi. Ognuno fa una cosa sola: il fotovoltaico apre il flusso
 * dell'energia (adesso, oggi, questo mese), le telecamere aprono la griglia e
 * da li' il video dal vivo, l'antifurto apre i suoi tasti, il cancello si apre
 * con un tocco.
 *
 * E alla creazione si sceglie da dove parte: «seguire il config della plancia
 * principale oppure partire da zero». Dalla principale prende le misure
 * dell'energia, le telecamere, l'antifurto, il meteo e i tasti che aprono
 * qualcosa; da zero nasce coi riquadri vuoti, da riempire nel Config.
 *
 * Il modulo e' puro: pulisce il config e lo propone, non chiama niente.
 */

import { vuoleIlVivo } from "./telecamera-dal-vivo.js";

export const CHIAVE_OCCHIO = "cd_occhio";

/* I riquadri che la plancia sa disegnare, e cosa apre ognuno. */
export const TIPI_DI_RIQUADRO = Object.freeze(["energia", "telecamere", "antifurto", "apri"]);
export const RIQUADRI_AL_MASSIMO = 12;
export const TELECAMERE_AL_MASSIMO = 24;
export const MODI_AL_MASSIMO = 6;

/* Il disegno e il colore di serie di ogni riquadro: quelli della dashboard da
 * cui nasce l'idea, gli stessi della plancia per le stesse cose. */
export const SERIE_DEI_RIQUADRI = Object.freeze({
  energia: { disegno: "solar", colore: "#f59e0b" },
  telecamere: { disegno: "camera", colore: "#06b6d4" },
  antifurto: { disegno: "security", colore: "#7c3aed" },
  apri: { disegno: "gate", colore: "#059669" },
});

/* I colori di serie dei modi dell'antifurto, nell'ordine. */
const COLORI_DEI_MODI = ["#7c3aed", "#f59e0b", "#06b6d4", "#e11d48", "#10b981", "#2563eb"];

const clean = (valore) => String(valore ?? "").trim();
const testo = (valore, quanto = 60) => clean(valore).slice(0, quanto);
const elenco = (valore) => (Array.isArray(valore) ? valore : []);
const vero = (valore, ripiego) => (typeof valore === "boolean" ? valore : ripiego);

/** Un entity_id, o "" se non lo e'. */
export function entita(valore) {
  const id = clean(valore);
  return /^[a-z_]+\.[a-z0-9_]+$/i.test(id) && id.length <= 255 ? id : "";
}

const dominio = (id) => entita(id).split(".")[0] || "";

const colore = (valore, ripiego) => {
  const c = clean(valore);
  return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : ripiego;
};

/* Il nome di un disegno del catalogo: lettere, cifre e trattini. */
const disegno = (valore, ripiego) => {
  const d = clean(valore);
  return /^[a-z0-9_-]{1,32}$/i.test(d) ? d : ripiego;
};

let contatore = 0;
const nuovoId = () => `r${Date.now().toString(36)}${(contatore++).toString(36)}`.slice(0, 24);

/** Le misure dell'energia: adesso (potenze), oggi e questo mese (kWh). */
export function energiaPulita(grezza = {}) {
  const e = grezza && typeof grezza === "object" ? grezza : {};
  const periodo = (p = {}) => ({
    solare: entita(p?.solare),
    casa: entita(p?.casa),
    comprata: entita(p?.comprata),
    venduta: entita(p?.venduta),
    carica: entita(p?.carica),
    scarica: entita(p?.scarica),
  });
  return {
    solare: entita(e.solare),
    casa: entita(e.casa),
    /* La rete con segno — positiva quando si preleva — o due misure, una per
     * verso. Lo stesso per la batteria: positiva quando scarica. */
    rete: entita(e.rete),
    reteGirata: vero(e.reteGirata, false),
    prelievo: entita(e.prelievo),
    immissione: entita(e.immissione),
    batteria: entita(e.batteria),
    batteriaGirata: vero(e.batteriaGirata, false),
    carica: entita(e.carica),
    scarica: entita(e.scarica),
    soc: entita(e.soc),
    giorno: periodo(e.giorno),
    mese: periodo(e.mese),
  };
}

/** Un modo dell'antifurto: un tasto grande che inserisce o disinserisce. */
export function modoPulito(grezzo = {}, indice = 0) {
  const m = grezzo && typeof grezzo === "object" ? grezzo : {};
  const id = entita(m.entita);
  if (!id) return null;
  return {
    entita: id,
    /* Dove si legge se e' inserito: di serie l'entita' stessa. */
    stato: entita(m.stato) || id,
    nome: testo(m.nome, 40),
    disegno: disegno(m.disegno, "security"),
    colore: colore(m.colore, COLORI_DEI_MODI[indice % COLORI_DEI_MODI.length]),
  };
}

/** Un riquadro della pagina. */
export function riquadroPulito(grezzo = {}, indice = 0) {
  const r = grezzo && typeof grezzo === "object" ? grezzo : {};
  const tipo = TIPI_DI_RIQUADRO.includes(r.tipo) ? r.tipo : "";
  if (!tipo) return null;
  const serie = SERIE_DEI_RIQUADRI[tipo];
  return {
    id: /^[a-z0-9_-]{1,24}$/i.test(clean(r.id)) ? clean(r.id) : `r${indice + 1}`,
    tipo,
    nome: testo(r.nome, 30),
    disegno: disegno(r.disegno, serie.disegno),
    colore: colore(r.colore, serie.colore),
    /* Solo per «apri»: cosa si apre, e se chiede prima. */
    entita: tipo === "apri" ? entita(r.entita) : "",
    conferma: tipo === "apri" ? vero(r.conferma, false) : false,
  };
}

export const OCCHIO_VUOTO = Object.freeze({
  attiva: false,
  titolo: "",
  sottotitolo: "",
  meteo: "",
  riquadri: [],
  energia: energiaPulita({}),
  telecamere: [],
  antifurto: { centrale: "", modi: [] },
});

/** Il config pulito, da qualunque cosa ci sia in memoria. */
export function occhioPulito(input) {
  let dentro = input;
  if (typeof dentro === "string") {
    try {
      dentro = JSON.parse(dentro);
    } catch {
      dentro = null;
    }
  }
  if (!dentro || typeof dentro !== "object" || Array.isArray(dentro)) dentro = {};
  const visti = new Set();
  const riquadri = elenco(dentro.riquadri)
    .slice(0, RIQUADRI_AL_MASSIMO)
    .map((r, i) => riquadroPulito(r, i))
    .filter(Boolean)
    .map((r, i) => {
      const fuori = visti.has(r.id) ? { ...r, id: `r${i + 1}${nuovoId()}`.slice(0, 24) } : r;
      visti.add(fuori.id);
      return fuori;
    });
  const telecamereViste = new Set();
  const telecamere = elenco(dentro.telecamere)
    .map((c) => ({
      entity: entita(c?.entity),
      nome: testo(c?.nome, 40),
      /* Il nome dello stream di go2rtc, per il video WebRTC: facoltativo. */
      stream: /^[a-z0-9_.-]{1,64}$/i.test(clean(c?.stream)) ? clean(c.stream) : "",
      /* «Dal vivo» come nella plancia principale: il flusso continuo al posto
       * delle istantanee ogni quattro secondi. */
      vivo: vero(c?.vivo, false),
    }))
    /* Una telecamera ripetuta conta una volta sola, la prima. */
    .filter((c) => {
      if (dominio(c.entity) !== "camera" || telecamereViste.has(c.entity)) return false;
      telecamereViste.add(c.entity);
      return true;
    })
    .slice(0, TELECAMERE_AL_MASSIMO);
  const antifurto =
    dentro.antifurto && typeof dentro.antifurto === "object" ? dentro.antifurto : {};
  const centrale = entita(antifurto.centrale);
  return {
    attiva: vero(dentro.attiva, false),
    titolo: testo(dentro.titolo, 40),
    sottotitolo: testo(dentro.sottotitolo, 60),
    meteo: dominio(dentro.meteo) === "weather" ? entita(dentro.meteo) : "",
    riquadri,
    energia: energiaPulita(dentro.energia),
    telecamere,
    antifurto: {
      centrale: dominio(centrale) === "alarm_control_panel" ? centrale : "",
      modi: elenco(antifurto.modi)
        .map((m, i) => modoPulito(m, i))
        .filter(Boolean)
        .slice(0, MODI_AL_MASSIMO),
    },
  };
}

/** Un riquadro nuovo del tipo scelto, coi suoi colori di serie. */
export function nuovoRiquadro(tipo, campi = {}) {
  return riquadroPulito({ id: nuovoId(), tipo, ...campi });
}

/* I tasti della plancia principale che aprono qualcosa: un cancello, un
 * portone, il garage. Si riconoscono dal dominio — si premono, si aprono — e
 * dal nome, perche' «Scena cena» e' un tasto anche lei e non apre niente. */
const DOMINI_CHE_APRONO = new Set(["button", "input_button", "switch", "lock", "cover", "script"]);
const NOMI_CHE_APRONO =
  /cancell|portone|portoncino|porta|garage|basculante|sbarra|varco|gate|door|apri/i;

function tastiCheAprono(azioni = []) {
  return elenco(azioni)
    .map((a) => ({ nome: testo(a?.name, 30), entita: entita(a?.entity) }))
    .filter(
      (a) => a.entita && DOMINI_CHE_APRONO.has(dominio(a.entita)) && NOMI_CHE_APRONO.test(a.nome),
    );
}

/* I modi dell'antifurto dalla plancia principale: quelli su misura se ci sono
 * (un interruttore per modalita', come nella dashboard da cui nasce l'idea),
 * se no la centrale vera, coi suoi inserimenti. */
function antifurtoDallaFonte(fonte = {}) {
  const suMisura = elenco(fonte.antifurto?.suMisura)
    .map((m, i) =>
      modoPulito(
        {
          entita: m?.entita,
          stato: m?.stato,
          nome: m?.nome,
          disegno: /^[a-z0-9_-]+$/i.test(clean(m?.icona)) ? m.icona : "",
        },
        i,
      ),
    )
    .filter(Boolean)
    .slice(0, MODI_AL_MASSIMO);
  const centrali = elenco(fonte.centrali);
  return { centrale: suMisura.length ? "" : centrali[0] || "", modi: suMisura };
}

/**
 * La plancia appena nata.
 *
 * `fonte` e' quella della plancia principale (vedi `fonteDaiValori` della
 * plancia a muro): con lei i riquadri nascono gia' pieni di quello che la
 * principale sa. Senza — «partire da zero» — nasce accesa e coi quattro
 * riquadri da riempire.
 */
export function occhioDiPartenza(fonte = null) {
  if (!fonte) {
    return occhioPulito({
      attiva: true,
      riquadri: TIPI_DI_RIQUADRO.map((tipo) => nuovoRiquadro(tipo)),
    });
  }
  const e = fonte.energia || {};
  const energia = energiaPulita({
    solare: e.solare,
    casa: e.casa,
    rete: e.rete,
    reteGirata: e.reteGirata,
    prelievo: e.prelievo,
    immissione: e.immissione,
    batteria: e.potenzaBatteria,
    batteriaGirata: e.batteriaGirata,
    carica: e.carica,
    scarica: e.scarica,
    soc: e.batteria,
  });
  const telecamere = elenco(fonte.telecamere).map((c) => ({
    entity: c?.entity,
    nome: c?.name,
    stream: c?.stream,
    vivo: vuoleIlVivo(c),
  }));
  const antifurto = antifurtoDallaFonte(fonte);
  const aprono = tastiCheAprono(fonte.azioni);
  const riquadri = [];
  if (energia.solare || energia.casa || energia.rete || energia.prelievo)
    riquadri.push(nuovoRiquadro("energia"));
  if (telecamere.length) riquadri.push(nuovoRiquadro("telecamere"));
  if (antifurto.centrale || antifurto.modi.length) riquadri.push(nuovoRiquadro("antifurto"));
  for (const tasto of aprono.slice(0, 4))
    riquadri.push(nuovoRiquadro("apri", { nome: tasto.nome, entita: tasto.entita }));
  /* Una principale vuota da' una plancia vuota: meglio i quattro riquadri da
   * riempire che una pagina col solo meteo. */
  if (!riquadri.length) for (const tipo of TIPI_DI_RIQUADRO) riquadri.push(nuovoRiquadro(tipo));
  return occhioPulito({
    attiva: true,
    meteo: fonte.meteo,
    riquadri,
    energia,
    telecamere,
    antifurto,
  });
}

/* ── le letture ─────────────────────────────────────────────────────────── */

const MUTI = new Set(["unavailable", "unknown", "none", ""]);

/** Il numero di un'entita', o `null` se non ne ha uno. */
export function numeroDi(states, id) {
  const s = states?.[entita(id)];
  const v = clean(s?.state);
  if (!s || MUTI.has(v.toLowerCase())) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* Watt da qualunque unita' di potenza Home Assistant dichiari. */
function watt(states, id) {
  const n = numeroDi(states, id);
  if (n === null) return null;
  const unita = clean(states?.[id]?.attributes?.unit_of_measurement).toLowerCase();
  return unita === "kw" ? n * 1000 : unita === "mw" ? n * 1_000_000 : n;
}

/* Kilowattora da Wh, kWh o MWh. */
function kwh(states, id) {
  const n = numeroDi(states, id);
  if (n === null) return null;
  const unita = clean(states?.[id]?.attributes?.unit_of_measurement).toLowerCase();
  return unita === "wh" ? n / 1000 : unita === "mwh" ? n * 1000 : n;
}

/* Una misura con segno divisa nei suoi due versi, o due misure gia' divise. */
function dueVersi(states, conSegno, girata, unaParte, altraParte) {
  if (entita(unaParte) || entita(altraParte)) {
    return {
      uno: Math.max(0, watt(states, unaParte) ?? 0),
      altro: Math.max(0, watt(states, altraParte) ?? 0),
      noto: watt(states, unaParte) !== null || watt(states, altraParte) !== null,
    };
  }
  const v = watt(states, conSegno);
  if (v === null) return { uno: 0, altro: 0, noto: false };
  const s = girata ? -v : v;
  return { uno: Math.max(0, s), altro: Math.max(0, -s), noto: true };
}

/* Sotto queste soglie il flusso non c'e': un inverter di notte dice 3 W. */
const SOGLIA_W = 30;
const SOGLIA_KWH = 0.05;

/**
 * Il flusso dell'energia per un periodo: `adesso` (W), `giorno` o `mese` (kWh).
 *
 * Ogni nodo ha il suo numero (o `null` quando non si sa), e le linee dicono
 * dove passa energia: dal sole alla casa, alla rete, alla batteria; dalla rete
 * alla casa; dalla batteria alla casa.
 */
export function flussoDellEnergia(config, states = {}, periodo = "adesso") {
  const e = energiaPulita(config?.energia || config || {});
  const soc = numeroDi(states, e.soc);
  if (periodo === "giorno" || periodo === "mese") {
    const p = e[periodo];
    const leggi = (id) => (entita(id) ? kwh(states, id) : null);
    const n = {
      solare: leggi(p.solare),
      casa: leggi(p.casa),
      comprata: leggi(p.comprata),
      venduta: leggi(p.venduta),
      carica: leggi(p.carica),
      scarica: leggi(p.scarica),
    };
    const c = (v) => (v ?? 0) > SOGLIA_KWH;
    return {
      periodo,
      unita: "kWh",
      soc,
      nodi: n,
      linee: {
        soleCasa: c(n.solare) && c(n.casa),
        soleRete: c(n.solare) && c(n.venduta),
        soleBatteria: c(n.solare) && c(n.carica),
        reteCasa: c(n.comprata),
        batteriaCasa: c(n.scarica),
      },
      configurato: Object.values(p).some(Boolean),
    };
  }
  const solare = watt(states, e.solare);
  const casa = watt(states, e.casa);
  const rete = dueVersi(states, e.rete, e.reteGirata, e.prelievo, e.immissione);
  /* La batteria: positiva quando scarica, come la rete quando preleva. */
  const batt = dueVersi(states, e.batteria, e.batteriaGirata, e.scarica, e.carica);
  const n = {
    solare: solare === null ? null : Math.max(0, solare),
    casa: casa === null ? null : Math.max(0, casa),
    comprata: rete.noto ? rete.uno : null,
    venduta: rete.noto ? rete.altro : null,
    scarica: batt.noto ? batt.uno : null,
    carica: batt.noto ? batt.altro : null,
  };
  const c = (v, soglia = SOGLIA_W) => (v ?? 0) > soglia;
  return {
    periodo: "adesso",
    unita: "W",
    soc,
    nodi: n,
    linee: {
      soleCasa: c(n.solare) && c(n.casa),
      soleRete: c(n.solare) && c(n.venduta, 50),
      soleBatteria: c(n.solare) && c(n.carica),
      reteCasa: c(n.comprata, 50),
      batteriaCasa: c(n.scarica),
    },
    configurato: Boolean(e.solare || e.casa || e.rete || e.prelievo || e.batteria || e.scarica),
  };
}

/** I periodi che hanno qualcosa da dire, nell'ordine delle linguette. */
export function periodiDellEnergia(config) {
  const e = energiaPulita(config?.energia || {});
  const fuori = [];
  if (e.solare || e.casa || e.rete || e.prelievo || e.batteria || e.scarica) fuori.push("adesso");
  if (Object.values(e.giorno).some(Boolean)) fuori.push("giorno");
  if (Object.values(e.mese).some(Boolean)) fuori.push("mese");
  return fuori;
}

/** Il servizio che apre: un tasto si preme, una serratura si sblocca. */
export function servizioPerAprire(id) {
  const d = dominio(id);
  if (d === "button" || d === "input_button") return { domain: d, service: "press" };
  if (d === "lock") return { domain: d, service: "unlock" };
  if (d === "cover") return { domain: d, service: "open_cover" };
  if (d === "script" || d === "scene") return { domain: d, service: "turn_on" };
  if (d === "switch" || d === "input_boolean") return { domain: d, service: "turn_on" };
  return null;
}

/** Il servizio che inserisce o disinserisce un modo su misura. */
export function servizioDelModo(modo, acceso) {
  const id = entita(modo?.entita);
  const d = dominio(id);
  if (d === "switch" || d === "input_boolean")
    return { domain: d, service: acceso ? "turn_off" : "turn_on" };
  if (d === "button" || d === "input_button") return { domain: d, service: "press" };
  if (d === "script" || d === "scene") return { domain: d, service: "turn_on" };
  if (d === "automation") return { domain: d, service: "trigger" };
  return null;
}

/** Se un modo e' inserito adesso. */
export function modoInserito(modo, states = {}) {
  const v = clean(states?.[modo?.stato || modo?.entita]?.state).toLowerCase();
  return v === "on" || v === "armed" || v.startsWith("armed_");
}
