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
  prossimaSessione,
  quantoManca,
  quotaDelPrimo,
  rigaDelPreferito,
  righeAttorno,
} from "../core/lo-sport.js";
import { creaLaMemoriaDeiLoghi } from "../core/loghi-degli-aggiornamenti.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
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
    dati.risultati = Array.isArray(risposta?.risultati) ? risposta.risultati : [];
    dati.arrivati = Date.now();
    dati.guasto = "";
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
      classe: "dm-sport-partita",
      attr: `style="--squadra:${esc(colore)}" data-dm-sport-partita="${esc(perche)}"`,
    },
  );
}

function ultimeMarkup(r) {
  const ultime = (r.ultime || []).slice(0, 5);
  if (!ultime.length) return "";
  const esiti = ESITI();
  const righe = ultime
    .map((p) => {
      const lati = latiDellaPartita(p, r.squadra.id);
      const mia = lati.mia.gol ?? 0;
      const loro = lati.loro.gol ?? 0;
      return `<li class="dm-sport-riga">
        <span class="dm-sport-quando">${esc(dataBreve(p.quando))}<small>${esc(p.competizione)}</small></span>
        ${stemma(lati.loro, 24)}
        <span class="dm-sport-avversaria">${esc(lati.loro.breve || lati.loro.nome)}<small>${esc(
          lati.inCasa ? t("in casa", "home") : t("fuori", "away"),
        )}</small></span>
        <b class="dm-sport-ris">${mia}–${loro}</b>
        <span class="dm-sport-pallino" data-esito="${esc(p.esito || "")}" title="${esc(esiti[p.esito]?.nome || "")}">${esc(
          esiti[p.esito]?.lettera || "·",
        )}</span>
      </li>`;
    })
    .join("");
  const forma = formaRecente(r)
    .map((e) => `<i data-esito="${e}" title="${esc(esiti[e]?.nome || "")}"></i>`)
    .join("");
  return schedaMarkup(
    `${esc(t("Ultime partite", "Last matches"))}<span class="dm-sport-forma" aria-label="${esc(t("Forma", "Form"))}">${forma}</span>`,
    `<ul class="dm-sport-righe">${righe}</ul>`,
  );
}

function classificaMarkup(r) {
  /* Le prime cinque, e la squadra con chi le sta accanto: anche chi e' primo
   * vede chi lo insegue. */
  const righe = righeAttorno(r.classifica, r.squadra.id, { primi: 5, accanto: 1 });
  if (!righe.length) return "";
  const corpo = righe
    .map((x) =>
      x.salto
        ? `<li class="dm-sport-salto" aria-hidden="true">⋯</li>`
        : `<li class="dm-sport-pos${x.mia ? " mia" : ""}">
          <span class="dm-sport-num">${x.posizione}</span>${stemma(x, 22)}
          <span class="dm-sport-nome">${esc(x.breve || x.nome)}</span>
          <span class="dm-sport-g">${x.giocate}</span>
          <b>${x.punti}</b>
        </li>`,
    )
    .join("");
  return schedaMarkup(
    `${esc(r.campionato?.nome || t("Classifica", "Table"))}<span class="dm-sport-intesta"><span>${esc(t("G", "P"))}</span><span>${esc(
      t("Pt", "Pts"),
    )}</span></span>`,
    `<ol class="dm-sport-classifica">${corpo}</ol>`,
  );
}

function calcioMarkup(r, seguito, adesso) {
  const pos = r.posizione;
  const sotto = pos
    ? `${esc(r.campionato?.nome || "")} · <b>${conN(t("{n}°", "#{n}"), pos.posizione)}</b> · ${conN(esc(t("{n} punti", "{n} pts")), pos.punti)}`
    : esc(r.campionato?.nome || "");
  return `<section class="dm-sport-blocco" data-dm-sport-blocco="${esc(chiaveDelSeguito(seguito))}">
      <div class="dm-sport-testa">${stemma(r.squadra, 30)}<h3 class="dm-sport-titolo"><span>${esc(
        r.squadra.nome || seguito.nome,
      )}</span><small>${sotto}</small></h3></div>
      <div class="dm-sport-griglia dm-sport-calcio">
        ${partitaGrande(r, seguito, adesso)}
        ${ultimeMarkup(r)}
        ${classificaMarkup(r)}
      </div>
    </section>`;
}

/* ── Formula 1 e MotoGP ───────────────────────────────────────────────── */

function prossimoGpMarkup(r, adesso) {
  const p = r.prossima;
  if (!p) return "";
  const sessioni = p.sessioni || [];
  const prossima = prossimaSessione(r, adesso);
  const nomi = SIGLE_DELLE_SESSIONI();
  const gara = sessioni.find((s) => s.sigla === "G");
  const dataEvento =
    r.tipo === "f1" ? giornoBreve(p.quando).replace(/\s\d+:\d+$/, "") : dalAl(p.dal, p.al);
  const quante = r.gare
    ? `${esc(t("Gara", "Round"))} ${p.giro || ""}${p.giro ? `/${r.gare}` : ""}`
    : "";
  return schedaMarkup(
    "",
    `<div class="dm-sport-partita-testa"><span>${esc(t("Prossimo gran premio", "Next grand prix"))}</span><span>${quante}</span></div>
      <div class="dm-sport-gp">
        <strong>${esc(nomeBreveDelGp(p.nome) || p.paese)}</strong>
        <small>${esc([p.circuito, p.paese].filter(Boolean).join(" · "))}</small>
        <span class="dm-sport-gp-data">${esc(dataEvento)}</span>
      </div>
      ${
        sessioni.length
          ? `<ul class="dm-sport-sessioni">${sessioni
              .map(
                (s) =>
                  `<li class="${s === prossima ? "prossima" : Date.parse(s.quando) + 2 * 3600_000 < adesso ? "fatta" : ""}"><span>${esc(
                    nomi[s.sigla] || s.sigla,
                  )}</span><b>${esc(quandoInParole(s.quando, adesso))}</b></li>`,
              )
              .join("")}</ul>`
          : ""
      }
      ${
        gara && Date.parse(gara.quando) > adesso
          ? `<div class="dm-sport-partita-piede"><span class="dm-sport-manca">${esc(t("Gara", "Race"))} ${esc(
              mancaInParole(gara.quando, adesso),
            )}</span></div>`
          : ""
      }`,
    {
      classe: "dm-sport-partita dm-sport-gara-prossima",
      attr: `style="--squadra:${r.tipo === "f1" ? "#e10600" : "#111827"}"`,
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
        <small>${esc(r.tipo === "f1" ? x.scuderia : x.moto)}</small>
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
        <span class="dm-sport-g">${esc(r.tipo === "f1" ? x.scuderia : x.moto)}</span>
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
  return schedaMarkup(
    titolo,
    `<div class="dm-sport-podio">${podioMarkup}</div><ol class="dm-sport-classifica">${resto}${mioFuori}</ol>`,
  );
}

function classificaPilotiMarkup(r, seguito) {
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
      <span class="dm-sport-nome">${esc(nomePilota(r, x))}<small>${esc(r.tipo === "f1" ? x.scuderia : x.moto)}</small></span>
      <b>${x.punti}</b>
    </li>`;
  return schedaMarkup(
    esc(
      r.tipo === "f1"
        ? t("Classifica piloti", "Drivers' standings")
        : t("Classifica piloti", "Riders' standings"),
    ),
    `<ol class="dm-sport-classifica">${prime.map(riga).join("")}${mio ? `<li class="dm-sport-salto" aria-hidden="true">⋯</li>${riga(mio)}` : ""}</ol>`,
  );
}

function costruttoriMarkup(r) {
  const righe = quotaDelPrimo(r.costruttori || []).slice(0, 6);
  if (!righe.length) return "";
  return schedaMarkup(
    esc(t("Costruttori", "Constructors")),
    `<ol class="dm-sport-classifica">${righe
      .map(
        (
          x,
        ) => `<li class="dm-sport-pos dm-sport-barra" style="--q:${(x.quota * 100).toFixed(1)}%;--c:${COLORI_F1[x.id] || "#64748b"}">
        <span class="dm-sport-num">${x.posizione}</span><span class="dm-sport-nome">${esc(x.nome)}</span><b>${x.punti}</b>
      </li>`,
      )
      .join("")}</ol>`,
  );
}

function corseMarkup(r, seguito, adesso) {
  const preferito = rigaDelPreferito(r.piloti, seguito.preferito);
  const sotto = [
    r.stagione ? conN(esc(t("Stagione {n}", "Season {n}")), r.stagione) : "",
    preferito
      ? `${esc(nomePilota(r, preferito))} <b>${conN(t("{n}°", "#{n}"), preferito.posizione)}</b> · ${conN(esc(t("{n} punti", "{n} pts")), preferito.punti)}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<section class="dm-sport-blocco" data-dm-sport-blocco="${esc(r.tipo)}">
      <div class="dm-sport-testa">${titoloDelBlocco(r.tipo, nomeDelTipo(r.tipo), sotto)}</div>
      <div class="dm-sport-griglia dm-sport-corse" data-quante="${r.tipo === "f1" ? 4 : 3}">
        ${prossimoGpMarkup(r, adesso)}
        ${ultimaGaraMarkup(r, seguito)}
        ${classificaPilotiMarkup(r, seguito)}
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
      return `<section class="dm-sport-blocco"><div class="dm-sport-testa">${titoloDelBlocco(r.tipo, nomeDelTipo(r.tipo), "", "finestra")}</div>${prossimoGpMarkup(
        r,
        adesso,
      )}${
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
      if (r.tipo === "calcio") return calcioMarkup(r, seguito, adesso);
      return corseMarkup(r, seguito, adesso);
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
  ${P} .dm-sport-corse{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,.9fr)}
  @media(min-width:1201px){
    ${P} .dm-sport-corse[data-quante="3"]{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)}
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
  ${P} .dm-sport-campo{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px}
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
  ${P} .dm-sport-gp-data{font-size:13px;font-weight:900;color:var(--text,#0f172a)}
  ${P} .dm-sport-sessioni{display:grid;gap:4px;margin:0;padding:0;list-style:none}
  ${P} .dm-sport-sessioni li{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;border-radius:10px;font-size:12.5px;
    color:var(--text-dim,#64748b);background:var(--surface-2,#f8fafc)}
  ${P} .dm-sport-sessioni li b{color:var(--text,#0f172a);font-weight:800;white-space:nowrap}
  ${P} .dm-sport-sessioni li.fatta{opacity:.5}
  ${P} .dm-sport-sessioni li.prossima{background:color-mix(in srgb,var(--squadra) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--squadra) 35%,transparent)}
  ${P} .dm-sport-sessioni li.prossima span{color:var(--text,#0f172a);font-weight:900}

  /* Gli stemmi */
  ${P} .dm-sport-stemma{display:inline-grid;place-items:center;flex:0 0 auto;width:var(--m);height:var(--m)}
  ${P} .dm-sport-stemma img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(15,23,42,.18))}
  ${P} .dm-sport-sigla{border-radius:50%;background:var(--c);color:#fff;font-size:calc(var(--m) * .32);font-weight:900;letter-spacing:.3px}

  /* Le righe */
  ${P} .dm-sport-righe,${P} .dm-sport-classifica{display:grid;gap:2px;margin:0;padding:0;list-style:none}
  ${P} .dm-sport-riga{display:grid;grid-template-columns:52px 24px minmax(0,1fr) auto 24px;align-items:center;gap:8px;
    padding:7px 4px;border-bottom:1px solid var(--card-border,#eef2f7)}
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
  ${P} .dm-sport-barra::after{content:"";position:absolute;left:36px;right:6px;bottom:2px;height:3px;border-radius:2px;
    background:linear-gradient(90deg,var(--c) var(--q),color-mix(in srgb,var(--text,#0f172a) 7%,transparent) var(--q))}

  /* Il podio */
  ${P} .dm-sport-podio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:8px;margin:0 0 10px}
  ${P} .dm-sport-gradino{display:grid;justify-items:center;gap:2px;text-align:center;min-width:0}
  ${P} .dm-sport-gradino strong{font-size:13.5px;font-weight:900;color:var(--text,#0f172a);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-sport-gradino strong.mio{color:#0284c7}
  ${P} .dm-sport-gradino small{font-size:10.5px;font-weight:700;color:var(--text-dim,#94a3b8);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  ${P} .dm-sport-pilota-num{font-family:'Oswald',system-ui,sans-serif;font-size:13px;font-weight:700;color:var(--c)}
  ${P} .dm-sport-scalino{display:grid;place-items:center;width:100%;margin-top:6px;border-radius:12px 12px 4px 4px;
    font-family:'Oswald',system-ui,sans-serif;font-size:22px;font-weight:700;color:#fff;
    background:linear-gradient(180deg,color-mix(in srgb,var(--c) 85%,#fff),var(--c))}
  ${P} .dm-sport-gradino[data-pos="1"] .dm-sport-scalino{height:62px}
  ${P} .dm-sport-gradino[data-pos="2"] .dm-sport-scalino{height:46px}
  ${P} .dm-sport-gradino[data-pos="3"] .dm-sport-scalino{height:34px}

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
    ${P} .dm-sport-gol{font-size:38px}
    ${P} .dm-sport-ora{font-size:30px}
    ${P} .dm-sport-gp strong{font-size:28px}
    ${P} .dm-sport-wrap{gap:22px}
  }`;
}

function installStyles() {
  installStyle("dm-sport-section-style", foglioDelloSport(`#${SPORT_PAGE_ID}`));
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
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installSport);
