/* Lo sport seguito in casa: le regole, senza documento e senza rete.
 *
 * Dal campo: «una card di sport dove scegli lo sport da seguire — la tua
 * squadra di calcio, la F1, la MotoGP — e vedi i risultati». La pagina Sport
 * e il suo widget nella Home leggono i risultati dal ponte
 * (`ponte/sport/risultati`, vedi `ponte/src/sport.js`), che li chiede alle
 * fonti pubbliche e li manda tutti nella stessa forma. Qui sta quello che si
 * decide guardandoli: cosa si segue (la configurazione `cd_sport`), com'e'
 * andata ultimamente la squadra, quale partita o gara viene prima, cosa dire
 * nella tessera della Home.
 */

/** La chiave della configurazione. */
export const CHIAVE_SPORT = "cd_sport";

/** Al massimo tante cose seguite: e' anche il limite del ponte. */
export const QUANTI_AL_MASSIMO = 8;

/** I campionati di cui si possono scegliere le squadre: gli stessi del ponte
 * (`CAMPIONATI` in `ponte/src/sport.js`), che rifiuta tutti gli altri. */
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

export const TIPI = Object.freeze(["calcio", "f1", "motogp"]);

const pulito = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const ora = (iso) => {
  const n = Date.parse(iso || "");
  return Number.isFinite(n) ? n : null;
};

/** La chiave di una cosa seguita: una squadra, la F1, la MotoGP. */
export function chiaveDelSeguito(s) {
  if (s?.tipo === "calcio") return `calcio:${pulito(s.squadra)}`;
  return pulito(s?.tipo);
}

/**
 * La configurazione pulita: `{ seguiti: [...] }`, senza doppioni, al massimo
 * otto. Una squadra vuole un campionato dell'elenco e un numero; la F1 e la
 * MotoGP possono avere il pilota del cuore.
 */
export function normalizzaSport(grezza) {
  const fonte = grezza && typeof grezza === "object" ? grezza : {};
  const elenco = Array.isArray(fonte.seguiti) ? fonte.seguiti : [];
  const visti = new Set();
  const seguiti = [];
  for (const s of elenco) {
    if (!s || typeof s !== "object" || !TIPI.includes(s.tipo)) continue;
    let voce = null;
    if (s.tipo === "calcio") {
      const campionato = pulito(s.campionato);
      const squadra = pulito(s.squadra);
      if (!Object.hasOwn(CAMPIONATI, campionato) || !/^\d{1,7}$/.test(squadra)) continue;
      voce = { tipo: "calcio", campionato, squadra, nome: pulito(s.nome).slice(0, 60) };
    } else {
      voce = { tipo: s.tipo, preferito: pulito(s.preferito).slice(0, 60) };
    }
    const chiave = chiaveDelSeguito(voce);
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    seguiti.push(voce);
    if (seguiti.length >= QUANTI_AL_MASSIMO) break;
  }
  return { seguiti };
}

/** Sposta una cosa seguita in su (-1) o in giu' (+1). */
export function spostaIlSeguito(seguiti, indice, verso) {
  const elenco = [...(seguiti || [])];
  const dove = indice + verso;
  if (indice < 0 || indice >= elenco.length || dove < 0 || dove >= elenco.length) return elenco;
  [elenco[indice], elenco[dove]] = [elenco[dove], elenco[indice]];
  return elenco;
}

/** Quello che si manda al ponte: solo le scelte, niente nomi. */
export function domandaDelleScelte(config) {
  return normalizzaSport(config).seguiti.map((s) =>
    s.tipo === "calcio"
      ? { tipo: "calcio", campionato: s.campionato, squadra: s.squadra }
      : { tipo: s.tipo },
  );
}

/* ── il calcio ─────────────────────────────────────────────────────────── */

/** Le ultime partite dalla piu' vecchia alla piu' recente, come V, N, P. */
export function formaRecente(calcio, quante = 5) {
  return (calcio?.ultime || [])
    .filter((p) => p.esito)
    .slice(0, quante)
    .reverse()
    .map((p) => p.esito);
}

/** La partita da mettere in grande: quella in corso, se no la prossima, se
 * no l'ultima giocata. */
export function partitaInGrande(calcio) {
  if (calcio?.dalVivo) return { partita: calcio.dalVivo, perche: "dal-vivo" };
  if (calcio?.prossime?.length) return { partita: calcio.prossime[0], perche: "prossima" };
  if (calcio?.ultime?.length) return { partita: calcio.ultime[0], perche: "ultima" };
  return null;
}

/** Le righe della classifica attorno alla squadra: le prime tre, e la
 * squadra con chi le sta accanto. Senza doppioni, in ordine. */
export function righeAttorno(classifica, id, { primi = 3, accanto = 1 } = {}) {
  const tabella = Array.isArray(classifica) ? classifica : [];
  if (!tabella.length) return [];
  const dove = tabella.findIndex((r) => r.id === String(id));
  const indici = new Set();
  for (let i = 0; i < Math.min(primi, tabella.length); i += 1) indici.add(i);
  if (dove >= 0)
    for (let i = dove - accanto; i <= dove + accanto; i += 1)
      if (i >= 0 && i < tabella.length) indici.add(i);
  const scelti = [...indici].sort((a, b) => a - b);
  const righe = [];
  scelti.forEach((i, k) => {
    if (k > 0 && i - scelti[k - 1] > 1) righe.push({ salto: true });
    righe.push({ ...tabella[i], mia: i === dove });
  });
  return righe;
}

/** Chi e' la squadra seguita e chi l'avversaria, in una partita. */
export function latiDellaPartita(partita, id) {
  if (!partita) return null;
  const inCasa = partita.casa?.id === String(id);
  return {
    mia: inCasa ? partita.casa : partita.fuori,
    loro: inCasa ? partita.fuori : partita.casa,
    inCasa,
  };
}

/* ── Formula 1 e MotoGP ───────────────────────────────────────────────── */

/** La prossima sessione del fine settimana (F1 o MotoGP) che non e' ancora
 * finita: una sessione dura un paio d'ore. */
export function prossimaSessione(campionato, adesso = Date.now()) {
  const sessioni = campionato?.prossima?.sessioni || [];
  return sessioni.find((s) => (ora(s.quando) ?? 0) + 2 * 3600_000 > adesso) || null;
}

/** Il nome breve di un gran premio: «Singapore Grand Prix» → «Singapore». */
export function nomeBreveDelGp(nome) {
  return pulito(nome)
    .replace(/^Grand Prix of\s*/i, "")
    .replace(/\s*Grand Prix\s*/i, " ")
    .replace(/^Gran Premio (di |d'|del |della )?/i, "")
    .trim();
}

/** La posizione del pilota del cuore in un elenco, o `null`. */
export function rigaDelPreferito(righe, preferito) {
  const chi = pulito(preferito);
  if (!chi) return null;
  return (righe || []).find((r) => r.id === chi) || null;
}

/** Il distacco dal primo, in punti, per le barre delle classifiche. */
export function quotaDelPrimo(righe) {
  const primo = Number(righe?.[0]?.punti) || 0;
  return (righe || []).map((r) => ({
    ...r,
    quota: primo > 0 ? Math.max(0, Math.min(1, (Number(r.punti) || 0) / primo)) : 0,
  }));
}

/* ── il giorno e l'ora ───────────────────────────────────────────────── */

/** Quando, rispetto ad adesso: «oggi», «domani», o un altro giorno. I giorni
 * si contano col calendario di chi guarda, non a ventiquattro ore. */
export function giornoDi(iso, adesso = Date.now()) {
  const quando = ora(iso);
  if (quando == null) return null;
  const a = new Date(adesso);
  const q = new Date(quando);
  const mezzanotte = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const giorni = Math.round((mezzanotte(q) - mezzanotte(a)) / 86_400_000);
  return {
    giorni,
    quale: giorni === 0 ? "oggi" : giorni === 1 ? "domani" : giorni === -1 ? "ieri" : "altro",
  };
}

/** Quanto manca: `{giorni, ore, minuti}`, o `null` se e' gia' passato. */
export function quantoManca(iso, adesso = Date.now()) {
  const quando = ora(iso);
  if (quando == null || quando <= adesso) return null;
  const minuti = Math.round((quando - adesso) / 60_000);
  return {
    giorni: Math.floor(minuti / 1440),
    ore: Math.floor((minuti % 1440) / 60),
    minuti: minuti % 60,
  };
}

/* ── la Home ───────────────────────────────────────────────────────────── */

/** Quanto si aspetta prima di richiedere i risultati: un minuto con una
 * partita in corso o vicina, un quarto d'ora se no. */
export function fraQuantoSiRichiede(risultati, adesso = Date.now()) {
  const vicino = (iso) => {
    const q = ora(iso);
    return q != null && Math.abs(q - adesso) < 3 * 3600_000;
  };
  for (const r of risultati || []) {
    if (r?.dalVivo) return 60_000;
    if (r?.tipo === "calcio" && vicino(r.prossime?.[0]?.quando)) return 60_000;
    if (r?.tipo === "f1" && vicino(prossimaSessione(r, adesso)?.quando)) return 5 * 60_000;
  }
  return 15 * 60_000;
}

/**
 * Cosa dire nella tessera della Home: la cosa piu' importante adesso.
 *
 * Prima una partita in corso; poi quello che succede entro oggi (una partita,
 * una sessione, un gran premio); poi il risultato piu' fresco degli ultimi
 * due giorni; poi la prossima cosa in calendario. Ogni cosa seguita resta
 * nella finestra; qui se ne sceglie una.
 */
export function inEvidenza(risultati, adesso = Date.now()) {
  const buoni = (risultati || []).filter((r) => r && !r.errore);
  if (!buoni.length) return null;
  const dalVivo = buoni.find((r) => r.tipo === "calcio" && r.dalVivo);
  if (dalVivo)
    return { tipo: "calcio", cosa: "dal-vivo", risultato: dalVivo, partita: dalVivo.dalVivo };
  const prossimi = [];
  const passati = [];
  for (const r of buoni) {
    if (r.tipo === "calcio") {
      const p = r.prossime?.[0];
      if (p)
        prossimi.push({
          tipo: "calcio",
          cosa: "prossima",
          risultato: r,
          partita: p,
          quando: ora(p.quando),
        });
      const u = r.ultime?.[0];
      if (u)
        passati.push({
          tipo: "calcio",
          cosa: "ultima",
          risultato: r,
          partita: u,
          quando: ora(u.quando),
        });
    } else if (r.tipo === "f1") {
      const s = prossimaSessione(r, adesso);
      if (s)
        prossimi.push({
          tipo: "f1",
          cosa: "prossima",
          risultato: r,
          sessione: s,
          quando: ora(s.quando),
        });
      const u =
        r.sprint && (ora(r.sprint.quando) ?? 0) > (ora(r.ultima?.quando) ?? 0)
          ? r.sprint
          : r.ultima;
      if (u)
        passati.push({ tipo: "f1", cosa: "ultima", risultato: r, gara: u, quando: ora(u.quando) });
    } else if (r.tipo === "motogp") {
      const p = r.prossima;
      const s = prossimaSessione(r, adesso);
      if (p)
        prossimi.push({
          tipo: "motogp",
          cosa: "prossima",
          risultato: r,
          evento: p,
          sessione: s,
          quando: ora(s?.quando) ?? ora(`${p.dal}T12:00:00Z`),
        });
      const u = r.ultima;
      if (u)
        passati.push({
          tipo: "motogp",
          cosa: "ultima",
          risultato: r,
          gara: u,
          quando: ora(u.quando) ?? ora(`${u.dal}T12:00:00Z`),
        });
    }
  }
  prossimi.sort((a, b) => (a.quando ?? Infinity) - (b.quando ?? Infinity));
  passati.sort((a, b) => (b.quando ?? 0) - (a.quando ?? 0));
  const oggi = prossimi.find(
    (p) => giornoDi(new Date(p.quando).toISOString(), adesso)?.giorni === 0,
  );
  if (oggi) return oggi;
  const fresco = passati.find((p) => p.quando != null && adesso - p.quando < 2 * 86_400_000);
  if (fresco) return fresco;
  return prossimi[0] || passati[0] || null;
}
