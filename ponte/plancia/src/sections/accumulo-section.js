/* Le parole e il disegno dell'accumulo (#117).
 *
 * «Poter aggiungere tutte le entità dei BMS, per esempio ho due BMS JK con
 *  stati di carica, stati di salute, correnti e tensioni varie.»
 *
 * L'accumulo non ha una voce sua nella barra: sta dentro Energia, nella
 * linguetta «Batterie» accanto a Istantanea e Giornaliera — è la variante che
 * è stata scelta guardando i due render. Qui c'è quello che la linguetta e la
 * tessera in Home dicono, fatto coi pezzi delle altre pagine:
 *
 *   · in cima la risposta grande dell'Acquario, «In questo momento»: in
 *     carica, in scarica o a riposo, la carica di tutto l'accumulo, quanto
 *     manca al pieno o al vuoto, e l'avviso quando un pacco ha le celle da
 *     bilanciare;
 *   · sotto una scheda della Piscina per pacco: l'anello della carica, le
 *     letture del BMS, le celle una per una in una striscia di barre, e lo
 *     squilibrio fra le celle sulla forcella.
 *
 * Il modulo non si installa: disegna e basta. La linguetta la monta
 * `accumulo-in-energia-section.js`, che sa leggere la pagina Energia, e la
 * tessera la chiede la Home. Stare qui, senza la Home dentro, è quello che
 * lascia alla Home chiedere la tessera senza fare un giro.
 */
import {
  CHIAVE_ACCUMULO,
  accumuloConfigurato,
  accumuloDiCasa,
  comeStaLAccumulo,
} from "../core/l-accumulo-di-casa.js";
import { forcellaMarkup } from "./pool-irrigation-scene-section.js";
import { allStates, esc, formatNumber, readJson, t } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

/* La chiave dell'accumulo: la linguetta in Energia, la scheda del Config e la
 * tessera in Home si chiamano tutte così. */
export const ACCUMULO_TAB = "accumulo";

/* La richiesta di aprire la linguetta: la manda il tasto «Apri sezione» della
 * tessera in Home prima di premere la voce Energia, e la raccoglie chi monta
 * la linguetta. Il nome sta qui perché lo conoscono tutti e due senza
 * conoscersi fra loro. */
export const EVENTO_APRI_ACCUMULO = "dashboardmodern:accumulo-richiesto";

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_ACCUMULO, {}) || {};
}

/** Se c'è almeno un pacco dichiarato. */
export function ciSonoPacchi() {
  return accumuloConfigurato(configurazione());
}

/**
 * Come sta l'accumulo adesso: i pacchi letti e il giudizio di tutti insieme.
 * `dentro` toglie i pacchi che la tessera in Home non vuole; `casa` sono le
 * letture della pagina Energia — il sole, la rete, la casa — che dicono da
 * dove arriva la carica.
 */
export function vistaDellAccumulo(states = allStates(), { dentro, casa = {} } = {}) {
  const pacchi = accumuloDiCasa(states, configurazione(), (entity) =>
    nomeDaHomeAssistant(entity, states),
  ).filter((pacco) => typeof dentro !== "function" || dentro(pacco.entity));
  if (!pacchi.length) return null;
  return { pacchi, come: comeStaLAccumulo(pacchi, casa) };
}

/* ── le parole ────────────────────────────────────────────────────────── */

const SPAZIO = " ";

const cifre = (valore, quante) => formatNumber(valore, quante);

/** La potenza, in watt sotto il chilowatt e in kW sopra. */
export function potenzaInParole(watt) {
  if (watt === null || watt === undefined) return "—";
  const assoluta = Math.abs(watt);
  if (assoluta >= 1000) return `${cifre(assoluta / 1000, 2)}${SPAZIO}kW`;
  return `${cifre(assoluta, 0)}${SPAZIO}W`;
}

/**
 * Quanto manca, a parole: i minuti fino all'ora, poi ore e minuti a cinque
 * minuti per volta — «2 h 10» —, e oltre i due giorni i giorni. Un «fra 37
 * ore e 12 minuti» è più preciso di quello che la corrente di adesso sa dire.
 */
export function tempoInParole(minuti) {
  if (minuti === null || minuti === undefined) return "";
  if (minuti < 60) return `${Math.max(1, Math.round(minuti))}${SPAZIO}min`;
  if (minuti >= 48 * 60) {
    const giorni = Math.round(minuti / (24 * 60));
    return t(`${giorni} giorni`, `${giorni} days`);
  }
  const arrotondati = Math.round(minuti / 5) * 5;
  const ore = Math.floor(arrotondati / 60);
  const resto = arrotondati % 60;
  return resto ? `${ore}${SPAZIO}h${SPAZIO}${String(resto).padStart(2, "0")}` : `${ore}${SPAZIO}h`;
}

/** Il verso di un pacco o di tutto l'accumulo, come titolo. */
export function versoInParole(verso) {
  if (verso === "carica") return t("In carica", "Charging");
  if (verso === "scarica") return t("In scarica", "Discharging");
  if (verso === "riposo") return t("A riposo", "Idle");
  return t("Nessuna lettura", "No reading");
}

/* Da dove arriva la carica, o dove va. */
function daDoveInParole(dove) {
  if (dove === "solare") return t("dal fotovoltaico", "from solar");
  if (dove === "rete") return t("dalla rete", "from the grid");
  if (dove === "casa") return t("verso la casa", "to the house");
  return "";
}

/* Quanto manca, nella frase: al pieno o al vuoto. */
function fineInParole(verso, minuti) {
  const quanto = tempoInParole(minuti);
  if (!quanto) return "";
  return verso === "carica"
    ? t(`piena fra ${quanto}`, `full in ${quanto}`)
    : t(`vuota fra ${quanto}`, `empty in ${quanto}`);
}

/** La marca del BMS. */
export function tipoInParole(tipo) {
  if (tipo === "jk") return "JK BMS";
  if (tipo === "jbd") return "JBD BMS";
  if (tipo === "daly") return "Daly BMS";
  return "BMS";
}

function quantiPacchi(quanti) {
  return quanti === 1 ? t("1 pacco", "1 pack") : t(`${quanti} pacchi`, `${quanti} packs`);
}

function quanteCelle(quante) {
  return t(`${quante} celle`, `${quante} cells`);
}

/* «2 pacchi JK BMS da 16 celle», quando sono tutti uguali; «2 pacchi»
 * altrimenti. */
function pacchiInParole(pacchi) {
  const quanti = quantiPacchi(pacchi.length);
  const tipi = new Set(pacchi.map((pacco) => pacco.tipo));
  const celle = new Set(pacchi.map((pacco) => pacco.celle.length));
  if (tipi.size !== 1 || tipi.has("altro")) return quanti;
  const [tipo] = tipi;
  const [numero] = celle;
  if (celle.size !== 1 || !numero) return `${quanti}${SPAZIO}${tipoInParole(tipo)}`;
  return t(
    `${quanti} ${tipoInParole(tipo)} da ${numero} celle`,
    `${quanti} of ${tipoInParole(tipo)}, ${numero} cells each`,
  );
}

function deltaInParole(delta) {
  return `Δ${SPAZIO}${cifre(delta, 0)}${SPAZIO}mV`;
}

function quantiMuti(quanti) {
  return quanti === 1
    ? t("1 non risponde", "1 not answering")
    : `${quanti} ${t("non rispondono", "not answering")}`;
}

/**
 * La risposta grande in cima: `{ stato, grande, soc, nomi, sotto, avvisi }`.
 *
 * Il titolo è il verso di tutto l'accumulo, e accanto la carica. Sotto quanto
 * sta passando e da dove, e quanto manca; poi l'energia dentro su quella che
 * ci sta, e quali pacchi sono. Un pacco con le celle da bilanciare non cambia
 * il titolo — la casa sta caricando lo stesso — ma si prende una riga sua.
 */
export function testaDellAccumulo(vista) {
  const { come, pacchi } = vista;
  const avvisi = come.sbilanciati.map((pacco) =>
    t(
      `${pacco.name}: celle da bilanciare (${deltaInParole(pacco.delta)})`,
      `${pacco.name}: cells need balancing (${deltaInParole(pacco.delta)})`,
    ),
  );
  if (come.stato === "muti")
    return {
      stato: "muti",
      grande: t("Nessun pacco risponde", "No pack answering"),
      soc: null,
      nomi: "",
      sotto: pacchiInParole(pacchi),
      avvisi: [],
    };
  const passa =
    come.verso === "carica" || come.verso === "scarica"
      ? [potenzaInParole(come.potenza), daDoveInParole(come.daDove)].filter(Boolean).join(" ")
      : "";
  const energia =
    come.energiaKwh !== null && come.capacitaKwh !== null
      ? t(
          `${cifre(come.energiaKwh, 1)} di ${cifre(come.capacitaKwh, 1)} kWh`,
          `${cifre(come.energiaKwh, 1)} of ${cifre(come.capacitaKwh, 1)} kWh`,
        )
      : come.energiaKwh !== null
        ? `${cifre(come.energiaKwh, 1)}${SPAZIO}kWh`
        : "";
  return {
    stato: come.verso || "riposo",
    grande: versoInParole(come.verso),
    soc: come.soc,
    nomi: [passa, fineInParole(come.verso, come.minuti)].filter(Boolean).join(" · "),
    sotto: [energia, pacchiInParole(pacchi), come.muti.length ? quantiMuti(come.muti.length) : ""]
      .filter(Boolean)
      .join(" · "),
    avvisi,
  };
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function percento(valore) {
  return Math.max(0, Math.min(100, Math.round(valore ?? 0)));
}

function testaMarkup(testa) {
  const soc =
    testa.soc === null
      ? ""
      : `<b class="dm-accu-soc">${esc(String(percento(testa.soc)))}<i>%</i></b>`;
  return `<div class="dm-accu-testa" data-stato="${esc(testa.stato)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <div class="dm-accu-testa-riga"><strong>${esc(testa.grande)}</strong>${soc}</div>
    ${testa.soc === null ? "" : `<span class="dm-accu-barra" style="--pct:${percento(testa.soc)}"><i></i></span>`}
    ${testa.nomi ? `<span class="dm-accu-nomi">${esc(testa.nomi)}</span>` : ""}
    ${testa.sotto ? `<span class="dm-accu-sotto">${esc(testa.sotto)}</span>` : ""}
    ${testa.avvisi
      .map(
        (avviso) =>
          `<span class="dm-accu-avviso" data-dm-accu-avviso><i aria-hidden="true">⚠️</i><span>${esc(avviso)}</span></span>`,
      )
      .join("")}
  </div>`;
}

/* Il segno della corrente, detto: «+12,6 A» e sotto «in carica». */
function correnteInParole(corrente) {
  const segno = corrente > 0 ? "+" : corrente < 0 ? "−" : "";
  return `${segno}${cifre(Math.abs(corrente), 1)}${SPAZIO}A`;
}

/* I gradi con le cifre che il sensore dà: la sonda del pacco a 27,1, quella
 * dei MOS spesso intera, e «31,0°» direbbe una precisione che non c'è. */
function gradi(valore, unita) {
  return `${cifre(valore, Number.isInteger(valore) ? 0 : 1)}°${/F/.test(unita) ? "F" : ""}`;
}

/* Le letture del BMS, sei caselle come nel render: quelle che il pacco non
 * pubblica non ci sono, invece di esserci con un trattino. */
function datiDelPacco(pacco) {
  const dati = [];
  if (pacco.soh !== null)
    dati.push(["soh", "SoH", `${cifre(pacco.soh, 0)}%`, t("salute", "health")]);
  if (pacco.tensione !== null)
    dati.push(["tensione", t("Tensione", "Voltage"), `${cifre(pacco.tensione, 2)}${SPAZIO}V`, ""]);
  if (pacco.corrente !== null)
    dati.push([
      "corrente",
      t("Corrente", "Current"),
      correnteInParole(pacco.corrente),
      pacco.verso === "carica"
        ? t("in carica", "charging")
        : pacco.verso === "scarica"
          ? t("in scarica", "discharging")
          : t("a riposo", "idle"),
    ]);
  if (pacco.potenza !== null)
    dati.push(["potenza", t("Potenza", "Power"), potenzaInParole(pacco.potenza), ""]);
  if (pacco.temperatura !== null || pacco.mos !== null)
    dati.push([
      "temperatura",
      t("Temperatura", "Temperature"),
      pacco.temperatura !== null
        ? gradi(pacco.temperatura, pacco.unitaTemperatura)
        : gradi(pacco.mos, pacco.unitaTemperatura),
      pacco.temperatura !== null && pacco.mos !== null
        ? `MOS ${gradi(pacco.mos, pacco.unitaTemperatura)}`
        : pacco.temperatura === null
          ? "MOS"
          : "",
    ]);
  if (pacco.cicli !== null) dati.push(["cicli", t("Cicli", "Cycles"), cifre(pacco.cicli, 0), ""]);
  return dati
    .map(
      ([chiave, nome, valore, sotto]) =>
        `<div class="dm-accu-dato" data-dm-accu-dato="${chiave}"><span>${esc(nome)}</span><b>${esc(valore)}</b>${sotto ? `<small>${esc(sotto)}</small>` : ""}</div>`,
    )
    .join("");
}

/* La striscia delle celle: una barra per cella, alta quanto la sua tensione
 * fra la più bassa e la più alta del pacco. Guardata sulla scala intera — da
 * zero a 3,6 volt — sarebbero sedici barre uguali: è la differenza che si
 * vuole vedere, e la scala la ingrandisce. La più bassa è ambra, la più alta
 * verde. */
function celleMarkup(pacco) {
  if (!pacco.celle.length || !pacco.minima) return "";
  const basso = pacco.minima.volt - 0.004;
  const alto = pacco.massima.volt + 0.002;
  const campo = alto - basso || 1;
  const barre = pacco.celle
    .map((cella) => {
      const tipo =
        cella.volt === null
          ? "muta"
          : cella === pacco.minima
            ? "min"
            : cella === pacco.massima
              ? "max"
              : "";
      const altezza = cella.volt === null ? 0 : Math.max(8, ((cella.volt - basso) / campo) * 100);
      const titolo =
        cella.volt === null
          ? t(`Cella ${cella.numero} · non risponde`, `Cell ${cella.numero} · not answering`)
          : t(
              `Cella ${cella.numero} · ${cifre(cella.volt, 3)} V`,
              `Cell ${cella.numero} · ${cifre(cella.volt, 3)} V`,
            );
      return `<span class="dm-accu-cella" data-tipo="${tipo}" title="${esc(titolo)}"><i style="height:${altezza.toFixed(0)}%"></i><em>${cella.numero}</em></span>`;
    })
    .join("");
  const media = pacco.media === null ? "" : `${cifre(pacco.media, 3)}${SPAZIO}V`;
  return `<div class="dm-accu-sez">${esc(t("Celle", "Cells"))} <small>${esc(
    [quanteCelle(pacco.celle.length), media ? t(`media ${media}`, `average ${media}`) : ""]
      .filter(Boolean)
      .join(" · "),
  )}</small></div>
    <div class="dm-accu-celle" style="--celle:${pacco.celle.length}">${barre}</div>
    <div class="dm-accu-celle-leg">
      <span data-tipo="min"><i></i>${esc(
        t(
          `min ${cifre(pacco.minima.volt, 3)} V · cella ${pacco.minima.numero}`,
          `min ${cifre(pacco.minima.volt, 3)} V · cell ${pacco.minima.numero}`,
        ),
      )}</span>
      <span data-tipo="max"><i></i>${esc(
        t(
          `max ${cifre(pacco.massima.volt, 3)} V · cella ${pacco.massima.numero}`,
          `max ${cifre(pacco.massima.volt, 3)} V · cell ${pacco.massima.numero}`,
        ),
      )}</span>
    </div>`;
}

/* Lo squilibrio sulla forcella della Piscina: la fascia buona va da zero alla
 * soglia del pacco. */
function deltaMarkup(pacco) {
  if (pacco.delta === null) return "";
  const soglia = `${cifre(pacco.soglia, 0)}${SPAZIO}mV`;
  return forcellaMarkup({
    chiave: `accu-delta-${pacco.entity.replace(/[^a-z0-9]+/gi, "-")}`,
    etichetta: t("Squilibrio fra le celle", "Cell imbalance"),
    valore: pacco.delta,
    testo: deltaInParole(pacco.delta),
    minimo: 0,
    massimo: pacco.soglia,
    verdetto: pacco.sbilanciato ? "high" : "ok",
    parola: pacco.sbilanciato
      ? t("da bilanciare", "needs balancing")
      : t("nella norma", "in range"),
    forchetta: pacco.sbilanciato
      ? t(`oltre la soglia di ${soglia}`, `above the ${soglia} threshold`)
      : t(`ideale sotto ${soglia}`, `ideal below ${soglia}`),
  });
}

function pastigliaDelPacco(pacco) {
  if (pacco.muto)
    return `<span class="dm-pool-badge">${esc(t("Non risponde", "Not answering"))}</span>`;
  if (pacco.sbilanciato)
    return `<span class="dm-pool-badge" data-avviso="true">${esc(t("Da bilanciare", "Needs balancing"))}</span>`;
  return `<span class="dm-pool-badge" data-on="${pacco.verso === "carica"}" data-verso="${esc(pacco.verso || "")}">${esc(versoInParole(pacco.verso))}</span>`;
}

function paccoMarkup(pacco) {
  const marca = [
    tipoInParole(pacco.tipo),
    pacco.celle.length ? quanteCelle(pacco.celle.length) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const stato = pacco.muto ? "muto" : pacco.sbilanciato ? "attenzione" : "bene";
  return `<article class="dm-pool-card dm-accu-pacco" data-stato="${stato}" data-dm-accu-pacco="${esc(pacco.entity)}">
    <div class="dm-pool-card-head">
      <span class="dm-pool-card-title"><i aria-hidden="true">🔋</i><span class="dm-accu-tit"><span>${esc(pacco.name)}</span><small class="dm-accu-marca">${esc(marca)}</small></span></span>
      ${pastigliaDelPacco(pacco)}
    </div>
    <div class="dm-pool-filtration-body dm-accu-corpo">
      <div class="dm-ring dm-accu-ring" style="--pct:${percento(pacco.soc)}">
        <span class="dm-ring-core"><b>${esc(pacco.soc === null ? "—" : `${percento(pacco.soc)}%`)}</b><i>${esc(t("carica", "charge"))}</i></span>
      </div>
      <div class="dm-accu-dati">${datiDelPacco(pacco)}</div>
    </div>
    ${celleMarkup(pacco)}
    ${deltaMarkup(pacco)}
  </article>`;
}

function vuotoMarkup() {
  return `<div class="dm-accu-vuoto">
    <strong>${esc(t("Nessun pacco configurato", "No battery pack configured"))}</strong>
    <span>${esc(
      t(
        "I pacchi compaiono qui quando li aggiungi nella scheda Batterie della famiglia Energia, in configurazione: lo stato di carica, le tensioni, le celle.",
        "Packs show up here once you add them in the Batteries tab under Energy in the settings: state of charge, voltages, cells.",
      ),
    )}</span>
  </div>`;
}

/** La linguetta intera, da quello che si sa adesso. */
export function paginaDellAccumulo(vista) {
  if (!vista) return vuotoMarkup();
  return `${testaMarkup(testaDellAccumulo(vista))}
    <div class="dm-pool-cards dm-accu-pacchi">${vista.pacchi.map(paccoMarkup).join("")}</div>`;
}

/* ── la tessera in Home ───────────────────────────────────────────────── */

/**
 * La tessera in Home, dalla stessa vista della linguetta: la carica di tutto
 * l'accumulo col suo anello, e sotto il verso, la potenza e quanto manca.
 * Chiede attenzione quando un pacco ha le celle da bilanciare, come la
 * batteria da cambiare: è l'unica cosa dell'accumulo che vuole una mano.
 */
export function tesseraDellAccumulo(vista) {
  if (!vista) return null;
  const { come, pacchi } = vista;
  const daGuardare = come.sbilanciati.length > 0;
  const passa =
    come.verso === "carica" || come.verso === "scarica" ? potenzaInParole(come.potenza) : "";
  return {
    key: ACCUMULO_TAB,
    accent: daGuardare ? "#f59e0b" : "#16a34a",
    icon: "battery",
    label: t("Accumulo", "Battery storage"),
    value: come.soc === null ? "—" : `${percento(come.soc)}%`,
    caption: [
      [versoInParole(come.verso), passa].filter(Boolean).join(" "),
      fineInParole(come.verso, come.minuti),
      ...come.sbilanciati.map((pacco) => `${pacco.name} ${deltaInParole(pacco.delta)}`),
    ]
      .filter(Boolean)
      .join(" · "),
    ring: come.soc === null ? null : percento(come.soc),
    attiva: daGuardare,
    alert: daGuardare,
    rows: pacchi.map((pacco) => ({
      entity: pacco.entity,
      name: pacco.name,
      glyph: "🔋",
      value: pacco.muto
        ? t("Non risponde", "Not answering")
        : [
            `${percento(pacco.soc)}%`,
            pacco.delta !== null ? deltaInParole(pacco.delta) : versoInParole(pacco.verso),
          ].join(" · "),
      tono: pacco.muto ? "" : pacco.sbilanciato ? "allarme" : "quiete",
    })),
  };
}
