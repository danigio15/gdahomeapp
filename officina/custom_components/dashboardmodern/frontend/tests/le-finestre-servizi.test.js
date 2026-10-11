/* Le finestre del gruppo «servizi»: aria, piante, acquario, animali, agenda,
 * rifiuti, allerte e stampanti (vedi `src/sections/finestre/servizi.js`).
 *
 * Le bozze approvate chiedevano per ognuna la stessa cosa: in cima il numero
 * che conta, poi l'elenco intero ordinato da chi ha bisogno di qualcosa, i
 * comandi dove ci sono davvero e niente nomi grezzi. Qui si disegnano con dei
 * widget finti — la stessa forma che i modelli della Home consegnano — e si
 * guarda quello che conta: l'ordine, i tasti, e che una sezione senza dato
 * non compaia con un numero inventato.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { finestraDi, stiliDelleFinestre } = await import("../src/sections/finestre-dei-widget.js");
const { FINESTRE_SERVIZI } = await import("../src/sections/finestre/servizi.js");
const { letturaDellAria, giudizioDellAria } = await import("../src/core/aria-model.js");

const disegna = (chiave, widget) => finestraDi(chiave).disegna({ key: chiave, ...widget }, {});
const testo = (markup) =>
  markup
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
const prima = (markup, uno, due) => markup.indexOf(uno) < markup.indexOf(due);

test("le otto finestre del gruppo sono registrate, col loro stile e la loro testa", () => {
  assert.deepEqual(
    [...FINESTRE_SERVIZI].sort(),
    ["acquario", "agenda", "allerte", "animali", "aria", "piante", "rifiuti", "stampanti"],
  );
  for (const chiave of FINESTRE_SERVIZI) {
    const finestra = finestraDi(chiave);
    assert.ok(finestra, chiave);
    assert.equal(typeof finestra.sottotitolo, "function", chiave);
  }
  const stile = stiliDelleFinestre();
  /* Il colore della finestra e' quello della sezione, non quello del giudizio. */
  assert.match(stile, /\[data-dm-widget-detail="aria"\]\{--dm-widget-accent:#0d9488!important/);
  assert.match(stile, /\.dm-f-agenda-scorri\{overflow-x:auto;scroll-snap-type:x mandatory/);
});

/* ── l'aria ── */

const misura = (entity, name, classe, valore, unita) =>
  letturaDellAria(entity, {
    state: String(valore),
    attributes: { device_class: classe, unit_of_measurement: unita, friendly_name: name },
  });

function ariaFinta() {
  const letture = [
    { ...misura("sensor.salotto_pm25", "Salotto PM2.5", "pm25", 9, "µg/m³"), name: "Salotto PM2.5" },
    { ...misura("sensor.salotto_co2", "Salotto CO2", "carbon_dioxide", 1150, "ppm"), name: "Salotto CO2" },
  ];
  const giudizio = giudizioDellAria(letture);
  return {
    copertina: giudizio.copertina,
    peggiore: giudizio.peggiore,
    rows: letture.map((lettura) => ({ entity: lettura.entity, name: lettura.name, lettura })),
  };
}

test("aria: in cima la misura peggiore con la sua scala e il consiglio, sotto le misure con un nome", () => {
  const markup = disegna("aria", ariaFinta());
  const scritto = testo(markup);
  assert.match(scritto, /Da cambiare/);
  assert.match(markup, /dm-f-aria-scala/);
  assert.match(scritto, /Apri una finestra per qualche minuto/);
  /* Il nome della sostanza in parole, non la sigla sola. */
  assert.match(scritto, /Polveri fini PM2\.5/);
  assert.match(scritto, /Anidride carbonica/);
  /* La peggiore prima, dentro il gruppo. */
  assert.ok(prima(markup, "Anidride carbonica", "Polveri fini"));
  /* Il verdetto generico non c'e' piu'. */
  assert.doesNotMatch(markup, /dm-w-verdetto|dm-w-casella/);
  assert.match(finestraDi("aria").sottotitolo(ariaFinta()), /2 misure/);
});

test("aria: con l'aria buona niente consiglio", () => {
  const lettura = { ...misura("sensor.co2", "CO2", "carbon_dioxide", 600, "ppm"), name: "CO2" };
  const markup = disegna("aria", {
    copertina: lettura,
    peggiore: lettura,
    rows: [{ entity: lettura.entity, name: "CO2", lettura }],
  });
  assert.doesNotMatch(markup, /dm-f-aria-consiglio/);
  assert.match(testo(markup), /Aria buona/);
});

/* ── le piante ── */

const pianta = (name, umidita, stato, altro = {}) => ({
  lettura: {
    entity: `sensor.${name.toLowerCase()}`,
    name,
    icon: "plant",
    umidita,
    minimo: 25,
    massimo: 70,
    fuori: false,
    gradi: null,
    ...altro,
  },
  stato,
  terra: umidita === null ? "" : umidita < 25 ? "low" : umidita > 70 ? "high" : "ok",
  ultimaAcqua: null,
  giorni: null,
  pioggia: null,
});

test("piante: in cima quella da innaffiare, poi tutte dalla più asciutta", () => {
  const basilico = pianta("Basilico", 18, "asciutta");
  const ficus = pianta("Ficus", 46, "bene");
  const orchidea = pianta("Orchidea", 61, "bene", { minimo: 40, massimo: 80 });
  const limone = pianta("Limone", 32, "bene", { fuori: true, gradi: 17.4 });
  const come = {
    piante: [ficus, orchidea, basilico, limone],
    daInnaffiare: [basilico],
    aspettano: [],
    bene: [ficus, orchidea, limone],
    mute: [],
    prossima: null,
    pioggia: null,
  };
  const markup = disegna("piante", { come });
  const scritto = testo(markup);
  assert.match(scritto, /Da innaffiare oggi Basilico/);
  assert.match(scritto, /la terra risale/);
  assert.ok(prima(markup, "<b>Basilico</b>", "<b>Limone</b>"));
  assert.ok(prima(markup, "<b>Limone</b>", "<b>Ficus</b>"));
  /* La forcella sua, scritta, solo per chi ce l'ha diversa. */
  assert.match(scritto, /vuole fra 40 e 80%/);
  assert.match(scritto, /fuori · terra 17,4°/);
  assert.equal(finestraDi("piante").sottotitolo({ come }), "4 piante · 1 ha sete");
});

/* ── l'acquario ── */

function vascaFinta({ comandi = true } = {}) {
  const temperatura = {
    entity: "sensor.vasca_t",
    name: "Temperatura",
    genere: "temperatura",
    muto: false,
    valore: 25.6,
    unita: "°C",
    minimo: 24,
    massimo: 27,
  };
  const ph = { entity: "sensor.vasca_ph", name: "pH", genere: "ph", muto: false, valore: 7.1, unita: "", minimo: 6.5, massimo: 7.5 };
  const tds = { entity: "sensor.vasca_tds", name: "Sali disciolti", genere: "misura", muto: false, valore: 214, unita: "ppm", minimo: null, massimo: null };
  const luce = { entity: "light.vasca", name: "Luce", genere: "luci", icon: "lights", muto: false, acceso: true };
  const co2 = { entity: "switch.vasca_co2", name: "CO₂", genere: "comando", icon: "toggle", muto: false, acceso: false };
  return {
    tipo: "acquario",
    testa: { grande: "Tutto nella norma" },
    come: {
      tipo: "acquario",
      vasca: "Vasca tropicale",
      litri: 240,
      stato: "bene",
      misure: [
        { lettura: temperatura, verdetto: "ok" },
        { lettura: ph, verdetto: "ok" },
        { lettura: tds, verdetto: "" },
      ],
      livelli: [],
      comandi: comandi ? [luce, co2] : [],
      cambio: { ultimo: null, ogni: 14, giorni: null, fra: null, scaduto: false },
    },
  };
}

test("acquario: la temperatura con la forcella, i valori con la loro, e i comandi che si toccano", () => {
  const widget = { elenco: [vascaFinta()] };
  const markup = disegna("acquario", widget);
  const scritto = testo(markup);
  assert.match(scritto, /25,6°/);
  assert.match(scritto, /Tutto regolare/);
  assert.match(scritto, /giusta 24–27°/);
  assert.match(scritto, /giusto \(6,5–7,5\)/);
  /* I comandi sono tasti veri, col loro servizio. */
  assert.match(markup, /data-dm-w-servizio="\{&quot;domain&quot;:&quot;light&quot;,&quot;service&quot;:&quot;toggle&quot;/);
  assert.match(markup, /data-dm-w-servizio="\{&quot;domain&quot;:&quot;switch&quot;/);
  /* Il cambio d'acqua mai segnato non si inventa. */
  assert.doesNotMatch(scritto, /Cambio d'acqua/);
  assert.equal(finestraDi("acquario").sottotitolo(widget), "Vasca tropicale · 240 L");
  /* Senza comandi, niente titolo «Comandi» a vuoto. */
  assert.doesNotMatch(testo(disegna("acquario", { elenco: [vascaFinta({ comandi: false })] })), /Comandi/);
});

/* ── gli animali ── */

test("animali: chi ha bisogno in cima, l'avviso in una riga e i tasti che la scheda conosce", () => {
  const micio = {
    id: "micio",
    nome: "Micio",
    disegno: "cat",
    gravita: "urgente",
    dentro: null,
    avvisi: [{ chiave: "cibo_scarso", gravita: "urgente", campo: "cibo_livello", testo: "Cibo in esaurimento" }],
    letture: [
      { chiave: "cibo_livello", quota: true, valore: 8, unita: "%", etichetta: "Cibo", testo: "8 %" },
      { chiave: "acqua_livello", quota: true, valore: 62, unita: "%", etichetta: "Acqua", testo: "62 %" },
    ],
    azioni: [
      { chiave: "cibo_eroga", glifo: "🍽️", entita: "button.micio_eroga", modo: "premi", testo: "Eroga una porzione" },
      { chiave: "lettiera_pulisci", glifo: "🧹", entita: "button.micio_pulisci", modo: "premi", testo: "Pulisci la lettiera" },
    ],
  };
  const fido = {
    id: "fido",
    nome: "Fido",
    disegno: "dog",
    gravita: "quiete",
    dentro: true,
    avvisi: [],
    letture: [{ chiave: "peso", quota: false, valore: 18.4, unita: "kg", etichetta: "Peso", testo: "18.4 kg" }],
    azioni: [],
  };
  const widget = { schede: [micio, fido] };
  const markup = disegna("animali", widget);
  const scritto = testo(markup);
  assert.ok(prima(markup, "Micio", "Fido"));
  assert.match(scritto, /Crocchette quasi finite: riempi il distributore/);
  assert.match(scritto, /Una porzione/);
  assert.match(markup, /&quot;domain&quot;:&quot;button&quot;,&quot;service&quot;:&quot;press&quot;/);
  /* Il tasto del cibo e' quello forte, perche' e' il cibo che manca. */
  assert.match(markup, /dm-f-sv-tasto dm-f-animali-forte" data-dm-w-servizio="[^"]*micio_eroga/);
  assert.match(scritto, /Fido in casa Tutto a posto/);
  assert.equal(finestraDi("animali").sottotitolo(widget), "Micio · Fido");
});

/* ── l'agenda ── */

test("agenda: il prossimo impegno in cima, la settimana, e le cose da fare coi loro tasti", () => {
  const adesso = Date.now();
  const evento = {
    summary: "Dentista",
    location: "Studio Bianchi",
    inizio: adesso + 2 * 3600000,
    fine: adesso + 3 * 3600000,
    tuttoIlGiorno: false,
  };
  const list = { id: "l1", entity: "todo.spesa", name: "Spesa" };
  const widget = {
    calendario: { eventi: [evento] },
    eventi: [evento],
    cose: { blocks: [{ list, items: [{ uid: "1", summary: "Pane", status: "needs_action", due: "" }] }] },
    blocks: [{ list, items: [{ uid: "1", summary: "Pane", status: "needs_action", due: "" }] }],
    daFare: 1,
    bozze: { l1: "Lat" },
  };
  const markup = disegna("agenda", widget);
  const scritto = testo(markup);
  assert.match(scritto, /Il prossimo/);
  assert.match(scritto, /fra (1|2) or/);
  assert.match(scritto, /📍 Studio Bianchi/);
  assert.equal((markup.match(/class="dm-f-sv-giorno"/g) || []).length, 7);
  assert.equal((markup.match(/data-oggi="true"/g) || []).length, 1);
  /* Le cose da fare tengono i gesti di sempre: spunta, cestino, riga nuova. */
  assert.match(markup, /class="dm-todo-check" data-dm-todo-check data-dm-todo-list="l1" data-dm-todo-uid="1"/);
  assert.match(markup, /class="dm-todo-del" data-dm-todo-del data-dm-todo-list="l1"/);
  assert.match(markup, /data-dm-todo-new="l1"\s+value="Lat"/);
  assert.match(markup, /data-dm-todo-add="l1"/);
  assert.ok(prima(markup, "Dentista", "Pane"));
  assert.match(finestraDi("agenda").sottotitolo(widget), /^1 impegno oggi · 1 da fare$/);
});

test("agenda: senza calendari solo le liste, senza eroe ne' settimana", () => {
  const list = { id: "l1", entity: "todo.spesa", name: "Spesa" };
  const markup = disegna("agenda", {
    cose: { blocks: [{ list, items: [] }] },
    blocks: [{ list, items: [] }],
    daFare: 0,
  });
  assert.doesNotMatch(markup, /dm-f-agenda-eroe|dm-f-sv-settimana/);
  assert.match(testo(markup), /Tutto fatto/);
});

/* ── i rifiuti ── */

test("rifiuti: il bidone di domani in grande, la settimana colorata, l'elenco in ordine", () => {
  const widget = {
    value: "Domani",
    rows: [
      { name: "Carta e cartone", materiale: "carta", colore: "#3b82f6", giorni: 3, value: "Fra 3 giorni" },
      { name: "Plastica e lattine", materiale: "plastica", colore: "#eab308", giorni: 1, value: "Domani" },
      { name: "Vetro", materiale: "vetro", colore: "#22c55e", giorni: null, value: "Data non trovata" },
    ],
  };
  const markup = disegna("rifiuti", widget);
  const scritto = testo(markup);
  assert.match(scritto, /Stasera fuori Plastica e lattine ritiro domani mattina/);
  assert.match(markup, /dm-f-rifiuti-bidone/);
  assert.match(markup, /--c:#eab308/);
  assert.ok(prima(markup, "<b>Plastica e lattine</b>", "<b>Carta e cartone</b>"));
  assert.ok(prima(markup, "<b>Carta e cartone</b>", "<b>Vetro</b>"));
  assert.match(scritto, /fra 3 giorni/);
  /* Il tasto «Messo fuori» non c'e': la plancia non ha dove ricordarselo. */
  assert.doesNotMatch(scritto, /Messo fuori/);
});

/* ── le allerte ── */

test("allerte: in cima solo l'avviso vero, col suo testo; sotto le fonti da tenere d'occhio", () => {
  const widget = {
    rows: [
      {
        name: "Pollini",
        glyph: "🌼",
        value: "Graminacee: medio",
        livello: "nota",
        lettura: { chiave: "pollini", livello: "nota" },
      },
      {
        name: "Protezione civile",
        glyph: "⚠️",
        value: "Pioggia",
        livello: "nota",
        lettura: { chiave: "meteo", livello: "nota", evento: "Bacini costieri", testo: "Piogge diffuse." },
        dal: Date.now(),
        al: null,
      },
      {
        name: "Terremoti",
        glyph: "🌍",
        value: "M 3,2 · Norcia",
        livello: "nota",
        lettura: { chiave: "terremoti", livello: "nota", distanza: 84 },
      },
      { name: "Voli", glyph: "✈️", value: "Nessun volo", livello: "quiete", lettura: { chiave: "voli" } },
    ],
  };
  const markup = disegna("allerte", widget);
  const scritto = testo(markup);
  assert.match(scritto, /Allerta gialla/);
  assert.match(scritto, /Piogge diffuse\./);
  assert.ok(prima(markup, "Allerta gialla", "Da tenere d&#39;occhio") || prima(markup, "Allerta gialla", "Da tenere d"));
  assert.match(scritto, /84 km da casa/);
  /* Senza la fine scritta dall'integrazione, nessun «fino a» inventato. */
  assert.doesNotMatch(scritto, /fino a/);
  assert.equal(finestraDi("allerte").sottotitolo(widget), "1 avviso · 2 da tenere d'occhio");
});

/* ── le stampanti ── */

test("stampanti: una scheda per stampante, le cartucce col loro colore e il consiglio per chi è agli sgoccioli", () => {
  const laser = {
    nome: "Laser ufficio",
    stato: "pronta",
    stampa: false,
    ferma: false,
    muta: false,
    cartucce: [{ nome: "Toner nero", tinta: "nero", quanta: 8, agliSgoccioli: true }],
    piuScarica: { quanta: 8, agliSgoccioli: true },
    pagine: null,
  };
  const inkjet = {
    nome: "Inkjet soggiorno",
    stato: "stampa",
    stampa: true,
    ferma: false,
    muta: false,
    cartucce: [
      { nome: "Nero", tinta: "nero", quanta: 54, agliSgoccioli: false },
      { nome: "Ciano", tinta: "ciano", quanta: 71, agliSgoccioli: false },
    ],
    piuScarica: { quanta: 54, agliSgoccioli: false },
    pagine: null,
  };
  const widget = { letture: [inkjet, laser] };
  const markup = disegna("stampanti", widget);
  const scritto = testo(markup);
  assert.ok(prima(markup, "Laser ufficio", "Inkjet soggiorno"));
  assert.match(scritto, /Nero 8%/);
  assert.match(scritto, /conviene ordinare il ricambio/);
  assert.match(scritto, /sta stampando/);
  assert.match(markup, /--h:71%;--c:#06b6d4/);
  assert.equal(finestraDi("stampanti").sottotitolo(widget), "2 stampanti · 1 da ricaricare");
});
