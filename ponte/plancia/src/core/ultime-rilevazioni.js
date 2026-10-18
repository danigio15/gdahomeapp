/* Le ultime rilevazioni di un contatto o di un rilevatore (#269).
 *
 * «Tocco la porta d'ingresso e voglio sapere quante volte si è aperta oggi, e
 * per quanto.» Lo stesso per il corridoio: quando c'è stato movimento, da che
 * ora la casa si è svegliata, se di notte è stato tutto fermo.
 *
 * La risposta la sa già il Recorder di Home Assistant: è la storia dei cambi
 * di stato dell'entità. Qui la si legge e la si riduce a quello che si
 * disegna nel foglio «Ultime 24 ore»:
 *
 *   - i tratti del periodo, uno per stato — aperta, chiusa, muta —, cuciti
 *     insieme quando due righe di fila dicono la stessa cosa;
 *   - le aperture (o i movimenti), con quando, quanto, e se sono ancora in
 *     corso;
 *   - i buchi in cui il sensore non rispondeva, che NON sono una porta chiusa;
 *   - i conti delle tre caselle: quante volte oggi, quanto in tutto, la più
 *     lunga; per il movimento quante rilevazioni, la prima del giorno, l'ora
 *     più fitta;
 *   - le rilevazioni ora per ora, e la quiete della notte.
 *
 * È puro: nessun DOM, nessuna lingua, nessun orologio. L'istante di adesso, la
 * mezzanotte e il modo di leggere uno stato li passa chi chiama, così una
 * prova può dire lei che ora è e com'è girato il contatto. Le parole le mette
 * chi disegna (`sections/ultime-rilevazioni-section.js`).
 */

const UN_MINUTO = 60_000;
const UNORA = 60 * UN_MINUTO;
const UN_GIORNO = 24 * UNORA;

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

/** I tre stati di un tratto: acceso (aperta, movimento), a riposo, muto. */
export const ATTIVO = "attivo";
export const RIPOSO = "riposo";
export const MUTO = "muto";

/* Le classi di Home Assistant che aprono il foglio, divise per famiglia. Sono
 * le stesse dei Varchi e della Presenza: il foglio si apre da quelle pagine, e
 * una classe che li' non c'e' non deve aprirlo qui. */
export const CLASSI_DEL_VARCO = Object.freeze(["door", "window", "garage_door", "opening"]);
export const CLASSI_DEL_MOVIMENTO = Object.freeze(["motion", "occupancy", "presence", "moving"]);

/**
 * Di che famiglia è un sensore: `varco` (porte, finestre, portoni), `movimento`
 * (movimento, occupazione, presenza), o `""`.
 *
 * Chi apre il foglio di solito lo sa gia' — lo apre dalla pagina Varchi o
 * dalla Presenza — e lo dice con `origine`, che vince sulla classe: una
 * centrale che dichiara `opening` anche il volumetrico resta un varco solo se
 * l'ha messo fra i varchi chi abita la casa.
 */
export function famigliaDelSensore({ classe = "", origine = "" } = {}) {
  const detta = minuscolo(origine);
  if (detta === "varco" || detta === "movimento") return detta;
  const c = minuscolo(classe);
  if (CLASSI_DEL_VARCO.includes(c)) return "varco";
  if (CLASSI_DEL_MOVIMENTO.includes(c)) return "movimento";
  return "";
}

/* ── leggere uno stato ─────────────────────────────────────────────────── */

const MUTI = new Set(["unavailable", "unknown", "none", "null", ""]);
const ACCESI = new Set(["on", "open", "opening", "true", "detected", "home"]);
const SPENTI = new Set(["off", "closed", "closing", "false", "clear", "not_home"]);

/**
 * Come si legge lo stato grezzo di Home Assistant: `attivo`, `riposo` o
 * `muto`. `invertito` vale per i contatti montati al contrario (vedi
 * `verso-aperture.js`): «on» vuol dire chiusa.
 */
export function letturaDelloStato(grezzo, { invertito = false } = {}) {
  const s = minuscolo(grezzo);
  if (MUTI.has(s)) return MUTO;
  if (ACCESI.has(s)) return invertito ? RIPOSO : ATTIVO;
  if (SPENTI.has(s)) return invertito ? ATTIVO : RIPOSO;
  return MUTO;
}

/* ── l'orologio di casa ────────────────────────────────────────────────── */

/** La mezzanotte locale del giorno di `ms`. */
export function mezzanotteDi(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Le ultime 24 ore fino ad adesso. */
export function finestraDelleUltime24(adesso) {
  return { start: adesso - UN_GIORNO, end: adesso, modo: "24h" };
}

/* Ieri, da mezzanotte a mezzanotte. Si conta col calendario e non sottraendo
 * ventiquattro ore: il giorno del cambio dell'ora ne ha ventitre' o
 * venticinque, e «ieri» resta ieri. */
export function finestraDiIeri(adesso) {
  const oggi = mezzanotteDi(adesso);
  const d = new Date(oggi);
  const ieri = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime();
  return { start: ieri, end: oggi, modo: "ieri" };
}

/** «18:05», sempre a ventiquattro ore e in ora locale. */
export function orario(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ── i tratti ──────────────────────────────────────────────────────────── */

function righeOrdinate(righe) {
  return (Array.isArray(righe) ? righe : [])
    .map((riga) => ({ state: riga?.state, time: Number(riga?.time) }))
    .filter((riga) => Number.isFinite(riga.time) && riga.time > 0)
    .sort((a, b) => a.time - b.time);
}

/**
 * I tratti del periodo: `{ da, a, stato }`, uno dopo l'altro, dentro
 * `[start, end]`.
 *
 * `righe` è lo storico normalizzato (`{ state, time }`); `vivo`, se c'è, è lo
 * stato di adesso con il suo `last_changed`. Lo storico in memoria vale nove
 * minuti, e in quei nove minuti una porta si può aprire: lo stato vivo si cuce
 * in coda, così il foglio non contraddice la carta da cui lo si è aperto.
 *
 * Prima della prima riga non si sa niente, e non si disegna niente: un buco
 * nella storia non è una porta chiusa. Due righe di fila con lo stesso stato
 * fanno un tratto solo.
 */
export function tratti(righe, { start, end, leggi = letturaDelloStato, vivo = null } = {}) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const elenco = righeOrdinate(righe);
  const quandoVivo = Number(vivo?.time);
  if (vivo && Number.isFinite(quandoVivo)) {
    const ultima = elenco[elenco.length - 1];
    if (!ultima || quandoVivo > ultima.time)
      elenco.push({ state: vivo.state, time: Math.min(quandoVivo, end) });
  }
  const fuori = [];
  let corrente = null;
  let dal = start;
  for (const riga of elenco) {
    const stato = leggi(riga.state);
    if (riga.time <= start) {
      corrente = stato;
      continue;
    }
    if (riga.time >= end) break;
    if (corrente !== null && riga.time > dal)
      fuori.push({ da: dal, a: riga.time, stato: corrente });
    corrente = stato;
    dal = riga.time;
  }
  if (corrente !== null && end > dal) fuori.push({ da: dal, a: end, stato: corrente });

  const cuciti = [];
  for (const tratto of fuori) {
    const prima = cuciti[cuciti.length - 1];
    if (prima && prima.stato === tratto.stato && prima.a === tratto.da) prima.a = tratto.a;
    else cuciti.push({ ...tratto });
  }
  return cuciti;
}

/**
 * Le aperture (o i movimenti): i tratti accesi, con la durata e due segni.
 *
 * `inCorso` vuol dire che è ancora aperta adesso — il tratto arriva alla fine
 * del periodo e la fine del periodo è adesso. `daPrima` vuol dire che era già
 * aperta quando il periodo comincia: la sua ora d'inizio è quella del periodo,
 * non quella vera.
 */
export function accensioni(elenco, { start, end, adesso = end } = {}) {
  return (Array.isArray(elenco) ? elenco : [])
    .filter((tratto) => tratto.stato === ATTIVO)
    .map((tratto) => ({
      da: tratto.da,
      a: tratto.a,
      durata: Math.max(0, tratto.a - tratto.da),
      inCorso: tratto.a >= end && end >= adesso - UN_MINUTO,
      daPrima: tratto.da <= start,
    }));
}

/** I buchi in cui il sensore non rispondeva. */
export function silenzi(elenco) {
  return (Array.isArray(elenco) ? elenco : [])
    .filter((tratto) => tratto.stato === MUTO)
    .map(({ da, a }) => ({ da, a }));
}

/** Quanto di un intervallo cade dentro `[da, a]`. */
function sovrapposto(intervallo, da, a) {
  return Math.max(0, Math.min(intervallo.a, a) - Math.max(intervallo.da, da));
}

/**
 * I conti di un varco: quante volte si è aperto dalla mezzanotte, quante
 * prima, quanto è stato aperto in tutto dalla mezzanotte, e la più lunga.
 *
 * Per «ieri» la mezzanotte è l'inizio del periodo: le conta tutte.
 */
export function contiDelVarco(aperture, { start, end, mezzanotte = start } = {}) {
  const elenco = Array.isArray(aperture) ? aperture : [];
  const dopo = elenco.filter((apertura) => apertura.da >= mezzanotte && !apertura.daPrima);
  const prima = elenco.filter((apertura) => !(apertura.da >= mezzanotte && !apertura.daPrima));
  const totale = elenco.reduce(
    (somma, apertura) => somma + sovrapposto(apertura, Math.max(start, mezzanotte), end),
    0,
  );
  let piuLunga = null;
  for (const apertura of elenco)
    if (!piuLunga || apertura.durata > piuLunga.durata) piuLunga = apertura;
  return {
    volte: dopo.length,
    prima: prima.length,
    totale,
    /* Quanto del periodo dalla mezzanotte, da 0 a 1. */
    quota: end > Math.max(start, mezzanotte) ? totale / (end - Math.max(start, mezzanotte)) : 0,
    piuLunga,
  };
}

/* L'ora locale che comincia a `ms` o subito prima. */
function inizioDellOra(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
}

function oraDopo(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
}

/**
 * Le rilevazioni ora per ora: `{ da, a, conto }`, sulle ore dell'orologio di
 * casa. La prima e l'ultima sono tagliate dal periodo. Un movimento conta
 * nell'ora in cui comincia; quelli già in corso all'inizio del periodo non
 * contano, perché non sono cominciati lì.
 */
export function rilevazioniPerOra(movimenti, { start, end } = {}) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const ore = [];
  for (let ora = inizioDellOra(start); ora < end; ora = oraDopo(ora))
    ore.push({ da: Math.max(ora, start), a: Math.min(oraDopo(ora), end), inizio: ora, conto: 0 });
  for (const movimento of Array.isArray(movimenti) ? movimenti : []) {
    if (movimento.daPrima) continue;
    const quale = ore.find((ora) => movimento.da >= ora.da && movimento.da < ora.a);
    if (quale) quale.conto += 1;
  }
  return ore;
}

/**
 * I conti del movimento: quante rilevazioni dalla mezzanotte, la prima, e
 * l'ora più fitta (la prima, a parità).
 */
export function contiDelMovimento(movimenti, { start, end, mezzanotte = start } = {}) {
  const elenco = (Array.isArray(movimenti) ? movimenti : []).filter((m) => !m.daPrima);
  const dopo = elenco.filter((movimento) => movimento.da >= mezzanotte);
  const ore = rilevazioniPerOra(elenco, { start, end });
  let fitta = null;
  for (const ora of ore) if (ora.conto && (!fitta || ora.conto > fitta.conto)) fitta = ora;
  return {
    volte: dopo.length,
    prima: elenco.length - dopo.length,
    primo: dopo[0] || null,
    fitta: fitta ? { da: fitta.inizio, a: oraDopo(fitta.inizio), conto: fitta.conto } : null,
  };
}

/**
 * La quiete della notte: il silenzio più lungo fra due movimenti che tocca le
 * ore piccole — dalla mezzanotte alle sei — della notte dentro il periodo.
 *
 * Dice «quiete 23:01–06:52»: da quando si è spento l'ultimo movimento della
 * sera a quando è arrivato il primo del mattino. Sotto `minimo` (un'ora e
 * mezza) non è una notte tranquilla, è una pausa, e non si scrive.
 */
export function quieteDellaNotte(
  movimenti,
  { start, end, mezzanotte = null, minimo = 90 * UN_MINUTO } = {},
) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const notte = Number.isFinite(mezzanotte) ? mezzanotte : mezzanotteDi(end);
  const piccole = { da: notte, a: notte + 6 * UNORA };
  const elenco = (Array.isArray(movimenti) ? movimenti : []).slice().sort((x, y) => x.da - y.da);
  const buchi = [];
  let dal = start;
  for (const movimento of elenco) {
    if (movimento.da > dal) buchi.push({ da: dal, a: movimento.da });
    dal = Math.max(dal, movimento.a);
  }
  if (end > dal) buchi.push({ da: dal, a: end });
  let migliore = null;
  for (const buco of buchi) {
    if (sovrapposto(piccole, buco.da, buco.a) <= 0) continue;
    if (buco.a - buco.da < minimo) continue;
    if (!migliore || buco.a - buco.da > migliore.a - migliore.da) migliore = buco;
  }
  return migliore;
}

/**
 * Le tacche dell'asse: ogni sei ore dell'orologio (00, 06, 12, 18) dentro il
 * periodo, lontane almeno `margine` dai due capi, dove stanno già le
 * etichette dell'inizio e della fine. I due capi possono chiedere margini
 * diversi (`margineInizio`, `margineFine`): «ieri 14:38» e' lunga il doppio
 * di «adesso», e con lo stesso margine la tacca delle 18 ci finiva sopra.
 */
export function tacche(
  start,
  end,
  { passo = 6, margine = 75 * UN_MINUTO, margineInizio = margine, margineFine = margine } = {},
) {
  const fuori = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return fuori;
  for (let ora = inizioDellOra(start); ora <= end; ora = oraDopo(ora)) {
    if (new Date(ora).getHours() % passo !== 0) continue;
    if (ora - start < margineInizio || end - ora < margineFine) continue;
    fuori.push(ora);
  }
  return fuori;
}

/**
 * Le righe dell'elenco, dalla più recente: ognuna con il gruppo a cui
 * appartiene — `oggi` dalla mezzanotte, `prima` per quelle di ieri.
 */
export function elencoDegliEventi(eventi, { mezzanotte } = {}) {
  return (Array.isArray(eventi) ? eventi : [])
    .slice()
    .sort((x, y) => y.da - x.da)
    .map((evento) => ({ ...evento, gruppo: evento.da >= mezzanotte ? "oggi" : "prima" }));
}

/**
 * Il gruppo di prima si chiama «ieri sera» quando tutte le sue righe sono del
 * pomeriggio tardi o della sera (dalle 17 in poi), «ieri» altrimenti.
 */
export function eDiSera(eventi) {
  const elenco = Array.isArray(eventi) ? eventi : [];
  return elenco.length > 0 && elenco.every((evento) => new Date(evento.da).getHours() >= 17);
}

/**
 * Tutto quello che il foglio disegna, in una volta: dai tratti in giù.
 *
 * `famiglia` è `varco` o `movimento`; `finestra` è quella di
 * `finestraDelleUltime24` o `finestraDiIeri`.
 */
export function ultimeRilevazioni(
  righe,
  { famiglia = "varco", finestra, adesso, leggi = letturaDelloStato, vivo = null } = {},
) {
  const { start, end } = finestra || {};
  const mezzanotte = finestra?.modo === "ieri" ? start : mezzanotteDi(end);
  const elenco = tratti(righe, { start, end, leggi, vivo });
  const accese = accensioni(elenco, { start, end, adesso });
  const base = {
    famiglia,
    start,
    end,
    mezzanotte,
    modo: finestra?.modo || "24h",
    tratti: elenco,
    eventi: accese,
    silenzi: silenzi(elenco),
    elenco: elencoDegliEventi(accese, { mezzanotte }),
    vuoto: elenco.length === 0,
  };
  if (famiglia === "movimento")
    return {
      ...base,
      conti: contiDelMovimento(accese, { start, end, mezzanotte }),
      perOra: rilevazioniPerOra(accese, { start, end }),
      quiete: quieteDellaNotte(accese, {
        start,
        end,
        mezzanotte: finestra?.modo === "ieri" ? start : mezzanotte,
      }),
    };
  return { ...base, conti: contiDelVarco(accese, { start, end, mezzanotte }) };
}

/**
 * Una durata in pezzi: `{ giorni, ore, minuti }`, coi minuti arrotondati. Le
 * parole e le unità le mette chi disegna. Sotto il minuto, `minuti` è 0 e
 * `breve` è vero: si scrive «< 1 min», non «0 min».
 */
export function pezziDellaDurata(ms) {
  const totale = Math.max(0, Math.round(Number(ms) / UN_MINUTO) || 0);
  return {
    giorni: Math.floor(totale / (24 * 60)),
    ore: Math.floor((totale % (24 * 60)) / 60),
    minuti: totale % 60,
    breve: Number(ms) > 0 && Number(ms) < 30_000,
    totaleMinuti: totale,
  };
}
