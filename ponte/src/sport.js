/* Lo sport che si segue in casa: la propria squadra di calcio, la Formula 1,
 * la MotoGP. Risultati, la prossima partita o gara, la classifica.
 *
 * Dal campo: «una card di sport dove scegli lo sport da seguire, la tua
 * squadra di calcio, F1, MotoGP, e vedi i risultati». La sezione Sport e il
 * suo widget nella Home li chiedono alla casa; la casa li chiede alle fonti
 * pubbliche, li mette tutti nella stessa forma e li tiene a mente qualche
 * minuto, cosi' dieci plance aperte fanno una domanda sola.
 *
 * LE FONTI. Nessuna chiave, nessun account:
 *   - calcio: ESPN (site.api.espn.com), squadre dei campionati, calendario
 *     di tutte le competizioni di una squadra, classifica, partite del giorno;
 *   - Formula 1: Jolpica (api.jolpi.ca), l'archivio che ha preso il posto di
 *     Ergast: ultima gara, sprint, calendario, classifiche;
 *   - MotoGP: i risultati ufficiali (api.motogp.pulselive.com): eventi della
 *     stagione, sessioni, classifica della gara e del campionato.
 *
 * SICUREZZA. Le domande le fanno solo le plance di chi e' entrato (la
 * commissione e' fra quelle che vogliono un utente: `commissioni.js`). Gli
 * indirizzi li scrive la casa e basta: dalla plancia arrivano solo un
 * campionato, che deve stare nell'elenco `CAMPIONATI`, e il numero di una
 * squadra, che deve essere un numero. Nessun indirizzo, nessun testo libero
 * finisce in una domanda fuori casa. Dalla casa non esce niente di chi la
 * abita: le fonti vedono una domanda sulla Serie A, uguale per tutti.
 */

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_CLASSIFICHE = "https://site.web.api.espn.com/apis/v2/sports/soccer";
/* Gli stemmi piccoli (128 px): bastano per ogni posto della plancia, e sul
 * filo del telefono pesano un decimo di quelli grandi. */
const stemmaDi = (id) =>
  `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&h=128&w=128`;
const F1 = "https://api.jolpi.ca/ergast/f1";
const MOTO = "https://api.motogp.pulselive.com/motogp/v1";
/* Dal vivo. La F1 ufficiale e OpenF1 durante una sessione non rispondono a
 * chi non paga; ESPN si', con l'ordine dei piloti e il giro. La MotoGP ha il
 * suo cronometraggio. */
const ESPN_F1 = "https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard";
const MOTO_DAL_VIVO = `${MOTO}/timing-gateway/livetiming-lite`;

/** I campionati di cui si possono scegliere le squadre. La chiave e' quella
 * di ESPN; il nome e' quello che si legge. */
export const CAMPIONATI = Object.freeze({
  "ita.1": "Serie A",
  "ita.2": "Serie B",
  "eng.1": "Premier League",
  "esp.1": "LaLiga",
  "ger.1": "Bundesliga",
  "fra.1": "Ligue 1",
  "por.1": "Primeira Liga",
  "ned.1": "Eredivisie",
});

/* Quanto si tiene a mente una risposta. Con una partita in corso il
 * risultato cambia: un minuto. Altrimenti un quarto d'ora; l'elenco delle
 * squadre un giorno. */
const PER_MEZZO_MINUTO = 30_000;
const PER_POCO = 60_000;
const PER_UN_PO = 15 * 60_000;
const PER_UN_GIORNO = 24 * 60 * 60_000;
const ATTESA = 15_000;
/* Quanto ha ogni cosa seguita per rispondere: la plancia aspetta 25 secondi
 * tutta la risposta. */
const ENTRO = 15_000;

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const testo = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

/** I campionati di hockey: solo la NHL. Le leghe italiane (ghiaccio, pista,
 * prato) non hanno una fonte pubblica con i dati: solo pagine web, che
 * cambiano senza avviso. */
export const LEGHE_HOCKEY = Object.freeze({ nhl: "NHL" });
const ESPN_HOCKEY = "https://site.api.espn.com/apis/site/v2/sports/hockey";
const ESPN_CLASSIFICHE_HOCKEY = "https://site.web.api.espn.com/apis/v2/sports/hockey";

export function legaHockeyValida(l) {
  return typeof l === "string" && Object.hasOwn(LEGHE_HOCKEY, l);
}

/** `nhl:<sigla>` di uno stemma di hockey: la sigla e' quella di ESPN. */
export function stemmaHockeyValido(chiave) {
  return /^nhl:[a-z]{2,4}$/.test(typeof chiave === "string" ? chiave : "");
}

export function campionatoValido(c) {
  return typeof c === "string" && Object.hasOwn(CAMPIONATI, c);
}

/* Le scuderie di F1, col nome che hanno negli indirizzi del sito della F1:
 * il loro simbolo (bianco, da mettere sul colore della scuderia) sta in
 * `common/f1/<anno>/<nome>/<anno><nome>logowhite.webp`. Solo queste: un
 * identificativo che non e' qui non diventa un indirizzo. */
export const SCUDERIE_F1 = Object.freeze({
  mercedes: "mercedes",
  ferrari: "ferrari",
  mclaren: "mclaren",
  red_bull: "redbullracing",
  rb: "racingbulls",
  alpine: "alpine",
  haas: "haasf1team",
  audi: "audi",
  sauber: "kicksauber",
  williams: "williams",
  aston_martin: "astonmartin",
  cadillac: "cadillac",
});

/** `f1:<constructorId>` di una scuderia che si conosce. */
export function scuderiaValida(chiave) {
  const m = /^f1:([a-z_]{2,20})$/.exec(typeof chiave === "string" ? chiave : "");
  return Boolean(m && Object.hasOwn(SCUDERIE_F1, m[1]));
}

const simboloDellaScuderia = (slug, anno) =>
  `https://media.formula1.com/image/upload/c_lfill,w_96/q_auto/v1740000000/common/f1/${anno}/${slug}/${anno}${slug}logowhite.webp`;

export function squadraValida(id) {
  return typeof id === "string" ? /^\d{1,7}$/.test(id) : Number.isInteger(id) && id > 0;
}

/* ---------------------------------------------------------------- calcio */

/* Il nome breve come si dice qui: ESPN scrive «Inter Milan», «AC Milan»,
 * «AS Roma»; in casa si dice Inter, Milan, Roma. */
function nomeBreve(nome) {
  return testo(nome)
    .replace(/^Inter Milan$/i, "Inter")
    .replace(/^(AC|AS|SS|SSC|US|ACF|FC|AFC|SC)\s+/, "")
    .trim();
}

function squadraDi(t = {}) {
  const team = t.team || t;
  const logo =
    (team.logos || []).find((l) => (l.rel || []).includes("default")) || (team.logos || [])[0];
  return {
    id: testo(team.id),
    nome: testo(team.displayName || team.name || team.location),
    breve: nomeBreve(team.shortDisplayName || team.displayName || team.name),
    sigla: testo(team.abbreviation),
    colore: /^[0-9a-f]{6}$/i.test(team.color || "") ? `#${team.color}` : null,
    logo: Boolean(logo?.href || team.logo),
  };
}

/* Le competizioni coi nomi come si dicono qui; le altre come le chiama ESPN. */
const COMPETIZIONI = {
  "uefa.champions": "Champions League",
  "uefa.europa": "Europa League",
  "uefa.europa.conf": "Conference League",
  "ita.coppa_italia": "Coppa Italia",
  "ita.super_cup": "Supercoppa",
  "fifa.cwc": "Mondiale per club",
};
const nomeDellaCompetizione = (lega) =>
  COMPETIZIONI[lega?.slug] ||
  CAMPIONATI[lega?.slug] ||
  testo(lega?.abbreviation || lega?.name || "");
const legaValida = (slug) =>
  typeof slug === "string" && /^[a-z]{2,8}(\.[a-z0-9_]{1,20}){1,2}$/.test(slug);

/** Una partita di ESPN, vista dalla parte di `mia` (la squadra seguita). */
export function partitaDaEspn(evento, mia) {
  const gara = evento?.competitions?.[0];
  if (!gara) return null;
  const lati = gara.competitors || [];
  const casa = lati.find((c) => c.homeAway === "home") || lati[0];
  const fuori = lati.find((c) => c.homeAway === "away") || lati[1];
  if (!casa || !fuori) return null;
  const stato = gara.status?.type || evento.status?.type || {};
  const fase = stato.state === "in" ? "in" : stato.state === "post" ? "fine" : "prima";
  const gol = (c) => {
    if (fase === "prima") return null;
    const v = typeof c.score === "object" ? (c.score?.value ?? c.score?.displayValue) : c.score;
    return numero(v);
  };
  const lato = (c) => ({ ...squadraDi(c), gol: gol(c), rigori: numero(c.shootoutScore) });
  const p = {
    id: testo(evento.id),
    quando: testo(evento.date || gara.date),
    competizione: nomeDellaCompetizione(evento.league),
    lega: legaValida(evento.league?.slug) ? evento.league.slug : "",
    luogo: testo(gara.venue?.fullName || ""),
    casa: lato(casa),
    fuori: lato(fuori),
    fase,
    minuto: fase === "in" ? testo(gara.status?.displayClock || stato.shortDetail || "") : "",
    intervallo: stato.name === "STATUS_HALFTIME",
    rinviata: /POSTPONED|CANCELED|SUSPENDED/.test(stato.name || ""),
  };
  if (fase === "fine" && mia && p.casa.gol != null && p.fuori.gol != null) {
    const io = p.casa.id === String(mia) ? p.casa : p.fuori;
    const loro = io === p.casa ? p.fuori : p.casa;
    const a = io.gol + (io.rigori ?? 0) / 100;
    const b = loro.gol + (loro.rigori ?? 0) / 100;
    p.esito = a > b ? "V" : a < b ? "P" : "N";
  }
  return p;
}

/* Le coppe europee: se la squadra seguita le gioca, ognuna ha il suo blocco
 * con la classifica della fase a girone unico e le sue partite. */
export const COPPE_EUROPEE = Object.freeze(["uefa.champions", "uefa.europa", "uefa.europa.conf"]);

/* Le zone della classifica (chi passa, chi va agli spareggi, chi esce, chi
 * va in Europa, chi retrocede), come le scrive ESPN: qui diventano una
 * parola che la plancia traduce, e un colore. */
const ZONE = [
  [/round of 16/i, "ottavi"],
  [/playoff/i, "spareggi"],
  [/eliminat/i, "fuori"],
  [/relegat/i, "retrocede"],
  [/^champions/i, "champions"],
  [/^europa/i, "europa"],
  [/conference/i, "conference"],
];
function zonaDi(nota) {
  const descrizione = testo(nota?.description);
  const chiave = ZONE.find(([re]) => re.test(descrizione))?.[1];
  if (!chiave) return null;
  const colore = testo(nota?.color);
  return { chiave, colore: /^#[0-9a-f]{6}$/i.test(colore) ? colore : "" };
}

/** La classifica di un campionato da ESPN: una riga per squadra. */
export function classificaDaEspn(json) {
  const gruppi = json?.children?.length ? json.children : [json];
  const righe = [];
  for (const g of gruppi) {
    for (const e of g?.standings?.entries || []) {
      const s = Object.fromEntries(
        (e.stats || []).map((x) => [x.name, numero(x.value ?? x.displayValue)]),
      );
      righe.push({
        ...squadraDi(e.team),
        posizione: s.rank ?? righe.length + 1,
        punti: s.points ?? 0,
        giocate: s.gamesPlayed ?? 0,
        vinte: s.wins ?? 0,
        pari: s.ties ?? 0,
        perse: s.losses ?? 0,
        fatti: s.pointsFor ?? 0,
        subiti: s.pointsAgainst ?? 0,
        zona: zonaDi(e.note),
      });
    }
  }
  return righe.sort((a, b) => a.posizione - b.posizione);
}

/** Le squadre di un campionato, in ordine di nome. */
export function squadreDaEspn(json) {
  const elenco = json?.sports?.[0]?.leagues?.[0]?.teams || [];
  return elenco
    .map((t) => squadraDi(t.team))
    .filter((s) => s.id && s.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

/** Le coppe europee che la squadra gioca quest'anno, dal suo calendario. */
export function coppeDelCalendario(giocate, prossime) {
  const leghe = new Set(
    [...(giocate?.events || []), ...(prossime?.events || [])].map((e) => e?.league?.slug),
  );
  return COPPE_EUROPEE.filter((l) => leghe.has(l));
}

/** Tutto della squadra seguita: le ultime, le prossime, quella in corso, il
 * posto in classifica. `giocate` e `prossime` sono i calendari di ESPN di
 * tutte le competizioni; `classifica` quella del suo campionato;
 * `classificheDelleCoppe` quelle delle coppe europee che gioca, per lega. */
export function calcioDaEspn({
  id,
  campionato,
  giocate,
  prossime,
  classifica,
  squadra,
  classificheDelleCoppe = {},
}) {
  const tutte = new Map();
  for (const e of [...(giocate?.events || []), ...(prossime?.events || [])]) {
    const p = partitaDaEspn(e, id);
    if (p && !tutte.has(p.id)) tutte.set(p.id, p);
  }
  const inOrdine = [...tutte.values()].sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando));
  const tabella = classificaDaEspn(classifica);
  const io =
    squadraDi(giocate?.team || prossime?.team || squadra?.team || {}) ||
    tabella.find((r) => r.id === String(id));
  const riga = tabella.find((r) => r.id === String(id)) || null;
  return {
    tipo: "calcio",
    campionato: { id: campionato, nome: CAMPIONATI[campionato] || "" },
    squadra: {
      ...io,
      id: String(id),
      nome: io.nome || riga?.nome || "",
      breve: riga?.breve || io.breve,
    },
    dalVivo: inOrdine.find((p) => p.fase === "in") || null,
    ultime: inOrdine
      .filter((p) => p.fase === "fine")
      .slice(-5)
      .reverse(),
    prossime: inOrdine.filter((p) => p.fase === "prima" && !p.rinviata).slice(0, 5),
    posizione: riga,
    classifica: tabella,
    coppe: coppeDelCalendario(giocate, prossime).map((lega) => {
      const sue = inOrdine.filter((p) => p.lega === lega);
      const tab = classificaDaEspn(classificheDelleCoppe?.[lega]);
      return {
        lega,
        nome: COMPETIZIONI[lega],
        dalVivo: sue.find((p) => p.fase === "in") || null,
        ultime: sue
          .filter((p) => p.fase === "fine")
          .slice(-4)
          .reverse(),
        prossime: sue.filter((p) => p.fase === "prima" && !p.rinviata).slice(0, 3),
        posizione: tab.find((r) => r.id === String(id)) || null,
        classifica: tab,
      };
    }),
  };
}

/* --------------------------------------------------------------- hockey */

/* Lo stemma di una squadra di hockey si chiede al ponte con la sua sigla:
 * l'identificativo numerico di ESPN e' lo stesso spazio di quello del
 * calcio, e la stessa cifra sarebbe due squadre diverse. */
function conLoStemma(sq) {
  const sigla = testo(sq?.sigla).toLowerCase();
  return { ...sq, stemma: /^[a-z]{2,4}$/.test(sigla) ? `nhl:${sigla}` : "" };
}

/** Una partita di hockey di ESPN: come una di calcio, piu' il tempo
 * supplementare o i rigori (`OT`, `SO`) e il periodo in corso. */
export function partitaDiHockey(evento, mia, lega = "nhl") {
  const p = partitaDaEspn(evento, mia);
  if (!p) return null;
  const stato = evento?.competitions?.[0]?.status || evento?.status || {};
  const altro = testo(stato.type?.altDetail).toUpperCase();
  return {
    ...p,
    competizione: LEGHE_HOCKEY[lega] || "",
    /* Il dettaglio di una partita di hockey non c'e': senza lega non si
     * tocca. */
    lega: "",
    casa: conLoStemma(p.casa),
    fuori: conLoStemma(p.fuori),
    minuto: p.fase === "in" ? testo(stato.type?.shortDetail || stato.displayClock) : "",
    intervallo: /END_PERIOD|INTERMISSION/.test(stato.type?.name || ""),
    supplementari: altro === "OT" || altro === "SO" ? altro : "",
  };
}

/** La classifica di hockey: la conference della squadra, per punti. */
export function classificaDiHockey(json, id) {
  const gruppi = json?.children?.length ? json.children : [json];
  const suo =
    gruppi.find((g) =>
      (g?.standings?.entries || []).some((e) => String(e?.team?.id) === String(id)),
    ) || gruppi[0];
  const righe = classificaDaEspn({ standings: suo?.standings })
    .map((r) => conLoStemma(r))
    .sort((a, b) => b.punti - a.punti || a.giocate - b.giocate || b.vinte - a.vinte);
  return {
    nome: testo(suo?.name || ""),
    righe: righe.map((r, i) => ({ ...r, posizione: i + 1, zona: null })),
  };
}

/** Tutto della squadra di hockey seguita, nella forma della squadra di
 * calcio: la plancia la disegna con gli stessi pezzi. */
export function hockeyDaEspn({ id, lega = "nhl", calendario, classifica }) {
  const tutte = new Map();
  for (const e of calendario?.events || []) {
    const p = partitaDiHockey(e, id, lega);
    if (p && !tutte.has(p.id)) tutte.set(p.id, p);
  }
  const inOrdine = [...tutte.values()].sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando));
  const tabella = classificaDiHockey(classifica, id);
  const riga = tabella.righe.find((r) => r.id === String(id)) || null;
  const io = conLoStemma(squadraDi(calendario?.team || {}));
  return {
    tipo: "hockey",
    campionato: {
      id: lega,
      nome: [LEGHE_HOCKEY[lega], tabella.nome].filter(Boolean).join(" · "),
    },
    squadra: {
      ...io,
      id: String(id),
      nome: io.nome || riga?.nome || "",
      breve: riga?.breve || io.breve,
      colore: io.colore || riga?.colore || null,
    },
    dalVivo: inOrdine.find((p) => p.fase === "in") || null,
    ultime: inOrdine
      .filter((p) => p.fase === "fine")
      .slice(-5)
      .reverse(),
    prossime: inOrdine.filter((p) => p.fase === "prima" && !p.rinviata).slice(0, 5),
    posizione: riga,
    classifica: tabella.righe,
    coppe: [],
  };
}

/* ------------------------------------------------------------ Formula 1 */

const istanteF1 = (data, ora) => (data ? `${data}T${ora || "00:00:00Z"}` : "");

function pilotaF1(d = {}) {
  return {
    id: testo(d.driverId),
    nome: [testo(d.givenName), testo(d.familyName)].filter(Boolean).join(" "),
    cognome: testo(d.familyName),
    sigla: testo(d.code),
    numero: testo(d.permanentNumber),
  };
}

function garaF1(r, chiave) {
  if (!r) return null;
  return {
    giro: numero(r.round),
    nome: testo(r.raceName),
    circuito: testo(r.Circuit?.circuitName),
    luogo: testo(r.Circuit?.Location?.locality),
    paese: testo(r.Circuit?.Location?.country),
    quando: istanteF1(r.date, r.time),
    risultati: (r[chiave] || []).map((x) => ({
      posizione: numero(x.position),
      ...pilotaF1(x.Driver),
      scuderia: testo(x.Constructor?.name),
      scuderiaId: testo(x.Constructor?.constructorId),
      punti: numero(x.points) ?? 0,
      tempo: testo(x.Time?.time || ""),
      stato: testo(x.status || ""),
      giroVeloce: x.FastestLap?.rank === "1",
    })),
  };
}

export function f1DaJolpica({
  gara,
  sprint,
  calendario,
  piloti,
  costruttori,
  adesso = Date.now(),
}) {
  const ultima = garaF1(gara?.MRData?.RaceTable?.Races?.[0], "Results");
  const corta = garaF1(sprint?.MRData?.RaceTable?.Races?.[0], "SprintResults");
  const gare = calendario?.MRData?.RaceTable?.Races || [];
  const SESSIONI = [
    ["FirstPractice", "L1"],
    ["SecondPractice", "L2"],
    ["ThirdPractice", "L3"],
    ["SprintQualifying", "QS"],
    ["Sprint", "S"],
    ["Qualifying", "Q"],
  ];
  const prossima = gare
    .map((r) => ({
      r,
      quando: istanteF1(r.date, r.time),
    }))
    .find(({ quando }) => Date.parse(quando) + 3 * 3600_000 > adesso);
  const tabPiloti = piloti?.MRData?.StandingsTable?.StandingsLists?.[0];
  const tabCostruttori = costruttori?.MRData?.StandingsTable?.StandingsLists?.[0];
  return {
    tipo: "f1",
    stagione: numero(gare[0]?.season || tabPiloti?.season),
    gare: gare.length,
    ultima,
    /* La sprint conta solo se e' dello stesso fine settimana dell'ultima gara
     * o di uno dopo: altrimenti e' vecchia. */
    sprint: corta && (!ultima || corta.giro >= ultima.giro) ? corta : null,
    prossima: prossima
      ? {
          giro: numero(prossima.r.round),
          nome: testo(prossima.r.raceName),
          circuito: testo(prossima.r.Circuit?.circuitName),
          luogo: testo(prossima.r.Circuit?.Location?.locality),
          paese: testo(prossima.r.Circuit?.Location?.country),
          quando: prossima.quando,
          sessioni: [
            ...SESSIONI.filter(([k]) => prossima.r[k]).map(([k, sigla]) => ({
              sigla,
              quando: istanteF1(prossima.r[k].date, prossima.r[k].time),
            })),
            { sigla: "G", quando: prossima.quando },
          ].sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando)),
        }
      : null,
    piloti: (tabPiloti?.DriverStandings || []).map((x) => ({
      posizione: numero(x.position),
      ...pilotaF1(x.Driver),
      scuderia: testo(x.Constructors?.at(-1)?.name),
      scuderiaId: testo(x.Constructors?.at(-1)?.constructorId),
      punti: numero(x.points) ?? 0,
      vittorie: numero(x.wins) ?? 0,
    })),
    costruttori: (tabCostruttori?.ConstructorStandings || []).map((x) => ({
      posizione: numero(x.position),
      id: testo(x.Constructor?.constructorId),
      nome: testo(x.Constructor?.name),
      punti: numero(x.points) ?? 0,
      vittorie: numero(x.wins) ?? 0,
    })),
  };
}

/* Minuscole e senza accenti: «Pérez» di ESPN e «Perez» di Jolpica sono lo
 * stesso pilota. */
const semplice = (v) =>
  testo(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* Quanto dura una sessione, per sapere quando guardare se e' in corso. */
const DURATA_DI = { G: 3 * 3600_000, S: 1.5 * 3600_000 };
const durataDi = (sigla) => DURATA_DI[sigla] || 1.5 * 3600_000;

/** La sessione del calendario che potrebbe essere in corso adesso (dieci
 * minuti prima dell'inizio, fino alla fine piu' qualche ritardo). */
export function sessioneDaGuardare(sessioni, adesso = Date.now()) {
  return (
    (sessioni || []).find((s) => {
      const inizio = Date.parse(s?.quando);
      if (!Number.isFinite(inizio) || s.annullata) return false;
      return adesso >= inizio - 10 * 60_000 && adesso <= inizio + durataDi(s.sigla);
    }) || null
  );
}

const SIGLE_ESPN_F1 = {
  FP1: "L1",
  FP2: "L2",
  FP3: "L3",
  Qual: "Q",
  Race: "G",
  Sprint: "S",
  SS: "QS",
  SQ: "QS",
  "Sprint Shootout": "QS",
};

/** La sessione di F1 in corso da ESPN: l'ordine dei piloti (coi dati del
 * mondiale per la scuderia) e, in gara e in sprint, il giro. */
export function f1DalVivoDaEspn(json, piloti = []) {
  const perNome = new Map((piloti || []).map((p) => [semplice(p.nome), p]));
  const perCognome = new Map((piloti || []).map((p) => [semplice(p.cognome), p]));
  for (const e of json?.events || []) {
    for (const c of e?.competitions || []) {
      if (c?.status?.type?.state !== "in") continue;
      const sigla = SIGLE_ESPN_F1[testo(c.type?.abbreviation)] || "";
      const ordine = (c.competitors || [])
        .map((x) => {
          const nome = testo(x?.athlete?.displayName || x?.athlete?.fullName);
          const cognome = nome.split(/\s+/).slice(1).join(" ");
          const p = perNome.get(semplice(nome)) || perCognome.get(semplice(cognome)) || {};
          return {
            posizione: numero(x?.order),
            id: testo(p.id),
            nome,
            cognome: testo(p.cognome) || cognome || nome,
            numero: testo(p.numero),
            scuderia: testo(p.scuderia),
            scuderiaId: testo(p.scuderiaId),
          };
        })
        .filter((x) => x.nome && x.posizione)
        .sort((a, b) => a.posizione - b.posizione)
        .slice(0, 30);
      if (!ordine.length) continue;
      const giro = numero(c.status?.period);
      return {
        tipo: "f1",
        sessione: sigla,
        giro: (sigla === "G" || sigla === "S") && giro ? giro : null,
        giri: null,
        ordine,
      };
    }
  }
  return null;
}

const SIGLE_MOTO_DAL_VIVO = {
  RAC: "G",
  SPR: "S",
  Q1: "Q1",
  Q2: "Q2",
  FP1: "FP1",
  FP2: "FP2",
  PR: "PR",
};
const maiuscolaIniziale = (v) =>
  testo(v)
    .toLowerCase()
    .replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase());

/** La sessione di MotoGP in corso dal cronometraggio: ordine, distacchi,
 * giro. Solo la classe regina, e solo se qualcuno ha gia' fatto un giro. */
export function motoDalVivoDaPulselive(json) {
  const h = json?.head;
  if (!h || !/^motogp$/i.test(testo(h.category))) return null;
  const sigla = SIGLE_MOTO_DAL_VIVO[testo(h.session_shortname).toUpperCase()] || "";
  const righe = Object.values(json?.rider || {}).filter((x) => numero(x?.pos) > 0);
  const giro = Math.max(0, ...righe.map((x) => numero(x?.num_lap) || 0));
  if (!sigla || !righe.length || !giro) return null;
  const distacco = (v) => {
    const t = testo(v);
    return !t || /^0+(\.0+)?$/.test(t) ? "" : `+${t.replace(/^\+/, "")}`;
  };
  return {
    tipo: "motogp",
    sessione: sigla,
    giro,
    giri: sigla === "G" || sigla === "S" ? numero(h.num_laps) || null : null,
    ordine: righe
      .sort((a, b) => numero(a.pos) - numero(b.pos))
      .slice(0, 30)
      .map((x) => ({
        posizione: numero(x.pos),
        nome: maiuscolaIniziale(`${testo(x.rider_name)} ${testo(x.rider_surname)}`),
        numero: testo(x.rider_number),
        squadra: testo(x.team_name),
        moto: testo(x.bike_name),
        distacco: distacco(x.gap_first),
        aiBox: x.on_pit === true,
      })),
  };
}

/* ---------------------------------------------------------------- MotoGP */

const nomeGp = (e) => {
  const n = testo(e?.name || e?.sponsored_name);
  return n
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOf\b/g, "of");
};

function eventoMoto(e) {
  if (!e) return null;
  return {
    id: testo(e.id),
    nome: nomeGp(e),
    circuito: testo(e.circuit?.name),
    luogo: testo(e.circuit?.place),
    paese: testo(e.country?.name),
    sigla: testo(e.country?.iso),
    dal: testo(e.date_start),
    al: testo(e.date_end),
  };
}

function classificaMoto(json) {
  return (json?.classification || []).map((x) => ({
    posizione: numero(x.position),
    id: testo(x.rider?.id),
    nome: testo(x.rider?.full_name),
    numero: testo(x.rider?.number),
    paese: testo(x.rider?.country?.iso),
    squadra: testo(x.team?.name),
    moto: testo(x.constructor?.name),
    punti: numero(x.points) ?? 0,
    tempo: testo(x.time || ""),
    distacco: testo(x.gap?.first && x.gap.first !== "0.000" ? `+${x.gap.first}` : ""),
    stato: testo(x.status || ""),
    vittorie: numero(x.race_wins ?? x.wins) ?? null,
  }));
}

/* Le sessioni che contano di un fine settimana di MotoGP: le qualifiche, la
 * sprint e la gara, con le sigle della F1 (Q, S, G) cosi' la plancia le dice
 * allo stesso modo. */
const SESSIONI_DI_MOTO = { Q: "Q", SPR: "S", RAC: "G" };
function sessioniDiMoto(sessioni) {
  return (sessioni || [])
    .filter((s) => SESSIONI_DI_MOTO[s.type] && (s.type !== "Q" || Number(s.number) === 2))
    .map((s) => ({
      sigla: SESSIONI_DI_MOTO[s.type],
      quando: testo(s.date),
      ...sessioneToccabile(s),
    }))
    .sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando));
}

/* Tutte le sessioni di un fine settimana, per toccarle e vederne la
 * classifica: libere, prove, Q1 e Q2, sprint e gara. Il riscaldamento no:
 * dieci minuti di giri che non dicono niente. */
const TUTTE_LE_SESSIONI_DI_MOTO = {
  FP: (n) => `FP${n || ""}`,
  PR: () => "PR",
  Q: (n) => `Q${n || ""}`,
  SPR: () => "S",
  RAC: () => "G",
};
export function tutteLeSessioniDiMoto(sessioni) {
  return (sessioni || [])
    .filter((s) => TUTTE_LE_SESSIONI_DI_MOTO[s.type])
    .map((s) => ({
      sigla: TUTTE_LE_SESSIONI_DI_MOTO[s.type](numero(s.number)),
      quando: testo(s.date),
      ...sessioneToccabile(s),
    }))
    .sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando));
}

/* L'identificativo che serve a chiederne la classifica, e se c'e' gia'. */
function sessioneToccabile(s) {
  const id = testo(s?.id);
  return {
    id: sessioneMotoValida(id) ? id : "",
    finita: testo(s?.status) === "FINISHED",
    annullata: testo(s?.status) === "CANCELLED",
  };
}

export const sessioneMotoValida = (id) =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** `sessioni` sono quelle dell'evento dell'ultima gara, `gara` la classifica
 * della sessione scelta (`tipo`: RAC la gara, SPR la sprint). */
export function motoDaPulselive({
  eventi,
  eventoGara,
  tipo,
  gara,
  campionato,
  quando = "",
  sessioniProssime = [],
  sessioniGara = [],
  adesso = Date.now(),
}) {
  const veri = (eventi || []).filter((e) => !e.test);
  const oggi = new Date(adesso).toISOString().slice(0, 10);
  const prossimo = veri
    .filter((e) => testo(e.date_end) >= oggi)
    .sort((a, b) => testo(a.date_start).localeCompare(testo(b.date_start)))[0];
  const risultati = classificaMoto(gara);
  return {
    tipo: "motogp",
    stagione: numero(new Date(adesso).getUTCFullYear()),
    gare: veri.length,
    ultima:
      eventoGara && risultati.length
        ? {
            ...eventoMoto(eventoGara),
            tipo,
            quando: testo(quando),
            risultati,
            tutte: tutteLeSessioniDiMoto(sessioniGara),
          }
        : null,
    prossima: prossimo
      ? {
          ...eventoMoto(prossimo),
          sessioni: sessioniDiMoto(sessioniProssime),
          tutte: tutteLeSessioniDiMoto(sessioniProssime),
        }
      : null,
    piloti: classificaMoto(campionato).map(({ tempo, distacco, stato, ...r }) => r),
  };
}

/* ------------------------------------------------------------ i dettagli */

/* Quello che si apre toccando una partita o una sessione: chi ha segnato, i
 * cartellini, le formazioni; la classifica di una qualifica o di una sprint.
 * Si chiede solo quando lo si tocca, e solo chi e' entrato (`_loSport`). */

/* Gli eventi di una partita che contano, coi nomi della plancia. I ritardi,
 * il fischio d'inizio e la fine dei tempi restano fuori: sono rumore. */
function tipoDellEvento(e) {
  const t = testo(e?.type?.type).toLowerCase();
  const scritto = testo(e?.text).toLowerCase();
  if (t === "goal" || t.startsWith("goal") || e?.scoringPlay) {
    if (/own goal|autogol/.test(scritto) || t.includes("own")) return "autogol";
    if (/penalty|rigore/.test(scritto) || t.includes("penalty")) return "rigore";
    return "gol";
  }
  if (t === "yellow-card") return "giallo";
  if (t === "red-card" || t === "yellow-red-card" || t.includes("red")) return "rosso";
  if (t === "substitution") return "cambio";
  if (t === "penalty---missed" || /missed penalty|rigore sbagliato/.test(scritto))
    return "rigore-sbagliato";
  return "";
}

const STATISTICHE_DI_CALCIO = [
  ["possessionPct", "possesso"],
  ["totalShots", "tiri"],
  ["shotsOnTarget", "tiriInPorta"],
  ["wonCorners", "angoli"],
  ["foulsCommitted", "falli"],
  ["yellowCards", "gialli"],
  ["redCards", "rossi"],
  ["offsides", "fuorigioco"],
  ["saves", "parate"],
  ["accuratePasses", "passaggiRiusciti"],
  ["totalPasses", "passaggi"],
];

/** Il dettaglio di una partita di ESPN (`summary`). */
export function partitaDettaglioDaEspn(json) {
  const gara = json?.header?.competitions?.[0];
  if (!gara) return null;
  const lati = {};
  for (const c of gara.competitors || []) {
    const lato = c.homeAway === "away" ? "ospite" : "casa";
    lati[lato] = { ...squadraDi(c), gol: numero(c.score), id: testo(c.team?.id || c.id) };
  }
  const latoDi = (idSquadra) =>
    testo(idSquadra) && testo(idSquadra) === lati.ospite?.id ? "ospite" : "casa";
  const stato = gara.status?.type || {};
  const eventi = (json.keyEvents || [])
    .map((e) => {
      const tipo = tipoDellEvento(e);
      if (!tipo) return null;
      const chi = (e.participants || []).map((p) => testo(p?.athlete?.displayName));
      const riga = { minuto: testo(e.clock?.displayValue), tipo, lato: latoDi(e.team?.id) };
      if (tipo === "cambio") return { ...riga, entra: chi[0] || "", esce: chi[1] || "" };
      return { ...riga, chi: chi[0] || "", assist: tipo === "gol" ? chi[1] || "" : "" };
    })
    .filter(Boolean);
  const formazione = (r) => {
    const giocatori = (r?.roster || []).map((g) => ({
      numero: testo(g.jersey),
      nome: testo(g.athlete?.displayName),
      ruolo: testo(g.position?.abbreviation),
      titolare: Boolean(g.starter),
      entrato: Boolean(g.subbedIn),
      uscito: Boolean(g.subbedOut),
      posto: numero(g.formationPlace),
    }));
    return {
      modulo: testo(r?.formation),
      titolari: giocatori
        .filter((g) => g.titolare)
        .sort((a, b) => (a.posto ?? 99) - (b.posto ?? 99)),
      panchina: giocatori.filter((g) => !g.titolare),
    };
  };
  const formazioni = {};
  for (const r of json.rosters || []) formazioni[latoDi(r.team?.id)] = formazione(r);
  const valoriDi = (idSquadra) => {
    const t = (json.boxscore?.teams || []).find((x) => testo(x.team?.id) === idSquadra);
    return Object.fromEntries(
      (t?.statistics || []).map((x) => [testo(x.name), testo(x.displayValue)]),
    );
  };
  const casaV = valoriDi(lati.casa?.id);
  const ospiteV = valoriDi(lati.ospite?.id);
  const statistiche = STATISTICHE_DI_CALCIO.filter(([k]) => casaV[k] !== undefined).map(
    ([k, chiave]) => ({ chiave, casa: casaV[k], ospite: ospiteV[k] ?? "" }),
  );
  const info = json.gameInfo || {};
  const arbitro = (info.officials || []).find((o) => /referee/i.test(o?.position?.name || ""));
  return {
    tipo: "calcio",
    id: testo(json.header?.id),
    quando: testo(gara.date),
    fase: stato.state === "in" ? "in" : stato.completed ? "finita" : "prima",
    minuto: testo(gara.status?.displayClock || ""),
    casa: lati.casa || null,
    ospite: lati.ospite || null,
    stadio: testo(info.venue?.fullName),
    citta: testo(info.venue?.address?.city),
    arbitro: testo(arbitro?.displayName),
    eventi,
    formazioni,
    statistiche,
  };
}

/* Il tempo che conta di una qualifica: l'ultimo turno a cui si e' arrivati. */
function tempoDiQualifica(x) {
  return testo(x.Q3 || x.Q2 || x.Q1 || "");
}

/** Una sessione di F1 di Jolpica: `Q` le qualifiche, `S` la sprint, `G` la gara. */
export function sessioneF1DaJolpica(json, sessione) {
  const gara = json?.MRData?.RaceTable?.Races?.[0];
  if (!gara) return null;
  const chiave =
    sessione === "Q" ? "QualifyingResults" : sessione === "S" ? "SprintResults" : "Results";
  return {
    tipo: "f1",
    sessione,
    giro: numero(gara.round),
    nome: testo(gara.raceName),
    risultati: (gara[chiave] || []).map((x) => ({
      posizione: numero(x.position),
      ...pilotaF1(x.Driver),
      scuderia: testo(x.Constructor?.name),
      scuderiaId: testo(x.Constructor?.constructorId),
      ...(sessione === "Q"
        ? { q1: testo(x.Q1), q2: testo(x.Q2), q3: testo(x.Q3), tempo: tempoDiQualifica(x) }
        : {
            tempo: testo(x.Time?.time || ""),
            stato: testo(x.status || ""),
            punti: numero(x.points) ?? 0,
            griglia: numero(x.grid),
            giroVeloce: x.FastestLap?.rank === "1",
          }),
    })),
  };
}

/** Una sessione di MotoGP: la classifica col giro migliore. */
export function sessioneMotoDaPulselive(json) {
  if (!json?.classification) return null;
  return {
    tipo: "motogp",
    risultati: json.classification.map((x) => ({
      posizione: numero(x.position),
      id: testo(x.rider?.id),
      nome: testo(x.rider?.full_name),
      numero: testo(x.rider?.number),
      squadra: testo(x.team?.name),
      moto: testo(x.constructor?.name),
      punti: numero(x.points) ?? 0,
      tempo: testo(x.time || x.best_lap?.time || ""),
      giro: testo(x.best_lap?.time || ""),
      distacco: testo(x.gap?.first && x.gap.first !== "0.000" ? `+${x.gap.first}` : ""),
      stato: testo(x.status || ""),
    })),
  };
}

/* ------------------------------------------------------------- le domande */

/**
 * La casa che chiede. `scarica(indirizzo)` e' `fetch` (le prove ne passano
 * uno finto); `orologio()` il tempo di adesso.
 */
export function creaSport({
  scarica = (u, o) => fetch(u, o),
  orologio = () => Date.now(),
  entro = ENTRO,
  /* Dove si scrive quale cosa seguita non risponde, e perche': «continua a
   * non uscire» senza una riga nel registro non si capisce da qui. */
  registro = null,
} = {}) {
  const memoria = new Map();
  /* Una riga per cosa seguita ogni dieci minuti al piu'. */
  const dettoIl = new Map();
  const dillo = (chiave, perche) => {
    const ora = orologio();
    if (ora - (dettoIl.get(chiave) || 0) < 10 * 60 * 1000) return;
    dettoIl.set(chiave, ora);
    registro?.attenzione?.(`sport: ${chiave} ${perche}`);
  };

  async function json(indirizzo, quanto = PER_UN_PO) {
    const tenuta = memoria.get(indirizzo);
    if (tenuta && tenuta.fino > orologio()) return tenuta.valore;
    let r;
    try {
      r = await scarica(indirizzo, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(ATTESA),
      });
    } catch (errore) {
      /* «I dati non si aggiornavano»: una fonte che non si raggiunge per un
       * momento (la rete, un tempo scaduto) faceva sparire tutto quello che si
       * sapeva, e la plancia restava col «non risponde». Si tiene l'ultima
       * risposta buona, come quando la fonte risponde male. */
      if (tenuta) return tenuta.valore;
      throw errore;
    }
    if (!r.ok) {
      /* Una fonte che non risponde non cancella quello che si sapeva. */
      if (tenuta) return tenuta.valore;
      throw new Error(`sport: ${r.status}`);
    }
    const valore = await r.json();
    memoria.set(indirizzo, { valore, fino: orologio() + quanto });
    if (memoria.size > 200) memoria.delete(memoria.keys().next().value);
    return valore;
  }

  async function squadre(campionato) {
    if (legaHockeyValida(campionato))
      return squadreDaEspn(await json(`${ESPN_HOCKEY}/${campionato}/teams`, PER_UN_GIORNO)).map(
        conLoStemma,
      );
    if (!campionatoValido(campionato)) throw new Error("sport: campionato");
    return squadreDaEspn(await json(`${ESPN}/${campionato}/teams`, PER_UN_GIORNO));
  }

  async function calcio(campionato, id) {
    if (!campionatoValido(campionato) || !squadraValida(id)) throw new Error("sport: squadra");
    const [giocate, prossime, classifica] = await Promise.all([
      json(`${ESPN}/all/teams/${id}/schedule`),
      json(`${ESPN}/all/teams/${id}/schedule?fixture=true`),
      json(`${ESPN_CLASSIFICHE}/${campionato}/standings`).catch(() => null),
    ]);
    const classificheDelleCoppe = Object.fromEntries(
      await Promise.all(
        coppeDelCalendario(giocate, prossime).map(async (lega) => [
          lega,
          await json(`${ESPN_CLASSIFICHE}/${lega}/standings`).catch(() => null),
        ]),
      ),
    );
    let r = calcioDaEspn({
      id: String(id),
      campionato,
      giocate,
      prossime,
      classifica,
      classificheDelleCoppe,
    });
    /* Una partita oggi, in corso o a momenti: il risultato si chiede alla
     * giornata del campionato, che si aggiorna ogni minuto. */
    const adesso = orologio();
    const vicina = [r.dalVivo, ...r.prossime].find(
      (p) => p && Math.abs(Date.parse(p.quando) - adesso) < 3 * 3600_000,
    );
    if (vicina) {
      const giorno = vicina.quando.slice(0, 10).replaceAll("-", "");
      const lega = vicina.lega || campionato;
      const oggi = await json(`${ESPN}/${lega}/scoreboard?dates=${giorno}`, PER_POCO).catch(
        () => null,
      );
      const viva = (oggi?.events || []).find((e) => String(e.id) === vicina.id);
      if (viva) {
        r = calcioDaEspn({
          id: String(id),
          campionato,
          giocate: {
            ...giocate,
            events: [...(giocate?.events || []).filter((e) => String(e.id) !== vicina.id), viva],
          },
          prossime: {
            ...prossime,
            events: (prossime?.events || []).filter((e) => String(e.id) !== vicina.id),
          },
          classifica,
          classificheDelleCoppe,
        });
      }
    }
    return r;
  }

  async function hockey(lega, id) {
    if (!legaHockeyValida(lega) || !squadraValida(id)) throw new Error("sport: squadra");
    const [calendario, classifica] = await Promise.all([
      json(`${ESPN_HOCKEY}/${lega}/teams/${id}/schedule`),
      json(`${ESPN_CLASSIFICHE_HOCKEY}/${lega}/standings`).catch(() => null),
    ]);
    let r = hockeyDaEspn({ id: String(id), lega, calendario, classifica });
    /* Una partita oggi, in corso o a momenti: il risultato dalla giornata,
     * che si aggiorna ogni minuto. */
    const adesso = orologio();
    const vicina = [r.dalVivo, ...r.prossime].find(
      (p) => p && Math.abs(Date.parse(p.quando) - adesso) < 4 * 3600_000,
    );
    if (vicina) {
      const giorno = vicina.quando.slice(0, 10).replaceAll("-", "");
      const oggi = await json(`${ESPN_HOCKEY}/${lega}/scoreboard?dates=${giorno}`, PER_POCO).catch(
        () => null,
      );
      const viva = (oggi?.events || []).find((e) => String(e.id) === vicina.id);
      if (viva)
        r = hockeyDaEspn({
          id: String(id),
          lega,
          calendario: {
            ...calendario,
            events: [...(calendario?.events || []).filter((e) => String(e.id) !== vicina.id), viva],
          },
          classifica,
        });
    }
    return r;
  }

  async function f1() {
    const [gara, sprint, calendario, piloti, costruttori] = await Promise.all([
      json(`${F1}/current/last/results.json`),
      json(`${F1}/current/last/sprint.json`).catch(() => null),
      json(`${F1}/current.json`, PER_UN_GIORNO / 4),
      json(`${F1}/current/driverStandings.json`),
      json(`${F1}/current/constructorStandings.json`),
    ]);
    const r = f1DaJolpica({ gara, sprint, calendario, piloti, costruttori, adesso: orologio() });
    /* Una sessione forse in corso: l'ordine dal vivo, ogni mezzo minuto. */
    if (sessioneDaGuardare(r.prossima?.sessioni, orologio())) {
      const vivo = await json(ESPN_F1, PER_MEZZO_MINUTO).catch(() => null);
      r.dalVivo = f1DalVivoDaEspn(vivo, r.piloti);
    }
    return r;
  }

  async function motogp() {
    const stagioni = await json(`${MOTO}/results/seasons`, PER_UN_GIORNO);
    const stagione = (stagioni || []).find((s) => s.current) || (stagioni || [])[0];
    if (!stagione) throw new Error("sport: stagione");
    const eventi = await json(
      `${MOTO}/results/events?seasonUuid=${encodeURIComponent(stagione.id)}`,
    );
    const iniziati = (eventi || [])
      .filter((e) => !e.test && Date.parse(e.date_start) <= orologio())
      .sort((a, b) => testo(b.date_start).localeCompare(testo(a.date_start)));
    /* L'ultima gara corsa: si guarda dall'evento piu' recente indietro, la
     * gara della domenica se c'e', se no la sprint del sabato. */
    let eventoGara = null;
    let tipo = "";
    let gara = null;
    let categoria = null;
    let quando = "";
    let sessioniGara = [];
    for (const e of iniziati.slice(0, 3)) {
      const categorie = await json(
        `${MOTO}/results/categories?eventUuid=${encodeURIComponent(e.id)}`,
        PER_UN_GIORNO,
      );
      categoria = (categorie || []).find((c) => /motogp/i.test(c.name)) || categoria;
      if (!categoria) continue;
      const sessioni = await json(
        `${MOTO}/results/sessions?eventUuid=${encodeURIComponent(e.id)}&categoryUuid=${encodeURIComponent(categoria.id)}`,
        PER_POCO * 5,
      );
      const finite = (sessioni || []).filter((s) => s.status === "FINISHED");
      const scelta = finite.find((s) => s.type === "RAC") || finite.find((s) => s.type === "SPR");
      if (!scelta) continue;
      const classifica = await json(
        `${MOTO}/results/session/${encodeURIComponent(scelta.id)}/classification?test=false`,
      );
      if (!classifica?.classification?.length) continue;
      eventoGara = e;
      sessioniGara = sessioni || [];
      tipo = scelta.type;
      gara = classifica;
      quando = testo(scelta.date);
      break;
    }
    const campionato = categoria
      ? await json(
          `${MOTO}/results/standings?seasonUuid=${encodeURIComponent(stagione.id)}&categoryUuid=${encodeURIComponent(categoria.id)}`,
        ).catch(() => null)
      : null;
    /* Gli orari del prossimo fine settimana: qualifiche, sprint e gara. */
    const oggi = new Date(orologio()).toISOString().slice(0, 10);
    const prossimo = (eventi || [])
      .filter((e) => !e.test && testo(e.date_end) >= oggi)
      .sort((a, b) => testo(a.date_start).localeCompare(testo(b.date_start)))[0];
    let sessioniProssime = [];
    if (prossimo && categoria) {
      sessioniProssime =
        (await json(
          `${MOTO}/results/sessions?eventUuid=${encodeURIComponent(prossimo.id)}&categoryUuid=${encodeURIComponent(categoria.id)}`,
          PER_POCO * 5,
        ).catch(() => [])) || [];
    }
    const r = motoDaPulselive({
      eventi,
      eventoGara,
      tipo,
      gara,
      campionato,
      quando,
      sessioniProssime,
      sessioniGara,
      adesso: orologio(),
    });
    /* Il cronometraggio dice la sessione che sta girando: vale se e' quella
     * del calendario (le classi minori girano sulla stessa pista). */
    const daGuardare = sessioneDaGuardare(r.prossima?.tutte, orologio());
    if (daGuardare) {
      const vivo = motoDalVivoDaPulselive(
        await json(MOTO_DAL_VIVO, PER_MEZZO_MINUTO).catch(() => null),
      );
      if (vivo && vivo.sessione === daGuardare.sigla) r.dalVivo = vivo;
    }
    return r;
  }

  /**
   * Il dettaglio di una cosa toccata. Ogni campo si controlla prima di
   * metterlo in un indirizzo: una lega, un numero, un giro, un identificativo
   * di sessione — niente altro passa.
   */
  async function dettaglio(chiesto = {}) {
    if (chiesto?.tipo === "calcio") {
      const lega = testo(chiesto.lega);
      const id = testo(chiesto.id);
      if (!legaValida(lega) || !/^\d{1,9}$/.test(id)) throw new Error("sport: partita");
      const fuori = partitaDettaglioDaEspn(
        await json(`${ESPN}/${lega}/summary?event=${id}`, PER_POCO),
      );
      if (!fuori) throw new Error("sport: partita");
      return fuori;
    }
    if (chiesto?.tipo === "f1") {
      const giro = Number(chiesto.giro);
      const sessione = testo(chiesto.sessione);
      if (!Number.isInteger(giro) || giro < 1 || giro > 30 || !["Q", "S", "G"].includes(sessione))
        throw new Error("sport: sessione");
      const pezzo = sessione === "Q" ? "qualifying" : sessione === "S" ? "sprint" : "results";
      const risposta = await json(`${F1}/current/${giro}/${pezzo}.json`, PER_POCO * 5);
      const fuori = sessioneF1DaJolpica(risposta, sessione);
      /* Jolpica pubblica una sessione qualche ora dopo che e' finita: fino ad
       * allora risponde bene, ma senza la gara dentro. Non e' un guasto, e la
       * plancia lo dice cosi'. */
      if (!fuori?.risultati?.length) {
        if (risposta?.MRData) return { tipo: "f1", sessione, giro, risultati: [], nonAncora: true };
        throw new Error("sport: sessione");
      }
      return fuori;
    }
    if (chiesto?.tipo === "motogp") {
      const id = testo(chiesto.sessione);
      if (!sessioneMotoValida(id)) throw new Error("sport: sessione");
      const fuori = sessioneMotoDaPulselive(
        await json(`${MOTO}/results/session/${id}/classification?test=false`, PER_POCO * 5),
      );
      if (!fuori?.risultati?.length) throw new Error("sport: sessione");
      return fuori;
    }
    throw new Error("sport: dettaglio");
  }

  /** Il simbolo di una scuderia di F1: quello di quest'anno, o se non c'e'
   * ancora quello dell'anno prima. */
  async function simbolo(chiave) {
    const slug = SCUDERIE_F1[chiave.slice(3)];
    const anno = new Date(orologio()).getUTCFullYear();
    for (const quale of [anno, anno - 1]) {
      const indirizzo = simboloDellaScuderia(slug, quale);
      const tenuta = memoria.get(indirizzo);
      if (tenuta && tenuta.fino > orologio()) return tenuta.valore;
      const r = await scarica(indirizzo, { signal: AbortSignal.timeout(ATTESA) });
      if (!r.ok) continue;
      const byte = Buffer.from(await r.arrayBuffer());
      if (byte.length > 256 * 1024) throw new Error("sport: simbolo troppo grande");
      const valore = { tipo: "image/webp", base64: byte.toString("base64") };
      memoria.set(indirizzo, { valore, fino: orologio() + PER_UN_GIORNO });
      return valore;
    }
    throw new Error("sport: simbolo");
  }

  /** Il logo di una squadra (solo numeri, solo ESPN) o il simbolo di una
   * scuderia di F1 (`f1:<constructorId>`): i byte e il tipo. */
  async function logo(id) {
    if (scuderiaValida(id)) return simbolo(id);
    if (stemmaHockeyValido(id)) {
      const indirizzo = `https://a.espncdn.com/i/teamlogos/nhl/500/${id.slice(4)}.png`;
      const tenuto = memoria.get(indirizzo);
      if (tenuto && tenuto.fino > orologio()) return tenuto.valore;
      const r = await scarica(indirizzo, { signal: AbortSignal.timeout(ATTESA) });
      if (!r.ok) throw new Error(`sport: ${r.status}`);
      const byte = Buffer.from(await r.arrayBuffer());
      if (byte.length > 512 * 1024) throw new Error("sport: logo troppo grande");
      const valore = { tipo: "image/png", base64: byte.toString("base64") };
      memoria.set(indirizzo, { valore, fino: orologio() + PER_UN_GIORNO });
      return valore;
    }
    if (!squadraValida(id)) throw new Error("sport: logo");
    const indirizzo = stemmaDi(id);
    const tenuta = memoria.get(indirizzo);
    if (tenuta && tenuta.fino > orologio()) return tenuta.valore;
    const r = await scarica(indirizzo, { signal: AbortSignal.timeout(ATTESA) });
    if (!r.ok) throw new Error(`sport: ${r.status}`);
    const byte = Buffer.from(await r.arrayBuffer());
    if (byte.length > 512 * 1024) throw new Error("sport: logo troppo grande");
    const valore = { tipo: "image/png", base64: byte.toString("base64") };
    memoria.set(indirizzo, { valore, fino: orologio() + PER_UN_GIORNO });
    return valore;
  }

  /* L'ultimo risultato buono di ogni cosa seguita, per quando una fonte e'
   * lenta. */
  const ultimi = new Map();

  /** Quello che serve alla plancia: un pezzo per ogni cosa seguita, nello
   * stesso ordine. Chi non risponde ha `errore`, gli altri ci sono lo stesso.
   *
   * «Improvvisamente non escono i dati»: una fonte lenta teneva ferma tutta
   * la risposta (per il calcio tre giri di domande, quindici secondi l'uno),
   * la plancia smetteva di aspettare dopo venticinque e non mostrava niente.
   * Ora ogni cosa seguita ha [ENTRO] per rispondere; se non ce la fa vale
   * l'ultimo risultato buono, e la domanda continua per la volta dopo. */
  async function risultati(seguiti = []) {
    const elenco = (Array.isArray(seguiti) ? seguiti : []).slice(0, 8);
    return Promise.all(
      elenco.map(async (s) => {
        const tipo = testo(s?.tipo);
        const chiave =
          tipo === "calcio" || tipo === "hockey"
            ? `${tipo}:${testo(s?.campionato)}:${testo(s?.squadra)}`
            : tipo;
        const lavoro = (async () => {
          if (tipo === "calcio") return calcio(s.campionato, String(s.squadra));
          if (tipo === "hockey") return hockey(s.campionato, String(s.squadra));
          if (tipo === "f1") return f1();
          if (tipo === "motogp") return motogp();
          return { tipo, errore: "sconosciuto" };
        })().then(
          (r) => {
            if (r && !r.errore) ultimi.set(chiave, r);
            else if (r?.errore) dillo(chiave, `non va: ${r.errore}`);
            return r;
          },
          (e) => {
            dillo(chiave, `non va: ${e?.cause?.code || e?.message || e}`);
            throw e;
          },
        );
        let scaduto;
        const tempo = new Promise((risolvi) => {
          scaduto = setTimeout(() => risolvi(null), entro);
        });
        try {
          const r = await Promise.race([lavoro, tempo]);
          if (r) return r;
          lavoro.catch(() => {});
          dillo(chiave, `non ha risposto in ${Math.round(entro / 1000)} s`);
          return ultimi.get(chiave) || { tipo, errore: "non-risponde" };
        } catch (e) {
          return ultimi.get(chiave) || { tipo, errore: "non-risponde" };
        } finally {
          clearTimeout(scaduto);
        }
      }),
    );
  }

  return { squadre, risultati, dettaglio, logo, calcio, hockey, f1, motogp };
}
