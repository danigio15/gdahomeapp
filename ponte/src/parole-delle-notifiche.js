/* Le parole delle notifiche che raccontano qualcosa: un elettrodomestico che
 * ha finito, la giornata della casa, la corrente che va via, un movimento,
 * l'antifurto scattato.
 *
 * Ognuna si dice in due modi, e ogni telefono sceglie il suo (Impostazioni →
 * Notifiche → «Come le vuoi»):
 *
 *  - **semplice**: solo testo, piu' righe, uguale su ogni telefono;
 *  - **elaborata**: un titolo che dice gia' l'essenziale, una riga, e la
 *    `scheda` — i numeri che l'app disegna sopra la notifica (il grafico del
 *    ciclo, la giornata del sole). Il formato della scheda e' scritto nel
 *    contratto con l'app: corto, perche' una busta porta 2200 byte.
 *
 * Qui non si decide niente: si scrive. Chi deve ricevere cosa lo decide
 * `notifiche.js`, e i numeri li fanno la sentinella e il taccuino
 * (`l-energia-di-casa.js`).
 */

const MESI = Object.freeze({
  it: [
    "gennaio",
    "febbraio",
    "marzo",
    "aprile",
    "maggio",
    "giugno",
    "luglio",
    "agosto",
    "settembre",
    "ottobre",
    "novembre",
    "dicembre",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
});

/** I pezzi che una notifica di un elettrodomestico puo' dire. */
export const PEZZI_DEL_CICLO = Object.freeze(["durata", "kwh", "costo", "sole", "consiglio"]);

const EMOJI_DEL_GENERE = Object.freeze({
  lavatrice: "🫧",
  lavasciuga: "🫧",
  lavastoviglie: "🍽️",
  asciugatrice: "🌀",
});

/* L'icona per la scheda: quella che l'app sa disegnare. */
export function iconaDelGenere(genere) {
  return ["lavatrice", "lavastoviglie", "asciugatrice"].includes(genere)
    ? genere
    : genere === "lavasciuga"
      ? "lavatrice"
      : "altro";
}

/** «0,05 €» in italiano, «€0.05» in inglese. */
export function euro(valore, lingua = "it") {
  const n = Number(valore) || 0;
  return lingua === "en" ? `€${n.toFixed(2)}` : `${n.toFixed(2).replace(".", ",")} €`;
}

/** Un numero con una cifra dopo la virgola, alla maniera della lingua. */
export function decimale(valore, cifre = 1, lingua = "it") {
  const testo = (Number(valore) || 0).toFixed(cifre);
  return lingua === "en" ? testo : testo.replace(".", ",");
}

/** «1 h 52 min», «52 min». */
export function durata(minuti) {
  const m = Math.max(1, Math.round(Number(minuti) || 0));
  if (m < 60) return `${m} min`;
  const ore = Math.floor(m / 60);
  const resto = m % 60;
  return resto ? `${ore} h ${String(resto).padStart(2, "0")} min` : `${ore} h`;
}

const percento = (quota) => `${Math.round((Number(quota) || 0) * 100)}%`;

/* ─── L'elettrodomestico che ha finito ──────────────────────────────────── */

/**
 * `dati`: `{nome, genere, ciclo, conSole}` — `ciclo` e' quello di
 * `TaccuinoDellEnergia.chiudiIlCiclo`, o `null` se l'elettrodomestico ha detto
 * «finito» senza una presa che ne misurasse la potenza.
 */
export function paroleDelCiclo(
  dati,
  lingua = "it",
  { stile = "semplice", dentro = PEZZI_DEL_CICLO } = {},
) {
  const en = lingua === "en";
  const emoji = EMOJI_DEL_GENERE[dati.genere] || "🧺";
  const nome = String(dati.nome || "").slice(0, 40);
  const c = dati.ciclo;
  const vuole = (pezzo) => dentro.includes(pezzo);
  const titoloBase = en ? `${emoji} ${nome} done` : `${emoji} ${nome} ${finitaDi(nome)}`;
  if (!c) {
    return {
      titolo: titoloBase,
      testo: en ? "It just finished" : "Ha appena finito",
      scheda: null,
    };
  }
  const tuttaColSole = c.sole >= 0.98 && (c.eur === null || c.eur < 0.005);
  const prezzoRete = c.rkwh > 0 && c.reur !== null ? c.reur / c.rkwh : null;
  const costo =
    c.eur === null ? null : tuttaColSole ? (en ? "free" : "gratis") : euro(c.eur, lingua);

  if (stile === "elaborata") {
    const pezzi = [];
    if (vuole("durata")) pezzi.push(durata(c.min));
    if (vuole("sole") && dati.conSole && c.sole > 0.005)
      pezzi.push(
        tuttaColSole
          ? en
            ? "☀️ all from the sun"
            : "☀️ tutta col sole"
          : en
            ? `☀️ ${percento(c.sole)} from the sun`
            : `☀️ ${percento(c.sole)} dal sole`,
      );
    else if (vuole("kwh")) pezzi.push(`${decimale(c.kwh, 2, lingua)} kWh`);
    if (vuole("costo") && dati.conSole && c.senza !== null && c.sole > 0.05 && !tuttaColSole)
      pezzi.push(
        en ? `without sun ${euro(c.senza, lingua)}` : `senza sole ${euro(c.senza, lingua)}`,
      );
    return {
      titolo: vuole("costo") && costo ? `${titoloBase} · ${costo}` : titoloBase,
      testo: pezzi.join(" · ") || (en ? "It just finished" : "Ha appena finito"),
      scheda: {
        v: 1,
        t: "ciclo",
        n: nome,
        i: iconaDelGenere(dati.genere),
        da: c.da,
        a: c.a,
        min: c.min,
        kwh: c.kwh,
        eur: c.eur,
        sole: dati.conSole ? c.sole : 0,
        batt: c.batt,
        rkwh: c.rkwh,
        reur: c.reur,
        senza: c.senza,
        w: c.w,
        s: dati.conSole ? c.s : [],
      },
    };
  }

  const righe = [];
  const prima = [];
  if (vuole("durata")) prima.push(en ? `Running ${durata(c.min)}` : `In funzione ${durata(c.min)}`);
  if (vuole("kwh")) prima.push(`${decimale(c.kwh, 2, lingua)} kWh`);
  if (prima.length) righe.push(prima.join(" · "));
  if (vuole("costo") && costo) {
    if (dati.conSole && vuole("sole") && c.sole > 0.005) {
      if (tuttaColSole)
        righe.push(en ? `Cost €0.00 · ☀️ all from the sun` : `Costo 0,00 € · ☀️ tutta col sole`);
      else
        righe.push(
          en
            ? `Cost ${costo} · ☀️ ${percento(c.sole)} from the sun, free`
            : `Costo ${costo} · ☀️ ${percento(c.sole)} dal sole, gratis`,
        );
      if (c.batt > 0.05)
        righe.push(
          en
            ? `🔋 ${percento(c.batt)} from the home battery`
            : `🔋 ${percento(c.batt)} dalla batteria di casa`,
        );
      if (!tuttaColSole && prezzoRete && c.rkwh > 0.005)
        righe.push(
          en
            ? `The grid gave ${decimale(c.rkwh, 2, lingua)} kWh at ${euro(prezzoRete, lingua)}/kWh`
            : `La rete ha messo ${decimale(c.rkwh, 2, lingua)} kWh a ${euro(prezzoRete, lingua)}/kWh`,
        );
      if (!tuttaColSole && c.senza !== null && c.sole > 0.05)
        righe.push(
          en
            ? `Without the sun it would have cost ${euro(c.senza, lingua)}`
            : `Senza sole sarebbe costata ${euro(c.senza, lingua)}`,
        );
    } else {
      const fascia = dati.fascia ? (en ? `band ${dati.fascia}` : `fascia ${dati.fascia}`) : "";
      const allOra = prezzoRete ? `${euro(prezzoRete, lingua)}/kWh` : "";
      righe.push(
        [
          en ? `Cost ${costo}` : `Costo ${costo}`,
          [fascia, allOra].filter(Boolean).join(en ? " at " : " a "),
        ]
          .filter(Boolean)
          .join(" · "),
      );
    }
  }
  if (vuole("consiglio") && c.meglio)
    righe.push(
      en
        ? `Started after ${c.meglio.dalle} it would have cost ${euro(c.meglio.eur, lingua)}`
        : `Partita dopo le ${c.meglio.dalle} sarebbe costata ${euro(c.meglio.eur, lingua)}`,
    );
  return {
    titolo: titoloBase,
    testo: righe.join("\n") || (en ? "It just finished" : "Ha appena finito"),
    scheda: null,
  };
}

/* «Lavatrice finita», «Forno finito»: le macchine della casa sono quasi tutte
 * femminili (la lavatrice, l'asciugatrice, la lavastoviglie), gli altri si
 * riconoscono dalla fine della parola. */
function finitaDi(nome) {
  const prima = String(nome).trim().split(/\s+/)[0] || "";
  return /(a|trice|stoviglie)$/i.test(prima) ? "finita" : "finito";
}

/* ─── La giornata, la sera ─────────────────────────────────────────────── */

/**
 * `dati`:
 *  - `giornata`: `TaccuinoDellEnergia.laGiornata()` (o `null`);
 *  - `conSole`: se la casa ha il fotovoltaico;
 *  - `ieri`, `media`: kWh del sole (o della casa, senza sole) di ieri e della
 *    media dei sette giorni prima;
 *  - `record`: `"mese"` | `"anno"` | `null`;
 *  - `colSole`: nomi degli elettrodomestici andati (quasi) tutti col sole;
 *  - `piuAcceso`: `{nome, kwh, ora}` o `null`;
 *  - `batteria`: carica della batteria di casa adesso (%), o `null`;
 *  - `domani`: `{met: [[ora, cielo]…], soleFino: "15:00"|null, pioggia: bool}`;
 *  - `fasce`: `{nomi: {indice: "F1"}, piuBassa: {dalle, nome}}`;
 *  - `daSistemare`: `{batterie, spenti, aggiornamenti}`;
 *  - `inCoda`: righe di notifiche che il telefono ha voluto «nel riepilogo».
 *
 * `null` se non c'e' niente da dire.
 */
export function paroleDelRiepilogo(dati, lingua = "it", { stile = "semplice" } = {}) {
  const en = lingua === "en";
  const g = dati.giornata;
  const sistemare = righeDaSistemare(dati.daSistemare, lingua);
  const coda = (dati.inCoda || []).slice(0, 6);
  const conSole = Boolean(dati.conSole && g?.sole);
  const conCasa = Boolean(g && (g.casa || g.presi));
  if (!conSole && !conCasa) {
    if (!sistemare && !coda.length) return null;
    return {
      titolo: en ? "🔋 Tonight's summary" : "🔋 Riepilogo di stasera",
      testo: [...coda, sistemare].filter(Boolean).join("\n"),
      scheda: null,
    };
  }
  const data = new Date(`${g.d}T12:00:00`);
  const mese = MESI[en ? "en" : "it"][data.getMonth()];
  const confronto = (oggi, prima) => {
    if (!prima || !oggi) return "";
    const delta = Math.round(((oggi - prima) / prima) * 100);
    if (Math.abs(delta) < 3) return en ? "same as yesterday" : "come ieri";
    return en
      ? `${delta > 0 ? "+" : "−"}${Math.abs(delta)}% vs yesterday`
      : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}% su ieri`;
  };
  const righe = [];
  let titolo;
  let titoloCorto;
  if (conSole) {
    const grigia = dati.media && g.sole < dati.media * 0.5;
    const emoji = grigia ? "⛅" : "☀️";
    titolo = en
      ? `${emoji} Your day · ${decimale(g.sole, 1, lingua)} kWh from the sun`
      : `${emoji} La tua giornata · ${decimale(g.sole, 1, lingua)} kWh dal sole`;
    titoloCorto = en
      ? `${emoji} ${decimale(g.sole, 1, lingua)} kWh from the sun · ${euro(g.risparmio, lingua)} saved`
      : `${emoji} ${decimale(g.sole, 1, lingua)} kWh dal sole · ${euro(g.risparmio, lingua)} risparmiati`;
    if (g.quotaInCasa !== null)
      righe.push(
        en
          ? `${percento(g.quotaInCasa)} used at home · ${euro(g.risparmio, lingua)} saved`
          : `Usati in casa il ${percento(g.quotaInCasa)} · risparmiati ${euro(g.risparmio, lingua)}`,
      );
    righe.push(
      en
        ? `Grid ${decimale(g.presi, 1, lingua)} kWh · ${euro(g.euroRete, lingua)} · exported ${decimale(g.ceduti, 1, lingua)} kWh`
        : `Rete ${decimale(g.presi, 1, lingua)} kWh · ${euro(g.euroRete, lingua)} · ceduti ${decimale(g.ceduti, 1, lingua)} kWh`,
    );
    const picco = g.picco
      ? en
        ? `Peak ${decimale(g.picco, 1, lingua)} kW at ${g.piccoIl}`
        : `Picco ${decimale(g.picco, 1, lingua)} kW alle ${g.piccoIl}`
      : "";
    const quanto = confronto(g.sole, dati.ieri);
    if (picco || quanto) righe.push([picco, quanto].filter(Boolean).join(" · "));
    if (grigia && dati.media) {
      const meno = Math.round((1 - g.sole / dati.media) * 100);
      righe.push(
        en
          ? `−${meno}% on the week's average: clouds`
          : `−${meno}% sulla media della settimana: nuvole`,
      );
    }
    if (dati.record === "mese")
      righe.push(en ? `🏆 The sunniest day of ${mese}` : `🏆 La giornata più solare di ${mese}`);
    else if (dati.record === "anno")
      righe.push(en ? "🏆 The sunniest day of the year" : "🏆 La giornata più solare dell'anno");
    if (dati.colSole?.length)
      righe.push(
        en
          ? `🫧 ${elencoDi(dati.colSole, en)}: all on sunshine`
          : `🫧 ${elencoDi(dati.colSole, en)}: ${dati.colSole.length > 1 ? "tutte" : "tutta"} col sole`,
      );
  } else {
    const kwh = g.casa ?? g.presi;
    titolo = en
      ? `⚡ Your day · ${decimale(kwh, 1, lingua)} kWh`
      : `⚡ La tua giornata · ${decimale(kwh, 1, lingua)} kWh`;
    titoloCorto = en
      ? `⚡ ${decimale(kwh, 1, lingua)} kWh · ${euro(g.euroRete, lingua)}`
      : `⚡ ${decimale(kwh, 1, lingua)} kWh · ${euro(g.euroRete, lingua)}`;
    const perFascia = Object.entries(g.perFascia || {})
      .filter(([, v]) => v > 0.05)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(
        ([i, v]) =>
          `${decimale(v, 1, lingua)} kWh ${en ? "in" : "in"} ${dati.fasce?.nomi?.[i] || `F${Number(i) + 1}`}`,
      );
    righe.push(
      [
        en ? `Cost ${euro(g.euroRete, lingua)}` : `Costo ${euro(g.euroRete, lingua)}`,
        ...perFascia,
      ].join(" · "),
    );
    const quanto = confronto(kwh, dati.ieri);
    if (quanto) righe.push(quanto);
    if (dati.piuAcceso)
      righe.push(
        en
          ? `💡 The biggest: ${dati.piuAcceso.nome}, ${decimale(dati.piuAcceso.kwh, 1, lingua)} kWh`
          : `💡 Il più acceso: ${dati.piuAcceso.nome}, ${decimale(dati.piuAcceso.kwh, 1, lingua)} kWh`,
      );
  }
  if (dati.batteria !== null && dati.batteria !== undefined)
    righe.push(
      en
        ? `🔋 Home battery at ${Math.round(dati.batteria)}% for the night`
        : `🔋 Batteria di casa al ${Math.round(dati.batteria)}% per la notte`,
    );
  const consiglio = consiglioDiDomani(dati, lingua);
  if (consiglio) righe.push(consiglio.riga);
  righe.push(...coda);
  if (sistemare) righe.push(`⚠️ ${sistemare}`);

  if (stile === "elaborata") {
    const corta = [];
    if (conSole)
      corta.push(en ? `Grid ${euro(g.euroRete, lingua)}` : `Rete ${euro(g.euroRete, lingua)}`);
    if (dati.batteria !== null && dati.batteria !== undefined)
      corta.push(
        en
          ? `🔋 ${Math.round(dati.batteria)}% for the night`
          : `🔋 ${Math.round(dati.batteria)}% per la notte`,
      );
    if (sistemare) corta.push(`⚠️ ${sistemare}`);
    return {
      titolo: titoloCorto,
      testo: [corta.join(" · "), ...coda].filter(Boolean).join("\n"),
      scheda: {
        v: 1,
        t: "giornata",
        d: g.d,
        pk: conSole ? g.sole : null,
        casa: g.quotaInCasa,
        ris: g.risparmio,
        rk: g.presi,
        re: g.euroRete,
        ced: g.ceduti,
        pkw: g.picco,
        pora: g.piccoIl,
        rec: dati.record === "mese" ? mese : dati.record === "anno" ? (en ? "year" : "anno") : null,
        p: conSole ? g.p : [],
        c: g.c,
        met: dati.domani?.met || [],
        cons: consiglio?.corto || null,
        batt:
          dati.batteria !== null && dati.batteria !== undefined
            ? Math.round(dati.batteria) / 100
            : null,
      },
    };
  }
  return { titolo, testo: righe.join("\n"), scheda: null };
}

function elencoDi(nomi, en) {
  if (nomi.length === 1) return nomi[0];
  const ultimo = nomi[nomi.length - 1];
  return `${nomi.slice(0, -1).join(", ")} ${en ? "and" : "e"} ${ultimo}`;
}

function righeDaSistemare(cosa, lingua) {
  if (!cosa) return "";
  const en = lingua === "en";
  const pezzi = [];
  const { batterie = 0, spenti = 0, aggiornamenti = 0 } = cosa;
  if (batterie)
    pezzi.push(
      en
        ? `${batterie} low batter${batterie === 1 ? "y" : "ies"}`
        : batterie === 1
          ? "1 batteria scarica"
          : `${batterie} batterie scariche`,
    );
  if (spenti)
    pezzi.push(
      en
        ? `${spenti} device${spenti === 1 ? "" : "s"} offline`
        : spenti === 1
          ? "1 dispositivo non connesso"
          : `${spenti} dispositivi non connessi`,
    );
  if (aggiornamenti)
    pezzi.push(
      en
        ? `${aggiornamenti} update${aggiornamenti === 1 ? "" : "s"}`
        : aggiornamenti === 1
          ? "1 aggiornamento"
          : `${aggiornamenti} aggiornamenti`,
    );
  if (!pezzi.length) return "";
  return `${en ? "To fix" : "Da sistemare"}: ${pezzi.join(", ")}`;
}

/* Il consiglio per domani: col sole, quando far partire la lavatrice; senza,
 * la fascia che costa meno — solo se c'e' davvero da guadagnarci. */
function consiglioDiDomani(dati, lingua) {
  const en = lingua === "en";
  const domani = dati.domani;
  if (!domani) return null;
  if (dati.conSole && domani.soleFino) {
    const fino = domani.soleFino;
    const ora = Number(fino.slice(0, 2));
    const quando =
      ora <= 13
        ? en
          ? "in the morning"
          : "in mattinata"
        : en
          ? `before ${fino}`
          : `entro le ${fino}`;
    return {
      riga: en
        ? `🌤️ Tomorrow sun until ${fino}: washing machine ${quando}`
        : `🌤️ Domani sole fino alle ${fino}: lavatrice ${quando}`,
      corto: en ? `washer before ${fino}` : `lavatrice entro le ${fino}`,
    };
  }
  if (domani.pioggia && dati.fasce?.piuBassa) {
    const dalle = dati.fasce.piuBassa.dalle;
    return {
      riga: en
        ? `🌧️ Rain tomorrow: washing machine after ${dalle}, it costs less`
        : `🌧️ Domani pioggia: lavatrice dopo le ${dalle}, costa meno`,
      corto: en ? `washer after ${dalle}` : `lavatrice dopo le ${dalle}`,
    };
  }
  return null;
}

/* ─── La corrente ──────────────────────────────────────────────────────── */

/**
 * `dati`: `{nome, carica, minuti, watt, dalle, fase, durata}` — `fase`:
 * `"via"` (e' andata via), `"bassa"` (la batteria dell'UPS e' al 30%),
 * `"torna"` (e' tornata, dopo `durata` minuti).
 */
export function paroleDelBlackout(dati, lingua = "it", { stile = "semplice" } = {}) {
  const en = lingua === "en";
  const autonomia =
    dati.minuti !== null && dati.minuti !== undefined
      ? en
        ? `about ${durata(dati.minuti)}`
        : `circa ${durata(dati.minuti)}`
      : "";
  const carica =
    dati.carica !== null && dati.carica !== undefined ? `${Math.round(dati.carica)}%` : "";
  if (dati.fase === "torna") {
    const ricarica = carica
      ? en
        ? ` · the UPS is recharging (${carica})`
        : ` · l'UPS si ricarica (${carica})`
      : "";
    return {
      titolo: en ? "✅ Power is back" : "✅ Corrente tornata",
      testo: `${en ? "After" : "Dopo"} ${durata(dati.durata)}${ricarica}`,
      scheda: null,
    };
  }
  if (dati.fase === "bassa") {
    return {
      titolo: en ? `🪫 UPS at ${carica || "30%"}` : `🪫 UPS al ${carica || "30%"}`,
      testo: [
        autonomia && (en ? `${autonomia} left` : `${autonomia} di autonomia`),
        en ? "power is still off" : "la corrente non è ancora tornata",
      ]
        .filter(Boolean)
        .join(" · "),
      scheda: stile === "elaborata" ? schedaUps(dati) : null,
    };
  }
  const chi = dati.nome && dati.molti ? dati.nome : en ? "the UPS" : "l'UPS";
  if (stile === "elaborata")
    return {
      titolo: en ? "⚡ Power is out" : "⚡ Manca la corrente",
      testo: [en ? `The house is running on ${chi}` : `La casa va con ${chi}`, autonomia]
        .filter(Boolean)
        .join(" · "),
      scheda: schedaUps(dati),
    };
  const numeri = [carica && (en ? `charge ${carica}` : `carica ${carica}`), autonomia]
    .filter(Boolean)
    .join(", ");
  return {
    titolo: en ? "⚡ Power is out" : "⚡ Manca la corrente",
    testo: [en ? `The house is running on ${chi}` : `La casa va con ${chi}`, numeri]
      .filter(Boolean)
      .join(" · "),
    scheda: null,
  };
}

function schedaUps(dati) {
  return {
    v: 1,
    t: "ups",
    n: String(dati.nome || "UPS").slice(0, 30),
    car: dati.carica !== null && dati.carica !== undefined ? Math.round(dati.carica) / 100 : null,
    min: dati.minuti ?? null,
    w: dati.watt ?? null,
    dalle: dati.dalle,
    acc: [],
  };
}

/* ─── Il movimento ─────────────────────────────────────────────────────── */

/** `dati`: `{nome, cam, ora, secondi, vuota, notte}`. */
export function paroleDelMovimento(dati, lingua = "it", { stile = "semplice" } = {}) {
  const en = lingua === "en";
  const dove = String(dati.cam || dati.nome || "").slice(0, 40);
  const perche = dati.vuota
    ? en
      ? "nobody home"
      : "casa vuota"
    : dati.notte
      ? en
        ? "at night"
        : "di notte"
      : "";
  const titolo = dati.cam
    ? `📷 ${en ? "Motion" : "Movimento"} · ${dove}`
    : `🏃 ${en ? "Motion" : "Movimento"} · ${dove}`;
  if (stile === "elaborata")
    return {
      titolo,
      testo: [dati.ora, perche].filter(Boolean).join(" · "),
      scheda: dati.cam ? { v: 1, t: "movimento", cam: dove, ora: dati.secondi || dati.ora } : null,
    };
  return {
    titolo,
    testo: [dati.ora, perche, dati.cam ? (en ? "tap to see" : "tocca per vedere") : ""]
      .filter(Boolean)
      .join(" · "),
    scheda: null,
  };
}

/* ─── L'antifurto scattato ─────────────────────────────────────────────── */

/** `dati`: `{nome, zona, ora, modo, dalle, sirena, ev}`. */
export function paroleDellAntifurto(dati, lingua = "it", { stile = "semplice" } = {}) {
  const en = lingua === "en";
  const sirena = dati.sirena ? (en ? "siren on" : "sirena accesa") : "";
  if (stile === "elaborata") {
    const modo = dati.modo ? (en ? `alarm ${dati.modo}` : `antifurto ${dati.modo}`) : "";
    return {
      titolo: `🚨 ${en ? "Alarm triggered" : "Antifurto scattato"}${dati.zona ? ` · ${dati.zona}` : ""}`,
      testo: [dati.ora, sirena, modo].filter(Boolean).join(" · "),
      scheda: {
        v: 1,
        t: "antifurto",
        zona: dati.zona || dati.nome || "",
        ora: dati.ora,
        modo: dati.modo || "",
        dalle: dati.dalle || "",
        sir: Boolean(dati.sirena),
        ev: (dati.ev || []).slice(0, 4),
      },
    };
  }
  return {
    titolo: `🚨 ${en ? "Alarm triggered" : "Antifurto scattato"}`,
    testo: [dati.zona || dati.nome, dati.ora, sirena].filter(Boolean).join(" · "),
    scheda: null,
  };
}

/** Il compositore di un tipo di racconto. */
export const COMPOSITORI = Object.freeze({
  ciclo: paroleDelCiclo,
  riepilogo: paroleDelRiepilogo,
  blackout: paroleDelBlackout,
  movimento: paroleDelMovimento,
  antifurto: paroleDellAntifurto,
});
