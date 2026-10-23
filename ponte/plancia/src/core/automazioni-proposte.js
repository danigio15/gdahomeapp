/* Le proposte: «Suggerite per la tua casa ✨».
 *
 * Chi apre le Automazioni la prima volta trova una pagina vuota e una domanda
 * — «cosa vuoi che faccia la casa?» — a cui la casa stessa sa rispondere
 * meglio di chiunque: sa che in Corridoio ci sono un sensore di movimento e
 * una luce, che la presa della Lavatrice misura la potenza, che la luce del
 * soggiorno si accende quasi ogni sera alle sette.
 *
 * Niente intelligenza su un server e niente dati fuori casa: qui ci sono
 * regole scritte a mano sui dispositivi, e conti fatti sulla storia che Home
 * Assistant tiene gia' (il Recorder), letta dall'add-on con la sua
 * connessione (`ponte/src/automazioni.js`). Questo file e' puro — niente
 * filo, niente orologio — e lo leggono tutti e due: il ponte per calcolare
 * le proposte, la plancia per le prove e per riconoscere quelle che ci sono
 * gia'.
 *
 * Ogni proposta ha:
 *  - un `id` stabile, fatto delle entita' che usa: «No, grazie» la scarta per
 *    sempre, e la stessa proposta domani ha lo stesso id;
 *  - una `chiave` che dice di che regola e', e i dati per raccontarla
 *    (l'area, i nomi, gli orari): le parole le mette la plancia, nella lingua
 *    di chi guarda;
 *  - le `cose` che usa (quale sensore, quale luce), e da quelle
 *    l'`automazione` gia' compilata nella forma di `cd_automazioni`, senza
 *    id e senza nome: «Crea» la apre nell'editor, e finche' non si salva non
 *    parte niente.
 *
 * Il motore e il salvataggio sono due cose: le regole qui sotto dicono solo
 * *che cosa* proporre (la `chiave`, le `cose`, i `dati`), e
 * `automazioneDellaProposta` lo scrive nella forma in cui si salva oggi.
 * Il giorno che le automazioni si salvassero altrove — una vera automazione
 * di Home Assistant — si cambia quella funzione sola, e le regole restano.
 */

import {
  automazioniPulite,
  dominioDi,
  minutiDi,
  oraDiMinuti,
  soleDelGiorno,
} from "./automazioni.js";

const pulito = (v) => String(v ?? "").trim();
const MINUTO = 60_000;
const GIORNO = 24 * 60 * MINUTO;

/** Quanta storia si guarda, e quante entita' al piu'. */
export const GIORNI_DI_STORIA = 21;
export const ENTITA_GUARDATE = 40;
/* Un'abitudine e' un orario che torna almeno sei giorni su dieci, entro
 * venti minuti. */
export const QUOTA_ABITUDINE = 0.6;
export const FINESTRA_ABITUDINE = 20;

const tutti = [true, true, true, true, true, true, true];
const feriali = [true, true, true, true, true, false, false];
const festivi = [false, false, false, false, false, true, true];

const nomeDi = (e) => pulito(e?.nome) || pulito(e?.id).split(".").slice(1).join(" ");
const minuscolo = (v) => pulito(v).toLowerCase();

/* Le cose di casa, riconosciute come le riconosce Home Assistant: la classe
 * prima di tutto, il nome solo dove una classe non c'e'. */
const eMovimento = (e) =>
  dominioDi(e.id) === "binary_sensor" && ["motion", "occupancy", "presence"].includes(e.classe);
const eFinestra = (e) =>
  dominioDi(e.id) === "binary_sensor" && ["window", "door", "opening"].includes(e.classe);
const eLuce = (e) => dominioDi(e.id) === "light";
const eClima = (e) => dominioDi(e.id) === "climate";
const eTapparella = (e) =>
  dominioDi(e.id) === "cover" && !["garage", "gate", "door"].includes(e.classe);
const eUmidita = (e) => dominioDi(e.id) === "sensor" && e.classe === "humidity";
const ASPIRATORE = /aspirat|ventil|estratt|fan\b|exhaust|vmc/i;
const eAspiratore = (e) =>
  dominioDi(e.id) === "fan" || (dominioDi(e.id) === "switch" && ASPIRATORE.test(nomeDi(e)));
const ePotenza = (e) =>
  dominioDi(e.id) === "sensor" && (e.classe === "power" || /^k?w$/i.test(pulito(e.unita)));
const ELETTRODOMESTICO =
  /lavatric|washing|washer|lavastovigl|dishwash|asciugatric|dryer|lavasciuga/i;
const eAntifurto = (e) => dominioDi(e.id) === "alarm_control_panel";
const ePersona = (e) => dominioDi(e.id) === "person";

/* Un id corto e stabile: la regola e le entita', sempre nello stesso ordine. */
const idDi = (regola, ...entita) =>
  `${regola}:${entita.flat().map(pulito).filter(Boolean).sort().join("|")}`.slice(0, 200);

function perArea(entita) {
  const aree = new Map();
  for (const e of entita) {
    if (!e.area) continue;
    if (!aree.has(e.area)) aree.set(e.area, []);
    aree.get(e.area).push(e);
  }
  return aree;
}

/**
 * Le proposte dai dispositivi. `entita`: `[{id, nome, area, classe, unita}]`,
 * tutte quelle di Home Assistant che contano (le interne e le nascoste le
 * lascia fuori chi chiama).
 */
export function proposteDaiDispositivi({ entita = [] } = {}) {
  const fuori = [];
  const tutte = entita.filter((e) => e && e.id);
  for (const [area, cose] of perArea(tutte)) {
    const luci = cose.filter(eLuce);
    const movimenti = cose.filter(eMovimento);
    /* Movimento e luce nella stessa stanza: di notte, al 20%, per due minuti. */
    if (movimenti.length && luci.length) {
      const pir = movimenti[0];
      const luce = luci[0];
      fuori.push({
        id: idDi("movimento-luce", pir.id, luce.id),
        gruppo: "dispositivi",
        chiave: "movimentoLuce",
        disegno: "presenza",
        dati: { area },
        cose: { sensore: pir.id, luce: luce.id },
      });
    }
    /* Finestra e clima nella stessa stanza: aperta per due minuti si spegne,
     * e quando la si chiude riparte. */
    const finestre = cose.filter(eFinestra);
    const climi = cose.filter(eClima);
    if (finestre.length && climi.length) {
      const finestra = finestre[0];
      const clima = climi.map((c) => c.id);
      fuori.push({
        id: idDi("finestra-clima", finestra.id, clima),
        gruppo: "dispositivi",
        chiave: "finestraClima",
        disegno: "finestra",
        dati: { area, finestra: nomeDi(finestra) },
        cose: { finestra: finestra.id, climi: clima },
      });
    }
    /* Umidita' e aspiratore nella stessa stanza: sopra il 70% si accende, e
     * si spegne quando scende sotto il 60%. */
    const umidita = cose.filter(eUmidita);
    const aspiratori = cose.filter(eAspiratore);
    if (umidita.length && aspiratori.length) {
      const sensore = umidita[0];
      const aspiratore = aspiratori[0];
      fuori.push({
        id: idDi("umidita-aspiratore", sensore.id, aspiratore.id),
        gruppo: "dispositivi",
        chiave: "umiditaAspiratore",
        disegno: "umidita",
        dati: { area, aspiratore: nomeDi(aspiratore) },
        cose: { sensore: sensore.id, aspiratore: aspiratore.id },
      });
    }
  }
  /* L'elettrodomestico: un sensore di potenza col nome — o la stanza — di una
   * lavatrice, una lavastoviglie, un'asciugatrice. */
  for (const e of tutte.filter(ePotenza)) {
    if (!ELETTRODOMESTICO.test(`${nomeDi(e)} ${pulito(e.area)} ${e.id}`)) continue;
    fuori.push({
      id: idDi("elettrodomestico", e.id),
      gruppo: "dispositivi",
      chiave: "elettrodomestico",
      disegno: "elettrodomestici",
      dati: { nome: nomeDi(e) },
      cose: { potenza: e.id },
    });
  }
  const luci = tutte.filter(eLuce).map((e) => e.id);
  const persone = tutte.filter(ePersona);
  /* Tutti fuori: si spengono le luci. */
  if (persone.length && luci.length)
    fuori.push({
      id: idDi("fuori-luci", "tutte"),
      gruppo: "dispositivi",
      chiave: "fuoriLuci",
      disegno: "persone",
      dati: { quante: luci.length },
      cose: { luci: luci.slice(0, 10) },
    });
  /* Nessuno in casa da mezz'ora, e il clima va ancora: si spegne. */
  const climi = tutte.filter(eClima).map((e) => e.id);
  if (persone.length && climi.length)
    fuori.push({
      id: idDi("vuota-clima", "tutti"),
      gruppo: "dispositivi",
      chiave: "vuotaClima",
      disegno: "clima",
      dati: {},
      cose: { climi: climi.slice(0, 10) },
    });
  /* L'antifurto inserito: le luci si spengono. */
  const antifurto = tutte.find(eAntifurto);
  if (antifurto && luci.length)
    fuori.push({
      id: idDi("antifurto-luci", antifurto.id),
      gruppo: "dispositivi",
      chiave: "antifurtoLuci",
      disegno: "sicurezza",
      dati: {},
      cose: { antifurto: antifurto.id, luci: luci.slice(0, 10) },
    });
  /* Le tapparelle: al tramonto si chiudono. */
  const tapparelle = tutte.filter(eTapparella).map((e) => e.id);
  if (tapparelle.length)
    fuori.push({
      id: idDi("tramonto-tapparelle", "tutte"),
      gruppo: "dispositivi",
      chiave: "tramontoTapparelle",
      disegno: "tapparelle",
      dati: { quante: tapparelle.length },
      cose: { tapparelle: tapparelle.slice(0, 10) },
    });
  return fuori.map(conLAutomazione);
}

/* ── le abitudini ───────────────────────────────────────────────────────── */

const ACCESO = new Set(["on", "open", "opening"]);
const SPENTO = new Set(["off", "closed", "closing"]);
const chiaveDelGiorno = (t) => new Date(t).toDateString();
const minutiDelGiorno = (t) => {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
};
const giornoDellaSettimana = (t) => (new Date(t).getDay() + 6) % 7;

/** I passaggi di una storia: `[ms, "accende"|"spegne"]`, al cambio e basta. */
export function passaggi(storia = []) {
  const fuori = [];
  let prima = null;
  for (const [t, stato] of storia) {
    const s = minuscolo(stato);
    if (ACCESO.has(s) && prima !== "on") fuori.push([t, "accende"]);
    if (SPENTO.has(s) && prima === "on") fuori.push([t, "spegne"]);
    if (ACCESO.has(s)) prima = "on";
    else if (SPENTO.has(s)) prima = "off";
  }
  return fuori;
}

/* Quanti giorni di un tipo — feriali o festivi — ci sono nella finestra. */
function giorniDelTipo(adesso, giorni, festivo) {
  let n = 0;
  for (let i = 1; i <= giorni; i += 1) {
    const g = giornoDellaSettimana(adesso - i * GIORNO);
    if (g >= 5 === festivo) n += 1;
  }
  return n;
}

/**
 * Un orario che torna: fra gli istanti dati (uno per evento), il gruppo di
 * eventi entro venti minuti che copre piu' giorni diversi. Torna
 * `{minuti, da, a, giorni}` o `null` se non arriva alla quota.
 */
export function orarioCheTorna(istanti, giorniPossibili) {
  if (!istanti.length || !giorniPossibili) return null;
  let meglio = null;
  for (const centro of istanti) {
    const m = minutiDelGiorno(centro);
    const dentro = istanti.filter((t) => Math.abs(minutiDelGiorno(t) - m) <= FINESTRA_ABITUDINE);
    const giorni = new Set(dentro.map(chiaveDelGiorno)).size;
    if (!meglio || giorni > meglio.giorni) meglio = { giorni, dentro };
  }
  if (meglio.giorni / giorniPossibili < QUOTA_ABITUDINE) return null;
  const minuti = meglio.dentro.map(minutiDelGiorno).sort((a, b) => a - b);
  const mezzo = minuti[Math.floor(minuti.length / 2)];
  return {
    minuti: Math.round(mezzo / 5) * 5,
    da: minuti[0],
    a: minuti[minuti.length - 1],
    giorni: meglio.giorni,
  };
}

/**
 * Le proposte dalle abitudini.
 *
 * `storie`: `{id: [[ms, stato], …]}` dal Recorder, in ordine; `entita` per i
 * nomi; `statoDi` per il sole; `luciConCasaVuota`: `{id: {giorno: minuti}}`,
 * quello che l'assistente delle notifiche ha gia' contato
 * (`capire-la-casa.js`).
 */
export function proposteDalleAbitudini({
  storie = {},
  entita = [],
  adesso = Date.now(),
  statoDi = null,
  luciConCasaVuota = {},
  giorni = GIORNI_DI_STORIA,
} = {}) {
  const fuori = [];
  const perId = new Map(entita.map((e) => [e.id, e]));
  const inizio = adesso - giorni * GIORNO;
  for (const [id, storia] of Object.entries(storie)) {
    const d = dominioDi(id);
    if (!["light", "switch", "cover"].includes(d)) continue;
    const eventi = passaggi(storia).filter(([t]) => t >= inizio && t <= adesso);
    const nome = nomeDi(perId.get(id) || { id });
    /* Le tapparelle chiuse a mano vicino al tramonto: al tramonto si chiude
     * — e allora la chiusura non cerca anche un orario fisso, che d'inverno
     * arriverebbe a buio fatto. */
    let alTramonto = false;
    if (d === "cover") {
      const chiusure = eventi.filter(([, v]) => v === "spegne").map(([t]) => t);
      const vicine = new Set(
        chiusure
          .filter((t) => {
            const sole = soleDelGiorno(statoDi, t);
            return sole && t >= sole.tramonto - 20 * MINUTO && t <= sole.tramonto + 60 * MINUTO;
          })
          .map(chiaveDelGiorno),
      );
      if (vicine.size / giorni >= QUOTA_ABITUDINE) {
        fuori.push({
          id: idDi("abitudine-tramonto", id),
          gruppo: "abitudini",
          chiave: "abitudineTramonto",
          disegno: "tapparelle",
          dati: { nome, giorni: vicine.size },
          cose: { tapparelle: [id] },
        });
        alTramonto = true;
      }
    }
    for (const verso of ["accende", "spegne"]) {
      if (alTramonto && verso === "spegne") continue;
      for (const festivo of [false, true]) {
        const istanti = eventi
          .filter(([t, v]) => v === verso && giornoDellaSettimana(t) >= 5 === festivo)
          .map(([t]) => t);
        const trovato = orarioCheTorna(istanti, giorniDelTipo(adesso, giorni, festivo));
        if (!trovato) continue;
        const ora = oraDiMinuti(trovato.minuti);
        fuori.push({
          id: idDi(`abitudine-${verso}-${festivo ? "festivi" : "feriali"}`, id),
          gruppo: "abitudini",
          chiave: "abitudineOrario",
          disegno: d === "cover" ? "tapparelle" : d === "light" ? "luci" : "prese",
          dati: {
            nome,
            ora,
            festivi: festivo,
            da: oraDiMinuti(trovato.da),
            a: oraDiMinuti(trovato.a),
            verso,
            settimane: Math.round(giorni / 7),
          },
          cose: { entita: id },
        });
      }
    }
  }
  /* Le luci rimaste accese con la casa vuota, almeno tre giorni su sette. */
  const ultimaSettimana = new Set(
    Array.from({ length: 7 }, (_v, i) => {
      const t = new Date(adesso - i * GIORNO);
      const due = (n) => String(n).padStart(2, "0");
      return `${t.getFullYear()}-${due(t.getMonth() + 1)}-${due(t.getDate())}`;
    }),
  );
  const dimenticate = [];
  let volte = 0;
  for (const [id, perGiorno] of Object.entries(luciConCasaVuota || {})) {
    if (dominioDi(id) !== "light") continue;
    const giorniAccesa = Object.entries(perGiorno || {}).filter(
      ([g, minuti]) => ultimaSettimana.has(g) && Number(minuti) >= 10,
    ).length;
    if (giorniAccesa >= 1) dimenticate.push(id);
    volte = Math.max(volte, giorniAccesa);
  }
  if (volte >= 3 && dimenticate.length)
    fuori.push({
      id: idDi("abitudine-fuori-luci", "tutte"),
      gruppo: "abitudini",
      chiave: "abitudineFuoriLuci",
      disegno: "persone",
      dati: { volte },
      cose: { luci: dimenticate.slice(0, 10) },
    });
  return fuori.map(conLAutomazione);
}

/* ── dalla proposta all'automazione ─────────────────────────────────────── */

const giorniDi = (festivo) => (festivo ? festivi : feriali);

/**
 * L'automazione di una proposta, nella forma di `cd_automazioni` (senza id e
 * senza nome). E' la sola cosa che sa come si salva un'automazione: le
 * regole qui sopra dicono solo che cosa proporre.
 */
export function automazioneDellaProposta({ chiave, cose = {}, dati = {} } = {}) {
  const c = cose || {};
  const d = dati || {};
  const fatta = (quando, allora, soloSe = undefined) => ({
    attiva: true,
    quando,
    ...(soloSe ? { soloSe } : {}),
    allora,
  });
  if (chiave === "movimentoLuce")
    return fatta(
      { tipo: "movimento", entita: [c.sensore], verso: "si" },
      [
        { tipo: "accendi", entita: [c.luce], livello: 20 },
        { tipo: "aspetta", minuti: 2 },
        { tipo: "spegni", entita: [c.luce] },
      ],
      [{ tipo: "notte", da: "", a: "" }],
    );
  if (chiave === "finestraClima")
    return fatta({ tipo: "stato", entita: [c.finestra], a: "on", per: 2 }, [
      { tipo: "clima", entita: c.climi, modo: "spegni" },
      { tipo: "aspettaChe", entita: c.finestra, stato: "off", massimo: 720 },
      { tipo: "accendi", entita: c.climi },
    ]);
  if (chiave === "umiditaAspiratore")
    return fatta({ tipo: "valore", entita: c.sensore, verso: "sopra", soglia: 70 }, [
      { tipo: "accendi", entita: [c.aspiratore] },
      { tipo: "aspettaChe", entita: c.sensore, stato: "<60", massimo: 120 },
      { tipo: "spegni", entita: [c.aspiratore] },
    ]);
  if (chiave === "elettrodomestico")
    return fatta({ tipo: "elettrodomestico", entita: c.potenza, soglia: 5, minuti: 3 }, [
      { tipo: "notifica", testo: pulito(d.nome) },
    ]);
  if (chiave === "fuoriLuci" || chiave === "abitudineFuoriLuci")
    return fatta({ tipo: "persone", verso: "tuttiFuori" }, [{ tipo: "spegni", entita: c.luci }]);
  if (chiave === "vuotaClima")
    return fatta({ tipo: "stato", entita: ["zone.home"], a: "0", per: 30 }, [
      { tipo: "clima", entita: c.climi, modo: "spegni" },
    ]);
  if (chiave === "antifurtoLuci")
    return fatta({ tipo: "antifurto", entita: c.antifurto, verso: "inserito" }, [
      { tipo: "spegni", entita: c.luci },
    ]);
  if (chiave === "tramontoTapparelle" || chiave === "abitudineTramonto")
    return fatta({ tipo: "orario", sole: "tramonto", scarto: 0, giorni: tutti }, [
      { tipo: "tapparella", entita: c.tapparelle, modo: "chiudi" },
    ]);
  if (chiave === "abitudineOrario") {
    const accende = d.verso === "accende";
    const azione =
      dominioDi(c.entita) === "cover"
        ? { tipo: "tapparella", entita: [c.entita], modo: accende ? "apri" : "chiudi" }
        : { tipo: accende ? "accendi" : "spegni", entita: [c.entita] };
    return fatta({ tipo: "orario", ore: [d.ora], giorni: giorniDi(d.festivi) }, [azione]);
  }
  return null;
}

const conLAutomazione = (p) => ({ ...p, automazione: automazioneDellaProposta(p) });

/* ── quello che c'e' gia' ───────────────────────────────────────────────── */

/* Di che cosa parla un QUANDO, per riconoscerne due uguali. */
function firmaDelQuando(q) {
  if (!q) return "";
  const ent = (v) => (Array.isArray(v) ? [...v].sort().join(",") : pulito(v));
  if (q.tipo === "orario")
    return q.sole ? `orario:${q.sole}` : `orario:${(q.ore || []).map(minutiDi).join(",")}`;
  if (q.tipo === "persone") return `persone:${q.verso}`;
  if (q.tipo === "stato") return `stato:${ent(q.entita)}:${pulito(q.a)}`;
  return `${q.tipo}:${ent(q.entita)}:${pulito(q.verso)}`;
}

const entitaDellAllora = (allora) =>
  new Set(
    (allora || []).flatMap((a) =>
      Array.isArray(a.entita) ? a.entita : a.entita ? [a.entita] : [],
    ),
  );

/** Se un'automazione salvata fa gia' quello che la proposta propone. */
export function giaCe(proposta, automazioni = []) {
  const sua = proposta?.automazione;
  if (!sua) return true;
  const firma = firmaDelQuando(sua.quando);
  const cose = entitaDellAllora(sua.allora);
  return automazioni.some((a) => {
    if (a?.tipo === "crono") {
      /* Un cronotermostato con la sua finestra fa gia' il «clima spento con
       * la finestra aperta». */
      return (
        proposta.chiave === "finestraClima" &&
        a.crono.finestraSpegne &&
        a.crono.finestre.some((f) => sua.quando.entita?.includes(f))
      );
    }
    /* Le routine e i calendari del Pianificatore non hanno un «quando». */
    if (!a?.quando) return false;
    if (firmaDelQuando(a.quando) !== firma) return false;
    const loro = entitaDellAllora(a.allora);
    if (!cose.size) return true;
    return [...cose].some((e) => loro.has(e));
  });
}

/**
 * Le proposte da mostrare: senza quelle che ci sono gia', senza quelle
 * scartate, una per id, e quando un'abitudine dice la stessa cosa di una
 * regola sui dispositivi vince l'abitudine — ha piu' prove.
 */
export function proposteDaMostrare(proposte = [], { automazioni = [], scartate = [] } = {}) {
  const salvate = automazioniPulite(automazioni);
  const no = new Set(scartate);
  const abitudini = new Set(proposte.filter((p) => p.gruppo === "abitudini").map((p) => p.chiave));
  const visti = new Set();
  const fuori = [];
  for (const p of proposte) {
    if (!p?.id || visti.has(p.id) || no.has(p.id)) continue;
    if (p.chiave === "tramontoTapparelle" && abitudini.has("abitudineTramonto")) continue;
    if (p.chiave === "fuoriLuci" && abitudini.has("abitudineFuoriLuci")) continue;
    if (giaCe(p, salvate)) continue;
    visti.add(p.id);
    fuori.push(p);
  }
  /* Prima i dispositivi, poi le abitudini: l'ordine della pagina. */
  return [
    ...fuori.filter((p) => p.gruppo === "dispositivi"),
    ...fuori.filter((p) => p.gruppo === "abitudini"),
  ];
}
