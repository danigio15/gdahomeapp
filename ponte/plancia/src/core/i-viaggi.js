/* I viaggi di gdanav, visti dalla plancia: i conti senza la pagina.
 *
 * I viaggi stanno nella casa (`ponte/src/viaggi.js`), che sa la prossima
 * volta di ognuno e manda gli avvisi. Qui ci sono le cose che la pagina
 * gdanav fa mentre si scrive un viaggio, prima di salvarlo: quando partire
 * con la stima che c'e', come si dice un viaggio in una riga, e come si
 * disegna la sua strada in un riquadro. Gli stessi conti della casa — il
 * margine senza traffico e' lo stesso — cosi' quello che si legge prima di
 * salvare e' quello che la casa fara'.
 */

/* Gli stessi della casa (`viaggi.js`). */
export const MARGINE_SENZA_TRAFFICO = 1.15;
const MINUTO = 60_000;

export const GIORNI = Object.freeze([
  { n: 1, it: "L", en: "M" },
  { n: 2, it: "M", en: "T" },
  { n: 3, it: "M", en: "W" },
  { n: 4, it: "G", en: "T" },
  { n: 5, it: "V", en: "F" },
  { n: 6, it: "S", en: "S" },
  { n: 7, it: "D", en: "S" },
]);

const due = (n) => String(n).padStart(2, "0");

/** «8:12» da un istante, nell'ora della pagina. */
export function oraDi(ms) {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return `${d.getHours()}:${due(d.getMinutes())}`;
}

/** Il giorno di domani come lo vuole un campo data: «2026-10-16». */
export function domani(adesso = Date.now()) {
  const d = new Date(adesso);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

/** Le soste di ricarica della bozza: quelle che ha, o nessuna. */
export function sosteDi(bozza) {
  const elenco = bozza?.soste?.elenco;
  return Array.isArray(elenco) ? elenco.filter((s) => s && Number.isFinite(Number(s.km))) : [];
}

/** I minuti di ricarica della bozza, in tutto. */
export function minutiDiRicarica(bozza) {
  return sosteDi(bozza).reduce((somma, s) => somma + (Number(s.min) || 0), 0);
}

/** Quanto si guida e basta, in millisecondi: senza nessuna sosta. */
export function guidaStimata(bozza) {
  const secondi = Number(bozza?.stima?.durataS);
  if (!Number.isFinite(secondi) || secondi <= 0) return null;
  const margine = bozza.stima.fonte === "traffico" ? 1 : MARGINE_SENZA_TRAFFICO;
  return Math.round(secondi * 1000 * margine);
}

/**
 * Quanto si guida, in millisecondi, con la stima che c'e': col traffico del
 * navigatore cosi' com'e', senza traffico col margine. Le soste delle tappe in
 * mezzo si sommano, e le soste di ricarica di un'auto elettrica anche: con
 * «arrivo entro» si parte prima. `null` senza stima.
 */
export function durataStimata(bozza) {
  const guida = guidaStimata(bozza);
  if (guida === null) return null;
  const tappe = Array.isArray(bozza.tappe) ? bozza.tappe : [];
  const soste = tappe.slice(0, -1).reduce((s, t) => s + (Number(t?.sostaMin) || 0), 0);
  return Math.round(guida + (soste + minutiDiRicarica(bozza)) * MINUTO);
}

/* ── l'auto elettrica ──────────────────────────────────────────────────── */

/* Gli stessi della casa (`ponte/src/soste.js`). */
export const CONSUMO_DI_SERIE = 17;
export const MINIME_ALL_ARRIVO = Object.freeze([10, 15, 20, 30]);
export const POTENZE_DELLE_COLONNINE = Object.freeze([50, 100, 150]);

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number.parseFloat(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Quanti kWh ogni 100 km, da quello che l'auto dice di se': la batteria
 * (kWh x carica) divisa per l'autonomia che stima. Un'auto che non dice
 * l'autonomia, o un numero che non sta in piedi, prende i 17 di serie.
 */
export function consumoStimato({ kwh, carica, autonomia } = {}) {
  const pacco = numero(kwh);
  const percento = numero(carica);
  const km = numero(autonomia);
  if (pacco === null || percento === null || km === null || km < 10 || percento < 5)
    return CONSUMO_DI_SERIE;
  const consumo = ((pacco * percento) / 100 / km) * 100;
  return consumo >= 8 && consumo <= 40 ? Math.round(consumo * 10) / 10 : CONSUMO_DI_SERIE;
}

/**
 * Il consumo che l'auto ha misurato, in kWh ogni 100 km, da uno stato di Home
 * Assistant: `dm.ev_consumo_medio`, che GdAAuto riempie con il suo
 * `consumo_medio`. Vale piu' della stima, che divide la batteria per
 * un'autonomia detta dall'auto con i suoi ottimismi. Si converte dall'unita'
 * dello stato — Wh/km, km/kWh, le miglia — e un numero che non sta in piedi
 * (fuori da 5-60, gli stessi confini della casa) e' `null`: niente si inventa,
 * e resta la stima.
 */
export function consumoMisurato(stato) {
  const n = numero(stato?.state);
  if (n === null || n <= 0) return null;
  const unita = String(stato?.attributes?.unit_of_measurement ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const MIGLIO = 1.609344;
  let kwh100 = null;
  if (unita === "" || unita === "kwh/100km") kwh100 = n;
  else if (unita === "kwh/100mi") kwh100 = n / MIGLIO;
  else if (unita === "wh/km") kwh100 = n / 10;
  else if (unita === "wh/mi") kwh100 = n / 10 / MIGLIO;
  else if (unita === "km/kwh") kwh100 = 100 / n;
  else if (unita === "mi/kwh") kwh100 = 100 / (n * MIGLIO);
  if (kwh100 === null || kwh100 < 5 || kwh100 > 60) return null;
  return Math.round(kwh100 * 10) / 10;
}

/**
 * La carica con cui si parte, secondo la scelta: «adesso» quella di adesso,
 * «obiettivo» quella a cui arriva la carica di casa (mai meno di adesso), 100
 * piena. `null` se non si sa.
 */
export function caricaAllaPartenza(scelta, adesso, obiettivo = null) {
  if (scelta === 100 || scelta === "100") return 100;
  const ora = numero(adesso);
  const fino = numero(obiettivo);
  if (scelta === "obiettivo" && fino !== null) return Math.max(fino, ora ?? 0);
  return ora;
}

/** La carica dopo `km` chilometri, in %. */
export function caricaDopo(km, { carica, kwh, consumo = CONSUMO_DI_SERIE }) {
  const pacco = numero(kwh);
  const partenza = numero(carica);
  if (pacco === null || partenza === null || !pacco) return null;
  return partenza - ((numero(km) || 0) * (consumo / 100) * 100) / pacco;
}

/**
 * La strada in fila, con le ore: la partenza, le tappe, le soste di ricarica e
 * l'arrivo, in ordine di chilometri. L'ora di un punto e' la partenza piu' la
 * guida fin li' (in proporzione ai chilometri) piu' le soste prima di lui.
 *
 * Torna `[{ tipo, km, alle, riparte, posto?, sosta?, n? }]`, con `tipo`
 * "partenza", "tappa", "sosta" o "arrivo". Una tappa di cui la strada non ha
 * detto i chilometri resta in fila senza ora. `[]` senza stima o senza ora.
 */
export function laStradaInFila(bozza, partenza) {
  const guida = guidaStimata(bozza);
  const tappe = Array.isArray(bozza?.tappe) ? bozza.tappe : [];
  if (guida === null || !Number.isFinite(partenza) || !tappe.length) return [];
  const tappeKm = Array.isArray(bozza?.soste?.tappeKm) ? bozza.soste.tappeKm : [];
  const kmTotali = numero(bozza.stima?.km) ?? numero(tappeKm[tappeKm.length - 1]);
  const alKm = (km) => (kmTotali ? (guida * Math.min(km, kmTotali)) / kmTotali : 0);
  const fermate = [
    ...tappe.slice(0, -1).map((posto, i) => ({
      tipo: "tappa",
      km: numero(tappeKm[i]),
      sostaMin: Number(posto?.sostaMin) || 0,
      posto,
      n: i + 1,
    })),
    ...sosteDi(bozza).map((sosta, i) => ({
      tipo: "sosta",
      km: Number(sosta.km),
      sostaMin: Number(sosta.min) || 0,
      sosta,
      n: i + 1,
    })),
  ].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || (a.tipo === "tappa" ? -1 : 1));
  const fila = [{ tipo: "partenza", km: 0, alle: partenza, riparte: partenza }];
  let ferme = 0;
  for (const f of fermate) {
    const alle = f.km === null ? null : partenza + alKm(f.km) + ferme * MINUTO;
    ferme += f.sostaMin;
    fila.push({
      tipo: f.tipo,
      km: f.km,
      alle,
      riparte: alle === null ? null : alle + f.sostaMin * MINUTO,
      n: f.n,
      ...(f.posto ? { posto: f.posto } : {}),
      ...(f.sosta ? { sosta: f.sosta } : {}),
    });
  }
  fila.push({
    tipo: "arrivo",
    km: kmTotali,
    alle: partenza + guida + ferme * MINUTO,
    riparte: null,
    posto: tappe[tappe.length - 1],
  });
  return fila;
}

/**
 * Quando partire e quando si arriva per la bozza, in un giorno dato
 * («YYYY-MM-DD»). Con «arrivo entro» la partenza e' l'ora meno la strada;
 * con «parto alle» l'arrivo e' l'ora piu' la strada. `null` senza ora.
 */
export function partenzaEArrivo(bozza, giorno) {
  const ora = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(bozza?.quando?.ora || "");
  if (!ora || !/^\d{4}-\d{2}-\d{2}$/.test(giorno || "")) return null;
  const scritta = new Date(`${giorno}T00:00`);
  scritta.setHours(Number(ora[1]), Number(ora[2]), 0, 0);
  const durata = durataStimata(bozza);
  const t = scritta.getTime();
  const arrivo = bozza.quando.modo === "arrivo" && bozza.tipo !== "tappe";
  if (durata === null) return { partenza: arrivo ? null : t, arrivo: arrivo ? t : null };
  return arrivo ? { partenza: t - durata, arrivo: t } : { partenza: t, arrivo: t + durata };
}

/** «1 h 20 min», «48 min». */
export function durataDetta(ms, lingua = "it") {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const minuti = Math.round(ms / MINUTO);
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  if (!ore) return `${minuti} min`;
  return resto ? `${ore} h ${resto} min` : `${ore} h`;
}

/** I giorni scelti detti corti: «Lun – Ven», «Sab, Dom», «Tutti i giorni». */
export function giorniDetti(giorni, lingua = "it") {
  const scelti = [...new Set((giorni || []).map(Number))].filter((g) => g >= 1 && g <= 7).sort();
  const nomi =
    lingua === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  if (scelti.length === 7) return lingua === "en" ? "Every day" : "Tutti i giorni";
  const fila = scelti.length > 2 && scelti.every((g, i) => i === 0 || g === scelti[i - 1] + 1);
  if (fila) return `${nomi[scelti[0] - 1]} – ${nomi[scelti[scelti.length - 1] - 1]}`;
  return scelti.map((g) => nomi[g - 1]).join(", ");
}

/** Il nome di un viaggio: il suo, o «da – a». */
export function nomeDelViaggio(viaggio, lingua = "it") {
  if (viaggio?.nome) return viaggio.nome;
  const tappe = Array.isArray(viaggio?.tappe) ? viaggio.tappe : [];
  const corto = (posto) => String(posto?.nome || "").split(" · ")[0];
  const da = viaggio?.da ? corto(viaggio.da) : lingua === "en" ? "Home" : "Casa";
  const a = corto(tappe[tappe.length - 1]);
  return a ? `${da} – ${a}` : da;
}

/**
 * La riga sotto il nome: quando si fa. «Domani · arrivo entro le 9:00»,
 * «Lun – Ven · parto alle 18:00», «4 tappe · 186 km».
 */
export function quandoDetto(viaggio, adesso = Date.now(), lingua = "it") {
  const q = viaggio?.quando || {};
  const en = lingua === "en";
  const azione =
    q.modo === "arrivo" && viaggio.tipo !== "tappe"
      ? en
        ? `arrive by ${q.ora}`
        : `arrivo entro le ${q.ora}`
      : en
        ? `leave at ${q.ora}`
        : `parto alle ${q.ora}`;
  if (viaggio?.tipo === "settimana") return `${giorniDetti(q.giorni, lingua)} · ${azione}`;
  const oggi = new Date(adesso);
  oggi.setHours(0, 0, 0, 0);
  const giorno = new Date(`${q.giorno}T00:00`);
  const fra = Math.round((giorno - oggi) / (24 * 60 * MINUTO));
  const quando =
    fra === 0
      ? en
        ? "Today"
        : "Oggi"
      : fra === 1
        ? en
          ? "Tomorrow"
          : "Domani"
        : giorno.toLocaleDateString(en ? "en-GB" : "it-IT", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
  return `${quando} · ${azione}`;
}

/**
 * La strada in un riquadro: le coordinate [lon, lat] dentro `larga` x `alta`,
 * col margine, senza deformare (un grado di longitudine vale meno di uno di
 * latitudine, alle nostre latitudini). Torna i punti in pixel.
 */
export function proietta(linea, larga, alta, margine = 28) {
  const punti = (Array.isArray(linea) ? linea : []).filter(
    (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  if (!punti.length) return [];
  const latMedia = punti.reduce((s, p) => s + p[1], 0) / punti.length;
  const k = Math.cos((latMedia * Math.PI) / 180) || 1;
  const xs = punti.map((p) => p[0] * k);
  const ys = punti.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scala = Math.min(
    (larga - 2 * margine) / Math.max(x1 - x0, 1e-6),
    (alta - 2 * margine) / Math.max(y1 - y0, 1e-6),
  );
  const dx = (larga - (x1 - x0) * scala) / 2;
  const dy = (alta - (y1 - y0) * scala) / 2;
  return punti.map((_p, i) => [
    Math.round((dx + (xs[i] - x0) * scala) * 10) / 10,
    Math.round((alta - dy - (ys[i] - y0) * scala) * 10) / 10,
  ]);
}

/** Una bozza vuota per un viaggio nuovo. */
export function bozzaNuova(tipo = "una", adesso = Date.now()) {
  return {
    tipo,
    nome: "",
    da: null,
    tappe: [],
    quando: {
      modo: tipo === "tappe" ? "partenza" : "arrivo",
      ora: tipo === "settimana" ? "08:30" : "09:00",
      giorno: tipo === "settimana" ? null : domani(adesso),
      giorni: tipo === "settimana" ? [1, 2, 3, 4, 5] : [],
    },
    avviso: { acceso: true, minuti: 10 },
    prepara: { clima: null, garage: null },
    stima: null,
  };
}
