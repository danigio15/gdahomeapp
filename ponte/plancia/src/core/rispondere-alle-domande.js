/* Rispondere alle domande: la casa che parla con quello che sa.
 *
 * `core/capire-le-domande.js` dice cosa si vuole; `core/sapere-della-casa.js`
 * dice cosa la casa sa. Qui si scrive la risposta: corta, con i numeri e le
 * unita', in italiano vero — «In casa ci sono in media 21,4 °C: da 19,8 in
 * Camera a 22,6 in Soggiorno» — e con i tasti che servono subito dopo: «E
 * fuori?», «Spegnile tutte», «Mostrami il cancello».
 *
 * LE AZIONI SI CONFERMANO. Spegnere, accendere, aprire, chiudere: la casa dice
 * cosa farebbe e su cosa, e lo fa solo col tocco su «Sì» (o con un «sì»
 * scritto). Per l'antifurto, le serrature e il cancello la conferma e' sempre
 * esplicita, e se la centrale vuole il codice lo si chiede: la casa non apre e
 * non sblocca niente per un equivoco.
 *
 * LA LINGUA DELLA RISPOSTA e' quella della domanda: chi scrive in italiano
 * legge in italiano, chi scrive in inglese legge in inglese, qualunque sia la
 * lingua della plancia. Per questo qui le frasi si scrivono con `dire()` e non
 * passano dai cataloghi: non sono testi della plancia da tradurre, sono
 * risposte nella lingua in cui si e' chiesto. Una domanda in un'altra lingua
 * non si capisce qui, e va ad Assist — che parla la lingua della casa.
 *
 * LA MEMORIA della conversazione torna con ogni risposta: l'ultimo intento,
 * la stanza, le cose di cui si parlava, l'azione in attesa. «e in camera?»,
 * «e fuori?», «spegnila» si capiscono con quella.
 *
 * Puro: niente DOM, niente Home Assistant. Le azioni tornano come servizi da
 * chiamare; li chiama chi disegna, dopo il tocco.
 */

import { alarmCodeNeeded } from "./alarm-panel.js";
import {
  capisci,
  frase,
  linguaDellaDomanda,
  nomeNellaFrase,
  paroleDelNome,
  stessaStanza,
} from "./capire-le-domande.js";
import { contattiDellaCasa, eUnCancello } from "./sapere-della-casa.js";

const pulito = (valore) => String(valore ?? "").trim();
const elenco = (valore) => (Array.isArray(valore) ? valore.filter(Boolean) : []);
const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "" || typeof valore === "boolean")
    return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

const MINUTO = 60_000;
const ORA = 60 * MINUTO;
const GIORNO = 24 * ORA;

/* ── le parole ───────────────────────────────────────────────────────────── */

/** La frase nella lingua della domanda. */
export function dire(lingua, it, en) {
  return lingua === "en" ? en : it;
}

const LOCALE = (l) => (l === "en" ? "en-GB" : "it-IT");

/** Un numero con la virgola (o il punto) di chi legge. */
export function cifra(valore, decimali, lingua) {
  const n = Number(valore);
  if (!Number.isFinite(n)) return "";
  try {
    return n.toLocaleString(LOCALE(lingua), {
      minimumFractionDigits: decimali,
      maximumFractionDigits: decimali,
    });
  } catch (_errore) {
    return n.toFixed(decimali);
  }
}

/* I gradi con un decimale, ma senza «,0» quando il numero e' tondo. */
function gradi(valore, lingua, unita = "°C") {
  const n = Number(valore);
  const tondo = Math.abs(n - Math.round(n)) < 0.05;
  const testo = cifra(n, tondo ? 0 : 1, lingua);
  return unita === "°" ? `${testo}°` : `${testo} ${unita}`;
}

/** «al 76%», «all'80%», «all'11%»: la preposizione davanti a un numero. */
export function alPercento(valore, lingua) {
  const n = Math.round(Number(valore));
  if (lingua === "en") return `${n}%`;
  const s = String(n);
  const vocale = s.startsWith("8") || s === "11" || s === "1" || /^11\d{3}$/.test(s);
  return `${vocale ? "all'" : "al "}${n}%`;
}

/** Una potenza: «850 W», «1,2 kW». */
export function potenza(watt, lingua) {
  const w = Math.abs(Number(watt));
  if (!Number.isFinite(w)) return "";
  if (w < 1000) return `${cifra(Math.round(w), 0, lingua)} W`;
  return `${cifra(w / 1000, 1, lingua)} kW`;
}

/** Un tempo, corto: «25 min», «2 h 10 min», «3 giorni». */
export function durata(ms, lingua) {
  const minuti = Math.max(1, Math.round(Number(ms) / MINUTO) || 1);
  if (minuti < 60) return `${minuti} min`;
  if (minuti < 48 * 60) {
    const ore = Math.floor(minuti / 60);
    const resto = minuti % 60;
    if (ore >= 6 || !resto) return `${Math.round(minuti / 60)} h`;
    return `${ore} h ${resto} min`;
  }
  const giorni = Math.round(minuti / (24 * 60));
  return `${giorni} ${dire(lingua, "giorni", "days")}`;
}

/** L'ora di un istante, «08:05». */
export function oraDi(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const GIORNI = {
  it: ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

function inizioDelGiorno(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* Quanti giorni fra oggi e quel giorno: 0 oggi, 1 domani, -1 ieri. */
function giorniDa(adesso, ms) {
  return Math.round((inizioDelGiorno(ms) - inizioDelGiorno(adesso)) / GIORNO);
}

/** Il giorno detto come lo si dice: «oggi», «domani», «giovedì». */
export function giornoDetto(adesso, ms, lingua) {
  const g = giorniDa(adesso, ms);
  if (g === 0) return dire(lingua, "oggi", "today");
  if (g === 1) return dire(lingua, "domani", "tomorrow");
  if (g === 2) return dire(lingua, "dopodomani", "the day after tomorrow");
  if (g === -1) return dire(lingua, "ieri", "yesterday");
  return GIORNI[lingua === "en" ? "en" : "it"][new Date(ms).getDay()];
}

/* Il primo carattere maiuscolo: le frasi cominciano cosi'. */
const maiuscola = (testo) => (testo ? testo[0].toUpperCase() + testo.slice(1) : testo);

/** «A», «A e B», «A, B e C», «A, B, C e altre 2». */
export function elencoNomi(nomi, lingua, quanti = 4) {
  const voci = elenco(nomi).map(pulito).filter(Boolean);
  const e = dire(lingua, " e ", " and ");
  if (voci.length <= quanti) {
    if (voci.length <= 1) return voci.join("");
    return `${voci.slice(0, -1).join(", ")}${e}${voci[voci.length - 1]}`;
  }
  const altre = voci.length - (quanti - 1);
  return `${voci.slice(0, quanti - 1).join(", ")}${e}${dire(lingua, `altre ${altre}`, `${altre} more`)}`;
}

/* «in Cucina»: la stanza con la sua preposizione. */
const inStanza = (stanza, lingua) => (stanza ? dire(lingua, `in ${stanza}`, `in ${stanza}`) : "");

/* Le condizioni del meteo di Home Assistant, a parole. */
const CONDIZIONI = {
  "clear-night": ["sereno", "clear"],
  cloudy: ["nuvoloso", "cloudy"],
  exceptional: ["condizioni eccezionali", "exceptional conditions"],
  fog: ["nebbia", "fog"],
  hail: ["grandine", "hail"],
  lightning: ["temporale", "thunderstorms"],
  "lightning-rainy": ["temporale con pioggia", "thunderstorms and rain"],
  partlycloudy: ["poco nuvoloso", "partly cloudy"],
  pouring: ["pioggia forte", "heavy rain"],
  rainy: ["pioggia", "rain"],
  snowy: ["neve", "snow"],
  "snowy-rainy": ["pioggia e neve", "sleet"],
  sunny: ["sereno", "sunny"],
  windy: ["vento", "windy"],
  "windy-variant": ["vento e nuvole", "windy and cloudy"],
};
const PIOGGIA = new Set([
  "rainy",
  "pouring",
  "lightning-rainy",
  "snowy-rainy",
  "hail",
  "lightning",
]);

export function condizioneDetta(condizione, lingua) {
  const voce = CONDIZIONI[pulito(condizione)];
  return voce ? dire(lingua, voce[0], voce[1]) : pulito(condizione).replace(/[-_]/g, " ");
}

/* ── i tasti sotto la risposta ───────────────────────────────────────────── */

/** Un tasto che fa un'altra domanda. */
const chiedi = (etichetta, testo) => ({ tipo: "chiedi", etichetta, testo: testo || etichetta });
/** Un tasto che fa una cosa: e' la conferma. */
const fai = (etichetta, servizi, fatto, pericolo = false) => ({
  tipo: "fai",
  etichetta,
  servizi,
  fatto,
  pericolo,
});
const annulla = (lingua) => ({ tipo: "annulla", etichetta: dire(lingua, "Annulla", "Cancel") });
const telecamera = (etichetta, entity) => ({ tipo: "telecamera", etichetta, entity });

/* I servizi raccolti per dominio, servizio e dati uguali: dieci luci da
 * spegnere sono una chiamata sola. */
function servizi(voci) {
  const gruppi = new Map();
  for (const v of voci) {
    if (!v) continue;
    const { entity, ...dati } = v.dati || {};
    const chiave = `${v.dominio}.${v.servizio}:${JSON.stringify(dati)}`;
    if (!gruppi.has(chiave))
      gruppi.set(chiave, { dominio: v.dominio, servizio: v.servizio, dati, entita: [] });
    gruppi.get(chiave).entita.push(entity);
  }
  return [...gruppi.values()].map((g) => ({
    dominio: g.dominio,
    servizio: g.servizio,
    dati: { entity_id: g.entita.length === 1 ? g.entita[0] : g.entita, ...g.dati },
  }));
}

/* ── le domande di esempio ───────────────────────────────────────────────── */

/**
 * Le domande da suggerire, scelte su quello che questa casa sa: chi non ha
 * telecamere non si sente proporre «mostrami il cancello».
 */
export function esempi(sapere = {}, lingua = "it", quanti = 6) {
  const fuori = [];
  const l = lingua;
  const luci = elenco(sapere.entita).filter((e) => e.dominio === "light" && !e.gruppo);
  const stanzaConLuci = luci.find((e) => e.area)?.area;
  if (elenco(sapere.dentro).length)
    fuori.push(dire(l, "Che temperatura c'è in casa?", "What's the temperature inside?"));
  if (elenco(sapere.persone).length)
    fuori.push(dire(l, "C'è qualcuno in casa?", "Is anyone home?"));
  if (luci.length) fuori.push(dire(l, "Quante luci sono accese?", "How many lights are on?"));
  if (sapere.fuori?.meteo || elenco(sapere.previsioni?.giorni).length)
    fuori.push(dire(l, "Com'è il tempo domani?", "What's the weather tomorrow?"));
  if (contattiDellaCasa(sapere).length)
    fuori.push(dire(l, "Ci sono finestre aperte?", "Are any windows open?"));
  const e = sapere.energia || {};
  if (e.casa !== null && e.casa !== undefined)
    fuori.push(dire(l, "Quanto consuma la casa?", "How much power is the house using?"));
  else if (e.solare !== null && e.solare !== undefined)
    fuori.push(dire(l, "Quanto produce il fotovoltaico?", "How much is the solar producing?"));
  const cam = elenco(sapere.telecamere)[0];
  if (cam) fuori.push(dire(l, `Mostrami ${cam.nome}`, `Show me ${cam.nome}`));
  if (stanzaConLuci)
    fuori.push(
      dire(l, `Spegni le luci in ${stanzaConLuci}`, `Turn off the lights in ${stanzaConLuci}`),
    );
  if (sapere.antifurto) fuori.push(dire(l, "L'antifurto è inserito?", "Is the alarm armed?"));
  if (elenco(sapere.eventi).length)
    fuori.push(dire(l, "Che impegni ho oggi?", "What's on my calendar today?"));
  if (!fuori.length)
    fuori.push(
      dire(l, "Che tempo fa?", "What's the weather like?"),
      dire(l, "Ci sono aggiornamenti?", "Are there any updates?"),
    );
  return fuori.slice(0, quanti);
}

/**
 * La risposta di chi non ha capito: gentile, e con le domande che si possono
 * fare. La usa anche chi ha chiesto ad Assist e ha avuto un «non conosco
 * nessuna area chiamata…».
 */
export function nonHoCapito(sapere = {}, lingua = "it", { senzaRisposta = false } = {}) {
  return {
    capita: true,
    intento: "non_capito",
    lingua,
    testo: senzaRisposta
      ? dire(
          lingua,
          "Questa non la so, e Home Assistant adesso non risponde. Sulla casa posso dirti molto, prova così:",
          "I don't know that one, and Home Assistant isn't answering right now. I can tell you a lot about the house, try:",
        )
      : dire(
          lingua,
          "Non ho capito bene. Posso dirti la temperatura, chi c'è in casa, le luci accese, il meteo, l'energia… e accendere o spegnere le cose. Prova così:",
          "I didn't quite get that. I can tell you the temperature, who's home, which lights are on, the weather, energy… and turn things on or off. Try:",
        ),
    chips: esempi(sapere, lingua, 4).map((e) => chiedi(e)),
  };
}

/** Cosa dice la casa quando si tocca «Annulla». */
export function rispostaAllAnnullo(lingua = "it") {
  return dire(lingua, "Va bene, lascio stare.", "Okay, never mind.");
}

/* Le risposte di Assist che non rispondono: «Mi dispiace, non conosco nessuna
 * area chiamata è presente in casa», «Sorry, I couldn't understand that». */
const RISPOSTE_VUOTE =
  /(non conosco nessun|non ho capito|non so come|non sono riuscit|non riesco a|non e stato possibile|non capisco|mi dispiace, non|scusa, non|sorry, i (?:couldn'?t|could not|didn'?t|am not|don'?t)|i don'?t (?:know|understand)|no (?:area|device|entity|floor) (?:called|named)|not aware of any|unexpected error|errore imprevisto|non ho trovato|nessun dispositivo|no devices? (?:found|called))/i;

/** Una risposta di Assist che e' in realta' un «non ho capito». */
export function rispostaCheNonRisponde(risposta) {
  if (!risposta) return true;
  if (risposta.errore) return true;
  const testo = pulito(risposta.testo).normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!testo) return false;
  return RISPOSTE_VUOTE.test(testo);
}

/* ── chi c'e' ────────────────────────────────────────────────────────────── */

function dovePersona(p, l, adesso) {
  const da =
    p.daQuando === null
      ? ""
      : dire(l, ` da ${durata(p.daQuando, l)}`, ` for ${durata(p.daQuando, l)}`);
  if (!p.noto) return dire(l, `Non so dove sia ${p.nome}.`, `I don't know where ${p.nome} is.`);
  if (p.inCasa) return dire(l, `${p.nome} è in casa${da}.`, `${p.nome} is home${da}.`);
  if (p.zona)
    return dire(l, `${p.nome} è in zona ${p.zona}${da}.`, `${p.nome} is at ${p.zona}${da}.`);
  return dire(l, `${p.nome} è fuori casa${da}.`, `${p.nome} is away${da}.`);
}

function quandoPersona(p, l, adesso) {
  if (!p.noto || p.daQuando === null)
    return dire(
      l,
      `Non so da quando ${p.nome} è dov'è.`,
      `I don't know since when ${p.nome} is there.`,
    );
  const il = adesso - p.daQuando;
  const giorno = giorniDa(adesso, il);
  const quando =
    giorno === 0
      ? dire(l, `dalle ${oraDi(il)}`, `since ${oraDi(il)}`)
      : dire(
          l,
          `da ${giornoDetto(adesso, il, l)} alle ${oraDi(il)}`,
          `since ${giornoDetto(adesso, il, l)} at ${oraDi(il)}`,
        );
  const fa = dire(l, `${durata(p.daQuando, l)} fa`, `${durata(p.daQuando, l)} ago`);
  if (p.inCasa)
    return dire(
      l,
      `${p.nome} è in casa ${quando} (${fa}).`,
      `${p.nome} has been home ${quando} (${fa}).`,
    );
  const dove = p.zona ? dire(l, ` (zona ${p.zona})`, ` (at ${p.zona})`) : "";
  return dire(
    l,
    `${p.nome} è fuori casa ${quando}${dove}, ${fa}.`,
    `${p.nome} has been away ${quando}${dove}, ${fa}.`,
  );
}

/* ── le risposte, intento per intento ────────────────────────────────────── */

const RISPOSTE = {};

RISPOSTE.saluto = (c, s) => {
  const l = c.lingua;
  const grazie =
    /\b(grazie|thanks|thank|thx|perfetto|ottimo|bravo|brava|great|nice|ok|okay|bene)\b/.test(
      c.testo,
    );
  return {
    testo: grazie
      ? dire(
          l,
          "Figurati! Se ti serve altro, chiedi pure.",
          "You're welcome! Ask me anything else.",
        )
      : dire(
          l,
          "Ciao! Cosa vuoi sapere della casa?",
          "Hi! What would you like to know about the house?",
        ),
    chips: esempi(s, l, 3).map((e) => chiedi(e)),
  };
};

RISPOSTE.aiuto = (c, s) => ({
  testo: dire(
    c.lingua,
    "Posso dirti la temperatura in casa e fuori, il meteo, chi c'è, le luci accese, le finestre aperte, l'antifurto, l'energia, le macchine, l'auto, l'agenda e i rifiuti. E posso accendere, spegnere, aprire e chiudere — sempre chiedendoti prima conferma. Prova:",
    "I can tell you the temperature inside and outside, the weather, who's home, which lights are on, open windows, the alarm, energy, appliances, the car, your calendar and waste collection. And I can turn things on and off, open and close — always asking you first. Try:",
  ),
  chips: esempi(s, c.lingua, 6).map((e) => chiedi(e)),
});

RISPOSTE.conferma = (c, s, m) => {
  const attesa = m.inAttesa;
  if (!attesa?.servizi?.length) return null;
  if (attesa.codice)
    return {
      testo: dire(
        c.lingua,
        "Prima mi serve il codice: scrivilo qui sotto.",
        "I need the code first: type it below.",
      ),
      inAttesa: attesa,
      codice: true,
      chips: [annulla(c.lingua)],
    };
  return { testo: attesa.fatto, esegui: attesa.servizi, inAttesa: null };
};

RISPOSTE.annulla = (c) => ({ testo: rispostaAllAnnullo(c.lingua), inAttesa: null });

RISPOSTE.codice = (c, s, m) => {
  const attesa = m.inAttesa;
  if (!attesa?.codice) return null;
  return {
    testo: attesa.fatto,
    esegui: attesa.servizi.map((v) => ({ ...v, dati: { ...v.dati, code: c.codice } })),
    inAttesa: null,
    nascondiDomanda: true,
  };
};

/* La temperatura detta con una parola su come si sta, se la si e' chiesta
 * cosi': «fa caldo in sala?». */
function come(t, l) {
  if (t < 18) return dire(l, "fa freschino", "it's chilly");
  if (t > 25.5) return dire(l, "fa caldo", "it's warm");
  return dire(l, "si sta bene", "it's comfortable");
}

function rigaDellaStanza(s, stanza) {
  return elenco(s.dentro).find((r) => stessaStanza(r.stanza, stanza)) || null;
}

/* Il termostato della stanza, quando un termometro non c'e'. */
function termostatoDellaStanza(s, stanza) {
  const clima = elenco(s.entita).find(
    (e) =>
      e.dominio === "climate" &&
      stessaStanza(e.area, stanza) &&
      numero(e.attributi?.current_temperature) !== null,
  );
  return clima
    ? {
        stanza,
        temperatura: numero(clima.attributi.current_temperature),
        umidita: numero(clima.attributi.current_humidity),
      }
    : null;
}

RISPOSTE.temperatura_dentro = (c, s) => {
  const l = c.lingua;
  const u = s.unitaTemperatura || "°C";
  const righe = elenco(s.dentro).filter((r) => r.temperatura !== null);
  const chiesto = /\b(caldo|calda|freddo|fredda|fresco|fresca|hot|cold|warm|chilly)\b/.test(
    c.testo,
  );
  const fuoriChip =
    s.fuori?.temperatura !== null && s.fuori?.temperatura !== undefined
      ? [chiedi(dire(l, "E fuori?", "And outside?"))]
      : [];
  if (c.stanza) {
    const riga = rigaDellaStanza(s, c.stanza) || termostatoDellaStanza(s, c.stanza);
    if (!riga || riga.temperatura === null) {
      const altre = righe.slice(0, 4);
      return {
        testo: altre.length
          ? dire(
              l,
              `In ${c.stanza} non ho un termometro. Lo so per ${elencoNomi(
                altre.map((r) => r.stanza),
                l,
              )}.`,
              `I don't have a thermometer in ${c.stanza}. I do for ${elencoNomi(
                altre.map((r) => r.stanza),
                l,
              )}.`,
            )
          : dire(
              l,
              `In ${c.stanza} non ho un termometro.`,
              `I don't have a thermometer in ${c.stanza}.`,
            ),
        chips: altre.map((r) =>
          chiedi(
            `${r.stanza} ${gradi(r.temperatura, l, "°")}`,
            dire(l, `che temperatura c'è in ${r.stanza}`, `temperature in ${r.stanza}`),
          ),
        ),
      };
    }
    const umido =
      riga.umidita !== null && riga.umidita !== undefined
        ? dire(
            l,
            `, umidità ${Math.round(riga.umidita)}%`,
            `, humidity ${Math.round(riga.umidita)}%`,
          )
        : "";
    const giudizio = chiesto ? `: ${come(riga.temperatura, l)}` : "";
    return {
      testo: dire(
        l,
        `In ${riga.stanza} ci sono ${gradi(riga.temperatura, l, u)}${umido}${giudizio}.`,
        `It's ${gradi(riga.temperatura, l, u)} in ${riga.stanza}${umido}${giudizio}.`,
      ),
      chips: [
        ...fuoriChip,
        ...righe
          .filter((r) => !stessaStanza(r.stanza, riga.stanza))
          .slice(0, 2)
          .map((r) =>
            chiedi(
              dire(l, `E in ${r.stanza}?`, `And ${r.stanza}?`),
              dire(l, `e in ${r.stanza}`, `and in ${r.stanza}`),
            ),
          ),
      ],
      stanza: riga.stanza,
    };
  }
  if (!righe.length)
    return {
      testo: dire(
        l,
        "Non trovo termometri in casa: scegline uno per ogni stanza nella pagina delle Stanze e te lo dico.",
        "I can't find any indoor thermometers: pick one per room on the Rooms page and I'll tell you.",
      ),
      chips: fuoriChip,
    };
  const valori = righe.map((r) => r.temperatura);
  const mediaT = valori.reduce((a, b) => a + b, 0) / valori.length;
  const umidi = righe.map((r) => r.umidita).filter((v) => v !== null && v !== undefined);
  const umido = umidi.length
    ? dire(
        l,
        ` Umidità ${Math.round(umidi.reduce((a, b) => a + b, 0) / umidi.length)}%.`,
        ` Humidity ${Math.round(umidi.reduce((a, b) => a + b, 0) / umidi.length)}%.`,
      )
    : "";
  const giudizio = chiesto
    ? dire(l, ` In generale ${come(mediaT, l)}.`, ` Overall ${come(mediaT, l)}.`)
    : "";
  let testo;
  if (righe.length === 1)
    testo = dire(
      l,
      `In casa ci sono ${gradi(mediaT, l, u)} (${righe[0].stanza}).`,
      `It's ${gradi(mediaT, l, u)} inside (${righe[0].stanza}).`,
    );
  else {
    const fredda = righe.reduce((a, b) => (b.temperatura < a.temperatura ? b : a));
    const calda = righe.reduce((a, b) => (b.temperatura > a.temperatura ? b : a));
    testo =
      Math.abs(calda.temperatura - fredda.temperatura) < 0.3
        ? dire(
            l,
            `In casa ci sono ${gradi(mediaT, l, u)}, uguali in tutte le ${righe.length} stanze.`,
            `It's ${gradi(mediaT, l, u)} inside, the same in all ${righe.length} rooms.`,
          )
        : dire(
            l,
            `In casa ci sono in media ${gradi(mediaT, l, u)}: da ${gradi(fredda.temperatura, l, "°")} in ${fredda.stanza} a ${gradi(calda.temperatura, l, "°")} in ${calda.stanza}.`,
            `It's ${gradi(mediaT, l, u)} on average inside: from ${gradi(fredda.temperatura, l, "°")} in ${fredda.stanza} to ${gradi(calda.temperatura, l, "°")} in ${calda.stanza}.`,
          );
  }
  return {
    testo: `${testo}${umido}${giudizio}`,
    chips: [
      ...fuoriChip,
      ...righe
        .slice(0, 3)
        .map((r) =>
          chiedi(
            `${r.stanza} ${gradi(r.temperatura, l, "°")}`,
            dire(l, `che temperatura c'è in ${r.stanza}`, `temperature in ${r.stanza}`),
          ),
        ),
    ],
  };
};

RISPOSTE.umidita = (c, s) => {
  const l = c.lingua;
  if (c.fuori) {
    const u = s.fuori?.umidita;
    if (u === null || u === undefined)
      return { testo: dire(l, "Non so l'umidità di fuori.", "I don't know the outdoor humidity.") };
    return {
      testo: dire(
        l,
        `Fuori l'umidità è ${alPercento(u, l)}.`,
        `Outdoor humidity is ${Math.round(u)}%.`,
      ),
    };
  }
  const righe = elenco(s.dentro).filter((r) => r.umidita !== null && r.umidita !== undefined);
  if (c.stanza) {
    const riga = righe.find((r) => stessaStanza(r.stanza, c.stanza));
    if (!riga)
      return {
        testo: dire(
          l,
          `In ${c.stanza} non ho un sensore di umidità.`,
          `I don't have a humidity sensor in ${c.stanza}.`,
        ),
      };
    const nota =
      riga.umidita >= 65
        ? dire(l, ": è alta, arieggia un po'", ": that's high, let some air in")
        : riga.umidita <= 35
          ? dire(l, ": è secca", ": that's dry")
          : "";
    return {
      testo: dire(
        l,
        `In ${riga.stanza} l'umidità è ${alPercento(riga.umidita, l)}${nota}.`,
        `Humidity in ${riga.stanza} is ${Math.round(riga.umidita)}%${nota}.`,
      ),
    };
  }
  if (!righe.length)
    return {
      testo: dire(
        l,
        "Non ho sensori di umidità in casa.",
        "I don't have any indoor humidity sensors.",
      ),
    };
  const media = Math.round(righe.reduce((a, r) => a + r.umidita, 0) / righe.length);
  const alta = righe.reduce((a, b) => (b.umidita > a.umidita ? b : a));
  return {
    testo: dire(
      l,
      `In casa l'umidità media è ${alPercento(media, l)}${righe.length > 1 ? `; la più alta è in ${alta.stanza} (${Math.round(alta.umidita)}%)` : ""}.`,
      `Average indoor humidity is ${media}%${righe.length > 1 ? `; highest in ${alta.stanza} (${Math.round(alta.umidita)}%)` : ""}.`,
    ),
  };
};

/* La previsione di quel giorno: quella con la data giusta, o la n-esima. */
function previsioneDel(s, giorno) {
  const giorni = elenco(s.previsioni?.giorni);
  const adesso = s.adesso;
  const perData = giorni.find((g) => {
    const quando = Date.parse(g?.datetime || "");
    return Number.isFinite(quando) && giorniDa(adesso, quando) === giorno;
  });
  if (perData) return perData;
  /* Una previsione senza date: la prima e' oggi. */
  if (giorni.length && !giorni.some((g) => Number.isFinite(Date.parse(g?.datetime || ""))))
    return giorni[giorno] || null;
  return null;
}

function rigaDellaPrevisione(p, l, u = "°") {
  const max = numero(p.temperature);
  const min = numero(p.templow);
  const pioggia = numero(p.precipitation_probability);
  const pezzi = [condizioneDetta(p.condition, l)];
  if (max !== null && min !== null)
    pezzi.push(
      dire(
        l,
        `tra ${gradi(min, l, u)} e ${gradi(max, l, u)}`,
        `between ${gradi(min, l, u)} and ${gradi(max, l, u)}`,
      ),
    );
  else if (max !== null)
    pezzi.push(dire(l, `massima ${gradi(max, l, u)}`, `high of ${gradi(max, l, u)}`));
  if (pioggia !== null && pioggia >= 20)
    pezzi.push(
      /* «pioggia, pioggia all'80%» si dice una volta sola. */
      PIOGGIA.has(pulito(p.condition))
        ? dire(l, `probabilità ${Math.round(pioggia)}%`, `${Math.round(pioggia)}% chance`)
        : dire(l, `pioggia ${alPercento(pioggia, l)}`, `${Math.round(pioggia)}% chance of rain`),
    );
  return pezzi.filter(Boolean).join(", ");
}

RISPOSTE.temperatura_fuori = (c, s) => {
  const l = c.lingua;
  const f = s.fuori || {};
  const oggi = previsioneDel(s, 0);
  if (f.temperatura === null || f.temperatura === undefined) {
    if (oggi) return RISPOSTE.meteo({ ...c, quando: { ...c.quando, giorno: 0 } }, s);
    return {
      testo: dire(
        l,
        "Non ho un termometro esterno né un meteo da leggere.",
        "I have no outdoor thermometer or weather to read.",
      ),
    };
  }
  const cielo = f.condizione ? `, ${condizioneDetta(f.condizione, l)}` : "";
  const giornata =
    oggi && numero(oggi.temperature) !== null
      ? dire(
          l,
          ` Oggi ${numero(oggi.templow) !== null ? `tra ${gradi(oggi.templow, l, "°")} e ` : "massima "}${gradi(oggi.temperature, l, "°")}.`,
          ` Today ${numero(oggi.templow) !== null ? `between ${gradi(oggi.templow, l, "°")} and ` : "high of "}${gradi(oggi.temperature, l, "°")}.`,
        )
      : "";
  return {
    testo: dire(
      l,
      `Fuori ci sono ${gradi(f.temperatura, l, s.unitaTemperatura || "°C")}${cielo}.${giornata}`,
      `It's ${gradi(f.temperatura, l, s.unitaTemperatura || "°C")} outside${cielo}.${giornata}`,
    ),
    chips: [
      chiedi(
        dire(l, "E domani?", "And tomorrow?"),
        dire(l, "com'è il tempo domani", "weather tomorrow"),
      ),
      ...(elenco(s.dentro).length
        ? [
            chiedi(
              dire(l, "In casa?", "Inside?"),
              dire(l, "che temperatura c'è in casa", "temperature inside"),
            ),
          ]
        : []),
    ],
  };
};

RISPOSTE.meteo = (c, s) => {
  const l = c.lingua;
  const f = s.fuori || {};
  const pioggiaChiesta = /\b(piov\w*|pioggia|ombrello|rain\w*|umbrella)\b/.test(c.testo);
  const nevChiesta = /\b(nev\w*|snow\w*)\b/.test(c.testo);
  const giorno = c.quando?.giorno ?? 0;
  if (c.quando?.settimana) {
    const prossimi = elenco(s.previsioni?.giorni)
      .filter((g) => {
        const q = Date.parse(g?.datetime || "");
        return !Number.isFinite(q) || giorniDa(s.adesso, q) >= 0;
      })
      .slice(0, 5);
    if (!prossimi.length)
      return {
        testo: dire(
          l,
          "Non ho le previsioni dei prossimi giorni.",
          "I don't have the forecast for the next days.",
        ),
      };
    const righe = prossimi.map((g, i) => {
      const q = Date.parse(g?.datetime || "");
      const nome = maiuscola(Number.isFinite(q) ? giornoDetto(s.adesso, q, l) : String(i));
      return `${nome}: ${rigaDellaPrevisione(g, l)}`;
    });
    return { testo: `${righe.join(". ")}.` };
  }
  const adessoSi =
    (c.quando?.adesso || c.quando?.giorno === null || c.quando?.giorno === undefined) &&
    giorno === 0;
  const p = previsioneDel(s, giorno);
  const quale = maiuscola(giornoDetto(s.adesso, s.adesso + giorno * GIORNO, l));
  if (!p && !(adessoSi && f.condizione))
    return {
      testo: f.meteo
        ? dire(
            l,
            `Non ho ancora le previsioni per ${giornoDetto(s.adesso, s.adesso + giorno * GIORNO, l)}.`,
            `I don't have the forecast for ${giornoDetto(s.adesso, s.adesso + giorno * GIORNO, l)} yet.`,
          )
        : dire(l, "Non ho un meteo configurato.", "There's no weather configured."),
    };
  const piove = p
    ? PIOGGIA.has(pulito(p.condition)) || (numero(p.precipitation_probability) ?? 0) >= 50
    : PIOGGIA.has(f.condizione);
  const chips = [];
  if (giorno === 0)
    chips.push(chiedi(dire(l, "E domani?", "And tomorrow?"), dire(l, "e domani", "and tomorrow")));
  else if (giorno === 1)
    chips.push(
      chiedi(
        dire(l, "E dopodomani?", "And the day after?"),
        dire(l, "e dopodomani", "and the day after tomorrow"),
      ),
    );
  chips.push(
    chiedi(
      dire(l, "Prossimi giorni", "Next days"),
      dire(l, "meteo dei prossimi giorni", "weather this week"),
    ),
  );
  let apertura = "";
  if (pioggiaChiesta || nevChiesta) {
    const neve = p ? /snow/.test(pulito(p.condition)) : /snow/.test(f.condizione);
    const si = nevChiesta ? neve : piove;
    const cosa = nevChiesta ? dire(l, "neve", "snow") : dire(l, "pioggia", "rain");
    const prob =
      p && numero(p.precipitation_probability) !== null
        ? ` (${Math.round(p.precipitation_probability)}%)`
        : "";
    const quando = giornoDetto(s.adesso, s.adesso + giorno * GIORNO, l);
    apertura = si
      ? dire(
          l,
          `Sì, ${quando} è prevista ${cosa}${prob}.`,
          `Yes, ${cosa} is expected ${quando}${prob}.`,
        )
      : dire(
          l,
          `No, ${quando} non è prevista ${cosa}${prob}.`,
          `No ${cosa} expected ${quando}${prob}.`,
        );
    if (p && !(adessoSi && f.condizione)) {
      const max = numero(p.temperature);
      const min = numero(p.templow);
      const temp =
        max !== null && min !== null
          ? dire(
              l,
              ` Tra ${gradi(min, l, "°")} e ${gradi(max, l, "°")}.`,
              ` Between ${gradi(min, l, "°")} and ${gradi(max, l, "°")}.`,
            )
          : "";
      const ombrello =
        si && !nevChiesta ? dire(l, " Meglio l'ombrello.", " Take an umbrella.") : "";
      return { testo: `${apertura}${temp}${ombrello}`, chips };
    }
    apertura += " ";
  }
  if (adessoSi && f.condizione) {
    const ora = dire(
      l,
      `Adesso è ${condizioneDetta(f.condizione, l)}${f.temperatura !== null && f.temperatura !== undefined ? `, ${gradi(f.temperatura, l, s.unitaTemperatura || "°C")}` : ""}.`,
      `Right now it's ${condizioneDetta(f.condizione, l)}${f.temperatura !== null && f.temperatura !== undefined ? `, ${gradi(f.temperatura, l, s.unitaTemperatura || "°C")}` : ""}.`,
    );
    const resto = p
      ? dire(l, ` Oggi: ${rigaDellaPrevisione(p, l)}.`, ` Today: ${rigaDellaPrevisione(p, l)}.`)
      : "";
    return { testo: `${apertura}${ora}${resto}`, chips };
  }
  const consiglio =
    piove && !pioggiaChiesta ? dire(l, " Meglio l'ombrello.", " Take an umbrella.") : "";
  return { testo: `${apertura}${quale}: ${rigaDellaPrevisione(p, l)}.${consiglio}`, chips };
};

RISPOSTE.chi_in_casa = (c, s) => {
  const l = c.lingua;
  const persone = elenco(s.persone);
  if (!persone.length)
    return {
      testo: dire(
        l,
        "Non seguo nessuna persona: aggiungile in Config › Persone e te lo dico.",
        "I'm not tracking anyone: add people in Config › People and I'll tell you.",
      ),
    };
  const dentro = persone.filter((p) => p.inCasa);
  const fuori = persone.filter((p) => !p.inCasa);
  const chips = fuori
    .slice(0, 3)
    .map((p) => chiedi(dire(l, `Dov'è ${p.nome}?`, `Where is ${p.nome}?`)));
  if (!dentro.length) {
    const quando = fuori
      .filter((p) => p.daQuando !== null)
      .map((p) =>
        dire(l, `${p.nome} da ${durata(p.daQuando, l)}`, `${p.nome} for ${durata(p.daQuando, l)}`),
      );
    return {
      testo: dire(
        l,
        `Non c'è nessuno in casa.${quando.length ? ` Fuori: ${elencoNomi(quando, l)}.` : ""}`,
        `Nobody is home.${quando.length ? ` Away: ${elencoNomi(quando, l)}.` : ""}`,
      ),
      chips,
    };
  }
  if (!fuori.length)
    return {
      testo:
        dentro.length === 1
          ? dire(l, `Sì, in casa c'è ${dentro[0].nome}.`, `Yes, ${dentro[0].nome} is home.`)
          : dire(
              l,
              `Sì, siete tutti in casa: ${elencoNomi(
                dentro.map((p) => p.nome),
                l,
              )}.`,
              `Yes, everyone is home: ${elencoNomi(
                dentro.map((p) => p.nome),
                l,
              )}.`,
            ),
    };
  const fuoriDetti = fuori.map((p) =>
    p.zona ? dire(l, `${p.nome} (${p.zona})`, `${p.nome} (${p.zona})`) : p.nome,
  );
  return {
    testo: dire(
      l,
      `Sì: in casa ${dentro.length === 1 ? "c'è" : "ci sono"} ${elencoNomi(
        dentro.map((p) => p.nome),
        l,
      )}. Fuori: ${elencoNomi(fuoriDetti, l)}.`,
      `Yes: ${elencoNomi(
        dentro.map((p) => p.nome),
        l,
      )} ${dentro.length === 1 ? "is" : "are"} home. Away: ${elencoNomi(fuoriDetti, l)}.`,
    ),
    chips,
  };
};

RISPOSTE.dove_e = (c, s) => {
  const p = elenco(s.persone).find((x) => x.nome === c.persona?.nome) || c.persona;
  if (!p) return null;
  return {
    testo: dovePersona(p, c.lingua, s.adesso),
    chips: [
      chiedi(
        dire(c.lingua, "Da quando?", "Since when?"),
        dire(c.lingua, `da quando ${p.nome} è lì`, `when did ${p.nome} leave`),
      ),
    ],
  };
};

RISPOSTE.quando_uscito = (c, s) => {
  const p = elenco(s.persone).find((x) => x.nome === c.persona?.nome) || c.persona;
  if (!p) return null;
  return { testo: quandoPersona(p, c.lingua, s.adesso) };
};

/* ── le luci, le aperture, le tapparelle ─────────────────────────────────── */

const ACCESO = (e) => !["off", "unavailable", "unknown", "standby", "idle", ""].includes(e.stato);

function luciDellaCasa(s) {
  return elenco(s.entita).filter((e) => e.dominio === "light" && !e.gruppo);
}

RISPOSTE.luci = (c, s) => {
  const l = c.lingua;
  let luci = luciDellaCasa(s);
  if (c.stanza) luci = luci.filter((e) => stessaStanza(e.area, c.stanza));
  const dove = c.stanza ? ` ${inStanza(c.stanza, l)}` : "";
  if (!luci.length)
    return {
      testo: c.stanza
        ? dire(
            l,
            `In ${c.stanza} non conosco nessuna luce.`,
            `I don't know any lights in ${c.stanza}.`,
          )
        : dire(l, "Non conosco nessuna luce in casa.", "I don't know any lights in the house."),
    };
  const spente =
    /\b(spent[eaio]|off)\b/.test(c.testo) && !/\b(accese|acceso|accesa|accesi|on)\b/.test(c.testo);
  if (spente) {
    const quali = luci.filter((e) => !ACCESO(e));
    return {
      testo: quali.length
        ? dire(
            l,
            `Sono spente ${quali.length} luci${dove}: ${elencoNomi(
              quali.map((e) => e.nome),
              l,
              5,
            )}.`,
            `${quali.length} lights are off${dove}: ${elencoNomi(
              quali.map((e) => e.nome),
              l,
              5,
            )}.`,
          )
        : dire(l, `Sono tutte accese${dove}.`, `They're all on${dove}.`),
      soggetto: quali.map((e) => e.entity),
    };
  }
  const accese = luci.filter(ACCESO);
  if (!accese.length)
    return {
      testo: c.stanza
        ? dire(l, `In ${c.stanza} le luci sono spente.`, `The lights in ${c.stanza} are off.`)
        : dire(l, "Tutte le luci sono spente.", "All the lights are off."),
      soggetto: luci.map((e) => e.entity),
    };
  const nomi = elencoNomi(
    accese.map((e) => e.nome),
    l,
    5,
  );
  const testo =
    accese.length === 1
      ? dire(
          l,
          `${c.stanza ? `In ${c.stanza} è` : "È"} accesa una luce: ${nomi}.`,
          `One light is on${dove}: ${nomi}.`,
        )
      : dire(
          l,
          `${c.stanza ? `In ${c.stanza} sono` : "Sono"} accese ${accese.length} luci: ${nomi}.`,
          `${accese.length} lights are on${dove}: ${nomi}.`,
        );
  const comandabili = accese.filter((e) => e.comandabile);
  return {
    testo,
    soggetto: accese.map((e) => e.entity),
    chips: comandabili.length
      ? [
          fai(
            accese.length === 1
              ? dire(l, "Spegnila", "Turn it off")
              : dire(l, "Spegnile tutte", "Turn them all off"),
            servizi(
              comandabili.map((e) => ({
                dominio: "light",
                servizio: "turn_off",
                dati: { entity: e.entity },
              })),
            ),
            accese.length === 1
              ? dire(l, `Fatto: ho spento ${accese[0].nome}.`, `Done: ${accese[0].nome} is off.`)
              : dire(
                  l,
                  `Fatto: ho spento ${comandabili.length} luci.`,
                  `Done: ${comandabili.length} lights off.`,
                ),
          ),
        ]
      : [],
  };
};

/* «2 finestre e 1 porta aperte». */
function contoDelleAperture(finestre, porte, l) {
  const pezzi = [];
  if (finestre)
    pezzi.push(
      dire(
        l,
        `${finestre} ${finestre === 1 ? "finestra" : "finestre"}`,
        `${finestre} ${finestre === 1 ? "window" : "windows"}`,
      ),
    );
  if (porte)
    pezzi.push(
      dire(
        l,
        `${porte} ${porte === 1 ? "porta" : "porte"}`,
        `${porte} ${porte === 1 ? "door" : "doors"}`,
      ),
    );
  const una = finestre + porte === 1;
  return dire(
    l,
    `${pezzi.join(" e ")} ${una ? "aperta" : "aperte"}`,
    `${pezzi.join(" and ")} open`,
  );
}

RISPOSTE.aperture = (c, s) => {
  const l = c.lingua;
  const vuoleFinestre = /\b(finestr\w*|lucernar\w*|velux|windows?)\b/.test(c.testo);
  const vuolePorte = /\b(port[ae]|portone|portoncino|doors?|ingresso)\b/.test(c.testo);
  const vuoleCancello = c.categoria === "cancello";
  let contatti = contattiDellaCasa(s);
  if (c.stanza) contatti = contatti.filter((e) => stessaStanza(e.area, c.stanza));
  const eFinestra = (e) => e.classe === "window" || /(finestr|window|velux|lucernar)/i.test(e.nome);
  if (vuoleFinestre && !vuolePorte) contatti = contatti.filter(eFinestra);
  else if (vuolePorte && !vuoleFinestre) contatti = contatti.filter((e) => !eFinestra(e));
  const cancelli = elenco(s.entita).filter((e) => e.dominio === "cover" && eUnCancello(e));
  const cancelliAperti = cancelli.filter((e) => ["open", "opening"].includes(e.stato));
  const parteCancelli = vuoleCancello || (!vuoleFinestre && !vuolePorte);
  const cancelliDetti = parteCancelli
    ? cancelliAperti.length
      ? dire(
          l,
          ` Aperto anche: ${elencoNomi(
            cancelliAperti.map((e) => e.nome),
            l,
          )}.`,
          ` Also open: ${elencoNomi(
            cancelliAperti.map((e) => e.nome),
            l,
          )}.`,
        )
      : ""
    : "";
  if (vuoleCancello && !vuoleFinestre && !vuolePorte) {
    if (!cancelli.length)
      return {
        testo: dire(
          l,
          "Non conosco un cancello o un garage da guardare.",
          "I don't know any gate or garage.",
        ),
      };
    return {
      testo: cancelliAperti.length
        ? dire(
            l,
            `È aperto: ${elencoNomi(
              cancelliAperti.map((e) => e.nome),
              l,
            )}.`,
            `Open: ${elencoNomi(
              cancelliAperti.map((e) => e.nome),
              l,
            )}.`,
          )
        : dire(
            l,
            `${elencoNomi(
              cancelli.map((e) => e.nome),
              l,
            )}: chiuso.`,
            `${elencoNomi(
              cancelli.map((e) => e.nome),
              l,
            )}: closed.`,
          ),
      soggetto: cancelli.map((e) => e.entity),
      chips: cancelliAperti
        .filter((e) => e.comandabile)
        .slice(0, 2)
        .map((e) => chiedi(dire(l, `Chiudi ${e.nome}`, `Close ${e.nome}`))),
    };
  }
  if (!contatti.length && !cancelli.length)
    return {
      testo: dire(
        l,
        "Non ho sensori su porte e finestre da guardare.",
        "I have no door or window sensors to check.",
      ),
    };
  const aperti = contatti.filter((e) => e.stato === "on");
  const dove = c.stanza ? ` ${inStanza(c.stanza, l)}` : "";
  if (!aperti.length) {
    const cosa =
      vuoleFinestre && !vuolePorte
        ? dire(l, "Le finestre sono tutte chiuse", "All windows are closed")
        : vuolePorte && !vuoleFinestre
          ? dire(l, "Le porte sono tutte chiuse", "All doors are closed")
          : dire(l, "Porte e finestre sono tutte chiuse", "All doors and windows are closed");
    return { testo: `${cosa}${dove}.${cancelliDetti}` };
  }
  const finestre = aperti.filter(eFinestra).length;
  const porte = aperti.length - finestre;
  const conto = contoDelleAperture(finestre, porte, l);
  const nomi = elencoNomi(
    aperti.map((e) =>
      e.daQuando !== null && e.daQuando >= 10 * MINUTO
        ? `${e.nome} (${durata(e.daQuando, l)})`
        : e.nome,
    ),
    l,
    5,
  );
  const una = aperti.length === 1;
  return {
    testo: dire(
      l,
      `${una ? "C'è" : "Ci sono"} ${conto}${dove}: ${nomi}.${cancelliDetti}`,
      `There ${una ? "is" : "are"} ${conto}${dove}: ${nomi}.${cancelliDetti}`,
    ),
    soggetto: aperti.map((e) => e.entity),
  };
};

RISPOSTE.tapparelle = (c, s) => {
  const l = c.lingua;
  let tapparelle = elenco(s.entita).filter(
    (e) => e.dominio === "cover" && !eUnCancello(e) && !e.gruppo,
  );
  if (c.stanza) tapparelle = tapparelle.filter((e) => stessaStanza(e.area, c.stanza));
  if (!tapparelle.length)
    return {
      testo: dire(
        l,
        "Non conosco tapparelle o tende da guardare.",
        "I don't know any blinds or shades.",
      ),
    };
  const aperte = tapparelle.filter(
    (e) =>
      ["open", "opening"].includes(e.stato) || (numero(e.attributi?.current_position) ?? 0) > 0,
  );
  const dove = c.stanza ? ` ${inStanza(c.stanza, l)}` : "";
  if (!aperte.length)
    return {
      testo: dire(l, `Le tapparelle sono tutte chiuse${dove}.`, `All blinds are closed${dove}.`),
      soggetto: tapparelle.map((e) => e.entity),
    };
  const nomi = elencoNomi(
    aperte.map((e) => {
      const pos = numero(e.attributi?.current_position);
      return pos !== null && pos < 100 ? `${e.nome} (${pos}%)` : e.nome;
    }),
    l,
    5,
  );
  const comandabili = aperte.filter((e) => e.comandabile);
  return {
    testo:
      aperte.length === 1
        ? dire(l, `È aperta ${nomi}${dove}.`, `${nomi} is open${dove}.`)
        : dire(
            l,
            `Sono aperte ${aperte.length} tapparelle${dove}: ${nomi}.`,
            `${aperte.length} blinds are open${dove}: ${nomi}.`,
          ),
    soggetto: aperte.map((e) => e.entity),
    chips: comandabili.length
      ? [
          fai(
            aperte.length === 1
              ? dire(l, "Chiudila", "Close it")
              : dire(l, "Chiudile tutte", "Close them all"),
            servizi(
              comandabili.map((e) => ({
                dominio: "cover",
                servizio: "close_cover",
                dati: { entity: e.entity },
              })),
            ),
            dire(
              l,
              `Fatto: chiudo ${comandabili.length === 1 ? comandabili[0].nome : `${comandabili.length} tapparelle`}.`,
              `Done: closing ${comandabili.length === 1 ? comandabili[0].nome : `${comandabili.length} blinds`}.`,
            ),
          ),
        ]
      : [],
  };
};

/* ── l'antifurto ─────────────────────────────────────────────────────────── */

const STATI_ANTIFURTO = {
  disarmed: ["disinserito", "disarmed"],
  armed_away: ["inserito (fuori casa)", "armed (away)"],
  armed_home: ["inserito (in casa)", "armed (home)"],
  armed_night: ["inserito (notte)", "armed (night)"],
  armed_vacation: ["inserito (vacanza)", "armed (vacation)"],
  armed_custom_bypass: ["inserito (parziale)", "armed (custom)"],
  arming: ["in inserimento", "arming"],
  disarming: ["in disinserimento", "disarming"],
  pending: ["in attesa", "pending"],
  triggered: ["SCATTATO: sta suonando", "TRIGGERED: it's sounding"],
  unavailable: ["non raggiungibile", "unavailable"],
};

RISPOSTE.antifurto_stato = (c, s) => {
  const l = c.lingua;
  const a = s.antifurto;
  if (!a)
    return { testo: dire(l, "Non ho un antifurto collegato.", "There's no alarm connected.") };
  const detto = STATI_ANTIFURTO[a.stato];
  const stato = detto ? dire(l, detto[0], detto[1]) : a.stato;
  const inserito = /^armed|^arming|^pending|^triggered/.test(a.stato);
  return {
    testo: dire(l, `L'antifurto è ${stato}.`, `The alarm is ${stato}.`),
    chips: [
      inserito
        ? chiedi(
            dire(l, "Disinserisci", "Disarm"),
            dire(l, "disinserisci l'antifurto", "disarm the alarm"),
          )
        : chiedi(dire(l, "Inserisci", "Arm"), dire(l, "inserisci l'antifurto", "arm the alarm")),
    ],
  };
};

const MODI = {
  away: ["alarm_arm_away", "fuori casa", "away"],
  home: ["alarm_arm_home", "in casa", "home"],
  night: ["alarm_arm_night", "notte", "night"],
};

RISPOSTE.antifurto_comando = (c, s) => {
  const l = c.lingua;
  const a = s.antifurto;
  if (!a)
    return { testo: dire(l, "Non ho un antifurto collegato.", "There's no alarm connected.") };
  const disarma = c.azione === "disarma";
  if (disarma && a.stato === "disarmed")
    return { testo: dire(l, "L'antifurto è già disinserito.", "The alarm is already disarmed.") };
  if (!disarma && /^armed/.test(a.stato)) {
    const detto = STATI_ANTIFURTO[a.stato];
    return {
      testo: dire(l, `L'antifurto è già ${detto[0]}.`, `The alarm is already ${detto[1]}.`),
    };
  }
  const modo = MODI[c.modo] || MODI.away;
  const servizio = disarma ? "alarm_disarm" : modo[0];
  const chiamata = servizi([
    { dominio: "alarm_control_panel", servizio, dati: { entity: a.entity } },
  ]);
  const fatto = disarma
    ? dire(l, "Mando il comando: disinserisco l'antifurto.", "Sending it: disarming the alarm.")
    : dire(
        l,
        `Mando il comando: inserisco l'antifurto (${modo[1]}).`,
        `Sending it: arming the alarm (${modo[2]}).`,
      );
  const serveCodice = alarmCodeNeeded(a.statoHa || { attributes: a.attributi }, servizio);
  if (serveCodice)
    return {
      testo: disarma
        ? dire(
            l,
            "Per disinserire l'antifurto serve il codice: scrivilo qui sotto.",
            "Disarming needs the code: type it below.",
          )
        : dire(
            l,
            `Per inserire l'antifurto (${modo[1]}) serve il codice: scrivilo qui sotto.`,
            `Arming (${modo[2]}) needs the code: type it below.`,
          ),
      inAttesa: { servizi: chiamata, fatto, codice: true },
      codice: true,
      chips: [annulla(l)],
    };
  return {
    testo: disarma
      ? dire(l, "Disinserisco l'antifurto? Confermalo.", "Disarm the alarm? Please confirm.")
      : dire(
          l,
          `Inserisco l'antifurto in modalità ${modo[1]}? Confermalo.`,
          `Arm the alarm in ${modo[2]} mode? Please confirm.`,
        ),
    inAttesa: { servizi: chiamata, fatto },
    chips: [
      fai(
        disarma ? dire(l, "Sì, disinserisci", "Yes, disarm") : dire(l, "Sì, inserisci", "Yes, arm"),
        chiamata,
        fatto,
        true,
      ),
      annulla(l),
    ],
  };
};

/* ── i bersagli dei comandi ──────────────────────────────────────────────── */

/* Tutte le cose che la frase nomina meglio, a pari merito: «spegni le luci
 * del pensile» con due pensili li spegne tutti e due. */
function perNome(c, voci) {
  const f = frase(c.testo);
  const stanzaParole = c.stanza ? paroleDelNome(c.stanza) : [];
  /* Le parole delle categorie non bastano a nominare una cosa: «luce» non e'
   * il nome della luce della cucina. */
  const generiche = paroleDelNome(
    "luce luci lampada lampadina light lights tapparella tapparelle tenda tende persiana persiane cover blind blinds presa prese plug switch interruttore ventilatore fan clima climatizzatore condizionatore termostato riscaldamento tv televisore porta serratura lock cancello gate garage",
  );
  const giro = (trascurare) => {
    let migliori = [];
    let punti = 0;
    for (const voce of voci) {
      const dove = nomeNellaFrase(voce.nome, f, trascurare);
      if (!dove.tutte || !dove.parole) continue;
      if (c.stanza && voce.area && !stessaStanza(voce.area, c.stanza)) continue;
      if (dove.parole > punti) {
        punti = dove.parole;
        migliori = [voce];
      } else if (dove.parole === punti) migliori.push(voce);
    }
    return migliori;
  };
  /* Prima senza le parole delle categorie; poi, se niente, il nome intero:
   * «apri il cancello» con un cancello che si chiama proprio «Cancello». */
  const primo = giro([...stanzaParole, ...generiche]);
  return primo.length ? primo : giro(stanzaParole);
}

/* «spegni tutto», «chiudi tutto»: senza una categoria, «tutto» sono le luci
 * (e per spegnere anche la tv e i ventilatori), le tapparelle per aprire e
 * chiudere. Mai le prese — dietro una presa puo' esserci il frigo — mai le
 * serrature, mai l'acqua. */
const DOMINI_DI_TUTTO = {
  accendi: ["light"],
  spegni: ["light", "media_player", "fan"],
  inverti: ["light"],
  apri: ["cover"],
  chiudi: ["cover"],
  alza: ["cover"],
  abbassa: ["cover"],
  ferma: ["cover"],
};

/* I domini che un verbo comanda quando la frase non dice la categoria. */
const DOMINI_DEL_VERBO = {
  accendi: ["light", "switch", "fan", "media_player", "input_boolean", "climate", "humidifier"],
  spegni: ["light", "switch", "fan", "media_player", "input_boolean", "climate", "humidifier"],
  inverti: ["light", "switch", "fan", "input_boolean"],
  apri: ["cover", "valve", "lock"],
  chiudi: ["cover", "valve", "lock"],
  alza: ["cover"],
  abbassa: ["cover"],
  ferma: ["cover"],
};

/**
 * Su cosa agisce un comando: per nome, per stanza, «tutte», il «la/le» della
 * domanda di prima, o l'unica che c'e'. Torna `{ bersagli }` o `{ quali }`
 * quando ce ne sono tante e non si sa quale.
 */
function bersagliDel(c, s, m, domini) {
  let candidati = elenco(s.entita).filter(
    (e) => e.comandabile && domini.includes(e.dominio) && !e.gruppo,
  );
  if (c.categoria === "cancello") candidati = candidati.filter(eUnCancello);
  else if (c.categoria === "tapparelle") candidati = candidati.filter((e) => !eUnCancello(e));
  else if (c.categoria === "prese")
    candidati = candidati.filter((e) => ["switch", "input_boolean"].includes(e.dominio));
  const soggetto = new Set(elenco(m?.soggetto));
  if (c.pronome && soggetto.size) {
    const quelli = candidati.filter((e) => soggetto.has(e.entity));
    if (quelli.length) return { bersagli: quelli };
  }
  const nominati = perNome(c, candidati);
  if (nominati.length) return { bersagli: nominati };
  if (c.stanza)
    return { bersagli: candidati.filter((e) => stessaStanza(e.area, c.stanza)), stanza: c.stanza };
  if (c.tutte || c.plurale) {
    /* «spegni le luci» dopo «quali luci sono accese in cucina?» sono quelle. */
    if (c.plurale && !c.tutte && soggetto.size) {
      const quelli = candidati.filter((e) => soggetto.has(e.entity));
      if (quelli.length) return { bersagli: quelli };
    }
    return { bersagli: candidati };
  }
  if (!c.categoria && soggetto.size) {
    const quelli = candidati.filter((e) => soggetto.has(e.entity));
    if (quelli.length) return { bersagli: quelli };
  }
  if (candidati.length === 1) return { bersagli: candidati };
  return { quali: candidati };
}

/* Il servizio di un verbo su un'entita'. `null` se quel verbo non le si
 * addice: le tapparelle non si «accendono». */
function servizioPer(e, azione, numeri = {}) {
  const d = e.dominio;
  const pct = numeri.percento;
  if (d === "cover") {
    if (
      pct !== null &&
      pct !== undefined &&
      ["apri", "alza", "chiudi", "abbassa", "imposta"].includes(azione)
    )
      return {
        dominio: d,
        servizio: "set_cover_position",
        dati: { entity: e.entity, position: Math.max(0, Math.min(100, Math.round(pct))) },
      };
    if (azione === "apri" || azione === "alza")
      return { dominio: d, servizio: "open_cover", dati: { entity: e.entity } };
    if (azione === "chiudi" || azione === "abbassa")
      return { dominio: d, servizio: "close_cover", dati: { entity: e.entity } };
    if (azione === "ferma")
      return { dominio: d, servizio: "stop_cover", dati: { entity: e.entity } };
    if (azione === "inverti") return { dominio: d, servizio: "toggle", dati: { entity: e.entity } };
    return null;
  }
  if (d === "lock") {
    if (azione === "apri" || azione === "sblocca")
      return { dominio: d, servizio: "unlock", dati: { entity: e.entity } };
    if (azione === "chiudi" || azione === "blocca")
      return { dominio: d, servizio: "lock", dati: { entity: e.entity } };
    return null;
  }
  if (d === "valve") {
    if (azione === "apri")
      return { dominio: d, servizio: "open_valve", dati: { entity: e.entity } };
    if (azione === "chiudi")
      return { dominio: d, servizio: "close_valve", dati: { entity: e.entity } };
    return null;
  }
  if (d === "light" && azione === "accendi" && pct !== null && pct !== undefined)
    return {
      dominio: d,
      servizio: "turn_on",
      dati: { entity: e.entity, brightness_pct: Math.max(1, Math.min(100, Math.round(pct))) },
    };
  if (azione === "accendi") return { dominio: d, servizio: "turn_on", dati: { entity: e.entity } };
  if (azione === "spegni") return { dominio: d, servizio: "turn_off", dati: { entity: e.entity } };
  if (azione === "inverti") return { dominio: d, servizio: "toggle", dati: { entity: e.entity } };
  return null;
}

/* Chi e' gia' come lo si vuole non si comanda: «spegni le luci» spegne quelle
 * accese. */
function daCambiare(e, azione, numeri = {}) {
  if (numeri.percento !== null && numeri.percento !== undefined) return true;
  if (azione === "accendi") return !ACCESO(e) || e.stato === "standby";
  if (azione === "spegni") return ACCESO(e);
  if (e.dominio === "cover" && ["apri", "alza"].includes(azione))
    return e.stato !== "open" || (numero(e.attributi?.current_position) ?? 100) < 100;
  if (e.dominio === "cover" && ["chiudi", "abbassa"].includes(azione)) return e.stato !== "closed";
  if (e.dominio === "lock" && azione === "apri") return e.stato !== "unlocked";
  if (e.dominio === "lock" && azione === "chiudi") return e.stato !== "locked";
  return true;
}

/* Per ogni verbo: come si propone, come si conferma, cosa si dice dopo, e lo
 * stato in cui una cosa e' gia' (al femminile e al maschile, singolare e
 * plurale: la luce e' spenta, il ventilatore e' spento). */
const VERBI_DETTI = {
  accendi: [
    ["Accendo", "Sì, accendi", "ho acceso", ["accesa", "accese", "acceso", "accesi"]],
    ["Turn on", "Yes, turn on", "turned on", "on"],
  ],
  spegni: [
    ["Spengo", "Sì, spegni", "ho spento", ["spenta", "spente", "spento", "spenti"]],
    ["Turn off", "Yes, turn off", "turned off", "off"],
  ],
  inverti: [
    [
      "Inverto",
      "Sì, inverti",
      "ho invertito",
      ["invertita", "invertite", "invertito", "invertiti"],
    ],
    ["Toggle", "Yes, toggle", "toggled", "toggled"],
  ],
  apri: [
    ["Apro", "Sì, apri", "sto aprendo", ["aperta", "aperte", "aperto", "aperti"]],
    ["Open", "Yes, open", "opening", "open"],
  ],
  alza: [
    ["Alzo", "Sì, alza", "sto alzando", ["alzata", "alzate", "alzato", "alzati"]],
    ["Raise", "Yes, raise", "raising", "up"],
  ],
  chiudi: [
    ["Chiudo", "Sì, chiudi", "sto chiudendo", ["chiusa", "chiuse", "chiuso", "chiusi"]],
    ["Close", "Yes, close", "closing", "closed"],
  ],
  abbassa: [
    [
      "Abbasso",
      "Sì, abbassa",
      "sto abbassando",
      ["abbassata", "abbassate", "abbassato", "abbassati"],
    ],
    ["Lower", "Yes, lower", "lowering", "down"],
  ],
  ferma: [
    ["Fermo", "Sì, ferma", "ho fermato", ["ferma", "ferme", "fermo", "fermi"]],
    ["Stop", "Yes, stop", "stopped", "stopped"],
  ],
};

/* Le cose femminili: la luce, la tapparella, la presa. */
const FEMMINILI = new Set(["light", "cover", "switch", "input_boolean", "valve"]);

/* Il nome con la sua categoria davanti, quando il nome da solo e' quello di
 * una stanza: «la luce Cucina», non «Cucina». */
function nomeCompleto(e, l) {
  const parole = paroleDelNome(e.nome);
  if (
    e.dominio === "light" &&
    !parole.some((p) => /^(luc|lamp|light|led|faret|plafon|abat|applique|strisc|lum)/.test(p))
  )
    return dire(l, `la luce ${e.nome}`, `the ${e.nome} light`);
  return e.nome;
}

/* I verbi come si scrivono in inglese, per i tasti che rifanno la domanda. */
const VERBI_INGLESI = {
  accendi: "turn on",
  spegni: "turn off",
  inverti: "toggle",
  apri: "open",
  alza: "raise",
  chiudi: "close",
  abbassa: "lower",
  ferma: "stop",
};

/* Come si chiamano, al plurale, le cose di un dominio. */
function quante(n, domini, l) {
  const tutti = new Set(domini);
  const nomi =
    tutti.size === 1 && tutti.has("light")
      ? ["luce", "luci", "light", "lights"]
      : tutti.size === 1 && tutti.has("cover")
        ? ["tapparella", "tapparelle", "cover", "covers"]
        : ["dispositivo", "dispositivi", "device", "devices"];
  return dire(l, `${n} ${n === 1 ? nomi[0] : nomi[1]}`, `${n} ${n === 1 ? nomi[2] : nomi[3]}`);
}

RISPOSTE.comando = (c, s, m) => {
  const l = c.lingua;
  const azione = c.azione;
  if (!VERBI_DETTI[azione]) return null;
  const domini = c.domini?.length
    ? c.domini
    : (c.tutte || c.plurale) && !c.stanza
      ? DOMINI_DI_TUTTO[azione] || []
      : DOMINI_DEL_VERBO[azione] || [];
  let scelta = bersagliDel(c, s, m, domini);
  /* «chiudi tutto» non chiude il cancello: quello si nomina. */
  if (!c.domini?.length && (c.tutte || c.plurale) && scelta.bersagli)
    scelta = { ...scelta, bersagli: scelta.bersagli.filter((e) => !eUnCancello(e)) };
  /* «apri la porta» con una serratura: e' uno sblocco, e si conferma come
   * quelli. */
  if (scelta.bersagli?.length && scelta.bersagli.every((e) => e.dominio === "lock"))
    return RISPOSTE.serratura_comando(
      { ...c, azione: azione === "apri" ? "sblocca" : "blocca" },
      s,
      m,
    );
  if (scelta.quali) {
    if (!scelta.quali.length)
      return {
        testo: dire(
          l,
          "Non trovo niente da comandare con quel nome.",
          "I can't find anything with that name to control.",
        ),
        chips: esempi(s, l, 3).map((e) => chiedi(e)),
      };
    const verbo = dire(l, azione, VERBI_INGLESI[azione] || azione);
    return {
      testo: dire(l, "Quale?", "Which one?"),
      chips: scelta.quali
        .slice(0, 6)
        .map((e) =>
          chiedi(
            `${e.nome}${e.area && !paroleDelNome(e.nome).join(" ").includes(paroleDelNome(e.area).join(" ")) ? ` · ${e.area}` : ""}`,
            `${verbo} ${e.nome}`,
          ),
        ),
    };
  }
  const tutti = scelta.bersagli || [];
  const dove = c.stanza ? ` ${inStanza(c.stanza, l)}` : "";
  if (!tutti.length)
    return {
      testo: c.stanza
        ? dire(
            l,
            `In ${c.stanza} non trovo niente da comandare così.`,
            `I can't find anything to control like that in ${c.stanza}.`,
          )
        : dire(
            l,
            "Non trovo niente da comandare così.",
            "I can't find anything to control like that.",
          ),
    };
  const conServizio = tutti
    .filter((e) => daCambiare(e, azione, c.numeri))
    .map((e) => ({ e, v: servizioPer(e, azione, c.numeri) }))
    .filter((x) => x.v);
  const [it, en] = VERBI_DETTI[azione];
  if (!conServizio.length) {
    const femminile = tutti.every((e) => FEMMINILI.has(e.dominio));
    const stato = it[3][(femminile ? 0 : 2) + (tutti.length === 1 ? 0 : 1)];
    return {
      testo:
        tutti.length === 1
          ? dire(
              l,
              `${maiuscola(nomeCompleto(tutti[0], l))} è già ${stato}.`,
              `${maiuscola(nomeCompleto(tutti[0], l))} is already ${en[3]}.`,
            )
          : dire(
              l,
              `${maiuscola(
                quante(
                  tutti.length,
                  tutti.map((e) => e.dominio),
                  l,
                ),
              )}${dove}: sono già ${stato}.`,
              `${maiuscola(
                quante(
                  tutti.length,
                  tutti.map((e) => e.dominio),
                  l,
                ),
              )}${dove}: already ${en[3]}.`,
            ),
      soggetto: tutti.map((e) => e.entity),
    };
  }
  const voci = conServizio.map((x) => x.e);
  const chiamata = servizi(conServizio.map((x) => x.v));
  const pericolo = voci.some((e) => eUnCancello(e));
  const pct = c.numeri?.percento;
  const alPct =
    pct !== null && pct !== undefined
      ? dire(l, ` ${alPercento(pct, l)}`, ` to ${Math.round(pct)}%`)
      : "";
  const unaSola = voci.length === 1 ? nomeCompleto(voci[0], l) : "";
  const cosa =
    voci.length === 1
      ? `${unaSola}${c.stanza && !stessaStanza(voci[0].nome, c.stanza) && !paroleDelNome(voci[0].nome).some((p) => paroleDelNome(c.stanza).includes(p)) ? ` (${c.stanza})` : ""}`
      : `${quante(
          voci.length,
          voci.map((e) => e.dominio),
          l,
        )}${dove} (${elencoNomi(
          voci.map((e) => e.nome),
          l,
          4,
        )})`;
  const domanda = `${dire(l, `${it[0]} ${cosa}${alPct}?`, `${en[0]} ${cosa}${alPct}?`)}${pericolo ? dire(l, " Confermalo.", " Please confirm.") : ""}`;
  const fatto =
    voci.length === 1
      ? dire(l, `Fatto: ${it[2]} ${unaSola}${alPct}.`, `Done: ${en[2]} ${unaSola}${alPct}.`)
      : dire(
          l,
          `Fatto: ${it[2]} ${quante(
            voci.length,
            voci.map((e) => e.dominio),
            l,
          )}${alPct}.`,
          `Done: ${en[2]} ${quante(
            voci.length,
            voci.map((e) => e.dominio),
            l,
          )}${alPct}.`,
        );
  return {
    testo: domanda,
    soggetto: voci.map((e) => e.entity),
    inAttesa: { servizi: chiamata, fatto },
    chips: [fai(dire(l, it[1], en[1]), chiamata, fatto, pericolo), annulla(l)],
  };
};

RISPOSTE.serratura_comando = (c, s, m) => {
  const l = c.lingua;
  const sblocca = c.azione === "sblocca";
  const scelta = bersagliDel({ ...c, categoria: "serratura" }, s, m, ["lock"]);
  if (scelta.quali) {
    if (!scelta.quali.length)
      return { testo: dire(l, "Non ho serrature da comandare.", "There are no locks to control.") };
    return {
      testo: dire(l, "Quale serratura?", "Which lock?"),
      chips: scelta.quali
        .slice(0, 6)
        .map((e) => chiedi(e.nome, `${sblocca ? "sblocca" : "blocca"} ${e.nome}`)),
    };
  }
  const tutte = scelta.bersagli || [];
  if (!tutte.length)
    return { testo: dire(l, "Non trovo quella serratura.", "I can't find that lock.") };
  const voci = tutte.filter((e) => (sblocca ? e.stato !== "unlocked" : e.stato !== "locked"));
  if (!voci.length)
    return {
      testo: sblocca
        ? dire(
            l,
            `${elencoNomi(
              tutte.map((e) => e.nome),
              l,
            )}: già sbloccata.`,
            `${elencoNomi(
              tutte.map((e) => e.nome),
              l,
            )}: already unlocked.`,
          )
        : dire(
            l,
            `${elencoNomi(
              tutte.map((e) => e.nome),
              l,
            )}: già chiusa a chiave.`,
            `${elencoNomi(
              tutte.map((e) => e.nome),
              l,
            )}: already locked.`,
          ),
    };
  const chiamata = servizi(
    voci.map((e) => ({
      dominio: "lock",
      servizio: sblocca ? "unlock" : "lock",
      dati: { entity: e.entity },
    })),
  );
  const nomi = elencoNomi(
    voci.map((e) => e.nome),
    l,
  );
  const fatto = sblocca
    ? dire(l, `Mando il comando: sblocco ${nomi}.`, `Sending it: unlocking ${nomi}.`)
    : dire(l, `Mando il comando: chiudo a chiave ${nomi}.`, `Sending it: locking ${nomi}.`);
  const codice = voci.some((e) => {
    const formato = pulito(e.attributi?.code_format).toLowerCase();
    return formato && formato !== "none" && formato !== "null";
  });
  if (codice)
    return {
      testo: dire(
        l,
        `Per ${sblocca ? "sbloccare" : "chiudere"} ${nomi} serve il codice: scrivilo qui sotto.`,
        `${sblocca ? "Unlocking" : "Locking"} ${nomi} needs the code: type it below.`,
      ),
      inAttesa: { servizi: chiamata, fatto, codice: true },
      codice: true,
      chips: [annulla(l)],
      soggetto: voci.map((e) => e.entity),
    };
  return {
    testo: sblocca
      ? dire(
          l,
          `Sblocco ${nomi}? Confermalo: la porta resterà aperta.`,
          `Unlock ${nomi}? Please confirm: the door will be open.`,
        )
      : dire(l, `Chiudo a chiave ${nomi}?`, `Lock ${nomi}?`),
    inAttesa: { servizi: chiamata, fatto },
    soggetto: voci.map((e) => e.entity),
    chips: [
      fai(
        sblocca
          ? dire(l, "Sì, sblocca", "Yes, unlock")
          : dire(l, "Sì, chiudi a chiave", "Yes, lock"),
        chiamata,
        fatto,
        sblocca,
      ),
      annulla(l),
    ],
  };
};

RISPOSTE.clima_imposta = (c, s, m) => {
  const l = c.lingua;
  const u = s.unitaTemperatura || "°C";
  const scelta = bersagliDel({ ...c, categoria: "clima", plurale: false, tutte: false }, s, m, [
    "climate",
  ]);
  if (scelta.quali) {
    if (!scelta.quali.length)
      return {
        testo: dire(
          l,
          "Non ho termostati o climatizzatori da regolare.",
          "There are no thermostats to adjust.",
        ),
      };
    return {
      testo: dire(l, "Quale?", "Which one?"),
      chips: scelta.quali
        .slice(0, 6)
        .map((e) =>
          chiedi(
            e.area || e.nome,
            `${c.testo} ${e.area ? dire(l, `in ${e.area}`, `in ${e.area}`) : e.nome}`,
          ),
        ),
    };
  }
  const voci = scelta.bersagli || [];
  if (!voci.length)
    return {
      testo: c.stanza
        ? dire(
            l,
            `In ${c.stanza} non c'è un termostato che posso regolare.`,
            `There's no thermostat I can adjust in ${c.stanza}.`,
          )
        : dire(l, "Non trovo un termostato da regolare.", "I can't find a thermostat to adjust."),
    };
  const e = voci[0];
  const a = e.attributi || {};
  const attuale = numero(a.temperature);
  const passo = numero(a.target_temp_step) || (u === "°F" ? 1 : 0.5);
  let nuovo = c.gradi ?? null;
  if (nuovo === null && c.direzione) {
    if (attuale === null)
      return {
        testo: dire(
          l,
          `Non riesco a leggere a quanti gradi è ${e.nome}.`,
          `I can't read ${e.nome}'s set temperature.`,
        ),
      };
    nuovo = attuale + c.direzione * (c.passo ?? 1);
  }
  if (nuovo === null)
    return {
      testo: dire(
        l,
        `A quanti gradi metto ${e.nome}?${attuale !== null ? ` Adesso è a ${gradi(attuale, l, u)}.` : ""}`,
        `What temperature for ${e.nome}?${attuale !== null ? ` It's set to ${gradi(attuale, l, u)}.` : ""}`,
      ),
      chips: [20, 21, 22].map((g) =>
        chiedi(
          `${g}°`,
          dire(
            l,
            `metti ${g} gradi ${e.area ? `in ${e.area}` : e.nome}`,
            `set ${g} degrees ${e.area ? `in ${e.area}` : e.nome}`,
          ),
        ),
      ),
    };
  nuovo = Math.round(nuovo / passo) * passo;
  const min = numero(a.min_temp);
  const max = numero(a.max_temp);
  if (min !== null) nuovo = Math.max(min, nuovo);
  if (max !== null) nuovo = Math.min(max, nuovo);
  const chiamata = servizi([
    {
      dominio: "climate",
      servizio: "set_temperature",
      dati: { entity: e.entity, temperature: nuovo },
    },
  ]);
  const spento = e.stato === "off" ? dire(l, " (adesso è spento)", " (it's off right now)") : "";
  const fatto = dire(
    l,
    `Fatto: ${e.nome} a ${gradi(nuovo, l, u)}.`,
    `Done: ${e.nome} set to ${gradi(nuovo, l, u)}.`,
  );
  return {
    testo:
      attuale !== null && attuale !== nuovo
        ? dire(
            l,
            `Porto ${e.nome} da ${gradi(attuale, l, u)} a ${gradi(nuovo, l, u)}${spento}?`,
            `Set ${e.nome} from ${gradi(attuale, l, u)} to ${gradi(nuovo, l, u)}${spento}?`,
          )
        : attuale === nuovo
          ? dire(
              l,
              `${e.nome} è già a ${gradi(nuovo, l, u)}.`,
              `${e.nome} is already set to ${gradi(nuovo, l, u)}.`,
            )
          : dire(
              l,
              `Metto ${e.nome} a ${gradi(nuovo, l, u)}${spento}?`,
              `Set ${e.nome} to ${gradi(nuovo, l, u)}${spento}?`,
            ),
    soggetto: [e.entity],
    inAttesa: attuale === nuovo ? null : { servizi: chiamata, fatto },
    chips:
      attuale === nuovo
        ? []
        : [
            fai(
              dire(l, `Sì, ${gradi(nuovo, l, "°")}`, `Yes, ${gradi(nuovo, l, "°")}`),
              chiamata,
              fatto,
            ),
            annulla(l),
          ],
  };
};

RISPOSTE.stato_dispositivo = (c, s) => {
  const l = c.lingua;
  const e = c.dispositivo;
  if (!e) return null;
  const a = e.attributi || {};
  let stato;
  if (e.dominio === "climate") {
    const t = numero(a.current_temperature);
    const obiettivo = numero(a.temperature);
    const modo =
      e.stato === "off"
        ? dire(l, "spento", "off")
        : dire(l, `acceso (${e.stato})`, `on (${e.stato})`);
    stato = `${modo}${t !== null ? dire(l, `, in stanza ${gradi(t, l)}`, `, room at ${gradi(t, l)}`) : ""}${obiettivo !== null && e.stato !== "off" ? dire(l, `, impostato a ${gradi(obiettivo, l)}`, `, set to ${gradi(obiettivo, l)}`) : ""}`;
  } else if (e.dominio === "cover") {
    const pos = numero(a.current_position);
    stato =
      e.stato === "closed"
        ? dire(l, "chiuso", "closed")
        : pos !== null && pos < 100
          ? dire(l, `aperto ${alPercento(pos, l)}`, `${pos}% open`)
          : dire(l, "aperto", "open");
  } else if (e.dominio === "lock") {
    stato =
      e.stato === "locked"
        ? dire(l, "chiuso a chiave", "locked")
        : dire(l, "sbloccato", "unlocked");
  } else if (e.dominio === "binary_sensor") {
    stato =
      e.stato === "on"
        ? dire(l, "aperto / attivo", "open / active")
        : dire(l, "chiuso / a riposo", "closed / idle");
  } else if (e.stato === "on") stato = dire(l, "acceso", "on");
  else if (e.stato === "off") stato = dire(l, "spento", "off");
  else if (e.stato === "unavailable") stato = dire(l, "non raggiungibile", "unavailable");
  else {
    const unita = pulito(a.unit_of_measurement);
    stato = `${e.stato}${unita ? ` ${unita}` : ""}`;
  }
  const da =
    e.daQuando !== null && e.daQuando >= MINUTO
      ? dire(l, ` (da ${durata(e.daQuando, l)})`, ` (for ${durata(e.daQuando, l)})`)
      : "";
  const chips = [];
  if (
    e.comandabile &&
    ["light", "switch", "fan", "input_boolean", "media_player"].includes(e.dominio)
  ) {
    const accendi = !ACCESO(e);
    const chiamata = servizi([
      {
        dominio: e.dominio,
        servizio: accendi ? "turn_on" : "turn_off",
        dati: { entity: e.entity },
      },
    ]);
    chips.push(
      fai(
        accendi ? dire(l, "Accendi", "Turn on") : dire(l, "Spegni", "Turn off"),
        chiamata,
        accendi
          ? dire(l, `Fatto: ${e.nome} acceso.`, `Done: ${e.nome} on.`)
          : dire(l, `Fatto: ${e.nome} spento.`, `Done: ${e.nome} off.`),
      ),
    );
  }
  return { testo: `${e.nome}: ${stato}${da}.`, soggetto: [e.entity], chips };
};

/* ── l'energia ───────────────────────────────────────────────────────────── */

const kwh = (v, l) => `${cifra(v, v >= 100 ? 0 : 1, l)} kWh`;

RISPOSTE.energia = (c, s) => {
  const l = c.lingua;
  const e = s.energia || {};
  const o = s.energiaOggi || {};
  const vuoleOggi =
    c.quando?.giorno === 0 || /\b(consumato|prodott\w*|oggi|today|so far|finora)\b/.test(c.testo);
  if (vuoleOggi && (o.consumo !== null || o.prelievo !== null || o.produzione !== null)) {
    const pezzi = [];
    if (o.consumo !== null)
      pezzi.push(
        dire(
          l,
          `Oggi la casa ha consumato ${kwh(o.consumo, l)}`,
          `Today the house has used ${kwh(o.consumo, l)}`,
        ),
      );
    if (o.prelievo !== null)
      pezzi.push(
        pezzi.length
          ? dire(l, `${kwh(o.prelievo, l)} presi dalla rete`, `${kwh(o.prelievo, l)} from the grid`)
          : dire(
              l,
              `Oggi hai preso dalla rete ${kwh(o.prelievo, l)}`,
              `Today you've drawn ${kwh(o.prelievo, l)} from the grid`,
            ),
      );
    let testo = `${pezzi.join(": ")}.`;
    if (o.produzione !== null)
      testo += dire(
        l,
        ` Il fotovoltaico ha prodotto ${kwh(o.produzione, l)}.`,
        ` Solar has produced ${kwh(o.produzione, l)}.`,
      );
    if (o.immissione !== null && o.immissione > 0)
      testo += dire(
        l,
        ` Ceduti alla rete: ${kwh(o.immissione, l)}.`,
        ` Exported: ${kwh(o.immissione, l)}.`,
      );
    return {
      testo: testo.replace(/^\./, "").trim(),
      chips: [
        chiedi(
          dire(l, "E adesso?", "And right now?"),
          dire(l, "quanto consuma la casa adesso", "power usage right now"),
        ),
      ],
    };
  }
  if (e.casa === null && e.rete === null && e.solare === null)
    return {
      testo: vuoleOggi
        ? dire(
            l,
            "Non ho i totali di oggi: configura l'Energia e te li dico.",
            "I don't have today's totals: set up Energy and I'll tell you.",
          )
        : dire(
            l,
            "Non ho letture dell'energia: configura la pagina Energia e te lo dico.",
            "I have no energy readings: set up the Energy page and I'll tell you.",
          ),
    };
  const pezzi = [];
  if (vuoleOggi) pezzi.push(dire(l, "Non ho i totali di oggi.", "I don't have today's totals."));
  if (e.casa !== null)
    pezzi.push(
      dire(
        l,
        `Adesso la casa consuma ${potenza(e.casa, l)}.`,
        `The house is using ${potenza(e.casa, l)} right now.`,
      ),
    );
  const fonti = [];
  if (e.solare !== null && e.solare > 20)
    fonti.push(
      dire(l, `${potenza(e.solare, l)} dal fotovoltaico`, `${potenza(e.solare, l)} from solar`),
    );
  if (e.batteria !== null && e.batteria > 20)
    fonti.push(
      dire(
        l,
        `${potenza(e.batteria, l)} dalla batteria`,
        `${potenza(e.batteria, l)} from the battery`,
      ),
    );
  if (e.rete !== null && e.rete > 20)
    fonti.push(dire(l, `${potenza(e.rete, l)} dalla rete`, `${potenza(e.rete, l)} from the grid`));
  if (fonti.length)
    pezzi.push(dire(l, `Arrivano ${elencoNomi(fonti, l)}.`, `Coming in: ${elencoNomi(fonti, l)}.`));
  if (e.rete !== null && e.rete < -20)
    pezzi.push(
      dire(
        l,
        `Stai cedendo ${potenza(e.rete, l)} alla rete.`,
        `You're exporting ${potenza(e.rete, l)} to the grid.`,
      ),
    );
  return {
    testo: pezzi.join(" "),
    chips: [
      ...(o.consumo !== null || o.prelievo !== null
        ? [
            chiedi(
              dire(l, "E oggi in tutto?", "And today in total?"),
              dire(l, "quanto ho consumato oggi", "energy used today"),
            ),
          ]
        : []),
      ...(e.solare !== null
        ? [
            chiedi(
              dire(l, "Fotovoltaico", "Solar"),
              dire(l, "quanto produce il fotovoltaico", "solar production"),
            ),
          ]
        : []),
    ],
  };
};

RISPOSTE.solare = (c, s) => {
  const l = c.lingua;
  const e = s.energia || {};
  const o = s.energiaOggi || {};
  if (e.solare === null && o.produzione === null)
    return {
      testo: dire(l, "Non ho un fotovoltaico configurato.", "There's no solar configured."),
    };
  const oggi =
    o.produzione !== null
      ? dire(
          l,
          ` Oggi ha prodotto ${kwh(o.produzione, l)}.`,
          ` Today it has produced ${kwh(o.produzione, l)}.`,
        )
      : "";
  if (e.solare === null)
    return {
      testo: dire(
        l,
        `Il fotovoltaico oggi ha prodotto ${kwh(o.produzione, l)}.`,
        `Solar has produced ${kwh(o.produzione, l)} today.`,
      ),
    };
  if (e.solare <= 20)
    return {
      testo: `${dire(l, "Il fotovoltaico adesso è fermo.", "Solar isn't producing right now.")}${oggi}`,
    };
  const avanza =
    e.casa !== null && e.solare - e.casa > 100
      ? dire(
          l,
          ` Ne avanzano ${potenza(e.solare - e.casa, l)}: è un buon momento per la lavatrice.`,
          ` ${potenza(e.solare - e.casa, l)} to spare: a good time for the washing machine.`,
        )
      : "";
  return {
    testo: `${dire(l, `Il fotovoltaico sta producendo ${potenza(e.solare, l)}.`, `Solar is producing ${potenza(e.solare, l)}.`)}${oggi}${avanza}`,
  };
};

RISPOSTE.batteria_casa = (c, s) => {
  const l = c.lingua;
  const e = s.energia || {};
  if (e.soc === null && e.batteria === null)
    return {
      testo: dire(
        l,
        "Non ho una batteria di casa configurata.",
        "There's no home battery configured.",
      ),
    };
  const livello = e.soc !== null ? dire(l, alPercento(e.soc, l), `at ${Math.round(e.soc)}%`) : "";
  let flusso = "";
  if (e.batteria !== null && e.batteria < -20)
    flusso = dire(
      l,
      `si sta caricando (${potenza(e.batteria, l)})`,
      `charging (${potenza(e.batteria, l)})`,
    );
  else if (e.batteria !== null && e.batteria > 20)
    flusso = dire(
      l,
      `si sta scaricando (${potenza(e.batteria, l)})`,
      `discharging (${potenza(e.batteria, l)})`,
    );
  else if (e.batteria !== null) flusso = dire(l, "è ferma", "idle");
  const pezzi = [livello, flusso].filter(Boolean).join(dire(l, " e ", " and "));
  return { testo: dire(l, `La batteria di casa è ${pezzi}.`, `The home battery is ${pezzi}.`) };
};

/* ── le macchine, l'auto, le telecamere ──────────────────────────────────── */

RISPOSTE.elettrodomestici = (c, s) => {
  const l = c.lingua;
  const tutti = elenco(s.elettrodomestici);
  if (!tutti.length)
    return {
      testo: dire(l, "Non ho elettrodomestici configurati.", "There are no appliances configured."),
    };
  const f = frase(c.testo);
  /* Quello nominato: per nome, o per tipo («la lavatrice» trova la macchina
   * di tipo lavatrice anche se si chiama «Bosch»). */
  const tipi = {
    lavatrice: /^(lavatric|washer|washing|bucato)/,
    lavastoviglie: /^(lavastovigli|dishwasher|piatti|dishes)/,
    asciugatrice: /^(asciugatric|asciugabianch|dryer)/,
    forno: /^(forn|oven)/,
  };
  const chiesti = tutti.filter((a) => {
    if (nomeNellaFrase(a.nome, f).tutte) return true;
    const re = tipi[a.tipo] || null;
    if (re && f.parole.some((p) => re.test(p))) return true;
    return Object.entries(tipi).some(
      ([tipo, r]) =>
        f.parole.some((p) => r.test(p)) && new RegExp(tipo.slice(0, 6), "i").test(a.nome),
    );
  });
  const detto = (a) => {
    if (a.stato === "running") {
      const resta = a.restano !== null ? a.restano * 1000 : null;
      const fine = resta !== null ? s.adesso + resta : a.prontaAlle;
      const quando =
        resta !== null && resta > 0
          ? dire(
              l,
              `: mancano ${durata(resta, l)}, finisce alle ${oraDi(fine)}`,
              `: ${durata(resta, l)} left, done at ${oraDi(fine)}`,
            )
          : a.prontaAlle
            ? dire(l, `: pronta alle ${oraDi(a.prontaAlle)}`, `: ready at ${oraDi(a.prontaAlle)}`)
            : "";
      const fase = a.fase ? ` (${a.fase})` : "";
      return dire(
        l,
        `${a.nome} sta lavorando${fase}${quando}`,
        `${a.nome} is running${fase}${quando}`,
      );
    }
    return dire(l, `${a.nome} è ferma`, `${a.nome} is idle`);
  };
  if (chiesti.length) return { testo: `${chiesti.map(detto).join(". ")}.` };
  const accesi = tutti.filter((a) => a.stato === "running");
  if (!accesi.length)
    return {
      testo: dire(
        l,
        "Nessun elettrodomestico è in funzione adesso.",
        "No appliance is running right now.",
      ),
    };
  return { testo: `${accesi.map(detto).join(". ")}.` };
};

RISPOSTE.auto = (c, s) => {
  const l = c.lingua;
  const vetture = elenco(s.auto);
  if (!vetture.length)
    return { testo: dire(l, "Non ho un'auto configurata.", "There's no car configured.") };
  const f = frase(c.testo);
  const nominate = vetture.filter((v) => v.nome && nomeNellaFrase(v.nome, f).tutte);
  const quali = nominate.length ? nominate : vetture;
  const righe = quali.map((v) => {
    const nome = v.nome || dire(l, "L'auto", "The car");
    const pezzi = [];
    if (v.percentuale !== null)
      pezzi.push(
        dire(l, `è ${alPercento(v.percentuale, l)}`, `is at ${Math.round(v.percentuale)}%`),
      );
    if (v.km !== null)
      pezzi.push(
        dire(
          l,
          `${cifra(Math.round(v.km), 0, l)} km di autonomia`,
          `${cifra(Math.round(v.km), 0, l)} km range`,
        ),
      );
    let testo = pezzi.length
      ? `${nome} ${pezzi.join(dire(l, ", ", ", "))}`
      : dire(l, `${nome}: non ho letture`, `${nome}: no readings`);
    if (v.inCarica)
      testo += v.fine
        ? dire(l, `, in carica (${v.fine})`, `, charging (${v.fine})`)
        : dire(l, ", in carica", ", charging");
    return testo;
  });
  return { testo: `${righe.join(". ")}.` };
};

RISPOSTE.telecamera = (c, s) => {
  const l = c.lingua;
  const tutte = elenco(s.telecamere);
  if (!tutte.length)
    return { testo: dire(l, "Non ho telecamere configurate.", "There are no cameras configured.") };
  let scelta = c.telecamera;
  if (!scelta && c.stanza)
    scelta =
      tutte.find((t) => stessaStanza(t.area, c.stanza) || stessaStanza(t.nome, c.stanza)) || null;
  if (!scelta && tutte.length === 1) scelta = tutte[0];
  if (!scelta)
    return {
      testo: dire(l, "Quale telecamera?", "Which camera?"),
      chips: tutte.slice(0, 6).map((t) => telecamera(t.nome, t.entity)),
    };
  return {
    testo: dire(l, `Ecco ${scelta.nome}.`, `Here's ${scelta.nome}.`),
    telecamera: scelta.entity,
    chips: tutte
      .filter((t) => t.entity !== scelta.entity)
      .slice(0, 3)
      .map((t) => telecamera(t.nome, t.entity)),
  };
};

/* ── l'agenda e i rifiuti ────────────────────────────────────────────────── */

RISPOSTE.calendario = (c, s) => {
  const l = c.lingua;
  const eventi = elenco(s.eventi);
  if (!eventi.length && !s.eventi)
    return { testo: dire(l, "Non ho un calendario collegato.", "There's no calendar connected.") };
  const giorno = c.quando?.giorno;
  const detto = (e) =>
    e.tuttoIlGiorno
      ? dire(l, `${e.titolo} (tutto il giorno)`, `${e.titolo} (all day)`)
      : dire(l, `alle ${oraDi(e.inizio)} ${e.titolo}`, `${e.titolo} at ${oraDi(e.inizio)}`);
  if (giorno !== null && giorno !== undefined) {
    const quel = eventi.filter(
      (e) =>
        giorniDa(s.adesso, e.inizio) === giorno ||
        (e.tuttoIlGiorno &&
          giorniDa(s.adesso, e.inizio) <= giorno &&
          giorniDa(s.adesso, e.fine - 1) >= giorno),
    );
    const quale = giornoDetto(s.adesso, s.adesso + giorno * GIORNO, l);
    const daOra =
      giorno === 0 ? quel.filter((e) => e.tuttoIlGiorno || (e.fine || e.inizio) >= s.adesso) : quel;
    if (!daOra.length)
      return {
        testo: dire(
          l,
          `${maiuscola(quale)} non hai niente in calendario.`,
          `Nothing on your calendar ${quale}.`,
        ),
        chips:
          giorno === 0
            ? [
                chiedi(
                  dire(l, "E domani?", "And tomorrow?"),
                  dire(l, "che impegni ho domani", "my calendar tomorrow"),
                ),
              ]
            : [],
      };
    return {
      testo: dire(
        l,
        `${maiuscola(quale)} hai ${daOra.length === 1 ? "un impegno" : `${daOra.length} impegni`}: ${elencoNomi(daOra.map(detto), l, 5)}.`,
        `${maiuscola(quale)} you have ${daOra.length === 1 ? "one event" : `${daOra.length} events`}: ${elencoNomi(daOra.map(detto), l, 5)}.`,
      ),
      chips:
        giorno === 0
          ? [
              chiedi(
                dire(l, "E domani?", "And tomorrow?"),
                dire(l, "che impegni ho domani", "my calendar tomorrow"),
              ),
            ]
          : [],
    };
  }
  const prossimi = eventi
    .filter((e) => (e.fine || e.inizio) >= s.adesso && e.inizio - s.adesso <= 7 * GIORNO)
    .slice(0, 3);
  if (!prossimi.length)
    return {
      testo: dire(
        l,
        "Non vedo impegni nei prossimi sette giorni.",
        "Nothing on your calendar for the next seven days.",
      ),
    };
  const righe = prossimi.map((e) => `${giornoDetto(s.adesso, e.inizio, l)} ${detto(e)}`);
  return {
    testo: dire(
      l,
      `I prossimi impegni: ${elencoNomi(righe, l)}.`,
      `Coming up: ${elencoNomi(righe, l)}.`,
    ),
  };
};

RISPOSTE.rifiuti = (c, s) => {
  const l = c.lingua;
  const righe = elenco(s.rifiuti).filter((r) => r.nome);
  if (!righe.length)
    return {
      testo: dire(l, "Non ho il calendario dei rifiuti.", "There's no waste collection schedule."),
    };
  const giorniDi = (r) => r.giorni ?? (r.quando === "oggi" ? 0 : r.quando === "domani" ? 1 : null);
  const giorno = c.quando?.giorno;
  const stasera = c.quando?.sera;
  let quel = null;
  if (giorno === 1 || stasera) quel = 1;
  else if (giorno !== null && giorno !== undefined) quel = giorno;
  /* «quando passa la plastica?»: quella, non il prossimo ritiro qualunque. */
  const f = frase(c.testo);
  const nominati = righe.filter((r) => nomeNellaFrase(r.nome, f).tutte);
  if (nominati.length && quel === null)
    return {
      testo: `${nominati
        .map((r) => {
          const g = giorniDi(r);
          if (g === null || g < 0)
            return dire(l, `${r.nome}: non so quando passa`, `${r.nome}: I don't know when`);
          const quando = giornoDetto(s.adesso, s.adesso + g * GIORNO, l);
          return dire(l, `${r.nome} passa ${quando}`, `${r.nome} is collected ${quando}`);
        })
        .join(
          ". ",
        )}.${nominati.some((r) => giorniDi(r) === 1) ? dire(l, " Stasera portala fuori.", " Put it out tonight.") : ""}`,
    };
  if (quel !== null) {
    const voci = righe.filter((r) => giorniDi(r) === quel);
    const quando = giornoDetto(s.adesso, s.adesso + quel * GIORNO, l);
    if (!voci.length) {
      const prossimo = righe
        .filter((r) => giorniDi(r) !== null && giorniDi(r) >= 0)
        .sort((a, b) => giorniDi(a) - giorniDi(b))[0];
      return {
        testo: dire(
          l,
          `${maiuscola(quando)} non passa niente.${prossimo ? ` Il prossimo ritiro: ${prossimo.nome}, ${giornoDetto(s.adesso, s.adesso + giorniDi(prossimo) * GIORNO, l)}.` : ""}`,
          `No collection ${quando}.${prossimo ? ` Next: ${prossimo.nome}, ${giornoDetto(s.adesso, s.adesso + giorniDi(prossimo) * GIORNO, l)}.` : ""}`,
        ),
      };
    }
    const nomi = elencoNomi(
      voci.map((r) => r.nome),
      l,
    );
    const consiglio = quel === 1 ? dire(l, " Stasera portalo fuori.", " Put it out tonight.") : "";
    return {
      testo: dire(
        l,
        `${maiuscola(quando)} ${voci.length === 1 ? "passa" : "passano"}: ${nomi}.${consiglio}`,
        `${maiuscola(quando)}: ${nomi}.${consiglio}`,
      ),
    };
  }
  const ordinati = righe
    .filter((r) => giorniDi(r) !== null && giorniDi(r) >= 0)
    .sort((a, b) => giorniDi(a) - giorniDi(b));
  if (!ordinati.length)
    return {
      testo: dire(
        l,
        `Prossimi ritiri: ${elencoNomi(
          righe.map((r) => r.nome),
          l,
        )}.`,
        `Next collections: ${elencoNomi(
          righe.map((r) => r.nome),
          l,
        )}.`,
      ),
    };
  const primo = giorniDi(ordinati[0]);
  const stessi = ordinati.filter((r) => giorniDi(r) === primo);
  const quando = giornoDetto(s.adesso, s.adesso + primo * GIORNO, l);
  const poi = ordinati.find((r) => giorniDi(r) > primo);
  return {
    testo: dire(
      l,
      `Il prossimo ritiro è ${quando}: ${elencoNomi(
        stessi.map((r) => r.nome),
        l,
      )}.${poi ? ` Poi ${poi.nome}, ${giornoDetto(s.adesso, s.adesso + giorniDi(poi) * GIORNO, l)}.` : ""}`,
      `Next collection ${quando}: ${elencoNomi(
        stessi.map((r) => r.nome),
        l,
      )}.${poi ? ` Then ${poi.nome}, ${giornoDetto(s.adesso, s.adesso + giorniDi(poi) * GIORNO, l)}.` : ""}`,
    ),
  };
};

/* ── la manutenzione ─────────────────────────────────────────────────────── */

RISPOSTE.batterie_basse = (c, s) => {
  const l = c.lingua;
  const basse = elenco(s.batterieBasse);
  if (!basse.length)
    return { testo: dire(l, "Nessuna batteria è quasi scarica.", "No batteries are running low.") };
  const nomi = elencoNomi(
    basse.map((b) => (b.livello !== null ? `${b.nome} (${Math.round(b.livello)}%)` : b.nome)),
    l,
    5,
  );
  return {
    testo:
      basse.length === 1
        ? dire(l, `Una batteria è quasi scarica: ${nomi}.`, `One battery is low: ${nomi}.`)
        : dire(
            l,
            `${basse.length} batterie sono quasi scariche: ${nomi}.`,
            `${basse.length} batteries are low: ${nomi}.`,
          ),
  };
};

RISPOSTE.non_rispondono = (c, s) => {
  const l = c.lingua;
  const muti = elenco(s.nonRispondono);
  if (!muti.length)
    return { testo: dire(l, "Tutti i dispositivi rispondono.", "All devices are responding.") };
  const nomi = elencoNomi(
    muti.map((m) => m.nome),
    l,
    5,
  );
  return {
    testo:
      muti.length === 1
        ? dire(l, `Un dispositivo non risponde: ${nomi}.`, `One device isn't responding: ${nomi}.`)
        : dire(
            l,
            `${muti.length} dispositivi non rispondono: ${nomi}.`,
            `${muti.length} devices aren't responding: ${nomi}.`,
          ),
  };
};

RISPOSTE.aggiornamenti = (c, s) => {
  const l = c.lingua;
  const voci = elenco(s.aggiornamenti);
  if (!voci.length) return { testo: dire(l, "È tutto aggiornato.", "Everything is up to date.") };
  const nomi = elencoNomi(
    voci.map((u) => (u.versione ? `${u.nome} (${u.versione})` : u.nome)),
    l,
    4,
  );
  return {
    testo:
      voci.length === 1
        ? dire(l, `C'è un aggiornamento: ${nomi}.`, `There's one update: ${nomi}.`)
        : dire(
            l,
            `Ci sono ${voci.length} aggiornamenti: ${nomi}.`,
            `There are ${voci.length} updates: ${nomi}.`,
          ),
  };
};

/* ── la risposta ─────────────────────────────────────────────────────────── */

/* Gli intenti che non cambiano di cosa si parla: dopo un «grazie» o una
 * conferma, «e in camera?» vale ancora per la domanda di prima. */
const DI_PASSAGGIO = new Set(["saluto", "aiuto", "conferma", "annulla", "codice"]);

/**
 * La risposta della casa, se la casa sa rispondere.
 *
 * Torna `{ capita: false }` quando la frase non e' una di quelle che si
 * capiscono qui: e' il segno per chiedere ad Assist. Altrimenti:
 *
 *   testo       la risposta;
 *   chips       i tasti sotto: `chiedi` (un'altra domanda), `fai` (i servizi
 *               da chiamare: e' la conferma), `annulla`, `telecamera`;
 *   esegui      servizi da chiamare subito (dopo un «sì» o un codice);
 *   telecamera  l'entita' da aprire subito;
 *   codice      la prossima frase e' un codice: la casella lo nasconda;
 *   memoria     la conversazione, da ridare alla domanda dopo.
 */
export function rispondiDaCasa(testo, sapere = {}, memoria = {}, opzioni = {}) {
  const m = memoria && typeof memoria === "object" ? memoria : {};
  const adesso = numero(sapere.adesso) ?? Date.now();
  const s = { ...sapere, adesso };
  const capito = capisci(testo, s, m, { lingua: opzioni.lingua || s.lingua, adesso });
  if (!capito)
    return { capita: false, lingua: linguaDellaDomanda(testo, opzioni.lingua || s.lingua) };
  const rispondi = RISPOSTE[capito.intento];
  let r = null;
  try {
    r = rispondi ? rispondi(capito, s, m) : null;
  } catch (_errore) {
    r = null;
  }
  if (!r) return { capita: false, lingua: capito.lingua, intento: capito.intento };
  const passaggio = DI_PASSAGGIO.has(capito.intento);
  return {
    capita: true,
    intento: capito.intento,
    lingua: capito.lingua,
    testo: r.testo,
    chips: elenco(r.chips),
    esegui: elenco(r.esegui),
    telecamera: r.telecamera || "",
    codice: Boolean(r.codice),
    nascondiDomanda: Boolean(r.nascondiDomanda),
    memoria: {
      intento: passaggio ? m.intento || "" : capito.intento,
      stanza: passaggio ? m.stanza || "" : r.stanza || capito.stanza || "",
      categoria: passaggio ? m.categoria || "" : capito.categoria || "",
      domini: passaggio ? elenco(m.domini) : elenco(capito.domini),
      azione: passaggio ? m.azione || "" : capito.azione || "",
      soggetto: elenco(r.soggetto ?? (passaggio || !capito.seguito ? m.soggetto : [])),
      inAttesa: Object.hasOwn(r, "inAttesa") ? r.inAttesa : null,
      lingua: capito.lingua,
      il: adesso,
    },
  };
}
