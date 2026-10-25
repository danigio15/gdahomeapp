/* La nuova pagina Auto: i conti, senza disegno.
 *
 * «Scusa non le puoi recuperare dallo storico?» Si': le statistiche di lungo
 * periodo di Home Assistant tengono l'energia della wallbox ora per ora per
 * sempre, e da li' escono le ricariche di un mese qualunque — non solo quelle
 * degli ultimi giorni. Qui c'e' tutto quello che serve per farlo, e niente che
 * chieda qualcosa alla casa: entrano righe, escono numeri. La sezione
 * (`sections/la-nuova-auto-section.js`) chiede e disegna.
 *
 * Quanto viene dal sole si stima ora per ora: in un'ora in cui l'auto ha preso
 * 3 kWh e la casa dalla rete ne ha presi 1, almeno 2 sono arrivati dal tetto.
 * E' la stima prudente — tutto quello che la rete ha dato si conta come dato
 * all'auto — ed e' la stessa che si legge sul contatore: non inventa sole.
 */

const ORA = 3_600_000;
const GIORNO = 24 * ORA;

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const istante = (riga) => {
  const grezzo = riga?.start ?? riga?.inizio;
  const t = typeof grezzo === "number" ? grezzo : new Date(grezzo).getTime();
  return Number.isFinite(t) ? t : null;
};

/** La mezzanotte locale del giorno di `quando`. */
export function inizioDelGiorno(quando) {
  const d = new Date(quando);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* ── che pezzo di calendario si guarda ──────────────────────────────────── */

/** Le tre viste dello storico: gli ultimi sette giorni, un mese, un periodo. */
export const VISTE_DELLO_STORICO = Object.freeze(["7", "mese", "periodo"]);

/* Un periodo scelto a mano non va oltre due mesi: sono 1.500 ore per ogni
 * entita', e oltre la risposta del Recorder si fa lenta per niente. */
export const GIORNI_MASSIMI_DEL_PERIODO = 62;

const dataDelGiorno = (testo) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(testo ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

/** «2026-10-20» del giorno di `quando`, ora locale. */
export function giornoScritto(quando) {
  const d = new Date(quando);
  const due = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

/**
 * Da dove a dove chiedere. `fine` e' esclusa e non va mai oltre la fine di
 * oggi: il futuro non ha righe, e un mese in corso finisce stanotte.
 *
 * - `7`: oggi e i sei giorni prima;
 * - `mese`: il mese di `mese` (`{anno, mese}`, mese da 0), oppure quello di oggi;
 * - `periodo`: dal giorno `dal` al giorno `al` compresi (`AAAA-MM-GG`), girati
 *   se scritti al contrario e tagliati a `GIORNI_MASSIMI_DEL_PERIODO`.
 */
export function finestraDelloStorico(
  vista,
  { adesso = Date.now(), mese = null, dal = "", al = "" } = {},
) {
  const domaniData = new Date(inizioDelGiorno(adesso));
  domaniData.setDate(domaniData.getDate() + 1);
  const domani = domaniData.getTime();
  if (vista === "mese") {
    const oggi = new Date(adesso);
    const anno = Number.isInteger(mese?.anno) ? mese.anno : oggi.getFullYear();
    const quale = Number.isInteger(mese?.mese) ? mese.mese : oggi.getMonth();
    const inizio = new Date(anno, quale, 1).getTime();
    const dopo = new Date(anno, quale + 1, 1).getTime();
    /* `giorni` sono quelli del mese intero: il grafico tiene il posto anche
     * ai giorni che devono ancora venire. */
    return {
      vista,
      inizio,
      fine: Math.max(inizio, Math.min(dopo, domani)),
      giorni: giorniFra(inizio, dopo),
    };
  }
  if (vista === "periodo") {
    let da = dataDelGiorno(dal);
    let a = dataDelGiorno(al);
    if (da === null && a === null) return finestraDelloStorico("7", { adesso });
    if (da === null) da = a;
    if (a === null) a = da;
    if (a < da) [da, a] = [a, da];
    /* Un periodo tutto nel futuro diventa oggi: non c'e' niente da mostrare
     * prima di stanotte. */
    if (da >= domani) da = inizioDelGiorno(adesso);
    const dopoA = new Date(a);
    dopoA.setDate(dopoA.getDate() + 1);
    const tetto = new Date(da);
    tetto.setDate(tetto.getDate() + GIORNI_MASSIMI_DEL_PERIODO);
    const fine = Math.min(dopoA.getTime(), tetto.getTime(), domani);
    return {
      vista,
      inizio: da,
      fine,
      giorni: giorniFra(da, fine),
      tagliato: tetto.getTime() < Math.min(dopoA.getTime(), domani),
    };
  }
  const inizio = new Date(inizioDelGiorno(adesso));
  inizio.setDate(inizio.getDate() - 6);
  return { vista: "7", inizio: inizio.getTime(), fine: domani, giorni: 7 };
}

/** Quanti giorni di calendario ci sono fra due mezzenotti (l'ora legale non conta). */
export function giorniFra(inizio, fine) {
  return Math.max(0, Math.round((inizioDelGiorno(fine) - inizioDelGiorno(inizio)) / GIORNO));
}

/** Il mese prima o dopo: `{anno, mese}` piu' `passo` mesi. */
export function meseAccanto({ anno, mese }, passo) {
  const d = new Date(anno, mese + passo, 1);
  return { anno: d.getFullYear(), mese: d.getMonth() };
}

/* ── le ore, i giorni, le ricariche ─────────────────────────────────────── */

/**
 * Le ore di ricarica: per ogni ora i kWh presi dall'auto, quanti dalla rete,
 * quanti dal sole e il costo.
 *
 * `auto` e `rete` sono righe del Recorder gia' trasformate in crescite
 * (`{start, change}`). `prezzo(istante)` dice il prezzo di quell'ora, o `null`.
 *
 * La regola e' quella del ponte (`l-energia-di-casa.js`): con la rete, il sole
 * e' quello che la rete non ha dato. Senza la rete ma con il sole e la casa
 * (`altre.sole`, `altre.casa`, stesse righe), il sole dell'auto e' l'eccedenza:
 * la produzione meno il resto della casa, che contiene l'auto. Senza niente
 * di questo `sole` resta `null` e il costo si conta su tutto.
 */
export function oreDiRicarica(auto = [], rete = null, prezzo = () => null, altre = {}) {
  const perOra = (righe) => {
    const mappa = new Map();
    for (const riga of righe) {
      const t = istante(riga);
      const n = numero(riga?.change);
      if (t !== null && n !== null) mappa.set(t, (mappa.get(t) || 0) + Math.max(0, n));
    }
    return mappa;
  };
  const piene = (righe) => Array.isArray(righe) && righe.length > 0;
  const sappiamoLaRete = piene(rete);
  const dallaRete = sappiamoLaRete ? perOra(rete) : null;
  const sappiamoLEccedenza = !sappiamoLaRete && piene(altre?.sole) && piene(altre?.casa);
  const prodotto = sappiamoLEccedenza ? perOra(altre.sole) : null;
  const consumato = sappiamoLEccedenza ? perOra(altre.casa) : null;
  const ore = [];
  for (const riga of Array.isArray(auto) ? auto : []) {
    const t = istante(riga);
    const kwh = numero(riga?.change);
    if (t === null || kwh === null || kwh <= 0) continue;
    let presa = null;
    if (sappiamoLaRete) presa = Math.min(kwh, dallaRete.get(t) || 0);
    else if (sappiamoLEccedenza) {
      const eccedenza = (prodotto.get(t) || 0) - Math.max(0, (consumato.get(t) || 0) - kwh);
      presa = kwh - Math.min(kwh, Math.max(0, eccedenza));
    }
    const pagata = presa === null ? kwh : presa;
    const tariffa = numero(prezzo(t));
    ore.push({
      inizio: t,
      kwh,
      rete: presa,
      sole: presa === null ? null : kwh - presa,
      costo: tariffa === null ? null : pagata * tariffa,
    });
  }
  return ore.sort((a, b) => a.inizio - b.inizio);
}

const somma = (elenco, campo) => {
  let totale = 0;
  let qualcuno = false;
  for (const voce of elenco) {
    const n = voce[campo];
    if (n === null || n === undefined) continue;
    totale += n;
    qualcuno = true;
  }
  return qualcuno ? totale : null;
};

/* Sotto un decimo di kWh in un'ora non e' una ricarica: e' l'auto che tiene
 * sveglia la centralina, o la wallbox che si misura da sola. */
export const SOGLIA_DELLA_RICARICA = 0.1;

/**
 * Le ricariche: ore di fila con energia, unite anche se in mezzo c'e' un'ora
 * ferma (la fascia che aspetta il sole, l'auto che riposa al 79%).
 */
export function ricaricheDalleOre(ore = [], { soglia = SOGLIA_DELLA_RICARICA, buco = 1 } = {}) {
  const buone = ore.filter((ora) => ora.kwh >= soglia);
  const ricariche = [];
  let corrente = null;
  for (const ora of buone) {
    if (corrente && ora.inizio - corrente.ultima <= (buco + 1) * ORA) {
      corrente.ore.push(ora);
      corrente.ultima = ora.inizio;
      continue;
    }
    corrente = { ore: [ora], ultima: ora.inizio };
    ricariche.push(corrente);
  }
  return ricariche
    .map(({ ore: sue, ultima }) => conIConti({ inizio: sue[0].inizio, fine: ultima + ORA }, sue))
    .reverse();
}

function conIConti(base, ore) {
  const kwh = somma(ore, "kwh") || 0;
  const sole = somma(ore, "sole");
  return {
    ...base,
    kwh,
    sole,
    rete: somma(ore, "rete"),
    quotaSole: sole === null || kwh <= 0 ? null : Math.max(0, Math.min(1, sole / kwh)),
    costo: somma(ore, "costo"),
  };
}

/** I giorni della finestra, tutti, anche quelli senza ricariche (fanno la barra vuota). */
export function giorniDalleOre(ore = [], inizio, fine) {
  const perGiorno = new Map();
  for (const ora of ore) {
    const g = inizioDelGiorno(ora.inizio);
    if (!perGiorno.has(g)) perGiorno.set(g, []);
    perGiorno.get(g).push(ora);
  }
  const giorni = [];
  for (let d = new Date(inizioDelGiorno(inizio)); d.getTime() < fine; d.setDate(d.getDate() + 1)) {
    const g = d.getTime();
    giorni.push(conIConti({ giorno: g }, perGiorno.get(g) || []));
  }
  return giorni;
}

/** I quattro numeri in cima allo storico. */
export function totaliDelloStorico(giorni = [], ricariche = []) {
  const kwh = somma(giorni, "kwh") || 0;
  const sole = somma(giorni, "sole");
  const costo = somma(giorni, "costo");
  const pagati = somma(giorni, "rete");
  return {
    kwh,
    quotaSole: sole === null || kwh <= 0 ? null : Math.max(0, Math.min(1, sole / kwh)),
    costo,
    ricariche: ricariche.length,
    /* Quanto e' costato un kWh messo nell'auto, sole compreso: e' il numero
     * che si confronta con la colonnina. */
    alKwh: costo === null || kwh <= 0 ? null : costo / kwh,
    pagati,
  };
}

/* ── i viaggi ────────────────────────────────────────────────────────────── */

/** I km di ogni giorno dalle crescite del contachilometri, con i giorni vuoti. */
export function kmDeiGiorni(righe = [], inizio, fine) {
  const perGiorno = new Map();
  for (const riga of Array.isArray(righe) ? righe : []) {
    const t = istante(riga);
    const n = numero(riga?.change);
    if (t === null || n === null || n < 0) continue;
    /* Un salto di migliaia di km in un giorno e' un contachilometri che si e'
     * presentato per la prima volta, non un viaggio. */
    if (n > 2000) continue;
    const g = inizioDelGiorno(t);
    perGiorno.set(g, (perGiorno.get(g) || 0) + n);
  }
  const giorni = [];
  for (let d = new Date(inizioDelGiorno(inizio)); d.getTime() < fine; d.setDate(d.getDate() + 1))
    giorni.push({ giorno: d.getTime(), km: perGiorno.get(d.getTime()) || 0 });
  return giorni;
}

/* ── fino a che percentuale ──────────────────────────────────────────────── */

/**
 * Cosa si puo' scegliere come obiettivo di carica, letto dall'entita'.
 *
 * Un `number` (o `input_number`) si sceglie libero fra min e max col suo passo;
 * un `select` solo fra le sue voci. Torna `null` senza entita'.
 */
export function laPercentuale(stato, entita = "") {
  if (!stato) return null;
  const dominio = String(entita || stato.entity_id || "").split(".")[0];
  const attr = stato.attributes || {};
  const valore = numero(stato.state);
  const opzioni = Array.isArray(attr.options) ? attr.options : [];
  if (dominio === "select" || dominio === "input_select" || opzioni.length) {
    const voci = opzioni
      .map((voce) => ({ id: String(voce), n: numero(String(voce).replace("%", "")) }))
      .filter((voce) => voce.n !== null)
      .sort((a, b) => a.n - b.n);
    if (!voci.length) return null;
    return {
      libera: false,
      scrivibile: true,
      min: voci[0].n,
      max: voci.at(-1).n,
      passo: voci.length > 1 ? voci[1].n - voci[0].n : 1,
      valore,
      voci,
    };
  }
  const scrivibile = dominio === "number" || dominio === "input_number";
  const min = numero(attr.min) ?? 0;
  const max = numero(attr.max) ?? 100;
  const passo = numero(attr.step) || 1;
  return { libera: scrivibile, scrivibile, min, max: Math.max(min, max), passo, valore, voci: [] };
}

/** Il valore che l'entita' accetta davvero, il piu' vicino a quello voluto. */
export function percentualeConsentita(info, voluto) {
  if (!info) return null;
  const n = numero(voluto);
  if (n === null) return null;
  if (info.voci?.length) {
    let migliore = info.voci[0];
    for (const voce of info.voci)
      if (Math.abs(voce.n - n) < Math.abs(migliore.n - n)) migliore = voce;
    return migliore.n;
  }
  const dentro = Math.max(info.min, Math.min(info.max, n));
  const passi = Math.round((dentro - info.min) / info.passo);
  const tondo = info.min + passi * info.passo;
  return Math.round(Math.min(info.max, tondo) * 1000) / 1000;
}

/** Un passo su o giu' (il «−» e il «+»): di 5 se l'entita' lo permette. */
export function unPasso(info, verso) {
  if (!info) return null;
  const adesso = info.valore ?? info.max;
  if (info.voci?.length) {
    const i = info.voci.findIndex((voce) => voce.n >= adesso - 1e-9);
    const qui = i < 0 ? info.voci.length - 1 : i;
    const dopo = Math.max(0, Math.min(info.voci.length - 1, qui + (verso > 0 ? 1 : -1)));
    return info.voci[dopo].n;
  }
  const salto = Math.max(info.passo, Math.ceil(5 / info.passo) * info.passo);
  return percentualeConsentita(info, adesso + (verso > 0 ? salto : -salto));
}

/* Dove finiscono i tasti e comincia la tendina: dal 60% in su si sceglie con
 * un tasto, sotto da un menu. Le cariche basse si scelgono di rado, e cinque
 * tasti in fila stanno anche sul telefono. */
export const SOGLIA_DEI_TASTI = 60;

/** I tasti delle percentuali, dal 60% in su: quelli che l'entita' accetta. */
export function leScorciatoie(info, voluti = [60, 70, 80, 90, 100]) {
  if (!info) return [];
  /* Un select le sue voci le ha gia': si mostrano quelle dal 60% in su. */
  if (info.voci?.length)
    return info.voci.filter((voce) => voce.n >= SOGLIA_DEI_TASTI).map((voce) => voce.n);
  const fuori = voluti.filter((n) => n >= info.min && n <= info.max);
  return [...new Set(fuori.map((n) => percentualeConsentita(info, n)))];
}

/**
 * Le percentuali sotto il 60%, per la tendina: di 5 in 5 dal minimo che
 * l'entita' accetta (o le voci di un select), dalla piu' alta alla piu' bassa.
 */
export function lePercentualiBasse(info, sotto = SOGLIA_DEI_TASTI) {
  if (!info) return [];
  if (info.voci?.length)
    return info.voci
      .filter((voce) => voce.n < sotto)
      .map((voce) => voce.n)
      .reverse();
  const basse = [];
  for (let n = sotto - 5; n >= info.min; n -= 5) basse.push(percentualeConsentita(info, n));
  return [...new Set(basse)].filter((n) => n !== null && n < sotto);
}

/** I km che si avranno all'obiettivo, in proporzione all'autonomia di adesso. */
export function kmAllaPercentuale(autonomia, batteria, percentuale) {
  const km = numero(autonomia);
  const soc = numero(batteria);
  const p = numero(percentuale);
  if (km === null || soc === null || p === null || soc <= 0) return null;
  return Math.round((km / soc) * p);
}
