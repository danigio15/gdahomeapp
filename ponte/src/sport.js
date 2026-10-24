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
const PER_POCO = 60_000;
const PER_UN_PO = 15 * 60_000;
const PER_UN_GIORNO = 24 * 60 * 60_000;
const ATTESA = 15_000;

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const testo = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

export function campionatoValido(c) {
  return typeof c === "string" && Object.hasOwn(CAMPIONATI, c);
}

export function squadraValida(id) {
  return typeof id === "string" ? /^\d{1,7}$/.test(id) : Number.isInteger(id) && id > 0;
}

/* ---------------------------------------------------------------- calcio */

function squadraDi(t = {}) {
  const team = t.team || t;
  const logo =
    (team.logos || []).find((l) => (l.rel || []).includes("default")) || (team.logos || [])[0];
  return {
    id: testo(team.id),
    nome: testo(team.displayName || team.name || team.location),
    breve: testo(team.shortDisplayName || team.displayName || team.name),
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

/** Tutto della squadra seguita: le ultime, le prossime, quella in corso, il
 * posto in classifica. `giocate` e `prossime` sono i calendari di ESPN di
 * tutte le competizioni; `classifica` quella del suo campionato. */
export function calcioDaEspn({ id, campionato, giocate, prossime, classifica, squadra }) {
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
    squadra: { ...io, id: String(id), nome: io.nome || riga?.nome || "" },
    dalVivo: inOrdine.find((p) => p.fase === "in") || null,
    ultime: inOrdine
      .filter((p) => p.fase === "fine")
      .slice(-5)
      .reverse(),
    prossime: inOrdine.filter((p) => p.fase === "prima" && !p.rinviata).slice(0, 5),
    posizione: riga,
    classifica: tabella,
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
    .map((s) => ({ sigla: SESSIONI_DI_MOTO[s.type], quando: testo(s.date) }))
    .sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando));
}

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
        ? { ...eventoMoto(eventoGara), tipo, quando: testo(quando), risultati }
        : null,
    prossima: prossimo
      ? { ...eventoMoto(prossimo), sessioni: sessioniDiMoto(sessioniProssime) }
      : null,
    piloti: classificaMoto(campionato).map(({ tempo, distacco, stato, ...r }) => r),
  };
}

/* ------------------------------------------------------------- le domande */

/**
 * La casa che chiede. `scarica(indirizzo)` e' `fetch` (le prove ne passano
 * uno finto); `orologio()` il tempo di adesso.
 */
export function creaSport({ scarica = (u, o) => fetch(u, o), orologio = () => Date.now() } = {}) {
  const memoria = new Map();

  async function json(indirizzo, quanto = PER_UN_PO) {
    const tenuta = memoria.get(indirizzo);
    if (tenuta && tenuta.fino > orologio()) return tenuta.valore;
    const r = await scarica(indirizzo, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(ATTESA),
    });
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
    let r = calcioDaEspn({ id: String(id), campionato, giocate, prossime, classifica });
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
        });
      }
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
    return f1DaJolpica({ gara, sprint, calendario, piloti, costruttori, adesso: orologio() });
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
    return motoDaPulselive({
      eventi,
      eventoGara,
      tipo,
      gara,
      campionato,
      quando,
      sessioniProssime,
      adesso: orologio(),
    });
  }

  /** Il logo di una squadra: i byte e il tipo. Solo numeri, solo ESPN. */
  async function logo(id) {
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

  /** Quello che serve alla plancia: un pezzo per ogni cosa seguita, nello
   * stesso ordine. Chi non risponde ha `errore`, gli altri ci sono lo stesso. */
  async function risultati(seguiti = []) {
    const elenco = (Array.isArray(seguiti) ? seguiti : []).slice(0, 8);
    return Promise.all(
      elenco.map(async (s) => {
        try {
          if (s?.tipo === "calcio") return await calcio(s.campionato, String(s.squadra));
          if (s?.tipo === "f1") return await f1();
          if (s?.tipo === "motogp") return await motogp();
          return { tipo: testo(s?.tipo), errore: "sconosciuto" };
        } catch (e) {
          return { tipo: testo(s?.tipo), errore: "non-risponde" };
        }
      }),
    );
  }

  return { squadre, risultati, logo, calcio, f1, motogp };
}
