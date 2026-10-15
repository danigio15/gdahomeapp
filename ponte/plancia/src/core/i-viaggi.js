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

/**
 * Quanto si guida, in millisecondi, con la stima che c'e': col traffico del
 * navigatore cosi' com'e', senza traffico col margine. Le soste delle tappe in
 * mezzo si sommano. `null` senza stima.
 */
export function durataStimata(bozza) {
  const secondi = Number(bozza?.stima?.durataS);
  if (!Number.isFinite(secondi) || secondi <= 0) return null;
  const margine = bozza.stima.fonte === "traffico" ? 1 : MARGINE_SENZA_TRAFFICO;
  const tappe = Array.isArray(bozza.tappe) ? bozza.tappe : [];
  const soste = tappe.slice(0, -1).reduce((s, t) => s + (Number(t?.sostaMin) || 0), 0);
  return Math.round(secondi * 1000 * margine + soste * MINUTO);
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
