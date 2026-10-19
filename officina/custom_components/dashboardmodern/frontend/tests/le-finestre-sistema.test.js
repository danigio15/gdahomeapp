/* Le finestre del gruppo «sistema», disegnate una per una.
 *
 * Elettrodomestici, Cottura, MiniPC, Server e rete, In evidenza, le sezioni
 * proprie, Segnalazioni e Assistenza. Qui si guarda quello che conta: l'ordine
 * (chi finisce prima sta sopra, chi non risponde sta in cima), i comandi
 * presenti, nessun nome grezzo, e le parti che spariscono quando il dato non
 * c'e' — una finestra che inventa un numero e' peggio di una che tace.
 */
import assert from "node:assert/strict";
import test from "node:test";

const memoria = new Map();
globalThis.localStorage = {
  getItem: (chiave) => (memoria.has(chiave) ? memoria.get(chiave) : null),
  setItem: (chiave, valore) => memoria.set(chiave, String(valore)),
  removeItem: (chiave) => memoria.delete(chiave),
};
globalThis.document = undefined;
await import("../src/sections/home-widgets-section.js");
const { finestraDi } = await import("../src/sections/finestre-dei-widget.js");
const { FINESTRE_SISTEMA, nomePulito } = await import("../src/sections/finestre/sistema.js");

const adesso = Date.now();
const prima = (minuti) => new Date(adesso - minuti * 60000).toISOString();
const disegna = (chiave, widget, states = {}) => finestraDi(chiave).disegna(widget, states);

test("ogni tessera del gruppo ha la sua finestra", () => {
  for (const chiave of FINESTRE_SISTEMA) assert.ok(finestraDi(chiave), chiave);
});

test("elettrodomestici: chi finisce prima sta sopra, i fermi in fondo, niente doppioni", () => {
  const html = disegna("elettrodomestici", {
    rows: [
      {
        id: "lav",
        name: "Lavatrice",
        mode: "running",
        watts: 1180,
        type: "lavatrice",
        restano: 3000,
        fatto: 0.38,
        fase: "Lavaggio",
        programma: "Cotone",
        stanza: "Lavanderia",
      },
      {
        id: "lst",
        name: "Lavastoviglie",
        mode: "running",
        watts: 35,
        type: "lavastoviglie",
        restano: 1080,
        fatto: 0.84,
        fase: "Asciugatura",
      },
      { id: "asc", name: "Asciugatrice", mode: "off", type: "asciugatrice", ultimoAvvio: adesso - 86400000 },
      { id: "forno", name: "Forno", mode: "off", type: "forno", dentro: "24 °C" },
    ],
  });
  assert.ok(html.indexOf('data-dm-f-apparecchio="lst"') < html.indexOf('data-dm-f-apparecchio="lav"'));
  assert.match(html, /18 min/);
  assert.match(html, /Asciugatura/);
  assert.match(html, /dentro 24 °C/);
  assert.ok(html.indexOf("Fermi") > html.indexOf('data-dm-f-apparecchio="lav"'));
  assert.doesNotMatch(html, /Le misure|Lo stato/);
  /* Chi non dice quanto manca non ha la corsa: niente barre inventate. */
  const senza = disegna("elettrodomestici", {
    rows: [{ id: "x", name: "Boiler", mode: "running", watts: 900, type: "boiler" }],
  });
  assert.doesNotMatch(senza, /dm-f-corsa/);
});

test("cottura: anello col conto alla rovescia, i tasti che la casa offre e basta", () => {
  const html = disegna("cottura", {
    cucina: {
      nome: "Friggitrice",
      fase: "cottura",
      parola: "In cottura",
      rimasti: 445,
      totali: 900,
      frazione: 0.49,
      prontaAlle: adesso + 445000,
      programma: "Patatine",
      gradi: { valore: 180, unita: "°C" },
      femminile: true,
      cassetto: false,
      tipo: "air-fryer",
      comandi: {
        pausa: { domain: "button", service: "press", data: { entity_id: "button.pausa" } },
        stop: { domain: "button", service: "press", data: { entity_id: "button.stop" } },
      },
      altri: [{ nome: "Forno", glifo: "🔥", parola: "Spento", spenta: true, gradi: null }],
    },
  });
  assert.match(html, /7:25/);
  assert.match(html, /di 15 min/);
  assert.match(html, /Cassetto chiuso/);
  assert.match(html, /data-dm-f-comando="pausa"/);
  assert.match(html, /data-dm-f-comando="stop"/);
  assert.doesNotMatch(html, /data-dm-f-comando="piu_un_minuto"/);
  assert.match(html, /Gli altri in cucina/);
});

test("minipc: la CPU nell'anello, RAM e disco come barre, la rete in caselle", () => {
  const html = disegna("minipc", {
    rows: [
      { chiave: "cpu", raw: 37, value: "37%", name: "CPU" },
      { chiave: "ram", raw: 91, value: "91%", name: "RAM" },
      { chiave: "disco", raw: 54, value: "54%", name: "Disco" },
      { chiave: "scarica", raw: 215, value: "215 Mb/s", name: "Download" },
      { chiave: "ping", raw: 18, value: "18 ms", name: "Ping" },
      { chiave: "internet", on: true, value: "Attivo", name: "Internet" },
    ],
  });
  assert.match(html, /Lavora tranquillo/);
  assert.match(html, /data-tono="caldo"/);
  assert.match(html, /Internet attivo/);
  assert.match(html, />215</);
  assert.doesNotMatch(html, /Invia/);
});

test("server e rete: chi non risponde in cima con il suo tasto, gli altri per integrazione", () => {
  const html = disegna("macchine", {
    rows: [
      { name: "Home Assistant", glyph: "server", stato: "su", famiglia: "macchine", integrazione: "Proxmox VE" },
      {
        name: "NAS",
        glyph: "server",
        stato: "giu",
        famiglia: "macchine",
        comandi: { tipo: "switch", entity: "switch.nas" },
        da: adesso - 3 * 3600000,
        integrazione: "Proxmox VE",
      },
      { name: "Ripetitore", glyph: "router", stato: "giu", famiglia: "rete", da: adesso - 40 * 60000 },
    ],
  });
  assert.ok(html.indexOf("NAS") < html.indexOf("Home Assistant"));
  assert.match(html, /switch\.nas/);
  assert.match(html, /Ferma da 3 h/);
  assert.match(html, /va riacceso a mano/);
  assert.match(html, /Proxmox VE/);
  /* La parola grezza del disegno non si stampa mai. */
  assert.doesNotMatch(html, />server</);
  assert.doesNotMatch(html, />router</);
});

test("in evidenza: la leva per chi si comanda, Aperto/Chiuso per un cancello", () => {
  const states = {
    "switch.pompa": { state: "on", attributes: {}, last_changed: prima(25) },
    "binary_sensor.cancello": { state: "off", attributes: { device_class: "gate" }, last_changed: prima(90) },
    "sensor.cisterna": { state: "72", attributes: { unit_of_measurement: "%" }, last_changed: prima(10) },
  };
  const html = disegna(
    "evidenza",
    {
      rows: [
        { entity: "binary_sensor.cancello", name: "Cancello", on: false, value: "Spento", glyph: "⭐" },
        { entity: "sensor.cisterna", name: "Cisterna", raw: 72, unit: "%", value: "72 %", glyph: "🛢️" },
        { entity: "switch.pompa", name: "Pompa del pozzo", on: true, value: "Acceso", glyph: "💧" },
      ],
    },
    states,
  );
  assert.ok(html.indexOf("Pompa del pozzo") < html.indexOf("Cancello"));
  assert.match(html, /data-dm-w-light="switch\.pompa"/);
  assert.match(html, /Chiuso/);
  assert.doesNotMatch(html, />Spento</);
  assert.match(html, /dm-f-ev-barra/);
});

test("sezioni mie: il livello fa da eroe, la valvola si apre e si chiude, niente entity_id", () => {
  const html = disegna(
    "sezionimie",
    {
      icon: "🏠",
      rows: [
        { entity: "sensor.serbatoio_tetto_level", name: "SERBATOIO_TETTO_LEVEL", raw: 64, unit: "%", value: "64 %", glyph: "🏠" },
        { entity: "valve.ingresso", name: "Valvola ingresso", on: true, value: "Acceso", glyph: "🏠" },
        { entity: "sensor.acqua", name: "Temperatura acqua", raw: 19.5, unit: "°C", value: "19,5 °C", glyph: "🏠" },
      ],
    },
    {},
  );
  assert.match(html, /dm-f-mia-vasca/);
  assert.match(html, /Aperta/);
  assert.match(html, /data-dm-w-light="valve\.ingresso"/);
  assert.doesNotMatch(html, /SERBATOIO_TETTO_LEVEL/);
  assert.equal(nomePulito("SERBATOIO_TETTO_LEVEL"), "Serbatoio tetto level");
  assert.equal(nomePulito("sensor.acqua_calda"), "Acqua calda");
  assert.equal(nomePulito("Valvola ingresso"), "Valvola ingresso");
  /* Senza una percentuale non c'e' eroe. */
  assert.doesNotMatch(
    disegna("sezionimie", { rows: [{ entity: "valve.x", name: "Uscita", on: false, value: "Spento" }] }, {}),
    /dm-f-mia-vasca/,
  );
});

test("segnalazioni: il conto da lavorare, chi aspetta, le ferme, niente chiuse", () => {
  const html = disegna("segnalazioni", {
    conto: {
      quante: 6,
      oggi: 2,
      bug: 3,
      feature: 2,
      assistenza: 1,
      vecchie: 2,
      piuVecchia: 175,
      nuove: 5,
      inLavorazione: 1,
      chiuse: 9,
      conversazioni: [{ number: 209, title: "Non trovo la Piscina", messages: 2, autore: "persona-11-p", stato: "inviato", opened: true }],
    },
  });
  assert.match(html, /da lavorare/);
  assert.match(html, /Ti stanno aspettando/);
  assert.match(html, /#209 · persona-11-p/);
  assert.match(html, /#175/);
  assert.doesNotMatch(html, /Chiuse/);
  assert.doesNotMatch(html, /✦/);
  assert.match(html, /data-dm-apri-cruscotto/);
  const vuota = disegna("segnalazioni", { conto: { quante: 0 } });
  assert.doesNotMatch(vuota, /Ti stanno aspettando|dm-f-seg-ferme|dm-f-seg-barra/);
});

test("assistenza: la risposta intera, la domanda se c'e', il campo per rispondere", () => {
  const html = disegna("assistenza", {
    risposte: 2,
    scrittoIl: adesso,
    anteprima: "Ciao! Ho guardato…",
    testo: "Ciao! Ho guardato i log: manca il sensore della pompa.",
    domanda: { testo: "La Piscina non compare", scrittoIl: adesso - 3600000 },
  });
  assert.match(html, /manca il sensore della pompa/);
  assert.match(html, /La Piscina non compare/);
  /* Il conto sta nel sottotitolo della finestra, non in una casella. */
  assert.doesNotMatch(html, /dm-w-casella|Da leggere/);
  assert.match(html, /data-dm-chat-rispondi/);
  assert.match(html, /data-dm-apri-chat/);
  assert.doesNotMatch(html, /AM|PM/);
  const senza = disegna("assistenza", { risposte: 1, anteprima: "Ok" });
  assert.doesNotMatch(senza, /dm-f-chat-mia/);
});
