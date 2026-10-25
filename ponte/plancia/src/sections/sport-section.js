/* La pagina Sport.
 *
 * Dal campo: «una card di sport dove scegli lo sport da seguire — la tua
 * squadra di calcio, la F1, la MotoGP — e vedi i risultati». Ogni cosa
 * seguita ha il suo blocco, nell'ordine scelto nel Config (Casa › Sport):
 *
 *   · la squadra di calcio: la partita in grande — in corso col minuto, se
 *     no la prossima col conto alla rovescia, se no l'ultima —, le ultime
 *     cinque con l'esito e la forma, la classifica attorno alla squadra;
 *   · la Formula 1 e la MotoGP: il prossimo gran premio con gli orari delle
 *     sessioni, l'ultima gara col podio, la classifica piloti (e costruttori)
 *     col pilota del cuore in evidenza.
 *
 * I risultati li chiede il ponte (`ponte/sport/risultati`), solo per chi e'
 * entrato, e li tiene a mente qualche minuto: qui si chiedono quando la
 * pagina o la tessera della Home si vedono, ogni minuto con una partita in
 * corso o vicina, ogni quarto d'ora se no. Gli stemmi delle squadre arrivano
 * dal ponte anche loro (`ponte/sport/logo`): la plancia non chiama niente
 * fuori casa. Dentro Home Assistant senza l'add-on il ponte non c'e', e la
 * pagina lo dice invece di restare vuota.
 */
import {
  CHIAVE_SPORT,
  chiaveDelSeguito,
  domandaDelleScelte,
  formaRecente,
  fraQuantoSiRichiede,
  giornoDi,
  inEvidenza,
  latiDellaPartita,
  nomeBreveDelGp,
  normalizzaSport,
  partitaInGrande,
  quantoManca,
  quotaDelPrimo,
  rigaDelPreferito,
  righeAttorno,
} from "../core/lo-sport.js";
import { creaLaMemoriaDeiLoghi } from "../core/loghi-degli-aggiornamenti.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import { apriIlFoglioDiScelta } from "./foglio-di-scelta-section.js";
import { registraTitoloDiPagina } from "./page-masthead-section.js";
import {
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  locale,
  paginaVisibile,
  planciaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  scriviSeCambia,
  segnaContenuto,
  senzaCadere,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SPORT_PAGE__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  sveglia: 0,
  /* I risultati: per quali scelte, quando sono arrivati, e chi aspetta. */
  dati: {
    firma: "",
    risultati: [],
    chiesti: 0,
    arrivati: 0,
    inVolo: false,
    guasto: "",
    attesi: [],
  },
});

export const SPORT_PAGE_ID = "page-sport";
export const SPORT_TAB = "sport";

const ATTESA = 25_000;
const DOPO_UN_ERRORE = 60_000;
const BATTITO = 60_000;

/* ── cosa si segue ────────────────────────────────────────────────────── */

export function configurazioneDelloSport() {
  return normalizzaSport(readJson(CHIAVE_SPORT, {}));
}

/* ── le domande al ponte ──────────────────────────────────────────────── */

function avvisaChiAspetta() {
  const attesi = state.dati.attesi.splice(0);
  for (const chi of attesi) {
    try {
      chi();
    } catch (_errore) {}
  }
}

async function chiediIRisultati(firma, seguiti) {
  const dati = state.dati;
  dati.inVolo = true;
  dati.chiesti = Date.now();
  try {
    const risposta = await chiediAHomeAssistant({ type: "ponte/sport/risultati", seguiti }, ATTESA);
    if (dati.firma !== firma) return;
    const nuovi = Array.isArray(risposta?.risultati) ? risposta.risultati : [];
    /* Una cosa seguita che questa volta non e' arrivata (la fonte non
     * rispondeva) non cancella quella di prima: si tiene, e si riprova fra
     * un minuto invece che fra un quarto d'ora. Le risposte sono nello stesso
     * ordine delle cose seguite, e la firma e' la stessa. */
    const prima = dati.risultati;
    let mancanti = false;
    dati.risultati = nuovi.map((r, i) => {
      if (!r?.errore) return r;
      mancanti = true;
      return prima[i] && !prima[i].errore ? prima[i] : r;
    });
    dati.arrivati = Date.now();
    dati.guasto = "";
    if (mancanti) dati.chiesti = Date.now() - fraQuantoSiRichiede(dati.risultati) + DOPO_UN_ERRORE;
  } catch (errore) {
    if (dati.firma !== firma) return;
    const codice = clean(errore?.code || errore?.error?.code || errore?.message);
    /* Senza il ponte — la plancia dentro Home Assistant senza l'add-on — la
     * domanda torna «non conosco»: non e' un intoppo, e' cosi'. */
    dati.guasto = /unknown_command|not permitted/i.test(codice)
      ? "senza-ponte"
      : /unauthorized/i.test(codice)
        ? "non-entrato"
        : "non-risponde";
    /* Un intoppo si riprova presto; quello che si sapeva resta. */
    dati.chiesti = Date.now() - fraQuantoSiRichiede(dati.risultati) + DOPO_UN_ERRORE;
  } finally {
    if (dati.firma === firma) dati.inVolo = false;
    avvisaChiAspetta();
    schedule();
  }
}

/**
 * I risultati di quello che si segue, e se serve li richiede. La usa anche la
 * tessera della Home: `quandoArrivano` viene chiamata quando arrivano.
 */
export function risultatiDelloSport(quandoArrivano = null) {
  const config = configurazioneDelloSport();
  const seguiti = domandaDelleScelte(config);
  const firma = JSON.stringify(seguiti);
  const dati = state.dati;
  if (dati.firma !== firma) {
    dati.firma = firma;
    dati.risultati = [];
    dati.chiesti = 0;
    dati.arrivati = 0;
    dati.guasto = "";
    dati.inVolo = false;
  }
  if (seguiti.length && planciaVisibile() && !dati.inVolo) {
    const ogni = fraQuantoSiRichiede(dati.risultati);
    if (!dati.chiesti || Date.now() - dati.chiesti >= ogni) chiediIRisultati(firma, seguiti);
  }
  if (typeof quandoArrivano === "function" && dati.inVolo && !dati.attesi.includes(quandoArrivano))
    dati.attesi.push(quandoArrivano);
  return {
    config,
    risultati: dati.risultati,
    arrivati: dati.arrivati,
    inVolo: dati.inVolo,
    guasto: dati.guasto,
  };
}

/* Gli stemmi: li porta il ponte, uno per squadra, e restano in memoria. */
const LOGHI = creaLaMemoriaDeiLoghi({
  chiedi: (squadra) => chiediAHomeAssistant({ type: "ponte/sport/logo", squadra }, 12_000),
  arrivato: () => schedule(),
  riprova: (_squadra, fra) => root.setTimeout?.(() => schedule(), fra + 50),
  colPonte: () => true,
});

/* ── le parole ────────────────────────────────────────────────────────── */

const conN = (testo, n) => testo.replaceAll("{n}", String(n));

function oraDi(iso) {
  try {
    return new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  } catch (_errore) {
    return "";
  }
}

function giornoBreve(iso) {
  try {
    const d = new Date(iso);
    const nome = d.toLocaleDateString(locale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return nome.charAt(0).toLocaleUpperCase(locale()) + nome.slice(1).replaceAll(".", "");
  } catch (_errore) {
    return "";
  }
}

/** «Oggi · 20:45», «Domani · 12:30», «Sab 31 ott · 20:45». */
export function quandoInParole(iso, adesso = Date.now()) {
  const g = giornoDi(iso, adesso);
  if (!g) return "";
  const giorno =
    g.quale === "oggi"
      ? t("Oggi", "Today")
      : g.quale === "domani"
        ? t("Domani", "Tomorrow")
        : g.quale === "ieri"
          ? t("Ieri", "Yesterday")
          : giornoBreve(iso);
  return `${giorno} · ${oraDi(iso)}`;
}

/** «tra 2 g 4 h», «tra 3 h 20 min», «tra 12 min». */
export function mancaInParole(iso, adesso = Date.now()) {
  const m = quantoManca(iso, adesso);
  if (!m) return "";
  if (m.giorni > 0) return conN(t("tra {n}", "in {n}"), `${m.giorni} ${t("g", "d")} ${m.ore} h`);
  if (m.ore > 0) return conN(t("tra {n}", "in {n}"), `${m.ore} h ${m.minuti} min`);
  return conN(t("tra {n}", "in {n}"), `${Math.max(1, m.minuti)} min`);
}

function dataBreve(iso) {
  try {
    return new Date(iso)
      .toLocaleDateString(locale(), { day: "numeric", month: "short" })
      .replaceAll(".", "");
  } catch (_errore) {
    return "";
  }
}

/** «30 ott – 1 nov». */
function dalAl(dal, al) {
  if (!dal) return "";
  const a = dataBreve(`${dal}T12:00:00Z`);
  const b = al && al !== dal ? dataBreve(`${al}T12:00:00Z`) : "";
  return b ? `${a} – ${b}` : a;
}

const ESITI = () => ({
  V: { lettera: t("V", "W"), nome: t("Vinta", "Won") },
  N: { lettera: t("N", "D"), nome: t("Pari", "Draw") },
  P: { lettera: t("P", "L"), nome: t("Persa", "Lost") },
});

const SIGLE_DELLE_SESSIONI = () => ({
  L1: t("Libere 1", "Practice 1"),
  L2: t("Libere 2", "Practice 2"),
  L3: t("Libere 3", "Practice 3"),
  QS: t("Qualifica sprint", "Sprint qualifying"),
  S: t("Sprint", "Sprint"),
  Q: t("Qualifiche", "Qualifying"),
  G: t("Gara", "Race"),
  FP1: t("Libere 1", "Practice 1"),
  FP2: t("Libere 2", "Practice 2"),
  PR: t("Prove", "Practice"),
  Q1: t("Qualifica 1", "Qualifying 1"),
  Q2: t("Qualifica 2", "Qualifying 2"),
});

/* Le coppe europee: il loro colore, per il blocco e la riga in cima. */
const COLORI_DELLE_COPPE = {
  "uefa.champions": "#1e3a8a",
  "uefa.europa": "#ea580c",
  "uefa.europa.conf": "#16a34a",
};

/* Le zone della classifica, come le manda il ponte. */
const ZONE = () => ({
  ottavi: t("Ottavi", "Round of 16"),
  spareggi: t("Spareggi", "Play-offs"),
  fuori: t("Eliminate", "Eliminated"),
  champions: "Champions League",
  europa: "Europa League",
  conference: "Conference League",
  retrocede: t("Retrocessione", "Relegation"),
});

export function nomeDelTipo(tipo) {
  return { calcio: t("Calcio", "Football"), f1: "Formula 1", motogp: "MotoGP" }[tipo] || tipo;
}

/* I colori delle scuderie di F1 e delle case di MotoGP, per le barre. */
const COLORI_F1 = {
  mercedes: "#00d2be",
  ferrari: "#dc0000",
  red_bull: "#3671c6",
  mclaren: "#ff8000",
  aston_martin: "#229971",
  alpine: "#0093cc",
  williams: "#64c4ff",
  rb: "#6692ff",
  sauber: "#52e252",
  audi: "#9ca3af",
  haas: "#b6babd",
  cadillac: "#c9a227",
};
const COLORI_MOTO = {
  Ducati: "#dc2626",
  Aprilia: "#111827",
  KTM: "#f97316",
  Yamaha: "#1d4ed8",
  Honda: "#e11d48",
};
const coloreDellaMoto = (moto) =>
  Object.entries(COLORI_MOTO).find(([nome]) =>
    clean(moto).toLowerCase().includes(nome.toLowerCase()),
  )?.[1] || "#64748b";

/* ── i pezzi ──────────────────────────────────────────────────────────── */

function stemma(squadra, misura = 40) {
  const id = clean(squadra?.id);
  const url = /^\d{1,7}$/.test(id) && squadra?.logo !== false ? LOGHI.logo(id) : "";
  if (url)
    return `<span class="dm-sport-stemma" style="--m:${misura}px"><img src="${esc(url)}" alt="" decoding="async"></span>`;
  const colore = clean(squadra?.colore) || "#64748b";
  const sigla = clean(squadra?.sigla || squadra?.nome)
    .slice(0, 3)
    .toUpperCase();
  return `<span class="dm-sport-stemma dm-sport-sigla" style="--m:${misura}px;--c:${esc(colore)}" aria-hidden="true">${esc(sigla)}</span>`;
}

/* Il simbolo di una scuderia di F1, bianco sul colore della scuderia: lo
 * porta il ponte (`ponte/sport/logo` con `f1:<id>`). Finche' non c'e', il
 * riquadrino ha solo il colore. */
function scuderia(id, misura = 18) {
  const chiave = clean(id);
  if (!chiave) return "";
  const url = /^[a-z_]{2,20}$/.test(chiave) ? LOGHI.logo(`f1:${chiave}`) : "";
  return `<span class="dm-sport-scud" style="--m:${misura}px;--c:${esc(COLORI_F1[chiave] || "#64748b")}" aria-hidden="true">${
    url ? `<img src="${esc(url)}" alt="" decoding="async">` : ""
  }</span>`;
}

/* La squadra sotto il nome: per la F1 col simbolo davanti. */
function squadraDi(r, x, misura = 16) {
  return r.tipo === "f1" ? `${scuderia(x.scuderiaId, misura)}${esc(x.scuderia)}` : esc(x.moto);
}

/* `dove` fa unici i disegni: la stessa icona nella pagina e nella finestra
 * della Home, con le stesse sfumature, si pesterebbe i piedi e verrebbe nera. */
function titoloDelBlocco(chiave, titolo, sotto = "", dove = "pagina") {
  return `<h3 class="dm-sport-titolo"><span class="dm-sport-titolo-ic" aria-hidden="true">${oggettoWidget(
    chiave,
    "",
    `sport-t-${dove}-${chiave}`,
  )}</span><span>${esc(titolo)}</span>${sotto ? `<small>${sotto}</small>` : ""}</h3>`;
}

function schedaMarkup(titolo, corpo, { classe = "", attr = "" } = {}) {
  return `<article class="dm-sport-scheda ${classe}" ${attr}>${
    titolo ? `<h4 class="dm-sport-sotto-titolo">${titolo}</h4>` : ""
  }${corpo}</article>`;
}

/* ── il calcio ────────────────────────────────────────────────────────── */

function punteggio(p) {
  if (p.fase === "prima") return `<b class="dm-sport-ora">${esc(oraDi(p.quando))}</b>`;
  const rigori =
    p.casa.rigori != null && p.fuori.rigori != null
      ? `<small class="dm-sport-rigori">${esc(t("rigori", "pens"))} ${p.casa.rigori}–${p.fuori.rigori}</small>`
      : "";
  return `<b class="dm-sport-gol">${p.casa.gol ?? 0}<i>–</i>${p.fuori.gol ?? 0}</b>${rigori}`;
}

function partitaGrande(r, seguito, adesso) {
  const grande = partitaInGrande(r);
  if (!grande) return "";
  const { partita: p, perche } = grande;
  const lati = latiDellaPartita(p, r.squadra.id);
  const colore = clean(lati?.mia?.colore) || "#16a34a";
  const stato =
    perche === "dal-vivo"
      ? `<span class="dm-sport-live" data-dm-sport-live><i aria-hidden="true"></i>${esc(
          p.intervallo
            ? t("Intervallo", "Half time")
            : `${t("In diretta", "Live")} · ${clean(p.minuto)}`,
        )}</span>`
      : perche === "prossima"
        ? `<span class="dm-sport-manca">${esc(mancaInParole(p.quando, adesso))}</span>`
        : `<span class="dm-sport-esito" data-esito="${esc(p.esito || "")}">${esc(ESITI()[p.esito]?.nome || t("Finita", "Full time"))}</span>`;
  const testa =
    perche === "prossima"
      ? t("Prossima partita", "Next match")
      : perche === "dal-vivo"
        ? t("Adesso", "Now")
        : t("Ultima partita", "Last match");
  const dopo =
    perche === "dal-vivo" ? r.prossime?.[0] : perche === "prossima" ? r.prossime?.[1] : null;
  return schedaMarkup(
    "",
    `<div class="dm-sport-partita-testa"><span>${esc(testa)}</span><span>${esc(p.competizione)}</span></div>
      <div class="dm-sport-campo">
        <div class="dm-sport-lato">${stemma(p.casa, 64)}<strong>${esc(p.casa.breve || p.casa.nome)}</strong></div>
        <div class="dm-sport-centro">${punteggio(p)}<small>${esc(
          p.fase === "prima"
            ? quandoInParole(p.quando, adesso).split(" · ")[0]
            : quandoInParole(p.quando, adesso),
        )}</small></div>
        <div class="dm-sport-lato">${stemma(p.fuori, 64)}<strong>${esc(p.fuori.breve || p.fuori.nome)}</strong></div>
      </div>
      <div class="dm-sport-partita-piede">${stato}${p.luogo ? `<small>📍 ${esc(p.luogo)}</small>` : ""}</div>
      ${
        dopo
          ? `<div class="dm-sport-poi"><span>${esc(t("Poi", "Then"))}</span>${stemma(dopo.casa, 18)}<b>${esc(
              dopo.casa.sigla || dopo.casa.breve,
            )}–${esc(dopo.fuori.sigla || dopo.fuori.breve)}</b>${stemma(dopo.fuori, 18)}<small>${esc(
              quandoInParole(dopo.quando, adesso),
            )}</small></div>`
          : ""
      }`,
    {
      classe: `dm-sport-partita${toccaLaPartita(p) ? " dm-sport-tocca" : ""}`,
      attr: `style="--squadra:${esc(colore)}" data-dm-sport-partita="${esc(perche)}" ${toccaLaPartita(p)}`,
    },
  );
}

/* Gli attributi che fanno di una cosa un tasto che apre il suo dettaglio:
 * `cosa` e' quello che si chiede al ponte, `titolo` la riga in cima. */
function tasto(cosa, titolo) {
  return `role="button" tabindex="0" data-dm-sport-apri="${esc(JSON.stringify(cosa))}" data-dm-sport-titolo="${esc(titolo)}"`;
}

function toccaLaPartita(p) {
  if (!p?.lega || !/^\d{1,9}$/.test(clean(p.id))) return "";
  return tasto(
    { tipo: "calcio", lega: p.lega, id: clean(p.id) },
    `${clean(p.casa?.breve || p.casa?.nome)} – ${clean(p.fuori?.breve || p.fuori?.nome)}`,
  );
}

function ultimeMarkup(r, titolo = t("Ultime partite", "Last matches")) {
  const ultime = (r.ultime || []).slice(0, 5);
  if (!ultime.length) return "";
  const esiti = ESITI();
  const righe = ultime
    .map((p) => {
      const lati = latiDellaPartita(p, r.squadra.id);
      const mia = lati.mia.gol ?? 0;
      const loro = lati.loro.gol ?? 0;
      return `<li class="dm-sport-riga${toccaLaPartita(p) ? " dm-sport-tocca" : ""}" ${toccaLaPartita(p)}>
        <span class="dm-sport-quando">${esc(dataBreve(p.quando))}<small>${esc(p.competizione)}</small></span>
        ${stemma(lati.loro, 24)}
        <span class="dm-sport-avversaria">${esc(lati.loro.breve || lati.loro.nome)}<small>${esc(
          lati.inCasa ? t("in casa", "home") : t("fuori", "away"),
        )}</small></span>
        <b class="dm-sport-ris">${mia}–${loro}</b>
        <span class="dm-sport-pallino" data-esito="${esc(p.esito || "")}" title="${esc(esiti[p.esito]?.nome || "")}">${esc(
          esiti[p.esito]?.lettera || "·",
        )}</span>
        <i class="dm-sport-freccia" aria-hidden="true">›</i>
      </li>`;
    })
    .join("");
  const forma = formaRecente(r)
    .map((e) => `<i data-esito="${e}" title="${esc(esiti[e]?.nome || "")}"></i>`)
    .join("");
  return schedaMarkup(
    `${esc(titolo)}<span class="dm-sport-forma" aria-label="${esc(t("Forma", "Form"))}">${forma}</span>`,
    `<ul class="dm-sport-righe">${righe}</ul>`,
  );
}

/* La zona di una riga: una striscia del suo colore accanto al numero. */
const zonaDellaRiga = (x) =>
  /^#[0-9a-f]{6}$/i.test(clean(x?.zona?.colore))
    ? ` style="--zona:${x.zona.colore}" title="${esc(ZONE()[x.zona.chiave] || "")}"`
    : "";

function classificaMarkup(r, { titolo = "", dove = "" } = {}) {
  /* Le prime cinque, e la squadra con chi le sta accanto: anche chi e' primo
   * vede chi lo insegue. */
  const righe = righeAttorno(r.classifica, r.squadra.id, { primi: 5, accanto: 1 });
  if (!righe.length) return "";
  const nome = titolo || r.campionato?.nome || t("Classifica", "Table");
  const corpo = righe
    .map((x) =>
      x.salto
        ? `<li class="dm-sport-salto" aria-hidden="true">⋯</li>`
        : `<li class="dm-sport-pos${x.mia ? " mia" : ""}">
          <span class="dm-sport-num"${zonaDellaRiga(x)}>${x.posizione}</span>${stemma(x, 22)}
          <span class="dm-sport-nome">${esc(x.breve || x.nome)}</span>
          <span class="dm-sport-g">${x.giocate}</span>
          <b>${x.punti}</b>
        </li>`,
    )
    .join("");
  return schedaMarkup(
    `${esc(nome)}<span class="dm-sport-intesta"><span>${esc(t("G", "P"))}</span><span>${esc(
      t("Pt", "Pts"),
    )}</span></span>`,
    `<ol class="dm-sport-classifica">${corpo}</ol><span class="dm-sport-tutta">${esc(
      t("Tutta la classifica", "Full table"),
    )} ›</span>`,
    {
      classe: "dm-sport-tocca",
      attr: tasto({ tipo: "tabella", dove }, nome),
    },
  );
}

function coppaMarkup(r, coppa, indice, adesso) {
  const vista = { ...coppa, squadra: r.squadra };
  const pos = coppa.posizione;
  const sotto = pos
    ? `<b>${conN(t("{n}°", "#{n}"), pos.posizione)}</b> · ${conN(esc(t("{n} punti", "{n} pts")), pos.punti)}`
    : "";
  const pezzi = [
    partitaGrande(vista, null, adesso),
    ultimeMarkup(vista, t("Ultime in coppa", "Last cup matches")),
    classificaMarkup(vista, {
      titolo: t("Fase campionato", "League phase"),
      dove: `${indice}:${coppa.lega}`,
    }),
  ].filter(Boolean);
  if (!pezzi.length) return "";
  return `<div class="dm-sport-coppa" data-dm-sport-coppa="${esc(coppa.lega)}" style="--coppa:${
    COLORI_DELLE_COPPE[coppa.lega] || "#334155"
  }">
      <h4 class="dm-sport-coppa-titolo"><span class="dm-sport-coppa-stella" aria-hidden="true">★</span><span>${esc(
        coppa.nome,
      )}</span>${sotto ? `<small>${sotto}</small>` : ""}</h4>
      <div class="dm-sport-griglia dm-sport-calcio">${pezzi.join("")}</div>
    </div>`;
}

function calcioMarkup(r, seguito, adesso, indice = 0) {
  const pos = r.posizione;
  const sotto = pos
    ? `${esc(r.campionato?.nome || "")} · <b>${conN(t("{n}°", "#{n}"), pos.posizione)}</b> · ${conN(esc(t("{n} punti", "{n} pts")), pos.punti)}`
    : esc(r.campionato?.nome || "");
  return `<section class="dm-sport-blocco" data-dm-sport-blocco="${esc(chiaveDelSeguito(seguito))}" style="--blocco:${esc(
    coloreDellaSquadra(r.squadra?.colore, "#16a34a"),
  )}">
      <div class="dm-sport-testa">${stemma(r.squadra, 30)}<h3 class="dm-sport-titolo"><span>${esc(
        r.squadra.nome || seguito.nome,
      )}</span><small>${sotto}</small></h3></div>
      <div class="dm-sport-griglia dm-sport-calcio">
        ${partitaGrande(r, seguito, adesso)}
        ${ultimeMarkup(r)}
        ${classificaMarkup(r, { dove: `${indice}:` })}
      </div>
      ${(r.coppe || []).map((c) => coppaMarkup(r, c, indice, adesso)).join("")}
    </section>`;
}

/* ── Formula 1 e MotoGP ───────────────────────────────────────────────── */

/* Una sessione finita che ha la sua classifica: per la F1 qualifiche,
 * sprint e gara (Jolpica le altre non le ha), per la MotoGP tutte quelle
 * che il campionato ha gia' scritto. */
function toccaLaSessione(r, gp, s, adesso) {
  const nome = `${SIGLE_DELLE_SESSIONI()[s.sigla] || s.sigla} · ${nomeBreveDelGp(gp?.nome) || clean(gp?.paese)}`;
  if (r.tipo === "f1") {
    if (!["Q", "S", "G"].includes(s.sigla) || !gp?.giro) return "";
    const durata = (s.sigla === "G" ? 2.5 : 1.5) * 3600_000;
    if (!(Date.parse(s.quando) + durata < adesso)) return "";
    return tasto({ tipo: "f1", giro: gp.giro, sessione: s.sigla }, nome);
  }
  if (!s.finita || !s.id) return "";
  return tasto({ tipo: "motogp", sessione: s.id }, nome);
}

/* Il pilota del cuore — o, se non c'e', chi comanda il mondiale — in fondo
 * al prossimo gran premio: dove sta, quanti punti, quanto manca, com'e'
 * andata l'ultima volta. */
function pilotaDelCuoreMarkup(r, seguito) {
  const righe = r.piloti || [];
  const mio = rigaDelPreferito(righe, seguito?.preferito);
  const chi = mio || righe[0];
  if (!chi) return "";
  const primo = righe[0];
  const secondo = righe[1];
  const inTesta = chi === primo || chi.posizione === 1;
  const distacco = inTesta
    ? secondo
      ? `+${Math.max(0, chi.punti - secondo.punti)}`
      : "—"
    : `−${Math.max(0, (primo?.punti ?? chi.punti) - chi.punti)}`;
  const ultima = rigaDelPreferito(r.ultima?.risultati || [], chi.id);
  const numero = (valore, nome) => `<span><b>${esc(valore)}</b><small>${esc(nome)}</small></span>`;
  return `<div class="dm-sport-cuore" style="--c:${coloreDi(r, chi)}">
      <div class="dm-sport-cuore-testa"><span>${esc(
        mio ? t("Il tuo pilota", "Your rider") : t("In testa al mondiale", "Championship leader"),
      )}</span><strong>${chi.numero ? `<i>#${esc(chi.numero)}</i> ` : ""}${esc(nomePilota(r, chi))}</strong><small>${squadraDi(r, chi, 18)}</small></div>
      <div class="dm-sport-cuore-numeri">
        ${numero(conN(t("{n}°", "#{n}"), chi.posizione), t("Mondiale", "Standing"))}
        ${numero(chi.punti, t("Punti", "Points"))}
        ${numero(distacco, inTesta ? t("Sul secondo", "Ahead of 2nd") : t("Dal primo", "Behind leader"))}
        ${ultima ? numero(ultima.posizione ? conN(t("{n}°", "#{n}"), ultima.posizione) : "–", t("Ultima gara", "Last race")) : ""}
      </div>
    </div>`;
}

/* La sessione in corso: «se l'evento e' iniziato devi mostrare i dati
 * live». L'ordine dei piloti, il giro, i distacchi della MotoGP; ogni mezzo
 * minuto si rilegge. `quanti` sono le righe; le altre in «Tutto l'ordine». */
function dalVivoMarkup(r, seguito, indice = 0, quanti = 10) {
  const v = r.dalVivo;
  if (!v?.ordine?.length) return "";
  const nomi = SIGLE_DELLE_SESSIONI();
  const gp = nomeBreveDelGp(r.prossima?.nome) || clean(r.prossima?.paese);
  const sessione = nomi[v.sessione] || v.sessione;
  const giro = v.giro
    ? v.giri
      ? conN(t("Giro {n}", "Lap {n}"), `${v.giro}/${v.giri}`)
      : conN(t("Giro {n}", "Lap {n}"), v.giro)
    : "";
  const preferito = clean(seguito?.preferito);
  const mio = (x) => preferito && (clean(x.id) === preferito || clean(x.numero) === preferito);
  const riga = (
    x,
  ) => `<li class="dm-sport-pos${mio(x) ? " mia" : ""}" style="--c:${coloreDi(r, x)}">
        <span class="dm-sport-num">${x.posizione ?? "–"}</span><i class="dm-sport-colore"></i>
        <span class="dm-sport-nome">${esc(r.tipo === "f1" ? x.cognome || x.nome : x.nome)}${
          x.numero ? ` <small class="dm-sport-pilota-num">#${esc(x.numero)}</small>` : ""
        }</span>
        <span class="dm-sport-g">${r.tipo === "f1" ? (x.scuderiaId ? scuderia(x.scuderiaId, 16) : "") : esc(x.moto || "")}</span>
        <b>${esc(x.aiBox ? t("Ai box", "In pit") : x.distacco || "")}</b>
      </li>`;
  const prime = v.ordine.slice(0, quanti);
  const suo = v.ordine.find((x) => mio(x) && x.posizione > quanti);
  const titolo = `${sessione} · ${gp}`;
  return schedaMarkup(
    "",
    `<div class="dm-sport-partita-testa"><span class="dm-sport-live" data-dm-sport-live><i aria-hidden="true"></i>${esc(
      t("In diretta", "Live"),
    )}</span><span>${esc(giro)}</span></div>
      <div class="dm-sport-gp"><strong>${esc(sessione)}</strong><small>${esc(gp)}</small></div>
      <ol class="dm-sport-classifica dm-sport-vivo">${prime.map(riga).join("")}${
        suo ? `<li class="dm-sport-salto" aria-hidden="true">⋯</li>${riga(suo)}` : ""
      }</ol>${
        v.ordine.length > quanti
          ? `<span class="dm-sport-tutta dm-sport-tocca" ${tasto({ tipo: "ordine", dove: `${indice}:` }, titolo)}>${esc(
              t("Tutto l'ordine", "Full order"),
            )} ›</span>`
          : ""
      }`,
    {
      classe: "dm-sport-partita dm-sport-dal-vivo",
      attr: `data-dm-sport-dal-vivo style="--squadra:${r.tipo === "f1" ? "#e10600" : "#c8102e"}"`,
    },
  );
}

/* L'ordine intero della sessione in corso, nel foglio. */
export function ordineDalVivoMarkup(r, preferito = "") {
  const righe = r?.dalVivo?.ordine || [];
  if (!righe.length) return "";
  const f1 = r.tipo === "f1";
  return `<div class="dm-sport-tabella" data-colonne="1"><div class="dm-sport-tabella-testa"><span>${esc(
    t("Pos", "Pos"),
  )}</span><span>${esc(t("Pilota", "Driver"))}</span><span class="dm-sport-tempi"><span>${esc(
    f1 ? "" : t("Distacco", "Gap"),
  )}</span></span></div><ol class="dm-sport-classifica">${righe
    .map((x) => {
      const mio = preferito && (clean(x.id) === preferito || clean(x.numero) === preferito);
      const squadra = f1
        ? `${scuderia(x.scuderiaId, 16)}${esc(x.scuderia)}`
        : esc(x.moto || x.squadra);
      return `<li class="dm-sport-pos${mio ? " mia" : ""}" style="--c:${coloreDi(r, x)}">
        <span class="dm-sport-num">${x.posizione ?? "–"}</span><i class="dm-sport-colore"></i>
        <span class="dm-sport-nome">${esc(x.nome)}${x.numero ? ` <small class="dm-sport-pilota-num">#${esc(x.numero)}</small>` : ""}<small>${squadra}</small></span>
        <span class="dm-sport-tempi"><span>${esc(x.aiBox ? t("Ai box", "In pit") : x.distacco || "")}</span></span>
      </li>`;
    })
    .join("")}</ol></div>`;
}

function prossimoGpMarkup(r, adesso, seguito = null) {
  const p = r.prossima;
  if (!p) return "";
  const sessioni = p.tutte?.length ? p.tutte : p.sessioni || [];
  const prossima =
    sessioni.find(
      (s) => !s.finita && !s.annullata && Date.parse(s.quando) + 2 * 3600_000 > adesso,
    ) || null;
  const nomi = SIGLE_DELLE_SESSIONI();
  const gara = sessioni.find((s) => s.sigla === "G");
  const dataEvento =
    r.tipo === "f1" ? giornoBreve(p.quando).replace(/\s\d+:\d+$/, "") : dalAl(p.dal, p.al);
  const quante = r.gare
    ? `${esc(t("Gara", "Round"))} ${p.giro || ""}${p.giro ? `/${r.gare}` : ""}`
    : "";
  const righe = sessioni
    .map((s) => {
      const tocca = toccaLaSessione(r, p, s, adesso);
      const fatta = s.finita || Date.parse(s.quando) + 2 * 3600_000 < adesso;
      const classe = [
        s === prossima ? "prossima" : fatta ? "fatta" : "",
        tocca ? "dm-sport-tocca" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const inCorso = r.dalVivo?.sessione && r.dalVivo.sessione === s.sigla;
      return `<li class="${inCorso ? "prossima in-corso" : classe}" ${inCorso ? "" : tocca}><span>${esc(nomi[s.sigla] || s.sigla)}</span><b>${
        inCorso
          ? `<span class="dm-sport-live"><i aria-hidden="true"></i>${esc(t("In diretta", "Live"))}</span>`
          : esc(s.annullata ? t("Annullata", "Cancelled") : quandoInParole(s.quando, adesso))
      }</b>${tocca && !inCorso ? `<i class="dm-sport-freccia" aria-hidden="true">›</i>` : ""}</li>`;
    })
    .join("");
  return schedaMarkup(
    "",
    `<div class="dm-sport-partita-testa"><span>${esc(t("Prossimo gran premio", "Next grand prix"))}</span><span>${quante}</span></div>
      <div class="dm-sport-gp">
        <strong>${esc(nomeBreveDelGp(p.nome) || p.paese)}</strong>
        <small>${esc([p.circuito, p.paese].filter(Boolean).join(" · "))}</small>
        <span class="dm-sport-gp-data">${esc(dataEvento)}${
          gara && Date.parse(gara.quando) > adesso
            ? `<span class="dm-sport-manca">${esc(t("Gara", "Race"))} ${esc(mancaInParole(gara.quando, adesso))}</span>`
            : ""
        }</span>
      </div>
      ${righe ? `<ul class="dm-sport-sessioni">${righe}</ul>` : ""}
      ${seguito ? pilotaDelCuoreMarkup(r, seguito) : ""}`,
    {
      classe: "dm-sport-partita dm-sport-gara-prossima",
      attr: `style="--squadra:${r.tipo === "f1" ? "#e10600" : "#c8102e"}"`,
    },
  );
}

/* Il cognome di un pilota: tutto quello che viene dopo il nome, cosi'
 * «Fabio Di Giannantonio» resta «Di Giannantonio». */
function cognomeDi(nome) {
  const parti = clean(nome).split(/\s+/);
  return parti.length > 1 ? parti.slice(1).join(" ") : parti[0] || "";
}

function coloreDi(r, x) {
  return r.tipo === "f1" ? COLORI_F1[x.scuderiaId] || "#64748b" : coloreDellaMoto(x.moto);
}

function nomePilota(r, x) {
  return r.tipo === "f1" ? x.nome || x.cognome : x.nome;
}

function ultimaGaraMarkup(r, seguito) {
  const corta =
    r.tipo === "f1" && r.sprint && Date.parse(r.sprint.quando) > Date.parse(r.ultima?.quando || 0)
      ? r.sprint
      : null;
  const g = corta || r.ultima;
  if (!g?.risultati?.length) return "";
  const sprint = corta || g.tipo === "SPR";
  const podio = g.risultati.slice(0, 3);
  const ordine = [podio[1], podio[0], podio[2]].filter(Boolean);
  const preferito = clean(seguito.preferito);
  const podioMarkup = ordine
    .map(
      (x) => `<div class="dm-sport-gradino" data-pos="${x.posizione}" style="--c:${coloreDi(r, x)}">
        <span class="dm-sport-pilota-num">${x.numero ? `#${esc(x.numero)}` : ""}</span>
        <strong${x.id === preferito ? ' class="mio"' : ""}>${esc(r.tipo === "f1" ? x.cognome || x.nome : cognomeDi(x.nome))}</strong>
        <small>${squadraDi(r, x, 18)}</small>
        <span class="dm-sport-scalino">${x.posizione}</span>
      </div>`,
    )
    .join("");
  const resto = g.risultati
    .slice(3, 10)
    .map(
      (x) => `<li class="dm-sport-pos${x.id === preferito ? " mia" : ""}">
        <span class="dm-sport-num">${x.posizione ?? "–"}</span><i class="dm-sport-colore" style="--c:${coloreDi(r, x)}"></i>
        <span class="dm-sport-nome">${esc(nomePilota(r, x))}</span>
        <span class="dm-sport-g">${squadraDi(r, x)}</span>
        <b>${x.punti ? `+${x.punti}` : ""}</b>
      </li>`,
    )
    .join("");
  const mio = rigaDelPreferito(g.risultati, preferito);
  const mioFuori =
    mio && (mio.posizione == null || mio.posizione > 10)
      ? `<li class="dm-sport-salto" aria-hidden="true">⋯</li><li class="dm-sport-pos mia"><span class="dm-sport-num">${
          mio.posizione ?? "–"
        }</span><i class="dm-sport-colore" style="--c:${coloreDi(r, mio)}"></i><span class="dm-sport-nome">${esc(
          nomePilota(r, mio),
        )}</span><span class="dm-sport-g">${esc(mio.stato || "")}</span><b></b></li>`
      : "";
  const titolo = `${esc(sprint ? t("Ultima sprint", "Last sprint") : t("Ultima gara", "Last race"))} · ${esc(
    nomeBreveDelGp(g.nome) || g.paese,
  )}`;
  /* Le altre sessioni dello stesso fine settimana, da toccare. */
  const nomi = SIGLE_DELLE_SESSIONI();
  const gp = nomeBreveDelGp(g.nome) || clean(g.paese);
  const sessioni =
    r.tipo === "f1"
      ? [
          "Q",
          ...(r.sprint?.giro === g.giro ? ["S"] : []),
          ...(r.ultima?.giro === g.giro ? ["G"] : []),
        ].map((sigla) => ({
          sigla,
          attr: tasto({ tipo: "f1", giro: g.giro, sessione: sigla }, `${nomi[sigla]} · ${gp}`),
        }))
      : (g.tutte || [])
          .filter((s) => s.finita && s.id)
          .map((s) => ({
            sigla: s.sigla,
            attr: tasto({ tipo: "motogp", sessione: s.id }, `${nomi[s.sigla] || s.sigla} · ${gp}`),
          }));
  const questa = sprint ? "S" : "G";
  const tutta = sessioni.find((s) => s.sigla === questa);
  const schede = sessioni.length
    ? `<div class="dm-sport-schede">${sessioni
        .map(
          (s) =>
            `<span class="dm-sport-scheda-tasto${s.sigla === questa ? " questa" : ""}" ${s.attr}>${esc(nomi[s.sigla] || s.sigla)}</span>`,
        )
        .join("")}</div>`
    : "";
  return schedaMarkup(
    titolo,
    `<div class="dm-sport-podio">${podioMarkup}</div><ol class="dm-sport-classifica">${resto}${mioFuori}</ol>${
      tutta
        ? `<span class="dm-sport-tutta dm-sport-tocca" ${tutta.attr}>${esc(t("Tutta la classifica", "Full results"))} ›</span>`
        : ""
    }${schede}`,
    { classe: "dm-sport-ultima" },
  );
}

function classificaPilotiMarkup(r, seguito, indice = 0) {
  const righe = quotaDelPrimo(r.piloti || []);
  if (!righe.length) return "";
  const preferito = clean(seguito.preferito);
  const prime = righe.slice(0, 10);
  const mio = righe.find((x) => x.id === preferito && x.posizione > 10);
  const riga = (
    x,
  ) => `<li class="dm-sport-pos dm-sport-barra${x.id === preferito ? " mia" : ""}" style="--q:${(
    x.quota * 100
  ).toFixed(1)}%;--c:${coloreDi(r, x)}">
      <span class="dm-sport-num">${x.posizione}</span>
      <span class="dm-sport-nome">${esc(nomePilota(r, x))}<small>${squadraDi(r, x)}</small><i class="dm-sport-quota" aria-hidden="true"></i></span>
      <b>${x.punti}</b>
    </li>`;
  const titolo =
    r.tipo === "f1"
      ? t("Classifica piloti", "Drivers' standings")
      : t("Classifica piloti", "Riders' standings");
  return schedaMarkup(
    esc(titolo),
    `<ol class="dm-sport-classifica">${prime.map(riga).join("")}${mio ? `<li class="dm-sport-salto" aria-hidden="true">⋯</li>${riga(mio)}` : ""}</ol><span class="dm-sport-tutta">${esc(
      t("Tutta la classifica", "Full standings"),
    )} ›</span>`,
    {
      classe: "dm-sport-tocca dm-sport-piloti",
      attr: tasto({ tipo: "piloti", dove: `${indice}:` }, titolo),
    },
  );
}

function costruttoriMarkup(r) {
  const righe = quotaDelPrimo(r.costruttori || []).slice(0, 12);
  if (!righe.length) return "";
  return schedaMarkup(
    esc(t("Costruttori", "Constructors")),
    `<ol class="dm-sport-classifica">${righe
      .map(
        (
          x,
        ) => `<li class="dm-sport-pos dm-sport-barra" style="--q:${(x.quota * 100).toFixed(1)}%;--c:${COLORI_F1[x.id] || "#64748b"}">
        <span class="dm-sport-num">${x.posizione}</span><span class="dm-sport-nome"><span class="dm-sport-con-scud">${scuderia(x.id, 26)}${esc(x.nome)}</span><i class="dm-sport-quota" aria-hidden="true"></i></span><b>${x.punti}</b>
      </li>`,
      )
      .join("")}</ol>`,
  );
}

function corseMarkup(r, seguito, adesso, indice = 0) {
  const preferito = rigaDelPreferito(r.piloti, seguito.preferito);
  const sotto = [
    r.stagione ? conN(esc(t("Stagione {n}", "Season {n}")), r.stagione) : "",
    preferito
      ? `${esc(nomePilota(r, preferito))} <b>${conN(t("{n}°", "#{n}"), preferito.posizione)}</b> · ${conN(esc(t("{n} punti", "{n} pts")), preferito.punti)}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<section class="dm-sport-blocco" data-dm-sport-blocco="${esc(r.tipo)}" style="--blocco:${
    r.tipo === "f1" ? "#e10600" : "#c8102e"
  }">
      <div class="dm-sport-testa">${titoloDelBlocco(r.tipo, nomeDelTipo(r.tipo), sotto)}</div>
      <div class="dm-sport-griglia dm-sport-corse" data-quante="${r.tipo === "f1" ? 4 : 3}">
        ${dalVivoMarkup(r, seguito, indice)}
        ${prossimoGpMarkup(r, adesso, seguito)}
        ${ultimaGaraMarkup(r, seguito)}
        ${classificaPilotiMarkup(r, seguito, indice)}
        ${r.tipo === "f1" ? costruttoriMarkup(r) : ""}
      </div>
    </section>`;
}

function guastoDelBloccoMarkup(seguito) {
  const titolo =
    seguito.tipo === "calcio"
      ? seguito.nome || t("La tua squadra", "Your team")
      : nomeDelTipo(seguito.tipo);
  return `<section class="dm-sport-blocco" data-dm-sport-blocco="${esc(chiaveDelSeguito(seguito))}">
      <div class="dm-sport-testa">${titoloDelBlocco(seguito.tipo === "calcio" ? "sport" : seguito.tipo, titolo)}</div>
      ${schedaMarkup(
        "",
        `<p class="dm-sport-vuoto">${esc(
          t(
            "I risultati adesso non arrivano: si riprova da soli fra un minuto.",
            "Results are not coming in right now: it will try again in a minute.",
          ),
        )}</p>`,
      )}
    </section>`;
}

/* ── i dettagli ───────────────────────────────────────────────────────── */

/* Toccando una partita, una sessione o una classifica si apre un foglio:
 * per la partita chi ha segnato, i cartellini, i cambi, le formazioni e le
 * statistiche; per una sessione la classifica coi tempi; per una classifica
 * tutte le righe. Le partite e le sessioni si chiedono al ponte
 * (`ponte/sport/dettaglio`, solo per chi e' entrato) quando si toccano; le
 * classifiche ci sono gia'. */

const STATISTICHE = () => ({
  possesso: t("Possesso palla", "Possession"),
  tiri: t("Tiri", "Shots"),
  tiriInPorta: t("Tiri in porta", "Shots on target"),
  angoli: t("Calci d'angolo", "Corners"),
  falli: t("Falli", "Fouls"),
  gialli: t("Ammonizioni", "Yellow cards"),
  rossi: t("Espulsioni", "Red cards"),
  fuorigioco: t("Fuorigioco", "Offsides"),
  parate: t("Parate", "Saves"),
  passaggiRiusciti: t("Passaggi riusciti", "Accurate passes"),
  passaggi: t("Passaggi", "Passes"),
});

function segnoDellEvento(tipo) {
  if (tipo === "giallo" || tipo === "rosso")
    return `<i class="dm-sport-cartellino" data-c="${tipo}" aria-hidden="true"></i>`;
  if (tipo === "cambio") return `<i class="dm-sport-segno" aria-hidden="true">⇄</i>`;
  if (tipo === "rigore-sbagliato") return `<i class="dm-sport-segno" aria-hidden="true">✕</i>`;
  return `<i class="dm-sport-segno" aria-hidden="true">⚽</i>`;
}

function rigaDellEvento(e) {
  const nota =
    e.tipo === "rigore"
      ? t("rigore", "penalty")
      : e.tipo === "autogol"
        ? t("autogol", "own goal")
        : e.tipo === "rigore-sbagliato"
          ? t("rigore sbagliato", "missed penalty")
          : e.assist
            ? conN(t("assist {n}", "assist {n}"), e.assist)
            : "";
  const chi =
    e.tipo === "cambio"
      ? `<span><b class="dm-sport-entra">▲ ${esc(e.entra)}</b><small class="dm-sport-esce">▼ ${esc(e.esce)}</small></span>`
      : `<span><b>${esc(e.chi)}</b>${nota ? `<small>${esc(nota)}</small>` : ""}</span>`;
  const pezzo = `<div class="dm-sport-evento" data-tipo="${esc(e.tipo)}">${segnoDellEvento(e.tipo)}${chi}</div>`;
  return `<li data-lato="${e.lato === "ospite" ? "ospite" : "casa"}"><div>${
    e.lato === "ospite" ? "" : pezzo
  }</div><span class="dm-sport-minuto">${esc(e.minuto)}</span><div>${e.lato === "ospite" ? pezzo : ""}</div></li>`;
}

function formazioneMarkup(squadra, f) {
  if (!f?.titolari?.length) return "";
  const giocatore = (g, panchina) =>
    `<li><span class="dm-sport-maglia">${esc(g.numero)}</span><span class="dm-sport-giocatore">${esc(g.nome)}</span><small>${esc(
      g.ruolo,
    )}</small>${!panchina && g.uscito ? `<i class="dm-sport-esce" title="${esc(t("Uscito", "Subbed off"))}">▼</i>` : ""}${
      panchina && g.entrato
        ? `<i class="dm-sport-entra" title="${esc(t("Entrato", "Subbed on"))}">▲</i>`
        : ""
    }</li>`;
  return `<div class="dm-sport-formazione">
      <div class="dm-sport-formazione-testa">${stemma(squadra, 26)}<strong>${esc(
        squadra?.breve || squadra?.nome || "",
      )}</strong>${f.modulo ? `<small>${esc(f.modulo)}</small>` : ""}</div>
      <ol>${f.titolari.map((g) => giocatore(g, false)).join("")}</ol>
      ${
        f.panchina?.length
          ? `<h5>${esc(t("Panchina", "Bench"))}</h5><ol>${f.panchina.map((g) => giocatore(g, true)).join("")}</ol>`
          : ""
      }
    </div>`;
}

function statisticaMarkup(x, nomi) {
  const a = Number.parseFloat(String(x.casa).replace(",", ".")) || 0;
  const b = Number.parseFloat(String(x.ospite).replace(",", ".")) || 0;
  const quota = a + b > 0 ? (a / (a + b)) * 100 : 50;
  const per = x.chiave === "possesso" ? "%" : "";
  return `<li style="--q:${quota.toFixed(1)}%"><b>${esc(x.casa)}${per}</b><span>${esc(
    nomi[x.chiave] || x.chiave,
  )}</span><b>${esc(x.ospite)}${per}</b><i aria-hidden="true"></i></li>`;
}

export function partitaDettaglioMarkup(d, adesso = Date.now()) {
  if (!d?.casa || !d?.ospite) return "";
  const stato =
    d.fase === "in"
      ? `<span class="dm-sport-live"><i aria-hidden="true"></i>${esc(`${t("In diretta", "Live")} · ${clean(d.minuto)}`)}</span>`
      : d.fase === "finita"
        ? `<span class="dm-sport-esito">${esc(t("Finita", "Full time"))}</span>`
        : `<span class="dm-sport-manca">${esc(mancaInParole(d.quando, adesso))}</span>`;
  const gol =
    d.fase === "prima"
      ? `<b class="dm-sport-ora">${esc(oraDi(d.quando))}</b>`
      : `<b class="dm-sport-gol">${d.casa.gol ?? 0}<i>–</i>${d.ospite.gol ?? 0}</b>`;
  /* I marcatori sotto il risultato, come sul tabellone. */
  const marcatori = (lato) =>
    (d.eventi || [])
      .filter((e) => e.lato === lato && ["gol", "rigore", "autogol"].includes(e.tipo))
      .map(
        (e) =>
          `<li>${esc(cognomeDi(e.chi))} <small>${esc(e.minuto)}${e.tipo === "rigore" ? ` (${esc(t("rig.", "pen"))})` : e.tipo === "autogol" ? ` (${esc(t("aut.", "og"))})` : ""}</small></li>`,
      )
      .join("");
  const luogo = [d.stadio, d.citta].filter(Boolean).join(" · ");
  const testa = `<div class="dm-sport-tabellone">
      <div class="dm-sport-lato">${stemma(d.casa, 56)}<strong>${esc(d.casa.breve || d.casa.nome)}</strong><ul class="dm-sport-marcatori">${marcatori("casa")}</ul></div>
      <div class="dm-sport-centro">${gol}<small>${esc(quandoInParole(d.quando, adesso))}</small>${stato}</div>
      <div class="dm-sport-lato">${stemma(d.ospite, 56)}<strong>${esc(d.ospite.breve || d.ospite.nome)}</strong><ul class="dm-sport-marcatori">${marcatori("ospite")}</ul></div>
    </div>
    ${
      luogo || d.arbitro
        ? `<div class="dm-sport-info">${luogo ? `<span>📍 ${esc(luogo)}</span>` : ""}${
            d.arbitro
              ? `<span>${esc(t("Arbitro", "Referee"))}: <b>${esc(d.arbitro)}</b></span>`
              : ""
          }</div>`
        : ""
    }`;
  const schede = [];
  if (d.eventi?.length)
    schede.push([
      "cronaca",
      t("Cronaca", "Timeline"),
      `<ol class="dm-sport-cronaca">${d.eventi.map(rigaDellEvento).join("")}</ol>`,
    ]);
  if (d.statistiche?.length) {
    const nomi = STATISTICHE();
    schede.push([
      "statistiche",
      t("Statistiche", "Stats"),
      `<ul class="dm-sport-statistiche">${d.statistiche.map((x) => statisticaMarkup(x, nomi)).join("")}</ul>`,
    ]);
  }
  const formazioni =
    formazioneMarkup(d.casa, d.formazioni?.casa) + formazioneMarkup(d.ospite, d.formazioni?.ospite);
  if (formazioni)
    schede.push([
      "formazioni",
      t("Formazioni", "Line-ups"),
      `<div class="dm-sport-formazioni">${formazioni}</div>`,
    ]);
  if (!schede.length)
    return `${testa}<p class="dm-sport-vuoto">${esc(
      t("Il resto arriva quando si gioca.", "The rest comes in when the match is played."),
    )}</p>`;
  return `${testa}${linguetteMarkup(schede)}`;
}

/* Le linguette del foglio: una sola parte si vede, le altre a un tocco. */
function linguetteMarkup(schede) {
  return `<div class="dm-sport-linguette" role="tablist">${schede
    .map(
      ([chiave, nome], i) =>
        `<button type="button" role="tab" data-dm-sport-linguetta="${chiave}" aria-selected="${i === 0}">${esc(nome)}</button>`,
    )
    .join("")}</div>${schede
    .map(
      ([chiave, , corpo], i) =>
        `<div class="dm-sport-parte" data-dm-sport-parte="${chiave}"${i === 0 ? "" : " hidden"}>${corpo}</div>`,
    )
    .join("")}`;
}

function preferitoDi(tipo) {
  return clean(configurazioneDelloSport().seguiti.find((s) => s.tipo === tipo)?.preferito);
}

export function sessioneDettaglioMarkup(d, preferito = "") {
  const righe = d?.risultati || [];
  if (!righe.length) return "";
  const f1 = d.tipo === "f1";
  const qualifica = f1 && d.sessione === "Q";
  const corsa = f1 && d.sessione !== "Q";
  const intesta = qualifica
    ? ["Q1", "Q2", "Q3"]
    : corsa
      ? [t("Tempo", "Time"), t("Pt", "Pts")]
      : [t("Tempo", "Time"), t("Distacco", "Gap"), t("Pt", "Pts")];
  /* Sul telefono la qualifica mostra solo il tempo migliore: i tre turni
   * non ci stanno accanto al nome. */
  const colonne = `<span class="dm-sport-tempi">${[
    ...intesta,
    ...(qualifica ? [t("Tempo", "Time")] : []),
  ]
    .map((x) => `<span>${esc(x)}</span>`)
    .join("")}</span>`;
  const corpo = righe
    .map((x) => {
      const mio = preferito && clean(x.id) === preferito;
      const colore = f1 ? COLORI_F1[x.scuderiaId] || "#64748b" : coloreDellaMoto(x.moto);
      const chi = f1 ? clean(x.nome) || clean(x.cognome) : clean(x.nome);
      const squadra = f1 ? `${scuderia(x.scuderiaId, 16)}${esc(x.scuderia)}` : esc(x.moto);
      const guadagno = corsa && x.griglia && x.posizione ? x.griglia - x.posizione : null;
      const valori = qualifica
        ? [x.q1, x.q2, x.q3, x.tempo]
        : corsa
          ? [x.tempo || x.stato, x.punti ? `+${x.punti}` : ""]
          : [x.tempo || x.giro || x.stato, x.distacco, x.punti ? `+${x.punti}` : ""];
      return `<li class="dm-sport-pos${mio ? " mia" : ""}" style="--c:${colore}">
        <span class="dm-sport-num">${x.posizione ?? "–"}</span><i class="dm-sport-colore"></i>
        <span class="dm-sport-nome">${esc(chi)}${x.numero && !f1 ? ` <small class="dm-sport-pilota-num">#${esc(x.numero)}</small>` : ""}<small>${squadra}${
          guadagno
            ? ` · <em class="${guadagno > 0 ? "su" : "giu"}">${guadagno > 0 ? "▲" : "▼"}${Math.abs(guadagno)}</em>`
            : ""
        }${x.giroVeloce ? ` · <em class="viola">${esc(t("giro veloce", "fastest lap"))}</em>` : ""}</small></span>
        <span class="dm-sport-tempi">${valori.map((v) => `<span>${esc(clean(v) || "–")}</span>`).join("")}</span>
      </li>`;
    })
    .join("");
  return `<div class="dm-sport-tabella" data-colonne="${intesta.length}"${qualifica ? ' data-qualifica="1"' : ""}><div class="dm-sport-tabella-testa"><span>${esc(
    t("Pos", "Pos"),
  )}</span><span>${esc(f1 ? t("Pilota", "Driver") : t("Pilota", "Rider"))}</span>${colonne}</div><ol class="dm-sport-classifica">${corpo}</ol></div>`;
}

/* La classifica intera di un campionato o di una coppa, coi suoi colori. */
export function tabellaMarkup(righe, id) {
  if (!righe?.length) return "";
  const zone = new Map();
  const corpo = righe
    .map((x) => {
      if (x.zona?.chiave && !zone.has(x.zona.chiave)) zone.set(x.zona.chiave, x.zona.colore);
      return `<li class="dm-sport-pos${x.id === String(id) ? " mia" : ""}">
        <span class="dm-sport-num"${zonaDellaRiga(x)}>${x.posizione}</span>${stemma(x, 22)}
        <span class="dm-sport-nome">${esc(x.breve || x.nome)}</span>
        <span class="dm-sport-tempi"><span>${x.giocate}</span><span>${x.vinte}</span><span>${x.pari}</span><span>${x.perse}</span><span>${x.fatti}:${x.subiti}</span><b>${x.punti}</b></span>
      </li>`;
    })
    .join("");
  const nomi = ZONE();
  const legenda = [...zone]
    .map(
      ([chiave, colore]) =>
        `<span><i style="--zona:${/^#[0-9a-f]{6}$/i.test(clean(colore)) ? colore : "#94a3b8"}"></i>${esc(nomi[chiave] || chiave)}</span>`,
    )
    .join("");
  return `<div class="dm-sport-tabella dm-sport-tabella-squadre"><div class="dm-sport-tabella-testa"><span>#</span><span></span><span class="dm-sport-tempi">${[
    t("G", "P"),
    t("V", "W"),
    t("N", "D"),
    t("P", "L"),
    t("Gol", "Goals"),
    t("Pt", "Pts"),
  ]
    .map((x) => `<span>${esc(x)}</span>`)
    .join(
      "",
    )}</span></div><ol class="dm-sport-classifica">${corpo}</ol>${legenda ? `<div class="dm-sport-legenda">${legenda}</div>` : ""}</div>`;
}

export function pilotiMarkup(r, preferito = "") {
  const righe = quotaDelPrimo(r?.piloti || []);
  if (!righe.length) return "";
  const f1 = r.tipo === "f1";
  return `<div class="dm-sport-tabella" data-colonne="${f1 ? 2 : 1}"><div class="dm-sport-tabella-testa"><span>${esc(
    t("Pos", "Pos"),
  )}</span><span>${esc(f1 ? t("Pilota", "Driver") : t("Pilota", "Rider"))}</span><span class="dm-sport-tempi">${
    f1 ? `<span>${esc(t("Vittorie", "Wins"))}</span>` : ""
  }<span>${esc(t("Pt", "Pts"))}</span></span></div><ol class="dm-sport-classifica">${righe
    .map(
      (
        x,
      ) => `<li class="dm-sport-pos dm-sport-barra${x.id === preferito ? " mia" : ""}" style="--q:${(x.quota * 100).toFixed(1)}%;--c:${coloreDi(r, x)}">
        <span class="dm-sport-num">${x.posizione}</span>
        <span class="dm-sport-nome">${esc(nomePilota(r, x))}<small>${squadraDi(r, x)}</small><i class="dm-sport-quota" aria-hidden="true"></i></span>
        <span class="dm-sport-tempi">${f1 ? `<span>${x.vittorie ?? 0}</span>` : ""}<b>${x.punti}</b></span>
      </li>`,
    )
    .join("")}</ol></div>`;
}

/* Il risultato che una tabella racconta: `dove` e' «blocco:lega», la lega
 * vuota per il campionato. */
function tabellaDa(dove) {
  const [i, lega] = clean(dove).split(":");
  const r = state.dati.risultati[Number(i)];
  if (!r || r.errore) return "";
  if (r.tipo !== "calcio") return pilotiMarkup(r, preferitoDi(r.tipo));
  const tab = lega ? r.coppe?.find((c) => c.lega === lega)?.classifica : r.classifica;
  return tabellaMarkup(tab, r.squadra?.id);
}

function avvisoDelFoglio(testo) {
  return `<p class="dm-sport-vuoto dm-sport-attesa">${esc(testo)}</p>`;
}

async function apriIlDettaglio(cosa, titolo) {
  const corpo = apriIlFoglioDiScelta({ titolo, id: "dm-sport-dettaglio" });
  if (!corpo) return;
  const scheda = corpo.parentElement;
  scheda?.classList.add("dm-sport-largo");
  corpo.closest(".dm-foglio-scelta")?.classList.add("dm-sport-foglio");
  /* Il colore del foglio: quello della F1, della MotoGP, delle due squadre
   * quando arriva la partita. «I popup tutto bianco non mi piacciono.» */
  if (scheda) scheda.dataset.sportTipo = clean(cosa.tipo) || "tabella";
  installaLoStileDelFoglio();
  if (cosa.tipo === "ordine") {
    const r = state.dati.risultati[Number(clean(cosa.dove).split(":")[0])];
    if (scheda && (r?.tipo === "f1" || r?.tipo === "motogp")) scheda.dataset.sportTipo = r.tipo;
    corpo.innerHTML =
      (r && !r.errore ? ordineDalVivoMarkup(r, preferitoDi(r.tipo)) : "") ||
      avvisoDelFoglio(t("La sessione è finita.", "The session is over."));
    return;
  }
  if (cosa.tipo === "tabella" || cosa.tipo === "piloti") {
    corpo.innerHTML =
      tabellaDa(cosa.dove) || avvisoDelFoglio(t("La classifica non c'è ancora.", "No table yet."));
    return;
  }
  corpo.innerHTML = avvisoDelFoglio(t("Arriva…", "Loading…"));
  let html = "";
  try {
    const risposta = await chiediAHomeAssistant({ type: "ponte/sport/dettaglio", cosa }, ATTESA);
    const d = risposta?.dettaglio;
    html = d?.nonAncora
      ? avvisoDelFoglio(
          t(
            "I risultati di questa sessione non sono ancora stati pubblicati: di solito arrivano qualche ora dopo la fine.",
            "This session's results have not been published yet: they usually arrive a few hours after it ends.",
          ),
        )
      : d?.tipo === "calcio"
        ? (coloraIlFoglio(scheda, d), partitaDettaglioMarkup(d, Date.now()))
        : sessioneDettaglioMarkup(d, preferitoDi(d?.tipo));
  } catch (_errore) {}
  if (!corpo.isConnected) return;
  corpo.innerHTML =
    html ||
    avvisoDelFoglio(
      t(
        "Il dettaglio adesso non arriva: riprova fra poco.",
        "The details are not coming in right now: try again shortly.",
      ),
    );
}

/* Il colore di una squadra per il foglio: quello di ESPN, se c'e' e non e'
 * quasi bianco (sarebbe una fascia bianca con le scritte bianche); se no la
 * riserva. Due squadre dello stesso colore non si confondono: la seconda
 * prende la sua riserva. */
function coloreDellaSquadra(colore, riserva) {
  const c = clean(colore);
  if (!/^#[0-9a-f]{6}$/i.test(c)) return riserva;
  const n = Number.parseInt(c.slice(1), 16);
  const luce = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luce > 0.82 ? riserva : c;
}

function coloraIlFoglio(scheda, d) {
  if (!scheda) return;
  const casa = coloreDellaSquadra(d?.casa?.colore, "#2563eb");
  let ospite = coloreDellaSquadra(d?.ospite?.colore, "#f97316");
  if (ospite.toLowerCase() === casa.toLowerCase())
    ospite = casa === "#f97316" ? "#2563eb" : "#f97316";
  scheda.style.setProperty("--sq-casa", casa);
  scheda.style.setProperty("--sq-ospite", ospite);
}

function alTocco(evento) {
  const linguetta = evento.target?.closest?.("[data-dm-sport-linguetta]");
  if (linguetta) {
    const foglio = linguetta.closest(".dm-foglio-scelta-corpo");
    const quale = linguetta.dataset.dmSportLinguetta;
    for (const b of foglio?.querySelectorAll("[data-dm-sport-linguetta]") || [])
      b.setAttribute("aria-selected", String(b === linguetta));
    for (const parte of foglio?.querySelectorAll("[data-dm-sport-parte]") || [])
      parte.hidden = parte.dataset.dmSportParte !== quale;
    return;
  }
  const nodo = evento.target?.closest?.("[data-dm-sport-apri]");
  if (!nodo) return;
  if (evento.type === "keydown" && evento.key !== "Enter" && evento.key !== " ") return;
  evento.preventDefault?.();
  evento.stopPropagation?.();
  let cosa = null;
  try {
    cosa = JSON.parse(nodo.dataset.dmSportApri || "null");
  } catch (_errore) {}
  if (cosa && typeof cosa === "object") apriIlDettaglio(cosa, nodo.dataset.dmSportTitolo || "");
}

/* ── la tessera e la finestra della Home ──────────────────────────────── */

function nomeDellaSquadra(squadra) {
  return clean(squadra?.breve || squadra?.nome);
}

/**
 * Cosa dice la tessera dello sport nella Home: un numero (il risultato, o
 * l'ora) e una riga. Sceglie `inEvidenza`: la partita in corso, quello che
 * c'e' oggi, il risultato fresco, la prossima cosa in calendario.
 */
export function tesseraDelloSport(vista, adesso = Date.now()) {
  const ev = inEvidenza(vista.risultati, adesso);
  const nomi = SIGLE_DELLE_SESSIONI();
  if (!ev) {
    const seguiti = vista.config.seguiti.map((x) =>
      x.tipo === "calcio" ? x.nome || nomeDelTipo("calcio") : nomeDelTipo(x.tipo),
    );
    return { valore: "—", riga: seguiti.join(" · "), oggetto: "sport", dalVivo: false };
  }
  if (ev.tipo === "calcio") {
    const p = ev.partita;
    const coppia = `${nomeDellaSquadra(p.casa)}–${nomeDellaSquadra(p.fuori)}`;
    if (ev.cosa === "dal-vivo")
      return {
        valore: `${p.casa.gol ?? 0}–${p.fuori.gol ?? 0}`,
        riga: `${coppia} · ${p.intervallo ? t("Intervallo", "Half time") : clean(p.minuto)}`,
        oggetto: "sport",
        dalVivo: true,
      };
    if (ev.cosa === "prossima")
      return {
        valore: oraDi(p.quando),
        riga: `${coppia} · ${quandoInParole(p.quando, adesso).split(" · ")[0]}`,
        oggetto: "sport",
        dalVivo: false,
      };
    return {
      valore: `${p.casa.gol ?? 0}–${p.fuori.gol ?? 0}`,
      riga: `${coppia} · ${ESITI()[p.esito]?.nome || t("Finita", "Full time")}`,
      oggetto: "sport",
      dalVivo: false,
    };
  }
  const gp = nomeBreveDelGp((ev.evento || ev.risultato?.prossima || ev.gara)?.nome);
  if (ev.cosa === "dal-vivo") {
    const primo = ev.corsa.ordine[0];
    const giro = ev.corsa.giro ? ` · ${conN(t("Giro {n}", "Lap {n}"), ev.corsa.giro)}` : "";
    return {
      valore: clean(ev.tipo === "f1" ? primo.cognome || primo.nome : cognomeDi(primo.nome)),
      riga: `${nomeDelTipo(ev.tipo)} · ${nomi[ev.corsa.sessione] || ev.corsa.sessione}${giro}`,
      oggetto: ev.tipo,
      dalVivo: true,
    };
  }
  if (ev.cosa === "prossima" && ev.sessione)
    return {
      valore: oraDi(ev.sessione.quando),
      riga: `${nomeDelTipo(ev.tipo)} · ${nomi[ev.sessione.sigla] || ev.sessione.sigla} · ${quandoInParole(ev.sessione.quando, adesso).split(" · ")[0]}`,
      oggetto: ev.tipo,
      dalVivo: false,
    };
  if (ev.cosa === "prossima")
    return {
      valore: gp,
      riga: `${nomeDelTipo(ev.tipo)} · ${dalAl(ev.evento?.dal, ev.evento?.al)}`,
      oggetto: ev.tipo,
      dalVivo: false,
    };
  const primo = ev.gara?.risultati?.[0];
  const sprint = ev.gara?.tipo === "SPR" || (ev.tipo === "f1" && ev.gara === ev.risultato?.sprint);
  return {
    valore: primo
      ? clean(ev.tipo === "f1" ? primo.cognome || primo.nome : cognomeDi(primo.nome))
      : gp,
    riga: `${nomeDelTipo(ev.tipo)} · ${sprint ? t("Sprint", "Sprint") : t("Gara", "Race")} ${nomeBreveDelGp(ev.gara?.nome)}`,
    oggetto: ev.tipo,
    dalVivo: false,
  };
}

/** La finestra della tessera: un riquadro per ogni cosa seguita, col pezzo
 * che conta — la partita, o il prossimo gran premio e l'ultimo podio. */
export function finestraDelloSportMarkup(vista, adesso = Date.now()) {
  const { config, risultati } = vista;
  if (!config.seguiti.length) return "";
  if (!risultati.length) return paginaDelloSportMarkup(vista, adesso);
  return `<div class="dm-sport-wrap dm-sport-finestra">${config.seguiti
    .map((seguito, i) => {
      const r = risultati[i];
      if (!r || r.errore || r.tipo !== seguito.tipo) return guastoDelBloccoMarkup(seguito);
      if (r.tipo === "calcio") {
        const pos = r.posizione;
        const sotto = pos
          ? `<b>${conN(t("{n}°", "#{n}"), pos.posizione)}</b> · ${conN(esc(t("{n} punti", "{n} pts")), pos.punti)}`
          : "";
        const forma = formaRecente(r)
          .map((e) => `<i data-esito="${e}"></i>`)
          .join("");
        return `<section class="dm-sport-blocco"><div class="dm-sport-testa">${stemma(r.squadra, 26)}<h3 class="dm-sport-titolo"><span>${esc(
          r.squadra.nome || seguito.nome,
        )}</span><small>${sotto}</small></h3><span class="dm-sport-forma">${forma}</span></div>${partitaGrande(r, seguito, adesso)}</section>`;
      }
      const g =
        r.tipo === "f1" &&
        r.sprint &&
        Date.parse(r.sprint.quando) > Date.parse(r.ultima?.quando || 0)
          ? r.sprint
          : r.ultima;
      const podio = (g?.risultati || [])
        .slice(0, 3)
        .map(
          (x) =>
            `<span style="--c:${coloreDi(r, x)}"><b>${x.posizione}</b>${esc(r.tipo === "f1" ? x.cognome || x.nome : cognomeDi(x.nome))}</span>`,
        )
        .join("");
      return `<section class="dm-sport-blocco"><div class="dm-sport-testa">${titoloDelBlocco(r.tipo, nomeDelTipo(r.tipo), "", "finestra")}</div>${dalVivoMarkup(
        r,
        seguito,
        i,
        5,
      )}${prossimoGpMarkup(r, adesso)}${
        podio
          ? `<div class="dm-sport-podio-breve"><small>${esc(g.tipo === "SPR" || g === r.sprint ? t("Ultima sprint", "Last sprint") : t("Ultima gara", "Last race"))} · ${esc(
              nomeBreveDelGp(g.nome),
            )}</small><div>${podio}</div></div>`
          : ""
      }</section>`;
    })
    .join("")}</div>`;
}

/* ── la pagina ────────────────────────────────────────────────────────── */

export function paginaDelloSportMarkup(vista, adesso = Date.now()) {
  const { config, risultati, guasto, inVolo } = vista;
  if (!config.seguiti.length) return "";
  if (guasto === "senza-ponte" || guasto === "non-entrato")
    return `<div class="dm-sport-scheda dm-sport-avviso">${oggettoWidget("sport", "", "sport-avviso")}<p>${esc(
      guasto === "senza-ponte"
        ? t(
            "I risultati dello sport li porta l'add-on GdAHome: da questa plancia non si raggiunge.",
            "Sports results come through the GdAHome add-on, which this dashboard cannot reach.",
          )
        : t("Lo sport lo vede chi è entrato.", "Sports are shown to signed-in users."),
    )}</p></div>`;
  if (!risultati.length)
    return `<div class="dm-sport-scheda dm-sport-avviso" data-dm-sport-attesa>${oggettoWidget("sport", "", "sport-attesa")}<p>${esc(
      inVolo || !guasto
        ? t("Arrivano i risultati…", "Fetching results…")
        : t("I risultati adesso non arrivano.", "Results are not coming in right now."),
    )}</p></div>`;
  return config.seguiti
    .map((seguito, i) => {
      const r = risultati[i];
      if (!r || r.errore || r.tipo !== seguito.tipo) return guastoDelBloccoMarkup(seguito);
      if (r.tipo === "calcio") return calcioMarkup(r, seguito, adesso, i);
      return corseMarkup(r, seguito, adesso, i);
    })
    .join("");
}

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureSportPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(SPORT_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = SPORT_PAGE_ID;
  pagina.innerHTML = `<div class="dm-sport-wrap" id="sport-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

function apriLaPagina(voce) {
  for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
  voce?.classList.add("active");
  ensureSportPage()?.classList.add("active");
  const testata = doc.querySelector("header");
  if (testata) testata.style.display = "none";
  root.scrollTo?.({ top: 0, behavior: "instant" });
  if (root.navigator?.vibrate) root.navigator.vibrate(5);
  schedule();
}

export function ensureSportTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${SPORT_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Dopo la musica: e' tempo libero, come lei. */
  const dopo =
    barra.querySelector('.tab[data-tab="media"]') ||
    barra.querySelector('.tab[data-tab="meteo"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = SPORT_TAB;
  voce.id = `tab-${SPORT_TAB}`;
  voce.innerHTML = `<span class="icon">⚽</span><span class="text">${esc(t("Sport", "Sports"))}</span>`;
  voce.addEventListener("click", () => apriLaPagina(voce));
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[SPORT_TAB] === false);
}

/* La voce c'e' quando si segue qualcosa e nessuno l'ha spenta. */
function accendiLaVoce(config) {
  const voce = ensureSportTab();
  if (!voce) return false;
  const serve = segnaContenuto(SPORT_TAB, config.seguiti.length > 0) && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(SPORT_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
  return serve;
}

function dipingi() {
  const pagina = ensureSportPage();
  const dove = pagina?.querySelector?.("#sport-wrap");
  if (!dove || !paginaVisibile(SPORT_PAGE_ID)) return;
  /* Il minuto intero: il conto alla rovescia cambia una volta al minuto, e
   * cosi' la pagina si riscrive solo quando cambia davvero. */
  const minuto = Math.floor(Date.now() / 60_000) * 60_000;
  scriviSeCambia(dove, paginaDelloSportMarkup(risultatiDelloSport(), minuto));
}

function battito() {
  if (state.sveglia || !paginaVisibile(SPORT_PAGE_ID)) return;
  state.sveglia =
    root.setTimeout?.(() => {
      state.sveglia = 0;
      schedule();
    }, BATTITO) || 0;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      if (accendiLaVoce(configurazioneDelloSport())) {
        dipingi();
        battito();
      }
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] sport", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/** Ridisegna adesso e richiede i risultati: la usa la scheda del Config. */
export function renderSport() {
  state.dati.chiesti = 0;
  schedule();
}

function titoloDellaPagina() {
  const { seguiti } = configurazioneDelloSport();
  if (!seguiti.length) return null;
  return {
    subtitle: seguiti
      .map((s) => (s.tipo === "calcio" ? s.nome || nomeDelTipo("calcio") : nomeDelTipo(s.tipo)))
      .join(" · "),
  };
}

/* ── il foglio ────────────────────────────────────────────────────────── */

export function foglioDelloSport(P) {
  return `
  ${P} .dm-sport-wrap{display:grid;gap:26px;padding:0 0 40px}
  ${P} .dm-sport-blocco{display:grid;gap:12px;min-width:0}
  ${P} .dm-sport-testa{display:flex;align-items:center;gap:12px;min-width:0;margin:0 0 0 2px}
  ${P} .dm-sport-titolo{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:0;min-width:0;
    font-size:15px;font-weight:900;letter-spacing:.2px;color:var(--text,#0f172a)}
  ${P} .dm-sport-titolo-ic{display:inline-flex;width:28px;height:28px;align-self:center}
  ${P} .dm-sport-titolo-ic svg{width:28px;height:28px}
  ${P} .dm-sport-titolo small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-titolo small b{color:var(--text,#0f172a)}
  ${P} .dm-sport-griglia{display:grid;gap:16px;min-width:0}
  ${P} .dm-sport-calcio{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,1fr)}
  /* Le corse due per riga: il prossimo gran premio accanto all'ultima gara,
   * le classifiche sotto. Cosi' i nomi del podio ci stanno interi. */
  ${P} .dm-sport-corse{grid-template-columns:repeat(2,minmax(0,1fr))}
  ${P} .dm-sport-corse[data-quante="3"]>.dm-sport-piloti{grid-column:1/-1}
  @media(min-width:900px){
    ${P} .dm-sport-corse[data-quante="3"]>.dm-sport-piloti .dm-sport-classifica{display:block;columns:2;column-gap:28px}
    ${P} .dm-sport-corse[data-quante="3"]>.dm-sport-piloti .dm-sport-classifica>li{break-inside:avoid;margin-bottom:2px}
  }
  ${P} .dm-sport-scheda{box-sizing:border-box;min-width:0;padding:16px 16px 14px;border:1px solid var(--card-border,#e2e8f0);
    border-radius:22px;background:var(--card-bg,#fff);box-shadow:var(--shadow-sculpted,0 6px 18px rgba(15,23,42,.07))}
  ${P} .dm-sport-sotto-titolo{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:11px;font-weight:900;
    letter-spacing:1.3px;text-transform:uppercase;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-sotto-titolo>:last-child{margin-left:auto}

  /* La partita in grande e il prossimo gran premio */
  ${P} .dm-sport-partita{--squadra:#16a34a;display:flex;flex-direction:column;gap:12px;position:relative;overflow:hidden;
    background:radial-gradient(130% 120% at 0% 0%,color-mix(in srgb,var(--squadra) 16%,transparent),transparent 60%),var(--card-bg,#fff)}
  ${P} .dm-sport-partita::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:var(--squadra)}
  ${P} .dm-sport-partita-testa{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:900;
    letter-spacing:1.2px;text-transform:uppercase;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-campo{flex:1 1 auto;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px}
  ${P} .dm-sport-lato{display:grid;justify-items:center;gap:8px;text-align:center;min-width:0}
  ${P} .dm-sport-lato strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);line-height:1.2;
    overflow:hidden;text-overflow:ellipsis;max-width:100%}
  ${P} .dm-sport-centro{display:grid;justify-items:center;gap:4px}
  ${P} .dm-sport-gol,${P} .dm-sport-ora{font-family:'Oswald',system-ui,sans-serif;font-size:44px;font-weight:700;line-height:1;
    color:var(--text,#0f172a);letter-spacing:-.5px;white-space:nowrap}
  ${P} .dm-sport-ora{font-size:34px}
  ${P} .dm-sport-gol i{font-style:normal;margin:0 6px;color:var(--text-dim,#94a3b8)}
  ${P} .dm-sport-centro small,${P} .dm-sport-rigori{font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b);white-space:nowrap}
  ${P} .dm-sport-partita-piede{margin-top:auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 10px}
  ${P} .dm-sport-partita-piede small{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-manca,${P} .dm-sport-esito,${P} .dm-sport-live{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;
    font-size:12px;font-weight:900;color:var(--text,#0f172a);background:color-mix(in srgb,var(--squadra) 14%,transparent)}
  ${P} .dm-sport-live{color:#fff;background:#dc2626}
  ${P} .dm-sport-live i{width:8px;height:8px;border-radius:50%;background:#fff;animation:dm-sport-batte 1.4s ease-in-out infinite}
  @keyframes dm-sport-batte{50%{opacity:.25}}
  ${P} .dm-sport-esito[data-esito="V"]{color:#fff;background:#16a34a}
  ${P} .dm-sport-esito[data-esito="P"]{color:#fff;background:#dc2626}
  ${P} .dm-sport-poi{display:flex;align-items:center;gap:6px;padding-top:10px;border-top:1px dashed var(--card-border,#e2e8f0);
    font-size:12px;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-poi>span{font-weight:900;text-transform:uppercase;letter-spacing:1px;font-size:10.5px;margin-right:2px}
  ${P} .dm-sport-poi b{color:var(--text,#0f172a);font-weight:900}
  ${P} .dm-sport-poi small{margin-left:auto;font-weight:800}
  ${P} .dm-sport-gp{display:grid;gap:3px}
  ${P} .dm-sport-gp strong{font-family:'Oswald',system-ui,sans-serif;font-size:32px;font-weight:700;line-height:1.05;color:var(--text,#0f172a)}
  ${P} .dm-sport-gp small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-gp-data{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin-top:4px;font-size:13px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-sport-sessioni{display:grid;gap:4px;margin:0;padding:0;list-style:none}
  ${P} .dm-sport-sessioni li{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;font-size:12.5px;
    color:var(--text-dim,#64748b);background:var(--surface-2,#f8fafc)}
  ${P} .dm-sport-sessioni li>span{flex:1 1 auto;min-width:0}
  ${P} .dm-sport-sessioni li b{color:var(--text,#0f172a);font-weight:800;white-space:nowrap}
  ${P} .dm-sport-sessioni li.fatta:not(.dm-sport-tocca){opacity:.5}
  ${P} .dm-sport-sessioni li.fatta.dm-sport-tocca span{color:var(--text,#0f172a);font-weight:800}
  ${P} .dm-sport-sessioni li.fatta.dm-sport-tocca b{color:var(--text-dim,#64748b);font-weight:700}
  ${P} .dm-sport-sessioni li.prossima{background:color-mix(in srgb,var(--squadra) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--squadra) 35%,transparent)}
  ${P} .dm-sport-sessioni li.prossima span{color:var(--text,#0f172a);font-weight:900}

  /* Gli stemmi */
  ${P} .dm-sport-stemma{display:inline-grid;place-items:center;flex:0 0 auto;width:var(--m);height:var(--m)}
  ${P} .dm-sport-stemma img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(15,23,42,.18))}
  ${P} .dm-sport-sigla{border-radius:50%;background:var(--c);color:#fff;font-size:calc(var(--m) * .32);font-weight:900;letter-spacing:.3px}

  /* Le righe */
  ${P} .dm-sport-righe,${P} .dm-sport-classifica{display:grid;gap:2px;margin:0;padding:0;list-style:none}
  ${P} .dm-sport-riga{display:grid;grid-template-columns:52px 24px minmax(0,1fr) auto 24px 8px;align-items:center;gap:8px;
    padding:7px 4px;border-bottom:1px solid var(--card-border,#eef2f7);border-radius:10px}
  ${P} .dm-sport-riga:last-child{border-bottom:0}
  ${P} .dm-sport-quando{display:grid;font-size:12px;font-weight:900;color:var(--text,#0f172a);line-height:1.15}
  ${P} .dm-sport-quando small{font-size:9.5px;font-weight:700;color:var(--text-dim,#94a3b8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-sport-avversaria{display:grid;font-size:13px;font-weight:800;color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-sport-avversaria small{font-size:9.5px;font-weight:700;color:var(--text-dim,#94a3b8);text-transform:uppercase;letter-spacing:.6px}
  ${P} .dm-sport-ris{font-family:'Oswald',system-ui,sans-serif;font-size:17px;font-weight:700;color:var(--text,#0f172a)}
  ${P} .dm-sport-pallino{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;font-size:11px;font-weight:900;
    color:#fff;background:#94a3b8}
  ${P} [data-esito="V"].dm-sport-pallino,${P} .dm-sport-forma i[data-esito="V"]{background:#16a34a}
  ${P} [data-esito="P"].dm-sport-pallino,${P} .dm-sport-forma i[data-esito="P"]{background:#dc2626}
  ${P} .dm-sport-forma{display:inline-flex;gap:4px}
  ${P} .dm-sport-forma i{width:9px;height:9px;border-radius:3px;background:#94a3b8}
  ${P} .dm-sport-intesta{display:inline-flex;gap:14px;letter-spacing:.6px}
  ${P} .dm-sport-pos{display:grid;grid-template-columns:22px auto minmax(0,1fr) auto 30px;align-items:center;gap:8px;
    padding:6px 6px;border-radius:10px;font-size:13px;position:relative}
  ${P} .dm-sport-pos.mia{background:color-mix(in srgb,#0ea5e9 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,#0ea5e9 35%,transparent)}
  ${P} .dm-sport-num{font-size:12px;font-weight:900;color:var(--text-dim,#64748b);text-align:right}
  ${P} .dm-sport-nome{display:grid;font-weight:800;color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-sport-nome small{font-size:10.5px;font-weight:700;color:var(--text-dim,#94a3b8);overflow:hidden;text-overflow:ellipsis}
  ${P} .dm-sport-g{font-size:11.5px;font-weight:700;color:var(--text-dim,#94a3b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px}
  ${P} .dm-sport-pos b{font-family:'Oswald',system-ui,sans-serif;font-size:16px;font-weight:700;color:var(--text,#0f172a);text-align:right}
  ${P} .dm-sport-salto{text-align:center;color:var(--text-dim,#94a3b8);font-weight:900;line-height:1}
  ${P} .dm-sport-colore{width:4px;height:18px;border-radius:2px;background:var(--c)}
  ${P} .dm-sport-barra{grid-template-columns:22px minmax(0,1fr) auto}
  /* La barra dei punti sta sotto il nome, non sopra: non copre niente. */
  ${P} .dm-sport-quota{display:block;height:3px;margin-top:4px;border-radius:2px;
    background:linear-gradient(90deg,var(--c,#64748b) var(--q,0%),color-mix(in srgb,var(--text,#0f172a) 8%,transparent) var(--q,0%))}
  ${P} .dm-sport-num[style]{position:relative}
  ${P} .dm-sport-num[style]::before{content:"";position:absolute;left:-5px;top:1px;bottom:1px;width:3px;border-radius:2px;background:var(--zona)}

  /* Il podio */
  ${P} .dm-sport-podio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:8px;margin:0 0 10px}
  ${P} .dm-sport-gradino{display:grid;justify-items:center;gap:2px;text-align:center;min-width:0}
  ${P} .dm-sport-gradino strong{font-size:13.5px;font-weight:900;line-height:1.15;color:var(--text,#0f172a);max-width:100%;
    overflow-wrap:anywhere;hyphens:auto}
  ${P} .dm-sport-gradino strong.mio{color:#0284c7}
  ${P} .dm-sport-gradino small{font-size:10.5px;font-weight:700;color:var(--text-dim,#94a3b8);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-sport-pilota-num{font-family:'Oswald',system-ui,sans-serif;font-size:13px;font-weight:700;color:var(--c)}
  ${P} .dm-sport-scalino{display:grid;place-items:center;width:100%;margin-top:6px;border-radius:12px 12px 4px 4px;
    font-family:'Oswald',system-ui,sans-serif;font-size:22px;font-weight:700;color:#fff;
    background:linear-gradient(180deg,color-mix(in srgb,var(--c) 85%,#fff),var(--c))}
  ${P} .dm-sport-gradino[data-pos="1"] .dm-sport-scalino{height:62px}
  ${P} .dm-sport-gradino[data-pos="2"] .dm-sport-scalino{height:46px}
  ${P} .dm-sport-gradino[data-pos="3"] .dm-sport-scalino{height:34px}

  /* Il pilota del cuore, in fondo al prossimo gran premio */
  ${P} .dm-sport-cuore{margin-top:auto;display:grid;gap:10px;padding:12px 14px;border-radius:16px;
    background:linear-gradient(135deg,color-mix(in srgb,var(--c) 16%,transparent),color-mix(in srgb,var(--c) 4%,transparent));
    box-shadow:inset 3px 0 0 var(--c)}
  ${P} .dm-sport-cuore-testa{display:grid;gap:1px;min-width:0}
  ${P} .dm-sport-cuore-testa span{font-size:10.5px;font-weight:900;letter-spacing:1.1px;text-transform:uppercase;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-cuore-testa strong{font-size:17px;font-weight:900;color:var(--text,#0f172a);overflow-wrap:anywhere}
  ${P} .dm-sport-cuore-testa strong i{font-style:normal;font-family:'Oswald',system-ui,sans-serif;color:var(--c)}
  ${P} .dm-sport-cuore-testa small{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-cuore-numeri{display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:8px}
  ${P} .dm-sport-cuore-numeri span{display:grid;gap:1px}
  ${P} .dm-sport-cuore-numeri b{font-family:'Oswald',system-ui,sans-serif;font-size:22px;font-weight:700;line-height:1.05;color:var(--text,#0f172a)}
  ${P} .dm-sport-cuore-numeri small{font-size:10.5px;font-weight:800;color:var(--text-dim,#64748b)}

  /* Quello che si tocca per vedere di piu' */
  ${P} .dm-sport-tocca{cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s ease,box-shadow .15s ease,background-color .15s ease}
  ${P} .dm-sport-tocca:focus-visible{outline:2px solid #0ea5e9;outline-offset:2px}
  ${P} .dm-sport-scheda.dm-sport-tocca:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(15,23,42,.12)}
  ${P} .dm-sport-riga.dm-sport-tocca:hover,${P} .dm-sport-sessioni li.dm-sport-tocca:hover{background:color-mix(in srgb,var(--text,#0f172a) 5%,transparent)}
  ${P} .dm-sport-tocca:active{transform:scale(.99)}
  ${P} .dm-sport-freccia{font-style:normal;font-size:16px;font-weight:900;line-height:1;color:var(--text-dim,#94a3b8)}
  ${P} .dm-sport-tutta{display:block;margin-top:10px;font-size:11.5px;font-weight:900;letter-spacing:.3px;text-align:right;color:#0284c7}
  ${P} .dm-sport-schede{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--card-border,#e2e8f0)}
  ${P} .dm-sport-scheda-tasto{display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border-radius:999px;cursor:pointer;
    font-size:12px;font-weight:800;color:var(--text,#0f172a);background:var(--surface-2,#f1f5f9);box-shadow:inset 0 0 0 1px var(--card-border,#e2e8f0)}
  ${P} .dm-sport-scud{display:inline-grid;place-items:center;width:var(--m,18px);height:var(--m,18px);margin-right:6px;border-radius:5px;
    background:var(--c,#64748b);vertical-align:-0.28em;overflow:hidden;flex:0 0 auto;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
  ${P} .dm-sport-scud img{width:78%;height:78%;object-fit:contain}
  ${P} .dm-sport-con-scud{display:flex;align-items:center;min-width:0}
  ${P} .dm-sport-con-scud .dm-sport-scud{margin-right:10px;border-radius:7px}
  ${P} .dm-sport-scheda-tasto.questa{color:#fff;background:#0f172a;box-shadow:none}
  ${P} .dm-sport-scheda-tasto:hover{filter:brightness(.96)}

  /* Le coppe europee */
  ${P} .dm-sport-coppa{--coppa:#1e3a8a;display:grid;gap:10px;margin-top:6px}
  ${P} .dm-sport-coppa-titolo{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin:0 0 0 2px;font-size:14px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-sport-coppa-stella{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;font-size:14px;color:#fff;
    background:radial-gradient(circle at 30% 30%,color-mix(in srgb,var(--coppa) 70%,#fff),var(--coppa))}
  ${P} .dm-sport-coppa-titolo small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-coppa-titolo small b{color:var(--text,#0f172a)}

  /* I dettagli, nel foglio che si apre toccando */
  ${P} .dm-sport-attesa{padding:22px 4px;text-align:center}
  ${P} .dm-sport-tabellone{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:start;gap:10px;padding:4px 0 12px}
  ${P} .dm-sport-tabellone .dm-sport-centro{padding-top:8px}
  ${P} .dm-sport-tabellone .dm-sport-centro>span{margin-top:4px}
  ${P} .dm-sport-marcatori{display:grid;gap:2px;margin:2px 0 0;padding:0;list-style:none;font-size:12px;font-weight:700;color:var(--text,#0f172a);text-align:center}
  ${P} .dm-sport-marcatori small{color:var(--text-dim,#64748b);font-weight:700}
  ${P} .dm-sport-info{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 16px;padding:8px 0 12px;font-size:12px;font-weight:700;color:var(--text-dim,#64748b);
    border-bottom:1px solid var(--card-border,#eef2f7)}
  ${P} .dm-sport-info b{color:var(--text,#0f172a)}
  /* «Devi mettere qualche colore sui tab se no non si vedono»: grigio su
     grigio le linguette sembravano testo. Ognuna e' un tasto col suo bordo, e
     quella scelta e' piena, d'azzurro. */
  ${P} .dm-sport-linguette{position:sticky;top:0;z-index:1;display:flex;gap:6px;margin:12px 0 10px;padding:5px;border-radius:14px;
    background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);box-shadow:0 2px 8px rgba(15,23,42,.08)}
  ${P} .dm-sport-linguette button{flex:1 1 0;min-height:38px;border:1.5px solid color-mix(in srgb,#0ea5e9 35%,transparent);border-radius:10px;
    background:color-mix(in srgb,#0ea5e9 8%,transparent);cursor:pointer;font:inherit;font-size:12.5px;font-weight:800;color:#0284c7;
    transition:background .15s ease,color .15s ease}
  ${P} .dm-sport-linguette button[aria-selected="true"]{color:#fff;border-color:transparent;
    background:linear-gradient(135deg,#0ea5e9,#2563eb);box-shadow:0 4px 12px rgba(37,99,235,.35)}
  html[data-theme="dark"] ${P} .dm-sport-linguette button:not([aria-selected="true"]){color:#7dd3fc;border-color:rgba(56,189,248,.45);background:rgba(56,189,248,.12)}
  ${P} .dm-sport-cronaca{display:grid;gap:4px;margin:0;padding:0;list-style:none}
  ${P} .dm-sport-cronaca li{display:grid;grid-template-columns:minmax(0,1fr) 44px minmax(0,1fr);align-items:center;gap:8px;min-height:34px}
  ${P} .dm-sport-cronaca li>div:first-child{display:flex;justify-content:flex-end}
  ${P} .dm-sport-cronaca li>div:first-child .dm-sport-evento{flex-direction:row-reverse;text-align:right}
  ${P} .dm-sport-minuto{display:grid;place-items:center;height:24px;border-radius:999px;font-size:11.5px;font-weight:900;
    color:var(--text,#0f172a);background:var(--surface-2,#f1f5f9)}
  ${P} .dm-sport-evento{display:flex;align-items:center;gap:8px;min-width:0;font-size:13px}
  ${P} .dm-sport-evento>span{display:grid;min-width:0}
  ${P} .dm-sport-evento b{font-weight:800;color:var(--text,#0f172a);overflow-wrap:anywhere}
  ${P} .dm-sport-evento small{font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-evento[data-tipo="gol"] b,${P} .dm-sport-evento[data-tipo="rigore"] b,${P} .dm-sport-evento[data-tipo="autogol"] b{font-weight:900}
  ${P} .dm-sport-segno{font-style:normal;font-size:14px;line-height:1;flex:0 0 auto}
  ${P} .dm-sport-cartellino{flex:0 0 auto;width:11px;height:15px;border-radius:2px;background:#facc15;box-shadow:0 1px 2px rgba(0,0,0,.2)}
  ${P} .dm-sport-cartellino[data-c="rosso"]{background:#dc2626}
  ${P} .dm-sport-entra{color:#16a34a!important;font-style:normal}
  ${P} .dm-sport-esce{color:#dc2626!important;font-style:normal}
  ${P} .dm-sport-statistiche{display:grid;gap:12px;margin:0;padding:4px 0;list-style:none}
  ${P} .dm-sport-statistiche li{display:grid;grid-template-columns:56px minmax(0,1fr) 56px;align-items:center;gap:4px 8px}
  ${P} .dm-sport-statistiche li>b{font-family:'Oswald',system-ui,sans-serif;font-size:16px;font-weight:700;color:var(--text,#0f172a)}
  ${P} .dm-sport-statistiche li>b:last-of-type{text-align:right}
  ${P} .dm-sport-statistiche li>span{text-align:center;font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-statistiche li>i{grid-column:1/-1;height:6px;border-radius:3px;
    background:linear-gradient(90deg,#0ea5e9 calc(var(--q) - 1px),transparent calc(var(--q) - 1px),transparent calc(var(--q) + 1px),#f97316 calc(var(--q) + 1px))}
  ${P} .dm-sport-formazioni{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  ${P} .dm-sport-formazione{display:grid;align-content:start;gap:6px;min-width:0}
  ${P} .dm-sport-formazione-testa{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text,#0f172a)}
  ${P} .dm-sport-formazione-testa small{margin-left:auto;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:900;color:var(--text-dim,#64748b);background:var(--surface-2,#f1f5f9)}
  ${P} .dm-sport-formazione ol{display:grid;gap:1px;margin:0;padding:0;list-style:none}
  ${P} .dm-sport-formazione li{display:grid;grid-template-columns:24px minmax(0,1fr) auto auto;align-items:center;gap:6px;padding:4px 2px;font-size:12.5px;
    border-bottom:1px solid var(--card-border,#eef2f7)}
  ${P} .dm-sport-formazione li small{font-size:10px;font-weight:800;color:var(--text-dim,#94a3b8)}
  ${P} .dm-sport-formazione li i{font-size:10px}
  ${P} .dm-sport-formazione h5{margin:8px 0 0;font-size:10.5px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-maglia{font-family:'Oswald',system-ui,sans-serif;font-weight:700;color:var(--text-dim,#64748b);text-align:right}
  ${P} .dm-sport-giocatore{font-weight:700;color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-sport-tabella{display:grid;gap:4px}
  ${P} .dm-sport-tabella-testa{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:8px;padding:0 6px 6px;font-size:10.5px;font-weight:900;
    letter-spacing:.8px;text-transform:uppercase;color:var(--text-dim,#64748b);border-bottom:1px solid var(--card-border,#eef2f7)}
  ${P} .dm-sport-tabella .dm-sport-pos{grid-template-columns:22px auto minmax(0,1fr) auto}
  ${P} .dm-sport-tabella .dm-sport-barra{grid-template-columns:22px minmax(0,1fr) auto}
  ${P} .dm-sport-tempi{display:grid;grid-auto-flow:column;grid-auto-columns:66px;gap:6px;text-align:right;font-variant-numeric:tabular-nums;
    font-size:12px;font-weight:700;color:var(--text,#0f172a);white-space:nowrap}
  ${P} .dm-sport-tempi>*{overflow:hidden;text-overflow:ellipsis}
  ${P} .dm-sport-tabella[data-colonne="1"] .dm-sport-tempi,${P} .dm-sport-tabella[data-colonne="2"] .dm-sport-tempi{grid-auto-columns:56px}
  ${P} .dm-sport-tabella-squadre .dm-sport-tempi{grid-auto-columns:auto;grid-template-columns:repeat(4,22px) 40px 30px;gap:4px}
  ${P} .dm-sport-tabella .dm-sport-tempi b{font-family:'Oswald',system-ui,sans-serif;font-size:15px}
  ${P} .dm-sport-tabella[data-qualifica] .dm-sport-tempi>:nth-child(4){display:none}
  ${P} .dm-sport-nome em{font-style:normal;font-weight:900}
  ${P} .dm-sport-nome em.su{color:#16a34a}
  ${P} .dm-sport-nome em.giu{color:#dc2626}
  ${P} .dm-sport-nome em.viola{color:#a855f7}
  ${P} .dm-sport-nome .dm-sport-pilota-num{display:inline;font-size:11px}
  ${P} .dm-sport-legenda{display:flex;flex-wrap:wrap;gap:6px 14px;padding:10px 6px 0;font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-legenda span{display:inline-flex;align-items:center;gap:6px}
  ${P} .dm-sport-legenda i{width:10px;height:10px;border-radius:3px;background:var(--zona)}

  /* La finestra della Home: i riquadri uno sotto l'altro */
  ${P} .dm-sport-finestra{gap:18px;padding:0}
  ${P} .dm-sport-finestra .dm-sport-testa{justify-content:flex-start}
  ${P} .dm-sport-finestra .dm-sport-testa .dm-sport-forma{margin-left:auto}
  ${P} .dm-sport-finestra .dm-sport-gol{font-size:36px}
  ${P} .dm-sport-finestra .dm-sport-ora{font-size:28px}
  ${P} .dm-sport-podio-breve{display:grid;gap:6px;padding:10px 12px;border-radius:14px;background:var(--surface-2,#f8fafc)}
  ${P} .dm-sport-podio-breve small{font-size:10.5px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim,#64748b)}
  ${P} .dm-sport-podio-breve div{display:flex;flex-wrap:wrap;gap:6px 14px}
  ${P} .dm-sport-podio-breve span{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:800;color:var(--text,#0f172a)}
  ${P} .dm-sport-podio-breve b{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;font-size:11px;color:#fff;background:var(--c)}

  /* Gli avvisi */
  ${P} .dm-sport-avviso{display:flex;align-items:center;gap:14px}
  ${P} .dm-sport-avviso svg{width:44px;height:44px;flex:0 0 auto}
  ${P} .dm-sport-avviso p,${P} .dm-sport-vuoto{margin:0;font-size:13.5px;font-weight:700;color:var(--text-dim,#64748b)}

  @media(max-width:1200px){
    ${P} .dm-sport-calcio{grid-template-columns:repeat(2,minmax(0,1fr))}
    ${P} .dm-sport-calcio>.dm-sport-partita{grid-column:1/-1}
    ${P} .dm-sport-corse{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
  @media(max-width:700px){
    ${P} .dm-sport-calcio,${P} .dm-sport-corse{grid-template-columns:minmax(0,1fr)}
    ${P} .dm-sport-tempi{grid-auto-columns:54px;font-size:11.5px}
    ${P} .dm-sport-formazioni{grid-template-columns:minmax(0,1fr)}
    ${P} .dm-sport-tabella[data-qualifica] .dm-sport-tempi>:nth-child(-n+3){display:none}
    ${P} .dm-sport-tabella[data-qualifica] .dm-sport-tempi>:nth-child(4){display:block}
    ${P} .dm-sport-evento{font-size:12.5px}
    ${P} .dm-sport-tabellone .dm-sport-gol{font-size:34px}
    ${P} .dm-sport-gol{font-size:38px}
    ${P} .dm-sport-ora{font-size:30px}
    ${P} .dm-sport-gp strong{font-size:28px}
    ${P} .dm-sport-wrap{gap:22px}
  }

  /* «Pure della sezione proprio non riesci a fare meglio»: la pagina a colori.
   * Ogni blocco ha la sua fascia — il colore della squadra, il rosso della F1,
   * quello della MotoGP — e il riquadro grande (la partita, il prossimo gran
   * premio) e' pieno del suo colore, con le scritte bianche. Le altre schede
   * restano carte bianche, con un filo del colore del blocco in cima. */
  ${P} .dm-sport-blocco{--blocco:#0ea5e9}
  ${P} .dm-sport-blocco>.dm-sport-testa{margin:0;padding:12px 16px;border-radius:18px;color:#fff;
    background:linear-gradient(120deg,var(--blocco),color-mix(in srgb,var(--blocco) 55%,#0f172a));
    box-shadow:0 8px 22px color-mix(in srgb,var(--blocco) 30%,transparent)}
  ${P} .dm-sport-blocco>.dm-sport-testa .dm-sport-titolo,${P} .dm-sport-blocco>.dm-sport-testa .dm-sport-titolo small,
  ${P} .dm-sport-blocco>.dm-sport-testa .dm-sport-titolo small b{color:#fff}
  ${P} .dm-sport-blocco>.dm-sport-testa .dm-sport-titolo small{opacity:.85}
  ${P} .dm-sport-blocco>.dm-sport-testa .dm-sport-stemma{border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.9)}
  ${P} .dm-sport-blocco>.dm-sport-testa .dm-sport-titolo-ic{padding:3px;border-radius:50%;background:rgba(255,255,255,.92)}
  ${P} .dm-sport-blocco>.dm-sport-testa .dm-sport-titolo-ic svg{width:22px;height:22px}
  ${P} .dm-sport-blocco .dm-sport-scheda:not(.dm-sport-partita){border-top:4px solid var(--blocco)}
  ${P} .dm-sport-coppa .dm-sport-scheda:not(.dm-sport-partita){border-top-color:var(--coppa)}
  ${P} .dm-sport-coppa-titolo{padding:10px 14px;border-radius:16px;color:#fff;
    background:linear-gradient(120deg,var(--coppa),color-mix(in srgb,var(--coppa) 55%,#0f172a))}
  ${P} .dm-sport-coppa-titolo small,${P} .dm-sport-coppa-titolo small b{color:#fff}
  ${P} .dm-sport-coppa-stella{background:rgba(255,255,255,.25)}

  ${P} .dm-sport-partita{--text:#fff;--text-dim:rgba(255,255,255,.78);--card-border:rgba(255,255,255,.28);--surface-2:rgba(255,255,255,.14);
    color:#fff;border:0;
    background:radial-gradient(120% 90% at 100% 0%,rgba(255,255,255,.16),transparent 55%),
      linear-gradient(135deg,var(--squadra),color-mix(in srgb,var(--squadra) 50%,#0b1220))!important;
    box-shadow:0 14px 32px color-mix(in srgb,var(--squadra) 32%,transparent)}
  ${P} .dm-sport-partita::before{display:none}
  ${P} .dm-sport-partita .dm-sport-stemma{border-radius:50%;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.85),0 8px 18px rgba(0,0,0,.25)}
  ${P} .dm-sport-partita .dm-sport-gol i{color:rgba(255,255,255,.6)}
  ${P} .dm-sport-partita .dm-sport-manca,${P} .dm-sport-partita .dm-sport-esito:not([data-esito]){color:#fff;background:rgba(255,255,255,.2)}
  ${P} .dm-sport-partita .dm-sport-poi{border-top-color:rgba(255,255,255,.3)}
  ${P} .dm-sport-partita .dm-sport-sessioni li{background:rgba(255,255,255,.12)}
  ${P} .dm-sport-partita .dm-sport-sessioni li.prossima{background:#fff;box-shadow:none}
  ${P} .dm-sport-partita .dm-sport-sessioni li.prossima span,${P} .dm-sport-partita .dm-sport-sessioni li.prossima b{color:#0f172a}
  ${P} .dm-sport-dal-vivo .dm-sport-tutta{color:#fff;font-weight:800}
  ${P} .dm-sport-dal-vivo .dm-sport-colore{box-shadow:0 0 0 1.5px rgba(255,255,255,.75)}
  ${P} .dm-sport-dal-vivo .dm-sport-pos b{color:#fff;font-variant-numeric:tabular-nums}
  ${P} .dm-sport-sessioni li.in-corso b .dm-sport-live{padding:3px 10px;font-size:.78em}
  ${P} .dm-sport-partita .dm-sport-cuore{--text:#0f172a;--text-dim:#64748b;color:#0f172a;background:#fff!important;border:0;box-shadow:0 8px 20px rgba(0,0,0,.18)}
  ${P} .dm-sport-partita.dm-sport-tocca:hover{filter:brightness(1.05)}
`;
}

function installStyles() {
  installStyle("dm-sport-section-style", foglioDelloSport(`#${SPORT_PAGE_ID}`));
}

/* Il foglio dei dettagli sta fuori dalla pagina, sopra tutto: ha i suoi
 * stili, gli stessi della pagina, e una scheda piu' larga. */
/* Il foglio del dettaglio a colori: una fascia in cima col colore di quello
 * che si guarda — le due squadre, il rosso della F1, il nero e rosso della
 * MotoGP, l'azzurro delle classifiche — e sotto un fondo tinto con le parti in
 * carte bianche, invece di un foglio bianco tutto uguale. */
function foglioColorato(F) {
  const S = `${F} .dm-foglio-scelta-scheda`;
  return `
    ${S}{--sp-a:#0ea5e9;--sp-b:#2563eb;--sp-fondo:#eef3f9;--sp-carta:#fff;--sp-filo:rgba(15,23,42,.07);
      padding:0!important;overflow:hidden!important;background:var(--sp-fondo)!important}
    html[data-theme="dark"] ${S}{--sp-fondo:#0b1220;--sp-carta:#131c2e;--sp-filo:rgba(148,163,184,.14)}
    ${S}[data-sport-tipo="f1"]{--sp-a:#e10600;--sp-b:#7a0400}
    ${S}[data-sport-tipo="motogp"]{--sp-a:#1f2937;--sp-b:#c8102e}
    ${S}[data-sport-tipo="calcio"]{--sp-a:var(--sq-casa,#2563eb);--sp-b:var(--sq-ospite,#f97316)}
    ${S}>strong{margin:0!important;padding:16px 18px 14px!important;font-size:16px!important;color:#fff!important;
      background:linear-gradient(120deg,var(--sp-a),var(--sp-b))!important;text-shadow:0 1px 2px rgba(0,0,0,.3)}
    ${S} .dm-foglio-scelta-corpo{padding:14px 14px 4px!important}
    ${S} .dm-foglio-scelta-chiudi{margin:6px 14px 14px!important;color:#fff!important;
      background:linear-gradient(120deg,var(--sp-a),var(--sp-b))!important;box-shadow:0 6px 16px rgba(15,23,42,.18)}

    /* La partita: il tabellone continua la fascia, coi colori delle squadre. */
    ${S} .dm-sport-tabellone{margin:-14px -14px 12px;padding:4px 14px 18px;color:#fff;
      background:linear-gradient(rgba(0,0,0,.16),rgba(0,0,0,.28)),linear-gradient(120deg,var(--sp-a),var(--sp-b))}
    ${S} .dm-sport-tabellone .dm-sport-lato strong,${S} .dm-sport-tabellone .dm-sport-gol,
    ${S} .dm-sport-tabellone .dm-sport-marcatori,${S} .dm-sport-tabellone .dm-sport-ora{color:#fff}
    ${S} .dm-sport-tabellone .dm-sport-gol i,${S} .dm-sport-tabellone .dm-sport-centro small,
    ${S} .dm-sport-tabellone .dm-sport-marcatori small{color:rgba(255,255,255,.78)}
    ${S} .dm-sport-tabellone .dm-sport-esito{color:#fff;background:rgba(255,255,255,.18);padding:3px 10px;border-radius:999px}
    ${S} .dm-sport-tabellone .dm-sport-stemma{border-radius:50%;box-shadow:0 0 0 3px rgba(255,255,255,.9),0 6px 16px rgba(0,0,0,.25)}
    ${S} .dm-sport-tabellone .dm-sport-stemma:not(.dm-sport-sigla){background:#fff}
    ${S} .dm-sport-info{margin:0 0 4px;padding:8px 12px;border:0;border-radius:14px;background:var(--sp-carta)}

    /* Le parti: carte sul fondo tinto. */
    ${S} .dm-sport-cronaca li{padding:6px 8px;border-radius:12px;background:var(--sp-carta)}
    ${S} .dm-sport-cronaca li[data-lato="casa"] .dm-sport-minuto{color:#fff;background:var(--sp-a)}
    ${S} .dm-sport-cronaca li[data-lato="ospite"] .dm-sport-minuto{color:#fff;background:var(--sp-b)}
    ${S} .dm-sport-statistiche{gap:8px}
    ${S} .dm-sport-statistiche li{padding:10px 12px;border-radius:12px;background:var(--sp-carta)}
    ${S} .dm-sport-statistiche li>i{height:8px;border-radius:4px;
      background:linear-gradient(90deg,var(--sp-a) calc(var(--q) - 1px),transparent calc(var(--q) - 1px),transparent calc(var(--q) + 1px),var(--sp-b) calc(var(--q) + 1px))}
    ${S} .dm-sport-formazione{overflow:hidden;padding:0 0 8px;border-radius:14px;background:var(--sp-carta)}
    ${S} .dm-sport-formazione-testa{padding:10px 12px;color:#fff;background:var(--sp-a)}
    ${S} .dm-sport-formazione:nth-child(2) .dm-sport-formazione-testa{background:var(--sp-b)}
    ${S} .dm-sport-formazione-testa strong{color:#fff}
    ${S} .dm-sport-formazione-testa small{color:#fff;background:rgba(255,255,255,.22)}
    ${S} .dm-sport-formazione ol,${S} .dm-sport-formazione h5{padding:0 10px}

    /* Le classifiche e le sessioni: una carta, con le righe a strisce. */
    ${S} .dm-sport-tabella{padding:8px;border-radius:16px;background:var(--sp-carta)}
    ${S} .dm-sport-tabella-testa{margin:-8px -8px 4px;padding:10px 14px 8px;border-radius:16px 16px 0 0;
      color:var(--sp-a);background:color-mix(in srgb,var(--sp-a) 10%,transparent)}
    ${S} .dm-sport-tabella>.dm-sport-pos:nth-of-type(even){background:color-mix(in srgb,var(--sp-a) 5%,transparent)}
    ${S} .dm-sport-avviso,${S} .dm-sport-vuoto{padding:14px;border-radius:14px;background:var(--sp-carta)}
  `;
}

function installaLoStileDelFoglio() {
  installStyle(
    "dm-sport-foglio-style",
    `${foglioDelloSport(".dm-sport-foglio")}
    .dm-sport-foglio .dm-foglio-scelta-scheda.dm-sport-largo{width:min(720px,100%)!important;max-height:90dvh!important}
    .dm-sport-foglio .dm-foglio-scelta-corpo{padding:0 2px}
    ${foglioColorato(".dm-sport-foglio")}`,
  );
}

export function installSport() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureSportPage();
  ensureSportTab();
  registraTitoloDiPagina(SPORT_PAGE_ID, titoloDellaPagina);
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmSport) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmSport = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener?.("visibilitychange", schedule);
  /* Un tocco su una partita, una sessione o una classifica, nella pagina o
   * nella finestra della Home, apre il suo dettaglio. */
  doc.addEventListener?.("click", alTocco);
  doc.addEventListener?.("keydown", alTocco);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installSport);
