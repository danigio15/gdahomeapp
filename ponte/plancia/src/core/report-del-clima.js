/* Il report del riscaldamento e del raffrescamento.
 *
 * «Sai cosa sarebbe carino: avere i report sul riscaldamento, tipo report
 * giornaliero/mensile sulle varie stanze di quanto sono state accese, con che
 * media di apertura valvola, quanto e' stata accesa la caldaia ecc. Un po'
 * come per la parte energia, report per ogni impianto ovviamente.»
 *
 * Qui dentro non si chiede niente a Home Assistant e non si disegna niente: si
 * prendono le righe della storia che la sezione ha gia' letto e se ne fanno
 * dei conti. Tutto quello che conta e' il tempo — quanto una stanza ha chiesto
 * calore, quanto e' rimasta accesa, quanto ha lavorato la caldaia — e il tempo
 * si conta a intervalli: ogni riga vale dal suo momento fino alla riga dopo.
 *
 * L'impianto e' quello che la pagina Clima mostra gia': il Caldo e il Freddo.
 * Il Riscaldamento prende i termosifoni, le pompe di calore e i termostati a
 * coppia quando scaldano; il Raffrescamento i condizionatori, le pompe di
 * calore e i termostati a coppia quando raffrescano. La caldaia — o le
 * caldaie, che possono essere due (#281) — sta col Riscaldamento.
 *
 * Quando la caldaia non e' configurata il suo tempo si stima: e' acceso
 * l'impianto quando almeno una stanza chiede. Il report lo scrive, perche' una
 * stima letta come una misura e' un numero sbagliato.
 */
import { accesoCaldaia } from "./impianti-termici.js";
import { letturaValvola } from "./valvola-trv.js";

const pulito = (valore) => String(valore ?? "").trim();
const ORA = 3_600_000;

/* ── il periodo ───────────────────────────────────────────────────────── */

export const VISTE_DEL_REPORT = Object.freeze(["giorno", "settimana", "mese"]);

const vistaValida = (vista) => (VISTE_DEL_REPORT.includes(vista) ? vista : "mese");

/* Il primo giorno della vista che contiene `giorno`, a mezzanotte locale.
 * La settimana comincia il lunedi', come la scrive chi la vive. */
function inizioDellaVista(vista, giorno) {
  const d = new Date(giorno);
  if (vista === "mese") return new Date(d.getFullYear(), d.getMonth(), 1);
  const inizio = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (vista === "settimana") inizio.setDate(inizio.getDate() - ((inizio.getDay() + 6) % 7));
  return inizio;
}

function dopoLaVista(vista, inizio) {
  const d = new Date(inizio);
  if (vista === "mese") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  d.setDate(d.getDate() + (vista === "settimana" ? 7 : 1));
  return d;
}

/**
 * Il periodo di una vista: da quando a quando, e i secchielli del grafico.
 *
 * Il giorno si divide in ore, la settimana e il mese in giorni. I secchielli
 * si fanno col calendario locale e non a passi di 3 600 000: il giorno del
 * cambio d'ora ne ha 23 o 25, e una barra delle 2 che vale due ore e' giusta.
 * `fine` e' l'adesso, quando il periodo e' quello in corso: il futuro non ha
 * ore da contare.
 */
export function periodoDelReport(vista, giorno = new Date(), adesso = new Date()) {
  const scelta = vistaValida(vista);
  const inizio = inizioDellaVista(scelta, giorno);
  const prossimo = dopoLaVista(scelta, inizio);
  const ora = new Date(adesso).getTime();
  const secchielli = [];
  const cursore = new Date(inizio);
  while (cursore < prossimo) {
    const da = cursore.getTime();
    if (scelta === "giorno") cursore.setHours(cursore.getHours() + 1);
    else cursore.setDate(cursore.getDate() + 1);
    secchielli.push({ inizio: da, fine: Math.min(cursore.getTime(), prossimo.getTime()) });
  }
  return {
    vista: scelta,
    inizio: inizio.getTime(),
    prossimo: prossimo.getTime(),
    fine: Math.max(inizio.getTime(), Math.min(prossimo.getTime(), ora)),
    passo: scelta === "giorno" ? "ora" : "giorno",
    secchielli,
    inCorso: ora < prossimo.getTime(),
    futuro: ora < inizio.getTime(),
  };
}

/** Il giorno di riferimento della vista prima (-1) o dopo (+1). */
export function spostaIlPeriodo(vista, giorno, verso) {
  const scelta = vistaValida(vista);
  const inizio = inizioDellaVista(scelta, giorno);
  const passo = verso < 0 ? -1 : 1;
  if (scelta === "mese") return new Date(inizio.getFullYear(), inizio.getMonth() + passo, 1);
  inizio.setDate(inizio.getDate() + passo * (scelta === "settimana" ? 7 : 1));
  return inizio;
}

/* ── le righe della storia ────────────────────────────────────────────── */

function istante(valore) {
  if (typeof valore === "number") return valore < 1_000_000_000_000 ? valore * 1000 : valore;
  const letto = Date.parse(pulito(valore));
  return Number.isFinite(letto) ? letto : null;
}

/**
 * Le righe di un'entita' come le danno le due forme della storia.
 *
 * Il websocket le manda compresse — `s`, `a`, `lu` in secondi — e senza gli
 * attributi quando non sono cambiati; l'interfaccia REST le manda per esteso.
 * Ne esce sempre `{ t, s, a }`, in ordine, con gli attributi portati avanti:
 * una riga senza `a` ha gli stessi di quella prima, non nessuno.
 */
export function righeDellaStoria(risposta, entity) {
  const id = pulito(entity);
  const grezze = Array.isArray(risposta)
    ? Array.isArray(risposta[0])
      ? risposta[0]
      : risposta
    : risposta?.[id] || [];
  const ordinate = (Array.isArray(grezze) ? grezze : [])
    .map((riga) => ({
      t: istante(riga?.lu ?? riga?.last_updated ?? riga?.lc ?? riga?.last_changed),
      s: pulito(riga?.s ?? riga?.state),
      a: riga?.a ?? riga?.attributes,
    }))
    .filter((riga) => riga.t !== null)
    .sort((x, y) => x.t - y.t);
  let attributi = {};
  return ordinate.map((riga) => {
    if (riga.a && typeof riga.a === "object") attributi = riga.a;
    return { t: riga.t, s: riga.s, a: attributi };
  });
}

/* ── gli intervalli ───────────────────────────────────────────────────── */

const MUTI = new Set(["", "unavailable", "unknown", "none"]);

/**
 * Gli intervalli in cui `vale(riga)` e' vero, dentro [inizio, fine).
 *
 * Ogni riga vale dal suo momento a quello della riga dopo; l'ultima fino a
 * `fine`. Una riga che sta prima di `inizio` — lo stato con cui il periodo
 * comincia — vale da `inizio`. Quando `vale` risponde `null` non si sa: quel
 * pezzo non conta ne' da una parte ne' dall'altra, ed entra nei buchi.
 */
export function intervalliDove(righe, inizio, fine, vale) {
  const veri = [];
  const noti = [];
  const elenco = Array.isArray(righe) ? righe : [];
  for (let i = 0; i < elenco.length; i += 1) {
    const da = Math.max(inizio, elenco[i].t);
    const a = Math.min(fine, i + 1 < elenco.length ? elenco[i + 1].t : fine);
    if (a <= da) continue;
    const esito = vale(elenco[i]);
    if (esito === null || esito === undefined) continue;
    noti.push([da, a]);
    if (esito) veri.push([da, a]);
  }
  return { veri: unisci(veri), noti: unisci(noti) };
}

/** Gli intervalli fusi: quelli che si toccano o si sovrappongono diventano uno. */
export function unisci(intervalli, tolleranza = 0) {
  const ordinati = [...(intervalli || [])]
    .filter(([da, a]) => a > da)
    .sort((x, y) => x[0] - y[0]);
  const fuori = [];
  for (const [da, a] of ordinati) {
    const ultimo = fuori.at(-1);
    if (ultimo && da <= ultimo[1] + tolleranza) ultimo[1] = Math.max(ultimo[1], a);
    else fuori.push([da, a]);
  }
  return fuori;
}

export function durata(intervalli) {
  return (intervalli || []).reduce((somma, [da, a]) => somma + (a - da), 0);
}

/** Quanto di ogni secchiello cade dentro gli intervalli, in millisecondi. */
export function durataNeiSecchielli(intervalli, secchielli) {
  return (secchielli || []).map(({ inizio, fine }) =>
    (intervalli || []).reduce(
      (somma, [da, a]) => somma + Math.max(0, Math.min(a, fine) - Math.max(da, inizio)),
      0,
    ),
  );
}

/* Due accensioni separate da un minuto di «non disponibile» sono una sola:
 * e' la caldaia che ha perso la rete, non che si e' spenta e riaccesa. */
export const PAUSA_CHE_NON_SPEGNE = 60_000;

/**
 * Le accensioni nel periodo: quante volte comincia un intervallo acceso.
 *
 * Quella gia' accesa a mezzanotte non e' un'accensione di oggi: e' di ieri.
 */
export function accensioni(intervalli, inizio, tolleranza = PAUSA_CHE_NON_SPEGNE) {
  return unisci(intervalli, tolleranza).filter(([da]) => da > inizio).length;
}

/**
 * La media nel tempo di un numero: ogni lettura pesa quanto dura.
 *
 * Una media delle righe direbbe la temperatura delle ore in cui il sensore
 * parla tanto, non quella della stanza. `dove` restringe la media al tempo in
 * cui la riga lo merita — l'obiettivo conta solo nelle ore di comfort.
 */
export function mediaNelTempo(righe, inizio, fine, leggi, dove = () => true) {
  let somma = 0;
  let peso = 0;
  const elenco = Array.isArray(righe) ? righe : [];
  for (let i = 0; i < elenco.length; i += 1) {
    const da = Math.max(inizio, elenco[i].t);
    const a = Math.min(fine, i + 1 < elenco.length ? elenco[i + 1].t : fine);
    if (a <= da || !dove(elenco[i])) continue;
    const valore = leggi(elenco[i]);
    if (valore === null || valore === undefined || !Number.isFinite(valore)) continue;
    somma += valore * (a - da);
    peso += a - da;
  }
  return peso ? somma / peso : null;
}

/* ── cosa dice una riga ───────────────────────────────────────────────── */

export const IMPIANTI_DEL_CLIMA = Object.freeze(["caldo", "freddo"]);

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/* Le modalita' che non sono di questo impianto: una pompa di calore in
 * «cool» e' accesa, ma non per il Riscaldamento. */
const MODI_ESTRANEI = Object.freeze({
  caldo: new Set(["cool", "dry", "fan_only"]),
  freddo: new Set(["heat"]),
});

/** Se la stanza e' accesa per questo impianto; `null` se non si sa. */
export function accesaPer(impianto, riga) {
  const stato = pulito(riga?.s).toLowerCase();
  if (MUTI.has(stato)) return null;
  if (stato === "off") return false;
  return !MODI_ESTRANEI[impianto]?.has(stato);
}

/* Le parole di `hvac_action` che vogliono dire «sto lavorando per te». */
const AZIONI = Object.freeze({
  caldo: new Set(["heating", "preheating", "defrosting"]),
  freddo: new Set(["cooling"]),
});

export function obiettivoDellaRiga(impianto, riga) {
  const a = riga?.a || {};
  const unico = numero(a.temperature);
  if (unico !== null) return unico;
  return numero(impianto === "freddo" ? a.target_temp_high : a.target_temp_low);
}

export const ambienteDellaRiga = (riga) => numero(riga?.a?.current_temperature);

/**
 * Se la stanza chiede: calore per il Riscaldamento, fresco per l'altro.
 *
 * Lo dice `hvac_action`, quando c'e'. Non tutti lo pubblicano: allora lo
 * dice la valvola aperta, e senza valvola il confronto fra la stanza e il suo
 * obiettivo — una stima, e la riga lo porta scritto (`stimata`).
 */
export function chiedePer(impianto, riga, valvola = null) {
  const accesa = accesaPer(impianto, riga);
  if (accesa === null) return null;
  if (!accesa) return false;
  const azione = pulito(riga?.a?.hvac_action).toLowerCase();
  if (azione) return AZIONI[impianto]?.has(azione) ?? false;
  if (valvola !== null && valvola !== undefined) return valvola > 0;
  const ambiente = ambienteDellaRiga(riga);
  const obiettivo = obiettivoDellaRiga(impianto, riga);
  if (ambiente === null || obiettivo === null) return null;
  return impianto === "freddo" ? ambiente > obiettivo : ambiente < obiettivo;
}

const DOMINIO = (entity) => pulito(entity).split(".")[0];

/* Sotto questi watt una caldaia e' una scheda accesa, non un bruciatore. */
export const SOGLIA_WATT_DEL_GENERATORE = 20;

/**
 * Se il generatore lavora, da una sua riga.
 *
 * Va bene quasi tutto: un interruttore, un binary_sensor, la parola di una
 * centralina (le stesse che riconosce la scena della caldaia), un `climate`
 * col suo `hvac_action`, o un sensore di potenza oltre la soglia. Una
 * percentuale — la modulazione — lavora quando non e' zero.
 */
export function generatoreAcceso(entity, riga, impianto = "caldo") {
  const stato = pulito(riga?.s);
  if (MUTI.has(stato.toLowerCase())) return null;
  if (DOMINIO(entity) === "climate") {
    const azione = pulito(riga?.a?.hvac_action).toLowerCase();
    if (azione) return AZIONI[impianto]?.has(azione) ?? false;
    return stato.toLowerCase() !== "off";
  }
  const valore = numero(stato);
  if (valore !== null && !["switch", "binary_sensor", "input_boolean"].includes(DOMINIO(entity))) {
    const unita = pulito(riga?.a?.unit_of_measurement).toLowerCase();
    if (unita === "w") return valore > SOGLIA_WATT_DEL_GENERATORE;
    if (unita === "kw") return valore * 1000 > SOGLIA_WATT_DEL_GENERATORE;
    return valore > 0;
  }
  return accesoCaldaia(stato);
}

/* ── il report ────────────────────────────────────────────────────────── */

/**
 * Le unita' di un impianto, una per entita'.
 *
 * Arrivano da `climateUnits()`, che ne fa una per zona: la pompa di calore
 * compare in Freddo e in Caldo, il termostato a coppia nella sua. Il
 * Riscaldamento prende Caldo e Termostato, il Raffrescamento Freddo e
 * Termostato.
 */
export function unitaDellImpianto(impianto, unita = []) {
  const zone = impianto === "freddo" ? ["freddo", "termostato"] : ["caldo", "termostato"];
  const viste = new Set();
  return (unita || []).filter((u) => {
    const entity = pulito(u?.entity);
    if (!entity || !zone.includes(u?.zone) || viste.has(entity)) return false;
    viste.add(entity);
    return true;
  });
}

/** Gli impianti che ci sono, nell'ordine della pagina: prima il caldo. */
export function impiantiPresenti(unita = []) {
  return IMPIANTI_DEL_CLIMA.filter((id) => unitaDellImpianto(id, unita).length > 0);
}

/* Sotto questa quota di tempo coperto il numero di una stanza non dice
 * quanto e' stata accesa: dice quanto Home Assistant ne ha sentito. */
export const COPERTURA_MINIMA = 0.5;

function valvolaDellaRiga(riga) {
  return letturaValvola({ stato: null, attributi: riga?.a })?.aperta ?? null;
}

function valvolaDallEntita(riga) {
  return letturaValvola({ stato: { state: riga?.s }, attributi: riga?.a })?.aperta ?? null;
}

/* La valvola che vale in un momento, dalle sue righe: l'ultima prima. */
function valvolaAl(righe, momento) {
  let trovata = null;
  for (const riga of righe) {
    if (riga.t > momento) break;
    trovata = valvolaDallEntita(riga);
  }
  return trovata;
}

/* ── il comfort ───────────────────────────────────────────────────────
 *
 * L'obiettivo medio di tutte le ore accese mescolava il giorno e la notte:
 * una stanza a 21° di giorno e 17° di notte faceva «obiettivo 17,7°» accanto
 * a una temperatura di 20,9°, e sembrava una casa troppo calda. Il confronto
 * giusto e' fra la stanza e il suo obiettivo quando la si vuole calda.
 *
 * Il comfort e' il tempo in cui la stanza e' accesa con un obiettivo sopra
 * quello ridotto — il piu' basso che ha tenuto nel periodo, per il freddo il
 * piu' alto. Un termostato che non abbassa mai (tutti gli obiettivi entro
 * mezzo grado) e' in comfort tutto il tempo che e' acceso. Non serve sapere
 * il programma: lo dice la storia. */
export const SCARTO_DEL_RIDOTTO = 0.5;

/** Il predicato «questa riga e' in comfort», per le righe di una stanza. */
export function comfortDelleRighe(impianto, righe, inizio, fine) {
  const obiettivi = [];
  const elenco = Array.isArray(righe) ? righe : [];
  for (let i = 0; i < elenco.length; i += 1) {
    const da = Math.max(inizio, elenco[i].t);
    const a = Math.min(fine, i + 1 < elenco.length ? elenco[i + 1].t : fine);
    if (a <= da || accesaPer(impianto, elenco[i]) !== true) continue;
    const obiettivo = obiettivoDellaRiga(impianto, elenco[i]);
    if (obiettivo !== null) obiettivi.push(obiettivo);
  }
  if (!obiettivi.length) return () => false;
  const minimo = Math.min(...obiettivi);
  const massimo = Math.max(...obiettivi);
  const piatto = massimo - minimo < SCARTO_DEL_RIDOTTO;
  return (riga) => {
    if (accesaPer(impianto, riga) !== true) return false;
    const obiettivo = obiettivoDellaRiga(impianto, riga);
    if (obiettivo === null) return false;
    if (piatto) return true;
    return impianto === "freddo"
      ? obiettivo <= massimo - SCARTO_DEL_RIDOTTO
      : obiettivo >= minimo + SCARTO_DEL_RIDOTTO;
  };
}

/**
 * Il report di un impianto in un periodo.
 *
 * `storie` sono le righe gia' normalizzate (`righeDellaStoria`) per entita'.
 * `generatori` le caldaie: `{ nome, entity }`. Quando non ce n'e' nessuna con
 * una storia, il tempo dell'impianto e' la stima: l'unione delle richieste di
 * tutte le stanze.
 */
export function reportDellImpianto({ impianto = "caldo", unita = [], storie = {}, generatori = [], periodo }) {
  const { inizio, fine, secchielli } = periodo;
  const lungo = Math.max(0, fine - inizio);
  const stanze = unitaDellImpianto(impianto, unita).map((u) => {
    const righe = storie[u.entity] || [];
    const righeValvola = pulito(u.valvola) ? storie[pulito(u.valvola)] || [] : [];
    const valvolaIn = (riga) =>
      righeValvola.length ? valvolaAl(righeValvola, riga.t) : valvolaDellaRiga(riga);
    const richiesta = intervalliDove(righe, inizio, fine, (riga) =>
      chiedePer(impianto, riga, valvolaIn(riga)),
    );
    const accesa = intervalliDove(righe, inizio, fine, (riga) => accesaPer(impianto, riga));
    const senzaAzione = righe.length > 0 && !righe.some((riga) => pulito(riga.a?.hvac_action));
    const valvola = righeValvola.length
      ? mediaNelTempo(righeValvola, inizio, fine, valvolaDallEntita)
      : mediaNelTempo(righe, inizio, fine, valvolaDellaRiga);
    const coperto = durata(accesa.noti);
    const inComfort = comfortDelleRighe(impianto, righe, inizio, fine);
    return {
      entity: u.entity,
      nome: pulito(u.name) || u.entity,
      stanza: pulito(u.room),
      msRichiesta: durata(richiesta.veri),
      msAccesa: durata(accesa.veri),
      perSecchiello: durataNeiSecchielli(richiesta.veri, secchielli),
      intervalli: richiesta.veri,
      ambiente: mediaNelTempo(righe, inizio, fine, ambienteDellaRiga),
      /* La stanza e il suo obiettivo nelle stesse ore: quelle di comfort. */
      msComfort: durata(intervalliDove(righe, inizio, fine, (riga) => inComfort(riga)).veri),
      ambienteComfort: mediaNelTempo(righe, inizio, fine, ambienteDellaRiga, inComfort),
      obiettivoComfort: mediaNelTempo(
        righe,
        inizio,
        fine,
        (riga) => obiettivoDellaRiga(impianto, riga),
        inComfort,
      ),
      valvola,
      valvolaDa: valvola === null ? null : righeValvola.length ? "entita" : "attributo",
      richiestaStimata: senzaAzione,
      copertura: lungo ? coperto / lungo : 0,
      datiScarsi: lungo > 0 && coperto / lungo < COPERTURA_MINIMA,
    };
  });
  stanze.sort((x, y) => y.msRichiesta - x.msRichiesta || x.nome.localeCompare(y.nome));
  /* Un'unita' che nel periodo non ha mai lavorato per questo impianto non e'
   * di questo report: la pompa di calore che ha solo raffrescato non sta fra
   * le stanze del Riscaldamento con «0 min». Resta quella di cui non si sa
   * niente — porta «dati parziali» — e resta il termosifone acceso che non ha
   * chiesto: anche quello e' un'informazione. */
  const mute = (s) => s.copertura > 0 && s.msRichiesta === 0 && s.msAccesa === 0;
  const nascoste = stanze.filter(mute).length;
  const visibili = stanze.filter((s) => !mute(s));

  const misurati = (generatori || [])
    .map((g) => {
      const righe = storie[pulito(g.entity)] || [];
      if (!righe.length) return null;
      const acceso = intervalliDove(righe, inizio, fine, (riga) =>
        generatoreAcceso(g.entity, riga, impianto),
      );
      return {
        nome: pulito(g.nome),
        entity: pulito(g.entity),
        ms: durata(acceso.veri),
        accensioni: accensioni(acceso.veri, inizio),
        perSecchiello: durataNeiSecchielli(acceso.veri, secchielli),
        stima: false,
      };
    })
    .filter(Boolean);

  /* La stima: l'impianto lavora quando almeno una stanza chiede. */
  const unione = unisci(visibili.flatMap((s) => s.intervalli));
  const stima = {
    nome: "",
    entity: "",
    ms: durata(unione),
    accensioni: accensioni(unione, inizio),
    perSecchiello: durataNeiSecchielli(unione, secchielli),
    stima: true,
  };
  const generatoriDelReport = misurati.length ? misurati : [stima];
  const perSecchiello = secchielli.map((_, i) =>
    generatoriDelReport.reduce((somma, g) => somma + g.perSecchiello[i], 0),
  );

  const media = (valori) => {
    const buoni = valori.filter((v) => v !== null && v !== undefined);
    return buoni.length ? buoni.reduce((s, v) => s + v, 0) / buoni.length : null;
  };
  const conDati = visibili.filter((s) => s.copertura > 0);
  return {
    impianto,
    periodo,
    stanze: visibili.map(({ intervalli: _intervalli, ...resto }) => resto),
    nascoste,
    generatori: generatoriDelReport,
    stima: !misurati.length,
    secchielli: secchielli.map((s, i) => ({ ...s, ms: perSecchiello[i] })),
    totali: {
      msGeneratore: generatoriDelReport.reduce((s, g) => s + g.ms, 0),
      accensioni: generatoriDelReport.reduce((s, g) => s + g.accensioni, 0),
      msRichiesta: visibili.reduce((s, x) => s + x.msRichiesta, 0),
      ambiente: media(conDati.map((s) => s.ambiente)),
      /* Il riquadro confronta le stesse ore: la media delle stanze nelle loro
       * ore di comfort, e l'obiettivo di quelle ore. */
      ambienteComfort: media(conDati.map((s) => s.ambienteComfort)),
      obiettivoComfort: media(conDati.map((s) => s.obiettivoComfort)),
      valvola: media(conDati.map((s) => s.valvola)),
    },
    vuoto: !conDati.length && !misurati.some((g) => g.ms > 0),
  };
}

/* ── come si scrive ───────────────────────────────────────────────────── */

/** Ore e minuti: «3 h 20 min», «45 min», «0 min». */
export function oreScritte(ms) {
  const minuti = Math.round(Math.max(0, Number(ms) || 0) / 60_000);
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  if (!ore) return `${resto} min`;
  return resto ? `${ore} h ${resto} min` : `${ore} h`;
}

export const inOre = (ms) => (Math.max(0, Number(ms) || 0) / ORA);
