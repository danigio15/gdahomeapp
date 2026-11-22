/* Le feste: quando ci sono, e cosa fanno le luci di Natale.
 *
 * Dall'Immacolata all'Epifania la plancia si veste: la ghirlanda nella
 * testata, la neve leggera, il riquadro delle luci di Natale in Home, la
 * scena della Vigilia sul tablet a muro, il conto alla rovescia e i fuochi a
 * Capodanno. E' una sorpresa: non c'e' un interruttore, non c'e' una data
 * scritta da nessuna parte che uno possa leggere. Il tema si accende da solo
 * l'8 dicembre e se ne va da solo dopo il 6 gennaio, ogni anno.
 *
 * Per questo la finestra sta qui, in un posto solo, e tutti la chiedono a
 * questo file: la plancia per sapere se disegnare, la configurazione per
 * sapere se mostrare la scheda delle luci, il tablet per la sua scena e il
 * ponte per sapere se le luci si programmano. Se ognuno se la scrivesse da
 * se', il primo anno in cui uno sbaglia il 7 gennaio la casa si troverebbe
 * mezza vestita a festa.
 *
 * ── Ora locale, e nessun anno scritto ─────────────────────────────────────
 *
 * Le feste sono un fatto del calendario di casa, non di Greenwich: la
 * finestra si misura con l'ora locale del dispositivo (o del ponte), con i
 * metodi `getFullYear`/`getMonth`/`getDate`. L'anno non e' mai scritto: il
 * «prossimo anno» il 31 dicembre e' l'anno dopo, dall'1 al 6 gennaio e'
 * l'anno in corso — `annoNuovo` lo ricava dalla data che riceve, e cosi'
 * funziona anche l'anno prossimo e quello dopo.
 *
 * ── Le luci di Natale ─────────────────────────────────────────────────────
 *
 * Chi ha l'albero su una presa smart vuole che si accenda al tramonto e si
 * spenga prima di andare a letto, anche col telefono in tasca: la decisione
 * sta qui, pura, e la esegue il ponte (`ponte/src/le-luci-di-natale.js`),
 * che gira anche quando nessuno ha la plancia aperta. La plancia la legge per
 * raccontarla: «si spengono alle 23:30».
 *
 * E' puro: nessun DOM, nessuna memoria, nessun orologio che non sia quello
 * che gli si passa.
 */

/** Dove sta la configurazione delle luci di Natale. */
export const CHIAVE_FESTE = "cd_feste";

/* Otto bastano per l'albero, il presepe, il balcone, la vetrina, le
 * luminarie del giardino e qualcosa in piu'; e in Home il riquadro deve
 * stare su una riga sola su un computer. */
export const LUCI_AL_MASSIMO = 8;

/* Le cose che si accendono e si spengono e basta. Una presa smart con
 * l'albero attaccato e' uno `switch`, una striscia led e' una `light`, e chi
 * comanda le luminarie con un'automazione sua ha spesso un `input_boolean`. */
export const DOMINI_DELLE_LUCI = Object.freeze(["light", "switch", "input_boolean"]);

/* Le parole con cui le case chiamano le luci di Natale. Servono a proporle
 * in configurazione («Trovate in casa»): si cerca nel nome e nell'entita',
 * senza accenti e senza maiuscole. «natal» prende natale, natalizio,
 * natalizie; «christmas» e «xmas» le case che parlano inglese. */
export const PAROLE_DELLE_LUCI = Object.freeze([
  "albero",
  "natal",
  "presepe",
  "presepio",
  "stella cometa",
  "cometa",
  "luminarie",
  "xmas",
  "christmas",
]);

/* Accese al tramonto e spente alle undici e mezza: e' quello che fa chi le
 * accende a mano, e quello che si trova gia' scritto la prima volta. */
export const ORA_DI_ACCENSIONE = "17:00";
export const ORA_DI_SPEGNIMENTO = "23:30";
export const TUTTI_I_GIORNI = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

/* Lo scarto sul tramonto: da un'ora prima a due ore dopo. Oltre, «al
 * tramonto» non vuol dire piu' niente, e conviene scrivere un'ora. */
const SCARTO_MINIMO = -60;
const SCARTO_MASSIMO = 120;

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;
const GIORNO = 24 * ORA;

const clean = (valore) => String(valore ?? "").trim();

/* ── la finestra ──────────────────────────────────────────────────────────── */

const comeData = (data) => {
  const d = data instanceof Date ? data : new Date(data ?? Date.now());
  return Number.isFinite(d.getTime()) ? d : null;
};

/**
 * La finestra delle feste che contiene questa data: dall'8 dicembre a mezzanotte
 * fino al 7 gennaio a mezzanotte, escluso — cioe' il 6 gennaio compreso fino
 * all'ultimo secondo. Fuori, `null`.
 *
 * La fine e' il 7 gennaio alle 00:00 e non il 6 alle 23:59:59 perche' cosi' non
 * c'e' un buco di un secondo (o di un millisecondo) fra la fine e il giorno
 * dopo: `adesso < fine` e' la regola intera.
 */
export function finestraDelleFeste(data = new Date()) {
  const d = comeData(data);
  if (!d) return null;
  const anno = d.getFullYear();
  const mese = d.getMonth();
  const giorno = d.getDate();
  if (mese === 11 && giorno >= 8)
    return { inizio: new Date(anno, 11, 8), fine: new Date(anno + 1, 0, 7) };
  if (mese === 0 && giorno <= 6)
    return { inizio: new Date(anno - 1, 11, 8), fine: new Date(anno, 0, 7) };
  return null;
}

/** Se in questo momento e' festa. */
export function inFesta(data = new Date()) {
  return finestraDelleFeste(data) !== null;
}

/**
 * L'anno che arriva, o che e' appena arrivato: a dicembre l'anno dopo, a
 * gennaio quello in corso. Il 31 dicembre 2026 e' il 2027; l'1 gennaio 2027
 * e' ancora il 2027 — e' quello a cui si fanno gli auguri.
 */
export function annoNuovo(data = new Date()) {
  const d = comeData(data) || new Date();
  return d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
}

/** La mezzanotte del primo gennaio dell'anno che arriva. */
export function mezzanotteDellAnnoNuovo(data = new Date()) {
  return new Date(annoNuovo(data), 0, 1);
}

/**
 * Il conto alla rovescia nella testata: dal 26 dicembre alla mezzanotte del 31.
 *
 * Prima del 26 il Natale e' ancora da fare, e un numero che conta i giorni a
 * Capodanno toglierebbe la scena alla Vigilia. Fuori dai sei giorni, `null`.
 * Le parti sono numeri: le parole («4g 05:17») le mette chi disegna, nella
 * lingua di chi guarda.
 */
export function contoAllaRovescia(data = new Date()) {
  const d = comeData(data);
  if (!d || d.getMonth() !== 11 || d.getDate() < 26) return null;
  const mancano = mezzanotteDellAnnoNuovo(d).getTime() - d.getTime();
  if (mancano <= 0) return null;
  const secondiInTutto = Math.ceil(mancano / 1000);
  return {
    anno: annoNuovo(d),
    mancano,
    giorni: Math.floor(secondiInTutto / 86400),
    ore: Math.floor((secondiInTutto % 86400) / 3600),
    minuti: Math.floor((secondiInTutto % 3600) / 60),
    secondi: secondiInTutto % 60,
  };
}

/* Quanto dura la festa dei fuochi sul tablet dopo la mezzanotte. */
export const MINUTI_DEI_FUOCHI = 10;

/**
 * Cosa mostra il tablet a riposo in questo momento delle feste.
 *
 *  - `"conto"`: il 31 dicembre dalle 23:00 all'ultimo secondo — il conto alla
 *    rovescia a tutto schermo, anche se e' notte;
 *  - `"fuochi"`: l'1 gennaio dalla mezzanotte alle 00:10;
 *  - `"vigilia"`: il resto della finestra, la scena col bosco e la baita;
 *  - `null`: fuori dalle feste.
 */
export function momentoDelMuro(data = new Date()) {
  const d = comeData(data);
  if (!d || !inFesta(d)) return null;
  if (d.getMonth() === 11 && d.getDate() === 31 && d.getHours() === 23) return "conto";
  if (
    d.getMonth() === 0 &&
    d.getDate() === 1 &&
    d.getHours() === 0 &&
    d.getMinutes() < MINUTI_DEI_FUOCHI
  )
    return "fuochi";
  return "vigilia";
}

/** Il primo dell'anno: in Home, gli auguri. */
export function eCapodanno(data = new Date()) {
  const d = comeData(data);
  return Boolean(d && d.getMonth() === 0 && d.getDate() === 1);
}

/**
 * I giorni che hanno un nome: la scena del tablet lo scrive accanto alla data,
 * in oro. Torna una chiave; le parole le mette chi disegna.
 */
export function giornoConUnNome(data = new Date()) {
  const d = comeData(data);
  if (!d || !inFesta(d)) return "";
  const chiave = `${d.getMonth()}-${d.getDate()}`;
  return (
    {
      "11-24": "vigilia",
      "11-25": "natale",
      "11-26": "santo-stefano",
      "11-31": "san-silvestro",
      "0-1": "capodanno",
      "0-6": "epifania",
    }[chiave] || ""
  );
}

/* ── la configurazione ────────────────────────────────────────────────────── */

/** «17:00» se e' un'ora buona, `""` altrimenti. «7:5» diventa «07:05». */
export function oraPulita(valore) {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(clean(valore));
  if (!m) return "";
  const ore = Number(m[1]);
  const minuti = Number(m[2]);
  if (ore > 23 || minuti > 59) return "";
  return `${String(ore).padStart(2, "0")}:${String(minuti).padStart(2, "0")}`;
}

const ENTITA = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;

/** Se un'entita' e' una luce che si puo' mettere fra quelle di Natale. */
export function eUnaLuceDiNatale(entity) {
  const id = clean(entity).toLowerCase();
  return ENTITA.test(id) && DOMINI_DELLE_LUCI.includes(id.split(".")[0]);
}

/* Un nome e' un nome — «Albero», «Presepe» — e un'icona e' un glifo o due:
 * in Home stanno su una tessera larga una mano. */
const NOME_AL_MASSIMO = 40;
const ICONA_AL_MASSIMO = 8;

function lucePulita(grezza) {
  const sorgente = typeof grezza === "string" ? { entity: grezza } : grezza;
  if (!sorgente || typeof sorgente !== "object") return null;
  const entity = clean(sorgente.entity || sorgente.entity_id).toLowerCase();
  if (!eUnaLuceDiNatale(entity)) return null;
  const luce = { entity };
  const nome = clean(sorgente.nome).slice(0, NOME_AL_MASSIMO);
  const icona = [...clean(sorgente.icona)].slice(0, ICONA_AL_MASSIMO).join("");
  if (nome) luce.nome = nome;
  if (icona) luce.icona = icona;
  return luce;
}

/**
 * La configurazione delle luci di Natale, ripulita:
 *
 * ```
 * { luci: [{ entity, nome?, icona? }],
 *   accendi: { tipo: "tramonto"|"ora", ora: "17:00", scarto: 0 },
 *   spegni: { ora: "23:30" },
 *   giorni: [0..6] }         // come `Date#getDay`: 0 e' domenica
 * ```
 *
 * Arriva dal deposito, cioe' da chiunque: un salvataggio vecchio, uno scritto
 * a mano, una stringa JSON. Qualunque cosa entri, esce questa forma, con i
 * valori di serie dove manca qualcosa. Un'entita' doppia si tiene una volta,
 * quelle oltre l'ottava si lasciano.
 */
export function festePulite(grezza) {
  let sorgente = grezza;
  if (typeof sorgente === "string") {
    try {
      sorgente = JSON.parse(sorgente);
    } catch (_errore) {
      sorgente = null;
    }
  }
  const s = sorgente && typeof sorgente === "object" && !Array.isArray(sorgente) ? sorgente : {};
  const viste = new Set();
  const luci = [];
  for (const grezzaLuce of Array.isArray(s.luci) ? s.luci : []) {
    const luce = lucePulita(grezzaLuce);
    if (!luce || viste.has(luce.entity)) continue;
    viste.add(luce.entity);
    luci.push(luce);
    if (luci.length >= LUCI_AL_MASSIMO) break;
  }
  const accendi = s.accendi && typeof s.accendi === "object" ? s.accendi : {};
  const scarto = Math.round(Number(accendi.scarto));
  const spegni = s.spegni && typeof s.spegni === "object" ? s.spegni : {};
  const giorni = Array.isArray(s.giorni)
    ? [
        ...new Set(s.giorni.map(Number).filter((g) => Number.isInteger(g) && g >= 0 && g <= 6)),
      ].sort((a, b) => a - b)
    : [...TUTTI_I_GIORNI];
  return {
    luci,
    accendi: {
      tipo: accendi.tipo === "ora" ? "ora" : "tramonto",
      ora: oraPulita(accendi.ora) || ORA_DI_ACCENSIONE,
      scarto: Number.isFinite(scarto)
        ? Math.min(SCARTO_MASSIMO, Math.max(SCARTO_MINIMO, scarto))
        : 0,
    },
    spegni: { ora: oraPulita(spegni.ora) || ORA_DI_SPEGNIMENTO },
    giorni,
  };
}

/** Le entita' delle luci, per chi deve sapere quali cambi di stato contano. */
export function entitaDelleLuci(config) {
  return (config?.luci || []).map((luce) => luce.entity);
}

/* ── le parole e le icone ─────────────────────────────────────────────────── */

/** Senza accenti e senza maiuscole: «Presèpe» trova «presepe». */
function appiattita(testo) {
  return clean(testo)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[_.]+/g, " ");
}

/** Se un nome (o un'entita') sembra una luce di Natale. */
export function sembraDiNatale(testo) {
  const piatto = appiattita(testo);
  return Boolean(piatto) && PAROLE_DELLE_LUCI.some((parola) => piatto.includes(parola));
}

/**
 * Le luci di casa che sembrano di Natale e non sono ancora fra quelle scelte:
 * le propone la configurazione. Al piu' `quante`, in ordine di nome.
 */
export function luciDaProporre(states = {}, config = festePulite(null), quante = 6) {
  const gia = new Set(entitaDelleLuci(config));
  const fuori = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    if (gia.has(entity) || !eUnaLuceDiNatale(entity)) continue;
    const nome = clean(stato?.attributes?.friendly_name);
    if (!sembraDiNatale(nome) && !sembraDiNatale(entity)) continue;
    fuori.push({ entity, nome: nome || entity });
  }
  return fuori.sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, quante);
}

/* L'icona di una luce quando chi l'ha messa non ne ha scelta una: dal nome.
 * L'albero e' un albero, il presepe ha la stella, una candela e' una candela;
 * per il resto le lucine. */
const ICONE_DAL_NOME = Object.freeze([
  ["albero", "🎄"],
  ["tree", "🎄"],
  ["presep", "⭐"],
  ["cometa", "🌟"],
  ["stella", "🌟"],
  ["star", "🌟"],
  ["candel", "🕯️"],
  ["candle", "🕯️"],
  ["vetrin", "🕯️"],
  ["ghirland", "🎀"],
  ["regal", "🎁"],
  ["pacch", "🎁"],
  ["renn", "🦌"],
]);

export const ICONE_DELLE_LUCI = Object.freeze([
  "🎄",
  "⭐",
  "🌟",
  "✨",
  "🕯️",
  "💡",
  "🎁",
  "🎀",
  "🔔",
  "🦌",
  "❄️",
  "🏠",
]);

/** L'icona da mostrare per questa luce. */
export function iconaDellaLuce(luce, nome = "") {
  if (clean(luce?.icona)) return clean(luce.icona);
  const piatto = appiattita(`${clean(luce?.nome)} ${clean(nome)} ${clean(luce?.entity)}`);
  for (const [parola, icona] of ICONE_DAL_NOME) if (piatto.includes(parola)) return icona;
  return "✨";
}

/* ── gli orari ────────────────────────────────────────────────────────────── */

const giornoDi = (data) => new Date(data.getFullYear(), data.getMonth(), data.getDate());
const nomeDelGiorno = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
const alleOre = (giorno, ora) => {
  const [h, m] = ora.split(":").map(Number);
  return new Date(giorno.getFullYear(), giorno.getMonth(), giorno.getDate(), h, m).getTime();
};

/**
 * L'ora del tramonto in un giorno, da quello che dice `sun.sun`.
 *
 * `sun.sun` dice solo il PROSSIMO tramonto (`next_setting`): alle tre del
 * pomeriggio e' quello di oggi, alle sei e' gia' quello di domani. Per sapere
 * quando e' tramontato oggi, a tramonto passato, si prende l'ora del prossimo e
 * la si mette su oggi: fra un giorno e l'altro il tramonto si sposta di un
 * minuto o due, e per accendere un albero un minuto non conta. Cosi' non
 * serve ricordarsi niente, e un ponte che riparte alle otto di sera sa lo
 * stesso da quando le luci dovrebbero essere accese.
 *
 * Senza `sun.sun` (l'integrazione si puo' togliere) `null`: chi chiede usa
 * l'ora scritta.
 */
export function tramontoDelGiorno(giorno, prossimoTramonto) {
  if (prossimoTramonto === null || prossimoTramonto === undefined || prossimoTramonto === "")
    return null;
  const t = new Date(prossimoTramonto);
  if (!Number.isFinite(t.getTime())) return null;
  return new Date(
    giorno.getFullYear(),
    giorno.getMonth(),
    giorno.getDate(),
    t.getHours(),
    t.getMinutes(),
  ).getTime();
}

/**
 * L'intervallo acceso di un giorno: quando si accendono e quando si spengono.
 *
 * Il giorno e' quello dell'accensione. Lo spegnimento, se l'ora e' prima
 * dell'accensione («all'una di notte»), e' il giorno dopo. Nessun intervallo
 * se quel giorno non e' fra quelli scelti o se l'accensione cade fuori dalle
 * feste; e la fine non va mai oltre la fine delle feste — dopo il 6 gennaio le
 * luci non restano accese per un'altra notte.
 *
 * `inizio` si puo' imporre: e' quello di un intervallo gia' aperto, che non si
 * deve spostare perche' nel frattempo `sun.sun` e' passato al tramonto di
 * domani.
 */
export function intervalloDelGiorno(config, giorno, prossimoTramonto = null, inizio = null) {
  const c = config || festePulite(null);
  const g = giornoDi(giorno);
  if (!c.giorni.includes(g.getDay())) return null;
  let partenza = inizio;
  if (!Number.isFinite(partenza)) {
    const tramonto = c.accendi.tipo === "tramonto" ? tramontoDelGiorno(g, prossimoTramonto) : null;
    partenza = tramonto !== null ? tramonto + c.accendi.scarto * MINUTO : alleOre(g, c.accendi.ora);
  }
  const finestra = finestraDelleFeste(new Date(partenza));
  if (!finestra) return null;
  let fine = alleOre(g, c.spegni.ora);
  if (fine <= partenza) fine += GIORNO;
  fine = Math.min(fine, finestra.fine.getTime());
  if (fine <= partenza) return null;
  return { giorno: nomeDelGiorno(g), inizio: partenza, fine };
}

/** L'intervallo acceso che contiene questo momento, o `null`. */
export function intervalloDiAdesso(config, adesso, prossimoTramonto = null) {
  const ora = Number(adesso);
  const oggi = giornoDi(new Date(ora));
  /* Ieri prima di oggi no: oggi prima, perche' un intervallo di oggi che e'
   * gia' cominciato vale piu' di uno di ieri che finisce dopo mezzanotte —
   * possono toccarsi solo se lo spegnimento e' dopo l'accensione del giorno
   * dopo, cioe' mai con orari scritti da una persona. */
  for (const giorno of [oggi, new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 1)]) {
    const intervallo = intervalloDelGiorno(config, giorno, prossimoTramonto);
    if (intervallo && intervallo.inizio <= ora && ora < intervallo.fine) return intervallo;
  }
  return null;
}

/** L'ora «HH:MM» di un momento, in ora locale. */
export function oraDi(momento) {
  const d = new Date(momento);
  if (!Number.isFinite(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ── cosa fare con le luci ────────────────────────────────────────────────── */

/* Dopo aver acceso, quanto si aspetta prima di credere che le luci spente
 * siano state spente a mano: Home Assistant ci mette un attimo a dirlo, e una
 * presa zigbee lontana anche qualche secondo. */
export const PAZIENZA_DOPO_L_ACCENSIONE = 90 * 1000;

/* Un intervallo rimasto aperto da tanto (il ponte spento per giorni) si chiude
 * senza spegnere: spegnere le luci di qualcuno due giorni dopo non e'
 * rispettare l'orario, e' una sorpresa. */
const CHIUDI_SENZA_SPEGNERE_DOPO = 6 * ORA;

/** La memoria del ponte, ripulita: cosa ha fatto nell'intervallo in corso. */
export function memoriaPulita(grezza) {
  const m = grezza && typeof grezza === "object" ? grezza : {};
  const stato = ["acceso", "a-mano", "chiuso"].includes(m.stato) ? m.stato : "";
  if (!stato || !/^\d{4}-\d{2}-\d{2}$/.test(clean(m.giorno)) || !Number.isFinite(m.inizio))
    return {};
  const fuori = { giorno: m.giorno, inizio: m.inizio, stato };
  if (Number.isFinite(m.accesoIl)) fuori.accesoIl = m.accesoIl;
  return fuori;
}

const giornoDaNome = (nome) => {
  const [a, m, g] = nome.split("-").map(Number);
  return new Date(a, m - 1, g);
};

/**
 * Cosa fare adesso con le luci di Natale. Lo chiede il ponte a ogni battito.
 *
 * Entra:
 *  - `config`: le luci, gli orari, i giorni;
 *  - `adesso`: il momento, in millisecondi;
 *  - `tramonto`: il `next_setting` di `sun.sun`, o niente;
 *  - `accese`: se almeno una delle luci e' accesa (`true`/`false`), o `null`;
 *  - `memoria`: quello che si e' fatto finora in questo intervallo.
 *
 * Esce `{ azione: "accendi"|"spegni"|null, memoria, perche }`.
 *
 * ── Non combattere chi abita la casa ──────────────────────────────────────
 *
 * Le luci si accendono UNA volta, all'inizio dell'intervallo. Se poi qualcuno
 * le spegne a mano — una sera che non le vuole — restano spente fino
 * all'intervallo dopo: rimetterle accese al battito successivo sarebbe un
 * braccio di ferro che vince sempre la casa. Allo stesso modo, quando le
 * spegne l'orario lo fa una volta: chi le riaccende a mezzanotte per gli
 * ospiti le ritrova accese.
 *
 * ── Solo nelle feste ──────────────────────────────────────────────────────
 *
 * Un intervallo nasce solo se l'accensione cade dentro le feste
 * (`intervalloDelGiorno`). Fuori, senza un intervallo aperto, non si fa
 * niente. L'unica azione che puo' cadere appena dopo il 6 gennaio e' lo
 * spegnimento di un intervallo aperto la sera prima, che finisce proprio con
 * la fine delle feste: e' chiudere quello che si era aperto.
 */
export function decidiLeLuci({
  config,
  adesso,
  tramonto = null,
  accese = null,
  memoria = {},
} = {}) {
  const c = config || festePulite(null);
  const m = memoriaPulita(memoria);
  const ora = Number(adesso);
  const nulla = (perche, nuova = m) => ({ azione: null, memoria: nuova, perche });
  if (!c.luci.length) return nulla("nessuna-luce", {});

  /* L'intervallo aperto resta quello che era: l'inizio non si ricalcola (il
   * tramonto di `sun.sun` e' gia' passato a domani), la fine si', perche'
   * chi sposta lo spegnimento alle 23:00 lo vuole stasera. */
  const aperto =
    m.giorno && m.stato !== "chiuso"
      ? intervalloDelGiorno(c, giornoDaNome(m.giorno), tramonto, m.inizio)
      : null;
  const corrente =
    aperto && aperto.inizio <= ora && ora < aperto.fine
      ? aperto
      : intervalloDiAdesso(c, ora, tramonto);

  if (!corrente) {
    if (!m.giorno || m.stato === "chiuso") return nulla("fuori-orario");
    const chiuso = { ...m, stato: "chiuso" };
    delete chiuso.accesoIl;
    const finito = aperto ? aperto.fine : m.inizio;
    if (ora - finito > CHIUDI_SENZA_SPEGNERE_DOPO) return nulla("chiuso-tardi", chiuso);
    return {
      azione: accese === false ? null : "spegni",
      memoria: chiuso,
      perche: "orario",
    };
  }

  if (corrente.giorno !== m.giorno) {
    return {
      azione: "accendi",
      memoria: { giorno: corrente.giorno, inizio: corrente.inizio, stato: "acceso", accesoIl: ora },
      perche: "orario",
    };
  }

  if (m.stato === "acceso") {
    if (accese === false && ora - (m.accesoIl ?? m.inizio) > PAZIENZA_DOPO_L_ACCENSIONE)
      return nulla("a-mano", { giorno: m.giorno, inizio: m.inizio, stato: "a-mano" });
    return nulla("accese");
  }
  return nulla(m.stato);
}

/**
 * Le chiamate a Home Assistant per accendere o spegnere: una per dominio, con
 * tutte le entita' di quel dominio insieme. `light.turn_on` per le luci,
 * `switch.turn_on` per le prese, `input_boolean.turn_on` per gli aiutanti.
 */
export function chiamateDelleLuci(config, accendi) {
  const perDominio = new Map();
  for (const id of entitaDelleLuci(config)) {
    const dominio = id.split(".")[0];
    if (!perDominio.has(dominio)) perDominio.set(dominio, []);
    perDominio.get(dominio).push(id);
  }
  return [...perDominio].map(([domain, entity_id]) => ({
    domain,
    service: accendi ? "turn_on" : "turn_off",
    data: { entity_id },
  }));
}

/** Quante delle luci sono accese, e se lo si sa. */
export function luciAccese(config, stato = () => null) {
  let accese = 0;
  let note = 0;
  for (const id of entitaDelleLuci(config)) {
    const valore = clean(stato(id)?.state).toLowerCase();
    if (valore === "on") accese += 1;
    if (valore === "on" || valore === "off") note += 1;
  }
  return { accese, note, totale: entitaDelleLuci(config).length };
}
