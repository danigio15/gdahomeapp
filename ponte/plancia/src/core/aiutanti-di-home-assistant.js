/* Gli aiutanti di Home Assistant, per la pagina Aiutanti dell'app.
 *
 * I tipi semplici (interruttore, numero, elenco, testo, data e ora, pulsante,
 * timer, contatore, programma) si scrivono qui coi loro campi: questo modulo
 * dice quali campi ha ogni tipo, li riempie da un aiutante che c'e', e
 * rimette le risposte nella forma che il ponte controlla e passa a Home
 * Assistant (`ponte/src/aiutanti.js`, `campiPuliti`). I campi hanno la forma
 * di quelli delle procedure guidate (`flussi-di-home-assistant.js`), cosi' la
 * pagina li disegna con la stessa faccia.
 *
 * I calcolati (gruppo, soglia, template…) non passano di qui: nascono con le
 * procedure guidate di Home Assistant.
 */

const pulito = (v) => String(v ?? "").trim();

/** I tipi semplici, nell'ordine della pagina, col disegno e il colore. */
export const TIPI_DEGLI_AIUTANTI = Object.freeze([
  { tipo: "input_boolean", it: "Interruttori", en: "Toggles", disegno: "prese", colore: "#0ea5e9" },
  { tipo: "input_number", it: "Numeri", en: "Numbers", disegno: "contatori", colore: "#7c3aed" },
  { tipo: "input_select", it: "Elenchi", en: "Dropdowns", disegno: "todo", colore: "#10b981" },
  { tipo: "input_text", it: "Testi", en: "Texts", disegno: "posta", colore: "#64748b" },
  {
    tipo: "input_datetime",
    it: "Date e ore",
    en: "Dates and times",
    disegno: "agenda",
    colore: "#f97316",
  },
  { tipo: "input_button", it: "Pulsanti", en: "Buttons", disegno: "azioni", colore: "#e11d48" },
  { tipo: "timer", it: "Timer", en: "Timers", disegno: "automazioni", colore: "#f59e0b" },
  { tipo: "counter", it: "Contatori", en: "Counters", disegno: "contatori", colore: "#6366f1" },
  { tipo: "schedule", it: "Programmi", en: "Schedules", disegno: "agenda", colore: "#14b8a6" },
]);

/** Cosa fa ogni tipo, in una riga, per il foglio «＋ Nuovo». */
export const SPIEGAZIONI_DEGLI_AIUTANTI = Object.freeze({
  input_boolean: {
    it: "Acceso o spento, da usare nelle automazioni",
    en: "On or off, to use in automations",
  },
  input_number: {
    it: "Un valore fra un minimo e un massimo",
    en: "A value between a minimum and a maximum",
  },
  input_select: {
    it: "Una scelta fra le voci che scrivi",
    en: "One choice among the options you write",
  },
  input_text: { it: "Un testo da scrivere e leggere", en: "A text to write and read" },
  input_datetime: { it: "Una data, un'ora o tutte e due", en: "A date, a time or both" },
  input_button: {
    it: "Un tasto che fa partire le automazioni",
    en: "A button that triggers automations",
  },
  timer: { it: "Un conto alla rovescia", en: "A countdown" },
  counter: { it: "Un numero che sale e scende", en: "A number that goes up and down" },
  schedule: { it: "Acceso nelle fasce orarie della settimana", en: "On in the week's time slots" },
});

/** Le parole dei campi dei moduli. */
export const PAROLE_DEI_CAMPI = Object.freeze({
  name: { it: "Nome", en: "Name" },
  icon: { it: "Icona (mdi:…)", en: "Icon (mdi:…)" },
  min: { it: "Minimo", en: "Minimum" },
  max: { it: "Massimo", en: "Maximum" },
  step: { it: "Passo", en: "Step" },
  unit_of_measurement: { it: "Unità di misura", en: "Unit of measurement" },
  mode: { it: "Come si cambia", en: "Display mode" },
  options: { it: "Voci (una per riga)", en: "Options (one per line)" },
  pattern: { it: "Forma (espressione regolare)", en: "Pattern (regex)" },
  cosa: { it: "Cosa tiene", en: "What it holds" },
  duration: { it: "Durata (ore:minuti:secondi)", en: "Duration (hours:minutes:seconds)" },
  restore: { it: "Ricorda il valore al riavvio", en: "Restore the value after a restart" },
  initial: { it: "Valore di partenza", en: "Initial value" },
  minimum: { it: "Minimo", en: "Minimum" },
  maximum: { it: "Massimo", en: "Maximum" },
  monday: { it: "Lunedì", en: "Monday" },
  tuesday: { it: "Martedì", en: "Tuesday" },
  wednesday: { it: "Mercoledì", en: "Wednesday" },
  thursday: { it: "Giovedì", en: "Thursday" },
  friday: { it: "Venerdì", en: "Friday" },
  saturday: { it: "Sabato", en: "Saturday" },
  sunday: { it: "Domenica", en: "Sunday" },
  slider: { it: "Cursore", en: "Slider" },
  box: { it: "Casella", en: "Box" },
  text: { it: "Testo", en: "Text" },
  password: { it: "Parola segreta", en: "Password" },
  data: { it: "Data", en: "Date" },
  ora: { it: "Ora", en: "Time" },
  "data-ora": { it: "Data e ora", en: "Date and time" },
  esempio_fasce: { it: "Es. 7-9, 18:30-23", en: "E.g. 7-9, 18:30-23" },
});

export const GIORNI = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

/* «8-12, 14:30-18» → [{from: "08:00:00", to: "12:00:00"}, …]. `null` se una
 * fascia e' storta. */
const ORA = /^(\d{1,2})(?:[:.](\d{2}))?$/;
function oraPiena(t, fine = false) {
  const m = ORA.exec(pulito(t));
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2] || 0);
  if (mi > 59 || h > 24 || (h === 24 && (mi || !fine))) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00`;
}

export function fasceDaTesto(testo) {
  const t = pulito(testo);
  if (!t) return [];
  const fuori = [];
  for (const pezzo of t.split(/[,;\n]+/)) {
    if (!pulito(pezzo)) continue;
    const [da, a] = pezzo.split(/[-–—]/);
    const from = oraPiena(da);
    const to = oraPiena(a, true);
    if (!from || !to || from >= to) return null;
    fuori.push({ from, to });
  }
  fuori.sort((x, y) => x.from.localeCompare(y.from));
  for (let i = 1; i < fuori.length; i += 1) if (fuori[i].from < fuori[i - 1].to) return null;
  return fuori;
}

export function fasceInTesto(fasce) {
  return (Array.isArray(fasce) ? fasce : [])
    .map((f) => `${pulito(f?.from).slice(0, 5)}-${pulito(f?.to).slice(0, 5)}`)
    .join(", ");
}

/** I campi del modulo di un tipo semplice. `parola(coppia)` traduce. */
export function campiDelTipo(tipo, parola = (c) => c.it) {
  const P = PAROLE_DEI_CAMPI;
  const campo = (nome, tipoCampo, extra = {}) => ({
    nome,
    sezione: "",
    tipo: tipoCampo,
    obbligatorio: false,
    etichetta: parola(P[nome]),
    aiuto: "",
    ...extra,
  });
  const scelte = (...v) => v.map((x) => ({ valore: x, etichetta: parola(P[x]) }));
  const base = [campo("name", "testo", { obbligatorio: true }), campo("icon", "testo")];
  if (tipo === "input_number")
    return [
      ...base,
      campo("min", "numero", { obbligatorio: true, passo: "any" }),
      campo("max", "numero", { obbligatorio: true, passo: "any" }),
      campo("step", "numero", { passo: "any" }),
      campo("unit_of_measurement", "testo"),
      campo("mode", "scelta", { opzioni: scelte("slider", "box") }),
    ];
  if (tipo === "input_select")
    return [...base, campo("options", "testo-lungo", { obbligatorio: true })];
  if (tipo === "input_text")
    return [
      ...base,
      campo("min", "numero", { passo: 1 }),
      campo("max", "numero", { passo: 1 }),
      campo("mode", "scelta", { opzioni: scelte("text", "password") }),
      campo("pattern", "testo"),
    ];
  if (tipo === "input_datetime")
    return [
      ...base,
      campo("cosa", "scelta", { obbligatorio: true, opzioni: scelte("data", "ora", "data-ora") }),
    ];
  if (tipo === "timer") return [...base, campo("duration", "durata"), campo("restore", "si-no")];
  if (tipo === "counter")
    return [
      ...base,
      campo("initial", "numero", { passo: 1 }),
      campo("step", "numero", { passo: 1 }),
      campo("minimum", "numero", { passo: 1 }),
      campo("maximum", "numero", { passo: 1 }),
      campo("restore", "si-no"),
    ];
  if (tipo === "schedule")
    return [...base, ...GIORNI.map((g) => campo(g, "testo", { aiuto: parola(P.esempio_fasce) }))];
  return base;
}

/** I valori del modulo da un aiutante che c'e' (la sua configurazione). */
export function valoriDellAiutante(tipo, config = {}) {
  const c = config || {};
  const v = { name: pulito(c.name), icon: pulito(c.icon) };
  const copia = (...nomi) => {
    for (const n of nomi) if (c[n] !== undefined && c[n] !== null) v[n] = c[n];
  };
  if (tipo === "input_number") copia("min", "max", "step", "unit_of_measurement", "mode");
  if (tipo === "input_select") v.options = (Array.isArray(c.options) ? c.options : []).join("\n");
  if (tipo === "input_text") copia("min", "max", "mode", "pattern");
  if (tipo === "input_datetime")
    v.cosa = c.has_date && c.has_time ? "data-ora" : c.has_date ? "data" : "ora";
  if (tipo === "timer") {
    v.duration = pulito(c.duration) || "";
    v.restore = c.restore === true;
  }
  if (tipo === "counter") {
    copia("initial", "step", "minimum", "maximum");
    v.restore = c.restore !== false;
  }
  if (tipo === "schedule") for (const g of GIORNI) v[g] = fasceInTesto(c[g]);
  return v;
}

/** Dai dati del modulo (`datiDelModulo`) ai campi per il ponte. Torna
 * `{campi}` o `{sbagliato: nome}`: il campo da correggere. */
export function campiPerIlPonte(tipo, dati = {}) {
  const fuori = { name: pulito(dati.name) };
  if (dati.icon !== undefined) fuori.icon = pulito(dati.icon);
  else fuori.icon = "";
  if (fuori.icon && !/^mdi:[a-z0-9-]{1,64}$/.test(fuori.icon)) return { sbagliato: "icon" };
  const copia = (...nomi) => {
    for (const n of nomi) if (dati[n] !== undefined) fuori[n] = dati[n];
  };
  if (tipo === "input_number") {
    copia("min", "max", "step", "unit_of_measurement", "mode");
    if (!(Number(fuori.min) < Number(fuori.max))) return { sbagliato: "max" };
  }
  if (tipo === "input_select") {
    const voci = pulito(dati.options).split("\n").map(pulito).filter(Boolean);
    if (!voci.length || new Set(voci).size !== voci.length) return { sbagliato: "options" };
    fuori.options = voci;
  }
  if (tipo === "input_text") copia("min", "max", "mode", "pattern");
  if (tipo === "input_datetime") {
    fuori.has_date = dati.cosa === "data" || dati.cosa === "data-ora";
    fuori.has_time = dati.cosa === "ora" || dati.cosa === "data-ora";
  }
  if (tipo === "timer") {
    if (dati.duration) {
      const d = dati.duration;
      fuori.duration = `${String(d.hours).padStart(2, "0")}:${String(d.minutes).padStart(2, "0")}:${String(d.seconds).padStart(2, "0")}`;
    }
    fuori.restore = dati.restore === true;
  }
  if (tipo === "counter") {
    copia("initial", "step", "minimum", "maximum");
    fuori.restore = dati.restore === true;
  }
  if (tipo === "schedule")
    for (const g of GIORNI) {
      const f = fasceDaTesto(dati[g]);
      if (f === null) return { sbagliato: g };
      fuori[g] = f;
    }
  return { campi: fuori };
}

/** Il riassunto di un aiutante sotto il nome: «16–26 °C», «Casa · Fuori».
 * Per il contatore e il programma torna i numeri (`{passo}`, `{giorni}`),
 * che la pagina mette in parole. */
export function riassuntoDellAiutante(a, parola = (c) => c.it) {
  const c = a?.config || {};
  if (a?.tipo === "input_number")
    return `${c.min ?? "?"}–${c.max ?? "?"}${c.unit_of_measurement ? ` ${c.unit_of_measurement}` : ""}`;
  if (a?.tipo === "input_select") return (c.options || []).join(" · ");
  if (a?.tipo === "timer") return pulito(c.duration) || "0:00:00";
  if (a?.tipo === "input_datetime")
    return parola(
      PAROLE_DEI_CAMPI[c.has_date && c.has_time ? "data-ora" : c.has_date ? "data" : "ora"],
    );
  if (a?.tipo === "counter") return { passo: c.step ?? 1 };
  if (a?.tipo === "schedule")
    return { giorni: GIORNI.filter((g) => Array.isArray(c[g]) && c[g].length).length };
  return "";
}
